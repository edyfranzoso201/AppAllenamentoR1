# Confronto e cancellazione dati per annata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Risultati Partite, Valutazioni e Conteggio Presenze Atleti, permettere di richiamare temporaneamente (solo lato client) i dati di un'annata precedente per consultarli mescolati a quelli correnti, e dare all'Admin un pulsante per cancellare definitivamente, sul server, i dati di quella sola categoria per quella sola annata.

**Architecture:** Un unico endpoint backend `POST /api/data?action=wipe-annata-category` (whitelist `matchResults`/`evaluations`) in `api/data.js`, che replica i controlli di sicurezza già usati da `season-restore` (admin-only, isolamento società, validazione id). Lato client, un componente riutilizzabile "confronto annata" (funzione factory in `public/script.js`) instanziato 3 volte (Risultati, Valutazioni, Presenze); quando l'utente seleziona un'annata passata, il componente fa il fetch di quella categoria via `GET /api/data` con header `X-Annata-Id` diverso, e FONDE il risultato direttamente dentro le variabili globali già usate da tutto il codice di rendering esistente (`matchResults`, `evaluations`) — così le funzioni di render/grafico esistenti (`renderMatchResults`, `updateEvaluationCharts`, `updateAttendanceChart`, tabelle marcatori/assist/cartellini) mostrano i dati fusi senza essere riscritte. Deselezionare l'annata ripristina i dati originali dalla cache salvata prima del merge.

**Tech Stack:** Vanilla JS (nessun framework), Bootstrap 5 per UI, Vercel KV (Redis) via `@vercel/kv`, Vercel serverless functions (limite 12 funzioni Hobby — nessun nuovo file API).

---

## Contesto per l'implementatore

- Non esiste una test-suite automatizzata nel repo. Il pattern consolidato (vedi `season-restore`, `season-archive`) è: uno script Node isolato con mock KV per la logica backend pura, verifica manuale end-to-end dopo il deploy per il resto. Segui questo pattern.
- `api/data.js` è un unico file monolitico con tutte le "azioni" gestite da blocchi `if (req.query?.action === '...')`. Aggiungi il nuovo blocco seguendo lo stesso stile — non refactorizzare il file.
- `public/script.js` è caricato come script classico (non moduli), quindi le funzioni nuove vanno dichiarate con `const nomeFunzione = (...) => {...}` nello stesso scope delle altre (dentro la IIFE/DOMContentLoaded esistente) ed esposte su `window.*` solo se richiamate da `onclick` inline in `index.html`.
- Cache-buster: ogni volta che `public/index.html` o `public/script.js` cambia in modo osservabile dal browser, il tag `<script src="script.js?v=...">` in `index.html` va bumped (stringa `?v=<timestamp>` già presente, cercala con Grep prima di editare).
- **Non fare il deploy.** Il deploy avviene solo su istruzione esplicita dell'utente, in una fase successiva.

---

## File coinvolti

- **Modifica:** `api/data.js` — nuovo blocco action `wipe-annata-category` (~riga 1186, subito dopo la fine del blocco `season-restore`)
- **Modifica:** `public/index.html` — 3 nuovi blocchi UI (selettore + pulsante + modal) inseriti nelle 3 sezioni esistenti; 1 markup di modal condiviso
- **Modifica:** `public/script.js` — funzione factory `createAnnataCompareWidget(...)`, 3 istanze, funzione di fetch/merge, funzione di cancellazione, hook nei punti di init esistenti
- **Nuovo (solo per test manuale, non deployato):** `scripts/test-wipe-annata-category.mjs` — script Node isolato con mock KV

---

### Task 1: Backend — endpoint `wipe-annata-category`

**Files:**
- Modify: `api/data.js:1186` (subito dopo la chiusura `}` del blocco `season-restore`, prima del commento `// ── PASSWORD INDIVIDUAL`)
- Test: `scripts/test-wipe-annata-category.mjs` (nuovo)

- [ ] **Step 1: Scrivi lo script di test isolato con mock KV**

Crea `scripts/test-wipe-annata-category.mjs`:

```js
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
```

- [ ] **Step 2: Esegui lo script e verifica che tutti i test passino**

Run: `node scripts/test-wipe-annata-category.mjs`
Expected: `8 passed, 0 failed` (ogni riga sopra stampa `OK: ...`)

- [ ] **Step 3: Implementa il blocco reale in `api/data.js`**

Apri `api/data.js`, trova la riga 1186 (chiusura del blocco `season-restore`, subito prima di `// ── PASSWORD INDIVIDUAL`). Inserisci questo nuovo blocco subito dopo:

