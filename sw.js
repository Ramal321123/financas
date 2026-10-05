// Cache do app pra funcionar offline. Ao mudar arquivos, subir a versão.
const CACHE = 'financas-v10';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'vivo.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'logo.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'inter.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Responde do cache na hora e atualiza em segundo plano (funciona com o servidor desligado).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const salvo = await cache.match(e.request, { ignoreSearch: true });
      const rede = fetch(e.request)
        .then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; })
        .catch(() => salvo);
      return salvo || rede;
    })
  );
});
