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