```js
// ── WIPE ANNATA CATEGORY: cancellazione mirata di UNA categoria per UNA
// annata passata (Risultati Partite / Valutazioni-Presenze), senza toccare
// le altre categorie né l'annata corrente. Solo Admin. ───────────────────
const WIPE_CATEGORIES = ['matchResults', 'evaluations'];
if (req.query?.action === 'wipe-annata-category' && req.method === 'POST') {
  if (!session.isAuthenticated || String(session.role).toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Permesso negato: solo Admin può cancellare dati di un\'annata' });
  }
  const category = String((req.body && req.body.category) || '').trim();
  if (!WIPE_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: 'Categoria non valida' });
  }
  const targetAnnataId = String((req.body && req.body.targetAnnataId) || '').trim();
  if (!isValidId(targetAnnataId)) {
    return res.status(400).json({ success: false, message: 'targetAnnataId non valido' });
  }
  try {
    const annateListForWipe = (await kv.get('annate:list')) || [];
    const annataMeta = annateListForWipe.find(a => String(a.id) === targetAnnataId);
    if (annataMeta && (annataMeta.societyId || null) !== (session.societyId || null)) {
      return res.status(403).json({ success: false, message: 'Accesso negato: annata di un\'altra società' });
    }
    if (targetAnnataId === annataId) {
      return res.status(400).json({ success: false, message: 'Non puoi cancellare l\'annata attiva da qui, usa Cambio Stagione' });
    }
    const prefix = `annate:${targetAnnataId}`;
    const key = `${prefix}:${category}`;
    const current = (await kv.get(key)) || {};
    let deletedCount = 0;
    if (category === 'matchResults') {
      deletedCount = Object.keys(current).length;
    } else {
      deletedCount = Object.values(current).reduce((sum, byAthlete) => sum + Object.keys(byAthlete || {}).length, 0);
    }
    await kv.set(key, {});
    // Audit log: azione distruttiva, stesso pattern di logRetentionPurge.
    try {
      const logKey = 'audit:wipe-annata-log';
      const log = (await kv.get(logKey)) || [];
      log.push({
        date: new Date().toISOString().split('T')[0],
        targetAnnataId, category, deletedCount,
        admin: session.username, societyId: session.societyId || null
      });
      await kv.set(logKey, log.slice(-500));
    } catch (e) { /* non bloccante */ }
    return res.status(200).json({ success: true, deletedCount });
  } catch (e) {
    console.error('[wipe-annata-category]', e?.message || e);
    return res.status(500).json({ success: false, message: 'Errore durante la cancellazione' });
  }
}

```

- [ ] **Step 4: Verifica sintattica del file**

Run: `node --check api/data.js`
Expected: nessun output (exit code 0) — conferma che il file è sintatticamente valido.

- [ ] **Step 5: Commit**

```bash
git add api/data.js scripts/test-wipe-annata-category.mjs
git commit -m "feat(api): endpoint wipe-annata-category per cancellazione mirata matchResults/evaluations

Solo Admin, isolamento società, blocco su annata attiva. Riusa i pattern
di sicurezza già presenti in season-restore.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — markup del modal di conferma condiviso

**Files:**
- Modify: `public/index.html` (nuovo markup, subito prima della chiusura `</body>` o accanto agli altri modal esistenti — cerca `<div class="modal fade"` con Grep per trovare un punto coerente)

- [ ] **Step 1: Individua un punto di inserimento coerente**

Run (Grep tool): cerca `class="modal fade"` in `public/index.html` per trovare l'ultimo modal esistente e inserire questo subito dopo, mantenendo lo stile Bootstrap del progetto.

- [ ] **Step 2: Aggiungi il markup del modal condiviso**

Inserisci questo blocco (un solo modal, riusato dalle 3 istanze tramite JS che ne popola i campi dinamicamente):

```html
<!-- Modal condiviso: conferma cancellazione dati annata (Risultati/Valutazioni/Presenze) -->
<div class="modal fade" id="wipeAnnataModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Cancella dati annata</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Chiudi"></button>
      </div>
      <div class="modal-body">
        <p id="wipeAnnataModalText"></p>
        <div class="alert alert-warning no-print" id="wipeAnnataSharedWarning" style="display:none;">
          ⚠️ Valutazioni e Presenze condividono gli stessi dati: cancellando qui, i dati di <strong id="wipeAnnataSharedWarningName"></strong> spariranno ANCHE dall'altra sezione (Presenze/Valutazioni).
        </div>
        <label for="wipeAnnataConfirmInput" class="form-label small">Scrivi il nome esatto dell'annata per confermare:</label>
        <input type="text" id="wipeAnnataConfirmInput" class="form-control" autocomplete="off">
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annulla</button>
        <button type="button" class="btn btn-danger" id="wipeAnnataConfirmBtn" disabled>Cancella definitivamente</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verifica manuale minima**

