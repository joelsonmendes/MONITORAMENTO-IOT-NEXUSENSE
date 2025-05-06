self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado');
  return self.clients.claim();
});

// Escuta notificações push
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  const title = data.title || 'Alerta de Nível Crítico';
  const options = {
    body: data.body || 'Nível crítico detectado no reservatório ou cisterna.',
    icon: 'icons/icon-192x192.png',
    badge: 'icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Responde ao clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
