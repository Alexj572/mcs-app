// MCS App — Service Worker v1.2
const CACHE_NAME = 'mcs-app-v1';
const FIREBASE_HOSTS = ['firestore.googleapis.com','firebasestorage.googleapis.com','identitytoolkit.googleapis.com'];

// Ressources à mettre en cache immédiatement
const STATIC_ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js',
];

// ── Installation : mise en cache des assets statiques ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// ── Activation : nettoyage anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch : stratégie selon la ressource ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase API → Network first, pas de cache (données temps réel)
  if (FIREBASE_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({error:'offline'}), {
          status: 503,
          headers: {'Content-Type':'application/json'}
        })
      )
    );
    return;
  }

  // Assets statiques → Cache first, puis réseau
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Mettre en cache seulement les réponses valides
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback : retourner index.html pour les pages
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── Sync en arrière-plan (quand connexion revient) ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-fiches') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // La synchronisation est gérée par Firebase SDK (mode hors-ligne natif)
  console.log('[SW] Synchronisation des données en attente...');
}

// ── Message depuis l'app ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