Apri `public/index.html` in un editor e conferma che il tag `<div class="modal fade" id="wipeAnnataModal"` non è duplicato altrove (Grep per `wipeAnnataModal` deve dare esattamente 1 match di definizione).

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat(ui): markup modal condiviso conferma cancellazione dati annata

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — funzione factory del widget "confronto annata" e fetch/merge dati

**Files:**
- Modify: `public/script.js` (nuove funzioni, inserite subito prima di `const renderMatchResults = () => {` a riga 2633 — così sono definite prima del primo utilizzo nello stesso scope)

**Contesto per questo task:** la funzione fa 3 cose per ciascuna sezione: (1) popola una select con le annate passate della stessa società leggendo `/api/annate/list`, (2) al cambio selezione fa fetch di `/api/data` con header `X-Annata-Id` diverso e fonde il risultato dentro `matchResults`/`evaluations` (le variabili globali già usate da tutto il resto del codice), salvando uno snapshot per poter tornare indietro, (3) mostra/nasconde il pulsante di cancellazione.

- [ ] **Step 1: Aggiungi lo stato e le funzioni di merge in `public/script.js`, prima di `renderMatchResults`**

```js
    // ── CONFRONTO/CANCELLAZIONE DATI PER ANNATA (Risultati/Valutazioni/Presenze) ──
    // Stato: annate passate attualmente "richiamate" per ciascuna categoria, con lo
    // snapshot dei dati ORIGINALI (stagione corrente) per poter tornare indietro.
    const annataCompareState = {
        matchResults: { selectedIds: [], originalSnapshot: null },
        evaluations: { selectedIds: [], originalSnapshot: null }
    };

    const fetchAnnataListForCompare = async () => {
        const resp = await fetch('/api/annate/list', {
            headers: { 'X-Auth-Session': sessionStorage.getItem('gosport_session_token') || '' }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        const annateList = Array.isArray(data) ? data : (data.annate || []);
        const currentAnnataId = sessionStorage.getItem('gosport_current_annata') || localStorage.getItem('currentAnnata');
        return annateList.filter(a => String(a.id) !== String(currentAnnataId));
    };

    // Fetch dei dati di UNA categoria per UNA annata specifica (diversa da quella attiva).
    const fetchCategoryForAnnata = async (annataIdToFetch, category) => {
        const resp = await fetch('/api/data', {
            cache: 'no-store',
            headers: { 'X-Annata-Id': annataIdToFetch, 'X-Auth-Session': sessionStorage.getItem('gosport_session_token') || '' }
        });
        if (!resp.ok) throw new Error(`Errore HTTP: ${resp.status}`);
        const data = await resp.json();
        return data[category] || {};
    };

    // Fonde i dati di un'annata passata dentro la variabile globale della categoria.
    // matchResults è keyed-by-id: merge diretto delle chiavi (i match id sono univoci
    // per annata, quindi non collidono). evaluations è keyed-by-data->atleta: merge
    // per data, poi per atleta (un atleta della stagione corrente non collide mai con
    // un atleta di un'altra annata perché gli id atleta sono univoci per annata).
    const mergeCategoryData = (category, incomingData) => {
        if (category === 'matchResults') {
            Object.assign(window.matchResults, incomingData);
            matchResults = window.matchResults;
        } else if (category === 'evaluations') {
            Object.entries(incomingData).forEach(([date, byAthlete]) => {
                if (!evaluations[date]) evaluations[date] = {};
                Object.assign(evaluations[date], byAthlete);
            });
            window.evaluations = evaluations;
        }
    };

    const restoreCategoryFromSnapshot = (category) => {
        const state = annataCompareState[category];
        if (!state.originalSnapshot) return;
        if (category === 'matchResults') {
            matchResults = JSON.parse(JSON.stringify(state.originalSnapshot));
            window.matchResults = matchResults;
        } else if (category === 'evaluations') {
            evaluations = JSON.parse(JSON.stringify(state.originalSnapshot));
            window.evaluations = evaluations;
        }
        state.originalSnapshot = null;
        state.selectedIds = [];
    };

```

- [ ] **Step 2: Verifica sintattica**

Run: `node --check public/script.js`
Expected: nessun output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add public/script.js
git commit -m "feat(ui): stato e funzioni merge/restore per confronto dati annata precedente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — widget UI per Risultati Partite (categoria `matchResults`)

**Files:**
- Modify: `public/index.html:1666-1668` (dentro `#risultati-filter-bar`, accanto al pulsante Reset esistente)
- Modify: `public/script.js` (nuova funzione `initAnnataCompareWidget`, chiamata di inizializzazione)

