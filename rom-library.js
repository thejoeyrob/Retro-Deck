(()=>{
'use strict';
const $=s=>document.querySelector(s);
const DB_NAME='jw-retro-roms';
const DB_VERSION=1;
const STORE='roms';
const KEY_PREFIX='game:';
const EJS_DATA='https://cdn.emulatorjs.org/stable/data/';
const MAX_SINGLE_ROM=512*1024*1024;

const SYSTEMS={
  atari2600:{label:'Atari 2600',core:'atari2600',ext:['a26'],repo:'Atari_-_2600',aspect:4/3},
  nes:{label:'Nintendo NES',core:'nes',ext:['nes','unf','unif'],repo:'Nintendo_-_Nintendo_Entertainment_System',aspect:4/3},
  snes:{label:'Super Nintendo / SNES',core:'snes',ext:['sfc','smc','fig','swc','gd3','gd7','dx2','bsx'],repo:'Nintendo_-_Super_Nintendo_Entertainment_System',aspect:4/3},
  gb:{label:'Nintendo Game Boy',core:'gb',ext:['gb'],repo:'Nintendo_-_Game_Boy',aspect:10/9},
  gbc:{label:'Nintendo Game Boy Color',core:'gb',ext:['gbc'],repo:'Nintendo_-_Game_Boy_Color',aspect:10/9},
  gba:{label:'Nintendo Game Boy Advance',core:'gba',ext:['gba'],repo:'Nintendo_-_Game_Boy_Advance',aspect:3/2},
  segaMD:{label:'Sega Mega Drive / Genesis',core:'segaMD',ext:['md','gen','smd','68k','sgd'],repo:'Sega_-_Mega_Drive_-_Genesis',aspect:4/3},
  segaMS:{label:'Sega Master System',core:'segaMS',ext:['sms'],repo:'Sega_-_Master_System_-_Mark_III',aspect:4/3},
  segaGG:{label:'Sega Game Gear',core:'segaGG',ext:['gg'],repo:'Sega_-_Game_Gear',aspect:10/9},
  n64:{label:'Nintendo 64',core:'n64',ext:['z64','n64','v64'],repo:'Nintendo_-_Nintendo_64',aspect:4/3}
};

let records=[];
let selectedId=null;
const CLASSICS=window.RETRO_DECK_CLASSICS||[];
const coverUrlCache=new Map();
let classicVisibleLimit=12;
let featureIndex=0,featureTimer=0,featurePointer=null;
let activeStateBlobUrl=null,autoSaveTimer=0,exiting=false;
let active=false;
let activeId=null;
let activeBlobUrl=null;
let playerFrame=null;
let importBusy=false;
let pendingSourceItem=null;
let pendingSourceAdapter=null;
let visibleLimit=15;
let latestSourceResults=[];
let sourceSearchTimer=null;
let sourceSearchSeq=0;

function notify(msg,ms=2200){
  const el=$('#toast');
  if(!el)return;
  el.textContent=msg;el.classList.remove('hidden');
  clearTimeout(notify._t);notify._t=setTimeout(()=>el.classList.add('hidden'),ms);
}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function uuid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
function extOf(name=''){const m=String(name).toLowerCase().match(/\.([a-z0-9]+)$/);return m?m[1]:''}
function stripExt(name=''){return String(name).replace(/\.[^.]+$/,'')}
function cleanTitle(name=''){
  return stripExt(name)
    .replace(/\[[^\]]*\]/g,' ')
    .replace(/\((?:usa|europe|world|japan|rev[^)]*|en[^)]*|proto[^)]*|beta[^)]*|unl[^)]*|virtual console[^)]*)\)/ig,' ')
    .replace(/[._]+/g,' ')
    .replace(/\s+/g,' ').trim();
}
function smartTitleCase(s=''){
  const minor=new Set(['of','the','and','or','in','on','to','for','a','an']);
  return s.toLowerCase().split(/\s+/).map((w,i)=>i&&minor.has(w)?w:w.replace(/(^|[-'])\p{L}/gu,m=>m.toUpperCase())).join(' ');
}
function ascii(bytes,start,len){
  if(bytes.length<start+len)return'';
  let out='';for(let i=start;i<start+len;i++){const c=bytes[i];if(c===0)break;out+=(c>=32&&c<=126)?String.fromCharCode(c):' '}
  return out.replace(/\s+/g,' ').trim();
}
function hasAscii(bytes,start,text){if(bytes.length<start+text.length)return false;for(let i=0;i<text.length;i++)if(bytes[start+i]!==text.charCodeAt(i))return false;return true}
function printableScore(s=''){if(!s)return 0;let ok=0;for(const c of s)if(/[A-Za-z0-9 !&'()\-.,:+]/.test(c))ok++;return ok/s.length}

function detectPlatform(name,buf){
  const bytes=new Uint8Array(buf), ext=extOf(name);
  if(hasAscii(bytes,0,'NES\x1a'))return'nes';
  if(bytes.length>0x180 && hasAscii(bytes,0x100,'SEGA'))return'segaMD';
  if(ext==='gbc')return'gbc';
  if(ext==='gb')return'gb';
  if(ext==='gba')return'gba';
  if(ext==='sms')return'segaMS';
  if(ext==='gg')return'segaGG';
  if(['z64','n64','v64'].includes(ext))return'n64';
  for(const [id,s] of Object.entries(SYSTEMS))if(s.ext.includes(ext))return id;
  if(ext==='bin' && bytes.length<=128*1024)return'atari2600';
  if(ext==='rom' && bytes.length<=128*1024)return'atari2600';
  return'';
}
function internalTitle(platform,buf){
  const b=new Uint8Array(buf);
  try{
    if(platform==='segaMD'){
      const over=ascii(b,0x150,48),dom=ascii(b,0x120,48);
      return printableScore(over)>.7?over:(printableScore(dom)>.7?dom:'');
    }
    if(platform==='gb'||platform==='gbc')return ascii(b,0x134,15);
    if(platform==='gba')return ascii(b,0xA0,12);
    if(platform==='snes'){
      const copier=(b.length%1024===512)?512:0;
      const a=ascii(b,copier+0x7FC0,21),c=ascii(b,copier+0xFFC0,21);
      return printableScore(a)>=printableScore(c)&&printableScore(a)>.65?a:(printableScore(c)>.65?c:'');
    }
  }catch{}
  return'';
}
function bestTitle(fileName,platform,buf){
  const fromFile=cleanTitle(fileName);
  const inside=internalTitle(platform,buf).replace(/\s+/g,' ').trim();
  if(fromFile && !/^(game|rom|unknown|untitled)$/i.test(fromFile))return fromFile;
  return inside?smartTitleCase(inside):fromFile||'Untitled ROM';
}

async function sha1(buf){
  try{const h=await crypto.subtle.digest('SHA-1',buf);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return''}
}
function crc32(buf){
  let table=crc32._table;if(!table){table=crc32._table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}}
  let c=0xffffffff;const u=new Uint8Array(buf);for(const v of u)c=table[(c^v)&255]^(c>>>8);return((c^0xffffffff)>>>0).toString(16).padStart(8,'0')
}

function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putRecord(rec){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec,KEY_PREFIX+rec.id);tx.oncomplete=()=>resolve(rec);tx.onerror=()=>reject(tx.error)})}
async function deleteRecord(id){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(KEY_PREFIX+id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function getRecord(id){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const r=tx.objectStore(STORE).get(KEY_PREFIX+id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function allRecords(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),st=tx.objectStore(STORE),r=st.openCursor(),out=[];r.onsuccess=()=>{const c=r.result;if(!c)return resolve(out);if(String(c.key).startsWith(KEY_PREFIX)&&c.value?.kind==='library-rom')out.push(c.value);c.continue()};r.onerror=()=>reject(r.error)})}

function platformFromLabel(v=''){
  const q=v.toLowerCase();
  if(/mega|genesis/.test(q))return'segaMD';if(/master/.test(q))return'segaMS';if(/game\s*gear/.test(q))return'segaGG';
  if(/atari.*2600|2600/.test(q))return'atari2600';if(/game\s*boy\s*advance|gba/.test(q))return'gba';if(/game\s*boy\s*color|gbc/.test(q))return'gbc';if(/game\s*boy|\bgb\b/.test(q))return'gb';
  if(/super\s*nintendo|snes/.test(q))return'snes';if(/nintendo\s*64|\bn64\b/.test(q))return'n64';if(/nes|famicom|nintendo entertainment/.test(q))return'nes';
  return'';
}
function normalizeThumbName(s=''){return s.replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim()}
function regionFromFilename(name=''){const m=stripExt(name).match(/\((USA(?:, Europe)?|Europe|World|Japan)\)/i);return m?m[1]:''}
function coverCandidates(rec){
  const sys=SYSTEMS[rec.platform];if(!sys?.repo)return[];
  const exact=stripExt(rec.fileName||'').trim();
  const base=rec.title?.trim()||cleanTitle(rec.fileName);
  const inside=rec.internalTitle?.trim();
  const region=regionFromFilename(rec.fileName);
  const names=[];
  const add=n=>{n=normalizeThumbName(n);if(n&&!names.includes(n))names.push(n)};
  add(exact);add(base);if(inside){add(inside);add(smartTitleCase(inside))}
  if(region){add(`${base} (${region})`);add(`${smartTitleCase(base)} (${region})`)}
  for(const r of ['USA','Europe','World','USA, Europe']){add(`${base} (${r})`);add(`${smartTitleCase(base)} (${r})`)}
  const root=`https://raw.githubusercontent.com/libretro-thumbnails/${sys.repo}/master/Named_Boxarts/`;
  return names.slice(0,10).map(n=>root+encodeURIComponent(n)+'.png');
}
async function fetchWithTimeout(url,opts={},ms=3500){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opts,signal:c.signal})}finally{clearTimeout(t)}}
async function fetchImageBlob(url,ms=4500){
  try{const r=await fetchWithTimeout(url,{cache:'force-cache'},ms);if(!r.ok)return null;const blob=await r.blob();return (blob.type.startsWith('image/')||blob.size>5000)?blob:null}catch{return null}
}
async function wikipediaCover(rec){
  try{
    const platform=SYSTEMS[rec.platform]?.label||rec.catalogPlatform||'';
    const q=encodeURIComponent(`${rec.title} video game ${platform}`.trim());
    const url=`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=5&prop=pageimages|pageterms&piprop=thumbnail&pithumbsize=800&format=json&origin=*`;
    const r=await fetchWithTimeout(url,{cache:'no-store'},5500);if(!r.ok)return null;
    const data=await r.json();const pages=Object.values(data?.query?.pages||{});
    const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const wanted=norm(rec.title);
    pages.sort((a,b)=>{const aa=norm(a.title).includes(wanted)?1:0,bb=norm(b.title).includes(wanted)?1:0;return bb-aa});
    for(const page of pages){const src=page?.thumbnail?.source;if(!src)continue;const blob=await fetchImageBlob(src,4500);if(blob)return{blob,url:src}}
  }catch{}
  return null;
}
function normGameTitle(s=''){
  return String(s).toLowerCase().normalize('NFKD').replace(/\b(the|game|video game|edition|version)\b/g,' ').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function titleTokens(s=''){return normGameTitle(s).split(' ').filter(Boolean)}
function fuzzyScore(a,b){
  const A=titleTokens(a),B=titleTokens(b);if(!A.length||!B.length)return 0;
  const as=new Set(A),bs=new Set(B);let common=0;for(const x of as)if(bs.has(x))common++;
  const union=new Set([...as,...bs]).size||1;let score=common/union;
  const na=normGameTitle(a),nb=normGameTitle(b);if(na===nb)score+=2;if(na.startsWith(nb)||nb.startsWith(na))score+=.5;
  return score;
}
function artworkTerms(rec){
  const terms=[];const add=v=>{v=String(v||'').trim();if(v&&!terms.some(x=>normGameTitle(x)===normGameTitle(v)))terms.push(v)};
  add(rec.title);add(cleanTitle(rec.fileName));add(rec.internalTitle);add(rec.catalogTitle);
  for(const base of [...terms]){
    add(base.replace(/\bIII\b/ig,'3').replace(/\bII\b/ig,'2').replace(/\bIV\b/ig,'4'));
    add(base.replace(/\b3\b/g,'III').replace(/\b2\b/g,'II').replace(/\b4\b/g,'IV'));
  }
  return terms.slice(0,10);
}
const fuzzyTreeCache=new Map();
async function githubFuzzyCover(rec){
  const sys=SYSTEMS[rec.platform];if(!sys?.repo)return null;
  try{
    let paths=fuzzyTreeCache.get(sys.repo);
    if(!paths){
      const url=`https://api.github.com/repos/libretro-thumbnails/${sys.repo}/git/trees/master?recursive=1`;
      const r=await fetchWithTimeout(url,{cache:'force-cache',headers:{Accept:'application/vnd.github+json'}},7000);if(!r.ok)return null;
      const data=await r.json();paths=(data.tree||[]).map(x=>x.path).filter(x=>x.startsWith('Named_Boxarts/')&&/\.png$/i.test(x));fuzzyTreeCache.set(sys.repo,paths);
    }
    let best=null,bestScore=0;
    for(const path of paths){
      const name=decodeURIComponent(path.split('/').pop().replace(/\.png$/i,''));
      for(const term of artworkTerms(rec)){
        const s=fuzzyScore(term,name);if(s>bestScore){bestScore=s;best=path}
      }
    }
    if(!best||bestScore<.54)return null;
    const url=`https://raw.githubusercontent.com/libretro-thumbnails/${sys.repo}/master/${best.split('/').map(encodeURIComponent).join('/')}`;
    const blob=await fetchImageBlob(url,4500);return blob?{blob,url}:null;
  }catch{return null}
}
async function findCover(rec){
  for(const term of artworkTerms(rec)){for(const url of coverCandidates({...rec,title:term})){const blob=await fetchImageBlob(url,2600);if(blob)return{blob,url}}}
  const fuzzy=await githubFuzzyCover(rec);if(fuzzy)return fuzzy;
  for(const term of artworkTerms(rec)){const wiki=await wikipediaCover({...rec,title:term});if(wiki)return wiki}
  return null;
}
async function refreshCoverFor(rec,quiet=false){
  if(!navigator.onLine){if(!quiet)notify('Connect to the internet to look up artwork');return rec}
  if(!quiet)notify('Searching for original cover artwork…',5000);
  const found=await findCover(rec);
  if(found){rec.coverBlob=found.blob;rec.coverSource=found.url;rec.coverCheckedAt=Date.now();revokeCoverUrl(rec.id);await putRecord(rec);if(!quiet)notify('Cover artwork saved');await reloadRecords();return rec}
  rec.coverCheckedAt=Date.now();await putRecord(rec);if(!quiet)notify('No reliable cover match found');await reloadRecords();return rec
}

async function ensurePersistentStorage(){
  try{if(navigator.storage?.persist){const already=await navigator.storage.persisted?.();if(!already)await navigator.storage.persist()}}catch{}
}
async function updateStorageStatus(){
  const el=$('#storageStatus');if(!el)return;
  try{const e=await navigator.storage?.estimate?.();const p=await navigator.storage?.persisted?.();if(e?.usage!=null&&e?.quota){const mb=n=>(n/1048576).toFixed(n>104857600?0:1);el.textContent=`${mb(e.usage)} MB used · ${mb(e.quota)} MB available${p?' · protected storage':''}`}else el.textContent='Stored locally on this device'}catch{el.textContent='Stored locally on this device'}
}

async function importBuffer(buf,fileName,overrides={}){
  if(!buf||!buf.byteLength)throw new Error('Empty ROM file');
  if(buf.byteLength>MAX_SINGLE_ROM)throw new Error('ROM is too large for this build');
  let platform=overrides.platform||detectPlatform(fileName,buf);
  const digest=await sha1(buf), crc=crc32(buf);
  const duplicate=records.find(r=>digest&&r.sha1===digest);
  if(duplicate){notify(`${duplicate.title} is already in your library`);return duplicate}
  const inside=internalTitle(platform,buf);let title=overrides.title||bestTitle(fileName,platform,buf);
  let bestClassic=null,bestClassicScore=0;for(const item of CLASSICS){let s=fuzzyScore(title,item.title);for(const a of item.aliases||[])s=Math.max(s,fuzzyScore(title,a));if(platform===item.platform)s+=.2;if(s>bestClassicScore){bestClassicScore=s;bestClassic=item}}
  if(bestClassic&&bestClassicScore>=1){title=bestClassic.title;if(!platform)platform=bestClassic.platform}
  const rec={kind:'library-rom',id:uuid(),fileName,title,platform,core:SYSTEMS[platform]?.core||'',bytes:buf,size:buf.byteLength,sha1:digest,crc32:crc,internalTitle:inside,importedAt:Date.now(),source:overrides.source||'local',sourcePageUrl:overrides.sourcePageUrl||'',catalogYear:overrides.year||bestClassic?.year||'',catalogPlatform:overrides.catalogPlatform||''};
  await putRecord(rec);await reloadRecords();
  notify(platform?`${rec.title} added to Retro Deck`:`${rec.title} added — choose its platform`);
  refreshCoverFor(rec,true).catch(()=>{});
  if(!platform)setTimeout(()=>openDetails(rec.id),300);
  return rec;
}
async function importFiles(files){
  if(importBusy)return;importBusy=true;await ensurePersistentStorage();
  try{
    for(const f of files){
      try{notify(`Importing ${f.name}…`,5000);const buf=await f.arrayBuffer();await importBuffer(buf,f.name)}
      catch(e){console.error(e);notify(`${f.name}: ${e.message||'import failed'}`,3200)}
    }
  }finally{importBusy=false;$('#romFileInput').value='';updateStorageStatus()}
}

function revokeCoverUrl(id){const u=coverUrlCache.get(id);if(u){try{URL.revokeObjectURL(u)}catch{}coverUrlCache.delete(id)}}
function clearCoverUrls(){for(const [id,u] of coverUrlCache){try{URL.revokeObjectURL(u)}catch{}}coverUrlCache.clear()}
function recordCoverUrl(rec){if(!rec?.coverBlob)return'';if(coverUrlCache.has(rec.id))return coverUrlCache.get(rec.id);const u=URL.createObjectURL(rec.coverBlob);coverUrlCache.set(rec.id,u);return u}
function installArtFallback(img,candidates=[]){if(!img||!candidates.length)return;let i=0;img.src=candidates[i];img.onerror=()=>{i++;if(i<candidates.length)img.src=candidates[i];else{img.onerror=null;img.classList.add('artFailed')}}}
function catalogMatchForRecord(rec){
  let best=null,bestScore=0;
  for(const item of CLASSICS){
    let s=fuzzyScore(rec.title,item.title);
    for(const a of item.aliases||[])s=Math.max(s,fuzzyScore(rec.title,a));
    if(rec.platform===item.platform)s+=.2;
    if(s>bestScore){bestScore=s;best=item}
  }
  return bestScore>=1.0?best:null;
}
function findRecordForClassic(item){
  let best=null,bestScore=0;
  for(const rec of records){
    let s=fuzzyScore(rec.title,item.title);
    for(const a of item.aliases||[])s=Math.max(s,fuzzyScore(rec.title,a));
    if(rec.platform===item.platform)s+=.25;
    if(s>bestScore){bestScore=s;best=rec}
  }
  return bestScore>=1.0?best:null;
}
function recommendationScores(){
  const platformWeight=new Map(),genreWeight=new Map(),tokens=new Map();
  for(const rec of records){
    const w=1+(Number(rec.playCount)||0)*1.4+(rec.favourite?5:0);
    platformWeight.set(rec.platform,(platformWeight.get(rec.platform)||0)+w);
    const cat=catalogMatchForRecord(rec);
    for(const g of cat?.genres||[])genreWeight.set(g,(genreWeight.get(g)||0)+w);
    for(const t of titleTokens(rec.title)){if(t.length>3)tokens.set(t,(tokens.get(t)||0)+w)}
  }
  return CLASSICS.filter(x=>x.rank<=50&&!findRecordForClassic(x)).map(item=>{
    let score=(51-item.rank)*.045+(platformWeight.get(item.platform)||0)*1.5;
    for(const g of item.genres||[])score+=(genreWeight.get(g)||0)*1.15;
    const candidateTokens=titleTokens(`${item.title} ${(item.aliases||[]).join(' ')}`);
    for(const t of candidateTokens)if(tokens.has(t))score+=tokens.get(t)*.65;
    return {item,score};
  }).sort((a,b)=>b.score-a.score||a.item.rank-b.item.rank);
}
const FEATURE_RAIL_SIZE=5;
// The Retro Deck 50 must always have a reliable, visible presence in this rail — reserve at
// least 3 of the 5 slots for Top-50 catalog picks, capping owned-content highlights (recent /
// favourite / most-played) at the remaining 2, regardless of how much the user owns or plays.
const FEATURE_MIN_CATALOG_SLOTS=3;
function featureItems(){
  const out=[];
  const recent=records.find(r=>r.saveState&&r.lastPlayedAt)||records.find(r=>r.lastPlayedAt);
  if(recent)out.push({kind:'record',rec:recent,kicker:recent.saveState?'JUMP BACK IN':'RECENTLY PLAYED',resume:!!recent.saveState});
  const fav=records.filter(r=>r.favourite&&r.id!==recent?.id).sort((a,b)=>(b.playCount||0)-(a.playCount||0)||(b.lastPlayedAt||0)-(a.lastPlayedAt||0))[0];
  if(fav)out.push({kind:'record',rec:fav,kicker:'YOUR FAVOURITE',resume:!!fav.saveState});
  else{
    const most=records.filter(r=>r.id!==recent?.id).sort((a,b)=>(b.playCount||0)-(a.playCount||0)||(b.lastPlayedAt||0)-(a.lastPlayedAt||0))[0];
    if(most&&(most.playCount||0)>1)out.push({kind:'record',rec:most,kicker:'MOST PLAYED',resume:!!most.saveState});
  }
  const ownedSlotCap=FEATURE_RAIL_SIZE-FEATURE_MIN_CATALOG_SLOTS;
  if(out.length>ownedSlotCap)out.length=ownedSlotCap;
  const catalogSlots=FEATURE_RAIL_SIZE-out.length;
  const picks=recommendationScores().slice(0,catalogSlots);
  if(picks.length<catalogSlots){
    // The unowned-recommendation pool ran dry (e.g. the user already owns almost every
    // Top-50 title) — backfill with any remaining ranked classics so the guaranteed
    // catalog slots stay filled wherever the ranked list can still supply one.
    const used=new Set(picks.map(p=>p.item.rank));
    for(const item of CLASSICS.filter(x=>x.rank<=50)){
      if(picks.length>=catalogSlots)break;
      if(used.has(item.rank))continue;
      picks.push({item});used.add(item.rank);
    }
  }
  for(const {item} of picks)out.push({kind:'catalog',item,kicker:records.length?'RECOMMENDED FOR YOU':`RETRO DECK #${item.rank}`});
  if(!out.length){for(const item of CLASSICS.filter(x=>x.rank<=50).slice(0,5))out.push({kind:'catalog',item,kicker:`RETRO DECK #${item.rank}`})}
  return out.slice(0,FEATURE_RAIL_SIZE);
}
function updateFeaturePosition(){
  const track=$('#featureTrack'),dots=$('#featureDots');if(!track)return;
  const count=track.children.length;if(!count)return;featureIndex=(featureIndex+count)%count;
  track.style.transform=`translate3d(${-featureIndex*100}%,0,0)`;
  dots?.querySelectorAll('button').forEach((d,i)=>d.classList.toggle('is-active',i===featureIndex));
}
function scheduleFeatureLoop(){clearInterval(featureTimer);const count=$('#featureTrack')?.children.length||0;if(count>1)featureTimer=setInterval(()=>{featureIndex++;updateFeaturePosition()},7200)}
function openClassic(item){
  switchLibrarySection('discover');
  const q=$('#sourceQuery');if(q)q.value=item.title;
  sourceSearch(item.title);
  setTimeout(()=>$('#sourceResults')?.scrollIntoView?.({behavior:'smooth',block:'start'}),120);
}
function importClassic(item){
  pendingSourceItem={title:item.title,platform:SYSTEMS[item.platform]?.label||item.platform,year:item.year,coverUrl:item.art?.[0]||'',pageUrl:'',catalogOnly:true};
  pendingSourceAdapter=window.RETRO_DECK_ROM_SOURCE;
  const input=$('#sourceRomFileInput');if(input){input.value='';input.click()}
}
function renderFeatureRail(){
  const rail=$('#featureRail'),track=$('#featureTrack'),dots=$('#featureDots');if(!rail||!track||!dots)return;
  const items=featureItems();rail.classList.toggle('hidden',!items.length);track.innerHTML='';dots.innerHTML='';featureIndex=Math.min(featureIndex,Math.max(0,items.length-1));
  items.forEach((f,i)=>{
    const slide=document.createElement('article');slide.className='featureSlide';
    if(f.kind==='record'){
      const rec=f.rec,sys=SYSTEMS[rec.platform],cover=recordCoverUrl(rec);
      slide.innerHTML=`<div class="featureBackdrop"></div><div class="featureCopy"><div class="featureKicker">${esc(f.kicker)}</div><h2>${esc(rec.title)}</h2><p>${esc(sys?.label||'Platform not set')}${rec.saveState?' · Saved '+new Date(rec.saveStateAt||rec.lastPlayedAt||Date.now()).toLocaleDateString():''}</p><div class="featureActions"><button type="button" class="featurePrimary">${f.resume?'▶ RESUME':'▶ PLAY'}</button><button type="button" class="featureSecondary">DETAILS</button></div></div><div class="featureCover">${cover?`<img src="${cover}" alt="${esc(rec.title)} cover">`:`<div class="featureArtFallback">${esc((sys?.label||'GAME').toUpperCase())}</div>`}</div>`;
      const back=slide.querySelector('.featureBackdrop');if(cover)back.style.backgroundImage=`linear-gradient(90deg,#05070af5 0%,#05070ad6 37%,#05070a52 70%,#05070a99 100%),url('${cover}')`;
      slide.querySelector('.featurePrimary').onclick=()=>playRom(rec,{resume:f.resume});
      slide.querySelector('.featureSecondary').onclick=()=>openDetails(rec.id);
    }else{
      const item=f.item,sys=SYSTEMS[item.platform];
      slide.innerHTML=`<div class="featureBackdrop"></div><div class="featureCopy"><div class="featureKicker">${esc(f.kicker)}</div><h2>${esc(item.title)}</h2><p>${esc(sys?.label||item.platform)} · ${esc(item.year||'Classic')} · ${(item.genres||[]).slice(0,2).map(esc).join(' / ')}</p><div class="featureActions"><button type="button" class="featurePrimary">FIND GAME</button><button type="button" class="featureSecondary">ADD OWN ROM</button></div></div><div class="featureCover"><img alt="${esc(item.title)} box art"></div>`;
      const img=slide.querySelector('.featureCover img'),back=slide.querySelector('.featureBackdrop');installArtFallback(img,item.art||[]);
      img.onload=()=>{if(img.src)back.style.backgroundImage=`linear-gradient(90deg,#05070af8 0%,#05070ae6 40%,#05070a62 72%,#05070aa0 100%),url('${img.src}')`};
      slide.querySelector('.featurePrimary').onclick=()=>openClassic(item);
      slide.querySelector('.featureSecondary').onclick=()=>importClassic(item);
    }
    track.appendChild(slide);const dot=document.createElement('button');dot.type='button';dot.setAttribute('aria-label',`Show featured item ${i+1}`);dot.onclick=()=>{featureIndex=i;updateFeaturePosition();scheduleFeatureLoop()};dots.appendChild(dot)
  });
  updateFeaturePosition();scheduleFeatureLoop();
}
function renderClassicCatalog(){
  const grid=$('#classicCatalogGrid'),more=$('#showMoreClassicsBtn');if(!grid)return;
  const items=CLASSICS.filter(x=>x.rank<=50).slice(0,classicVisibleLimit);grid.innerHTML='';
  for(const item of items){
    const installed=findRecordForClassic(item),card=document.createElement('article');card.className='classicCard';
    card.innerHTML=`<button type="button" class="classicArt caseArt" aria-label="Search ${esc(item.title)}"><img alt="${esc(item.title)} box art"><span class="classicRank">#${item.rank}</span>${installed?'<span class="installedBadge">INSTALLED</span>':''}</button><div class="classicMeta"><strong>${esc(item.title)}</strong><small>${esc(SYSTEMS[item.platform]?.label||item.platform)} · ${esc(item.year)}</small><button type="button" class="classicAction">${installed?'PLAY':'ADD OWN ROM'}</button></div>`;
    const classicImg=card.querySelector('img'),classicArtEl=card.querySelector('.classicArt');
    installArtFallback(classicImg,item.art||[]);
    classicImg.onload=()=>{if(classicImg.src)classicArtEl.style.setProperty('--cover',`url('${classicImg.src}')`)};
    card.querySelector('.classicArt').onclick=()=>installed?openDetails(installed.id):openClassic(item);
    card.querySelector('.classicAction').onclick=()=>installed?playRom(installed,{resume:!!installed.saveState}):importClassic(item);
    grid.appendChild(card)
  }
  if(more){more.classList.toggle('hidden',classicVisibleLimit>=50);more.textContent=`Show more classics (${Math.min(50,classicVisibleLimit)}/50)`}
}
function renderRecords(){
  const grid=$('#romGrid'),empty=$('#romEmpty');if(!grid)return;
  renderFeatureRail();renderClassicCatalog();
  const q=($('#librarySearch')?.value||'').trim().toLowerCase();
  const shown=records.filter(r=>!q||`${r.title} ${SYSTEMS[r.platform]?.label||''} ${r.fileName}`.toLowerCase().includes(q));
  const visible=q?shown:shown.slice(0,visibleLimit);grid.innerHTML='';
  visible.forEach(rec=>{
    const b=document.createElement('button');b.type='button';b.className='gameCard romCard';
    const cover=recordCoverUrl(rec),sys=SYSTEMS[rec.platform];
    const art=cover?`<div class="gameVisual romVisual caseArt" style="--cover:url('${cover}')"><img src="${cover}" alt="${esc(rec.title)} cover"><div class="romPlayBadge">▶</div>${rec.favourite?'<span class="favouriteBadge">★</span>':''}</div>`:`<div class="gameVisual romVisual"><div class="coverFallback"><span>${esc((sys?.label||'GAME').toUpperCase())}</span><strong>${esc(rec.title)}</strong></div><div class="romPlayBadge">▶</div>${rec.favourite?'<span class="favouriteBadge">★</span>':''}</div>`;
    b.innerHTML=`${art}<div class="gameBody"><h3>${esc(rec.title)}</h3><p>${esc(sys?.label||'Platform not set')}${rec.saveState?' · SAVED':''}</p></div>`;
    // Tapping a game always opens the details dialog first, same as before - this is the
    // path that already validates platform/core before ever calling playRom(), and bypassing
    // it caused games to fail to launch for anything not sourced as 'local'. Renaming is
    // still source-gated, but at the field level inside openDetails() (see there), not by
    // skipping this proven open-details-then-play flow.
    b.onclick=()=>openDetails(rec.id);
    grid.appendChild(b)
  });
  empty.classList.toggle('hidden',records.length>0);
  const more=$('#showMoreGamesBtn');if(more)more.classList.toggle('hidden',!!q||shown.length<=visibleLimit);
  const status=$('#collectionMatchStatus');if(status)status.textContent=q?`${shown.length} match${shown.length===1?'':'es'}`:(shown.length>visible.length?`${visible.length} of ${shown.length}`:'');
  $('#romCount').textContent=`${records.length} game${records.length===1?'':'s'}`;if($('#romCountNav'))$('#romCountNav').textContent=records.length;
}

// ---------------------------------------------------------------------------
// Collection management: grid / list / horizontal-strip views, drag-to-reorder
// (persisted per record as rec.sortOrder), and the source-gated rename/edit flow
// for app/catalogue-sourced games (manually-added games still edit directly from
// the normal collection grid; see renderRecords()).
// ---------------------------------------------------------------------------
const MANAGE_VIEW_KEY='rd-collection-view';
function getManageView(){try{return localStorage.getItem(MANAGE_VIEW_KEY)||'grid'}catch{return'grid'}}
function setManageView(v){try{localStorage.setItem(MANAGE_VIEW_KEY,v)}catch{}}
let manageStripIndex=0;
let manageEditId=null;

async function persistManageOrder(ids){
  for(let i=0;i<ids.length;i++){
    const rec=records.find(r=>r.id===ids[i]);
    if(rec && rec.sortOrder!==i){rec.sortOrder=i;await putRecord(rec)}
  }
  await reloadRecords();
  renderManageView();
}

// Pointer-based drag-to-reorder shared by the grid, list and strip management views, so
// reordering works the same way with touch or a mouse. A tap (no meaningful pointer
// movement) is reported as a 'manage-tap' event on the moved tile instead of a native
// click, so callers can tell a rename/select tap apart from a drag.
function manageDragHandlers(el,onReorder){
  let dragging=null,moved=false,startX=0,startY=0;
  el.addEventListener('pointerdown',e=>{
    const tile=e.target.closest('[data-manage-id]');
    if(!tile)return;
    dragging=tile;moved=false;startX=e.clientX;startY=e.clientY;
    try{tile.setPointerCapture?.(e.pointerId)}catch{}
  });
  el.addEventListener('pointermove',e=>{
    if(!dragging)return;
    if(!moved&&(Math.abs(e.clientX-startX)>6||Math.abs(e.clientY-startY)>6)){moved=true;dragging.classList.add('dragging')}
    if(!moved)return;
    e.preventDefault();
    const horizontal=el.classList.contains('manageStripTrack');
    const siblings=[...el.children].filter(c=>c!==dragging);
    const after=siblings.find(c=>{
      const r=c.getBoundingClientRect();
      return horizontal?e.clientX<r.left+r.width/2:e.clientY<r.top+r.height/2;
    });
    if(after)el.insertBefore(dragging,after);else el.appendChild(dragging);
  },{passive:false});
  const finish=async()=>{
    if(!dragging)return;
    const tile=dragging,wasMoved=moved;dragging=null;moved=false;
    tile.classList.remove('dragging');
    if(wasMoved){const ids=[...el.children].map(c=>c.dataset.manageId);await onReorder(ids)}
    else tile.dispatchEvent(new CustomEvent('manage-tap',{bubbles:true}));
  };
  el.addEventListener('pointerup',finish);
  el.addEventListener('pointercancel',()=>{if(dragging){dragging.classList.remove('dragging');dragging=null;moved=false}});
}

function manageThumbHtml(rec){
  const cover=recordCoverUrl(rec),sys=SYSTEMS[rec.platform];
  return cover?`<img src="${cover}" alt="${esc(rec.title)} cover">`:`<div class="coverFallback"><span>${esc((sys?.label||'GAME').toUpperCase())}</span><strong>${esc(rec.title)}</strong></div>`;
}

function renderManageGrid(content){
  const wrap=document.createElement('div');wrap.className='manageGrid manageDragZone';
  records.forEach(rec=>{
    const cover=recordCoverUrl(rec);
    const tile=document.createElement('button');tile.type='button';tile.className='manageTile';tile.dataset.manageId=rec.id;
    tile.innerHTML=`<div class="manageTileArt caseArt" style="${cover?`--cover:url('${cover}')`:''}">${manageThumbHtml(rec)}</div><div class="manageTileBody"><strong>${esc(rec.title)}</strong><small>${esc(SYSTEMS[rec.platform]?.label||'Platform not set')}</small></div>`;
    wrap.appendChild(tile);
  });
  content.appendChild(wrap);
  wrap.addEventListener('manage-tap',e=>{const id=e.target.dataset.manageId;if(id)openManageEdit(id)});
  manageDragHandlers(wrap,persistManageOrder);
}

function renderManageList(content){
  const wrap=document.createElement('div');wrap.className='manageList manageDragZone';
  records.forEach(rec=>{
    const cover=recordCoverUrl(rec),sys=SYSTEMS[rec.platform];
    const row=document.createElement('div');row.className='manageRow';row.dataset.manageId=rec.id;row.tabIndex=0;
    row.innerHTML=`<span class="manageDragHandle" aria-hidden="true">⠿</span><div class="manageRowArt">${cover?`<img src="${cover}" alt="${esc(rec.title)} cover">`:'<div class="manageRowArtFallback"></div>'}</div><div class="manageRowBody"><strong>${esc(rec.title)}</strong><small>${esc(sys?.label||'Platform not set')}</small></div>`;
    wrap.appendChild(row);
  });
  content.appendChild(wrap);
  wrap.addEventListener('manage-tap',e=>{const id=e.target.dataset.manageId;if(id)openManageEdit(id)});
  manageDragHandlers(wrap,persistManageOrder);
}

function updateManageStripPreview(){
  const rec=records[manageStripIndex];
  const preview=$('#manageStripPreview'),img=$('#manageStripPreviewImg'),fallback=$('#manageStripPreviewFallback'),title=$('#manageStripPreviewTitle'),sub=$('#manageStripPreviewSub');
  if(!rec){preview.classList.add('hidden');return}
  preview.classList.remove('hidden');
  const cover=recordCoverUrl(rec),sys=SYSTEMS[rec.platform];
  if(cover){img.src=cover;img.classList.remove('hidden');fallback.classList.add('hidden')}
  else{img.removeAttribute('src');img.classList.add('hidden');fallback.classList.remove('hidden');fallback.textContent=sys?.label||'NO COVER'}
  title.textContent=rec.title;sub.textContent=sys?.label||'Platform not set';
}

function renderManageStrip(content){
  const wrap=document.createElement('div');wrap.className='manageStripTrack manageDragZone';
  manageStripIndex=Math.min(Math.max(0,manageStripIndex),records.length-1);
  records.forEach((rec,i)=>{
    const cover=recordCoverUrl(rec);
    const thumb=document.createElement('button');thumb.type='button';thumb.className='manageStripThumb'+(i===manageStripIndex?' is-selected':'');thumb.dataset.manageId=rec.id;
    thumb.innerHTML=cover?`<img src="${cover}" alt="${esc(rec.title)} cover">`:`<div class="manageStripThumbFallback">${esc(rec.title.slice(0,2).toUpperCase())}</div>`;
    wrap.appendChild(thumb);
  });
  content.appendChild(wrap);
  wrap.addEventListener('manage-tap',e=>{
    const id=e.target.dataset.manageId;if(!id)return;
    manageStripIndex=records.findIndex(r=>r.id===id);
    wrap.querySelectorAll('.manageStripThumb').forEach(t=>t.classList.toggle('is-selected',t.dataset.manageId===id));
    updateManageStripPreview();
  });
  manageDragHandlers(wrap,async ids=>{
    const selectedId=records[manageStripIndex]?.id;
    await persistManageOrder(ids);
    if(selectedId)manageStripIndex=records.findIndex(r=>r.id===selectedId);
  });
  updateManageStripPreview();
}

function renderManageView(){
  const mode=getManageView();
  document.querySelectorAll('.manageViewTab').forEach(t=>t.classList.toggle('is-active',t.dataset.view===mode));
  const content=$('#manageContent');if(!content)return;
  content.innerHTML='';
  $('#manageStripPreview')?.classList.toggle('hidden',mode!=='strip');
  if(!records.length){content.innerHTML='<div class="sourceEmpty">Your collection is empty. Import or add a game first.</div>';return}
  if(mode==='list')renderManageList(content);
  else if(mode==='strip')renderManageStrip(content);
  else renderManageGrid(content);
}
function openManageDialog(){renderManageView();$('#collectionManageDialog').showModal()}
function fillManagePlatforms(selected=''){
  const el=$('#manageEditPlatform');if(!el)return;
  el.innerHTML='<option value="">Choose platform…</option>'+Object.entries(SYSTEMS).map(([id,s])=>`<option value="${id}" ${id===selected?'selected':''}>${esc(s.label)}</option>`).join('')
}
async function openManageEdit(id){
  const rec=records.find(r=>r.id===id)||await getRecord(id);if(!rec)return;
  manageEditId=id;
  $('#manageEditHeading').textContent=rec.title;
  $('#manageEditTitle').value=rec.title;
  fillManagePlatforms(rec.platform);
  $('#manageEditDialog').showModal();
}
async function saveManageEdit(){
  if(!manageEditId)return;
  const rec=await getRecord(manageEditId);if(!rec)return;
  rec.title=$('#manageEditTitle').value.trim()||rec.title;
  rec.platform=$('#manageEditPlatform').value;rec.core=SYSTEMS[rec.platform]?.core||'';
  await putRecord(rec);await reloadRecords();
  $('#manageEditDialog').close();
  renderManageView();
  notify('Game details saved',1600);
}
async function deleteManageEdit(){
  if(!manageEditId)return;
  const rec=await getRecord(manageEditId);if(!rec)return;
  if(!confirm(`Remove ${rec.title} from Retro Deck?`))return;
  revokeCoverUrl(manageEditId);await deleteRecord(manageEditId);
  manageEditId=null;
  $('#manageEditDialog').close();
  await reloadRecords();
  renderManageView();
  updateStorageStatus();
  notify('Game removed');
}

function formatBytes(n=0){if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(0)} KB`;return`${(n/1048576).toFixed(n>104857600?0:1)} MB`}
async function reloadRecords(){
  const all=await allRecords();
  const hasCustomOrder=all.some(r=>typeof r.sortOrder==='number');
  records=hasCustomOrder
    ? all.sort((a,b)=>{
        const ao=typeof a.sortOrder==='number'?a.sortOrder:Infinity;
        const bo=typeof b.sortOrder==='number'?b.sortOrder:Infinity;
        return ao!==bo?ao-bo:(b.lastPlayedAt||b.importedAt||0)-(a.lastPlayedAt||a.importedAt||0);
      })
    : all.sort((a,b)=>(b.lastPlayedAt||b.importedAt||0)-(a.lastPlayedAt||a.importedAt||0));
  renderRecords();
}

function fillPlatforms(selected=''){
  const el=$('#romPlatformInput');el.innerHTML='<option value="">Choose platform…</option>'+Object.entries(SYSTEMS).map(([id,s])=>`<option value="${id}" ${id===selected?'selected':''}>${esc(s.label)}</option>`).join('')
}
function showDetailsCover(rec){
  const img=$('#romDetailsCover'),fallback=$('#romCoverFallback');
  if(showDetailsCover._u){URL.revokeObjectURL(showDetailsCover._u);showDetailsCover._u=null}
  if(rec.coverBlob){showDetailsCover._u=URL.createObjectURL(rec.coverBlob);img.src=showDetailsCover._u;img.classList.remove('hidden');fallback.classList.add('hidden')}
  else{img.removeAttribute('src');img.classList.add('hidden');fallback.classList.remove('hidden');fallback.textContent=SYSTEMS[rec.platform]?.label||'NO COVER'}
}
async function openDetails(id){
  const rec=records.find(r=>r.id===id)||await getRecord(id);if(!rec)return;selectedId=id;
  $('#romDetailsHeading').textContent=rec.title;$('#romTitleInput').value=rec.title;fillPlatforms(rec.platform);showDetailsCover(rec);
  $('#romHashLine').innerHTML=`<span>${esc(rec.fileName)}</span><span>CRC32 ${esc((rec.crc32||'').toUpperCase())}</span><span>SHA-1 ${esc((rec.sha1||'').slice(0,12).toUpperCase())}${rec.sha1?'…':''}</span>`;
  const fav=$('#favouriteRomBtn');if(fav)fav.textContent=rec.favourite?'★ Favourite':'☆ Add to favourites';
  const play=$('#playRomBtn');if(play)play.textContent=rec.saveState?'Resume saved game':'Play';
  // App/catalogue-sourced games can still be viewed and played from here like any other
  // game - only the title/platform fields and the Save button are locked, so renaming stays
  // reachable exclusively through the dedicated Manage collection edit flow. Manually-added
  // games are fully editable here as before. Reset every time: this dialog/its fields are reused.
  const editable=rec.source==='local';
  $('#romTitleInput').disabled=!editable;$('#romPlatformInput').disabled=!editable;
  $('#saveRomMetaBtn')?.classList.toggle('hidden',!editable);
  $('#appSourcedNote')?.classList.toggle('hidden',editable);
  $('#romDetailsDialog').showModal()
}
async function saveDetails({close=true}={}){
  if(!selectedId)return null;const rec=await getRecord(selectedId);if(!rec)return null;
  rec.title=$('#romTitleInput').value.trim()||rec.title;rec.platform=$('#romPlatformInput').value;rec.core=SYSTEMS[rec.platform]?.core||'';await putRecord(rec);await reloadRecords();if(close)$('#romDetailsDialog').close();return rec
}

function jsonSafe(v){return JSON.stringify(v).replace(/</g,'\\u003c')}
function buildPlayerDocument(rec,blobUrl,stateUrl=''){
  const controls={0:{
    0:{value:'z',value2:'BUTTON_1'},1:{value:'s',value2:'BUTTON_4'},2:{value:'v',value2:'SELECT'},3:{value:'enter',value2:'START'},
    4:{value:'up arrow',value2:'DPAD_UP'},5:{value:'down arrow',value2:'DPAD_DOWN'},6:{value:'left arrow',value2:'DPAD_LEFT'},7:{value:'right arrow',value2:'DPAD_RIGHT'},
    8:{value:'x',value2:'BUTTON_2'},9:{value:'a',value2:'BUTTON_3'},10:{value:'q',value2:'LEFT_TOP_SHOULDER'},11:{value:'e',value2:'RIGHT_TOP_SHOULDER'},
    12:{value:'1',value2:'LEFT_BOTTOM_SHOULDER'},13:{value:'3',value2:'RIGHT_BOTTOM_SHOULDER'}
  },1:{},2:{},3:{}};
  const inputIndex={up:4,down:5,left:6,right:7,a:8,b:0,x:9,y:1,start:3,select:2,l1:10,r1:11,l2:12,r2:13};
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#000}body{touch-action:none}#game{position:absolute;inset:0}canvas{outline:none!important}</style></head><body tabindex="-1"><div id="game"></div><script>
  try{Object.defineProperty(navigator,'getGamepads',{configurable:true,value:function(){return []}})}catch(e){}
  window.EJS_player='#game';
  window.EJS_core=${jsonSafe(rec.core)};
  window.EJS_gameUrl=${jsonSafe(blobUrl)};
  window.EJS_gameName=${jsonSafe(rec.title)};
  window.EJS_gameID=${jsonSafe(Number.parseInt((rec.sha1||rec.crc32||'1').slice(0,7),16)||1)};
  window.EJS_pathtodata=${jsonSafe(EJS_DATA)};
  window.EJS_loadStateURL=${jsonSafe(stateUrl)};
  window.EJS_startOnLoaded=true;
  window.EJS_backgroundColor='#000000';
  window.EJS_color='#e8b64c';
  window.EJS_browserMode='desktop';
  window.EJS_controlScheme=${jsonSafe(rec.core)};
  window.EJS_defaultControls=${jsonSafe(controls)};
  window.EJS_askBeforeExit=false;
  window.__RETRO_INPUT_INDEX=${jsonSafe(inputIndex)};
  function retroFocus(){try{window.focus();document.body.focus();var c=document.querySelector('canvas');if(c){c.tabIndex=0;c.focus({preventScroll:true})}}catch(e){}}
  function keyboardFallback(d){
    var type=d.down?'keydown':'keyup';
    var init={key:d.key,code:d.code||'',bubbles:true,cancelable:true,repeat:false};
    var evt=new KeyboardEvent(type,init);
    try{Object.defineProperty(evt,'keyCode',{get:function(){return d.keyCode||0}});Object.defineProperty(evt,'which',{get:function(){return d.keyCode||0}})}catch(e){}
    window.dispatchEvent(evt);document.dispatchEvent(evt);document.activeElement&&document.activeElement.dispatchEvent&&document.activeElement.dispatchEvent(new KeyboardEvent(type,init));
  }
  function routeRetroInput(d){
    retroFocus();
    var index=(typeof d.index==='number')?d.index:window.__RETRO_INPUT_INDEX[d.control];
    var gm=window.EJS_emulator&&window.EJS_emulator.gameManager;
    var simulated=false;
    if(gm&&typeof gm.simulateInput==='function'&&typeof index==='number'){
      try{gm.simulateInput(0,index,d.down?1:0);simulated=true}catch(e){}
    }
    // Keyboard path remains as a compatibility fallback across cores and Safari.
    keyboardFallback(d);
    parent.postMessage({type:'retrodeck-input-ack',control:d.control,down:d.down,simulated:simulated},'*');
  }
  window.addEventListener('message',function(ev){var d=ev.data;if(!d||d.type!=='retrodeck-key')return;routeRetroInput(d)});
  window.EJS_onGameStart=function(){retroFocus();parent.postMessage({type:'retrodeck-emulator-started'},'*')};
  <\/script><script src="${EJS_DATA}loader.js"><\/script></body></html>`;
}
const KEYMAP={
  up:{key:'ArrowUp',code:'ArrowUp',keyCode:38,index:4},down:{key:'ArrowDown',code:'ArrowDown',keyCode:40,index:5},left:{key:'ArrowLeft',code:'ArrowLeft',keyCode:37,index:6},right:{key:'ArrowRight',code:'ArrowRight',keyCode:39,index:7},
  a:{key:'x',code:'KeyX',keyCode:88,index:8},b:{key:'z',code:'KeyZ',keyCode:90,index:0},x:{key:'a',code:'KeyA',keyCode:65,index:9},y:{key:'s',code:'KeyS',keyCode:83,index:1},start:{key:'Enter',code:'Enter',keyCode:13,index:3},select:{key:'v',code:'KeyV',keyCode:86,index:2},
  l1:{key:'q',code:'KeyQ',keyCode:81,index:10},r1:{key:'e',code:'KeyE',keyCode:69,index:11},l2:{key:'1',code:'Digit1',keyCode:49,index:12},r2:{key:'3',code:'Digit3',keyCode:51,index:13}
};
function sendKey(k,down){
  if(!active||!playerFrame?.contentWindow)return false;
  const m=KEYMAP[k];if(!m)return false;
  // First try the exposed EmulatorJS input API directly. The iframe is srcdoc/same-origin.
  try{
    const w=playerFrame.contentWindow,gm=w.EJS_emulator?.gameManager;
    w.focus?.();w.document?.querySelector?.('canvas')?.focus?.({preventScroll:true});
    if(gm&&typeof gm.simulateInput==='function')gm.simulateInput(0,m.index,down?1:0);
  }catch{}
  // Also send through the frame bridge. This makes Start/Select reliable on iOS and across cores.
  playerFrame.contentWindow.postMessage({type:'retrodeck-key',control:k,down,...m},'*');
  return true;
}
function pulseKey(k,ms=140){sendKey(k,true);clearTimeout(pulseKey._t?.[k]);pulseKey._t=pulseKey._t||{};pulseKey._t[k]=setTimeout(()=>sendKey(k,false),ms)}
function setSystemLabel(btn,label){if(!btn)return;btn.innerHTML=`<span class="systemDot"></span><strong>${esc(label)}</strong>`}
async function captureActiveState({quiet=true}={}){
  if(!active||!activeId||!playerFrame?.contentWindow)return false;
  try{
    const gm=playerFrame.contentWindow.EJS_emulator?.gameManager;if(!gm||typeof gm.getState!=='function')return false;
    const state=gm.getState();if(!state)return false;
    const src=state instanceof Uint8Array?state:new Uint8Array(state);
    const copy=new Uint8Array(src.length);copy.set(src);
    const rec=await getRecord(activeId);if(!rec)return false;
    rec.saveState=copy.buffer;rec.saveStateAt=Date.now();await putRecord(rec);
    const mem=records.find(r=>r.id===rec.id);if(mem){mem.saveState=rec.saveState;mem.saveStateAt=rec.saveStateAt}
    if(!quiet)notify('Progress saved on this device',1600);return true
  }catch(e){console.warn('Retro Deck save-state capture failed',e);if(!quiet)notify('This game could not be saved at this moment',2000);return false}
}
function startAutoSave(){clearInterval(autoSaveTimer);autoSaveTimer=setInterval(()=>captureActiveState({quiet:true}),60000)}
async function playRom(rec,{resume=false}={}){
  if(!rec.platform||!rec.core){notify('Select the original platform before playing',2600);await openDetails(rec.id);$('#platformRequiredHint')?.classList.remove('hidden');$('#romPlatformInput')?.classList.add('needsPlatform');$('#romPlatformInput')?.focus?.({preventScroll:true});return}
  const bytes=rec.bytes;if(!bytes){notify('ROM data is missing');return}
  if(active)await exitRom();
  active=true;activeId=rec.id;activeBlobUrl=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  if(activeStateBlobUrl){URL.revokeObjectURL(activeStateBlobUrl);activeStateBlobUrl=null}
  if(resume&&rec.saveState)activeStateBlobUrl=URL.createObjectURL(new Blob([rec.saveState],{type:'application/octet-stream'}));
  $('#libraryView').classList.remove('active');$('#consoleView').classList.add('active');$('#app').classList.add('game-active');document.body.classList.add('game-active');$('#gameCanvas').classList.add('hidden');$('#javatari-screen').classList.add('hidden');
  window.RetroDeckApp?.setGameAspect?.(SYSTEMS[rec.platform]?.aspect||4/3);
  const host=$('#romEmulatorHost');host.classList.remove('hidden');host.innerHTML='';
  playerFrame=document.createElement('iframe');playerFrame.className='romPlayerFrame';playerFrame.allow='autoplay; fullscreen; gamepad';playerFrame.setAttribute('allowfullscreen','');playerFrame.srcdoc=buildPlayerDocument(rec,activeBlobUrl,activeStateBlobUrl||'');host.appendChild(playerFrame);
  $('#gameTitle').textContent=rec.title.toUpperCase();$('#hudText').textContent=(SYSTEMS[rec.platform]?.label||'ROM').toUpperCase();$('#romExitBtn').classList.remove('hidden');
  $('#mirrorPad').classList.add('hidden');$('#actionPad').classList.remove('hidden');
  setSystemLabel($('#menuBtn'),'START');setSystemLabel($('#pauseBtn'),'SELECT');
  rec.lastPlayedAt=Date.now();rec.playCount=(Number(rec.playCount)||0)+1;await putRecord(rec);await reloadRecords();window.RetroDeckApp?.syncControllerDisplay?.();startAutoSave();notify(resume&&activeStateBlobUrl?'Restoring your saved session…':'Loading emulator…',3500)
}
async function exitRom(){
  if(!active||exiting)return;exiting=true;clearInterval(autoSaveTimer);autoSaveTimer=0;
  await captureActiveState({quiet:true});
  active=false;activeId=null;
  if(playerFrame){playerFrame.remove();playerFrame=null}$('#romEmulatorHost').innerHTML='';$('#romEmulatorHost').classList.add('hidden');
  if(activeBlobUrl){URL.revokeObjectURL(activeBlobUrl);activeBlobUrl=null}if(activeStateBlobUrl){URL.revokeObjectURL(activeStateBlobUrl);activeStateBlobUrl=null}
  $('#romExitBtn').classList.add('hidden');setSystemLabel($('#menuBtn'),'MENU');setSystemLabel($('#pauseBtn'),'PAUSE');
  window.RetroDeckApp?.setControllerDisplay?.(false,{quiet:true});
  $('#consoleView').classList.remove('active');$('#libraryView').classList.add('active');$('#app').classList.remove('game-active');document.body.classList.remove('game-active');$('#gameCanvas').classList.remove('hidden');
  await reloadRecords();exiting=false
}

async function sourceSearch(q){
  const seq=++sourceSearchSeq;
  const adapter=window.RETRO_DECK_ROM_SOURCE,results=$('#sourceResults');results.innerHTML='<div class="sourceEmpty">Searching catalogue…</div>';
  $('#sourceStatus').textContent='Searching My Abandonware…';
  try{
    let items=[];
    if(window.RetroDeckCloud?.configured?.()){
      items=await window.RetroDeckCloud.search(q);
      $('#sourceStatus').textContent=`Cloud catalogue · ${items.length} result${items.length===1?'':'s'}`;
    }else{
      if(!adapter?.search)throw new Error('No game catalogue is connected.');
      items=await adapter.search(q);
      const mode=adapter.lastMode==='offline-seed'?' · cached match':adapter.lastMode==='live'?' · live':' ';
      $('#sourceStatus').textContent=`My Abandonware · ${items.length} result${items.length===1?'':'s'}${mode}`;
    }
    if(seq!==sourceSearchSeq)return;
    const local=CLASSICS.filter(x=>Math.max(fuzzyScore(q,x.title),...(x.aliases||[]).map(a=>fuzzyScore(q,a)))>=.42).slice(0,12).map(x=>({title:x.title,platform:SYSTEMS[x.platform]?.label||x.platform,year:x.year,coverUrl:x.art?.[0]||'',art:x.art||[],catalogOnly:true,classicItem:x}));
    const seen=new Set(items.map(x=>normGameTitle(x.title)));for(const x of local)if(!seen.has(normGameTitle(x.title)))items.push(x);
    latestSourceResults=items;results.innerHTML='';
    if(!items.length){results.innerHTML='<div class="sourceEmpty">No catalogue match found. You can still use Import to add a ROM copy you own.</div>';return}
    items.slice(0,24).forEach((item,i)=>{
      const detail=[item.platform||'Platform not specified',item.year||''].filter(Boolean).join(' · ');
      const card=document.createElement('article');card.className='discoveryCard';
      const candidates=item.art?.length?item.art:(item.coverUrl?[item.coverUrl]:[]);
      card.innerHTML=`<div class="discoverArt">${candidates.length?`<img alt="${esc(item.title||'')} cover" loading="lazy">`:'<div class="sourceMiniCover">NO ART</div>'}</div><div class="discoverMeta"><strong>${esc(item.title||'Untitled')}</strong><small>${esc(detail)}</small><button type="button" data-i="${i}">${item?.redistributable===true?'ADD TO DECK':'IMPORT OWN ROM'}</button></div>`;
      if(candidates.length)installArtFallback(card.querySelector('img'),candidates);
      card.querySelector('button').onclick=()=>chooseSourceRom(item,adapter);results.appendChild(card)
    })
  }catch(e){if(seq!==sourceSearchSeq)return;console.error(e);$('#sourceStatus').textContent=e.message||'Catalogue search failed.';results.innerHTML='<div class="sourceEmpty">Catalogue search is temporarily unavailable. Local import still works.</div>'}
}
function switchLibrarySection(which){
  const discover=which==='discover';
  $('#discoverSection')?.classList.toggle('hidden',!discover);
  $('#collectionSection')?.classList.toggle('hidden',discover);
  $('#builtInSection')?.classList.toggle('hidden',discover);
  $('#collectionNavBtn')?.classList.toggle('is-active',!discover);
  $('#discoverNavBtn')?.classList.toggle('is-active',discover);
  if(discover)setTimeout(()=>$('#sourceQuery')?.focus({preventScroll:true}),80);
}
async function chooseSourceRom(item,adapter){
  pendingSourceItem=item;pendingSourceAdapter=adapter;
  // Retro Deck does not auto-download commercial ROMs from catalogue pages.
  // Automatic import is reserved for sources explicitly marked redistributable.
  if(item?.redistributable===true&&item?.downloadUrl){
    try{
      notify(`Adding ${item.title||'game'}…`,8000);const r=await fetchWithTimeout(item.downloadUrl,{cache:'no-store'},12000);if(!r.ok)throw new Error('Download failed');
      const blob=await r.blob(),buf=await blob.arrayBuffer();const fileName=item.fileName||`${item.title||'game'}.rom`;
      const platform=platformFromLabel(item.platform||'')||detectPlatform(fileName,buf);
      const rec=await importBuffer(buf,fileName,{title:item.title||'',platform,source:item.source||'redistributable source',sourcePageUrl:item.pageUrl||'',year:item.year||'',catalogPlatform:item.platform||''});
      if(item.coverUrl&&!rec.coverBlob){const cover=await fetchImageBlob(item.coverUrl,4000);if(cover){rec.coverBlob=cover;rec.coverSource=item.coverUrl;await putRecord(rec);await reloadRecords()}}
      pendingSourceItem=null;pendingSourceAdapter=null;switchLibrarySection('collection');return;
    }catch(e){console.error(e);notify('Automatic import failed — choose your local copy instead',3500)}
  }
  const input=$('#sourceRomFileInput');if(!input)return;input.value='';input.click();
}
async function importChosenSourceRom(file){
  if(!file||!pendingSourceItem)return;
  const item=pendingSourceItem,adapter=pendingSourceAdapter||window.RETRO_DECK_ROM_SOURCE;pendingSourceItem=null;pendingSourceAdapter=null;
  try{
    notify(`Adding ${item.title||file.name}…`,6000);await ensurePersistentStorage();
    const buf=await file.arrayBuffer();const detected=detectPlatform(file.name,buf),catalogPlatform=platformFromLabel(item.platform||'');const platform=detected||catalogPlatform;
    const rec=await importBuffer(buf,file.name,{title:item.title||'',platform,source:adapter?.name||'catalogue',sourcePageUrl:item.pageUrl||'',year:item.year||'',catalogPlatform:item.platform||''});
    if(item.coverUrl&&!rec.coverBlob){const blob=await fetchImageBlob(item.coverUrl,4000);if(blob){rec.coverBlob=blob;rec.coverSource=item.coverUrl;await putRecord(rec);await reloadRecords()}}
    if(!rec.coverBlob)refreshCoverFor(rec,true).catch(()=>{});switchLibrarySection('collection');notify(`${rec.title} added to your collection`);updateStorageStatus();
  }catch(e){console.error(e);notify(e.message||'Could not add game',3500)}
}
function refreshSourceStatus(){
  $('#sourceStatus').textContent='Game catalogue ready';
  const note=$('#cloudSourceNote');if(note)note.textContent='Search finds game metadata and cover art. Choose the ROM from a copy you own; Retro Deck stores it locally on this device.';
}

// Public bridge used by the main controller code.
window.RetroDeckROM={
  get active(){return active},
  routeControl(k,v){return sendKey(k,v)},
  exit:exitRom,
  registerSource(adapter){window.registerRetroDeckRomSource?.(adapter)},
  reload:reloadRecords
};

// Existing main-app buttons are preserved for built-ins and repurposed only while a ROM is active.
const home=$('#homeBtn'),menu=$('#menuBtn'),pause=$('#pauseBtn');
const oldHome=home?.onclick,oldMenu=menu?.onclick,oldPause=pause?.onclick;
if(home)home.onclick=e=>{if(active){e.preventDefault();exitRom();return}return oldHome?.call(home,e)};
function bindSystemButton(btn,key,fallback){
  if(!btn)return;
  let held=false;
  btn.onclick=e=>{if(active){e.preventDefault();e.stopPropagation();return}return fallback?.call(btn,e)};
  btn.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();e.stopPropagation();held=true;btn.setPointerCapture?.(e.pointerId);btn.classList.add('is-down');sendKey(key,true)},{passive:false});
  const release=e=>{if(!active||!held)return;e.preventDefault();e.stopPropagation();held=false;btn.classList.remove('is-down');sendKey(key,false)};
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>btn.addEventListener(type,release,{passive:false}));
  // Keyboard accessibility and a fallback for browsers that synthesize click without pointer events.
  btn.addEventListener('keydown',e=>{if(active&&(e.key==='Enter'||e.key===' ')){e.preventDefault();pulseKey(key)}});
}
bindSystemButton(menu,'start',oldMenu);
bindSystemButton(pause,'select',oldPause);

