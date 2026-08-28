# Cronografo Circuiti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere in Area Tecnica un cronometro classico con frazionamenti (lap) per cronometrare rapidamente circuiti/percorsi, assegnare i tempi agli atleti dell'annata, salvarli in uno storico persistente `circuitTimes`, collegarli automaticamente ai dati GPS dell'atleta (`gpsData`), e confrontare i miglioramenti individuali/di squadra con tabelle e un grafico Chart.js.

**Architecture:** Nuova pagina standalone `public/cronografo.html` (JS inline, come `reattivita.html`, ma con chiamate autenticate a `/api/data` come `area-tecnica.js`). Il server (`api/data.js`) guadagna una nuova chiave KV per-annata `circuitTimes`, letta nel GET staff esistente e scritta nel blocco POST protetto da `canWrite`. Nessun nuovo file `api/` (limite 12 funzioni Hobby già saturo). Il link alla pagina va aggiunto in `public/area-tecnica.html` accanto a "Test Reattività".

**Tech Stack:** HTML/CSS/JS vanilla (nessun framework), fetch API, Chart.js 4.4.0 via CDN (`https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`, già usato in `dashboard.html`), Vercel KV (`@vercel/kv`), Node.js serverless function esistente `api/data.js`.

**Spec di riferimento:** `docs/superpowers/specs/2026-08-28-cronografo-circuiti-design.md`

---

## Contesto per chi implementa (leggere prima di iniziare)

- **Autenticazione/annata**: usa lo stesso pattern di `public/area-tecnica.js` (righe 1-31): funzione `ss(key)` con fallback `sessionStorage → localStorage['_p_'+key]`, `annataId()` (URL `?annata=` → `ss('gosport_current_annata')` → `localStorage.currentAnnata`), `authHeaders(json)` che costruisce gli header `X-Annata-Id`, `X-Auth-Session`, `X-Auth-User`, `X-User-Role`, `X-Society-Id`. Questo pattern va copiato (non importato — `area-tecnica.js` non esporta nulla, è caricato come script separato) dentro il nuovo file.
- **Nessun gate di permessi nella pagina**: chiunque può aprire `cronografo.html` e vedere l'interfaccia; il server rifiuta con 403 chi non ha `canWrite(session.role)` al momento del salvataggio. Stesso principio di `reattivita.html`/Test Reattività.
- **Struttura atleta**: `athlete.id` (stringa/numero usato come chiave) e `athlete.name` (stringa visualizzata) — confermato in `public/script.js`.
- **Formula velocità GPS**: `velocita_circuito = (distanza_circuito / tempo_circuito_totale_s) * 3.6` arrotondata a 2 decimali (`toFixed(2)`), identica a quella già usata in `public/script.js:5351`.
- **ID storico**: pattern `'ctime_' + Date.now() + '_' + Math.random().toString(36).substr(2,5)`, stesso schema di `'sondaggio_' + ...`.
- **Salvataggio "rileggi prima di scrivere"**: prima di inviare il POST che aggiorna `circuitTimes`/`gpsData`, la pagina deve rifare una GET fresca di `/api/data` e fare il merge additivo sullo stato più recente, per non sovrascrivere modifiche concorrenti di un altro utente/scheda.

---

## Task 1: Endpoint server — lettura `circuitTimes`

**Files:**
- Modify: `api/data.js:3284-3291` (destructuring + Promise.all del GET staff)
- Modify: `api/data.js:3319-3320` (aggiunta kv.get)
- Modify: `api/data.js:3323-3355` (oggetto `data` finale)

- [ ] **Step 1: Aggiungere `circuitTimes` al destructuring e alla Promise.all**

In `api/data.js`, il blocco attuale (righe 3284-3321) è:

```js
      const [
        athletes, evaluations, gpsData, awards, trainingSessions,
        formationData, matchResults, calendarEvents, calendarResponses,
        materiale, pagamenti, pagVoci, pagLabels, convocazioni, convSettings,
        convBg, convBg2, posts, globalPosts, individualPassword,
        ratingSheets, documents, athleteDocs, bachecaConfig, superadminBanners,
        tacticalBoards, multe, surveys, surveyResponses
      ] = await Promise.all([
        kv.get(`${prefix}:athletes`),
        kv.get(`${prefix}:evaluations`),
        kv.get(`${prefix}:gpsData`),
        kv.get(`${prefix}:awards`),
        kv.get(`${prefix}:trainingSessions`),
        kv.get(`${prefix}:formationData`),
        kv.get(`${prefix}:matchResults`),
        kv.get(`${prefix}:calendarEvents`),
        kv.get(`${prefix}:calendarResponses`),
        kv.get(`${prefix}:materiale`),
        kv.get(`${prefix}:pagamenti`),
        kv.get(`${prefix}:pagVoci`),
        kv.get(`${prefix}:pagLabels`),
        kv.get(`${prefix}:convocazioni`),
        kv.get(`${prefix}:convSettings`),
        kv.get(`${prefix}:convBg`),
        kv.get(`${prefix}:convBg2`),
        kv.get(`${prefix}:posts`),
        kv.get('global:posts'),
        kv.get(`${prefix}:individualPassword`),
        kv.get(`${prefix}:ratingSheets`),
        kv.get(`${prefix}:documents`),
        kv.get(`${prefix}:athleteDocs`),
        kv.get('global:bachecaConfig'),
        kv.get('global:superadminBanners'),
        kv.get(`${prefix}:tacticalBoards`),
        kv.get(`${prefix}:multe`),
        kv.get(`${prefix}:surveys`),
        kv.get(`${prefix}:surveyResponses`)
      ]);
```