**Contesto:** questo task introduce la funzione generica `initAnnataCompareWidget(config)` che monta selettore + pulsante di cancellazione per UNA sezione, e la usa per Risultati Partite. I task 5 e 6 la riusano per Valutazioni e Presenze (stessa funzione, `category: 'evaluations'`, `sectionLabel` diverso) — questo è il "componente riutilizzabile, istanze indipendenti" richiesto dalla spec.

- [ ] **Step 1: Aggiungi il markup HTML in `public/index.html`, dentro `#risultati-filter-bar` dopo la riga col pulsante Reset (riga 1668)**

```html
                <div class="col-md-12 d-flex align-items-center gap-2 flex-wrap no-print" id="risultati-annata-compare-bar">
                    <label for="risultati-annata-compare-select" class="form-label mb-0 small text-nowrap">+ Aggiungi annata precedente:</label>
                    <select id="risultati-annata-compare-select" class="form-select form-select-sm" style="max-width:220px;" multiple size="1"></select>
                    <div id="risultati-annata-wipe-buttons" class="d-flex gap-1 flex-wrap"></div>
                </div>
```

- [ ] **Step 2: Aggiungi la funzione generica `initAnnataCompareWidget` in `public/script.js`, subito dopo `restoreCategoryFromSnapshot` (fine del blocco aggiunto nel Task 3)**

```js
    // Monta un widget "confronto annata" per UNA sezione. `config`:
    //   category: 'matchResults' | 'evaluations'
    //   sectionLabel: es. "Risultati Partite"
    //   selectId: id della <select> nel DOM
    //   buttonsContainerId: id del div dove appendere i pulsanti di cancellazione
    //   onDataChanged: callback chiamata dopo merge/restore (per ri-renderizzare la sezione)
    //   showSharedWarning: true per Valutazioni/Presenze (evaluations condivisa)
    const initAnnataCompareWidget = async (config) => {
        const select = document.getElementById(config.selectId);
        const buttonsContainer = document.getElementById(config.buttonsContainerId);
        if (!select || !buttonsContainer) return;

        const annateOptions = await fetchAnnataListForCompare();
        select.innerHTML = annateOptions.map(a => `<option value="${a.id}" data-nome="${a.nome || a.id}">${a.nome || a.id}</option>`).join('');

        const renderWipeButtons = () => {
            const state = annataCompareState[config.category];
            const isAdmin = sessionStorage.getItem('gosport_user_role') === 'admin';
            buttonsContainer.innerHTML = state.selectedIds.map(id => {
                const opt = annateOptions.find(a => String(a.id) === String(id));
                const nome = opt ? (opt.nome || opt.id) : id;
                if (!isAdmin) return '';
                return `<button type="button" class="btn btn-sm btn-outline-danger wipe-annata-btn" data-annata-id="${id}" data-nome="${nome}">🗑️ Cancella dati ${nome}</button>`;
            }).join('');
            buttonsContainer.querySelectorAll('.wipe-annata-btn').forEach(btn => {
                btn.addEventListener('click', () => openWipeAnnataModal({
                    category: config.category,
                    sectionLabel: config.sectionLabel,
                    annataId: btn.dataset.annataId,
                    annataNome: btn.dataset.nome,
                    showSharedWarning: !!config.showSharedWarning,
                    onWiped: () => {
                        const st = annataCompareState[config.category];
                        st.selectedIds = st.selectedIds.filter(id => String(id) !== String(btn.dataset.annataId));
                        if (st.selectedIds.length === 0) restoreCategoryFromSnapshot(config.category);
                        Array.from(select.options).forEach(o => { if (String(o.value) === String(btn.dataset.annataId)) o.selected = false; });
                        renderWipeButtons();
                        config.onDataChanged();
                        // Se la categoria è evaluations, invalida anche l'ALTRA sezione (Presenze/Valutazioni).
                        if (config.category === 'evaluations' && typeof window.__annataCompareSyncSibling === 'function') {
                            window.__annataCompareSyncSibling(config.selectId, btn.dataset.annataId);
                        }
                    }
                }));
            });
        };

        select.addEventListener('change', async () => {
            const state = annataCompareState[config.category];
            const chosenIds = Array.from(select.selectedOptions).map(o => o.value);
            const newlySelected = chosenIds.filter(id => !state.selectedIds.includes(id));
            const deselected = state.selectedIds.filter(id => !chosenIds.includes(id));

            if (deselected.length > 0 && chosenIds.length === 0) {
                restoreCategoryFromSnapshot(config.category);
            }
            if (!state.originalSnapshot && newlySelected.length > 0) {
                state.originalSnapshot = JSON.parse(JSON.stringify(config.category === 'matchResults' ? matchResults : evaluations));
            }
            for (const id of newlySelected) {
                try {
                    const incoming = await fetchCategoryForAnnata(id, config.category);
                    mergeCategoryData(config.category, incoming);
                } catch (e) {
                    console.error('[annataCompare] errore fetch', e);
                    alert('Errore nel caricamento dei dati dell\'annata selezionata.');
                }
            }
            state.selectedIds = chosenIds;
            renderWipeButtons();
            config.onDataChanged();
        });

        renderWipeButtons();
    };

```