$('#romExitBtn').onclick=exitRom;
$('#importRomBtn').onclick=()=>$('#romFileInput').click();
$('#romFileInput').onchange=e=>importFiles([...e.target.files]);
$('#sourceRomFileInput').onchange=e=>{const f=e.target.files?.[0];e.target.value='';if(f)importChosenSourceRom(f)};
$('#librarySearch').addEventListener('input',()=>{visibleLimit=15;renderRecords()});
$('#librarySearch').addEventListener('search',()=>{visibleLimit=15;renderRecords()});
$('#showMoreGamesBtn')?.addEventListener('click',()=>{visibleLimit+=15;renderRecords()});
$('#showMoreClassicsBtn')?.addEventListener('click',()=>{classicVisibleLimit=Math.min(50,classicVisibleLimit+12);renderClassicCatalog()});
$('#featurePrev')?.addEventListener('click',()=>{featureIndex--;updateFeaturePosition();scheduleFeatureLoop()});
$('#featureNext')?.addEventListener('click',()=>{featureIndex++;updateFeaturePosition();scheduleFeatureLoop()});
const featureRail=$('#featureRail');if(featureRail){featureRail.addEventListener('pointerdown',e=>{featurePointer={id:e.pointerId,x:e.clientX,y:e.clientY};clearInterval(featureTimer);featureRail.setPointerCapture?.(e.pointerId)},{passive:true});featureRail.addEventListener('pointerup',e=>{if(!featurePointer||featurePointer.id!==e.pointerId)return;const dx=e.clientX-featurePointer.x,dy=e.clientY-featurePointer.y;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.2){featureIndex+=dx<0?1:-1;updateFeaturePosition()}featurePointer=null;scheduleFeatureLoop()},{passive:true});featureRail.addEventListener('pointercancel',()=>{featurePointer=null;scheduleFeatureLoop()},{passive:true})}
$('#collectionNavBtn')?.addEventListener('click',()=>switchLibrarySection('collection'));
$('#discoverNavBtn')?.addEventListener('click',()=>switchLibrarySection('discover'));
$('#sourceSearchBtn').addEventListener('click',e=>{e.preventDefault();switchLibrarySection('discover');refreshSourceStatus()});
function runSourceSearch(){const q=$('#sourceQuery').value.trim();if(!q){$('#sourceStatus').textContent='Type a game title to search.';return}sourceSearch(q)}
$('#sourceSearchForm').addEventListener('submit',e=>{e.preventDefault();runSourceSearch()});
$('#sourceSearchSubmit').addEventListener('click',e=>{e.preventDefault();runSourceSearch()});
$('#sourceQuery').addEventListener('input',()=>{clearTimeout(sourceSearchTimer);const q=$('#sourceQuery').value.trim();if(q.length<3)return;sourceSearchTimer=setTimeout(()=>sourceSearch(q),500)});
window.addEventListener('retrodeck-source-changed',refreshSourceStatus);

