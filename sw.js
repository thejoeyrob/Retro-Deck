const CACHE='jw-retro-deck-v1.9.0-fullscreen-touch-polish';
const ASSETS=["./", "./index.html", "./styles.css", "./app.js", "./retrodeck-config.js", "./retrodeck-cloud.js", "./rom-source.js", "./rom-library.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./hero-retro.png", "./game-pong.jpg", "./game-snake.jpg", "./cover-mountain-king.png", "./mountain-king-atari2600.bin", "./skin-nes.jpg", "./skin-snes.jpg", "./skin-gameboy.jpg", "./skin-mastersystem.jpg", "./skin-psp.jpg", "./skin-switch.jpg", "./skin-carbon.jpg", "./skin-neon.jpg"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    if(resp&&(resp.ok||resp.type==='opaque')){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}
    return resp
  }).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())))
});