- [ ] **Step 3: Aggiungi la chiamata di inizializzazione per Risultati Partite**

In `public/script.js:6318`, il bootstrap dell'app è:

```js
    initializeApp().then(() => {
        // Ripristina stato grafici Presenze dopo il caricamento
        if (window.restorePresenzeChartsState) {
            setTimeout(window.restorePresenzeChartsState, 400);
        }
        // FIX v1.5.21: controlla documenti caricati dai genitori
        setTimeout(window._checkPendingAthleteDocs, 2000);
        setTimeout(window._checkPendingAthleteDocs, 6000); // secondo check per sicurezza
    });
```

Sostituiscilo con (aggiunta della chiamata al widget, subito dopo `restorePresenzeChartsState`):

```js
    initializeApp().then(() => {
        // Ripristina stato grafici Presenze dopo il caricamento
        if (window.restorePresenzeChartsState) {
            setTimeout(window.restorePresenzeChartsState, 400);
        }
        // FIX v1.5.21: controlla documenti caricati dai genitori
        setTimeout(window._checkPendingAthleteDocs, 2000);
        setTimeout(window._checkPendingAthleteDocs, 6000); // secondo check per sicurezza

        initAnnataCompareWidget({
            category: 'matchResults',
            sectionLabel: 'Risultati Partite',
            selectId: 'risultati-annata-compare-select',
            buttonsContainerId: 'risultati-annata-wipe-buttons',
            showSharedWarning: false,
            onDataChanged: () => { renderMatchResults(); if (typeof updateMatchAnalysisChart === 'function') updateMatchAnalysisChart(); }
        });
    });
```

La funzione che aggiorna il grafico "Andamento Risultati" (canvas `matchResultsChart`) è `updateMatchAnalysisChart` (confermato leggendo `public/script.js:2833`).

**Importante — polling e merge:** `startPolling()` (script.js:6295-6308) richiama `loadData()` ogni 5 minuti e sovrascrive `matchResults`/`window.calendarResponses`/`evaluations` con solo i dati della stagione corrente, il che cancellerebbe silenziosamente il merge attivo. Nel Task 3, la funzione `mergeCategoryData` va richiamata di nuovo dopo ogni `loadData()` proveniente dal polling per le annate correntemente selezionate. Aggiungi questo in `public/script.js`, dentro `startPolling()` subito dopo la riga `await loadData();` (script.js:6301):

```js
            await loadData();
            // Ri-applica il merge delle annate precedenti eventualmente selezionate,
            // altrimenti il polling le farebbe sparire silenziosamente dalla vista.
            for (const cat of ['matchResults', 'evaluations']) {
                const state = annataCompareState[cat];
                if (state.selectedIds.length > 0) {
                    state.originalSnapshot = JSON.parse(JSON.stringify(cat === 'matchResults' ? matchResults : evaluations));
                    for (const id of state.selectedIds) {
                        try {
                            const incoming = await fetchCategoryForAnnata(id, cat);
                            mergeCategoryData(cat, incoming);
                        } catch (e) { console.error('[annataCompare] errore re-merge dopo polling', e); }
                    }
                }
            }
```

Questo sostituisce la riga `await loadData();` originale dentro il `setInterval` di `startPolling()` (non va aggiunto in duplicato: la prima riga del blocco qui sopra, `await loadData();`, è la riga già esistente — il resto è nuovo).

- [ ] **Step 4: Verifica sintattica**

Run: `node --check public/script.js`
Expected: nessun output.

- [ ] **Step 5: Bump del cache-buster**

Cerca in `public/index.html` il tag `<script src="script.js?v=...">` (Grep `script.js?v=`) e incrementa il numero di versione di 1.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/script.js
git commit -m "feat(risultati): widget confronto/cancellazione dati annata precedente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — widget UI per Valutazioni (categoria `evaluations`)

**Files:**
- Modify: `public/index.html:1744-1747` (header sezione `#report-valutazioni-section`, accanto a `#evaluation-date-picker-2`)
- Modify: `public/script.js` (chiamata di inizializzazione)