$('#saveRomMetaBtn').onclick=()=>saveDetails();
$('#favouriteRomBtn').onclick=async()=>{if(!selectedId)return;const rec=await saveDetails({close:false});if(!rec)return;rec.favourite=!rec.favourite;await putRecord(rec);await reloadRecords();$('#favouriteRomBtn').textContent=rec.favourite?'★ Favourite':'☆ Add to favourites';notify(rec.favourite?'Added to favourites':'Removed from favourites',1500)};
$('#playRomBtn').onclick=async()=>{const platform=$('#romPlatformInput').value;const hint=$('#platformRequiredHint');if(!platform){hint?.classList.remove('hidden');$('#romPlatformInput').classList.add('needsPlatform');$('#romPlatformInput').focus({preventScroll:true});notify('Select the original platform before playing',2600);return}hint?.classList.add('hidden');$('#romPlatformInput').classList.remove('needsPlatform');const rec=await saveDetails({close:false});if(rec){const resume=!!rec.saveState;$('#romDetailsDialog').close();playRom(rec,{resume})}};
$('#romPlatformInput').addEventListener('change',()=>{if($('#romPlatformInput').value){$('#platformRequiredHint')?.classList.add('hidden');$('#romPlatformInput').classList.remove('needsPlatform')}});
$('#deleteRomBtn').onclick=async()=>{if(!selectedId)return;const rec=await getRecord(selectedId);if(!rec)return;if(!confirm(`Remove ${rec.title} from Retro Deck?`))return;revokeCoverUrl(selectedId);await deleteRecord(selectedId);selectedId=null;$('#romDetailsDialog').close();await reloadRecords();updateStorageStatus();notify('Game removed')};
$('#refreshCoverBtn').onclick=async()=>{const rec=await saveDetails({close:false});if(rec){await refreshCoverFor(rec);const fresh=await getRecord(rec.id);if(fresh)showDetailsCover(fresh)}};

