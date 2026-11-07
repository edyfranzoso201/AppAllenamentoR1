// Test delle funzioni server di gara -> Risultati.
// Esegui: node scripts/test-match-gara.mjs
import assert from 'assert/strict';
import { createRequire } from 'module';
import { applyMatchPatch, patchTroppoGrande, patchOltreLimiti, sanificaDatiGara, sanificaNuova, applicaGara, purgeGaraAtleta } from '../api/_match-gara.js';

// Il modulo client (UMD): server e client devono applicare le patch allo stesso modo.
const require = createRequire(import.meta.url);
const client = require('../public/gara/gara-risultati.js');

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
t('crea partita nuova se la patch porta la data', () => {
  const cur = {};
  applyMatchPatch(cur, { '9': { date: '2026-11-08', homeScore: 1 } });
  assert.deepEqual(cur, { '9': { date: '2026-11-08', homeScore: 1 } });
});
t('chiavi pericolose ignorate', () => {
  const cur = {};
  applyMatchPatch(cur, JSON.parse('{"__proto__":{"date":"2026-11-02","polluted":1},"1":{"date":"2026-11-01","constructor":{"x":1}}}'));
  assert.equal({}.polluted, undefined);
  assert.deepEqual(cur['1'], { date: '2026-11-01' });
  assert.equal(Object.getPrototypeOf(cur), Object.prototype);
});
t('campo __proto__ ignorato, prototipo della partita intatto', () => {
  const cur = { '1': { date: '2026-11-01' } };
  applyMatchPatch(cur, JSON.parse('{"1":{"__proto__":{"polluted":1},"prototype":2,"homeScore":1}}'));
  assert.equal(Object.getPrototypeOf(cur['1']), Object.prototype);
  assert.equal(cur['1'].polluted, undefined);
  assert.deepEqual(cur['1'], { date: '2026-11-01', homeScore: 1 });
});
t('id "toString" senza data: non legge la funzione ereditata, non crea niente', () => {
  const cur = {};
  applyMatchPatch(cur, { toString: { homeScore: 1 } });
  assert.equal(Object.prototype.hasOwnProperty.call(cur, 'toString'), false);
  assert.equal(typeof cur.toString, 'function');
});
t('id "toString" con data: crea la partita come campo proprio', () => {
  const cur = {};
  applyMatchPatch(cur, { toString: { date: '2026-11-01', homeScore: 1 } });
  assert.deepEqual(Object.getOwnPropertyDescriptor(cur, 'toString').value, { date: '2026-11-01', homeScore: 1 });
});
t('campo "toString" applicato e cancellato come gli altri', () => {
  const cur = { '1': { date: '2026-11-01' } };
  applyMatchPatch(cur, { '1': { toString: 'x' } });
  assert.equal(Object.getOwnPropertyDescriptor(cur['1'], 'toString').value, 'x');
  applyMatchPatch(cur, { '1': { toString: null } });
  assert.equal(Object.prototype.hasOwnProperty.call(cur['1'], 'toString'), false);
});
t('i valori sono copiati, non condivisi con la patch', () => {
  const patch = { '1': { date: '2026-11-01', scorers: [{ athleteId: 'a' }] } };
  const cur = applyMatchPatch({}, patch);
  patch['1'].scorers[0].athleteId = 'b';
  assert.equal(cur['1'].scorers[0].athleteId, 'a');
});
t('patch non oggetto: cur invariato', () => {
  const cur = { '1': { date: '2026-11-01' } };
  for (const p of [null, undefined, 3, 'x', [1]]) applyMatchPatch(cur, p);
  assert.deepEqual(cur, { '1': { date: '2026-11-01' } });
});
t('stesso risultato del client su un insieme di patch', () => {
  const base = () => JSON.parse('{"1":{"date":"2026-11-01","a":1,"b":2},"2":{"date":"e"},"3":"rotto"}');
  const patches = [
    { '1': { b: null, c: [1, 2] } },
    { '2': null, '4': { a: 1 }, '5': { date: '2026-11-04', x: { y: 1 } } },
    { '3': { a: 1 }, '6': { date: '2026-11-05' } },
    JSON.parse('{"__proto__":{"date":"2026-11-02"},"toString":{"date":"2026-11-03"},"valueOf":{"a":1},"1":{"constructor":1,"toString":2}}'),
    [{ date: '2026-11-06' }],                                  // patch array
    { ['x'.repeat(101)]: { date: '2026-11-07' }, ['y'.repeat(100)]: { date: '2026-11-07' } }, // id lungo
    { '7': { date: { a: 1 } }, '8': { date: '' }, '9': { date: '2026-1-1' }, '10': { date: 20261101 } },
    null, 'x', 3
  ];
  for (const p of patches) {
    const s = applyMatchPatch(base(), JSON.parse(JSON.stringify(p)));
    const c = client.applyMatchPatch(base(), JSON.parse(JSON.stringify(p)));
    assert.deepEqual(s, c, JSON.stringify(p));
  }
});
t('crea solo con data AAAA-MM-GG', () => {
  const cur = applyMatchPatch({}, { '7': { date: { a: 1 } }, '8': { date: '' }, '9': { date: '8/11/2026' }, '10': { date: 1 } });
  assert.deepEqual(cur, {});
  // la data serve solo per CREARE: su una partita esistente la patch si applica
  const esistente = applyMatchPatch({ '1': { date: '2026-11-01' } }, { '1': { homeScore: 2 } });
  assert.deepEqual(esistente['1'], { date: '2026-11-01', homeScore: 2 });
});
t('id oltre 100 caratteri ignorato', () => {
  const cur = applyMatchPatch({}, { ['x'.repeat(101)]: { date: '2026-11-01' }, ['y'.repeat(100)]: { date: '2026-11-01' } });
  assert.deepEqual(Object.keys(cur), ['y'.repeat(100)]);
});