- [ ] **Step 1: Aggiungi il markup HTML in `public/index.html`, dentro il div `.d-flex.align-items-center.gap-2.no-print` a riga 1744, dopo l'input `#evaluation-date-picker-2`**

```html
                    <label for="valutazioni-annata-compare-select" class="form-label mb-0 small text-nowrap">+ Annata precedente:</label>
                    <select id="valutazioni-annata-compare-select" class="form-select form-select-sm" style="max-width:200px;" multiple size="1"></select>
                    <div id="valutazioni-annata-wipe-buttons" class="d-flex gap-1 flex-wrap"></div>
```

- [ ] **Step 2: Aggiungi la chiamata di inizializzazione in `public/script.js`, subito dopo quella del Task 4 (Risultati Partite)**

```js
        initAnnataCompareWidget({
            category: 'evaluations',
            sectionLabel: 'Valutazioni',
            selectId: 'valutazioni-annata-compare-select',
            buttonsContainerId: 'valutazioni-annata-wipe-buttons',
            showSharedWarning: true,
            onDataChanged: () => { updateEvaluationCharts(); }
        });
```

- [ ] **Step 3: Verifica sintattica**

Run: `node --check public/script.js`
Expected: nessun output.

- [ ] **Step 4: Bump del cache-buster**

Incrementa nuovamente `?v=` in `public/index.html` (stesso tag del Task 4, +1 rispetto al valore già bumped).

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/script.js
git commit -m "feat(valutazioni): widget confronto/cancellazione dati annata precedente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — widget UI per Conteggio Presenze Atleti (categoria `evaluations`, stessa chiave di Valutazioni)

