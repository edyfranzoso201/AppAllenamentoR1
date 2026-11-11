// api/_registrations-genitore.js — pulizia del blocco `genitore` inviato dal
// modulo d'iscrizione pubblico (api/registrations.js, action=submit).
//
// L'endpoint non richiede login: senza questo filtro chi invia la richiesta a
// mano poteva salvare nel blocco `genitore` campi inventati e testi di
// qualunque dimensione, che all'accettazione finiscono nella scheda atleta.
// Qui passano SOLO i sei campi che il modulo (public/register.html) compila,
// ciascuno come testo e con lo stesso tetto dei campi dell'atleta.
//
// File con prefisso `_`: Vercel non lo conta come funzione (limite Hobby 12).

export const CAMPI_GENITORE = ['nome', 'cognome', 'cellulare', 'email', 'codiceFiscale', 'indirizzo'];

// Ritorna { ok: true, genitore } con il blocco ripulito, oppure
// { ok: false, campo } col nome del primo campo oltre il limite.
export function pulisciGenitore(input, maxTesto = 80) {
  const src = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const genitore = {};
  for (const campo of CAMPI_GENITORE) {
    const v = src[campo];
    // Solo testo (o numero, es. un cellulare inviato come numero): oggetti,
    // array e booleani diventano stringa vuota invece di entrare in database.
    const testo = (typeof v === 'string' || typeof v === 'number') ? String(v).trim() : '';
    if (testo.length > maxTesto) return { ok: false, campo };
    genitore[campo] = testo;
  }
  return { ok: true, genitore };
}
