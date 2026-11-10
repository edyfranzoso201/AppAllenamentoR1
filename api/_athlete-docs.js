// api/_athlete-docs.js — documenti caricati dai genitori (link Drive).
//
// Il genitore non ha login: scrive col solo link dell'annata. Prima il ramo
// accettava qualunque cosa da un anonimo: più atleti in una richiesta, atleti
// inesistenti, chiavi qualsiasi. Con una sola chiamata si potevano cancellare
// i documenti di tutta l'annata. Ora un anonimo:
//   - tocca UN solo atleta per richiesta, e deve esistere nell'annata;
//   - usa solo i tipi di documento previsti dalla pagina genitori;
//   - passa dalla pulizia di url e testi (niente javascript:, niente markup).
// Il numero di richieste è limitato per IP nel chiamante (api/data.js).
// Lo staff (sessione valida) non ha questi vincoli.
//
// Il file ha prefisso "_" così Vercel NON lo espone come endpoint.

// Deve combaciare con _DOC_TYPES in public/calendario-standalone.js.
export const TIPI_DOC_GENITORE = [
  'certificato', 'iscrizione', 'scarico', 'liberatoria',
  'generico1', 'generico2', 'generico3', 'generico4', 'generico5', 'generico6'
];

const pulisci = s => String(s == null ? '' : s).replace(/[<>"'`]/g, '').slice(0, 500);

// Applica `incoming` ({ atletaId: { tipo: doc | null } }) a `existing` (modificato
// sul posto). Ritorna { ok:true } oppure { ok:false, status, message }: in caso
// di errore il chiamante NON deve salvare.
export function applicaAthleteDocs(existing, incoming, { anonimo, athletes }) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { ok: false, status: 400, message: 'Dati documento non validi' };
  }
  const atleti = Object.keys(incoming);
  if (anonimo) {
    if (atleti.length !== 1) {
      return { ok: false, status: 400, message: 'Un solo atleta per richiesta' };
    }
    const esiste = (athletes || []).some(a => a && String(a.id) === atleti[0]);
    if (!esiste) {
      return { ok: false, status: 404, message: 'Atleta non trovato' };
    }
  }
  for (const athleteId of atleti) {
    const inc = incoming[athleteId] || {};
    if (typeof inc !== 'object' || Array.isArray(inc)) {
      return { ok: false, status: 400, message: 'Dati documento non validi' };
    }
    const current = existing[athleteId] || {};
    for (const docKey of Object.keys(inc)) {
      if (anonimo && !TIPI_DOC_GENITORE.includes(docKey)) {
        return { ok: false, status: 400, message: 'Tipo di documento non valido' };
      }
      if (inc[docKey] === null) {
        delete current[docKey];
      } else if (anonimo) {
        // La pagina staff (calendario.html) mette url e nota in innerHTML/href.
        // Solo link https senza virgolette né markup, campi testo senza < >.
        const d = inc[docKey];
        let url = (d && typeof d === 'object') ? String(d.url || '').trim() : '';
        if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url; // "drive.google.com/..." incollato senza schema
        if (Array.isArray(d) || url.length > 2000 || !/^https?:\/\/[^\s"'<>`]+$/i.test(url)) {
          return { ok: false, status: 400, message: 'Link documento non valido: deve iniziare con https://' };
        }
        current[docKey] = {
          url,
          nota: pulisci(d.nota),
          uploadedAt: pulisci(d.uploadedAt).slice(0, 40),
          uploadedBy: pulisci(d.uploadedBy).slice(0, 40),
        };
      } else {
        current[docKey] = inc[docKey];
      }
    }
    if (Object.keys(current).length === 0) delete existing[athleteId];
    else existing[athleteId] = current;
  }
  return { ok: true };
}
