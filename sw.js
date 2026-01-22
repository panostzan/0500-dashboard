// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE WORKER - Offline Support for 0500 PWA
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_NAME = '0500-v1';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/config.js',
    '/js/animations.js',
    '/js/lava-lamp.js',
    '/js/clock.js',
    '/js/goals.js',
    '/js/schedule.js',
    '/js/timer.js',
    '/js/globe.js',
    '/js/hud.js',
    '/js/weather.js',
    '/js/notes.js',
    '/js/sleep.js',
    '/js/main.js',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests (like weather API, fonts)
    if (url.origin !== location.origin) {
        // For external APIs, try network first
        if (url.hostname.includes('api.open-meteo.com')) {
            event.respondWith(
                fetch(request)
                    .catch(() => {
                        // Return cached weather or empty response
                        return new Response(JSON.stringify({ error: 'offline' }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    })
            );
            return;
        }
        return;
    }

    // For static assets, use cache-first strategy
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version, but update cache in background
                    event.waitUntil(
                        fetch(request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    caches.open(CACHE_NAME)
                                        .then((cache) => cache.put(request, networkResponse));
                                }
                            })
                            .catch(() => { /* ignore network errors */ })
                    );
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(request)
                    .then((networkResponse) => {
                        // Cache successful responses
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(request, responseClone));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed, return offline page for navigation
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
