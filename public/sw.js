/* DayPulse Service Worker — Offline Shell & Cross-Platform Web Push */
const CACHE_NAME = 'daypulse-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'DayPulse แจ้งเตือนงาน',
    body: 'คุณมีรายการที่ต้องดำเนินการ',
    taskId: null,
    actionToken: null,
    taskType: 'todo',
    url: '/',
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  const actions = payload.taskId && payload.actionToken
    ? [
        { action: 'complete', title: '✓ ทำเสร็จแล้ว' },
        { action: 'snooze', title: '⏰ เลื่อน 10 นาที' },
      ]
    : [];

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.taskId ? `daypulse-task-${payload.taskId}` : `daypulse-${Date.now()}`,
    renotify: true,
    requireInteraction: payload.taskType === 'submission',
    vibrate: payload.taskType === 'submission' ? [220, 100, 220, 100, 320] : [180, 90, 180],
    data: payload,
    actions,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;
  notification.close();

  if (
    (action === 'complete' || action === 'snooze') &&
    data.taskId &&
    data.actionToken
  ) {
    event.waitUntil(
      fetch('/api/push/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: data.taskId,
          action,
          actionToken: data.actionToken,
        }),
      }).catch(() => {})
    );
    return;
  }

  const targetUrl = data.url || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({ type: 'NOTIFICATION_CLICKED', data });
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
