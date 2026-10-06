self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const { type, title, body, tag } = event.data || {};
  if (type === 'notify') {
    self.registration.showNotification(title || 'Dosis System', {
      body: body || '',
      tag: tag || 'default',
      icon: '/logo.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
    });
  }
});

const OFFLINE_HTML =
  '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<title>Sin conexión</title></head>' +
  '<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f4f0;color:#1a1a1a">' +
  '<div style="text-align:center;padding:24px">' +
  '<h1 style="margin:0 0 8px">Sin conexión</h1>' +
  '<p style="margin:0;color:#666">Revisa tu internet e intenta de nuevo.</p>' +
  '</div></body></html>';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req)
      .then((res) => res)
      .catch(() => {
        if (req.mode === 'navigate') {
          return new Response(OFFLINE_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
        return Response.error();
      }),
  );
});
