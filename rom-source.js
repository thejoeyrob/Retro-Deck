/*
  JW Retro Deck v1.6 - My Abandonware browser fallback adapter

  Used only when the dedicated Retro Deck Supabase cloud service is not
  configured. This flat-PWA fallback searches title/platform metadata and
  then asks the player to choose a local game file. The cloud path handles
  authenticated server-side catalogue lookup/import. A small metadata seed
  keeps exact-title discovery useful when browser CORS blocks the live site.
*/
(()=>{
  'use strict';
  const BASE='https://www.myabandonware.com';

  const SEED=[
    {id:'streets-of-rage-82p',title:'Streets of Rage',platform:'Genesis',year:'1991',pageUrl:`${BASE}/game/streets-of-rage-82p`},
    {id:'streets-of-rage-2-82q',title:'Streets of Rage 2',platform:'Genesis',year:'1992',pageUrl:`${BASE}/game/streets-of-rage-2-82q`},
    {id:'streets-of-rage-3-82r',title:'Streets of Rage 3',platform:'Genesis',year:'1994',pageUrl:`${BASE}/game/streets-of-rage-3-82r`},
    {id:'road-rash-6t2',title:'Road Rash',platform:'Genesis',year:'1991',pageUrl:`${BASE}/game/road-rash-6t2`}
  ];

  const platformPatterns=[
    [/atari\s*2600/i,'Atari 2600'],[/genesis|mega\s*drive/i,'Genesis'],[/master\s*system/i,'SEGA Master System'],[/game\s*gear/i,'Game Gear'],
    [/super\s*nintendo|snes|super\s*famicom/i,'SNES'],[/nintendo\s*64|\bn64\b/i,'Nintendo 64'],[/game\s*boy\s*advance|\bgba\b/i,'Game Boy Advance'],
    [/game\s*boy\s*color|\bgbc\b/i,'Game Boy Color'],[/game\s*boy|\bgb\b/i,'Game Boy'],[/\bnes\b|nintendo entertainment|famicom/i,'NES']
  ];
  const supported=/Atari 2600|Genesis|Mega Drive|Master System|Game Gear|SNES|Super Nintendo|Nintendo 64|Game Boy|NES/i;

  function escQuery(q){return encodeURIComponent(String(q||'').trim()).replace(/%20/g,'+')} 
  function platformFromText(text=''){
    for(const [re,label] of platformPatterns)if(re.test(text))return label;
    return '';
  }
  function cleanTitle(s=''){
    return String(s).replace(/\s+/g,' ').replace(/^Download\s+/i,'').trim();
  }
  function abs(value){try{return new URL(value,BASE).href}catch{return''}}
  function closestCard(a){return a.closest('article,li,.game,.item,.row,.media,.card,[class*="game"]')||a.parentElement||a}
  function parseSearch(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const seen=new Set(),out=[];
    for(const a of doc.querySelectorAll('a[href*="/game/"]')){
      const href=abs(a.getAttribute('href')); if(!href||seen.has(href))continue;
      let title=cleanTitle(a.getAttribute('title')||a.querySelector('h2,h3,h4,strong')?.textContent||a.textContent);
      if(!title||title.length<2||/comment|screenshot|download|manual|review/i.test(title))continue;
      const card=closestCard(a),text=cleanTitle(card?.textContent||'');
      const platform=platformFromText(text);
      // Retro Deck currently only advertises systems for which it has a configured emulator core.
      if(platform && !supported.test(platform))continue;
      const year=(text.match(/\b(19\d{2}|20\d{2})\b/)||[])[1]||'';
      const img=card?.querySelector('img');
      const coverUrl=img?abs(img.getAttribute('data-src')||img.getAttribute('data-original')||img.getAttribute('src')||''):'';
      const id=href.split('/game/')[1]?.replace(/\/$/,'')||href;
      seen.add(href);out.push({id,title,platform,year,coverUrl,pageUrl:href,catalogOnly:true});
      if(out.length>=30)break;
    }
    return out;
  }
  function parseReaderMarkdown(text){
    const out=[],seen=new Set();
    const lines=String(text||'').split(/\r?\n/);
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      const re=/\[([^\]]{2,100})\]\((https?:\/\/www\.myabandonware\.com\/game\/[^)\s]+|\/game\/[^)\s]+)\)/ig;
      let m;
      while((m=re.exec(line))){
        const title=cleanTitle(m[1]).replace(/^Download\s+/i,'');
        const pageUrl=abs(m[2]);
        if(!title||!pageUrl||seen.has(pageUrl)||/screenshot|manual|comment|download\s+\d/i.test(title))continue;
        const nearby=cleanTitle(lines.slice(Math.max(0,i-2),Math.min(lines.length,i+4)).join(' '));
        const platform=platformFromText(nearby);
        if(platform && !supported.test(platform))continue;
        const year=(nearby.match(/\b(19\d{2}|20\d{2})\b/)||[])[1]||'';
        seen.add(pageUrl);out.push({id:pageUrl.split('/game/')[1]?.replace(/\/$/,'')||pageUrl,title,platform,year,coverUrl:'',pageUrl,catalogOnly:true});
        if(out.length>=30)return out;
      }
    }
    return out;
  }


  function normalized(s=''){return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim()}
  function relevantResults(items,query){
    const q=normalized(query),tokens=q.split(/\s+/).filter(Boolean);
    if(!q||!tokens.length)return items;
    return items.map(item=>{
      const title=normalized(item.title||''),hay=normalized(`${item.title||''} ${item.platform||''} ${item.year||''}`);
      const titleHits=tokens.filter(t=>title.includes(t)).length;
      const anyHits=tokens.filter(t=>hay.includes(t)).length;
      const phrase=title.includes(q)?8:0;
      const prefix=title.startsWith(q)?3:0;
      return {item,score:phrase+prefix+titleHits*3+anyHits};
    }).filter(x=>x.score>=Math.max(3,tokens.length*3)).sort((a,b)=>b.score-a.score).map(x=>x.item);
  }

  function seedSearch(q){
    q=String(q||'').trim().toLowerCase();
    if(!q)return[];
    return relevantResults(SEED.map(x=>({...x,catalogOnly:true,offlineSeed:true})),q);
  }
  async function fetchText(url,ms=8000){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);
    try{
      const r=await fetch(url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
      if(!r.ok)throw new Error(`Request returned ${r.status}`);
      return await r.text();
    }finally{clearTimeout(timer)}
  }
  async function directSearch(query){
    const raw=String(query||'').trim();
    const plus=escQuery(raw),slug=encodeURIComponent(raw.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
    const targets=[`${BASE}/search/q/${plus}`,`${BASE}/search/q/${slug}`,`${BASE}/search?q=${encodeURIComponent(raw)}`];
    let lastErr=null;
    for(const target of targets){
      const attempts=[
        {name:'direct',url:target,reader:false,timeout:6500},
        {name:'metadata relay',url:`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,reader:false,timeout:8500},
        {name:'metadata relay',url:`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,reader:false,timeout:8500},
        {name:'reader relay',url:`https://r.jina.ai/${target}`,reader:true,timeout:9000}
      ];
      for(const attempt of attempts){
        try{
          const body=await fetchText(attempt.url,attempt.timeout);
          const parsed=attempt.reader?parseReaderMarkdown(body):parseSearch(body);
          const items=relevantResults(parsed,raw);
          if(items.length){adapter.lastTransport=attempt.name;return items}
        }catch(e){lastErr=e}
      }
    }
    if(lastErr)throw lastErr;
    return [];
  }

  const adapter={
    name:'My Abandonware catalogue',
    catalogOnly:true,
    homepage:BASE,
    statusNote:'Searches title/platform metadata only. Add a game by choosing a ROM file you already have.',
    async search(query){
      const fallback=seedSearch(query);
      try{
        const live=await directSearch(query);
        adapter.lastMode='live';adapter.lastError='';
        if(live.length)return live;
        return fallback;
      }catch(err){
        adapter.lastMode=fallback.length?'offline-seed':'blocked';
        adapter.lastError=err?.message||String(err);
        if(fallback.length)return fallback;
        const e=new Error('My Abandonware catalogue search is blocked by the site/browser CORS policy in this flat PWA. Local ROM import still works.');
        e.code='CATALOG_CORS';throw e;
      }
    }
  };

  window.RETRO_DECK_ROM_SOURCE=adapter;
  window.registerRetroDeckRomSource=function registerRetroDeckRomSource(next){
    window.RETRO_DECK_ROM_SOURCE=next||adapter;
    window.dispatchEvent(new CustomEvent('retrodeck-source-changed'));
  };
})();
