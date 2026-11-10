// api/auth/_sessions.js — revoca delle sessioni già aperte.
//
// La sessione (session:<token>) tiene in copia utente, ruolo e società e si
// rinnova a ogni chiamata (30 giorni scorrevoli). Senza revoca, un utente
// eliminato, declassato o a cui è stata cambiata la password restava dentro
// col vecchio ruolo finché continuava a usare l'app.
//
// Non esiste un indice utente → token, quindi si scorrono le chiavi session:*.
// È un'operazione rara (elimina utente, cambio ruolo, cambio password) su poche
// centinaia di chiavi: meglio questo di una lettura in più a OGNI richiesta.
//
// Il file ha prefisso "_" così Vercel NON lo espone come endpoint.

// Elimina le sessioni per cui match(sessione) è vero. `tranne` è il token da
// risparmiare (chi cambia la propria password resta collegato sul suo device).
// Ritorna quante ne ha eliminate.
export async function revocaSessioni(kv, match, { tranne = '' } = {}) {
  const keys = [];
  let cursor = 0;
  do {
    const [next, batch] = await kv.scan(cursor, { match: 'session:*', count: 200 });
    cursor = parseInt(next, 10) || 0;
    keys.push(...batch);
  } while (cursor !== 0);

  const risparmia = tranne ? `session:${tranne}` : '';
  let eliminate = 0;
  for (let i = 0; i < keys.length; i += 50) {
    const gruppo = keys.slice(i, i + 50);
    const valori = await kv.mget(...gruppo);
    for (let j = 0; j < gruppo.length; j++) {
      const sess = valori[j];
      if (!sess || typeof sess !== 'object' || gruppo[j] === risparmia) continue;
      let colpita = false;
      try { colpita = !!match(sess); } catch (e) { colpita = false; }
      if (colpita) { await kv.del(gruppo[j]); eliminate++; }
    }
  }
  return eliminate;
}

// Tutte le sessioni di un utente (username senza distinzione di maiuscole,
// come nei controlli di unicità di api/auth/manage.js).
export function revocaSessioniUtente(kv, username, opzioni) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return Promise.resolve(0);
  return revocaSessioni(kv, s => String(s.username || '').trim().toLowerCase() === u, opzioni);
}

// Tutte le sessioni di una società (società eliminata / demo scaduta).
export function revocaSessioniSocieta(kv, societyId) {
  const sid = String(societyId || '').trim();
  if (!sid) return Promise.resolve(0);
  return revocaSessioni(kv, s => String(s.societyId || '').trim() === sid);
}
