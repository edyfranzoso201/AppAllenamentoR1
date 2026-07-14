// Test isolato per la logica di wipe-annata-category, con mock KV in memoria.
// Esegui: node scripts/test-wipe-annata-category.mjs

const store = new Map();
const mockKv = {
  async get(key) { return store.has(key) ? store.get(key) : null; },
  async set(key, val) { store.set(key, val); }
};

function isValidId(value) {
  return /^[a-z0-9_-]+$/i.test(String(value || '').trim());
}

const WIPE_CATEGORIES = ['matchResults', 'evaluations'];

async function countCategoryItems(category, data) {
  if (category === 'matchResults') return Object.keys(data || {}).length;
  // evaluations: somma atleti in tutte le date
  return Object.values(data || {}).reduce((sum, byAthlete) => sum + Object.keys(byAthlete || {}).length, 0);
}

async function wipeAnnataCategory({ session, annataId, targetAnnataId, category, annateList }) {
  if (!session.isAuthenticated || String(session.role).toLowerCase() !== 'admin') {
    return { status: 403, body: { success: false, message: 'Permesso negato: solo Admin può cancellare dati di un\'annata' } };
  }
  if (!WIPE_CATEGORIES.includes(category)) {
    return { status: 400, body: { success: false, message: 'Categoria non valida' } };
  }
  if (!isValidId(targetAnnataId)) {
    return { status: 400, body: { success: false, message: 'targetAnnataId non valido' } };
  }
  const annataMeta = annateList.find(a => String(a.id) === String(targetAnnataId));
  if (annataMeta && (annataMeta.societyId || null) !== (session.societyId || null)) {
    return { status: 403, body: { success: false, message: 'Accesso negato: annata di un\'altra società' } };
  }
  if (String(targetAnnataId) === String(annataId)) {
    return { status: 400, body: { success: false, message: 'Non puoi cancellare l\'annata attiva da qui, usa Cambio Stagione' } };
  }
  const prefix = `annate:${targetAnnataId}`;
  const key = `${prefix}:${category}`;
  const current = (await mockKv.get(key)) || {};
  const deletedCount = await countCategoryItems(category, current);
  await mockKv.set(key, {});
  return { status: 200, body: { success: true, deletedCount } };
}

// ── Test cases ──────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  OK: ${label}`); }
  else { failed++; console.error(`  FAIL: ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`); }
}

const adminSession = { isAuthenticated: true, role: 'admin', societyId: 'soc1' };
const coachSession = { isAuthenticated: true, role: 'coach_l1', societyId: 'soc1' };
const annateList = [
  { id: 'a2023', nome: '2023-24', societyId: 'soc1' },
  { id: 'a2022', nome: '2022-23', societyId: 'soc2' } // altra società
];

async function run() {
  console.log('Test 1: coach non-admin -> 403');
  {
    const r = await wipeAnnataCategory({ session: coachSession, annataId: 'a2024', targetAnnataId: 'a2023', category: 'matchResults', annateList });
    assertEqual(r.status, 403, 'status 403 per non-admin');
  }

  console.log('Test 2: categoria non whitelisted -> 400');
  {
    const r = await wipeAnnataCategory({ session: adminSession, annataId: 'a2024', targetAnnataId: 'a2023', category: 'calendarResponses', annateList });
    assertEqual(r.status, 400, 'status 400 per categoria non valida');
  }

  console.log('Test 3: targetAnnataId con formato non valido -> 400');
  {
    const r = await wipeAnnataCategory({ session: adminSession, annataId: 'a2024', targetAnnataId: 'a bad id!', category: 'matchResults', annateList });
    assertEqual(r.status, 400, 'status 400 per id non valido');
  }

  console.log('Test 4: annata di un\'altra società -> 403');
  {
    const r = await wipeAnnataCategory({ session: adminSession, annataId: 'a2024', targetAnnataId: 'a2022', category: 'matchResults', annateList });
    assertEqual(r.status, 403, 'status 403 isolamento società');
  }

  console.log('Test 5: blocco su annata attualmente attiva -> 400');
  {
    const r = await wipeAnnataCategory({ session: adminSession, annataId: 'a2023', targetAnnataId: 'a2023', category: 'matchResults', annateList });
    assertEqual(r.status, 400, 'status 400 su annata attiva');
  }

  console.log('Test 6: wipe matchResults conta e svuota correttamente');
  {
    store.set('annate:a2023:matchResults', { m1: { id: 'm1' }, m2: { id: 'm2' } });
    const r = await wipeAnnataCategory({ session: adminSession, annataId: 'a2024', targetAnnataId: 'a2023', category: 'matchResults', annateList });
    assertEqual(r.status, 200, 'status 200');
    assertEqual(r.body.deletedCount, 2, 'deletedCount = 2');
    assertEqual(await mockKv.get('annate:a2023:matchResults'), {}, 'chiave svuotata');
  }

  console.log('Test 7: wipe evaluations conta atleti su tutte le date e svuota');
  {
    store.set('annate:a2023:evaluations', {
      '2023-09-01': { ath1: { voto: 5 }, ath2: { voto: 6 } },
      '2023-09-02': { ath1: { voto: 7 } }
    });
    const r = await wipeAnnataCategory({ session: adminSession, annataId: 'a2024', targetAnnataId: 'a2023', category: 'evaluations', annateList });
    assertEqual(r.status, 200, 'status 200');
    assertEqual(r.body.deletedCount, 3, 'deletedCount = 3 (2+1 atleti)');
    assertEqual(await mockKv.get('annate:a2023:evaluations'), {}, 'chiave svuotata');
  }

  console.log('Test 8: annata orfana (non in annate:list) e stessa società -> consentito');
  {
    store.set('annate:a9999:matchResults', { m1: {} });
    const r = await wipeAnnataCategory({ session: adminSession, annataId: 'a2024', targetAnnataId: 'a9999', category: 'matchResults', annateList });
    assertEqual(r.status, 200, 'status 200 annata orfana consentita (nessun dato cross-società da proteggere)');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
