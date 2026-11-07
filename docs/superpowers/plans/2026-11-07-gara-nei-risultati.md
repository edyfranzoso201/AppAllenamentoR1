# Dati di Andamento Gara nei Risultati — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Andamento Gara salva la partita giocata (punteggio, marcatori,
cartellini, convocati, titolari, sostituzioni, durate dei tempi) dentro la
partita di Risultati, che la mostra e la lascia correggere nel pannello
"Modifica Risultato Partita". In Dati gara c'è anche la tendina "Prendi dal
calendario".

**Architecture:**
- **Calcoli puri (client):** un modulo UMD condiviso, `public/gara/gara-risultati.js`. Sta sotto `/gara/` perché il service worker della gara (scope `/gara/`) lo metta in cache offline. Contiene minutaggio, lettura dei minuti, elenco/ricerca partite, mappatura gara→Risultati, differenze e patch dei Risultati, e lo usano sia la gara sia l'app principale.
- **Server:** due modifiche.
  - L'azione `?action=match-gara` dentro `api/data.js` (limite di 12 funzioni del piano Hobby: niente file nuovi in `api/` che non inizino con `_`). Scrive **una sola** partita.
  - Il POST generico accetta `matchResultsPatch`: una differenza per partita e per campo, come `evaluationsPatch`. Senza questa patch un PC con i dati vecchi cancellerebbe la gara salvata dal telefono.
- **Funzioni server pure:** `api/_match-gara.js`, ESM come `api/_sa-auth.js`, testabili con node.

**Tech Stack:** JavaScript vanilla, Bootstrap 5 (app principale), PWA `/gara/`, Vercel serverless (ESM), Upstash KV, test con node (`scripts/test-*.mjs`) e Playwright (MCP) per la UI.

**Spec:** `docs/superpowers/specs/2026-11-07-gara-nei-risultati-design.md`

## Correzioni rispetto allo spec (decise in pianificazione)

1. **Nomi dei campi.** I dati esistenti di Risultati usano `minute` (non `min`) e i cartellini `type: 'yellow' | 'red'` (non `tipo`). La mappatura usa quindi:
   - marcatori: `scorers: [{athleteId, minute}]`
   - cartellini: `cards: [{athleteId, type, minute}]`
   - `minute` è una stringa di cifre ≥ 1, come la scrive il form.

   Il blocco nuovo `gara` usa invece il formato della gara (`min` numero assoluto, `minuto` etichetta, `periodo`, `intervallo`, `sec`), perché il minutaggio si calcola da quello.
2. **Patch per campo, non per partita.** `matchResultsPatch = { [id]: null | { [campo]: valore | null } }`:
   - `null` sulla partita la elimina;
   - `null` su un campo lo elimina;
   - una partita assente sul server si crea solo se la patch porta `date`, cioè è una partita nuova completa e non il residuo di una partita cancellata altrove.

   Così chi corregge il punteggio dal PC non tocca il campo `gara` salvato dal telefono.
3. **Durate dei tempi.** La gara salva in `gara.tempi.durateTempi` la durata **di tutti** i tempi 1..N, presa da `durataTempo(p)`: 0 per un tempo non ancora giocato, il cronometro per quello in corso. Se si salva a metà partita, Risultati non deve contare come giocati i tempi futuri.
4. **Funzione condivisa.** `minutaggio.js` dello spec diventa `public/gara/gara-risultati.js`, per la cache offline della gara.

## Convenzioni del repo (valgono per ogni task)

- Commenti in italiano; spiegare il *perché*, come il resto del codice.
- **Commit solo dei file del task** con `git commit -m "..." -- <file>`: nell'indice ci sono molti file non correlati già in stage (png, docs) che NON vanno committati. Mai `git add -A` né `git commit -a`.
- Ogni messaggio di commit termina con la riga vuota + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Mai `git push` né deploy** senza un "deploy" esplicito dell'utente.
- Il DB di produzione è in sola lettura: nessun test contro Redis vero.
- Percorso del repo per i comandi bash: `cd "/d/EDY/Go Calcio/Valutazione Atleti/Vercel/App-Allenatori_VR3/AppAllenamentoR1"`.

## File

| File | Stato | Responsabilità |
|------|-------|----------------|
| `public/gara/gara-risultati.js` | nuovo | Funzioni pure condivise (UMD → `window.GaraRisultati` / `module.exports`) |
| `scripts/test-gara-risultati.mjs` | nuovo | Test node del modulo condiviso |
| `api/_match-gara.js` | nuovo | Funzioni server pure: `applyMatchPatch`, `sanificaDatiGara`, `sanificaNuova`, `applicaGara`, `purgeGaraAtleta` |
| `scripts/test-match-gara.mjs` | nuovo | Test node delle funzioni server |
| `api/data.js` | modifica | Azione `match-gara`, merge `matchResultsPatch`, purge del blocco `gara` |
| `public/script.js` | modifica | Patch dei Risultati in `saveData`, base al caricamento, submit che conserva i campi, aggancio al modulo UI |
| `public/risultati-gara.js` | nuovo | Sezioni Formazione / Sostituzioni / Minutaggio / Cronologia nel pannello partita |
| `public/index.html` | modifica | Tag script dei due moduli + bump `?v=` di `script.js` |
| `public/gara/index.html` | modifica | Usa il modulo condiviso; tendina "Prendi dal calendario"; pulsante "💾 Salva nei Risultati" |
| `public/gara/sw.js` | modifica | `CACHE` `gara-v23` → `gara-v24`, precache del modulo |

---

### Task 1: Modulo condiviso `public/gara/gara-risultati.js`

**Files:**
- Create: `public/gara/gara-risultati.js`
- Test: `scripts/test-gara-risultati.mjs`

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `scripts/test-gara-risultati.mjs`:

