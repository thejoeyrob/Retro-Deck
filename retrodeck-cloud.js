(()=>{
'use strict';
let clientPromise=null;
function cfg(){return window.RETRO_DECK_CONFIG||{}}
function configured(){const c=cfg();return /^https:\/\//i.test(c.supabaseUrl||'')&&String(c.publishableKey||'').length>20}
async function getClient(){
  if(!configured())throw Object.assign(new Error('Retro Deck cloud service is not connected.'),{code:'CLOUD_NOT_CONFIGURED'});
  if(clientPromise)return clientPromise;
  clientPromise=(async()=>{
    if(!window.supabase?.createClient){
      const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      window.supabase=mod;
    }
    const c=cfg();
    return window.supabase.createClient(c.supabaseUrl,c.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  })();
  return clientPromise;
}
async function ensureSession(){
  const sb=await getClient();
  let {data:{session}}=await sb.auth.getSession();
  if(!session){
    const r=await sb.auth.signInAnonymously();
    if(r.error)throw r.error;
    session=r.data.session;
  }
  if(!session?.access_token)throw new Error('Could not establish Retro Deck cloud session.');
  return {sb,session};
}
async function invoke(action,payload={}){
  const {sb}=await ensureSession();
  const c=cfg();
  const {data,error}=await sb.functions.invoke(c.functionName||'retrodeck-catalog',{body:{action,...payload}});
  if(error)throw error;
  if(data?.error)throw Object.assign(new Error(data.error),{code:data.code||'CLOUD_ERROR',details:data});
  return data;
}
async function search(query){return (await invoke('search',{query})).items||[]}
async function fetchBlob(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`Cloud file returned ${r.status}`);return await r.blob()}
async function ingest(item){
  const data=await invoke('ingest',{item});
  if(!data?.romUrl)throw new Error('Cloud import did not return a game file.');
  const romBlob=await fetchBlob(data.romUrl);
  const coverBlob=data.coverUrl?await fetchBlob(data.coverUrl).catch(()=>null):null;
  return {...data,romBlob,coverBlob};
}
window.RetroDeckCloud={configured,getClient,search,ingest};
})();
