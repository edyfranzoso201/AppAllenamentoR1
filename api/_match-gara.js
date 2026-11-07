// Funzioni pure per i dati di Andamento Gara salvati in Risultati.
// Il file inizia con "_" come _sa-auth.js: Vercel non ne fa una funzione
// (limite 12 del piano Hobby), la importa solo api/data.js.
// Test: node scripts/test-match-gara.mjs
//
// Sicurezza prototipo: i dati arrivano da JSON di un telefono o di un PC.
// Ogni lettura di chiave passa da own() (hasOwnProperty), mai da `in` o da
// `x[k] || {}`: con un id "toString" si leggerebbe la funzione ereditata.
// VIETATE e' un Set di stringhe: un letterale { '__proto__': 1 } non crea la
// chiave, imposta il prototipo, e come tabella di ricerca non funzionerebbe.

const VIETATE = new Set(['__proto__', 'constructor', 'prototype']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const get = (o, k) => (own(o, k) ? o[k] : undefined);
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (v, max = 64) => String(v == null ? '' : v).trim().slice(0, max);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const lista = (a, max, fn) => (Array.isArray(a) ? a.slice(0, max).map(fn).filter(Boolean) : []);
const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// Limiti di forma della patch dei Risultati (il POST generico la riceve da
// qualunque client autenticato). Una squadra vera ha decine di partite con
// una dozzina di campi: oltre questi numeri non e' un uso normale.
const MAX_PATCH_BYTES = 300000;
const MAX_PATCH_ID = 500;
const MAX_PATCH_CAMPI = 60;

// true se la patch serializzata supera 300000 caratteri: data.js risponde
// 413 prima ancora di leggerla.
export function patchTroppoGrande(patch) {
  try { return JSON.stringify(patch === undefined ? null : patch).length > MAX_PATCH_BYTES; }
  catch (e) { return true; } // non serializzabile (cicli): non e' JSON arrivato da un client
}

// true se la patch ha piu' di 500 partite o una partita con piu' di 60
// campi. applyMatchPatch in quel caso la RIFIUTA INTERA (cur invariato):
// applicarne solo un pezzo lascerebbe i Risultati a meta' fra due stati.
export function patchOltreLimiti(patch) {
  if (!isObj(patch)) return false;
  const ids = Object.keys(patch);
  if (ids.length > MAX_PATCH_ID) return true;
  return ids.some(id => isObj(patch[id]) && Object.keys(patch[id]).length > MAX_PATCH_CAMPI);
}

// Data valida per creare una partita: stessa regola del client.
const dataValida = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// Differenza { id: null | { campo: valore | null } } dei Risultati.
// Speculare a applyMatchPatch in public/gara/gara-risultati.js: stessa
// semantica (il test lo verifica confrontando i due risultati) per patch
// nei limiti e senza campo `gara`. Solo qui sul server:
//  - patch oltre i limiti (patchOltreLimiti) rifiutata intera;
//  - il campo `gara` passa da sanificaDatiGara: il POST generico non deve
//    essere una via per scrivere nel blocco gara dati non controllati.
export function applyMatchPatch(cur, patch) {
  if (!isObj(patch) || patchOltreLimiti(patch)) return cur;
  for (const id of Object.keys(patch)) {
    if (VIETATE.has(id) || id.length > 100) continue;
    const v = patch[id];
    if (v === null) { delete cur[id]; continue; }
    if (!isObj(v)) continue;
    // Una partita che qui non c'e' si crea solo se la patch e' una partita
    // intera (ha una data AAAA-MM-GG): altrimenti e' il residuo di una
    // partita eliminata da un altro dispositivo, e resusciterla ne farebbe
    // un rottame.
    if (!isObj(get(cur, id))) {
      if (!dataValida(get(v, 'date'))) continue;
      cur[id] = {};
    }
    const m = cur[id];
    for (const f of Object.keys(v)) {
      if (VIETATE.has(f)) continue;
      if (v[f] === null) { delete m[f]; continue; }
      if (f === 'gara') {
        const s = sanificaDatiGara({ gara: v[f] });
        if (!s) continue; // gara non oggetto: il valore sul server resta
        // salvataDa lo mette applicaGara; correggendo dal PC si conserva
        const da = isObj(v[f]) ? str(get(v[f], 'salvataDa')) : '';
        if (da) s.gara.salvataDa = da;
        m.gara = s.gara;
        continue;
      }
      m[f] = clone(v[f]);
    }
  }
  return cur;
}

// Posizione dell'evento nella cronologia della gara (vedi tempoEvento nel
// client): rimette in ordine cambi ed espulsioni, che sono liste separate.
// Solo interi >= 0; altrimenti si toglie e Risultati usa l'ordine di ripiego.
function ordValido(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, 10000) : null;
}

function tempo(x) {
  const o = {
    min: Math.max(0, Math.min(999, Math.round(num(get(x, 'min')) || 0))),
    minuto: str(get(x, 'minuto'), 12),
    periodo: Math.max(1, Math.min(6, Math.round(num(get(x, 'periodo')) || 1)))
  };
  if (get(x, 'intervallo') === true) o.intervallo = true;
  const sv = get(x, 'sec');
  const s = sv == null || sv === '' ? null : num(sv);
  if (s != null && s >= 0) o.sec = Math.min(s, 36000);
  const ord = ordValido(get(x, 'ord'));
  if (ord != null) o.ord = ord;
  return o;
}