Sostituirlo con (aggiunta `circuitTimes` in fondo a entrambe le liste, mantenendo l'ordine posizionale):

```js
      const [
        athletes, evaluations, gpsData, awards, trainingSessions,
        formationData, matchResults, calendarEvents, calendarResponses,
        materiale, pagamenti, pagVoci, pagLabels, convocazioni, convSettings,
        convBg, convBg2, posts, globalPosts, individualPassword,
        ratingSheets, documents, athleteDocs, bachecaConfig, superadminBanners,
        tacticalBoards, multe, surveys, surveyResponses, circuitTimes
      ] = await Promise.all([
        kv.get(`${prefix}:athletes`),
        kv.get(`${prefix}:evaluations`),
        kv.get(`${prefix}:gpsData`),
        kv.get(`${prefix}:awards`),
        kv.get(`${prefix}:trainingSessions`),
        kv.get(`${prefix}:formationData`),
        kv.get(`${prefix}:matchResults`),
        kv.get(`${prefix}:calendarEvents`),
        kv.get(`${prefix}:calendarResponses`),
        kv.get(`${prefix}:materiale`),
        kv.get(`${prefix}:pagamenti`),
        kv.get(`${prefix}:pagVoci`),
        kv.get(`${prefix}:pagLabels`),
        kv.get(`${prefix}:convocazioni`),
        kv.get(`${prefix}:convSettings`),
        kv.get(`${prefix}:convBg`),
        kv.get(`${prefix}:convBg2`),
        kv.get(`${prefix}:posts`),
        kv.get('global:posts'),
        kv.get(`${prefix}:individualPassword`),
        kv.get(`${prefix}:ratingSheets`),
        kv.get(`${prefix}:documents`),
        kv.get(`${prefix}:athleteDocs`),
        kv.get('global:bachecaConfig'),
        kv.get('global:superadminBanners'),
        kv.get(`${prefix}:tacticalBoards`),
        kv.get(`${prefix}:multe`),
        kv.get(`${prefix}:surveys`),
        kv.get(`${prefix}:surveyResponses`),
        kv.get(`${prefix}:circuitTimes`)
      ]);
```

- [ ] **Step 2: Aggiungere `circuitTimes` all'oggetto `data` finale**

Il blocco attuale (righe 3323-3355) termina con:

```js
        multe: multe || {},
        surveys: surveys || {},
        surveyResponses: surveyResponses || {}
      };
```

Sostituirlo con:

```js
        multe: multe || {},
        surveys: surveys || {},
        surveyResponses: surveyResponses || {},
        circuitTimes: circuitTimes || {}
      };
```

- [ ] **Step 3: Verifica manuale (nessun test automatizzato nel progetto per questo file)**

Il progetto non ha una suite di test automatizzata per `api/data.js` (verificato: nessun file `*.test.js`/`*.spec.js` nella cartella `api/`). La verifica di questo task avviene nel Task 4 (test end-to-end manuale con la pagina).

Eseguire comunque un controllo sintattico rapido:

Run: `node --check api/data.js`
Expected: nessun output (exit code 0 = sintassi valida)

- [ ] **Step 4: Commit**

```bash
git add api/data.js
git commit -m "feat(cronografo): aggiunge lettura circuitTimes al GET /api/data"
```

---

## Task 2: Endpoint server — scrittura `circuitTimes`

**Files:**
- Modify: `api/data.js:3566` (blocco POST protetto da `canWrite`)

- [ ] **Step 1: Aggiungere la riga di scrittura**

Il blocco attuale (righe 3565-3571) è:

```js
      if (body.posts !== undefined) await kv.set(`${prefix}:posts`, body.posts);
      if (body.surveys !== undefined) await kv.set(`${prefix}:surveys`, body.surveys);
      // Scrittura staff di surveyResponses: solo per eliminare un sondaggio (rimuove
      // anche le sue risposte in un'unica richiesta insieme a body.surveys). Diverso
      // dal ramo genitore (riga ~3396): qui siamo già dentro canWrite(), nessun
      // vincolo di "una sola chiave" perché la richiesta è autenticata staff.
      if (body.surveyResponses !== undefined) await kv.set(`${prefix}:surveyResponses`, body.surveyResponses);
```

Aggiungere subito dopo (prima della riga `const globalPostIds = ...`):

```js
      if (body.posts !== undefined) await kv.set(`${prefix}:posts`, body.posts);
      if (body.surveys !== undefined) await kv.set(`${prefix}:surveys`, body.surveys);
      // Scrittura staff di surveyResponses: solo per eliminare un sondaggio (rimuove
      // anche le sue risposte in un'unica richiesta insieme a body.surveys). Diverso
      // dal ramo genitore (riga ~3396): qui siamo già dentro canWrite(), nessun
      // vincolo di "una sola chiave" perché la richiesta è autenticata staff.
      if (body.surveyResponses !== undefined) await kv.set(`${prefix}:surveyResponses`, body.surveyResponses);
      if (body.circuitTimes !== undefined) await kv.set(`${prefix}:circuitTimes`, body.circuitTimes);
```

Nota: `body.gpsData` è già gestito da un blocco esistente più sopra nello stesso handler POST (`if (body.gpsData !== undefined) await kv.set(...)`) — non serve alcuna modifica per quella parte, la pagina `cronografo.html` invierà `gpsData` nello stesso body e verrà salvato automaticamente.

- [ ] **Step 2: Verifica sintattica**

Run: `node --check api/data.js`
Expected: nessun output (exit code 0)

- [ ] **Step 3: Commit**

```bash
git add api/data.js
git commit -m "feat(cronografo): aggiunge scrittura circuitTimes al POST /api/data"
```

---

## Task 3: Link in Area Tecnica

**Files:**
- Modify: `public/area-tecnica.html:76`

- [ ] **Step 1: Aggiungere il pulsante accanto a "Test Reattività"**

La riga attuale (76) è:

```html
                <a href="/reattivita.html" class="at-btn-ghost" style="text-decoration:none;border-color:#f59e0b;color:#fbbf24;" title="Schermo con stimoli colorati per esercizi di reattività sul campo">⚡ Test Reattività</a>
```

Sostituirla con (aggiunta del nuovo link subito dopo, stesso stile ghost ma colore distinto):

```html
                <a href="/reattivita.html" class="at-btn-ghost" style="text-decoration:none;border-color:#f59e0b;color:#fbbf24;" title="Schermo con stimoli colorati per esercizi di reattività sul campo">⚡ Test Reattività</a>
                <a href="/cronografo.html" class="at-btn-ghost" style="text-decoration:none;border-color:#1aa05e;color:#4ade80;" title="Cronometro con frazionamenti per cronometrare circuiti e assegnare i tempi agli atleti">⏱️ Cronografo Circuiti</a>
```

- [ ] **Step 2: Verifica manuale**

Aprire `public/area-tecnica.html` nel browser (o via dev server locale) e controllare visivamente che il nuovo pulsante compaia accanto a "Test Reattività" con lo stesso stile ghost. Il link porterà a un 404 fino al Task 4 (creazione della pagina) — atteso a questo punto del piano.

- [ ] **Step 3: Commit**

```bash
git add public/area-tecnica.html
git commit -m "feat(cronografo): aggiunge link Cronografo Circuiti in Area Tecnica"
```

---

## Task 4: Pagina `cronografo.html` — struttura, autenticazione, cronometro

**Files:**
- Create: `public/cronografo.html`

- [ ] **Step 1: Creare lo scheletro della pagina (tema, header, autenticazione)**

Creare `public/cronografo.html` con questo contenuto iniziale (tema scuro coerente con `reattivita.html`, pattern auth di `area-tecnica.js`):

```html
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cronografo Circuiti</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<style>
  :root {
    --bg: #060f1e;
    --card: #0d1b2a;
    --accent: #1aa05e;
    --accent-light: #4ade80;
    --text: #e2e8f0;
    --text-dim: #94a3b8;
    --border: #1e3a52;
    --danger: #ef4444;
    --warn: #f59e0b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-height: 100vh;
  }
  .cr-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 14px 20px;
    color: var(--text-dim);
    text-decoration: none;
    font-size: 0.9rem;
  }
  .cr-back:hover { color: var(--accent-light); }
  .cr-header {
    padding: 0 20px 10px;
  }
  .cr-header h1 {
    font-size: 1.4rem;
    margin: 0;
    color: var(--accent-light);
  }
  .cr-header p {
    color: var(--text-dim);
    font-size: 0.85rem;
    margin: 4px 0 0;
  }
  .cr-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 10px 16px 60px;
  }
  .cr-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 16px;
  }
  .cr-card h2 {
    font-size: 1rem;
    margin: 0 0 14px;
    color: var(--text);
  }
  label {
    display: block;
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-bottom: 4px;
  }
  input, select {
    width: 100%;
    background: #0a1622;
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.95rem;
    margin-bottom: 12px;
  }
  input:focus, select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .cr-display {
    text-align: center;
    font-size: 3rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--accent-light);
    padding: 20px 0;
    letter-spacing: 1px;
  }
  .cr-btns {
    display: flex;
    gap: 10px;
    margin-bottom: 6px;
  }
  .cr-btn {
    flex: 1;
    border: none;
    border-radius: 8px;
    padding: 14px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
  }
  .cr-btn-start { background: var(--accent); color: #04140b; }
  .cr-btn-lap { background: #1e3a52; color: var(--text); }
  .cr-btn-stop { background: var(--danger); color: #fff; }
  .cr-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .cr-laps {
    margin-top: 12px;
    max-height: 160px;
    overflow-y: auto;
  }
  .cr-lap-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 4px;
    border-bottom: 1px solid var(--border);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }
  .cr-assign {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    margin-top: 14px;
  }
  .cr-assign select { margin-bottom: 0; }
  .cr-assign button {
    background: var(--accent);
    color: #04140b;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .cr-assign button:disabled { opacity: 0.4; cursor: not-allowed; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th, td {
    text-align: left;
    padding: 8px 6px;
    border-bottom: 1px solid var(--border);
  }
  th { color: var(--text-dim); font-weight: 600; font-size: 0.8rem; }
  td.num { font-variant-numeric: tabular-nums; }
  .cr-icon-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 1rem;
    padding: 2px 6px;
  }
  .cr-icon-btn:hover { color: var(--accent-light); }
  .cr-save-btn {
    width: 100%;
    background: var(--accent);
    color: #04140b;
    border: none;
    border-radius: 8px;
    padding: 14px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 14px;
  }
  .cr-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .cr-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--card);
    border: 1px solid var(--accent);
    color: var(--text);
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 0.9rem;
    z-index: 999;
    display: none;
  }
  .cr-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }
  .cr-tab {
    flex: 1;
    text-align: center;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: #0a1622;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .cr-tab.active {
    background: var(--accent);
    color: #04140b;
    border-color: var(--accent);
    font-weight: 600;
  }
  .cr-delta-up { color: #ef4444; }
  .cr-delta-down { color: #4ade80; }
  .cr-empty {
    color: var(--text-dim);
    font-size: 0.85rem;
    text-align: center;
    padding: 20px 0;
  }
</style>
</head>
<body>
<a href="/area-tecnica.html" class="cr-back">← Area Tecnica</a>
<div class="cr-header">
  <h1>⏱️ Cronografo Circuiti</h1>
  <p>Cronometra un circuito e assegna il tempo agli atleti, con frazionamenti.</p>
</div>
<div class="cr-container">

  <div class="cr-card">
    <h2>Cronometro</h2>
    <label for="cr-circuito">Nome circuito</label>
    <input type="text" id="cr-circuito" list="cr-circuiti-list" placeholder="Es. Slalom 20m">
    <datalist id="cr-circuiti-list"></datalist>

    <div class="cr-display" id="cr-display">00:00.00</div>

    <div class="cr-btns">
      <button class="cr-btn cr-btn-start" id="cr-btn-start">▶ Start</button>
      <button class="cr-btn cr-btn-lap" id="cr-btn-lap" disabled>🏁 Lap</button>
      <button class="cr-btn cr-btn-stop" id="cr-btn-stop" disabled>⏹ Stop</button>
    </div>

    <div class="cr-laps" id="cr-laps"></div>

    <div class="cr-assign">
      <div style="flex:1;">
        <label for="cr-atleta">Assegna a</label>
        <select id="cr-atleta" disabled></select>
      </div>
      <button id="cr-btn-assign" disabled>+ Aggiungi alla lista</button>
    </div>
  </div>

  <div class="cr-card" id="cr-session-card" style="display:none;">
    <h2>Sessione corrente</h2>
    <table>
      <thead><tr><th>Atleta</th><th>Tempo</th><th></th></tr></thead>
      <tbody id="cr-session-body"></tbody>
    </table>
    <button class="cr-save-btn" id="cr-btn-save">💾 Salva tutti i tempi (0)</button>
  </div>

  <div class="cr-card">
    <h2>Storico</h2>
    <div class="cr-tabs">
      <div class="cr-tab active" id="cr-tab-atleta" data-tab="atleta">Per atleta</div>
      <div class="cr-tab" id="cr-tab-squadra" data-tab="squadra">Confronto squadra</div>
    </div>
    <div id="cr-view-atleta"></div>
    <div id="cr-view-squadra" style="display:none;"></div>
  </div>

</div>
<div class="cr-toast" id="cr-toast"></div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
// ── Autenticazione/annata (pattern da area-tecnica.js) ─────────────────────
function ss(key) {
  return sessionStorage.getItem(key) || localStorage.getItem('_p_' + key) || '';
}
function annataId() {
  const u = new URL(location.href);
  return u.searchParams.get('annata') || ss('gosport_current_annata') || localStorage.getItem('currentAnnata') || '';
}
function authHeaders(json) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  h['X-Annata-Id'] = annataId();
  h['X-Auth-Session'] = ss('gosport_session_token');
  h['X-Auth-User'] = ss('gosport_auth_user');
  h['X-User-Role'] = ss('gosport_user_role');
  h['X-Society-Id'] = ss('gosport_society_id');
  return h;
}
function toast(msg) {
  const t = document.getElementById('cr-toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.style.display = 'none'; }, 3000);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Stato applicazione ──────────────────────────────────────────────────
let ATHLETES = [];
let CIRCUIT_TIMES = {};
let GPS_DATA = {};
let sessionList = []; // { athleteId, athleteName, tempoTotale, laps, circuito }
let timerInterval = null;
let timerStart = 0;
let lapMarks = []; // secondi assoluti dall'inizio, per calcolare i parziali
let running = false;

async function loadData() {
  const res = await fetch('/api/data', { headers: authHeaders(false) });
  if (!res.ok) { toast('Errore nel caricamento dati'); return null; }
  return res.json();
}

async function init() {
  const data = await loadData();
  if (!data) return;
  ATHLETES = data.athletes || [];
  CIRCUIT_TIMES = data.circuitTimes || {};
  GPS_DATA = data.gpsData || {};

  populateAthleteSelect();
  populateCircuitDatalist();
  renderAtletaView();
  renderSquadraView();
}

function populateAthleteSelect() {
  const sel = document.getElementById('cr-atleta');
  sel.innerHTML = '<option value="">Seleziona atleta…</option>' +
    ATHLETES.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
}

function populateCircuitDatalist() {
  const names = new Set();
  Object.values(CIRCUIT_TIMES).forEach(list => {
    (list || []).forEach(e => names.add(e.circuito));
  });
  const dl = document.getElementById('cr-circuiti-list');
  dl.innerHTML = Array.from(names).map(n => `<option value="${esc(n)}"></option>`).join('');
}

// ── Cronometro ──────────────────────────────────────────────────────────
function fmtTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const cs = Math.round((totalSec - Math.floor(totalSec)) * 100);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
}

function updateDisplay() {
  const elapsed = running ? (Date.now() - timerStart) / 1000 : lastElapsed;
  document.getElementById('cr-display').textContent = fmtTime(elapsed);
}

let lastElapsed = 0;

function startTimer() {
  if (!document.getElementById('cr-circuito').value.trim()) {
    toast('Inserisci il nome del circuito prima di partire');
    return;
  }
  running = true;
  timerStart = Date.now();
  lapMarks = [];
  document.getElementById('cr-laps').innerHTML = '';
  timerInterval = setInterval(updateDisplay, 30);
  document.getElementById('cr-btn-start').disabled = true;
  document.getElementById('cr-btn-lap').disabled = false;
  document.getElementById('cr-btn-stop').disabled = false;
  document.getElementById('cr-circuito').disabled = true;
}

function lapTimer() {
  if (!running) return;
  const elapsed = (Date.now() - timerStart) / 1000;
  const prevMark = lapMarks.length ? lapMarks[lapMarks.length - 1] : 0;
  const lapDuration = elapsed - prevMark;
  lapMarks.push(elapsed);
  const row = document.createElement('div');
  row.className = 'cr-lap-row';
  row.innerHTML = `<span>Lap ${lapMarks.length}</span><span>${fmtTime(lapDuration)}</span>`;
  document.getElementById('cr-laps').appendChild(row);
}

function stopTimer() {
  if (!running) return;
  running = false;
  clearInterval(timerInterval);
  lastElapsed = (Date.now() - timerStart) / 1000;
  updateDisplay();
  document.getElementById('cr-btn-start').disabled = false;
  document.getElementById('cr-btn-lap').disabled = true;
  document.getElementById('cr-btn-stop').disabled = true;
  document.getElementById('cr-atleta').disabled = false;
  document.getElementById('cr-btn-assign').disabled = false;
}

function resetTimerKeepCircuit() {
  lastElapsed = 0;
  lapMarks = [];
  document.getElementById('cr-display').textContent = '00:00.00';
  document.getElementById('cr-laps').innerHTML = '';
  document.getElementById('cr-circuito').disabled = false;
  document.getElementById('cr-atleta').value = '';
  document.getElementById('cr-atleta').disabled = true;
  document.getElementById('cr-btn-assign').disabled = true;
}

document.getElementById('cr-btn-start').addEventListener('click', startTimer);
document.getElementById('cr-btn-lap').addEventListener('click', lapTimer);
document.getElementById('cr-btn-stop').addEventListener('click', stopTimer);

document.getElementById('cr-btn-assign').addEventListener('click', () => {
  const athleteId = document.getElementById('cr-atleta').value;
  if (!athleteId) { toast('Seleziona un atleta'); return; }
  const athlete = ATHLETES.find(a => String(a.id) === String(athleteId));
  if (!athlete) return;
  const circuito = document.getElementById('cr-circuito').value.trim();
  const laps = [];
  let prev = 0;
  lapMarks.forEach(m => { laps.push(Math.round((m - prev) * 100) / 100); prev = m; });

  sessionList.push({
    athleteId: athlete.id,
    athleteName: athlete.name,
    circuito,
    tempoTotale: Math.round(lastElapsed * 100) / 100,
    laps
  });
  renderSessionList();
  resetTimerKeepCircuit();
  toast('Tempo assegnato a ' + athlete.name);
});

// ── Lista sessione ──────────────────────────────────────────────────────
function renderSessionList() {
  const card = document.getElementById('cr-session-card');
  const body = document.getElementById('cr-session-body');
  if (!sessionList.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  body.innerHTML = sessionList.map((e, i) => `
    <tr>
      <td>${esc(e.athleteName)}</td>
      <td class="num">${fmtTime(e.tempoTotale)}</td>
      <td>
        <button class="cr-icon-btn" data-action="edit" data-idx="${i}" title="Modifica">✏️</button>
        <button class="cr-icon-btn" data-action="del" data-idx="${i}" title="Rimuovi">🗑️</button>
      </td>
    </tr>
  `).join('');
  document.getElementById('cr-btn-save').textContent = `💾 Salva tutti i tempi (${sessionList.length})`;
}

document.getElementById('cr-session-body').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  if (btn.dataset.action === 'del') {
    sessionList.splice(idx, 1);
    renderSessionList();
  } else if (btn.dataset.action === 'edit') {
    const entry = sessionList[idx];
    const nuovo = prompt('Nuovo tempo totale in secondi (es. 8.42) per ' + entry.athleteName, entry.tempoTotale);
    if (nuovo === null) return;
    const val = parseFloat(nuovo.replace(',', '.'));
    if (isNaN(val) || val <= 0) { toast('Valore non valido'); return; }
    entry.tempoTotale = Math.round(val * 100) / 100;
    renderSessionList();
  }
});

document.getElementById('cr-btn-save').addEventListener('click', saveSession);

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verifica manuale del cronometro (senza salvataggio, implementato nel Task 5)**

Aprire `public/cronografo.html` in un browser locale (es. `npx serve public` o equivalente già usato nel progetto), con parametri URL validi di sessione (`?annata=<id>` più sessionStorage popolato da un login reale nell'app), e verificare:
1. Digitando un nome circuito e premendo "▶ Start", il display parte e i pulsanti Lap/Stop si abilitano.
2. Premendo "🏁 Lap" più volte, compaiono righe "Lap 1", "Lap 2", ... con il tempo del singolo tratto (non cumulativo).
3. Premendo "⏹ Stop", il cronometro si ferma, si abilita la select atleta.
4. Selezionando un atleta e premendo "+ Aggiungi alla lista", l'atleta compare nella tabella "Sessione corrente" e il cronometro si resetta mantenendo il nome del circuito.

Expected: tutti i 4 comportamenti sopra si verificano senza errori in console.

- [ ] **Step 3: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): crea pagina con cronometro multi-atleta e lap"
```

---

## Task 5: Salvataggio sessione (circuitTimes + collegamento gpsData)

**Files:**
- Modify: `public/cronografo.html` (aggiunta funzione `saveSession` referenziata nel Task 4, Step 1, riga `document.getElementById('cr-btn-save').addEventListener('click', saveSession);`)

- [ ] **Step 1: Implementare `saveSession()` con rilettura, merge additivo e collegamento GPS**

Aggiungere prima della riga `init();` in `public/cronografo.html` (subito dopo il blocco "Lista sessione" del Task 4):

```js
// ── Salvataggio (rileggi prima di scrivere) ──────────────────────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function makeCircuitTimeId() {
  return 'ctime_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

async function saveSession() {
  if (!sessionList.length) return;
  const btn = document.getElementById('cr-btn-save');
  btn.disabled = true;
  btn.textContent = 'Salvataggio…';

  try {
    // 1. Rilettura fresca dello stato corrente (evita di sovrascrivere modifiche concorrenti)
    const fresh = await loadData();
    if (!fresh) throw new Error('reload-failed');
    const freshCircuitTimes = fresh.circuitTimes || {};
    const freshGpsData = fresh.gpsData || {};
    const today = todayStr();

    // 2. Merge additivo di circuitTimes
    sessionList.forEach(entry => {
      const athleteId = String(entry.athleteId);
      if (!freshCircuitTimes[athleteId]) freshCircuitTimes[athleteId] = [];
      freshCircuitTimes[athleteId].push({
        id: makeCircuitTimeId(),
        date: today,
        circuito: entry.circuito,
        tempoTotale: entry.tempoTotale,
        laps: entry.laps,
        createdBy: ss('gosport_auth_user') || ''
      });
    });

    // 3. Collegamento con Dati Performance (gpsData): aggiorna/crea la sessione odierna,
    //    sempre indice [0] dell'array, mai indovinare quale sessione tra più di una.
    sessionList.forEach(entry => {
      const athleteId = String(entry.athleteId);
      if (!freshGpsData[athleteId]) freshGpsData[athleteId] = {};
      if (!freshGpsData[athleteId][today] || !Array.isArray(freshGpsData[athleteId][today]) || !freshGpsData[athleteId][today].length) {
        freshGpsData[athleteId][today] = [{
          tempo_circuito_totale_s: entry.tempoTotale,
          distanza_circuito: null,
          velocita_circuito: null,
          fonte: 'cronografo'
        }];
      } else {
        const session0 = freshGpsData[athleteId][today][0];
        session0.tempo_circuito_totale_s = entry.tempoTotale;
        if (session0.distanza_circuito) {
          session0.velocita_circuito = parseFloat(((session0.distanza_circuito / entry.tempoTotale) * 3.6).toFixed(2));
        }
      }
    });

    // 4. POST del merge
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ circuitTimes: freshCircuitTimes, gpsData: freshGpsData })
    });
    if (!res.ok) throw new Error('save-failed');

    // 5. Successo: aggiorna stato locale, svuota lista, ricarica storico
    CIRCUIT_TIMES = freshCircuitTimes;
    GPS_DATA = freshGpsData;
    sessionList = [];
    renderSessionList();
    populateCircuitDatalist();
    renderAtletaView();
    renderSquadraView();
    toast('Tempi salvati con successo');
  } catch (err) {
    // Errore di rete: la lista sessione resta intatta, l'utente può ritentare
    toast('Errore di salvataggio — riprova, la lista è stata mantenuta');
    btn.disabled = false;
    btn.textContent = `💾 Salva tutti i tempi (${sessionList.length})`;
  }
}
```

- [ ] **Step 2: Verifica manuale end-to-end**

Con l'app in esecuzione e login staff valido:
1. Cronometrare un circuito con 2 atleti diversi, salvare.
2. Fare GET manuale `/api/data` (o ricaricare la pagina) e verificare che `circuitTimes[athleteId]` contenga le nuove voci con `id`, `date`, `circuito`, `tempoTotale`, `laps`, `createdBy`.
3. Verificare che `gpsData[athleteId][oggi]` esista con `tempo_circuito_totale_s` coerente.
4. Aprire "Dati Performance" (gps-btn) per uno di quegli atleti in Gestione Squadra e controllare che il campo tempo circuito sia precompilato con lo stesso valore.
5. Disconnettere la rete (o bloccare temporaneamente l'endpoint) e ripetere un salvataggio: verificare che compaia il toast di errore e che la lista sessione NON venga svuotata.

Expected: tutti i 5 controlli superati.

- [ ] **Step 3: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): salva sessione in circuitTimes e aggiorna gpsData collegato"
```

---

## Task 6: Vista storico "Per atleta" con grafico Chart.js

**Files:**
- Modify: `public/cronografo.html` (implementazione di `renderAtletaView()`, referenziata nei Task 4 e 5)

- [ ] **Step 1: Implementare `renderAtletaView()`**

Aggiungere prima di `init()` in `public/cronografo.html`:

```js
// ── Vista storico: Per atleta ────────────────────────────────────────────
let atletaChart = null;

function circuitiPerAtleta(athleteId) {
  const list = CIRCUIT_TIMES[String(athleteId)] || [];
  const names = new Set(list.map(e => e.circuito));
  return Array.from(names);
}

function renderAtletaView() {
  const container = document.getElementById('cr-view-atleta');
  if (!ATHLETES.length) {
    container.innerHTML = '<div class="cr-empty">Nessun atleta disponibile.</div>';
    return;
  }
  container.innerHTML = `
    <label for="cr-hist-atleta">Atleta</label>
    <select id="cr-hist-atleta">${ATHLETES.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>
    <label for="cr-hist-circuito">Circuito</label>
    <select id="cr-hist-circuito"></select>
    <canvas id="cr-hist-chart" height="180"></canvas>
    <table style="margin-top:14px;">
      <thead><tr><th>Data</th><th>Tempo</th><th>Variazione</th></tr></thead>
      <tbody id="cr-hist-body"></tbody>
    </table>
  `;
  document.getElementById('cr-hist-atleta').addEventListener('change', refreshAtletaCircuitOptions);
  document.getElementById('cr-hist-circuito').addEventListener('change', refreshAtletaDetail);
  refreshAtletaCircuitOptions();
}

function refreshAtletaCircuitOptions() {
  const athleteId = document.getElementById('cr-hist-atleta').value;
  const circuiti = circuitiPerAtleta(athleteId);
  const sel = document.getElementById('cr-hist-circuito');
  if (!circuiti.length) {
    sel.innerHTML = '<option value="">Nessun circuito cronometrato</option>';
    document.getElementById('cr-hist-body').innerHTML = '';
    if (atletaChart) { atletaChart.destroy(); atletaChart = null; }
    return;
  }
  // Default: il circuito con la sessione più recente
  const list = CIRCUIT_TIMES[String(athleteId)] || [];
  const mostRecent = [...list].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  sel.innerHTML = circuiti.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (mostRecent) sel.value = mostRecent.circuito;
  refreshAtletaDetail();
}

function refreshAtletaDetail() {
  const athleteId = document.getElementById('cr-hist-atleta').value;
  const circuito = document.getElementById('cr-hist-circuito').value;
  const list = (CIRCUIT_TIMES[String(athleteId)] || [])
    .filter(e => e.circuito.toLowerCase() === (circuito || '').toLowerCase())
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const body = document.getElementById('cr-hist-body');
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="3" class="cr-empty">Nessun dato</td></tr>';
  } else {
    body.innerHTML = list.map((e, i) => {
      let delta = '—';
      if (i > 0) {
        const diff = Math.round((e.tempoTotale - list[i - 1].tempoTotale) * 100) / 100;
        if (diff < 0) delta = `<span class="cr-delta-down">▼ ${Math.abs(diff).toFixed(2)}s</span>`;
        else if (diff > 0) delta = `<span class="cr-delta-up">▲ ${diff.toFixed(2)}s</span>`;
        else delta = '— (invariato)';
      }
      return `<tr><td>${esc(e.date)}</td><td class="num">${fmtTime(e.tempoTotale)}</td><td>${delta}</td></tr>`;
    }).join('');
  }

  renderAtletaChart(list);
}

