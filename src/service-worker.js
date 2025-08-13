// public/service-worker.js

// キャッシュ対象のファイルをworkboxが注入
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', event => {
  const data = event.data?.json();
  console.log('[Service Worker] Push received:', data);

  self.registration.showNotification(data.title || '通知タイトル', {
    body: data.body || '通知内容です'
  });
});

// static file cache
registerRoute(
  ({ request }) => ['style', 'script', 'image'].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 })
    ]
  })
)