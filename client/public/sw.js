/**
 * sw.js — Service Worker for VIMP
 * Caches the app shell so the UI loads even on slow/no connection.
 * Attendance DATA is handled separately via IndexedDB (offlineAttendance.js).
 */

const CACHE_NAME = 'vimp-shell-v1';
const SHELL_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Network-first strategy: try server, fall back to cache for navigation requests
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only intercept GET requests for page navigation (not API calls)
    if (request.method !== 'GET') return;
    if (request.url.includes('/api/')) return;  // Never cache API responses

    event.respondWith(
        fetch(request)
            .then(response => {
                // Cache successful navigation responses
                if (response.ok && request.mode === 'navigate') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request).then(cached => cached || caches.match('/')))
    );
});
