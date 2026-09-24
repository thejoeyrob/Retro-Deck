import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const BASE = "https://www.myabandonware.com";
const BUCKET = "retrodeck-private";
const MAX_ROM_BYTES = 160 * 1024 * 1024;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SYSTEMS = [
  { re: /atari\s*2600/i, label: "Atari 2600", exts: ["a26", "bin", "rom"], repo: "Atari_-_2600" },
  { re: /mega\s*drive|genesis/i, label: "Genesis", exts: ["md", "gen", "smd", "68k", "bin"], repo: "Sega_-_Mega_Drive_-_Genesis" },
  { re: /master\s*system/i, label: "SEGA Master System", exts: ["sms"], repo: "Sega_-_Master_System_-_Mark_III" },
  { re: /game\s*gear/i, label: "Game Gear", exts: ["gg"], repo: "Sega_-_Game_Gear" },
  { re: /super\s*nintendo|snes/i, label: "SNES", exts: ["sfc", "smc", "fig"], repo: "Nintendo_-_Super_Nintendo_Entertainment_System" },
  { re: /nintendo\s*64|\bn64\b/i, label: "Nintendo 64", exts: ["z64", "n64", "v64"], repo: "Nintendo_-_Nintendo_64" },
  { re: /game\s*boy\s*advance|\bgba\b/i, label: "Game Boy Advance", exts: ["gba"], repo: "Nintendo_-_Game_Boy_Advance" },
  { re: /game\s*boy\s*color|\bgbc\b/i, label: "Game Boy Color", exts: ["gbc"], repo: "Nintendo_-_Game_Boy_Color" },
  { re: /game\s*boy|\bgb\b/i, label: "Game Boy", exts: ["gb"], repo: "Nintendo_-_Game_Boy" },
  { re: /\bnes\b|nintendo entertainment|famicom/i, label: "NES", exts: ["nes", "unf", "unif"], repo: "Nintendo_-_Nintendo_Entertainment_System" },
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}
function stripTags(s = "") {
  return s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function abs(u = "") { try { return new URL(u, BASE).href; } catch { return ""; } }
function norm(s = "") { return stripTags(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim(); }
function titleScore(title: string, query: string) {
  const t = norm(title), q = norm(query), bits = q.split(/\s+/).filter(Boolean);
  let score = t.includes(q) ? 10 : 0;
  if (t.startsWith(q)) score += 4;
  score += bits.filter(b => t.includes(b)).length * 3;
  return score;
}
function systemFrom(text = "") { return SYSTEMS.find(s => s.re.test(text)); }
function safeName(s = "game") { return s.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "game"; }
function fileNameFromDisposition(v = "") {
  const m = v.match(/filename\*=UTF-8''([^;]+)/i) || v.match(/filename="?([^";]+)"?/i);
  if (!m) return "";
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}
async function fetchText(url: string, referer?: string) {
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 RetroDeck/1.6", "accept": "text/html,application/xhtml+xml", ...(referer ? { referer } : {}) } });
  if (!r.ok) throw new Error(`Source returned ${r.status}`);
  return await r.text();
}

function parseSearch(html: string, query: string) {
  const out: any[] = [], seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"']*\/game\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 80) {
    const pageUrl = abs(m[1]);
    if (!pageUrl || seen.has(pageUrl)) continue;
    let title = stripTags(m[2]).replace(/^Download\s+/i, "").trim();
    const nearby = html.slice(Math.max(0, m.index - 900), Math.min(html.length, m.index + m[0].length + 1200));
    if (!title || title.length < 2 || /download|manual|comment|screenshot/i.test(title)) {
      const heading = nearby.match(/<(?:h2|h3|strong)[^>]*>([\s\S]*?)<\/(?:h2|h3|strong)>/i);
      title = stripTags(heading?.[1] || "");
    }
    if (!title || title.length < 2) continue;
    const score = titleScore(title, query);
    if (score < Math.max(6, norm(query).split(/\s+/).length * 3)) continue;
    const text = stripTags(nearby);
    const system = systemFrom(text);
    if (!system) continue; // only show systems Retro Deck can play
    const year = (text.match(/\b(19\d{2}|20\d{2})\b/) || [])[1] || "";
    const img = nearby.match(/<img\b[^>]*(?:data-src|data-original|src)=["']([^"']+)["']/i);
    const coverUrl = img ? abs(img[1]) : "";
    seen.add(pageUrl);
    out.push({ id: pageUrl.split("/game/")[1], title, platform: system.label, year, coverUrl, pageUrl, score });
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,24).map(({score,...x})=>x);
}