// Dati mandati dalla gara: si tiene solo cio' che si conosce, con limiti di
// lunghezza (il corpo arriva da un telefono, non ci si fida della forma).
// null se manca il blocco gara.
export function sanificaDatiGara(d) {
  if (!isObj(d) || !isObj(get(d, 'gara'))) return null;
  const g = d.gara;
  const t = isObj(get(g, 'tempi')) ? g.tempi : {};
  const dt = {};
  const durate = get(t, 'durateTempi');
  if (isObj(durate)) {
    for (const k of Object.keys(durate)) {
      if (!/^[1-6]$/.test(k)) continue;
      const v = num(durate[k]);
      if (v != null && v >= 0) dt[k] = Math.min(v, 36000);
    }
  }
  // null e '' = punteggio non scritto (Number li farebbe diventare 0)
  const gol = v => {
    if (v == null || v === '') return null;
    const n = num(v);
    return n == null ? null : Math.max(0, Math.min(99, Math.round(n)));
  };
  const id = x => (x != null && typeof x !== 'object' && str(x) ? str(x) : null);
  return {
    homeScore: gol(get(d, 'homeScore')),
    awayScore: gol(get(d, 'awayScore')),
    scorers: lista(get(d, 'scorers'), 100, x => (isObj(x) && id(get(x, 'athleteId'))
      ? { athleteId: id(x.athleteId), minute: str(get(x, 'minute'), 4) } : null)),
    cards: lista(get(d, 'cards'), 100, x => {
      if (!isObj(x) || !id(get(x, 'athleteId'))) return null;
      const type = get(x, 'type');
      if (type !== 'yellow' && type !== 'red') return null;
      return { athleteId: id(x.athleteId), type, minute: str(get(x, 'minute'), 4) };
    }),
    gara: {
      convocati: lista(get(g, 'convocati'), 60, id),
      titolari: lista(get(g, 'titolari'), 30, id),
      cambi: lista(get(g, 'cambi'), 100, x => (isObj(x) && (id(get(x, 'esce')) || id(get(x, 'entra')))
        ? Object.assign({ esce: id(get(x, 'esce')) || '', entra: id(get(x, 'entra')) || '' }, tempo(x)) : null)),
      espulsioni: lista(get(g, 'espulsioni'), 30, x => (isObj(x) && id(get(x, 'athleteId'))
        ? Object.assign({ athleteId: id(x.athleteId) }, tempo(x)) : null)),
      tempi: {
        numero: Math.max(1, Math.min(4, Math.round(num(get(t, 'numero')) || 2))),
        durata: Math.max(1, Math.min(90, Math.round(num(get(t, 'durata')) || 45))),
        durateTempi: dt
      },
      salvataIl: str(get(g, 'salvataIl'), 40),
      incompleta: get(g, 'incompleta') === true
    }
  };
}

// Partita nuova creata dalla gara (gara fuori calendario). null se mancano
// data o avversario: senza, in Risultati sarebbe una riga muta.
export function sanificaNuova(n) {
  if (!isObj(n)) return null;
  const date = str(get(n, 'date'), 10);
  const opponentName = str(get(n, 'opponentName'), 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !opponentName) return null;
  const time = /^\d{1,2}:\d{2}$/.test(str(get(n, 'time'), 5)) ? str(get(n, 'time'), 5) : '';
  return { date, time, venue: str(get(n, 'venue'), 120), opponentName, location: get(n, 'location') === 'away' ? 'away' : 'home' };
}

// La gara sovrascrive punteggio, marcatori, cartellini e il blocco gara;
// tutto il resto (assist, data, avversario, campi futuri) resta com'e'.
// `dati` deve venire da sanificaDatiGara.
export function applicaGara(match, dati, chi) {
  const assists = get(match, 'assists');
  return Object.assign({}, match, {
    homeScore: dati.homeScore,
    awayScore: dati.awayScore,
    scorers: clone(dati.scorers),
    cards: clone(dati.cards),
    assists: Array.isArray(assists) ? assists : [],
    gara: Object.assign(clone(dati.gara), { salvataDa: str(chi) })
  });
}

// GDPR art. 17: toglie l'atleta dal blocco gara di una partita. Un cambio
// rimasto senza chi esce ne' chi entra non dice piu' niente e sparisce;
// righe non oggetto (dati rotti) si tolgono senza far crollare il purge.
// true se ha cambiato qualcosa.
export function purgeGaraAtleta(m, aid) {
  const g = isObj(m) ? get(m, 'gara') : undefined;
  if (!isObj(g)) return false;
  aid = String(aid);
  let dirty = false;
  for (const k of ['convocati', 'titolari']) {
    const l = get(g, k);
    if (!Array.isArray(l)) continue;
    g[k] = l.filter(x => String(x) !== aid);
    if (g[k].length !== l.length) dirty = true;
  }
  const esp = get(g, 'espulsioni');
  if (Array.isArray(esp)) {
    g.espulsioni = esp.filter(e => isObj(e) && String(e.athleteId) !== aid);
    if (g.espulsioni.length !== esp.length) dirty = true;
  }
  const cambi = get(g, 'cambi');
  if (Array.isArray(cambi)) {
    const rimasti = [];
    for (const c of cambi) {
      if (!isObj(c)) { dirty = true; continue; }
      if (String(c.esce) === aid) { c.esce = ''; dirty = true; }
      if (String(c.entra) === aid) { c.entra = ''; dirty = true; }
      if (c.esce || c.entra) rimasti.push(c);
      else dirty = true;
    }
    g.cambi = rimasti;
  }
  return dirty;
}
