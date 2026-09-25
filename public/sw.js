/*
 * LingkodBayan service worker.
 *
 * Strategy:
 * - Navigations (pages): network-first, cached copy as fallback, /offline.html as last resort.
 * - /_next/static/* (hashed build assets): cache-first (immutable).
 * - Other same-origin static assets (images, fonts, scripts): stale-while-revalidate.
 * - /api/*, /auth/*, and cross-origin requests (e.g. Supabase): never cached.
 */

const VERSION = 'v1'
const PAGES_CACHE = `lingkodbayan-pages-${VERSION}`
const STATIC_CACHE = `lingkodbayan-static-${VERSION}`
const RUNTIME_CACHE = `lingkodbayan-runtime-${VERSION}`
const CURRENT_CACHES = [PAGES_CACHE, STATIC_CACHE, RUNTIME_CACHE]

const OFFLINE_URL = '/offline.html'
const CACHE_PREFIX = 'lingkodbayan-'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/lingkod-logo.png']))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/')
}

function shouldHandle(request, url) {
  if (request.method !== 'GET') return false
  // Only handle same-origin requests; never cache Supabase or other third parties.
  if (url.origin !== self.location.origin) return false
  // API responses and auth flows are dynamic and may contain sensitive data.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return false
  return true
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    const offline = await caches.match(OFFLINE_URL)
    if (offline) return offline
    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => undefined)
  if (cached) {
    // Refresh the cache entry in the background.
    await network
    return cached
  }
  const response = await network
  if (response) return response
  throw new Error(`Failed to fetch ${request.url} and no cached copy exists`)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (!shouldHandle(request, url)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})
