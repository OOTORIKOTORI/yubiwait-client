// public/service-worker.js

self.addEventListener('push', event => {
  const data = event.data?.json();
  console.log('[Service Worker] Push received:', data);

  self.registration.showNotification(data.title || '通知タイトル', {
    body: data.body || '通知内容です',
    icon: '/icon-192.png', // 任意（なければコメントアウトでもOK）
  });
});