// gara nella patch generica: passa da sanificaDatiGara (solo server)
t('patch su gara: sanificata, salvataDa conservato', () => {
  const cur = { '1': { date: '2026-11-01', gara: { vecchia: 1 } } };
  applyMatchPatch(cur, { '1': { gara: { convocati: ['a1', { x: 1 }], extra: 'via', salvataDa: 'mister',
    cambi: [{ esce: 'a1', entra: 'a2', min: 10, ord: 2, cattivo: '<script>' }] } } });
  const g = cur['1'].gara;
  assert.deepEqual(g.convocati, ['a1']);
  assert.equal(g.extra, undefined);
  assert.equal(g.vecchia, undefined, 'la gara si sostituisce intera, come il valore del campo');
  assert.equal(g.salvataDa, 'mister');
  assert.deepEqual(g.cambi, [{ esce: 'a1', entra: 'a2', min: 10, minuto: '', periodo: 1, ord: 2 }]);
  assert.deepEqual(g.tempi, { numero: 2, durata: 45, durateTempi: {} });
});
t('patch su gara non oggetto: campo saltato, gara del server intatta', () => {
  for (const bad of ['x', 3, [1], true]) {
    const cur = { '1': { date: '2026-11-01', gara: { tel: 1 } } };
    applyMatchPatch(cur, { '1': { gara: bad, homeScore: 1 } });
    assert.deepEqual(cur['1'], { date: '2026-11-01', gara: { tel: 1 }, homeScore: 1 });
  }
});
t('patch su gara null: campo eliminato', () => {
  const cur = { '1': { date: '2026-11-01', gara: { tel: 1 } } };
  applyMatchPatch(cur, { '1': { gara: null } });
  assert.deepEqual(cur['1'], { date: '2026-11-01' });
});
t('partita nuova con gara: sanificata anche alla creazione', () => {
  const cur = applyMatchPatch({}, { '5': { date: '2026-11-01', gara: { titolari: ['a', 'b'], hack: 1 } } });
  assert.deepEqual(cur['5'].gara.titolari, ['a', 'b']);
  assert.equal(cur['5'].gara.hack, undefined);
});

