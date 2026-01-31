// Service Worker for Intraday Signal Indicator PWA
const CACHE_NAME = 'signal-indicator-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Install complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[Service Worker] Activate complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version and update cache in background
          event.waitUntil(updateCache(event.request));
          return cachedResponse;
        }
        return fetchAndCache(event.request);
      })
      .catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Helper: Fetch and cache
async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

// Helper: Update cache in background
async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response);
    }
  } catch (error) {
    // Network error, ignore
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');

  let data = {
    title: 'New Trading Signal',
    body: 'Check the app for new signals!',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    soundType: 'signal'
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.log('[Service Worker] Error parsing push data:', e);
  }

  // Determine vibration pattern based on notification type
  let vibrationPattern;
  if (data.soundType === 'exit' || data.soundType === 'warning' || data.title.includes('EXIT')) {
    // Urgent vibration for exit warnings
    vibrationPattern = [300, 100, 300, 100, 300, 100, 300];
  } else if (data.soundType === 'buy' || data.soundType === 'signal' || data.title.includes('BUY')) {
    // Double vibrate for buy signals
    vibrationPattern = [200, 100, 200, 100, 200];
  } else {
    // Default vibration
    vibrationPattern = [200, 100, 200];
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon.svg',
    badge: data.badge || '/icons/icon.svg',
    vibrate: vibrationPattern,
    data: {
      url: data.url || '/',
      soundType: data.soundType,
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'View Signals' },
      { action: 'close', title: 'Dismiss' }
    ],
    tag: data.tag || 'signal-notification',
    renotify: true,
    requireInteraction: true,
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not open
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || '/');
        }
      })
  );
});

// Message event - for communication with main app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, soundType } = event.data;

    // Determine vibration pattern based on notification type
    let vibrationPattern;
    if (soundType === 'exit' || soundType === 'warning') {
      // Urgent vibration for exit warnings
      vibrationPattern = [300, 100, 300, 100, 300, 100, 300];
    } else if (soundType === 'buy' || soundType === 'signal') {
      // Double vibrate for buy signals
      vibrationPattern = [200, 100, 200, 100, 200];
    } else {
      // Default vibration
      vibrationPattern = [200, 100, 200];
    }

    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      vibrate: vibrationPattern,
      tag: tag || 'signal-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: { url: '/', soundType: soundType }
    });
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline signal checks
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);

  if (event.tag === 'check-signals') {
    event.waitUntil(checkForNewSignals());
  }
});

// Check for new signals (background)
async function checkForNewSignals() {
  try {
    const response = await fetch('/api/signals');
    const data = await response.json();

    if (data.success && data.signals && data.signals.length > 0) {
      // Notify about new signals
      const signalCount = data.signals.length;
      const buyCount = data.signals.filter(s => s.signalType === 'BUY').length;
      const sellCount = data.signals.filter(s => s.signalType === 'SELL').length;

      await self.registration.showNotification('New Trading Signals', {
        body: `${signalCount} signals: ${buyCount} BUY, ${sellCount} SELL`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'background-check',
        data: { url: '/' }
      });
    }
  } catch (error) {
    console.log('[Service Worker] Background sync failed:', error);
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[Service Worker] Periodic sync:', event.tag);

  if (event.tag === 'check-signals-periodic') {
    event.waitUntil(checkForNewSignals());
  }
});