```js
// Test del modulo condiviso gara <-> Risultati.
// Esegui: node scripts/test-gara-risultati.mjs
import { createRequire } from 'module';
import assert from 'assert/strict';
const require = createRequire(import.meta.url);
const GR = require('../public/gara/gara-risultati.js');

let n = 0;
function t(nome, fn) { fn(); n++; console.log('ok -', nome); }

// ── leggiMinutoTesto ─────────────────────────────────────────────
const o2 = { durata: 45, numTempi: 2 };
t('minuto semplice', () => assert.deepEqual(GR.leggiMinutoTesto('23', o2),
  { minuto: "23'", min: 23, periodo: 1, intervallo: false }));
t('recupero', () => assert.deepEqual(GR.leggiMinutoTesto("45+2'", o2),
  { minuto: "45+2'", min: 45, periodo: 1, intervallo: false }));
t('secondo tempo', () => assert.equal(GR.leggiMinutoTesto('60', o2).periodo, 2));
t('intervallo con 2 tempi', () => assert.deepEqual(GR.leggiMinutoTesto('Int.', o2),
  { minuto: 'Int.', min: 45, periodo: 2, intervallo: true }));
t('intervallo numerato con 4 tempi', () => assert.deepEqual(
  GR.leggiMinutoTesto('int 3', { durata: 15, numTempi: 4 }),
  { minuto: 'Int. 3', min: 45, periodo: 4, intervallo: true }));
t('intervallo impossibile con 1 tempo', () => assert.equal(GR.leggiMinutoTesto('int', { durata: 30, numTempi: 1 }), null));
t('testo illeggibile', () => assert.equal(GR.leggiMinutoTesto('boh', o2), null));
t('vuoto', () => assert.equal(GR.leggiMinutoTesto('', o2), null));

// ── calcolaMinutaggio ────────────────────────────────────────────
// 2 tempi da 45': A titolare per tutta la gara, B esce al 30' (sec 1800)
// per C, C esce all'intervallo per B (rientro), D espulso al 10' del 2o.
const eventi = [
  { tipo: 'cambio', playerId: 'B', playerInId: 'C', periodo: 1, min: 30, minuto: "30'", sec: 1800 },
  { tipo: 'cambio', playerId: 'C', playerInId: 'B', periodo: 2, min: 45, minuto: 'Int.', intervallo: true },
  { tipo: 'espulsione', playerId: 'D', periodo: 2, min: 55, minuto: "55'", sec: 600 }
];
const mm = GR.calcolaMinutaggio({ titolari: ['A', 'B', 'D'], eventi, numTempi: 2, durata: 45 });
t('titolare intero', () => assert.equal(mm.A.tot, 5400));
t('rientro sommato', () => { assert.equal(mm.B.tot, 1800 + 2700); assert.equal(mm.B.ingressi, 2); });
t('subentrato poi uscito all intervallo', () => assert.deepEqual(mm.C.tempi, [900, 0]));
t('espulsione chiude il minutaggio', () => assert.equal(mm.D.tot, 2700 + 600));
t('durate reali dei tempi', () => {
  const r = GR.calcolaMinutaggio({ titolari: ['A'], eventi: [], numTempi: 2, durata: 45,
    durataTempo: p => (p === 1 ? 2820 : 0) });   // 1o con recupero, 2o non giocato
  assert.deepEqual(r.A.tempi, [2820, 0]);
});
t('senza sec usa il minuto', () => assert.equal(GR.secondoEvento({ periodo: 2, min: 50, minuto: "50'" }, 45), 240));

// ── elencoPartite / etichettaPartita / trovaPartita ──────────────
const MR = {
  '100': { id: 100, date: '2026-11-08', time: '17:00', opponentName: 'Olympic Collegno', location: 'home', scorers: [], cards: [], assists: [] },
  '200': { id: 200, date: '2026-10-01', time: '', opponentName: 'Lascaris', location: 'away', scorers: [], cards: [], assists: [] },
  '300': { id: 300, date: '', opponentName: 'Senza data' }
};
t('elenco ordinato per vicinanza a oggi, senza le partite senza data', () => {
  const l = GR.elencoPartite(MR, '2026-11-07');
  assert.deepEqual(l.map(x => x.id), ['100', '200']);
});
t('etichetta', () => assert.equal(GR.etichettaPartita(MR['100']), 'dom 08/11 · 17:00 · 🏠 Olympic Collegno'));
t('etichetta trasferta senza ora', () => assert.equal(GR.etichettaPartita(MR['200']), 'gio 01/10 · ✈️ Lascaris'));
t('legata per id', () => assert.equal(GR.trovaPartita(MR, { matchId: '200' }).modo, 'legata'));
t('trovata per data e avversario normalizzato', () => {
  const r = GR.trovaPartita(MR, { matchId: '999', data: '2026-11-08', avversario: '  olympic   COLLEGNO ' });
  assert.equal(r.modo, 'trovata'); assert.equal(r.id, '100');
});
t('nessuna', () => assert.equal(GR.trovaPartita(MR, { data: '2026-11-08', avversario: 'Altri' }).modo, null));

// ── datiDaGara ───────────────────────────────────────────────────
const stato = {
  noiCasa: false, golNoi: 2, golLoro: 1,
  eventi: [
    { tipo: 'gol', playerId: 'A', periodo: 1, min: 12, minuto: "12'" },
    { tipo: 'gol-avv', periodo: 1, min: 20, minuto: "20'" },
    { tipo: 'ammonizione', playerId: 'B', periodo: 1, min: 0, minuto: "0'" },
    { tipo: 'cambio', playerId: 'B', playerInId: 'C', periodo: 2, min: 45, minuto: 'Int.', intervallo: true },
    { tipo: 'espulsione', playerId: 'D', periodo: 2, min: 70, minuto: "70'", sec: 1500 },
    { tipo: 'nota', nota: 'pioggia', periodo: 2, min: 71 }
  ],
  convocati: ['A', 'B', 'C', 'D'], titolari: ['A', 'B', 'D'],
  numTempi: 2, durata: 45, durateTempi: { 1: 2820, 2: 2900 }, adesso: '2026-11-08T18:00:00.000Z'
};
const d = GR.datiDaGara(stato);
t('punteggio in trasferta', () => { assert.equal(d.homeScore, 1); assert.equal(d.awayScore, 2); });
t('marcatori formato Risultati', () => assert.deepEqual(d.scorers, [{ athleteId: 'A', minute: '12' }]));
t('cartellini con minuto minimo 1', () => assert.deepEqual(d.cards, [
  { athleteId: 'B', type: 'yellow', minute: '1' }, { athleteId: 'D', type: 'red', minute: '70' }]));
t('cambi', () => assert.deepEqual(d.gara.cambi, [
  { esce: 'B', entra: 'C', min: 45, minuto: 'Int.', periodo: 2, intervallo: true }]));
t('espulsioni con sec', () => assert.deepEqual(d.gara.espulsioni, [
  { athleteId: 'D', min: 70, minuto: "70'", periodo: 2, sec: 1500 }]));
t('tempi e metadati', () => {
  assert.deepEqual(d.gara.tempi, { numero: 2, durata: 45, durateTempi: { 1: 2820, 2: 2900 } });
  assert.equal(d.gara.incompleta, false);
  assert.equal(d.gara.salvataIl, '2026-11-08T18:00:00.000Z');
});
t('senza XI = incompleta', () => assert.equal(GR.datiDaGara(Object.assign({}, stato, { titolari: [] })).gara.incompleta, true));

// ── minutaggioPartita (vista Risultati) = stessa regola della gara ──
t('minutaggio da blocco gara salvato', () => {
  const m = GR.minutaggioPartita(d.gara);
  assert.equal(m.A.tot, 2820 + 2900);
  assert.equal(m.C.tot, 2900);          // entrato all'intervallo: tutto il 2o
  assert.equal(m.D.tot, 2820 + 1500);
});

// ── differenze ───────────────────────────────────────────────────
const nomi = { A: 'Bivol', B: 'Aiesi', C: 'Runza', D: 'Rossi' };
const nomeDi = id => nomi[id] || id;
t('partita vuota: nessuna differenza', () => assert.deepEqual(
  GR.differenze({ homeScore: null, awayScore: null, scorers: [], cards: [] }, d, nomeDi), []));
t('differenze su punteggio e marcatori', () => {
  const diff = GR.differenze({ homeScore: 1, awayScore: 1, scorers: [{ athleteId: 'C', minute: '5' }], cards: [] }, d, nomeDi);
  assert.equal(diff.length, 2);
  assert.match(diff[0], /Punteggio in Risultati: 1-1 · dalla gara: 1-2/);
  assert.match(diff[1], /Marcatori in Risultati: Runza 5' · dalla gara: Bivol 12'/);
});
t('dati uguali: nessuna differenza', () => assert.deepEqual(
  GR.differenze({ homeScore: 1, awayScore: 2, scorers: d.scorers, cards: d.cards }, d, nomeDi), []));

// ── diffMatchResults / applyMatchPatch ───────────────────────────
const base = { '1': { id: 1, date: '2026-11-01', homeScore: 1, gara: { x: 1 } }, '2': { id: 2, date: '2026-11-02' } };
const cur = JSON.parse(JSON.stringify(base));
cur['1'].homeScore = 3; delete cur['2'];
cur['3'] = { id: 3, date: '2026-11-03', opponentName: 'Nuova' };
const patch = GR.diffMatchResults(base, cur);
t('patch per campo', () => assert.deepEqual(patch, {
  '1': { homeScore: 3 }, '2': null, '3': { id: 3, date: '2026-11-03', opponentName: 'Nuova' } }));
t('nessuna modifica = null', () => assert.equal(GR.diffMatchResults(base, JSON.parse(JSON.stringify(base))), null));
t('campo eliminato = null', () => assert.deepEqual(
  GR.diffMatchResults({ '1': { a: 1, b: 2 } }, { '1': { a: 1 } }), { '1': { b: null } }));
t('apply non tocca i campi non in patch (gara salvata dal telefono)', () => {
  const server = { '1': { id: 1, date: '2026-11-01', homeScore: 1, gara: { telefono: true } }, '2': { id: 2, date: '2026-11-02' } };
  GR.applyMatchPatch(server, patch);
  assert.deepEqual(server['1'], { id: 1, date: '2026-11-01', homeScore: 3, gara: { telefono: true } });
  assert.equal(server['2'], undefined);
  assert.equal(server['3'].opponentName, 'Nuova');
});
t('apply non resuscita una partita cancellata altrove', () => {
  const server = {};
  GR.applyMatchPatch(server, { '9': { homeScore: 2 } });
  assert.deepEqual(server, {});
});

console.log(`\n${n} test superati`);
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `node scripts/test-gara-risultati.mjs`
Expected: FAIL con `Cannot find module '../public/gara/gara-risultati.js'`

- [ ] **Step 3: Scrivi il modulo**

Crea `public/gara/gara-risultati.js`:

```js
// Dati di Andamento Gara <-> partita di Risultati.
// Funzioni pure, nessun accesso al DOM ne' alla rete: le usano la gara
// (public/gara/index.html) e l'app principale (public/risultati-gara.js,
// public/script.js), e si testano da sole (scripts/test-gara-risultati.mjs).
// Sta sotto /gara/ perche' il service worker della gara (scope /gara/) la
// metta in cache: a bordo campo senza rete la gara deve funzionare uguale.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GaraRisultati = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  var isObj = function (x) { return !!x && typeof x === 'object' && !Array.isArray(x); };
  var clone = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };

  // ── Minuti ─────────────────────────────────────────────────────
  function etichettaIntervallo(k, numTempi) {
    return Number(numTempi) > 2 ? 'Int. ' + k : 'Int.';
  }

  // Minuto scritto a mano ("23", "45+2", "int", "int 3"). null se non si
  // capisce. Il periodo si deduce dal minuto. o = { durata, numTempi,
  // durataSuppl, intervalloDefault }: intervalloDefault e' l'intervallo da
  // usare per "int" senza numero (la gara passa quello in corso).
  function leggiMinutoTesto(testo, o) {
    o = o || {};
    var t = String(testo || '').trim();
    var dur = Number(o.durata) || 45;
    var N = Math.max(1, Number(o.numTempi) || 2);
    var mi = t.match(/^int\.?\s*(\d)?/i);
    if (mi) {
      var k = mi[1] ? parseInt(mi[1], 10) : (Number(o.intervalloDefault) || 1);
      if (k < 1 || k >= N) return null;   // con un tempo solo non c'e' intervallo
      return { minuto: etichettaIntervallo(k, N), min: k * dur, periodo: k + 1, intervallo: true };
    }
    var m = t.replace(/'+$/, '').match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?$/);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    var ds = Number(o.durataSuppl) || 15;
    var periodo = n <= N * dur ? Math.max(1, Math.ceil(n / dur))
                : n <= N * dur + ds ? N + 1 : N + 2;
    return { minuto: n + (m[2] ? '+' + parseInt(m[2], 10) : '') + "'", min: n,
             periodo: periodo, intervallo: false };
  }

  // Secondo dell'evento dentro il suo tempo. Senza sec (minuto scritto a mano
  // o evento vecchio) si ricava dal minuto: "23'" del 1o = inizio del 23o
  // minuto, "45+2'" = 46 minuti e rotti. All'intervallo = 0 del tempo dopo.
  function secondoEvento(ev, durata) {
    if (ev.intervallo) return 0;
    if (ev.sec != null && ev.sec !== '' && !isNaN(Number(ev.sec))) return Math.max(0, Number(ev.sec));
    var dur = Number(durata) || 45;
    var per = Number(ev.periodo) || 1;
    var extra = parseInt((String(ev.minuto || '').match(/\+(\d+)/) || [])[1], 10) || 0;
    var m = (Number(ev.min) || 0) - (per - 1) * dur + extra;
    return Math.max(0, (m - 1) * 60);
  }

  // Rigioca la cronologia: i titolari partono in campo al secondo 0 del 1o
  // tempo, ogni cambio chiude il tratto di chi esce e apre quello di chi
  // entra, l'espulsione chiude e basta. I tratti si sommano (rientri del
  // settore di base). opts = { titolari:[id], eventi:[formato gara: tipo,
  // playerId, playerInId, periodo, min, minuto, intervallo, sec], numTempi,
  // durata, durataTempo(p) -> secondi giocati nel tempo p }.
  // Restituisce { id: { tempi:[sec...], tot, ingressi } }.
  function calcolaMinutaggio(opts) {
    var N = Math.max(1, Number(opts.numTempi) || 1);
    var durata = Number(opts.durata) || 45;
    var durataTempo = opts.durataTempo || function () { return durata * 60; };
    var eventi = opts.eventi || [];
    var ris = {};
    var voce = function (id) {
      return ris[id] || (ris[id] = { tempi: new Array(N).fill(0), tot: 0, ingressi: 0 });
    };
    var entrato = new Map();   // id -> secondo d'ingresso nel tempo corrente
    (opts.titolari || []).forEach(function (id) {
      id = String(id); entrato.set(id, 0); voce(id).ingressi = 1;
    });
    for (var p = 1; p <= N; p++) {
      var D = Number(durataTempo(p)) || 0;
      // A inizio tempo chi e' in campo riparte da 0 (il tratto prima e' chiuso)
      entrato.forEach(function (_, id) { entrato.set(id, 0); });
      var chiudi = function (id, t, per) {
        if (!entrato.has(id)) return;
        voce(id).tempi[per - 1] += Math.max(0, t - entrato.get(id));
        entrato.delete(id);
      };
      // Ordine per secondo dentro il tempo (sort stabile: a parita' resta
      // l'ordine di inserimento, come nella cronologia della gara)
      var delTempo = eventi
        .filter(function (ev) {
          return ev && (Number(ev.periodo) || 1) === p && (ev.tipo === 'cambio' || ev.tipo === 'espulsione');
        })
        .map(function (ev, i) { return { ev: ev, t: Math.min(secondoEvento(ev, durata), D), i: i }; })
        .sort(function (a, b) { return a.t - b.t || a.i - b.i; });
      for (var j = 0; j < delTempo.length; j++) {
        var ev = delTempo[j].ev, t = delTempo[j].t;
        if (ev.playerId) chiudi(String(ev.playerId), t, p);
        if (ev.tipo === 'cambio' && ev.playerInId) {
          var idIn = String(ev.playerInId);
          if (!entrato.has(idIn)) { entrato.set(idIn, t); voce(idIn).ingressi++; }
        }
      }
      var pp = p, DD = D;
      entrato.forEach(function (t0, id) { voce(id).tempi[pp - 1] += Math.max(0, DD - t0); });
    }
    Object.keys(ris).forEach(function (id) {
      ris[id].tot = ris[id].tempi.reduce(function (a, b) { return a + b; }, 0);
    });
    return ris;
  }

  // Blocco `gara` salvato in Risultati -> eventi nel formato del minutaggio
  function eventiDaBlocco(g) {
    var cambi = (g.cambi || []).map(function (c) {
      return Object.assign({ tipo: 'cambio', playerId: c.esce || '', playerInId: c.entra || '' }, c);
    });
    var esp = (g.espulsioni || []).map(function (e) {
      return Object.assign({ tipo: 'espulsione', playerId: e.athleteId || '' }, e);
    });
    return cambi.concat(esp);
  }

  // Minutaggio della vista Risultati: stessa regola della gara, con le durate
  // dei tempi salvate al momento del salvataggio (0 = tempo non giocato).
  function minutaggioPartita(g) {
    g = g || {};
    var tempi = g.tempi || {};
    var durata = Number(tempi.durata) || 45;
    var dt = tempi.durateTempi || {};
    return calcolaMinutaggio({
      titolari: g.titolari || [], eventi: eventiDaBlocco(g),
      numTempi: Number(tempi.numero) || 2, durata: durata,
      durataTempo: function (p) { return dt[p] != null ? Number(dt[p]) || 0 : durata * 60; }
    });
  }

  // ── Partite di Risultati ───────────────────────────────────────
  function oggiLocale() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function giorniDa(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000 : NaN;
  }
  function normNome(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  // [{ id: chiave in matchResults, match }], prima le partite piu' vicine a
  // oggi (la gara si gioca oggi o quasi). Senza data non si possono proporre.
  function elencoPartite(matchResults, oggi) {
    var g0 = giorniDa(oggi || oggiLocale());
    return Object.keys(matchResults || {})
      .map(function (k) { return { id: k, match: matchResults[k] }; })
      .filter(function (x) { return isObj(x.match) && !isNaN(giorniDa(x.match.date)); })
      .sort(function (a, b) {
        return Math.abs(giorniDa(a.match.date) - g0) - Math.abs(giorniDa(b.match.date) - g0) ||
               String(a.match.date).localeCompare(String(b.match.date));
      });
  }

  // Stesso formato di "Prendi dal calendario" in Convocazioni:
  // "dom 08/11 · 17:00 · 🏠 Avversario"
  function etichettaPartita(m) {
    m = m || {};
    var p = String(m.date || '').split('-');
    var dt = p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
    var data = dt && !isNaN(dt) ? GIORNI[dt.getDay()] + ' ' + p[2] + '/' + p[1] : '—';
    var ora = /^\d{1,2}:\d{2}/.test(String(m.time || '')) ? ' · ' + String(m.time).slice(0, 5) : '';
    var luogo = m.location === 'home' ? '🏠' : m.location === 'away' ? '✈️' : '⚽';
    return data + ora + ' · ' + luogo + ' ' + (m.opponentName || 'Avversario');
  }

  // Dove salvare la gara: la partita legata dalla tendina, altrimenti quella
  // con stessa data e stesso avversario. { id, match, modo:'legata'|'trovata'|null }
  function trovaPartita(matchResults, q) {
    matchResults = matchResults || {};
    q = q || {};
    if (q.matchId && isObj(matchResults[q.matchId])) {
      return { id: String(q.matchId), match: matchResults[q.matchId], modo: 'legata' };
    }
    var avv = normNome(q.avversario);
    if (q.data && avv) {
      var ks = Object.keys(matchResults);
      for (var i = 0; i < ks.length; i++) {
        var m = matchResults[ks[i]];
        if (isObj(m) && m.date === q.data && normNome(m.opponentName) === avv) {
          return { id: ks[i], match: m, modo: 'trovata' };
        }
      }
    }
    return { id: null, match: null, modo: null };
  }

  // ── Gara -> Risultati ──────────────────────────────────────────
  // I minuti di Risultati sono stringhe di cifre >= 1 (input number min=1):
  // un gol al minuto 0 o all'intervallo diventa il primo minuto valido.
  function minuteRisultati(ev) {
    var n = parseInt(ev.min, 10);
    return String(n >= 1 ? n : 1);
  }
  function tempoEvento(ev) {
    var o = { min: Math.max(0, parseInt(ev.min, 10) || 0), minuto: String(ev.minuto || ''), periodo: Number(ev.periodo) || 1 };
    if (ev.intervallo) o.intervallo = true;
    if (ev.sec != null && ev.sec !== '' && !isNaN(Number(ev.sec))) o.sec = Number(ev.sec);
    return o;
  }

  // s = { noiCasa, golNoi, golLoro, eventi, convocati:[id], titolari:[id],
  //       numTempi, durata, durateTempi:{p:sec}, adesso:ISO }
  function datiDaGara(s) {
    var ev = (s.eventi || []).filter(Boolean);
    var noi = Number(s.golNoi) || 0, loro = Number(s.golLoro) || 0;
    var titolari = (s.titolari || []).map(String);
    var dt = {};
    Object.keys(s.durateTempi || {}).forEach(function (k) { dt[k] = Number(s.durateTempi[k]) || 0; });
    return {
      homeScore: s.noiCasa ? noi : loro,
      awayScore: s.noiCasa ? loro : noi,
      scorers: ev.filter(function (e) { return e.tipo === 'gol' && e.playerId; })
        .map(function (e) { return { athleteId: String(e.playerId), minute: minuteRisultati(e) }; }),
      cards: ev.filter(function (e) { return (e.tipo === 'ammonizione' || e.tipo === 'espulsione') && e.playerId; })
        .map(function (e) {
          return { athleteId: String(e.playerId), type: e.tipo === 'ammonizione' ? 'yellow' : 'red', minute: minuteRisultati(e) };
        }),
      gara: {
        convocati: (s.convocati || []).map(String),
        titolari: titolari,
        cambi: ev.filter(function (e) { return e.tipo === 'cambio' && (e.playerId || e.playerInId); })
          .map(function (e) {
            return Object.assign({ esce: e.playerId ? String(e.playerId) : '', entra: e.playerInId ? String(e.playerInId) : '' }, tempoEvento(e));
          }),
        espulsioni: ev.filter(function (e) { return e.tipo === 'espulsione' && e.playerId; })
          .map(function (e) { return Object.assign({ athleteId: String(e.playerId) }, tempoEvento(e)); }),
        tempi: { numero: Number(s.numTempi) || 2, durata: Number(s.durata) || 45, durateTempi: dt },
        salvataIl: s.adesso || new Date().toISOString(),
        incompleta: titolari.length === 0
      }
    };
  }

  // Righe "X in Risultati: ... · dalla gara: ..." solo per cio' che la
  // partita ha GIA' e che il salvataggio cambierebbe. [] = nessun conflitto.
  function differenze(match, dati, nomeDi) {
    match = match || {};
    nomeDi = nomeDi || function (id) { return String(id); };
    var righe = [];
    var vuoto = function (v) { return v === null || v === undefined || v === ''; };
    if (!vuoto(match.homeScore) || !vuoto(match.awayScore)) {
      var a = (vuoto(match.homeScore) ? '-' : match.homeScore) + '-' + (vuoto(match.awayScore) ? '-' : match.awayScore);
      var b = dati.homeScore + '-' + dati.awayScore;
      if (a !== b) righe.push('Punteggio in Risultati: ' + a + ' · dalla gara: ' + b);
    }
    var elenco = function (l, conTipo) {
      return (l || []).map(function (x) {
        return (conTipo ? (x.type === 'red' ? '🟥 ' : '🟨 ') : '') + nomeDi(x.athleteId) + ' ' + x.minute + "'";
      }).join(', ');
    };
    [['scorers', 'Marcatori', false], ['cards', 'Cartellini', true]].forEach(function (c) {
      var prima = elenco(match[c[0]], c[2]);
      var dopo = elenco(dati[c[0]], c[2]);
      if (prima && prima !== dopo) righe.push(c[1] + ' in Risultati: ' + prima + ' · dalla gara: ' + (dopo || 'nessuno'));
    });
    return righe;
  }

  // ── Patch dei Risultati (anti lost-update) ─────────────────────
  // { id: null } = partita eliminata; { id: { campo: valore | null } } =
  // campi cambiati (null = campo tolto). null se non e' cambiato niente.
  // Speculare a applyMatchPatch in api/_match-gara.js.
  function diffMatchResults(base, cur) {
    var b0 = isObj(base) ? base : {}, c0 = isObj(cur) ? cur : {};
    var patch = {}, n = 0;
    var ids = Object.keys(b0).concat(Object.keys(c0).filter(function (k) { return !(k in b0); }));
    ids.forEach(function (id) {
      var bm = b0[id], cm = c0[id];
      if (!isObj(cm)) {
        if (isObj(bm)) { patch[id] = null; n++; }
        return;
      }
      var bo = isObj(bm) ? bm : {};
      var campi = Object.keys(bo).concat(Object.keys(cm).filter(function (k) { return !(k in bo); }));
      campi.forEach(function (f) {
        if (JSON.stringify(bo[f]) === JSON.stringify(cm[f])) return;
        patch[id] = patch[id] || {};
        patch[id][f] = cm[f] === undefined ? null : clone(cm[f]);
        n++;
      });
    });
    return n ? patch : null;
  }

  function applyMatchPatch(cur, patch) {
    Object.keys(patch || {}).forEach(function (id) {
      var v = patch[id];
      if (v === null) { delete cur[id]; return; }
      if (!isObj(v)) return;
      // Una partita che qui non c'e' si crea solo se la patch e' una partita
      // intera (ha la data): altrimenti e' il resto di una partita eliminata
      // da un altro dispositivo, e resusciterla ne farebbe un rottame.
      if (!isObj(cur[id])) {
        if (!v.date) return;
        cur[id] = {};
      }
      Object.keys(v).forEach(function (f) {
        if (v[f] === null) delete cur[id][f];
        else cur[id][f] = clone(v[f]);
      });
    });
    return cur;
  }

  return {
    etichettaIntervallo: etichettaIntervallo,
    leggiMinutoTesto: leggiMinutoTesto,
    secondoEvento: secondoEvento,
    calcolaMinutaggio: calcolaMinutaggio,
    eventiDaBlocco: eventiDaBlocco,
    minutaggioPartita: minutaggioPartita,
    elencoPartite: elencoPartite,
    etichettaPartita: etichettaPartita,
    trovaPartita: trovaPartita,
    datiDaGara: datiDaGara,
    differenze: differenze,
    diffMatchResults: diffMatchResults,
    applyMatchPatch: applyMatchPatch
  };
});
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `node scripts/test-gara-risultati.mjs`
Expected: tutte le righe `ok - ...` e in fondo `N test superati`, exit code 0.

