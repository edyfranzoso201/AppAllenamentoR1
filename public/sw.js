// Service Worker — Sport Monitoring Web Push
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Sport Monitoring';
    const options = {
        body: data.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
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
