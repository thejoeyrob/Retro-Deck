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
  atari2600:{label:'Atari 2600',core:'atari2600',ext:['a26'],repo:'Atari_-_2600'},
  nes:{label:'Nintendo NES',core:'nes',ext:['nes','unf','unif'],repo:'Nintendo_-_Nintendo_Entertainment_System'},
  snes:{label:'Super Nintendo / SNES',core:'snes',ext:['sfc','smc','fig','swc','gd3','gd7','dx2','bsx'],repo:'Nintendo_-_Super_Nintendo_Entertainment_System'},
  gb:{label:'Nintendo Game Boy',core:'gb',ext:['gb'],repo:'Nintendo_-_Game_Boy'},
  gbc:{label:'Nintendo Game Boy Color',core:'gb',ext:['gbc'],repo:'Nintendo_-_Game_Boy_Color'},
  gba:{label:'Nintendo Game Boy Advance',core:'gba',ext:['gba'],repo:'Nintendo_-_Game_Boy_Advance'},
  segaMD:{label:'Sega Mega Drive / Genesis',core:'segaMD',ext:['md','gen','smd','68k','sgd'],repo:'Sega_-_Mega_Drive_-_Genesis'},
  segaMS:{label:'Sega Master System',core:'segaMS',ext:['sms'],repo:'Sega_-_Master_System_-_Mark_III'},
  segaGG:{label:'Sega Game Gear',core:'segaGG',ext:['gg'],repo:'Sega_-_Game_Gear'},
  n64:{label:'Nintendo 64',core:'n64',ext:['z64','n64','v64'],repo:'Nintendo_-_Nintendo_64'}
};