function renderAtletaChart(list) {
  const canvas = document.getElementById('cr-hist-chart');
  if (atletaChart) { atletaChart.destroy(); atletaChart = null; }
  if (!list.length) return;

  atletaChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: list.map(e => e.date),
      datasets: [{
        label: 'Tempo (s)',
        data: list.map(e => e.tempoTotale),
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        tension: 0.25,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#4ade80'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e3a52' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e3a52' }, title: { display: true, text: 'secondi', color: '#94a3b8' } }
      }
    }
  });
}
```

- [ ] **Step 2: Verifica manuale**

Con dati salvati per almeno un atleta su almeno 2 date diverse per lo stesso circuito (ripetere il Task 5 due volte in giorni diversi non è pratico in test manuale: per verificare, modificare temporaneamente la `date` di una voce direttamente da devtools/console prima di ricaricare, oppure accettare che con un solo punto dati il grafico mostri comunque un singolo punto senza errori):
1. Selezionare l'atleta e il circuito: la tabella mostra le righe con "Variazione" corretta (▼ verde se migliorato, ▲ rosso se peggiorato, — se primo test).
2. Il grafico Chart.js mostra la linea con i punti corrispondenti; con un solo punto dati il grafico non genera errori console.
3. Cambiando atleta, la select circuito si aggiorna con solo i circuiti effettivamente cronometrati da quell'atleta.

Expected: tutti i controlli superati, nessun errore in console.

- [ ] **Step 3: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): vista storico per atleta con grafico Chart.js e delta miglioramento"
```

