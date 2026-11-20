const CACHE_NAME = 'wahy-wa-namaa-v4';
const RUNTIME_CACHE = 'wahy-wa-namaa-runtime-v3';

const PRECACHE_URLS = [
  '/manifest.json',
  '/favicon.svg',
  '/assets/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin === location.origin) {
    // Never intercept API, uploads, hashed build assets, or /images/ in the Service Worker.
    // Letting Vercel CDN + browser handle them prevents stale chunk mismatches and frozen images.
    if (
      url.pathname.startsWith('/api/')
      || url.pathname.startsWith('/uploads/')
      || url.pathname.startsWith('/assets/')
      || url.pathname.startsWith('/images/')
    ) {
      return;
    }
    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            const contentType = (response?.headers?.get('content-type') || '').toLowerCase();
            if (response && response.ok && response.status === 200 && response.type === 'basic' && contentType.includes('text/html')) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put('/index.html', responseToCache);
              });
            }
            return response;
          })
          .catch(() => caches.match('/index.html'))
      );
      return;
    }

    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;

        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
    );
  } else if (url.hostname === 'fonts.googleapis.com' ||
             url.hostname === 'fonts.gstatic.com' ||
             url.hostname === 'images.unsplash.com') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match(event.request).then((cached) => {
          if (cached) return cached;

          return fetch(event.request).then((response) => {
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
  }
});

function resolveSafeSameOriginUrl(rawUrl, fallbackPath = '/') {
  const fallback = `${self.location.origin}${fallbackPath}`;
  if (typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  try {
    const parsed = new URL(trimmed, self.location.origin);
    if (parsed.origin !== self.location.origin) {
      return fallback;
    }
    return parsed.href;
  } catch {
    return fallback;
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url } = event.data.payload || {};
    event.waitUntil(
      self.registration.showNotification(String(title || 'أكاديمية وَحْيٌ وَنَمَاء').slice(0, 160), {
        body: String(body || '').slice(0, 500),
        icon: '/assets/logo.png',
        badge: '/favicon.svg',
        data: { url: resolveSafeSameOriginUrl(url, '/notifications') },
      })
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json() || {};
  } catch {
    data = { title: 'أكاديمية وَحْيٌ وَنَمَاء', body: event.data.text() };
  }

  const options = {
    body: String(data.body || '').slice(0, 500),
    icon: '/assets/logo.png',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: {
      url: resolveSafeSameOriginUrl(data.url, '/'),
    },
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
  };

  event.waitUntil(
    self.registration.showNotification(String(data.title || 'أكاديمية وَحْيٌ وَنَمَاء').slice(0, 160), options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = resolveSafeSameOriginUrl(event.notification.data?.url, '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