- [ ] **Step 5: Commit**

```bash
cd "/d/EDY/Go Calcio/Valutazione Atleti/Vercel/App-Allenatori_VR3/AppAllenamentoR1"
git add public/gara/gara-risultati.js scripts/test-gara-risultati.mjs
git commit -m "feat(gara-risultati): modulo condiviso minutaggio, minuti, partite e patch Risultati

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- public/gara/gara-risultati.js scripts/test-gara-risultati.mjs
```

---

### Task 2: La gara usa il modulo condiviso (nessun cambio di comportamento)

**Files:**
- Modify: `public/gara/index.html`. Prima del primo `<script>` inline (riga ~632); `etichettaIntervallo` (~857); `leggiMinuto` (~865-883); `secondoEvento` (~2036-2044); `calcolaMinutaggio` (~2051-2078).
- Modify: `public/gara/sw.js` (CACHE + PRECACHE)

- [ ] **Step 1: Carica il modulo**

In `public/gara/index.html`, subito prima della riga `<script>` (quella senza `src`, ~632), aggiungi:

```html
<script src="/gara/gara-risultati.js?v=1"></script>
```

- [ ] **Step 2: Sostituisci le funzioni duplicate con wrapper**

Sostituisci il corpo di `etichettaIntervallo`:

```js
function etichettaIntervallo(k) {
  return GaraRisultati.etichettaIntervallo(k, numTempi());
}
```

Sostituisci l'intera `function leggiMinuto(testo) { ... }`, lasciando il commento sopra:

```js
function leggiMinuto(testo) {
  // Il parsing vive in gara-risultati.js: lo usa anche Risultati, e due copie
  // finirebbero per capire "45+2" in due modi diversi.
  return GaraRisultati.leggiMinutoTesto(testo, {
    durata: info.durata, numTempi: numTempi(), durataSuppl: info.durataSuppl,
    intervalloDefault: inIntervallo() ? currentPeriod : 1
  });
}
```

Sostituisci l'intera `function secondoEvento(ev) { ... }`:

```js
function secondoEvento(ev) {
  return GaraRisultati.secondoEvento(ev, info.durata);
}
```

Sostituisci l'intera `function calcolaMinutaggio() { ... }`, lasciando il commento sopra:

```js
function calcolaMinutaggio() {
  // Stessa funzione della vista Risultati (gara-risultati.js): le due viste
  // non devono mai dare minuti diversi per la stessa partita.
  return GaraRisultati.calcolaMinutaggio({
    titolari: titolari().map(p => String(p.id)),
    eventi: events, numTempi: numTempi(), durata: info.durata, durataTempo
  });
}
```

- [ ] **Step 3: Service worker**

In `public/gara/sw.js`:
- `const CACHE = 'gara-v23';` → `const CACHE = 'gara-v24';`
- nella lista `PRECACHE`, dopo `'/gara/icon-512.png',`, aggiungi: `'/gara/gara-risultati.js?v=1',`

