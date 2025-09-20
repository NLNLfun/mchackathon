const CACHE_NAME = 'incident-app-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/report.html',
  '/subscribe.html',
  '/admin.html',
  '/assets/styles.css',
  '/assets/app.js',
  '/assets/home.js',
  '/assets/report.js',
  '/assets/subscribe.js',
  '/assets/admin.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if(url.origin === location.origin){
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        if(e.request.method === 'GET'){
          const clone = resp.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/index.html')))
    );
  }
});
