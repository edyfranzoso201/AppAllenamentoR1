// ═══════════════════════════════════════════════════════════════════════
//  Service worker di "Andamento Gara" — PWA installabile e offline.
//
//  Separato da /sw.js (che gestisce SOLO le push dell'app principale e non
//  ha nessuna cache): qui serve l'opposto, cioe' funzionare senza rete a
//  bordo campo. Lo scope e' ristretto a /gestione-gara.html, quindi questo
//  worker non intercetta nulla del resto dell'app.
// ═══════════════════════════════════════════════════════════════════════

// La versione va ALZATA a ogni modifica di gestione-gara.html. Senza questo,
// sullo smartphone la PWA continua a servire la pagina vecchia dalla cache: il
// worker si aggiorna (skipWaiting) ma la copia di /gestione-gara.html resta
// quella di prima, e la rete la sostituisce solo al giro successivo. Risultato
// gia' visto: fix deployato, desktop a posto, telefono ancora col bug.
const CACHE = 'gara-v4';

// Il PDF si genera con jsPDF preso dal CDN. Senza queste due voci in cache,
// "Genera PDF" fallirebbe proprio nel caso piu' probabile: campo senza rete,
// partita finita, resoconto da mandare alla redazione.
const PRECACHE = [
  '/gestione-gara.html',
  '/manifest-gara.json',
  '/favicon-gara.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      // addAll e' atomico: se un CDN e' irraggiungibile durante l'install
      // l'intera installazione fallisce e la PWA resta senza cache. Qui
      // ogni risorsa va per conto suo, cosi' la pagina viene comunque
      // salvata anche se una libreria non si scarica.
      await Promise.all(PRECACHE.map(url =>
        cache.add(new Request(url, { cache: 'reload', mode: 'no-cors' })).catch(() => {})
      ));
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('gara-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // /api/data NON va mai in cache: la rosa deve essere quella vera di
  // Gestione Squadra, e una risposta vecchia mostrerebbe atleti sbagliati
  // senza che nulla lo segnali. Offline la pagina gestisce il fallimento
  // da sola (avviso "Rosa non caricata") e usa i convocati gia' salvati.
  if (url.pathname.startsWith('/api/')) return;

  // La pagina stessa: prima la rete (per prendere gli aggiornamenti), con
  // ricaduta sulla copia in cache quando non c'e' campo.
  if (req.mode === 'navigate' || url.pathname === '/gestione-gara.html') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put('/gestione-gara.html', copia)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/gestione-gara.html'))
    );
    return;
  }

  // Tutto il resto (librerie PDF, icona, manifest): prima la cache, che e'
  // immediata e non dipende dalla rete.
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        }
        return res;
      });
    })
  );
});
