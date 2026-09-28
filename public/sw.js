// Service Worker — Sport Monitoring Web Push
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Sport Monitoring';
    const options = {
        body: data.body || '',
        // PNG e non SVG: Android non sa rasterizzare un vettoriale nemmeno
        // per le notifiche, e ripiegava su un'icona generica di sistema.
        // E' lo stesso motivo per cui la WebAPK non riusciva a usare la
        // favicon come icona dell'app.
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            const existing = list.find(c => c.url.includes(url));
            if (existing) return existing.focus();
            return clients.openWindow(url);
        })
    );
});