$('#manageCollectionBtn')?.addEventListener('click',openManageDialog);
document.querySelectorAll('.manageViewTab').forEach(tab=>tab.addEventListener('click',()=>{setManageView(tab.dataset.view);renderManageView()}));
$('#manageStripEditBtn')?.addEventListener('click',()=>{const rec=records[manageStripIndex];if(rec)openManageEdit(rec.id)});
$('#manageStripPlayBtn')?.addEventListener('click',()=>{const rec=records[manageStripIndex];if(rec){$('#collectionManageDialog').close();playRom(rec,{resume:!!rec.saveState})}});
$('#manageEditSaveBtn')?.addEventListener('click',saveManageEdit);
$('#manageEditDeleteBtn')?.addEventListener('click',deleteManageEdit);

window.addEventListener('message',e=>{if(e.data?.type==='retrodeck-emulator-started')notify('Game ready')});
window.addEventListener('pagehide',()=>{if(active)captureActiveState({quiet:true})});
window.addEventListener('beforeunload',()=>{clearInterval(autoSaveTimer);clearInterval(featureTimer);clearCoverUrls();if(activeBlobUrl)URL.revokeObjectURL(activeBlobUrl);if(activeStateBlobUrl)URL.revokeObjectURL(activeStateBlobUrl)});

