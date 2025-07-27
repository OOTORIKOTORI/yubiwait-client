// public/service-worker.js

// キャッシュ対象のファイルをworkboxが注入
import { precacheAndRoute } from 'workbox-precaching';
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', event => {
  const data = event.data?.json();
  console.log('[Service Worker] Push received:', data);

  self.registration.showNotification(data.title || '通知タイトル', {
    body: data.body || '通知内容です'
  });
});