- [ ] **Step 4: Verifica che il codice non chiami più copie locali**

Run: `cd "/d/EDY/Go Calcio/Valutazione Atleti/Vercel/App-Allenatori_VR3/AppAllenamentoR1" && grep -n "GaraRisultati\." public/gara/index.html`
Expected: 4 righe (etichettaIntervallo, leggiMinutoTesto, secondoEvento, calcolaMinutaggio).

- [ ] **Step 5: Smoke test Playwright della gara**

1. Avvia il server statico in background: `cd public && python -m http.server 8765`.
2. Con Playwright, apri un **nuovo** contesto browser.
3. Instrada le richieste:
   - `**/gara/sw.js` → 404;
   - `**/api/data*` → mock con `{ athletes: [{id:'a1',name:'Bivol',number:'9'},{id:'a2',name:'Aiesi',number:'10'},{id:'a3',name:'Runza',number:'7'}], matchResults: {} }`;
   - ogni altra richiesta non `127.0.0.1` → abort.
4. Prima di caricare, `localStorage.setItem('currentAnnata','test')`, poi vai su `http://127.0.0.1:8765/gara/`.
5. Nella console verifica:
   - `typeof GaraRisultati === 'object'`
   - `leggiMinuto('45+2').min === 45`
   - `calcolaMinutaggio()` restituisce un oggetto
   - `browser_console_messages` senza errori

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(gara): minutaggio e lettura minuti dal modulo condiviso gara-risultati.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- public/gara/index.html public/gara/sw.js
```

---

### Task 3: Funzioni server pure `api/_match-gara.js`

**Files:**
- Create: `api/_match-gara.js`
- Test: `scripts/test-match-gara.mjs`

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `scripts/test-match-gara.mjs`:

```js
// Test delle funzioni server di gara -> Risultati.
// Esegui: node scripts/test-match-gara.mjs
import assert from 'assert/strict';
import { applyMatchPatch, sanificaDatiGara, sanificaNuova, applicaGara, purgeGaraAtleta } from '../api/_match-gara.js';

let n = 0;
function t(nome, fn) { fn(); n++; console.log('ok -', nome); }

// applyMatchPatch: stessa semantica del client (gara-risultati.js)
t('patch per campo, gara del telefono intatta', () => {
  const cur = { '1': { id: 1, date: 'x', homeScore: 1, gara: { tel: 1 } } };
  applyMatchPatch(cur, { '1': { homeScore: 3 } });
  assert.deepEqual(cur['1'], { id: 1, date: 'x', homeScore: 3, gara: { tel: 1 } });
});
t('null elimina partita e campo', () => {
  const cur = { '1': { a: 1, b: 2 }, '2': { a: 1 } };
  applyMatchPatch(cur, { '1': { b: null }, '2': null });
  assert.deepEqual(cur, { '1': { a: 1 } });
});
t('non resuscita partite senza data', () => {
  const cur = {};
  applyMatchPatch(cur, { '9': { homeScore: 1 } });
  assert.deepEqual(cur, {});
});
t('chiavi pericolose ignorate', () => {
  const cur = {};
  applyMatchPatch(cur, JSON.parse('{"__proto__":{"date":"x","polluted":1},"1":{"date":"d","constructor":{"x":1}}}'));
  assert.equal({}.polluted, undefined);
  assert.deepEqual(cur['1'], { date: 'd' });
});

const datiOk = {
  homeScore: 2, awayScore: '1',
  scorers: [{ athleteId: 'a1', minute: '12' }, { minute: '3' }],
  cards: [{ athleteId: 'a2', type: 'yellow', minute: '5' }, { athleteId: 'a3', type: 'blu', minute: '6' }],
  gara: {
    convocati: ['a1', 'a2', 'a3'], titolari: ['a1', 'a2'],
    cambi: [{ esce: 'a2', entra: 'a3', min: 45, minuto: 'Int.', periodo: 2, intervallo: true }, {}],
    espulsioni: [{ athleteId: 'a1', min: 80, minuto: "80'", periodo: 2, sec: 2100 }],
    tempi: { numero: 2, durata: 45, durateTempi: { 1: 2820, 2: 2900, x: 5, '__proto__': 1 } },
    salvataIl: '2026-11-08T18:00:00.000Z', incompleta: false, extra: 'via'
  }
};
t('sanifica: scarta righe senza atleta e tipi sconosciuti', () => {
  const d = sanificaDatiGara(datiOk);
  assert.equal(d.awayScore, 1);
  assert.deepEqual(d.scorers, [{ athleteId: 'a1', minute: '12' }]);
  assert.deepEqual(d.cards, [{ athleteId: 'a2', type: 'yellow', minute: '5' }]);
  assert.equal(d.gara.cambi.length, 1);
  assert.deepEqual(d.gara.tempi.durateTempi, { 1: 2820, 2: 2900 });
  assert.equal(d.gara.extra, undefined);
  assert.equal(d.gara.espulsioni[0].sec, 2100);
});
t('sanifica: dati senza gara = null', () => assert.equal(sanificaDatiGara({ homeScore: 1 }), null));
t('sanifica: liste troppo lunghe tagliate', () => {
  const lunghi = Object.assign({}, datiOk, { scorers: Array.from({ length: 500 }, () => ({ athleteId: 'a', minute: '1' })) });
  assert.equal(sanificaDatiGara(lunghi).scorers.length, 100);
});

t('nuova partita valida', () => assert.deepEqual(
  sanificaNuova({ date: '2026-11-08', time: '17:00', venue: 'Campo', opponentName: ' Olympic ', location: 'home' }),
  { date: '2026-11-08', time: '17:00', venue: 'Campo', opponentName: 'Olympic', location: 'home' }));
t('nuova senza data o avversario = null', () => {
  assert.equal(sanificaNuova({ date: '8/11', opponentName: 'X' }), null);
  assert.equal(sanificaNuova({ date: '2026-11-08', opponentName: '  ' }), null);
});

t('applicaGara conserva assist e campi propri', () => {
  const m = { id: 7, date: '2026-11-08', opponentName: 'X', location: 'home', assists: [{ athleteId: 'a3', minute: '12' }], scorers: [], cards: [] };
  const r = applicaGara(m, sanificaDatiGara(datiOk), 'mister');
  assert.deepEqual(r.assists, m.assists);
  assert.equal(r.opponentName, 'X');
  assert.equal(r.homeScore, 2);
  assert.equal(r.gara.salvataDa, 'mister');
  assert.equal(m.homeScore, undefined, 'non modifica l oggetto originale');
});

t('purge toglie l atleta da tutto il blocco gara', () => {
  const m = applicaGara({ id: 1, date: 'd' }, sanificaDatiGara(datiOk), 'x');
  assert.equal(purgeGaraAtleta(m, 'a2'), true);
  assert.deepEqual(m.gara.convocati, ['a1', 'a3']);
  assert.deepEqual(m.gara.titolari, ['a1']);
  assert.deepEqual(m.gara.cambi, [{ esce: '', entra: 'a3', min: 45, minuto: 'Int.', periodo: 2, intervallo: true }]);
  assert.equal(purgeGaraAtleta(m, 'a3'), true);
  assert.deepEqual(m.gara.cambi, [], 'cambio senza nessuno dei due sparisce');
  assert.equal(purgeGaraAtleta(m, 'zz'), false);
  assert.equal(purgeGaraAtleta({ id: 2 }, 'a1'), false);
});

console.log(`\n${n} test superati`);
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `node scripts/test-match-gara.mjs`
Expected: FAIL con `Cannot find module` su `api/_match-gara.js`

- [ ] **Step 3: Scrivi il modulo**

Crea `api/_match-gara.js`:

```js
// Funzioni pure per i dati di Andamento Gara salvati in Risultati.
// Il file inizia con "_" come _sa-auth.js: Vercel non ne fa una funzione
// (limite 12 del piano Hobby), la importa solo api/data.js.
// Test: node scripts/test-match-gara.mjs

const VIETATE = new Set(['__proto__', 'constructor', 'prototype']);
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (v, max = 64) => String(v == null ? '' : v).trim().slice(0, max);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const lista = (a, max, fn) => (Array.isArray(a) ? a.slice(0, max).map(fn).filter(Boolean) : []);
const clone = x => JSON.parse(JSON.stringify(x));

// Differenza { id: null | { campo: valore | null } } dei Risultati.
// Speculare a applyMatchPatch in public/gara/gara-risultati.js.
export function applyMatchPatch(cur, patch) {
  if (!isObj(patch)) return cur;
  for (const id of Object.keys(patch)) {
    if (VIETATE.has(id) || id.length > 100) continue;
    const v = patch[id];
    if (v === null) { delete cur[id]; continue; }
    if (!isObj(v)) continue;
    // Una partita che qui non c'e' si crea solo se la patch e' una partita
    // intera (ha la data): altrimenti e' il residuo di una partita eliminata
    // da un altro dispositivo.
    if (!isObj(cur[id])) {
      if (!v.date) continue;
      cur[id] = {};
    }
    for (const f of Object.keys(v)) {
      if (VIETATE.has(f)) continue;
      if (v[f] === null) delete cur[id][f];
      else cur[id][f] = v[f];
    }
  }
  return cur;
}

function tempo(x) {
  const o = {
    min: Math.max(0, Math.min(999, Math.round(num(x.min) || 0))),
    minuto: str(x.minuto, 12),
    periodo: Math.max(1, Math.min(6, Math.round(num(x.periodo) || 1)))
  };
  if (x.intervallo === true) o.intervallo = true;
  const s = num(x.sec);
  if (s != null && s >= 0) o.sec = Math.min(s, 36000);
  return o;
}

// Dati mandati dalla gara: si tiene solo cio' che si conosce, con limiti di
// lunghezza (il corpo arriva da un telefono, non ci si fida della forma).
// null se manca il blocco gara.
export function sanificaDatiGara(d) {
  if (!isObj(d) || !isObj(d.gara)) return null;
  const g = d.gara;
  const t = isObj(g.tempi) ? g.tempi : {};
  const dt = {};
  if (isObj(t.durateTempi)) {
    for (const k of Object.keys(t.durateTempi)) {
      if (!/^[1-6]$/.test(k)) continue;
      const v = num(t.durateTempi[k]);
      if (v != null && v >= 0) dt[k] = Math.min(v, 36000);
    }
  }
  const gol = v => { const n = num(v); return n == null ? null : Math.max(0, Math.min(99, Math.round(n))); };
  const id = x => (x != null && str(x) ? str(x) : null);
  return {
    homeScore: gol(d.homeScore),
    awayScore: gol(d.awayScore),
    scorers: lista(d.scorers, 100, x => (isObj(x) && id(x.athleteId)
      ? { athleteId: str(x.athleteId), minute: str(x.minute, 4) } : null)),
    cards: lista(d.cards, 100, x => (isObj(x) && id(x.athleteId) && (x.type === 'yellow' || x.type === 'red')
      ? { athleteId: str(x.athleteId), type: x.type, minute: str(x.minute, 4) } : null)),
    gara: {
      convocati: lista(g.convocati, 60, id),
      titolari: lista(g.titolari, 30, id),
      cambi: lista(g.cambi, 100, x => (isObj(x) && (id(x.esce) || id(x.entra))
        ? Object.assign({ esce: str(x.esce), entra: str(x.entra) }, tempo(x)) : null)),
      espulsioni: lista(g.espulsioni, 30, x => (isObj(x) && id(x.athleteId)
        ? Object.assign({ athleteId: str(x.athleteId) }, tempo(x)) : null)),
      tempi: {
        numero: Math.max(1, Math.min(4, Math.round(num(t.numero) || 2))),
        durata: Math.max(1, Math.min(90, Math.round(num(t.durata) || 45))),
        durateTempi: dt
      },
      salvataIl: str(g.salvataIl, 40),
      incompleta: g.incompleta === true
    }
  };
}

// Partita nuova creata dalla gara (gara fuori calendario). null se mancano
// data o avversario: senza, in Risultati sarebbe una riga muta.
export function sanificaNuova(n) {
  if (!isObj(n)) return null;
  const date = str(n.date, 10);
  const opponentName = str(n.opponentName, 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !opponentName) return null;
  const time = /^\d{1,2}:\d{2}$/.test(str(n.time, 5)) ? str(n.time, 5) : '';
  return { date, time, venue: str(n.venue, 120), opponentName, location: n.location === 'away' ? 'away' : 'home' };
}

// La gara sovrascrive punteggio, marcatori, cartellini e il blocco gara;
// tutto il resto (assist, data, avversario, campi futuri) resta com'e'.
export function applicaGara(match, dati, chi) {
  return Object.assign({}, match, {
    homeScore: dati.homeScore,
    awayScore: dati.awayScore,
    scorers: clone(dati.scorers),
    cards: clone(dati.cards),
    assists: Array.isArray(match.assists) ? match.assists : [],
    gara: Object.assign(clone(dati.gara), { salvataDa: str(chi) })
  });
}

// GDPR art. 17: toglie l'atleta dal blocco gara di una partita. Un cambio
// rimasto senza chi esce ne' chi entra non dice piu' niente e sparisce.
// true se ha cambiato qualcosa.
export function purgeGaraAtleta(m, aid) {
  const g = m && m.gara;
  if (!isObj(g)) return false;
  aid = String(aid);
  let dirty = false;
  for (const k of ['convocati', 'titolari']) {
    if (!Array.isArray(g[k])) continue;
    const prima = g[k].length;
    g[k] = g[k].filter(x => String(x) !== aid);
    if (g[k].length !== prima) dirty = true;
  }
  if (Array.isArray(g.espulsioni)) {
    const prima = g.espulsioni.length;
    g.espulsioni = g.espulsioni.filter(e => String(e.athleteId) !== aid);
    if (g.espulsioni.length !== prima) dirty = true;
  }
  if (Array.isArray(g.cambi)) {
    g.cambi.forEach(c => {
      if (String(c.esce) === aid) { c.esce = ''; dirty = true; }
      if (String(c.entra) === aid) { c.entra = ''; dirty = true; }
    });
    g.cambi = g.cambi.filter(c => c.esce || c.entra);
  }
  return dirty;
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `node scripts/test-match-gara.mjs`
Expected: tutte le righe `ok - ...` e `N test superati`, exit code 0. L'avviso `MODULE_TYPELESS_PACKAGE_JSON` è normale: lo stampa anche `_sa-auth.js`.

- [ ] **Step 5: Commit**

```bash
git add api/_match-gara.js scripts/test-match-gara.mjs
git commit -m "feat(api): funzioni pure per salvare la gara in Risultati (patch, sanifica, purge)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- api/_match-gara.js scripts/test-match-gara.mjs
```

---

### Task 4: `api/data.js`: azione `match-gara`, `matchResultsPatch`, purge

**Files:**
- Modify: `api/data.js`. Import in cima (righe 1-6); `purgeAthlete` sez. 5 (~408-423); blocco `purge-athlete` (~1064); POST generico (~3812-3835 e la risposta ~3889).

- [ ] **Step 1: Import**

Dopo `import { hashPasswordScrypt } from './auth/_password.js';` aggiungi:

```js
import { applyMatchPatch, sanificaDatiGara, sanificaNuova, applicaGara, purgeGaraAtleta } from './_match-gara.js';
```

- [ ] **Step 2: purgeAthlete pulisce anche `gara`**

Nella sezione `// 5. matchResults ...` di `purgeAthlete`, dentro il `for (const mid ...)`, dopo il `for (const list of [...]) {...}` aggiungi:

