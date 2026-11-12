// Service Worker for Nadezhi Match-3 (100% Offline Support)
const CACHE_NAME = '__NADEZHI_CACHE_VERSION__';

// Tier 1: Core shell + all emotes + initial biome (fast, atomic install)
const CORE_PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/fantasy_plains.jpg',
  '/emotes/1092636199253975181.webp',
  '/emotes/1092636222695931984.webp',
  '/emotes/1103355444124209192.webp',
  '/emotes/1103355458179309619.webp',
  '/emotes/1115037240410775582.webp',
  '/emotes/1115076404074262648.webp',
  '/emotes/1115081802701357156.webp',
  '/emotes/1115115603628392578.webp',
  '/emotes/1142187365251686491.webp',
  '/emotes/1149873066608951326.webp',
  '/emotes/1149873070371254272.webp',
  '/emotes/1149873071902171167.webp',
  '/emotes/1150642794990403594.webp',
  '/emotes/1183152273665302528.webp',
  '/emotes/1183152278698479656.webp',
  '/emotes/1186866512364052501.webp',
  '/emotes/1187942067087884298.webp',
  '/emotes/1187942067784130670.webp',
  '/emotes/1217259343351779458.webp',
  '/emotes/1258498543916683327.webp',
  '/emotes/1290811068268154910.webp',
  '/emotes/1290841162990485514.webp',
  '/emotes/1536895945659256975.webp',
  '/emotes/1536895948179898388.webp',
  '/emotes/1536895949144592514.webp',
  '/emotes/1536895949941637201.webp',
  '/emotes/1536895951950577814.webp',
  '/emotes/1536895952793636944.webp',
  '/emotes/1536895953632632842.webp',
  '/emotes/1536895956312653894.webp',
  '/emotes/1536895957143130132.webp',
  '/emotes/1536895958007283712.webp',
  '/emotes/1536895958728835182.webp',
  '/emotes/1536895959777284196.webp',
  '/emotes/1536895960461086830.webp',
  /* __BUILD_ASSETS__ */
];

// Tier 2: Progressive background warm-cache (all remaining biome backgrounds & music tracks)
const WARM_CACHE_ASSETS = [
  '/fantasy_sunset.jpg',
  '/fantasy_cavern.jpg',
  '/fantasy_night.jpg',
  '/fantasy_volcano.jpg',
  '/fantasy_erebor.jpg',
  '/fantasy_numenor.jpg',
  '/fantasy_pixie.jpg',
  '/fantasy_neverland.jpg',
  '/fantasy_vesubio.jpg',
  '/fantasy_infinite.jpg',
  '/fantasy_bgm.mp3',
  '/music_minstrel.mp3',
  '/music_celtic.mp3',
  '/music_village.mp3',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each core asset individually so a single transient glitch doesn't abort everything
      await Promise.allSettled(
        CORE_PRECACHE_ASSETS.map(async (url) => {
          try {
            const req = new Request(url, { cache: 'reload' });
            const res = await fetch(req);
            if (res && res.ok) {
              await cache.put(url, res);
            }
          } catch {}
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old cache versions
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );

      await self.clients.claim();

      // Warm-cache remaining backgrounds and BGM tracks in the background without blocking startup
      try {
        const cache = await caches.open(CACHE_NAME);
        for (const url of WARM_CACHE_ASSETS) {
          const existing = await cache.match(url);
          if (!existing) {
            try {
              const res = await fetch(url);
              if (res && res.ok) {
                await cache.put(url, res);
              }
            } catch {}
          }
        }
      } catch {}
    })()
  );
});

/**
 * Serves HTTP Range requests (206 Partial Content) from a cached full response.
 * Essential for iOS Safari & mobile browsers playing cached <audio> (.mp3) offline.
 */
async function handleRangeRequest(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader || !cachedResponse) {
    return cachedResponse;
  }

  try {
    const arrayBuffer = await cachedResponse.arrayBuffer();
    const bytes = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader);
    if (!bytes) {
      return cachedResponse;
    }

    const total = arrayBuffer.byteLength;
    const start = Number(bytes[1]);
    const end = bytes[2] ? Math.min(Number(bytes[2]), total - 1) : total - 1;

    if (isNaN(start) || isNaN(end) || start > end || start < 0 || start >= total) {
      return new Response(null, {
        status: 416,
        statusText: 'Range Not Satisfiable',
        headers: { 'Content-Range': `bytes */${total}` },
      });
    }

    const slicedBuffer = arrayBuffer.slice(start, end + 1);
    const headers = new Headers(cachedResponse.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', String(slicedBuffer.byteLength));
    headers.set('Accept-Ranges', 'bytes');

    return new Response(slicedBuffer, {
      status: 206,
      statusText: 'Partial Content',
      headers,
    });
  } catch {
    return cachedResponse;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only intercept same-origin requests (let external APIs like decapi.me fail naturally when offline)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. HTML Navigation requests: Network-first with immediate fallback to cached /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put('/index.html', networkResponse.clone());
            return networkResponse;
          }
        } catch {}

        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = (await cache.match('/index.html')) || (await cache.match('/'));
        if (cachedIndex) return cachedIndex;

        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })()
    );
    return;
  }

  // 2. Static assets (JS, CSS, WebP, JPG, PNG, MP3, WebManifest): Cache-first with runtime caching fallback
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(url.pathname) || await cache.match(request);

      if (cachedResponse) {
        if (request.headers.has('range')) {
          return handleRangeRequest(request, cachedResponse);
        }
        return cachedResponse;
      }

      try {
        // Fetch full asset (without range header so we can store the complete file in cache)
        const fetchReq = request.headers.has('range') ? new Request(url.pathname) : request;
        const networkResponse = await fetch(fetchReq);
        if (networkResponse && networkResponse.status === 200) {
          await cache.put(url.pathname, networkResponse.clone());
          if (request.headers.has('range')) {
            return handleRangeRequest(request, networkResponse);
          }
        }
        return networkResponse;
      } catch {
        // Final fallback for root path
        if (url.pathname === '/' || url.pathname === '/index.html') {
          const fallback = await cache.match('/index.html');
          if (fallback) return fallback;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })()
  );
});