let records=[];
let selectedId=null;
let coverObjectUrls=[];
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
async function findCover(rec){
  for(const url of coverCandidates(rec)){
    const blob=await fetchImageBlob(url,3000);if(blob)return{blob,url};
  }
  return await wikipediaCover(rec);
}
async function refreshCoverFor(rec,quiet=false){
  if(!navigator.onLine){if(!quiet)notify('Connect to the internet to look up artwork');return rec}
  if(!quiet)notify('Searching for original cover artwork…',5000);
  const found=await findCover(rec);
  if(found){rec.coverBlob=found.blob;rec.coverSource=found.url;rec.coverCheckedAt=Date.now();await putRecord(rec);if(!quiet)notify('Cover artwork saved');await reloadRecords();return rec}
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
  const platform=overrides.platform||detectPlatform(fileName,buf);
  const digest=await sha1(buf), crc=crc32(buf);
  const duplicate=records.find(r=>digest&&r.sha1===digest);
  if(duplicate){notify(`${duplicate.title} is already in your library`);return duplicate}
  const inside=internalTitle(platform,buf);
  const rec={kind:'library-rom',id:uuid(),fileName,title:overrides.title||bestTitle(fileName,platform,buf),platform,core:SYSTEMS[platform]?.core||'',bytes:buf,size:buf.byteLength,sha1:digest,crc32:crc,internalTitle:inside,importedAt:Date.now(),source:overrides.source||'local',sourcePageUrl:overrides.sourcePageUrl||'',catalogYear:overrides.year||'',catalogPlatform:overrides.catalogPlatform||''};
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

function clearCoverUrls(){for(const u of coverObjectUrls)URL.revokeObjectURL(u);coverObjectUrls=[]}
function recordCoverUrl(rec){if(!rec.coverBlob)return'';const u=URL.createObjectURL(rec.coverBlob);coverObjectUrls.push(u);return u}
function renderRecords(){
  clearCoverUrls();const grid=$('#romGrid'),empty=$('#romEmpty');if(!grid)return;
  const q=($('#librarySearch')?.value||'').trim().toLowerCase();
  const shown=records.filter(r=>!q||`${r.title} ${SYSTEMS[r.platform]?.label||''} ${r.fileName}`.toLowerCase().includes(q));
  const visible=q?shown:shown.slice(0,visibleLimit);
  grid.innerHTML='';
  visible.forEach(rec=>{
    const b=document.createElement('button');b.type='button';b.className='gameCard romCard';
    const cover=recordCoverUrl(rec),sys=SYSTEMS[rec.platform];
    const art=cover?`<div class="gameVisual romVisual caseArt" style="--cover:url('${cover}')"><img src="${cover}" alt="${esc(rec.title)} cover"><div class="romPlayBadge">▶</div></div>`:`<div class="gameVisual romVisual"><div class="coverFallback"><span>${esc((sys?.label||'GAME').toUpperCase())}</span><strong>${esc(rec.title)}</strong></div><div class="romPlayBadge">▶</div></div>`;
    b.innerHTML=`${art}<div class="gameBody"><h3>${esc(rec.title)}</h3><p>${esc(sys?.label||'Platform not set')}</p></div>`;
    b.onclick=()=>openDetails(rec.id);grid.appendChild(b)
  });
  empty.classList.toggle('hidden',records.length>0);
  const more=$('#showMoreGamesBtn');if(more)more.classList.toggle('hidden',!!q||shown.length<=visibleLimit);
  const status=$('#collectionMatchStatus');if(status)status.textContent=q?`${shown.length} match${shown.length===1?'':'es'}`:(shown.length>visible.length?`${visible.length} of ${shown.length}`:'');
  $('#romCount').textContent=`${records.length} game${records.length===1?'':'s'}`;
  if($('#romCountNav'))$('#romCountNav').textContent=records.length;
}

function formatBytes(n=0){if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(0)} KB`;return`${(n/1048576).toFixed(n>104857600?0:1)} MB`}
async function reloadRecords(){records=(await allRecords()).sort((a,b)=>(b.lastPlayedAt||b.importedAt||0)-(a.lastPlayedAt||a.importedAt||0));renderRecords()}

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
  $('#romDetailsDialog').showModal()
}
async function saveDetails({close=true}={}){
  if(!selectedId)return null;const rec=await getRecord(selectedId);if(!rec)return null;
  rec.title=$('#romTitleInput').value.trim()||rec.title;rec.platform=$('#romPlatformInput').value;rec.core=SYSTEMS[rec.platform]?.core||'';await putRecord(rec);await reloadRecords();if(close)$('#romDetailsDialog').close();return rec
}

function jsonSafe(v){return JSON.stringify(v).replace(/</g,'\\u003c')}
function buildPlayerDocument(rec,blobUrl){
  const controls={0:{
    0:{value:'z',value2:'BUTTON_1'},1:{value:'s',value2:'BUTTON_4'},2:{value:'v',value2:'SELECT'},3:{value:'enter',value2:'START'},
    4:{value:'up arrow',value2:'DPAD_UP'},5:{value:'down arrow',value2:'DPAD_DOWN'},6:{value:'left arrow',value2:'DPAD_LEFT'},7:{value:'right arrow',value2:'DPAD_RIGHT'},
    8:{value:'x',value2:'BUTTON_2'},9:{value:'a',value2:'BUTTON_3'},10:{value:'q',value2:'LEFT_TOP_SHOULDER'},11:{value:'e',value2:'RIGHT_TOP_SHOULDER'}
  },1:{},2:{},3:{}};
  const inputIndex={up:4,down:5,left:6,right:7,a:8,b:0,x:9,y:1,start:3,select:2};
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#000}body{touch-action:none}#game{position:absolute;inset:0}canvas{outline:none!important}</style></head><body tabindex="-1"><div id="game"></div><script>
  window.EJS_player='#game';
  window.EJS_core=${jsonSafe(rec.core)};
  window.EJS_gameUrl=${jsonSafe(blobUrl)};
  window.EJS_gameName=${jsonSafe(rec.title)};
  window.EJS_pathtodata=${jsonSafe(EJS_DATA)};
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
  a:{key:'x',code:'KeyX',keyCode:88,index:8},b:{key:'z',code:'KeyZ',keyCode:90,index:0},x:{key:'a',code:'KeyA',keyCode:65,index:9},y:{key:'s',code:'KeyS',keyCode:83,index:1},start:{key:'Enter',code:'Enter',keyCode:13,index:3},select:{key:'v',code:'KeyV',keyCode:86,index:2}
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
async function playRom(rec){
  if(!rec.platform||!rec.core){notify('Choose the correct platform before playing');openDetails(rec.id);return}
  const bytes=rec.bytes;if(!bytes){notify('ROM data is missing');return}
  if(active)exitRom();
  active=true;activeId=rec.id;activeBlobUrl=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  $('#libraryView').classList.remove('active');$('#consoleView').classList.add('active');$('#gameCanvas').classList.add('hidden');$('#javatari-screen').classList.add('hidden');
  const host=$('#romEmulatorHost');host.classList.remove('hidden');host.innerHTML='';
  playerFrame=document.createElement('iframe');playerFrame.className='romPlayerFrame';playerFrame.allow='autoplay; fullscreen; gamepad';playerFrame.setAttribute('allowfullscreen','');playerFrame.srcdoc=buildPlayerDocument(rec,activeBlobUrl);host.appendChild(playerFrame);
  $('#gameTitle').textContent=rec.title.toUpperCase();$('#hudText').textContent=(SYSTEMS[rec.platform]?.label||'ROM').toUpperCase();$('#romExitBtn').classList.remove('hidden');
  $('#mirrorPad').classList.add('hidden');$('#actionPad').classList.remove('hidden');
  setSystemLabel($('#menuBtn'),'START');setSystemLabel($('#pauseBtn'),'SELECT');
  rec.lastPlayedAt=Date.now();await putRecord(rec);await reloadRecords();notify('Loading emulator…',3500)
}
function exitRom(){
  if(!active)return;active=false;activeId=null;
  if(playerFrame){playerFrame.remove();playerFrame=null}$('#romEmulatorHost').innerHTML='';$('#romEmulatorHost').classList.add('hidden');
  if(activeBlobUrl){URL.revokeObjectURL(activeBlobUrl);activeBlobUrl=null}
  $('#romExitBtn').classList.add('hidden');setSystemLabel($('#menuBtn'),'MENU');setSystemLabel($('#pauseBtn'),'PAUSE');
  $('#consoleView').classList.remove('active');$('#libraryView').classList.add('active');$('#gameCanvas').classList.remove('hidden');renderRecords()
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
    latestSourceResults=items;results.innerHTML='';
    if(!items.length){results.innerHTML='<div class="sourceEmpty">No matching titles found. Try the exact game name.</div>';return}
    items.slice(0,24).forEach((item,i)=>{
      const detail=[item.platform||'Platform not specified',item.year||''].filter(Boolean).join(' · ');
      const card=document.createElement('article');card.className='discoveryCard';
      const img=item.coverUrl?`<img src="${esc(item.coverUrl)}" alt="" loading="lazy">`:'<div class="sourceMiniCover">NO ART</div>';
      card.innerHTML=`<div class="discoverArt">${img}</div><div class="discoverMeta"><strong>${esc(item.title||'Untitled')}</strong><small>${esc(detail)}</small><button type="button" data-i="${i}">${window.RetroDeckCloud?.configured?.()?'ADD TO DECK':'SELECT GAME'}</button></div>`;
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
  if(window.RetroDeckCloud?.configured?.()){
    try{
      notify(`Adding ${item.title||'game'} from cloud…`,10000);await ensurePersistentStorage();
      const cloud=await window.RetroDeckCloud.ingest(item);
      const buf=await cloud.romBlob.arrayBuffer();
      const fileName=cloud.fileName||`${item.title||'game'}.rom`;
      const platform=platformFromLabel(cloud.platform||item.platform||'')||detectPlatform(fileName,buf);
      const rec=await importBuffer(buf,fileName,{title:cloud.title||item.title||'',platform,source:'My Abandonware via Retro Deck Cloud',sourcePageUrl:item.pageUrl||'',year:item.year||'',catalogPlatform:item.platform||''});
      if(cloud.coverBlob){rec.coverBlob=cloud.coverBlob;rec.coverSource=cloud.coverSource||'Retro Deck Cloud';await putRecord(rec);await reloadRecords()}
      else if(item.coverUrl&&!rec.coverBlob){const blob=await fetchImageBlob(item.coverUrl,4000);if(blob){rec.coverBlob=blob;rec.coverSource=item.coverUrl;await putRecord(rec);await reloadRecords()}}
      if(!rec.coverBlob)refreshCoverFor(rec,true).catch(()=>{});
      pendingSourceItem=null;pendingSourceAdapter=null;switchLibrarySection('collection');notify(`${rec.title} added to your collection`,3500);updateStorageStatus();return
    }catch(e){console.error(e);notify('Cloud import failed — choose your local file instead',4200)}
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
  const cloud=window.RetroDeckCloud?.configured?.();
  $('#sourceStatus').textContent=cloud?'Retro Deck cloud connected':'My Abandonware catalogue ready';
  const note=$('#cloudSourceNote');if(note)note.textContent=cloud?'One-tap import is connected. Select a result to add it directly to your collection.':'Search is live. A local file picker is used until the dedicated Supabase service is connected.';
}

// Public bridge used by the main controller code.
window.RetroDeckROM={
  get active(){return active},
  routeControl(k,v){return sendKey(k,v)},
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
$('#collectionNavBtn')?.addEventListener('click',()=>switchLibrarySection('collection'));
$('#discoverNavBtn')?.addEventListener('click',()=>switchLibrarySection('discover'));
$('#sourceSearchBtn').addEventListener('click',e=>{e.preventDefault();switchLibrarySection('discover');refreshSourceStatus()});
function runSourceSearch(){const q=$('#sourceQuery').value.trim();if(!q){$('#sourceStatus').textContent='Type a game title to search.';return}sourceSearch(q)}
$('#sourceSearchForm').addEventListener('submit',e=>{e.preventDefault();runSourceSearch()});
$('#sourceSearchSubmit').addEventListener('click',e=>{e.preventDefault();runSourceSearch()});
$('#sourceQuery').addEventListener('input',()=>{clearTimeout(sourceSearchTimer);const q=$('#sourceQuery').value.trim();if(q.length<3)return;sourceSearchTimer=setTimeout(()=>sourceSearch(q),500)});
window.addEventListener('retrodeck-source-changed',refreshSourceStatus);

$('#saveRomMetaBtn').onclick=()=>saveDetails();
$('#playRomBtn').onclick=async()=>{const rec=await saveDetails({close:false});if(rec){$('#romDetailsDialog').close();playRom(rec)}};
$('#deleteRomBtn').onclick=async()=>{if(!selectedId)return;const rec=await getRecord(selectedId);if(!rec)return;if(!confirm(`Remove ${rec.title} from Retro Deck?`))return;await deleteRecord(selectedId);selectedId=null;$('#romDetailsDialog').close();await reloadRecords();updateStorageStatus();notify('Game removed')};
$('#refreshCoverBtn').onclick=async()=>{const rec=await saveDetails({close:false});if(rec){await refreshCoverFor(rec);const fresh=await getRecord(rec.id);if(fresh)showDetailsCover(fresh)}};

window.addEventListener('message',e=>{if(e.data?.type==='retrodeck-emulator-started')notify('Game ready')});
window.addEventListener('beforeunload',()=>{clearCoverUrls();if(activeBlobUrl)URL.revokeObjectURL(activeBlobUrl)});

reloadRecords().catch(e=>{console.error(e);notify('ROM library could not open')});
updateStorageStatus();refreshSourceStatus();
})();