```js
      // Il blocco di Andamento Gara (convocati, titolari, cambi, espulsioni)
      if (purgeGaraAtleta(m, aid)) dirty = true;
```

- [ ] **Step 3: Azione `match-gara`**

Subito **prima** del commento `// ── R2: cancellazione atleta che propaga (GDPR art. 17)` aggiungi:

```js
// ── Andamento Gara -> Risultati ──────────────────────────────────────────────
// La gara (PWA /gara/) salva UNA partita: punteggio, marcatori, cartellini e
// il blocco `gara`. Non passa per il POST generico, che riscrive tutto
// matchResults: la gara non ha in memoria i Risultati completi e aggiornati.
// matchId assente = gara fuori calendario: si crea la partita da `nuova`.
if (req.query?.action === 'match-gara' && req.method === 'POST') {
  if (!session.isAuthenticated || !canWrite(session.role)) {
    return res.status(403).json({ success: false, message: 'Permesso negato: il tuo ruolo non può modificare i Risultati' });
  }
  if (!annataId || !isValidId(annataId)) {
    return res.status(400).json({ success: false, message: 'Annata non impostata' });
  }
  const body = req.body || {};
  const dati = sanificaDatiGara(body.dati);
  if (!dati) return res.status(400).json({ success: false, message: 'Dati gara non validi' });
  try {
    const key = `annate:${annataId}:matchResults`;
    const all = (await kv.get(key)) || {};
    let id = body.matchId != null && body.matchId !== '' ? String(body.matchId) : '';
    if (id) {
      if (id === '__proto__' || id === 'constructor' || id === 'prototype' || !all[id] || typeof all[id] !== 'object') {
        return res.status(404).json({ success: false, message: 'La partita non è più in Risultati (forse è stata eliminata): scegline un\'altra in Dati gara.' });
      }
    } else {
      const nuova = sanificaNuova(body.nuova);
      if (!nuova) return res.status(400).json({ success: false, message: 'Per aggiungere la partita servono data e avversario (Dati gara).' });
      id = String(Date.now());
      while (all[id]) id = String(Number(id) + 1);
      all[id] = Object.assign({ id, scorers: [], assists: [], cards: [] }, nuova);
    }
    all[id] = applicaGara(all[id], dati, session.username);
    await kv.set(key, all);
    console.log(`POST match-gara - annata=${annataId} match=${id} user=${session.username}`);
    return res.status(200).json({ success: true, matchId: id, match: all[id] });
  } catch (e) {
    console.error('[match-gara]', e?.message || e);
    return res.status(500).json({ success: false, message: 'Errore del server: la gara resta sul telefono, riprova.' });
  }
}
```

Prima di scrivere, verifica nel codice che nel punto d'inserimento siano già definiti `session`, `annataId`, `isValidId`, `canWrite` e `kv`. Sono le stesse variabili usate dal blocco `purge-athlete` subito dopo.

- [ ] **Step 4: `matchResultsPatch` nel POST generico**

Sostituisci la riga:

```js
if (body.matchResults !== undefined) await kv.set(`${prefix}:matchResults`, body.matchResults);
```

con:

```js
if (body.matchResults !== undefined) await kv.set(`${prefix}:matchResults`, body.matchResults);
// Come le valutazioni: il client manda i Risultati come DIFFERENZA per
// partita e per campo. Un PC aperto da ore riscriveva tutto matchResults e
// cancellava la gara salvata nel frattempo dal telefono (?action=match-gara).
// body.matchResults resta per ripristino backup, cambio stagione e client vecchi.
let mergedMatchResults;
if (body.matchResultsPatch && typeof body.matchResultsPatch === 'object' && body.matchResults === undefined) {
  const cur = (await kv.get(`${prefix}:matchResults`)) || {};
  applyMatchPatch(cur, body.matchResultsPatch);
  await kv.set(`${prefix}:matchResults`, cur);
  mergedMatchResults = cur;
}
```

E sostituisci la risposta finale del POST generico:

```js
return res.status(200).json(mergedEvaluations ? { success: true, evaluations: mergedEvaluations } : { success: true });
```

con:

```js
const out = { success: true };
if (mergedEvaluations) out.evaluations = mergedEvaluations;
if (mergedMatchResults) out.matchResults = mergedMatchResults;
return res.status(200).json(out);
```

- [ ] **Step 5: Controllo sintassi**

Run: `cd "/d/EDY/Go Calcio/Valutazione Atleti/Vercel/App-Allenatori_VR3/AppAllenamentoR1" && node --check api/data.js && node scripts/test-match-gara.mjs`
Expected: nessun errore di sintassi; test verdi.

Se `node --check` si lamenta di `import` (file ESM senza `"type"`), usa al suo posto: `node --input-type=module -e "import('./api/data.js').catch(e=>{ if (e instanceof SyntaxError) { console.error(e); process.exit(1) } console.log('sintassi ok (errore runtime atteso senza env):', e.message) })"`

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(api): ?action=match-gara salva una partita dalla gara; matchResultsPatch contro il lost update; purge del blocco gara

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- api/data.js
```

---

### Task 5: `public/script.js`: patch dei Risultati e submit che conserva i campi

**Files:**
- Modify: `public/script.js`. Stato (~702, accanto a `evalBase`); `saveData` (~749-818); caricamento (~1415-1422 e ~1449-1453); submit di `#match-result-form` (~7360-7397).
- Modify: `public/index.html` (~3435-3437)

- [ ] **Step 1: Carica il modulo nell'app principale**

In `public/index.html`, subito prima di `<script src="import-partite.js?v=1"></script>` aggiungi:

```html
<script src="/gara/gara-risultati.js?v=1"></script>
```

Poi porta `script.js?v=1781800001` a `script.js?v=1781800002`.

- [ ] **Step 2: Base dei Risultati**

In `script.js`, subito dopo `let evalBase = {};`, aggiungi:

```js
    // Stessa protezione per i Risultati: la gara (telefono) salva una partita
    // con ?action=match-gara mentre il PC ha matchResults aperto da ore.
    // Mandare tutto l'oggetto la cancellava; si manda la differenza.
    let matchResultsBase = {};
```

- [ ] **Step 3: saveData manda la patch**

In `saveData`, dopo `const evaluationsPatch = diffEvaluations(evalBase, evalInviate);` aggiungi:

```js
        const mrInviati = cloneJson(matchResults);
        const matchResultsPatch = window.GaraRisultati
            ? window.GaraRisultati.diffMatchResults(matchResultsBase, mrInviati) : undefined;
```

Nell'oggetto `allData` togli la riga `matchResults,` e dopo `if (evaluationsPatch) allData.evaluationsPatch = evaluationsPatch;` aggiungi:

```js
        // Senza il modulo (non dovrebbe succedere) si torna all'invio intero
        if (matchResultsPatch === undefined) allData.matchResults = matchResults;
        else if (matchResultsPatch) allData.matchResultsPatch = matchResultsPatch;
```

Dopo il blocco `if (risposta && risposta.evaluations ...) {...} else {...}` aggiungi:

```js
            // I Risultati uniti dal server (anche la gara salvata dal telefono)
            // diventano la base; sopra si rimettono le modifiche fatte durante
            // l'attesa. Si aggiorna l'oggetto SUL POSTO: window.matchResults e
            // gli altri moduli ne tengono il riferimento.
            if (risposta && risposta.matchResults && typeof risposta.matchResults === 'object' && window.GaraRisultati) {
                const GR = window.GaraRisultati;
                const locali = GR.diffMatchResults(mrInviati, matchResults);
                matchResultsBase = cloneJson(risposta.matchResults);
                const unito = GR.applyMatchPatch(cloneJson(risposta.matchResults), locali);
                Object.keys(matchResults).forEach(k => { delete matchResults[k]; });
                Object.assign(matchResults, unito);
            } else if (matchResultsPatch !== undefined) {
                matchResultsBase = mrInviati;
            }
```

- [ ] **Step 4: Base al caricamento e al reset**

Subito dopo il ciclo che aggiunge `assists = []` (`for (const matchId in matchResults) { ... }`, ~1415-1419), aggiungi:

```js
            // Dopo la normalizzazione: altrimenti il primo salvataggio
            // manderebbe come "modificate" tutte le partite senza assists.
            matchResultsBase = cloneJson(matchResults);
```

Nel ramo d'errore che azzera (`matchResults = {};`, ~1452) aggiungi subito dopo:

```js
            matchResultsBase = {};
```

- [ ] **Step 5: Il submit conserva `gara` e i campi sconosciuti**