// limiti di dimensione: patch rifiutata intera
t('oltre 500 partite: patch rifiutata intera', () => {
  const p = {};
  for (let i = 0; i < 501; i++) p[String(i)] = { date: '2026-11-01' };
  assert.equal(patchOltreLimiti(p), true);
  const cur = { a: { date: '2026-11-01' } };
  applyMatchPatch(cur, Object.assign(p, { a: null }));
  assert.deepEqual(cur, { a: { date: '2026-11-01' } });
  delete p['0']; delete p.a;
  assert.equal(patchOltreLimiti(p), false, '500 partite: nei limiti');
  assert.equal(Object.keys(applyMatchPatch({}, p)).length, 500);
});
t('oltre 60 campi in una partita: patch rifiutata intera', () => {
  const campi = { date: '2026-11-01' };
  for (let i = 0; i < 60; i++) campi['f' + i] = i;   // 61 campi
  const cur = { '1': { date: '2026-11-01' } };
  applyMatchPatch(cur, { '1': { homeScore: 1 }, '2': campi });
  assert.deepEqual(cur, { '1': { date: '2026-11-01' } });
  delete campi.f59;                                   // 60 campi
  assert.equal(patchOltreLimiti({ '2': campi }), false);
  assert.equal(Object.keys(applyMatchPatch({}, { '2': campi })['2']).length, 60);
});
t('patchTroppoGrande: soglia 300000 caratteri di JSON', () => {
  assert.equal(patchTroppoGrande({ '1': { note: 'x'.repeat(1000) } }), false);
  assert.equal(patchTroppoGrande({ '1': { note: 'x'.repeat(300000) } }), true);
  const giusta = { '1': { n: '' } };
  giusta['1'].n = 'x'.repeat(300000 - JSON.stringify(giusta).length);
  assert.equal(JSON.stringify(giusta).length, 300000);
  assert.equal(patchTroppoGrande(giusta), false, 'esattamente 300000: ammessa');
  assert.equal(patchTroppoGrande(null), false);
  assert.equal(patchTroppoGrande(undefined), false);
  const ciclo = {}; ciclo.a = ciclo;
  assert.equal(patchTroppoGrande(ciclo), true);
});

