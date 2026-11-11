// api/auth/_login-ratelimit.js — limiti sui tentativi di login falliti.
//
// Prima c'era un solo contatore per username: bastavano 5 password sbagliate
// da qualsiasi parte del mondo per bloccare l'account di un altro per 15
// minuti, e chi provava username diversi non veniva mai fermato.
// Ora i contatori sono tre:
//   utente+IP  5 errori  → blocca quell'utente SOLO da quell'indirizzo
//   IP        30 errori  → blocca l'indirizzo, qualunque username provi
//   utente    50 errori  → argine contro chi prova da tanti indirizzi insieme
//                          (per arrivarci servono almeno 10 indirizzi diversi)
// Ogni blocco dura 15 minuti.

export const RL_LOGIN = {
  MAX_UTENTE_IP: 5,
  MAX_IP: 30,
  MAX_UTENTE: 50,
  WINDOW_SEC: 15 * 60,
};

// Su Vercel x-real-ip e il primo valore di x-forwarded-for sono impostati
// dalla piattaforma, non dal client.
export function ipDi(req) {
  const h = (req && req.headers) || {};
  const ip = String(h['x-real-ip'] || '').trim() || String(h['x-forwarded-for'] || '').split(',')[0].trim();
  return (ip || 'noip').slice(0, 64);
}

export function chiaviLogin(username, ip) {
  const u = String(username || '').trim().toLowerCase().slice(0, 100);
  return {
    utenteIp: `ratelimit:login:${u}|${ip}`,
    ip: `ratelimit:loginip:${ip}`,
    utente: `ratelimit:loginuser:${u}`,
  };
}

// Minuti di blocco residui su una chiave (0 = non bloccata). Un blocco scaduto
// viene cancellato, così il conteggio riparte da zero.
async function minutiBlocco(kv, key, max) {
  const d = await kv.get(key);
  if (!d || !(d.attempts >= max)) return 0;
  const ms = Number(d.resetAt || 0) - Date.now();
  if (ms > 0) return Math.ceil(ms / 60000);
  await kv.del(key);
  return 0;
}

async function incrementa(kv, key, max) {
  const d = (await kv.get(key)) || { attempts: 0, resetAt: 0 };
  const attempts = (Number(d.attempts) || 0) + 1;
  const resetAt = attempts >= max ? Date.now() + RL_LOGIN.WINDOW_SEC * 1000 : (d.resetAt || 0);
  await kv.set(key, { attempts, resetAt });
  await kv.expire(key, RL_LOGIN.WINDOW_SEC + 60);
  return attempts;
}

// { bloccato:false } oppure { bloccato:true, minuti, motivo:'ip'|'utenteIp'|'utente' }
export async function statoBloccoLogin(kv, username, ip) {
  const k = chiaviLogin(username, ip);
  let m = await minutiBlocco(kv, k.ip, RL_LOGIN.MAX_IP);
  if (m) return { bloccato: true, minuti: m, motivo: 'ip' };
  m = await minutiBlocco(kv, k.utenteIp, RL_LOGIN.MAX_UTENTE_IP);
  if (m) return { bloccato: true, minuti: m, motivo: 'utenteIp' };
  m = await minutiBlocco(kv, k.utente, RL_LOGIN.MAX_UTENTE);
  if (m) return { bloccato: true, minuti: m, motivo: 'utente' };
  return { bloccato: false };
}

// Registra un login fallito sui tre contatori. Restituisce i tentativi che
// restano a quell'utente da quell'indirizzo prima del blocco.
export async function registraLoginFallito(kv, username, ip) {
  const k = chiaviLogin(username, ip);
  const n = await incrementa(kv, k.utenteIp, RL_LOGIN.MAX_UTENTE_IP);
  await incrementa(kv, k.ip, RL_LOGIN.MAX_IP);
  await incrementa(kv, k.utente, RL_LOGIN.MAX_UTENTE);
  return Math.max(0, RL_LOGIN.MAX_UTENTE_IP - n);
}

// Login riuscito: azzera i contatori di QUELL'utente. Quello dell'indirizzo
// resta: un account valido non deve servire a ripulire l'IP di chi nel
// frattempo sta provando password su altri account.
export async function azzeraLoginRiuscito(kv, username, ip) {
  const k = chiaviLogin(username, ip);
  await kv.del(k.utenteIp);
  await kv.del(k.utente);
}