---

## Task 7: Vista storico "Confronto squadra"

**Files:**
- Modify: `public/cronografo.html` (implementazione di `renderSquadraView()`, tab switching)

- [ ] **Step 1: Implementare `renderSquadraView()` e lo switch tra tab**

Aggiungere prima di `init()` in `public/cronografo.html`:

```js
// ── Vista storico: Confronto squadra ─────────────────────────────────────
function tuttiCircuiti() {
  const names = new Set();
  Object.values(CIRCUIT_TIMES).forEach(list => (list || []).forEach(e => names.add(e.circuito)));
  return Array.from(names);
}

function dateDisponibiliPerCircuito(circuito) {
  const dates = new Set();
  Object.values(CIRCUIT_TIMES).forEach(list => {
    (list || []).forEach(e => {
      if (e.circuito.toLowerCase() === (circuito || '').toLowerCase()) dates.add(e.date);
    });
  });
  return Array.from(dates).sort();
}

function renderSquadraView() {
  const container = document.getElementById('cr-view-squadra');
  const circuiti = tuttiCircuiti();
  if (!circuiti.length) {
    container.innerHTML = '<div class="cr-empty">Nessun circuito cronometrato ancora.</div>';
    return;
  }
  container.innerHTML = `
    <label for="cr-sq-circuito">Circuito</label>
    <select id="cr-sq-circuito">${circuiti.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
    <div style="display:flex;gap:10px;">
      <div style="flex:1;">
        <label for="cr-sq-dateA">Data A</label>
        <select id="cr-sq-dateA"></select>
      </div>
      <div style="flex:1;">
        <label for="cr-sq-dateB">Data B</label>
        <select id="cr-sq-dateB"></select>
      </div>
    </div>
    <table>
      <thead><tr><th>Atleta</th><th>Tempo A</th><th>Tempo B</th><th>Variazione</th></tr></thead>
      <tbody id="cr-sq-body"></tbody>
    </table>
  `;
  document.getElementById('cr-sq-circuito').addEventListener('change', refreshSquadraDates);
  document.getElementById('cr-sq-dateA').addEventListener('change', refreshSquadraTable);
  document.getElementById('cr-sq-dateB').addEventListener('change', refreshSquadraTable);
  refreshSquadraDates();
}

function refreshSquadraDates() {
  const circuito = document.getElementById('cr-sq-circuito').value;
  const dates = dateDisponibiliPerCircuito(circuito);
  const selA = document.getElementById('cr-sq-dateA');
  const selB = document.getElementById('cr-sq-dateB');
  const opts = dates.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  if (dates.length >= 2) {
    selA.value = dates[dates.length - 2];
    selB.value = dates[dates.length - 1];
  }
  refreshSquadraTable();
}

function refreshSquadraTable() {
  const circuito = document.getElementById('cr-sq-circuito').value;
  const dateA = document.getElementById('cr-sq-dateA').value;
  const dateB = document.getElementById('cr-sq-dateB').value;
  const body = document.getElementById('cr-sq-body');

  if (!dateA || !dateB) {
    body.innerHTML = '<tr><td colspan="4" class="cr-empty">Seleziona due date</td></tr>';
    return;
  }

  const rows = [];
  ATHLETES.forEach(a => {
    const list = CIRCUIT_TIMES[String(a.id)] || [];
    const entryA = list.find(e => e.circuito.toLowerCase() === circuito.toLowerCase() && e.date === dateA);
    const entryB = list.find(e => e.circuito.toLowerCase() === circuito.toLowerCase() && e.date === dateB);
    if (entryA && entryB) {
      rows.push({ name: a.name, a: entryA.tempoTotale, b: entryB.tempoTotale, diff: Math.round((entryB.tempoTotale - entryA.tempoTotale) * 100) / 100 });
    }
  });

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="4" class="cr-empty">Nessun atleta con tempi in entrambe le date</td></tr>';
    return;
  }

  const html = rows.map(r => {
    const deltaHtml = r.diff < 0
      ? `<span class="cr-delta-down">▼ ${Math.abs(r.diff).toFixed(2)}s</span>`
      : r.diff > 0
        ? `<span class="cr-delta-up">▲ ${r.diff.toFixed(2)}s</span>`
        : '— (invariato)';
    return `<tr><td>${esc(r.name)}</td><td class="num">${fmtTime(r.a)}</td><td class="num">${fmtTime(r.b)}</td><td>${deltaHtml}</td></tr>`;
  }).join('');

  const mediaVariazione = Math.round((rows.reduce((sum, r) => sum + r.diff, 0) / rows.length) * 100) / 100;
  const mediaHtml = mediaVariazione < 0
    ? `<span class="cr-delta-down">▼ ${Math.abs(mediaVariazione).toFixed(2)}s</span>`
    : mediaVariazione > 0
      ? `<span class="cr-delta-up">▲ ${mediaVariazione.toFixed(2)}s</span>`
      : '— (invariata)';

  body.innerHTML = html + `<tr style="font-weight:700;"><td colspan="3">Media squadra</td><td>${mediaHtml}</td></tr>`;
}

// ── Switch tab ────────────────────────────────────────────────────────────
document.getElementById('cr-tab-atleta').addEventListener('click', () => {
  document.getElementById('cr-tab-atleta').classList.add('active');
  document.getElementById('cr-tab-squadra').classList.remove('active');
  document.getElementById('cr-view-atleta').style.display = 'block';
  document.getElementById('cr-view-squadra').style.display = 'none';
});
document.getElementById('cr-tab-squadra').addEventListener('click', () => {
  document.getElementById('cr-tab-squadra').classList.add('active');
  document.getElementById('cr-tab-atleta').classList.remove('active');
  document.getElementById('cr-view-squadra').style.display = 'block';
  document.getElementById('cr-view-atleta').style.display = 'none';
});
```

- [ ] **Step 2: Verifica manuale**

Con dati salvati per almeno 2 atleti sullo stesso circuito in 2 date diverse (stesso accorgimento di test del Task 6 per generare date diverse):
1. Cliccare sul tab "Confronto squadra": la vista "Per atleta" si nasconde, compare la tabella squadra.
2. Selezionare il circuito: le select Data A/Data B si popolano con le date disponibili, precompilate con le due più recenti.
3. La tabella mostra solo gli atleti con tempo in ENTRAMBE le date, con colonna "Variazione" (▼/▲/—) corretta.
4. La riga finale "Media squadra" mostra la media aritmetica delle variazioni.
5. Cambiando circuito senza tempi in comune tra atleti, compare il messaggio "Nessun atleta con tempi in entrambe le date".

Expected: tutti i controlli superati.

- [ ] **Step 3: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): vista confronto squadra tra due date con media variazione"
```

---

## Task 8: Aggiornamento grafo graphify

**Files:**
- Nessuna modifica di codice — solo comando

- [ ] **Step 1: Eseguire l'aggiornamento del grafo (AST-only, come da regola progetto in CLAUDE.md)**

Run: `graphify update .`
Expected: il comando termina senza errori, riportando i nuovi file/nodi rilevati (`cronografo.html`, le modifiche a `area-tecnica.html` e `api/data.js`).

- [ ] **Step 2: Commit (se il comando produce modifiche a file tracciati in `graphify-out/`)**

```bash
git add graphify-out/
git commit -m "chore(graphify): aggiorna grafo dopo feature Cronografo Circuiti"
```

Se `graphify update .` non modifica nulla di tracciato (es. output rigenerato ma ignorato da `.gitignore`), saltare questo step senza commit vuoto.

---

## Self-Review (eseguita durante la stesura del piano)

**1. Copertura spec** — ogni sezione della spec `2026-08-28-cronografo-circuiti-design.md` ha un task corrispondente:
- Cronometro multi-atleta + lap → Task 4
- Storico persistente `circuitTimes` + endpoint server → Task 1, 2
- Link in Area Tecnica → Task 3
- Lista sessione + salvataggio in blocco → Task 4 (UI), Task 5 (logica salvataggio)
- Collegamento con Dati Performance (gpsData) → Task 5
- Confronto miglioramento singolo (delta vs sessione precedente) → Task 6
- Confronto miglioramento squadra (due date) → Task 7
- Grafico Chart.js andamento per atleta → Task 6
- Permessi identici a Test Reattività (nessun gate in pagina, solo server `canWrite`) → Task 2 (il gate è lato server, non aggiunto in pagina in nessun task)
- Aggiornamento grafo graphify dopo modifica codice → Task 8

**2. Scansione placeholder** — nessun "TBD"/"TODO"/"aggiungi validazione" generico nei task: ogni step contiene codice completo o comandi con output atteso esplicito.

**3. Coerenza dei tipi/nomi** — verificata coerenza tra i task:
- `athlete.id` / `athlete.name` usati identicamente in Task 4, 5, 6, 7.
- `CIRCUIT_TIMES` (stato globale) popolato in Task 4 (`init`), letto/scritto in Task 5, 6, 7 — stesso nome ovunque.
- `fmtTime()` definita una sola volta in Task 4, riusata in Task 6 e 7 senza ridefinizioni.
- `esc()`, `toast()`, `authHeaders()`, `ss()`, `annataId()` definite in Task 4, riusate senza ridefinizione negli altri task.
- Schema `circuitTimes[athleteId] = [{ id, date, circuito, tempoTotale, laps, createdBy }]` identico tra spec, Task 1 (lettura), Task 5 (scrittura), Task 6/7 (lettura per la vista).
- Schema `gpsData[athleteId][date] = [{ tempo_circuito_totale_s, distanza_circuito, velocita_circuito, fonte }]` coerente tra spec e Task 5.
