// api/_sa-auth.js — verifica CONDIVISA della chiave superadmin.
// Usato da data.js, auth/manage.js, licenze.js per evitare logica duplicata e
// per centralizzare due protezioni:
//   1) confronto TIMING-SAFE (crypto.timingSafeEqual) invece di === , così non
//      si può dedurre la chiave misurando i tempi di risposta;
//   2) RATE-LIMIT su Redis (condiviso tra tutte le funzioni serverless, che non
//      condividono memoria): dopo troppi tentativi falliti da uno stesso IP il
//      controllo viene bloccato per una finestra, rendendo impraticabile il
//      brute-force della chiave che sblocca l'export/restore dell'intero DB.
//
// Il file ha prefisso "_" così Vercel NON lo espone come endpoint.
import crypto from 'crypto';

const SA_RL_MAX = 8;              // tentativi falliti prima del blocco
const SA_RL_WINDOW_SEC = 15 * 60; // durata blocco: 15 minuti

// Confronto timing-safe di due stringhe. Ritorna false se lunghezze diverse
// (senza rivelare la lunghezza tramite timing: si confronta comunque un buffer).
function timingSafeStrEq(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// Verifica la chiave superadmin fornita nell'header (x-sa-key o
// x-super-admin-password) contro SUPER_ADMIN_PASSWORD, con rate-limit per IP.
//
// Ritorna un oggetto:
//   { ok: true }                       → chiave corretta
//   { ok: false, blocked: true, retryAfterMin } → troppi tentativi, bloccato
//   { ok: false, reason: 'not-set' }   → env var non configurata
//   { ok: false, reason: 'wrong' }     → chiave errata (tentativo conteggiato)
//
// `kv` è il client Redis del chiamante (già inizializzato in ogni file).
// `extraKey` (opz.) è un valore chiave alternativo da controllare oltre agli
// header — usato da licenze.js che accetta la chiave anche nel body della richiesta.
export async function verifySuperAdmin(req, kv, extraKey) {
  const provided = String(
    req.headers['x-sa-key'] || req.headers['x-super-admin-password'] || extraKey || ''
  ).trim();
  const expected = String(process.env.SUPER_ADMIN_PASSWORD || '').trim();

  if (!expected) return { ok: false, reason: 'not-set' };

  const rlKey = `rl:sa:${clientIp(req)}`;

  // Controlla blocco attivo PRIMA di confrontare (così un IP bloccato non può
  // continuare a testare chiavi nemmeno con timing).
  let rl = null;
  try { rl = await kv.get(rlKey); } catch { /* se Redis non risponde, non blocchiamo */ }
  if (rl && rl.attempts >= SA_RL_MAX) {
    const remainingMs = (rl.resetAt || 0) - Date.now();
    if (remainingMs > 0) {
      return { ok: false, blocked: true, retryAfterMin: Math.ceil(remainingMs / 60000) };
    }
    // Blocco scaduto: azzera
    try { await kv.del(rlKey); } catch { /* non bloccante */ }
  }

  if (timingSafeStrEq(provided, expected)) {
    // Successo: azzera il contatore
    try { await kv.del(rlKey); } catch { /* non bloccante */ }
    return { ok: true };
  }

  // Fallimento: incrementa il contatore con TTL
  try {
    const existing = (await kv.get(rlKey)) || { attempts: 0, resetAt: 0 };
    const attempts = existing.attempts + 1;
    const resetAt = attempts >= SA_RL_MAX ? Date.now() + SA_RL_WINDOW_SEC * 1000 : existing.resetAt;
    await kv.set(rlKey, { attempts, resetAt });
    await kv.expire(rlKey, SA_RL_WINDOW_SEC + 60);
  } catch { /* non bloccante */ }

  return { ok: false, reason: 'wrong' };
}