Nel submit di `#match-result-form`, sostituisci:

```js
        const matchData = {
            id: id,
```

con:

```js
        // Si parte dalla partita salvata: il form non conosce tutti i campi
        // (il blocco `gara` di Andamento Gara, campi futuri) e ricostruire
        // l'oggetto da zero li cancellava.
        const precedente = matchResults[id] || {};
        const matchData = Object.assign({}, precedente, {
            id: id,
```

Chiudi l'`Object.assign`: la riga `            cards: []` seguita da `        };` diventa:

```js
            cards: []
        });
```

Subito prima di `matchResults[id] = matchData;` aggiungi:

```js
        // Formazione e sostituzioni modificate nel pannello (risultati-gara.js).
        // undefined = sezione mai aperta: resta il blocco gara di prima.
        const garaModificata = window.RisultatiGara ? window.RisultatiGara.leggi() : undefined;
        if (garaModificata) matchData.gara = garaModificata;
        else if (garaModificata === null) delete matchData.gara;
```

- [ ] **Step 6: Verifica Playwright della patch**

Apri `http://127.0.0.1:8765/` (server del Task 2) in un contesto nuovo.
1. Mock di `**/api/data*`:
   - GET: risponde con `athletes` (3 atleti), `matchResults: {'1': {id:1,date:'2026-11-08',opponentName:'X',location:'home',homeScore:null,awayScore:null,scorers:[],assists:[],cards:[],gara:{titolari:['a1']}}}` e il resto vuoto;
   - POST: salva il body in `window.__ultimoPost` lato test e risponde con `{success:true, matchResults: <match del GET + homeScore modificato>}`.
2. Simula il login con le chiavi `localStorage`/`sessionStorage` usate nei test Playwright precedenti, cioè lo stesso setup della verifica Convocazioni/Distinta. Imposta `currentAnnata`.
3. Esegui in pagina: `matchResults['1'].homeScore = 3; await saveData();`.
4. Verifica:
   - il body POST NON contiene `matchResults`;
   - contiene `matchResultsPatch: {'1': {homeScore: 3}}`;
   - `matchResults['1'].gara` esiste ancora.
5. Apri la partita dal pannello Risultati, premi "Salva Partita" senza toccare niente, e verifica che `matchResults['1'].gara` esista ancora.

- [ ] **Step 7: Commit**

```bash
git commit -m "fix(risultati): salvataggio a differenza (matchResultsPatch) e submit che conserva il blocco gara

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- public/script.js public/index.html
```

---

### Task 6: Gara → Dati gara: tendina "Prendi dal calendario"

**Files:**
- Modify: `public/gara/index.html`: card `#page-dati` (~469); oggetto `info` (~698); `caricaRosa` (~2409-2425); init listener (~3000-3015).

- [ ] **Step 1: Markup**

In `#page-dati`, subito dopo `<h2>&#128203; Dati gara</h2>`, aggiungi:

```html
        <div class="gg-field">
          <label>Prendi dal calendario</label>
          <select id="infoPartita"><option value="">Caricamento partite&hellip;</option></select>
          <div class="gg-hint" id="infoPartitaHint"></div>
        </div>
```

- [ ] **Step 2: Campi nuovi di `info`**

Nell'oggetto `let info = { casa:'', ospite:'', ... }`, aggiungi alla prima riga dopo `arbitro:'',`:

```js
  matchId:'', salvataNeiRisultati:'',
```

`caricaStato` fa `Object.assign(info, st.info)`: gli stati vecchi senza questi campi tengono i default.

- [ ] **Step 3: Stato e render della tendina**

Subito prima di `// ── Caricamento rosa da Gestione Squadra`, aggiungi:

```js
// ── Partite di Risultati (tendina "Prendi dal calendario") ─────────────
// null = non caricate (rete, sessione o annata mancante); {} = annata senza
// partite. Si distinguono perche' il messaggio da dare e' diverso.
let partiteRisultati = null;

function renderTendinaPartite() {
  const sel = document.getElementById('infoPartita');
  const hint = document.getElementById('infoPartitaHint');
  if (!sel || !hint) return;
  if (partiteRisultati == null) {
    sel.innerHTML = '<option value="">— Partite non disponibili —</option>';
    sel.disabled = true;
    hint.textContent = annataId()
      ? 'Partite di Risultati non caricate: controlla la connessione e riapri la pagina.'
      : 'Annata non impostata: apri Andamento Gara da Sport Monitoring → Area Tecnica.';
    return;
  }
  const lista = GaraRisultati.elencoPartite(partiteRisultati);
  sel.disabled = false;
  sel.innerHTML = '<option value="">— Gara non collegata a Risultati —</option>' +
    lista.map(x => '<option value="' + esc(x.id) + '">' + esc(GaraRisultati.etichettaPartita(x.match)) + '</option>').join('');
  const legata = info.matchId && partiteRisultati[info.matchId];
  sel.value = legata ? String(info.matchId) : '';
  hint.textContent = !lista.length
    ? 'Nessuna partita in Risultati per questa annata: dal Report potrai aggiungerla.'
    : info.matchId && !legata
      ? 'La partita collegata non è più in Risultati: scegline un\'altra.'
      : legata ? 'Collegata a: ' + GaraRisultati.etichettaPartita(legata) : '';
}

// Scegliere una partita compila i Dati gara; restano modificabili a mano, e
// cambiarli non scollega la partita (lo dice la riga sotto la tendina).
function scegliPartita(id) {
  if (!id) { info.matchId = ''; salvaStato(); renderTendinaPartite(); return; }
  const m = partiteRisultati && partiteRisultati[id];
  if (!m) return;
  info.matchId = String(id);
  if (m.opponentName) info.ospite = m.opponentName;
  if (m.date) info.data = m.date;
  if (m.time) info.ora = String(m.time).slice(0, 5);
  if (m.venue) info.luogo = m.venue;
  if (m.location === 'home' || m.location === 'away') info.noiCasa = m.location === 'home' ? '1' : '0';
  scriviInfoNeiCampi();
  salvaStato();
  renderTendinaPartite();
}
```

- [ ] **Step 4: Alimenta la tendina da `caricaRosa`**

In `caricaRosa`:
- in **ciascuno** dei rami d'errore (i due `mostraRosaVuota(...)` dentro `if (!res.ok)` e quello del `catch`), aggiungi `partiteRisultati = null; renderTendinaPartite();` prima del `return;`;
- subito dopo `data = await res.json();` (fuori dal try, cioè dopo il blocco try/catch) aggiungi:

```js
  // Le partite arrivano con la rosa: senza annata la risposta non ha
  // 'athletes' ne' 'matchResults' (bacheca globale) -> null, non lista vuota.
  partiteRisultati = (data && Array.isArray(data.athletes))
    ? ((data.matchResults && typeof data.matchResults === 'object') ? data.matchResults : {})
    : null;
  renderTendinaPartite();
```

- [ ] **Step 5: Listener**

Accanto agli altri listener dell'init (vicino a `document.getElementById('btnGenPdf').addEventListener(...)`):

```js
  document.getElementById('infoPartita').addEventListener('change', e => scegliPartita(e.target.value));
```

- [ ] **Step 6: Verifica Playwright**

Usa il setup del Task 2 Step 5, con `matchResults` nel mock:

```js
{ '100': { id:100, date:'2026-11-08', time:'17:00', venue:'Campo Comunale', opponentName:'Olympic Collegno', location:'away', scorers:[], assists:[], cards:[] } }
```

Vai su Dati gara (`vaiA('dati')`) e verifica:
1. la tendina contiene `dom 08/11 · 17:00 · ✈️ Olympic Collegno`;
2. dopo averla scelta:
   - `infoOspite` vale `Olympic Collegno`
   - `infoData` vale `2026-11-08`
   - `infoNoiCasa` vale `0`
   - `info.matchId === '100'`
3. dopo un reload la scelta è ancora lì;
4. con il mock GET senza `athletes` la tendina è disabilitata e mostra il messaggio "Annata non impostata…" oppure "non caricate…".

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(gara): Dati gara, tendina Prendi dal calendario dalle partite di Risultati

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- public/gara/index.html
```

---

### Task 7: Gara → Report: "💾 Salva nei Risultati"

**Files:**
- Modify: `public/gara/index.html`: dopo `#btnGenPdf` (~593); funzioni nuove vicino a `generaPdf`; listener init (~3011); render iniziale.

- [ ] **Step 1: Markup**

Subito dopo la riga del pulsante `btnGenPdf` aggiungi:

```html
        <button type="button" class="gg-btn" id="btnSalvaRisultati" style="width:100%;margin-top:10px;">&#128190; Salva nei Risultati</button>
        <div class="gg-hint" id="salvaRisultatiHint" style="margin-top:6px;"></div>
```

- [ ] **Step 2: Funzioni**

Subito prima di `function generaPdf` aggiungi:

```js
// ── Salva nei Risultati ────────────────────────────────────────────────
// La gara vive solo nel localStorage del telefono e "Azzera la gara" la
// cancella: questo pulsante la mette al sicuro nella partita di Risultati.
function renderSalvaRisultati() {
  const h = document.getElementById('salvaRisultatiHint');
  if (!h) return;
  if (info.salvataNeiRisultati) {
    const d = new Date(info.salvataNeiRisultati);
    h.textContent = 'Ultimo salvataggio in Risultati: ' + (isNaN(d) ? info.salvataNeiRisultati :
      d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })) +
      '. Se correggi la gara, salva di nuovo.';
  } else {
    h.textContent = 'Non ancora salvata in Risultati: dopo "Azzera la gara" resterebbe solo il PDF.';
  }
}

// Durata di OGNI tempo (0 = non giocato, il cronometro per quello in corso):
// salvando a meta' partita Risultati non deve contare i tempi futuri.
function durateDaSalvare() {
  const out = {};
  for (let p = 1; p <= numTempi(); p++) out[p] = durataTempo(p);
  return out;
}

async function salvaNeiRisultati() {
  const btn = document.getElementById('btnSalvaRisultati');
  if (!btn || btn.disabled) return;
  if (!annataId()) { toast('Annata non impostata: apri Andamento Gara da Sport Monitoring → Area Tecnica.'); return; }
  btn.disabled = true;
  try {
    // 1. Partite fresche: un altro dispositivo puo' averle cambiate da quando
    //    la pagina e' aperta, e il confronto va fatto su quelle vere.
    let partite;
    try {
      const res = await fetch('/api/data', { headers: authHeaders() });
      if (res.status === 401 || res.status === 403) {
        toast('Sessione scaduta: entra in Sport Monitoring e riprova. La gara resta sul telefono.');
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      if (!d || !Array.isArray(d.athletes)) {
        toast('Annata non riconosciuta dal server: riapri Andamento Gara da Sport Monitoring.');
        return;
      }
      partite = (d.matchResults && typeof d.matchResults === 'object') ? d.matchResults : {};
      partiteRisultati = partite;
      renderTendinaPartite();
    } catch (e) {
      toast('Connessione assente: la gara resta sul telefono, riprova quando c\'è rete.');
      return;
    }

    // 2. Senza titolari il minutaggio e' incompleto: lo si dice prima.
    if (!titolari().length &&
        !confirm('Titolari non schierati: il minutaggio sarà incompleto.\n\n' +
                 'OK = salva comunque\nAnnulla = torno alla Rosa per schierarli (pulsante XI)')) {
      vaiA('rosa');
      return;
    }

    // 3. Destinazione: partita legata, oppure stessa data + avversario,
    //    oppure nuova partita.
    const t = GaraRisultati.trovaPartita(partite, { matchId: info.matchId, data: info.data, avversario: nomeAvversaria() });
    const noiCasa = info.noiCasa === '1' || info.noiCasa === 1;
    let matchId = null, nuova = null;
    if (t.modo === 'legata') {
      matchId = t.id;
    } else if (t.modo === 'trovata') {
      if (!confirm('Salvo su ' + GaraRisultati.etichettaPartita(t.match) + '?')) return;
      matchId = t.id;
    } else {
      if (!info.data || !nomeAvversaria()) {
        toast('Per aggiungerla ai Risultati servono data e avversario: compilali in Dati gara.');
        vaiA('dati');
        return;
      }
      if (!confirm('Questa gara non è in Risultati: la aggiungo come nuova partita?')) return;
      nuova = { date: info.data, time: info.ora || '', venue: info.luogo || '',
                opponentName: nomeAvversaria(), location: noiCasa ? 'home' : 'away' };
    }

    const dati = GaraRisultati.datiDaGara({
      noiCasa, golNoi: scoreHome, golLoro: scoreAway, eventi: events,
      convocati: convocati().map(p => String(p.id)), titolari: titolari().map(p => String(p.id)),
      numTempi: numTempi(), durata: Number(info.durata) || 45, durateTempi: durateDaSalvare(),
      adesso: new Date().toISOString()
    });

    // 4. Dati gia' presenti in Risultati (scritti a mano o da un salvataggio
    //    precedente poi corretto): niente sovrascritture in silenzio.
    if (t.match) {
      const diff = GaraRisultati.differenze(t.match, dati, nomeGiocatore);
      if (diff.length && !confirm('La partita in Risultati ha già dei dati diversi:\n\n' + diff.join('\n') +
                                  '\n\nOK = sostituisci con i dati della gara\nAnnulla = non salvare')) return;
    }

    // 5. Scrittura di UNA partita
    let res, out = null;
    try {
      res = await fetch('/api/data?action=match-gara', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ matchId, nuova, dati })
      });
      try { out = await res.json(); } catch (_) {}
    } catch (e) {
      toast('Connessione assente: la gara resta sul telefono, riprova quando c\'è rete.');
      return;
    }
    if (!res.ok || !out || !out.success) {
      toast((out && out.message) || ('Salvataggio non riuscito (errore ' + res.status + '). La gara resta sul telefono.'));
      return;
    }
    partiteRisultati[out.matchId] = out.match;
    info.matchId = String(out.matchId);
    info.salvataNeiRisultati = new Date().toISOString();
    salvaStato();
    renderTendinaPartite();
    renderSalvaRisultati();
    toast('Gara salvata nei Risultati ✓');
  } finally {
    btn.disabled = false;
  }
}
```

