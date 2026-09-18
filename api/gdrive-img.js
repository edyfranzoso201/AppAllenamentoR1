// api/gdrive-img.js
// Proxy per immagini Google Drive — aggira i blocchi CORS del browser.
//
// Perche non chiede il login: questo endpoint viene invocato dal browser come
// `<img src="/api/gdrive-img?id=...">`, e un tag <img> NON invia header, quindi
// non puo mandare x-auth-session. Pretendere la sessione romperebbe tutte le
// foto dell'inventario. Al posto dell'autenticazione l'endpoint e reso
// innocuo: accetta solo richieste che partono dall'app, ha un tetto di
// dimensione e non reindirizza piu verso Google.
//
// Cosa impediva l'abuso prima: niente. Era un proxy aperto a chiunque,
// senza limite di banda, che scaricava per intero in memoria qualsiasi file
// e in caso di fallimento restituiva un 302 verso drive.google.com.

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB: una foto di inventario sta largamente sotto
const TIMEOUT_MS = 8000;           // oltre questo, Google non sta rispondendo

// Domini da cui l'app puo essere servita. Il confronto e sull'host ESATTO:
// un `endsWith` lascerebbe passare 'app-allenamento-r1.vercel.app.cattivo.example'.
function originConsentito(req) {
  const raw = req.headers['origin'] || req.headers['referer'] || '';
  if (!raw) return false; // hotlink diretto o curl: niente foto
  let host;
  try { host = new URL(raw).hostname.toLowerCase(); } catch { return false; }
  if (host === 'localhost' || host === '127.0.0.1') return true;      // sviluppo
  if (host === 'app-allenamento-r1.vercel.app') return true;          // produzione
  if (/^app-allenamento-r1-[a-z0-9-]+\.vercel\.app$/.test(host)) return true; // preview Vercel
  // Dominio personalizzato dell'app, se configurato.
  const proprio = String(process.env.APP_HOST || '').toLowerCase().trim();
  if (proprio && host === proprio) return true;
  return false;
}

export default async function handler(req, res) {
    const { id } = req.query;

    if (!id || typeof id !== 'string' || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(400).json({ error: 'ID non valido' });
    }

    if (!originConsentito(req)) {
        return res.status(403).json({ error: 'Accesso consentito solo dall\'applicazione' });
    }

    const urls = [
        `https://drive.google.com/uc?export=view&id=${id}`,
        `https://lh3.googleusercontent.com/d/${id}`,
    ];

    for (const url of urls) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://drive.google.com' },
                redirect: 'follow',
                signal: ac.signal,
            });

            if (!response.ok) continue;

            const contentType = response.headers.get('content-type') || 'image/jpeg';
            // Solo immagini. Se Drive ritorna HTML, il file non e condiviso:
            // prima quella pagina veniva scartata ma si finiva sul redirect.
            if (!contentType.startsWith('image/')) continue;

            // Primo filtro: la dimensione DICHIARATA. Evita di scaricare.
            const dichiarata = parseInt(response.headers.get('content-length') || '', 10);
            if (Number.isFinite(dichiarata) && dichiarata > MAX_BYTES) continue;

            // Secondo filtro: la dimensione REALE. content-length puo mancare
            // o mentire, quindi il tetto va riverificato sul contenuto.
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength > MAX_BYTES) continue;

            res.setHeader('Content-Type', contentType);
            // 'private' e deliberato: con 'public' la CDN di Vercel serviva la
            // foto dalla propria cache SENZA eseguire la funzione, quindi il
            // controllo dell'origine veniva scavalcato e chiunque la otteneva
            // (verificato in produzione: X-Vercel-Cache HIT su richiesta senza
            // referer). Cosi la cache resta nel browser di chi ha gia superato
            // il controllo, e ogni nuovo richiedente ripassa dalla funzione.
            // Vary dichiara comunque che la risposta dipende dall'origine.
            res.setHeader('Cache-Control', 'private, max-age=86400'); // 24h, solo nel browser
            res.setHeader('Vary', 'Origin, Referer');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            return res.send(Buffer.from(buffer));
        } catch (e) {
            continue;
        } finally {
            clearTimeout(timer);
        }
    }

    // Niente redirect verso Google: rimandare il chiamante a drive.google.com
    // trasformava l'endpoint in un amplificatore di traffico verso terzi.
    return res.status(502).json({ error: 'Immagine non disponibile' });
}
