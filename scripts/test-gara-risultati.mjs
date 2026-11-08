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
  { esce: 'B', entra: 'C', min: 45, minuto: 'Int.', periodo: 2, intervallo: true, ord: 3 }]));
t('espulsioni con sec', () => assert.deepEqual(d.gara.espulsioni, [
  { athleteId: 'D', min: 70, minuto: "70'", periodo: 2, sec: 1500, ord: 4 }]));
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

// ── ordine degli eventi = ordinaEventi della gara, non per secondo ──
// Cambio dal vivo A->B a 22:30 (minuto 23', sec 1350), poi cambio scritto a
// mano B->C "23'" senza sec (= 22:00). Per secondo il secondo cambio verrebbe
// prima: "esce B" a vuoto, poi B entra e resta -> B e C entrambi in campo.
const undici = ['A', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
const stessoMinuto = [
  { tipo: 'cambio', playerId: 'A', playerInId: 'B', periodo: 1, min: 23, minuto: "23'", sec: 1350 },
  { tipo: 'cambio', playerId: 'B', playerInId: 'C', periodo: 1, min: 23, minuto: "23'" }
];
const inCampoFinale = mm => Object.keys(mm).filter(id => mm[id].tempi[1] > 0).length;
const verificaStessoMinuto = mm => {
  assert.equal(mm.B.tot, 0);                 // entrato e uscito nello stesso minuto
  assert.equal(mm.C.tempi[1], 2700);         // C in campo fino alla fine
  assert.equal(mm.C.tot, 2700 - 1320 + 2700);
  assert.equal(inCampoFinale(mm), 11);       // mai 12 in campo
};
t('stesso minuto: ordine della cronologia, non del secondo', () => verificaStessoMinuto(
  GR.calcolaMinutaggio({ titolari: undici, eventi: stessoMinuto, numTempi: 2, durata: 45 })));
t('stesso minuto: anche da datiDaGara -> minutaggioPartita', () => {
  // un'espulsione PRIMA dei cambi nella cronologia: cambi ed espulsioni sono
  // liste separate nel blocco, `ord` deve rimettere l'ordine giusto
  const g = GR.datiDaGara({ noiCasa: true, golNoi: 0, golLoro: 0,
    eventi: [{ tipo: 'espulsione', playerId: 'P1', periodo: 1, min: 23, minuto: "23'" }].concat(stessoMinuto),
    convocati: undici.concat(['B', 'C']), titolari: undici, numTempi: 2, durata: 45,
    durateTempi: { 1: 2700, 2: 2700 } }).gara;
  assert.deepEqual(GR.eventiDaBlocco(g).map(e => e.ord), [0, 1, 2]);
  const mm = GR.minutaggioPartita(g);
  assert.equal(mm.B.tot, 0);
  assert.equal(mm.C.tempi[1], 2700);
  assert.equal(inCampoFinale(mm), 10);       // 11 meno l'espulso, nessun doppione
});
t('blocco vecchio senza ord: cambi poi espulsioni', () => assert.deepEqual(
  GR.eventiDaBlocco({ cambi: [{ esce: 'A', entra: 'B', min: 10, periodo: 1 }],
    espulsioni: [{ athleteId: 'C', min: 5, periodo: 1 }] }).map(e => e.tipo), ['cambio', 'espulsione']));

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

// Blocco gara gia' in Risultati: partita = d come salvata dal server, con
// metadati e ordine diversi (secondo salvataggio della stessa gara).
const giaSalvata = (gara) => ({ homeScore: 1, awayScore: 2, scorers: d.scorers, cards: d.cards,
  gara: Object.assign(JSON.parse(JSON.stringify(d.gara)), gara || {}) });
t('blocco gara identico (ordine, sec, ord, salvataIl diversi): nessuna differenza', () => {
  const m = giaSalvata({ salvataIl: '2020-01-01T00:00:00Z', salvataDa: 'altro' });
  m.gara.titolari = m.gara.titolari.slice().reverse();
  m.gara.convocati = m.gara.convocati.slice().reverse();
  m.gara.cambi = m.gara.cambi.map(c => { const x = Object.assign({}, c); delete x.ord; x.sec = 12; return x; });
  m.gara.espulsioni = m.gara.espulsioni.map(e => { const x = Object.assign({}, e); delete x.sec; x.ord = 99; return x; });
  m.gara.tempi = Object.assign({}, m.gara.tempi, { durateTempi: { 1: 2800, 2: 2750 } });
  assert.deepEqual(GR.differenze(m, d, nomeDi), []);
});
t('differenze solo nei cambi', () => {
  const m = giaSalvata({ cambi: [{ esce: 'B', entra: 'C', min: 50, minuto: "50'", periodo: 2 }] });
  const diff = GR.differenze(m, d, nomeDi);
  assert.equal(diff.length, 1);
  assert.equal(diff[0], "Cambi in Risultati: 50' Aiesi→Runza · dalla gara: Int. Aiesi→Runza");
});
t('differenze solo nei titolari', () => {
  const m = giaSalvata();
  m.gara.titolari = m.gara.titolari.filter(id => id !== 'A').concat(['C']);
  const diff = GR.differenze(m, d, nomeDi);
  assert.equal(diff.length, 1);
  assert.match(diff[0], /^Titolari in Risultati: .*Runza.* · dalla gara: .*Bivol.* \(in più Bivol; in meno Runza\)$/);
});
t('differenze in convocati, espulsioni e tempi', () => {
  const m = giaSalvata({ convocati: d.gara.convocati.concat(['Z']), espulsioni: [],
    tempi: { numero: 4, durata: 20, durateTempi: {} } });
  const diff = GR.differenze(m, d, id => (id === 'Z' ? 'Zeta' : nomeDi(id)));
  assert.equal(diff.length, 3);
  assert.match(diff[0], /^Convocati in Risultati: \d+ · dalla gara: \d+ \(in meno Zeta\)$/);
  assert.equal(diff[1], "Espulsioni in Risultati: nessuna · dalla gara: 70' Rossi");
  assert.equal(diff[2], "Tempi in Risultati: 4 tempi da 20' · dalla gara: 2 tempi da 45'");
});

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

t('apply crea una partita solo con data AAAA-MM-GG', () => {
  const server = {};
  GR.applyMatchPatch(server, { '7': { date: { a: 1 } }, '8': { date: '' }, '9': { date: '8/11/2026' }, '10': { date: '2026-11-10' } });
  assert.deepEqual(Object.keys(server), ['10']);
});
t('apply: patch non oggetto e id oltre 100 caratteri ignorati', () => {
  const server = { '1': { id: 1, date: '2026-11-01' } };
  for (const p of [null, undefined, 'x', 3, [{ date: '2026-11-01' }]]) GR.applyMatchPatch(server, p);
  GR.applyMatchPatch(server, { ['x'.repeat(101)]: { date: '2026-11-01' }, ['y'.repeat(100)]: { date: '2026-11-01' } });
  assert.deepEqual(Object.keys(server), ['1', 'y'.repeat(100)]);
});

t('apply ignora __proto__, constructor e prototype', () => {
  const server = { '1': { id: 1, date: '2026-11-01' } };
  const cattiva = JSON.parse('{"__proto__":{"date":"x","inquinato":true},' +
    '"constructor":{"date":"x","prototype":{"inquinato":true}},"prototype":{"date":"x"},' +
    '"1":{"__proto__":{"inquinato":true},"constructor":"x","prototype":"x","homeScore":2}}');
  GR.applyMatchPatch(server, cattiva);
  assert.equal({}.inquinato, undefined);
  assert.equal(Object.prototype.inquinato, undefined);
  assert.deepEqual(Object.keys(server), ['1']);
  assert.deepEqual(Object.keys(server['1']), ['id', 'date', 'homeScore']);
  assert.equal(server['1'].inquinato, undefined);
  assert.equal(Object.getPrototypeOf(server['1']), Object.prototype);
});

// Andata e ritorno: patch calcolata sul client e applicata alla base = stato
// corrente (aggiunta, eliminazione, campo cambiato, campo tolto, gara intatta)
t('round trip diff -> apply', () => {
  const b = {
    '1': { id: 1, date: '2026-11-01', homeScore: 1, note: 'vecchia', gara: { titolari: ['A'], cambi: [] } },
    '2': { id: 2, date: '2026-11-02', opponentName: 'Da cancellare' },
    'toString': { id: 4, date: '2026-11-04' }
  };
  const c = JSON.parse(JSON.stringify(b));
  c['1'].homeScore = 4; delete c['1'].note;
  delete c['2'];
  c['3'] = { id: 3, date: '2026-11-03', opponentName: 'Nuova', scorers: [{ athleteId: 'A', minute: '5' }] };
  c['toString'].toString = 'campo con nome del prototipo';
  const p = GR.diffMatchResults(b, c);
  assert.ok(p['toString'], 'chiave toString non saltata');
  assert.equal(p['1'].gara, undefined);     // gara non toccata: non entra nella patch
  assert.deepEqual(GR.applyMatchPatch(JSON.parse(JSON.stringify(b)), p), c);
  // e all'indietro: il campo "toString" tolto diventa null, non la funzione ereditata
  assert.deepEqual(GR.diffMatchResults(c, b)['toString'], { toString: null });
  assert.deepEqual(GR.applyMatchPatch(JSON.parse(JSON.stringify(c)), GR.diffMatchResults(c, b)), b);
  assert.equal(typeof Object.prototype.toString.toString, 'function');   // nessun inquinamento
});
t('trovaPartita con __proto__ non risolve il prototipo', () => {
  const r = GR.trovaPartita(MR, { matchId: '__proto__' });
  assert.equal(r.modo, null); assert.equal(r.match, null);
});
t('id numerici in titolari ed eventi', () => {
  const mm = GR.calcolaMinutaggio({ titolari: [7, 9], numTempi: 2, durata: 45,
    eventi: [{ tipo: 'cambio', playerId: 9, playerInId: 11, periodo: 1, min: 30, minuto: "30'", sec: 1800 }] });
  assert.equal(mm['7'].tot, 5400);
  assert.equal(mm['9'].tot, 1800);
  assert.equal(mm['11'].tot, 900 + 2700);
  const g = GR.datiDaGara({ noiCasa: true, golNoi: 0, golLoro: 0, titolari: [7, 9], convocati: [7, 9, 11],
    eventi: [{ tipo: 'cambio', playerId: 9, playerInId: 11, periodo: 1, min: 30, minuto: "30'", sec: 1800 }],
    numTempi: 2, durata: 45, durateTempi: { 1: 2700, 2: 2700 } }).gara;
  assert.deepEqual(g.titolari, ['7', '9']);
  assert.equal(g.cambi[0].esce, '9'); assert.equal(g.cambi[0].entra, '11');
  assert.equal(GR.minutaggioPartita(g)['11'].tot, 3600);
});

console.log(`\n${n} test superati`);