Prima di scrivere, verifica con `grep -n "function nomeGiocatore\|function convocati\|function titolari\|function toast\|function authHeaders" public/gara/index.html` che le funzioni chiamate esistano con questi nomi. Le ha già trovate l'analisi: `nomeGiocatore(id)` ~2000, `convocati()` 1508, `titolari()` 1517, `toast`, `authHeaders` ~671.

- [ ] **Step 3: Listener e render iniziale**

Dopo `document.getElementById('btnGenPdf').addEventListener('click', generaPdf);` aggiungi:

```js
  document.getElementById('btnSalvaRisultati').addEventListener('click', salvaNeiRisultati);
  renderSalvaRisultati();
```

- [ ] **Step 4: Verifica Playwright**

Setup del Task 6. Mock POST `**/api/data?action=match-gara*`: salva il body in `window.__garaPost` lato test e risponde `{success:true, matchId:'100', match:{...body.dati, id:100}}`.

Scenari:
1. **Gara legata, Risultati vuoti.**
   - Tendina su 100, 2 convocati, XI con `a1`, gol di `a1`, punteggio 1-0, "Salva nei Risultati".
   - Atteso: nessun confirm sulle differenze; body `{matchId:'100', nuova:null}`; `dati.scorers = [{athleteId:'a1', minute:...}]`; `homeScore=0`, `awayScore=1` (trasferta); toast di conferma; il testo dell'hint contiene "Ultimo salvataggio".
2. **Differenze.** Il GET restituisce la partita 100 con `scorers: [{athleteId:'a2', minute:'5'}]`.
   - Atteso: compare un confirm (`page.on('dialog')`) con "Marcatori in Risultati".
   - Con dismiss: nessun POST.
3. **Senza XI.** Nessun titolare.
   - Atteso: confirm "Titolari non schierati"; con dismiss si va sulla pagina Rosa e nessun POST.
4. **Fuori calendario.** `info.matchId=''`, avversario "Nuovi", data valorizzata, GET senza partite.
   - Atteso: confirm "non è in Risultati"; con accept, body `{matchId:null, nuova:{opponentName:'Nuovi',...}}`.
5. **Rete giù.** Il route del POST fa `abort`.
   - Atteso: toast "Connessione assente" e pulsante di nuovo abilitato.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(gara): Report, Salva nei Risultati (partita legata/trovata/nuova, conferma differenze, avviso senza XI)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- public/gara/index.html
