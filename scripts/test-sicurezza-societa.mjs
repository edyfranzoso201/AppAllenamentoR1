// Test dei moduli di sicurezza (KV finto in memoria, niente rete né database):
//   api/_bacheca.js        banner e comunicati isolati per società
//   api/auth/_sessions.js  revoca delle sessioni
//   api/_athlete-docs.js   documenti caricati dai genitori senza login
// Uso: node scripts/test-sicurezza-societa.mjs
import { bachecaSocietyId, leggiBachecaConfig, salvaBachecaConfig, leggiPostSocieta, salvaPostSocieta, leggiImmaginiPost, salvaImmaginePost } from '../api/_bacheca.js';
import { revocaSessioniUtente, revocaSessioniSocieta } from '../api/auth/_sessions.js';
import { applicaAthleteDocs } from '../api/_athlete-docs.js';

let ok = 0, ko = 0;
function check(nome, cond) {
  if (cond) { ok++; } else { ko++; console.log('  ✗ ' + nome); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function nuovoKv(iniziale = {}) {
  const m = new Map(Object.entries(iniziale));
  return {
    m,
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async del(k) { m.delete(k); },
    async mget(...ks) { return ks.map(k => (m.has(k) ? structuredClone(m.get(k)) : null)); },
    // Pagine da 3 chiavi, per esercitare il cursore.
    async scan(cursor, { match }) {
      const pref = match.replace(/\*$/, '');
      const tutte = [...m.keys()].filter(k => k.startsWith(pref));
      const da = Number(cursor) || 0;
      const fetta = tutte.slice(da, da + 3);
      const prossimo = da + 3 >= tutte.length ? 0 : da + 3;
      return [String(prossimo), fetta];
    },
  };
}

const A = 'aaaaaaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbbbbbb';

// ── bachecaSocietyId ──────────────────────────────────────────────────────
{
  const req = { headers: { 'x-society-id': B }, query: { sid: B } };
  check('autenticato: vince la sessione, non l\'header', bachecaSocietyId(req, { isAuthenticated: true, societyId: A }, B) === A);
  check('autenticato legacy senza società: vuoto (non l\'header)', bachecaSocietyId(req, { isAuthenticated: true, societyId: null }, null) === '');
  check('anonimo con annata: società dell\'annata', bachecaSocietyId(req, { isAuthenticated: false }, A) === A);
  check('anonimo senza annata: header', bachecaSocietyId({ headers: { 'x-society-id': B }, query: {} }, { isAuthenticated: false }, null) === B);
  check('anonimo senza annata: ?sid=', bachecaSocietyId({ headers: {}, query: { sid: A } }, null, null) === A);
  check('sid con caratteri non validi: vuoto', bachecaSocietyId({ headers: { 'x-society-id': 'a:b*' }, query: {} }, null, null) === '');
  check('nessun dato: vuoto', bachecaSocietyId({ headers: {}, query: {} }, null, null) === '');
}

// ── bachecaConfig ─────────────────────────────────────────────────────────
{
  const kv = nuovoKv({ 'global:bachecaConfig': { banner: 'vecchio' } });
  check('società senza config: ripiega sul globale', eq(await leggiBachecaConfig(kv, A), { banner: 'vecchio' }));
  await salvaBachecaConfig(kv, A, { banner: 'di A' });
  check('il salvataggio di A NON tocca il globale', eq(kv.m.get('global:bachecaConfig'), { banner: 'vecchio' }));
  check('A legge il suo', eq(await leggiBachecaConfig(kv, A), { banner: 'di A' }));
  check('B non vede quello di A', eq(await leggiBachecaConfig(kv, B), { banner: 'vecchio' }));
  await salvaBachecaConfig(kv, A, {});
  check('A svuota: resta vuoto, non torna al globale', eq(await leggiBachecaConfig(kv, A), {}));
  await salvaBachecaConfig(kv, '', { banner: 'legacy' });
  check('senza società si scrive il globale', eq(kv.m.get('global:bachecaConfig'), { banner: 'legacy' }));
  check('nessun globale e nessuna config: oggetto vuoto', eq(await leggiBachecaConfig(nuovoKv(), A), {}));
}

// ── comunicati e immagini ─────────────────────────────────────────────────
{
  const kv = nuovoKv({
    'global:posts': [{ id: 'p1' }, { id: 'p2', societyId: A }, { id: 'p3', societyId: B }],
    'global:postImg_p1': 'img-globale',
  });
  check('A senza lista: vede i globali suoi o senza società', eq((await leggiPostSocieta(kv, A)).map(p => p.id), ['p1', 'p2']));
  check('B non vede il comunicato di A', eq((await leggiPostSocieta(kv, B)).map(p => p.id), ['p1', 'p3']));
  check('senza società: globali non filtrati', (await leggiPostSocieta(kv, '')).length === 3);
  await salvaPostSocieta(kv, A, [{ id: 'p1' }, { id: 'n1' }]);
  await salvaImmaginePost(kv, A, 'n1', 'img-A');
  check('il salvataggio di A NON tocca global:posts', kv.m.get('global:posts').length === 3);
  check('A legge la sua lista', eq((await leggiPostSocieta(kv, A)).map(p => p.id), ['p1', 'n1']));
  check('B non vede il nuovo comunicato di A', !(await leggiPostSocieta(kv, B)).some(p => p.id === 'n1'));
  const imgA = await leggiImmaginiPost(kv, A, [{ id: 'p1' }, { id: 'n1' }]);
  check('immagini di A: propria + ripiego globale', imgA.p1 === 'img-globale' && imgA.n1 === 'img-A' && Object.keys(imgA).length === 2);
  check('B non legge l\'immagine di A', eq(await leggiImmaginiPost(kv, B, [{ id: 'n1' }]), {}));
  await salvaPostSocieta(kv, A, []);
  check('A cancella tutto: lista vuota, non torna ai globali', eq(await leggiPostSocieta(kv, A), []));
  await salvaPostSocieta(kv, B, 'non-una-lista');
  check('valore non valido salvato come lista vuota', eq(kv.m.get(`society:${B}:posts`), []));
}

// ── revoca sessioni ───────────────────────────────────────────────────────
{
  const semina = () => nuovoKv({
    'session:t1': { username: 'Mario', role: 'admin', societyId: A },
    'session:t2': { username: 'mario', role: 'admin', societyId: A },
    'session:t3': { username: 'luca', role: 'coach_l1', societyId: A },
    'session:t4': { username: 'mario2', role: 'admin', societyId: B },
    'session:t5': { username: 'anna', role: 'admin', societyId: B },
    'session:t6': { username: 'vecchio', role: 'admin', societyId: null },
    'session:t7': 'valore-rotto',
    'auth:user:mario': { username: 'mario' },
  });
  let kv = semina();
  check('utente: revoca tutte le sue sessioni (maiuscole ignorate)', (await revocaSessioniUtente(kv, 'MARIO')) === 2);
  check('utente: le sue non ci sono più', !kv.m.has('session:t1') && !kv.m.has('session:t2'));
  check('utente: "mario2" e gli altri restano', kv.m.has('session:t4') && kv.m.has('session:t3') && kv.m.has('session:t6'));
  check('utente: le chiavi non-sessione restano', kv.m.has('auth:user:mario'));

  kv = semina();
  check('utente: risparmia il token indicato', (await revocaSessioniUtente(kv, 'mario', { tranne: 't2' })) === 1 && kv.m.has('session:t2') && !kv.m.has('session:t1'));

  kv = semina();
  check('utente vuoto: non revoca niente', (await revocaSessioniUtente(kv, '  ')) === 0 && kv.m.size === 8);
  check('utente inesistente: zero', (await revocaSessioniUtente(kv, 'nessuno')) === 0);

  kv = semina();
  check('società: revoca solo le sue', (await revocaSessioniSocieta(kv, B)) === 2 && kv.m.has('session:t1') && kv.m.has('session:t6') && !kv.m.has('session:t5'));
  check('società vuota: non tocca le sessioni legacy', (await revocaSessioniSocieta(kv, '')) === 0 && kv.m.has('session:t6'));
  check('valore di sessione rotto: ignorato senza errori', kv.m.has('session:t7'));
}

// ── documenti dei genitori ────────────────────────────────────────────────
{
  const athletes = [{ id: 1, name: 'Uno' }, { id: 'a2', name: 'Due' }];
  const doc = (url = 'https://drive.google.com/uc?id=abc') => ({ url, nota: 'ok', uploadedAt: '2026-11-10T10:00:00.000Z', uploadedBy: 'genitore' });
  const base = () => ({ '1': { certificato: doc() }, 'a2': { iscrizione: doc() }, '99': { certificato: doc() } });
  const anon = (existing, incoming) => applicaAthleteDocs(existing, incoming, { anonimo: true, athletes });

  let e = base();
  let r = anon(e, { '1': { certificato: null }, 'a2': { iscrizione: null } });
  check('anonimo: più atleti in una richiesta → 400', !r.ok && r.status === 400);
  check('anonimo: richiesta rifiutata non modifica niente', eq(e, base()));

  e = base();
  r = anon(e, { '99': { certificato: null } });
  check('anonimo: atleta non in rosa → 404', !r.ok && r.status === 404 && eq(e, base()));

  r = anon(base(), {});
  check('anonimo: nessun atleta → 400', !r.ok && r.status === 400);
  r = anon(base(), [{ certificato: null }]);
  check('anonimo: array → 400', !r.ok && r.status === 400);
  r = anon(base(), null);
  check('anonimo: null → 400', !r.ok && r.status === 400);

  r = anon(base(), { '1': { '__proto__x': doc() } });
  check('anonimo: tipo documento sconosciuto → 400', !r.ok && r.status === 400);
  r = anon(base(), { '1': { altro: null } });
  check('anonimo: cancellare un tipo sconosciuto → 400', !r.ok && r.status === 400);

  e = base();
  r = anon(e, { '1': { certificato: null } });
  check('anonimo: elimina il proprio documento (id numerico in rosa)', r.ok && !e['1'] && !!e['a2']);

  e = base();
  r = anon(e, { 'a2': { generico1: doc('drive.google.com/uc?id=zz') } });
  check('anonimo: aggiunge e completa lo schema https', r.ok && e['a2'].generico1.url === 'https://drive.google.com/uc?id=zz' && !!e['a2'].iscrizione);

  r = anon(base(), { '1': { certificato: doc('javascript:alert(1)') } });
  check('anonimo: javascript: rifiutato', !r.ok && r.status === 400);
  r = anon(base(), { '1': { certificato: doc('https://x.it/"><script>') } });
  check('anonimo: markup nel link rifiutato', !r.ok && r.status === 400);
  r = anon(base(), { '1': { certificato: 'stringa' } });
  check('anonimo: documento non oggetto rifiutato', !r.ok && r.status === 400);

  e = base();
  r = anon(e, { '1': { certificato: { url: 'https://ok.it/f', nota: '<b>ciao</b>', extra: 'x' } } });
  check('anonimo: nota ripulita e campi extra scartati', r.ok && e['1'].certificato.nota === 'bciao/b' && !('extra' in e['1'].certificato));

  e = base();
  r = applicaAthleteDocs(e, { '1': { certificato: null }, '99': { qualsiasi: { url: 'x' } } }, { anonimo: false, athletes: [] });
  check('staff: più atleti e chiavi libere consentiti', r.ok && !e['1'] && e['99'].qualsiasi.url === 'x');
}

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