const datiOk = {
  homeScore: 2, awayScore: '1',
  scorers: [{ athleteId: 'a1', minute: '12' }, { minute: '3' }],
  cards: [{ athleteId: 'a2', type: 'yellow', minute: '5' }, { athleteId: 'a3', type: 'blu', minute: '6' }],
  gara: {
    convocati: ['a1', 'a2', 'a3'], titolari: ['a1', 'a2'],
    cambi: [{ esce: 'a2', entra: 'a3', min: 45, minuto: 'Int.', periodo: 2, intervallo: true, ord: 1 }, {}],
    espulsioni: [{ athleteId: 'a1', min: 80, minuto: "80'", periodo: 2, sec: 2100, ord: 3 }],
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
t('sanifica: ord valido conservato su cambi ed espulsioni', () => {
  const d = sanificaDatiGara(datiOk);
  assert.equal(d.gara.cambi[0].ord, 1);
  assert.equal(d.gara.espulsioni[0].ord, 3);
  const zero = sanificaDatiGara(Object.assign({}, datiOk, {
    gara: Object.assign({}, datiOk.gara, { cambi: [{ esce: 'a1', ord: 0 }], espulsioni: [{ athleteId: 'a1', ord: 99999 }] })
  }));
  assert.equal(zero.gara.cambi[0].ord, 0);
  assert.equal(zero.gara.espulsioni[0].ord, 10000, 'tetto a 10000');
});
t('sanifica: ord non valido scartato', () => {
  for (const ord of ['2', -1, NaN, 1.5, Infinity, null, {}, true]) {
    const d = sanificaDatiGara(Object.assign({}, datiOk, {
      gara: Object.assign({}, datiOk.gara, { cambi: [{ esce: 'a1', ord }], espulsioni: [{ athleteId: 'a1', ord }] })
    }));
    assert.equal(Object.prototype.hasOwnProperty.call(d.gara.cambi[0], 'ord'), false, 'cambio ord=' + String(ord));
    assert.equal(Object.prototype.hasOwnProperty.call(d.gara.espulsioni[0], 'ord'), false, 'espulsione ord=' + String(ord));
  }
});
t('sanifica: durateTempi con chiavi __proto__/toString dal JSON', () => {
  const d = sanificaDatiGara(JSON.parse('{"gara":{"tempi":{"durateTempi":{"__proto__":{"1":5},"toString":3,"1":60}}}}'));
  assert.deepEqual(d.gara.tempi.durateTempi, { 1: 60 });
  assert.equal(Object.getPrototypeOf(d.gara.tempi.durateTempi), Object.prototype);
});
t('sanifica: id atleta "toString"/"__proto__" sono stringhe come le altre', () => {
  const d = sanificaDatiGara({ gara: { convocati: ['toString', '__proto__'], cambi: [{ esce: 'toString' }] } });
  assert.deepEqual(d.gara.convocati, ['toString', '__proto__']);
  assert.equal(d.gara.cambi[0].esce, 'toString');
});
t('sanifica: punteggio null, vuoto o assente = null (non 0)', () => {
  for (const v of [null, '', undefined, 'abc']) {
    const d = sanificaDatiGara({ homeScore: v, awayScore: v, gara: {} });
    assert.equal(d.homeScore, null, 'homeScore ' + JSON.stringify(v));
    assert.equal(d.awayScore, null);
  }
  assert.equal(sanificaDatiGara({ homeScore: 0, awayScore: '0', gara: {} }).awayScore, 0);
});
t('sanifica: dati senza gara = null',() => assert.equal(sanificaDatiGara({ homeScore: 1 }), null));
t('sanifica: gara ereditata dal prototipo = null', () => {
  const d = Object.create({ gara: { convocati: ['a'] } });
  assert.equal(sanificaDatiGara(d), null);
});
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
  assert.equal(r.gara.cambi[0].ord, 1);
  assert.equal(m.homeScore, undefined, 'non modifica l oggetto originale');
});

t('purge toglie l atleta da tutto il blocco gara', () => {
  const m = applicaGara({ id: 1, date: 'd' }, sanificaDatiGara(datiOk), 'x');
  assert.equal(purgeGaraAtleta(m, 'a2'), true);
  assert.deepEqual(m.gara.convocati, ['a1', 'a3']);
  assert.deepEqual(m.gara.titolari, ['a1']);
  assert.deepEqual(m.gara.cambi, [{ esce: '', entra: 'a3', min: 45, minuto: 'Int.', periodo: 2, intervallo: true, ord: 1 }]);
  assert.equal(purgeGaraAtleta(m, 'a3'), true);
  assert.deepEqual(m.gara.cambi, [], 'cambio senza nessuno dei due sparisce');
  assert.equal(purgeGaraAtleta(m, 'zz'), false);
  assert.equal(purgeGaraAtleta({ id: 2 }, 'a1'), false);
});
t('purge: righe rotte nel blocco gara non fanno crollare', () => {
  const m = { gara: { convocati: ['a1'], cambi: [null, { esce: 'a1' }], espulsioni: [null, { athleteId: 'a1' }] } };
  assert.equal(purgeGaraAtleta(m, 'a1'), true);
  assert.deepEqual(m.gara, { convocati: [], cambi: [], espulsioni: [] });
});

console.log(`\n${n} test superati`);