```

---

### Task 8: Risultati: sezioni gara nel pannello "Modifica Risultato Partita"

**Files:**
- Create: `public/risultati-gara.js`
- Modify: `public/script.js`, `openMatchResultModal` (~7225-7254)
- Modify: `public/index.html` (tag script + bump)

- [ ] **Step 1: Scrivi il modulo UI**

Crea `public/risultati-gara.js`:

```js
// Pannello "Modifica Risultato Partita": dati di Andamento Gara.
// Formazione e sostituzioni si correggono qui; il minutaggio si ricalcola
// sempre (stessa funzione della gara: /gara/gara-risultati.js).
// API: RisultatiGara.apri(match|null) all'apertura del pannello,
// RisultatiGara.leggi() al salvataggio -> blocco gara | null (tolto) |
// undefined (partita senza gara e nessuna formazione aggiunta).
(function () {
  'use strict';
  var GR = window.GaraRisultati;
  var stato = null;        // copia di lavoro del blocco gara
  var matchAperta = null;  // per la cronologia (marcatori e cartellini salvati)

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function atleti() { return Array.isArray(window.athletes) ? window.athletes : []; }
  // Storico: un atleta archiviato o tolto dalla rosa si mostra comunque
  // (mai filtrarlo: e' una partita gia' giocata).
  function nomeDi(id) {
    if (!id) return '—';
    var a = atleti().find(function (x) { return String(x.id) === String(id); });
    return a ? a.name : 'Atleta non più in rosa';
  }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function vuoto() {
    return { convocati: [], titolari: [], cambi: [], espulsioni: [],
             tempi: { numero: 2, durata: 45, durateTempi: {} }, incompleta: false };
  }
  function opzMinuto() {
    return { durata: stato.tempi.durata, numTempi: stato.tempi.numero };
  }
  function ordinaCambi() {
    stato.cambi.sort(function (a, b) {
      return (a.periodo - b.periodo) || (a.min - b.min) || ((a.intervallo ? 0 : 1) - (b.intervallo ? 0 : 1));
    });
  }

  function box() {
    var b = document.getElementById('gara-risultati-box');
    if (b) return b;
    var cards = document.getElementById('cards-container');
    if (!cards) return null;
    var riga = cards.closest('.row') || cards.parentNode;
    b = document.createElement('div');
    b.id = 'gara-risultati-box';
    b.className = 'mt-3';
    riga.parentNode.insertBefore(b, riga.nextSibling);
    b.addEventListener('click', onClick);
    b.addEventListener('change', onChange);
    return b;
  }

  function render() {
    var b = box();
    if (!b) return;
    if (!stato) {
      b.innerHTML = '<button type="button" class="btn btn-sm btn-outline-secondary" data-rg="aggiungi">➕ Aggiungi formazione</button>' +
        '<div class="form-text">Le partite salvate da Andamento Gara hanno già formazione, sostituzioni e minutaggio.</div>';
      return;
    }
    b.innerHTML = sezFormazione() + sezCambi() + sezMinutaggio() + sezCronologia();
  }

  function chip(id, titolare) {
    return '<span class="badge rounded-pill ' + (titolare ? 'text-bg-success' : 'text-bg-secondary') +
      ' me-1 mb-1" style="cursor:pointer;font-size:.85rem;" data-rg="sposta" data-id="' + esc(id) + '" title="Tocca per spostare">' +
      esc(nomeDi(id)) + ' <span data-rg="togli" data-id="' + esc(id) + '" title="Togli dai convocati" style="opacity:.7;">✕</span></span>';
  }

  function sezFormazione() {
    var tit = stato.titolari, pan = stato.convocati.filter(function (id) { return tit.indexOf(id) < 0; });
    var fuori = atleti().filter(function (a) { return !a.isStaff && !a.archived && stato.convocati.indexOf(String(a.id)) < 0; });
    var badge = stato.incompleta && !tit.length
      ? ' <span class="badge text-bg-warning">minutaggio incompleto: titolari non schierati</span>' : '';
    var t = stato.tempi;
    return '<details class="mb-2" open><summary class="fw-semibold">Formazione' + badge + '</summary>' +
      '<div class="d-flex gap-2 align-items-center my-2 flex-wrap">' +
        '<label class="small">Tempi <select class="form-select form-select-sm d-inline-block" style="width:auto;" data-rg="numTempi">' +
        [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (t.numero === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="small">Durata (min) <input type="number" min="1" max="90" class="form-control form-control-sm d-inline-block" style="width:80px;" data-rg="durata" value="' + esc(t.durata) + '"></label>' +
      '</div>' +
      '<div class="small text-muted">Titolari (' + tit.length + ') — tocca un nome per mandarlo in panchina</div>' +
      '<div class="mb-2">' + (tit.map(function (id) { return chip(id, true); }).join('') || '<em class="small">nessuno</em>') + '</div>' +
      '<div class="small text-muted">Panchina (' + pan.length + ')</div>' +
      '<div class="mb-2">' + (pan.map(function (id) { return chip(id, false); }).join('') || '<em class="small">nessuno</em>') + '</div>' +
      '<select class="form-select form-select-sm" data-rg="convoca"><option value="">➕ Aggiungi convocato…</option>' +
        fuori.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') +
      '</select></details>';
  }

  function sezCambi() {
    var opz = function (sel) {
      return '<option value="">—</option>' + stato.convocati.map(function (id) {
        return '<option value="' + esc(id) + '"' + (String(sel) === String(id) ? ' selected' : '') + '>' + esc(nomeDi(id)) + '</option>';
      }).join('');
    };
    var righe = stato.cambi.map(function (c, i) {
      return '<div class="d-flex gap-2 align-items-center mb-1">' +
        '<select class="form-select form-select-sm" data-rg="esce" data-i="' + i + '" title="Esce">' + opz(c.esce) + '</select>' +
        '<span>→</span>' +
        '<select class="form-select form-select-sm" data-rg="entra" data-i="' + i + '" title="Entra">' + opz(c.entra) + '</select>' +
        '<input type="text" class="form-control form-control-sm" style="width:80px;" data-rg="minuto" data-i="' + i + '" value="' +
          esc(c.minuto || (c.min + "'")) + '" placeholder="45+2" title="Minuto: 23, 45+2 o Int.">' +
        '<button type="button" class="btn btn-sm btn-outline-danger" data-rg="delCambio" data-i="' + i + '"><i class="bi bi-trash"></i></button>' +
      '</div>';
    }).join('');
    return '<details class="mb-2" open><summary class="fw-semibold">Sostituzioni (' + stato.cambi.length + ')</summary>' +
      '<div class="small text-muted my-1">Esce → Entra · minuto (23, 45+2, Int.)</div>' + righe +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-rg="addCambio">➕ Aggiungi cambio</button></details>';
  }

  function sezMinutaggio() {
    var mm = GR.minutaggioPartita(stato);
    var max = (stato.tempi.durata || 45) * 60 * (stato.tempi.numero || 2);
    var righe = stato.convocati.map(function (id) { return [id, (mm[id] && mm[id].tot) || 0]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (r) {
        var min = Math.round(r[1] / 60);
        var pct = max ? Math.min(100, Math.round(r[1] / max * 100)) : 0;
        return '<div class="d-flex align-items-center gap-2 small mb-1">' +
          '<span style="width:40%;" class="text-truncate">' + esc(nomeDi(r[0])) + '</span>' +
          '<span style="width:3.5em;text-align:right;font-variant-numeric:tabular-nums;">' + (r[1] ? (min < 1 ? '<1' : min) + "'" : '–') + '</span>' +
          '<span class="flex-grow-1" style="background:rgba(25,135,84,.15);height:8px;border-radius:4px;">' +
            '<span style="display:block;width:' + pct + '%;height:100%;background:#198754;border-radius:4px;"></span></span>' +
        '</div>';
      }).join('');
    return '<details class="mb-2"><summary class="fw-semibold">Minutaggio</summary>' +
      '<div class="form-text mb-1">Calcolato da titolari, cambi ed espulsioni: si aggiorna da solo.</div>' +
      (righe || '<em class="small">Nessun convocato.</em>') + '</details>';
  }

  function sezCronologia() {
    var m = matchAperta || {};
    var voci = [];
    (m.scorers || []).forEach(function (s) { voci.push({ min: Number(s.minute) || 0, ord: 0, txt: '⚽ ' + s.minute + "' " + nomeDi(s.athleteId) }); });
    (m.cards || []).forEach(function (c) { voci.push({ min: Number(c.minute) || 0, ord: 1, txt: (c.type === 'red' ? '🟥 ' : '🟨 ') + c.minute + "' " + nomeDi(c.athleteId) }); });
    stato.cambi.forEach(function (c) {
      voci.push({ min: c.min, ord: c.intervallo ? 2 : 1, txt: '🔄 ' + (c.minuto || c.min + "'") + ' esce ' + nomeDi(c.esce) + ', entra ' + nomeDi(c.entra) });
    });
    voci.sort(function (a, b) { return a.min - b.min || a.ord - b.ord; });
    return '<details class="mb-2"><summary class="fw-semibold">Cronologia</summary>' +
      '<div class="form-text mb-1">Gol e cartellini come salvati (le modifiche sopra valgono dopo "Salva Partita").</div>' +
      (voci.map(function (v) { return '<div class="small">' + esc(v.txt) + '</div>'; }).join('') || '<em class="small">Nessun evento.</em>') +
      '</details>';
  }

  function onClick(e) {
    var el = e.target.closest('[data-rg]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
    var az = el.dataset.rg, id = el.dataset.id;
    if (az === 'aggiungi') { stato = vuoto(); }
    else if (az === 'togli') {
      e.stopPropagation();
      stato.convocati = stato.convocati.filter(function (x) { return x !== id; });
      stato.titolari = stato.titolari.filter(function (x) { return x !== id; });
    }
    else if (az === 'sposta') {
      var i = stato.titolari.indexOf(id);
      if (i >= 0) stato.titolari.splice(i, 1); else stato.titolari.push(id);
    }
    else if (az === 'addCambio') {
      var mi = GR.leggiMinutoTesto(String(stato.tempi.durata), opzMinuto()) || { min: 1, minuto: "1'", periodo: 1, intervallo: false };
      stato.cambi.push(Object.assign({ esce: '', entra: '' }, mi));
    }
    else if (az === 'delCambio') { stato.cambi.splice(Number(el.dataset.i), 1); }
    else return;
    render();
  }

  function onChange(e) {
    var el = e.target, az = el.dataset.rg;
    if (!az || !stato) return;
    var i = Number(el.dataset.i);
    if (az === 'convoca' && el.value) { stato.convocati.push(String(el.value)); }
    else if (az === 'esce' || az === 'entra') { stato.cambi[i][az] = el.value; }
    else if (az === 'minuto') {
      var mi = GR.leggiMinutoTesto(el.value, opzMinuto());
      if (!mi) { el.classList.add('is-invalid'); el.title = 'Minuto non valido: usa 23, 45+2 o Int.'; return; }
      // Minuto scritto a mano: il secondo esatto del cronometro non vale piu'
      var c = stato.cambi[i];
      delete c.sec;
      delete c.intervallo;
      Object.assign(c, mi);
      if (!mi.intervallo) delete c.intervallo;
      ordinaCambi();
    }
    else if (az === 'numTempi') { stato.tempi.numero = Number(el.value) || 2; }
    else if (az === 'durata') { stato.tempi.durata = Math.max(1, Math.min(90, Number(el.value) || 45)); }
    else return;
    render();
  }

  window.RisultatiGara = {
    apri: function (match) {
      matchAperta = match || null;
      stato = match && match.gara ? clone(match.gara) : null;
      if (stato) {
        stato.convocati = (stato.convocati || []).map(String);
        stato.titolari = (stato.titolari || []).map(String);
        stato.cambi = stato.cambi || [];
        stato.espulsioni = stato.espulsioni || [];
        stato.tempi = Object.assign({ numero: 2, durata: 45, durateTempi: {} }, stato.tempi || {});
      }
      render();
    },
    leggi: function () {
      if (!stato) return matchAperta && matchAperta.gara ? null : undefined;
      // Titolari fuori dai convocati non hanno senso: si allineano
      stato.titolari = stato.titolari.filter(function (id) { return stato.convocati.indexOf(id) >= 0; });
      // Una formazione corretta a mano con l'XI torna completa
      if (stato.titolari.length) stato.incompleta = false;
      return clone(stato);
    }
  };
})();
```

Nota su `leggi()`: oggi `stato` diventa `null` solo se la partita non aveva `gara`, quindi `null` non viene mai restituito per una partita che ce l'aveva (non c'è un pulsante "rimuovi"). Il ramo resta per coerenza con l'API documentata.

- [ ] **Step 2: Aggancia all'apertura del pannello**

In `openMatchResultModal`, subito prima di `matchResultModal.show();` aggiungi:

```js
        // Formazione, sostituzioni e minutaggio di Andamento Gara (risultati-gara.js)
        if (window.RisultatiGara) window.RisultatiGara.apri(matchId && matchResults[matchId] ? matchResults[matchId] : null);
```

- [ ] **Step 3: Carica il modulo e fai il bump**

In `public/index.html`, subito dopo `<script src="/gara/gara-risultati.js?v=1"></script>` (aggiunto nel Task 5) aggiungi:

```html
<script src="risultati-gara.js?v=1"></script>
```

e porta `script.js?v=1781800002` a `script.js?v=1781800003`.

- [ ] **Step 4: Verifica Playwright**

Setup del Task 5 Step 6. La partita 1 ha questo blocco `gara`:

```js
{ convocati:['a1','a2','a3'], titolari:['a1','a2'], cambi:[{esce:'a2',entra:'a3',min:30,minuto:"30'",periodo:1,sec:1800}], espulsioni:[], tempi:{numero:2,durata:45,durateTempi:{1:2700,2:2700}}, incompleta:false }
```

Apri il pannello della partita 1 e verifica:
1. Sezioni Formazione/Sostituzioni/Minutaggio/Cronologia visibili; il minutaggio mostra `a1` 90', `a2` 30', `a3` 60'.
2. Tocco sul nome `a2` (titolari → panchina): il minutaggio di `a2` resta 30', perché il cambio lo chiude comunque. Il tocco su `a3` lo porta fra i titolari: 90'.
3. Minuto del cambio portato a `Int.`, poi Salva Partita:
   - `matchResults['1'].gara.cambi[0]` vale `{min:45, periodo:2, intervallo:true}` e non ha `sec`;
   - il body POST contiene `matchResultsPatch['1'].gara`.
4. Minuto `abc` → input rosso, cambio invariato.
5. Partita **senza** `gara`: compare "➕ Aggiungi formazione"; aggiungi un convocato e salva → `gara` creato.
6. Partita senza gara, aperta e salvata senza toccare niente → nessun campo `gara`.
7. Un id di convocato che non è in `athletes` → "Atleta non più in rosa", nessun errore.
8. Screenshot del pannello a 390px di larghezza (telefono): niente scroll orizzontale nelle righe dei cambi.

Se le righe Esce/Entra/minuto sforano a 390px, aggiungi `flex-wrap` alla riga del cambio e `style="min-width:0"` alle select.

- [ ] **Step 5: Commit**

```bash
git add public/risultati-gara.js
git commit -m "feat(risultati): formazione, sostituzioni modificabili, minutaggio e cronologia di Andamento Gara nel pannello partita

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- public/risultati-gara.js public/script.js public/index.html
```

---

### Task 9: Verifica finale, grafo, memoria

**Files:**
- Modify: `graphify-out/` (via `graphify update .`)
- Modify: memoria `project_gara_nei_risultati.md` + riga in `MEMORY.md`

- [ ] **Step 1: Tutti i test node**

Run: `cd "/d/EDY/Go Calcio/Valutazione Atleti/Vercel/App-Allenatori_VR3/AppAllenamentoR1" && node scripts/test-gara-risultati.mjs && node scripts/test-match-gara.mjs`
Expected: entrambi `N test superati`.

- [ ] **Step 2: Giro completo in Playwright (scenari dello spec)**

Simula il percorso telefono → server → PC con un mock KV in memoria lato test: un oggetto `kv` nella funzione di route. Il route di `**/api/data*` funziona così:
- GET: restituisce `athletes` + `matchResults` dal mock;
- `?action=match-gara`: riproduce l'azione, cioè applica `dati` alla partita del mock (`Object.assign` di `homeScore/awayScore/scorers/cards/gara`);
- POST generico: applica `matchResultsPatch` con la stessa semantica di `applyMatchPatch`.

Scenari, uno per riga di "Test" dello spec:
1. Gara legata da tendina → salva → in Risultati la card ha punteggio e marcatori giusti e il pannello ha le sezioni compilate.
2. Risultati con dati manuali → la conferma mostra le differenze; Annulla non scrive.
3. Gara non legata con partita esistente per data+avversario → proposta "Salvo su …".
4. Gara fuori calendario → nuova partita presente nel mock e in Classifica Marcatori dopo il reload dell'app principale.
5. Senza XI → avviso; "Salva comunque" → badge "minutaggio incompleto" nel pannello.
6. Nel pannello: spostare un titolare o cambiare il minuto di un cambio → minutaggio ricalcolato.
7. Concorrenza:
   - la pagina principale carica i Risultati;
   - poi la gara salva la partita 100;
   - poi la pagina principale modifica e salva la partita 200 senza ricaricare.

   Atteso: nel mock la partita 100 ha ancora `gara` e la 200 ha la modifica.
8. purgeAthlete è coperto dal test node del Task 3 (`purgeGaraAtleta`) e dalla chiamata in `purgeAthlete` (verifica con `grep -n "purgeGaraAtleta" api/data.js`: 2 righe, import + uso).

Annota nel rapporto finale quali scenari sono passati e con quale evidenza (screenshot o valori letti).

- [ ] **Step 3: Aggiorna il grafo**

Run: `cd "/d/EDY/Go Calcio/Valutazione Atleti/Vercel/App-Allenatori_VR3/AppAllenamentoR1" && graphify update .`
Expected: aggiornamento AST completato senza errori.

- [ ] **Step 4: Memoria**

Aggiorna `C:\Users\edy_f\.claude\projects\d--EDY-Go-Calcio-Valutazione-Atleti-Vercel-App-Allenatori-VR3-AppAllenamentoR1\memory\project_gara_nei_risultati.md`:
- stato **IMPLEMENTATO, non deployato**, con i commit;
- le trappole:
  - `minute`/`type` e non `min`/`tipo`;
  - patch per campo, che non resuscita partite senza `date`;
  - le durate di tutti i tempi salvate (0 = non giocato);
  - il modulo condiviso sta in `/gara/` per la cache del SW;
  - il submit di Risultati ora parte dalla partita salvata.

Nella riga esistente di `MEMORY.md` sostituisci "BRAINSTORMING chiuso 2026-11-07, spec approvata, da pianificare (writing-plans)" con lo stato nuovo. Una sola riga, nessun duplicato.

- [ ] **Step 5: Stato finale**

Run: `git status --short` e `git log --oneline -10`
Expected: i commit dei task 1-8 presenti. Nessun file del piano rimasto modificato fuori dai commit, a parte quelli non correlati già in stage all'inizio, che restano in stage e intatti.

Non fare push né deploy: riporta all'utente l'elenco dei commit e chiedi se vuole il deploy.