**Files:**
- Modify: `public/index.html:1769` (dentro `.d-flex.gap-2.align-items-center.flex-wrap` dell'header "Conteggio Presenze Atleti")
- Modify: `public/script.js` (chiamata di inizializzazione + funzione di sync tra i due widget `evaluations`)

**Contesto:** questa è la seconda istanza indipendente su `category: 'evaluations'`, per rispettare il requisito esplicito dell'utente "Vietato semplificare, voglio 2 pulsanti separati". Serve anche la funzione `window.__annataCompareSyncSibling` (già referenziata nel Task 4) che invalida l'ALTRA select `evaluations` quando una delle due cancella dati, così le due sezioni restano coerenti.

- [ ] **Step 1: Aggiungi il markup HTML in `public/index.html`, dentro il div a riga 1769 (`d-flex gap-2 align-items-center flex-wrap`), prima del gruppo `#attendance-period-toggle`**

```html
                                <label for="presenze-annata-compare-select" class="form-label mb-0 small text-nowrap">+ Annata precedente:</label>
                                <select id="presenze-annata-compare-select" class="form-select form-select-sm" style="max-width:200px;" multiple size="1"></select>
                                <div id="presenze-annata-wipe-buttons" class="d-flex gap-1 flex-wrap"></div>
```

- [ ] **Step 2: Aggiungi la funzione di sincronizzazione tra le due select `evaluations`, in `public/script.js` subito dopo la definizione di `initAnnataCompareWidget` (fine del blocco del Task 4)**

```js
    // Quando una delle due sezioni "evaluations" (Valutazioni / Presenze) cancella
    // un'annata, l'altra select deve deselezionarla e la sua vista aggiornarsi:
    // condividono la stessa chiave dati sul server (vedi nota tecnica nella spec).
    window.__annataCompareSyncSibling = (originSelectId, wipedAnnataId) => {
        const siblingSelectId = originSelectId === 'valutazioni-annata-compare-select'
            ? 'presenze-annata-compare-select'
            : (originSelectId === 'presenze-annata-compare-select' ? 'valutazioni-annata-compare-select' : null);
        if (!siblingSelectId) return;
        const siblingSelect = document.getElementById(siblingSelectId);
        if (!siblingSelect) return;
        Array.from(siblingSelect.options).forEach(o => { if (String(o.value) === String(wipedAnnataId)) o.selected = false; });
        const siblingButtonsId = siblingSelectId === 'valutazioni-annata-compare-select' ? 'valutazioni-annata-wipe-buttons' : 'presenze-annata-wipe-buttons';
        const siblingButtons = document.getElementById(siblingButtonsId);
        if (siblingButtons) {
            siblingButtons.querySelectorAll(`.wipe-annata-btn[data-annata-id="${wipedAnnataId}"]`).forEach(b => b.remove());
        }
        if (siblingSelectId === 'valutazioni-annata-compare-select' && typeof updateEvaluationCharts === 'function') updateEvaluationCharts();
        if (siblingSelectId === 'presenze-annata-compare-select' && typeof updateAttendanceChart === 'function') updateAttendanceChart();
    };

```

- [ ] **Step 3: Aggiungi la chiamata di inizializzazione in `public/script.js`, subito dopo quella del Task 5 (Valutazioni)**

```js
        initAnnataCompareWidget({
            category: 'evaluations',
            sectionLabel: 'Conteggio Presenze Atleti',
            selectId: 'presenze-annata-compare-select',
            buttonsContainerId: 'presenze-annata-wipe-buttons',
            showSharedWarning: true,
            onDataChanged: () => { updateAttendanceChart(); }
        });
```

- [ ] **Step 4: Verifica sintattica**

Run: `node --check public/script.js`
Expected: nessun output.

- [ ] **Step 5: Bump del cache-buster**

Incrementa nuovamente `?v=` in `public/index.html` (+1 rispetto al Task 5).

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/script.js
git commit -m "feat(presenze): widget confronto/cancellazione dati annata + sync con Valutazioni

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend — modal di conferma cancellazione (logica `openWipeAnnataModal`)

**Files:**
- Modify: `public/script.js` (nuova funzione `openWipeAnnataModal`, referenziata dai Task 4-6)

**Contesto:** questa è la funzione mancante referenziata da `initAnnataCompareWidget` (Task 4, Step 2: `openWipeAnnataModal({...})`). Gestisce l'apertura del modal Bootstrap creato nel Task 2, la validazione del testo digitato, il banner di avviso condiviso per `evaluations`, e la chiamata POST all'endpoint del Task 1.

- [ ] **Step 1: Aggiungi la funzione in `public/script.js`, subito dopo `initAnnataCompareWidget` (fine del blocco del Task 4, prima o dopo `__annataCompareSyncSibling` indifferentemente — deve solo precedere il primo `initAnnataCompareWidget(...)` di chiamata)**

```js
    // Apre il modal di conferma cancellazione (creato in index.html, id wipeAnnataModal).
    // config: { category, sectionLabel, annataId, annataNome, showSharedWarning, onWiped }
    const openWipeAnnataModal = (config) => {
        const modalEl = document.getElementById('wipeAnnataModal');
        const textEl = document.getElementById('wipeAnnataModalText');
        const warningEl = document.getElementById('wipeAnnataSharedWarning');
        const warningNameEl = document.getElementById('wipeAnnataSharedWarningName');
        const input = document.getElementById('wipeAnnataConfirmInput');
        const confirmBtn = document.getElementById('wipeAnnataConfirmBtn');
        if (!modalEl || !textEl || !input || !confirmBtn) return;

        textEl.textContent = `Stai per cancellare TUTTI i dati di "${config.sectionLabel}" per l'annata "${config.annataNome}". Azione irreversibile. Scrivi "${config.annataNome}" per confermare.`;
        if (config.showSharedWarning) {
            warningNameEl.textContent = config.annataNome;
            warningEl.style.display = '';
        } else {
            warningEl.style.display = 'none';
        }
        input.value = '';
        confirmBtn.disabled = true;

        const onInput = () => { confirmBtn.disabled = input.value.trim() !== config.annataNome; };
        input.oninput = onInput;

        const onConfirm = async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Cancellazione in corso...';
            try {
                const resp = await fetch('/api/data?action=wipe-annata-category', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Auth-Session': sessionStorage.getItem('gosport_session_token') || '',
                        'X-Annata-Id': sessionStorage.getItem('gosport_current_annata') || localStorage.getItem('currentAnnata') || ''
                    },
                    body: JSON.stringify({ targetAnnataId: config.annataId, category: config.category })
                });
                const data = await resp.json();
                if (!resp.ok || !data.success) {
                    alert(data.message || 'Errore durante la cancellazione.');
                    return;
                }
                bootstrap.Modal.getInstance(modalEl)?.hide();
                alert(`✅ ${data.deletedCount} elementi eliminati da "${config.annataNome}".`);
                config.onWiped();
            } catch (e) {
                console.error('[wipeAnnata]', e);
                alert('Errore di rete durante la cancellazione.');
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Cancella definitivamente';
            }
        };
        confirmBtn.onclick = onConfirm;

        new bootstrap.Modal(modalEl).show();
    };

```

- [ ] **Step 2: Verifica sintattica**

Run: `node --check public/script.js`
Expected: nessun output.

- [ ] **Step 3: Bump del cache-buster**

Incrementa nuovamente `?v=` in `public/index.html` (+1 rispetto al Task 6).

- [ ] **Step 4: Commit**

```bash
git add public/script.js public/index.html
git commit -m "feat(ui): logica modal conferma cancellazione dati annata (typed-confirm + banner condiviso)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Verifica manuale end-to-end (post-deploy, guidata)

