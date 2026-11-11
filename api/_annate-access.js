// api/_annate-access.js — chi può usare quale annata DENTRO la propria società.
//
// Il controllo di società (annata di un'altra società → 403) sta nel gate di
// api/data.js. Questo modulo aggiunge il livello sotto: un allenatore a cui
// l'admin ha assegnato solo "Under 15" non deve poter leggere o scrivere
// "Under 17" chiamando il server a mano. Prima il filtro era solo nel client
// (public/auth-multi-annata.js, loadUserAnnate).
//
// Le annate assegnate si leggono dal record utente a ogni richiesta, non dalla
// sessione: così una modifica dell'admin vale subito, senza far rientrare
// l'utente, e le sessioni create prima di questo controllo funzionano uguale.

// Ruoli che lavorano su TUTTE le annate della società:
//   admin                        gestisce la società
//   coach_l0, direttivo,         entrano nella Dashboard, che somma atleti,
//   dirigente, staff             multe e iscrizioni di tutte le annate
// Nella sessione c'è il ruolo ORIGINALE (direttivo/dirigente/staff), non quello
// rimappato dal client (societa_l1/dirigente_l3/societa_l3).
const RUOLI_TUTTE_LE_ANNATE = new Set(['admin', 'coachl0', 'direttivo', 'dirigente', 'staff']);

function normalizza(role) {
  return String(role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function ruoloVedeTutteLeAnnate(role) {
  return RUOLI_TUTTE_LE_ANNATE.has(normalizza(role));
}

// Annate assegnate all'utente (array di id come stringhe), oppure null se
// l'utente non esiste più.
export async function annateUtente(kv, username) {
  const nome = String(username || '').trim();
  if (!nome) return null;
  const lower = nome.toLowerCase();
  let user = await kv.get(`auth:user:${lower}`);
  if (!user || String(user.username || '').trim().toLowerCase() !== lower) {
    const users = (await kv.get('auth:users')) || [];
    user = (Array.isArray(users) ? users : []).find(u => String(u && u.username || '').trim().toLowerCase() === lower) || null;
  }
  if (!user) return null;
  return (Array.isArray(user.annate) ? user.annate : []).map(String);
}

// true se la sessione può lavorare sull'annata indicata. Non controlla la
// società: quello lo fa già il chiamante.
export async function puoUsareAnnata(kv, session, annataId) {
  if (!session || !session.isAuthenticated) return false;
  if (ruoloVedeTutteLeAnnate(session.role)) return true;
  const assegnate = await annateUtente(kv, session.username);
  if (!assegnate) return false;
  return assegnate.includes(String(annataId));
}

// Riduce un elenco di annate (già filtrato per società) a quelle dell'utente.
export async function filtraAnnatePerUtente(kv, session, annate) {
  const lista = Array.isArray(annate) ? annate : [];
  if (ruoloVedeTutteLeAnnate(session && session.role)) return lista;
  const assegnate = await annateUtente(kv, session && session.username);
  if (!assegnate) return [];
  return lista.filter(a => assegnate.includes(String(a.id)));
}
