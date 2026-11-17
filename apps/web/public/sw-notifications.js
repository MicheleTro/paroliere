// Importato dal service worker generato (vite.config.ts, workbox.importScripts).
// Tocco su una notifica di sfida: porta in primo piano il gioco (o lo apre) e apre quella sfida.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const duelId = event.notification.data && event.notification.data.duelId;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows[0];
      if (client) {
        await client.focus();
        if (duelId) client.postMessage({ type: 'open-duel', duelId });
        return;
      }
      await self.clients.openWindow(duelId ? `/?sfida=${encodeURIComponent(duelId)}` : '/');
    })(),
  );
});