let bundledSeedPromise=null;
async function seedBundledLibrary(){
  if(bundledSeedPromise)return bundledSeedPromise;
  bundledSeedPromise=(async()=>{
    try{
      const existing=await allRecords();if(existing.some(r=>r.id==='bundle-mountain-king-atari2600'||(String(r.title||'').toLowerCase()==='mountain king'&&String(r.platform||'').toLowerCase()==='atari2600')))return;
      const resp=await fetch('./mountain-king-atari2600.bin');
      if(!resp.ok)return;
      const bytes=await resp.arrayBuffer();
      const rec={
        id:'bundle-mountain-king-atari2600',
        sha1:await sha1(bytes),
        title:'Mountain King',
        platform:'atari2600',
        core:SYSTEMS['atari2600'].core,
        desc:'Bundled from your uploaded Atari 2600 ROM.',
        source:'Bundled owner upload',
        importedAt:Date.now(),
        lastPlayedAt:0,
        fileName:'Mountain King (Atari 2600).bin',
        bytes,
        coverSource:'./cover-mountain-king.png'
      };
      try{const coverResp=await fetch('./cover-mountain-king.png');if(coverResp.ok)rec.coverBlob=await coverResp.blob()}catch{}
      await putRecord(rec);
      await reloadRecords();
      notify('Mountain King has been added to your collection',2200);
    }catch(err){console.error('bundle seed failed',err)}
  })();
  return bundledSeedPromise;
}
reloadRecords().then(()=>seedBundledLibrary()).catch(e=>{console.error(e);notify('ROM library could not open')});
updateStorageStatus();refreshSourceStatus();
})();
