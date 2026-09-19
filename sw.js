const CACHE="tv-led-studio-v1";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{
    const clone=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,clone)); return r;
  }).catch(()=>caches.match("./index.html"))));
});