**Files:** nessuno — solo verifica manuale, nessun codice.

Questa app non ha Playwright/E2E automatizzato praticabile (richiede bootstrap con auth reale su backend Redis vero — stesso limite già documentato per "Restore archivio"). Dopo che l'utente avrà autorizzato ed eseguito il deploy, guida una verifica manuale con questi passi, riportando l'esito:

- [ ] **Step 1:** Login come Admin, apri Risultati Partite. Verifica che compaia il controllo "+ Aggiungi annata precedente" con le annate passate della propria società (non quella attiva).
- [ ] **Step 2:** Seleziona un'annata passata con partite esistenti. Verifica che le partite compaiano mescolate a quelle correnti nella lista e nel grafico "Andamento Risultati", e che compaia il pulsante "🗑️ Cancella dati <nome annata>".
- [ ] **Step 3:** Deseleziona l'annata. Verifica che la vista torni a mostrare solo i dati della stagione corrente (nessun dato residuo).
- [ ] **Step 4:** Ripeti selezione, poi clicca il pulsante di cancellazione. Verifica che il modal mostri il nome annata corretto, NESSUN banner condiviso (essendo Risultati Partite), e che il pulsante resti disabilitato finché il testo non corrisponde esattamente.
- [ ] **Step 5:** Conferma la cancellazione. Verifica il messaggio con il conteggio, che l'annata sparisca dalla select, e che (in un'altra sessione o refresh) i dati di quell'annata risultino effettivamente cancellati sul server (es. via `season-archive` o riaprendo la stessa annata come corrente).
- [ ] **Step 6:** Ripeti Step 1-2 per Valutazioni e per Conteggio Presenze Atleti (categoria `evaluations`). Verifica che il modal mostri QUESTA VOLTA il banner di avviso condiviso.
- [ ] **Step 7:** Da Valutazioni, seleziona un'annata in ENTRAMBE Valutazioni e Presenze, poi cancella da Valutazioni. Verifica che il pulsante/selezione dell'annata sparisca automaticamente ANCHE nella sezione Presenze (sync cross-sezione).
- [ ] **Step 8:** Prova ad accedere come Coach (non Admin): verifica che il pulsante di cancellazione non sia visibile in nessuna delle 3 sezioni (il controllo di confronto/visualizzazione invece resta disponibile per tutti i ruoli con accesso alla sezione).
- [ ] **Step 9:** Prova a chiamare l'endpoint direttamente con `targetAnnataId` uguale all'annata attualmente attiva: verifica risposta 400 "Non puoi cancellare l'annata attiva da qui, usa Cambio Stagione".

Nessun commit in questo task: è verifica, non codice.

---

## Note finali per chi esegue il piano

- I Task 1-7 sono in ordine di dipendenza stretta (ognuno usa funzioni/markup introdotti dal precedente) — NON eseguirli in parallelo con subagent indipendenti; vanno eseguiti in sequenza.
- Il Task 8 richiede il deploy, che è fuori dallo scope di questo piano: fermati dopo il Task 7 e chiedi esplicitamente all'utente se/quando vuole fare il deploy, prima di procedere al Task 8.
- Nel Task 4 il nome della funzione che aggiorna il grafico "Andamento Risultati" è già stato verificato con Grep/Read: è `updateMatchAnalysisChart` (script.js:2833), non `updateMatchResultsChart`. Se il codice fosse nel frattempo cambiato, verifica di nuovo prima di scrivere la chiamata.
- **Scope deliberatamente ridotto rispetto al dettaglio "badge annata" della spec** (riga 42 della spec: "Ogni riga/voce proveniente da un'annata diversa mostra un badge discreto col nome dell'annata"). Questo piano fonde i dati direttamente nelle variabili globali (`matchResults`/`evaluations`) senza marcare quali elementi provengono da un'annata diversa, quindi le card/righe esistenti (`renderMatchResults`, tabelle marcatori/assist/cartellini) NON mostrano il badge — è un gap noto rispetto alla spec, accettabile per il primo giro (i dati restano comunque distinguibili tramite la select "annate selezionate" visibile sopra la lista). Se l'utente lo richiede esplicitamente durante la review, aggiungere un Task 4bis dopo il Task 4: taggare ogni oggetto fuso con `_fromAnnataId`/`_fromAnnataNome` dentro `mergeCategoryData` e leggere quel campo in `renderMatchResults` (script.js:2690, dentro `cardContent`) per stampare un badge Bootstrap (`<span class="badge bg-secondary">${match._fromAnnataNome}</span>`) accanto alla data.