async function searchCatalog(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  const variants = [
    `${BASE}/search/q/${encodeURIComponent(q).replace(/%20/g, "+")}`,
    `${BASE}/search?q=${encodeURIComponent(q)}`,
  ];
  for (const url of variants) {
    try {
      const items = parseSearch(await fetchText(url), q);
      if (items.length) return items;
    } catch (_) {}
  }
  return [];
}

function downloadLinks(html: string) {
  const out: { url: string, index: number }[] = [];
  const re = /href=["']([^"']*\/download\/[^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = abs(m[1]);
    if (url && !out.some(x => x.url === url)) out.push({ url, index: m.index });
  }
  return out;
}
function chooseDownload(html: string, platform: string) {
  const links = downloadLinks(html);
  if (!links.length) return "";
  const sys = systemFrom(platform);
  if (!sys) return links[0].url;
  const lower = html.toLowerCase();
  const needles = [sys.label.toLowerCase(), ...(sys.label === "Genesis" ? ["genesis rom", "mega drive"] : [])];
  let pos = -1;
  for (const n of needles) { const p = lower.indexOf(n); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
  if (pos >= 0) return [...links].sort((a,b)=>Math.abs(a.index-pos)-Math.abs(b.index-pos))[0].url;
  return links[0].url;
}

function pageCover(html: string) {
  const og = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (og?.[1]) return abs(og[1]);
  const main = html.match(/<img\b[^>]*(?:class=["'][^"']*(?:cover|boxart|game-img)[^"']*["'])[^>]*(?:data-src|data-original|src)=["']([^"']+)["']/i);
  return main?.[1] ? abs(main[1]) : "";
}

async function wikiCover(title: string) {
  try {
    const q = encodeURIComponent(`${title} video game`);
    const u = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=4&prop=pageimages&piprop=thumbnail&pithumbsize=900&format=json&origin=*`;
    const data = await (await fetch(u)).json();
    const pages = Object.values(data?.query?.pages || {}) as any[];
    pages.sort((a,b)=>titleScore(b.title,title)-titleScore(a.title,title));
    return pages.find(x=>x?.thumbnail?.source)?.thumbnail?.source || "";
  } catch { return ""; }
}
async function libretroCover(title: string, platform: string) {
  const sys = systemFrom(platform); if (!sys) return "";
  const variants = [title, `${title} (USA)`, `${title} (Europe)`, `${title} (World)`];
  for (const name of variants) {
    const url = `https://raw.githubusercontent.com/libretro-thumbnails/${sys.repo}/master/Named_Boxarts/${encodeURIComponent(name)}.png`;
    try { const r = await fetch(url, { method: "GET" }); if (r.ok && Number(r.headers.get("content-length") || 6000) > 5000) return url; } catch {}
  }
  return "";
}
async function fetchBinary(url: string, referer: string) {
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 RetroDeck/1.6", referer, "accept": "application/octet-stream,application/zip,*/*" } });
  if (!r.ok) throw new Error(`Download returned ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const type = r.headers.get("content-type") || "";
  if (/text\/html/i.test(type) || (buf.length > 5 && new TextDecoder().decode(buf.slice(0,64)).includes("<!DOCTYPE"))) throw new Error("The source returned an HTML page instead of a game file.");
  if (!buf.length || buf.length > MAX_ROM_BYTES) throw new Error("Game file is empty or exceeds the Retro Deck cloud limit.");
  const disposition = r.headers.get("content-disposition") || "";
  return { buf, fileName: fileNameFromDisposition(disposition) || new URL(r.url).pathname.split("/").pop() || "game.rom", type };
}
function ext(name: string) { return (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ""); }
function extractPlayable(bytes: Uint8Array, fileName: string, platform: string) {
  const sys = systemFrom(platform);
  if (ext(fileName) !== "zip" || !sys) return { bytes, fileName };
  const files = unzipSync(bytes);
  const choices = Object.entries(files).filter(([name]) => sys.exts.includes(ext(name)) && !/__macosx|\.txt$|\.nfo$/i.test(name));
  if (!choices.length) return { bytes, fileName };
  choices.sort((a,b)=>b[1].length-a[1].length);
  return { bytes: choices[0][1], fileName: choices[0][0].split("/").pop() || `${safeName(platform)}.${sys.exts[0]}` };
}

async function ensureBucket(admin: any) {
  const { data } = await admin.storage.listBuckets();
  if (!(data || []).some((b:any)=>b.name===BUCKET)) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_ROM_BYTES, allowedMimeTypes: ["application/octet-stream","image/png","image/jpeg","image/webp"] });
    if (error && !/already exists/i.test(error.message || "")) throw error;
  }
}
async function uploadAndSign(admin: any, path: string, body: Uint8Array, contentType: string) {
  const { error } = await admin.storage.from(BUCKET).upload(path, body, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data, error: signError } = await admin.storage.from(BUCKET).createSignedUrl(path, 900);
  if (signError) throw signError;
  return data.signedUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Authentication required" }, 401);
    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, service, { auth: { persistSession: false } });
    const body = await req.json();

    if (body.action === "search") {
      return json({ items: await searchCatalog(String(body.query || "")) });
    }
    if (body.action !== "ingest") return json({ error: "Unknown action" }, 400);

    const item = body.item || {};
    const page = new URL(String(item.pageUrl || ""));
    if (page.hostname !== "www.myabandonware.com" && page.hostname !== "myabandonware.com") return json({ error: "Unsupported source" }, 400);
    const platform = String(item.platform || "");
    const system = systemFrom(platform);
    if (!system) return json({ error: "That platform is not supported by this Retro Deck build." }, 400);

    const html = await fetchText(page.href);
    const downloadUrl = chooseDownload(html, platform);
    if (!downloadUrl) return json({ error: "No compatible download was found on the selected game page.", code: "NO_DOWNLOAD" }, 404);
    const downloaded = await fetchBinary(downloadUrl, page.href);
    const playable = extractPlayable(downloaded.buf, downloaded.fileName, platform);
    const title = String(item.title || stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1] || "Game"));

    await ensureBucket(admin);
    const stamp = Date.now();
    const gameId = safeName(String(item.id || title)).toLowerCase();
    const romName = safeName(playable.fileName || `${gameId}.${system.exts[0]}`);
    const romPath = `${userId}/rom/${gameId}/${stamp}-${romName}`;
    const romUrl = await uploadAndSign(admin, romPath, playable.bytes, "application/octet-stream");

    let coverUrl = "", coverSource = "";
    const candidate = pageCover(html) || await libretroCover(title, platform) || await wikiCover(title) || String(item.coverUrl || "");
    if (candidate) {
      try {
        const cr = await fetch(candidate); const cb = new Uint8Array(await cr.arrayBuffer());
        const ct = cr.headers.get("content-type") || "image/jpeg";
        if (cr.ok && cb.length > 3000 && /^image\//i.test(ct)) {
          const artExt = /png/i.test(ct) ? "png" : /webp/i.test(ct) ? "webp" : "jpg";
          const artPath = `${userId}/art/${gameId}.${artExt}`;
          coverUrl = await uploadAndSign(admin, artPath, cb, ct); coverSource = candidate;
        }
      } catch (_) {}
    }
    return json({ title, platform: system.label, fileName: romName, romUrl, coverUrl, coverSource, sourcePageUrl: page.href });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e), code: "RETRODECK_EDGE_ERROR" }, 500);
  }
});
