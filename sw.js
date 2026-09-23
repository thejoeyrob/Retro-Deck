const CACHE='jw-retro-deck-v1.2.0';
const ASSETS=["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./hero-retro.png", "./game-mountain.jpg", "./game-maze.jpg", "./game-blocks.jpg", "./game-pong.jpg", "./game-snake.jpg", "./game-breaker.jpg", "./game-rocks.jpg", "./game-brawl.jpg", "./skin-classic.jpg", "./skin-charcoal.jpg", "./skin-red.jpg", "./skin-ice.jpg", "./skin-neon.jpg", "./skin-sunset.jpg", "./skin-carbon.jpg", "./skin-arcade.jpg"];

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}
    return resp
  }).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())))
});
