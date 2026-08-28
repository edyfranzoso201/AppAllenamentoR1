# Sondaggi in Org. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere sondaggi per annata in Org. (`calendario.html`), creati/gestiti dallo staff, a cui i genitori rispondono dal proprio link presenze (`?athleteId=...`), con riepilogo sempre completo per lo staff e visibilità configurabile del risultato ai genitori.

**Architecture:** Due nuove chiavi Redis per annata (`surveys`, `surveyResponses`), lette/scritte in `api/data.js` seguendo esattamente il pattern già in uso per `calendarEvents`/`calendarResponses` (incluso il ramo `isParentMode` per `?parentMode=1` e il ramo di scrittura non autenticata per `surveyResponses`). Lato client: un nuovo tab "Sondaggi" in `calendario.html` per lo staff, e una nuova sezione dinamica in `calendario-standalone.js` per la vista genitore, iniettata subito dopo `bacheca-genitori-container`/`parent-docs-section` con lo stesso pattern già usato da `_renderParentDocsSection`.

**Tech Stack:** Vanilla JS (nessun framework), Vercel KV (Redis) via `kv.get`/`kv.set`, Vercel serverless function esistente `api/data.js` (nessun nuovo file).

---

## File Structure

- **Modify:** `api/data.js` — validazione, lettura (`isParentMode` + payload staff completo), scrittura (staff `surveys`, genitore `surveyResponses`)
- **Modify:** `public/calendario.html` — bottone tab `#tab-sondaggi`, contenitore `#tab-content-sondaggi`, funzione `showSondaggiTab()`, entry in `switchTab()`/`labelMap`
- **Modify:** `public/calendario-standalone.js` — chiamate a `showSondaggiTab()` nei due punti dove oggi si chiama `showBachecaTab()`/`showGareTab()`/`showDocumentiTab()`; nuova funzione `window._renderParentSurveysSection()` (pattern identico a `_renderParentDocsSection`) chiamata da `loadBachecaGenitori()`

Nessun nuovo file: tutto extende file esistenti, coerente col vincolo "nessun nuovo `.js` in `api/`" e con la struttura attuale di `calendario.html`/`calendario-standalone.js` (un solo file per la UI Org., un solo file per la logica calendario).

---

### Task 1: Modello dati e validazione server-side in `api/data.js`

**Files:**
- Modify: `api/data.js:3116-3118` (guard scrittura non autenticata)
- Modify: `api/data.js` (nuova funzione di validazione, da inserire vicino alle altre funzioni helper di validazione — cercare `function parentSigOk` con Grep per posizionarla nello stesso blocco di funzioni helper)

- [ ] **Step 1: Individua il punto esatto per la nuova funzione helper**

Apri `api/data.js` e cerca la definizione di `parentSigOk` (già usata per la firma HMAC dei link genitore). La nuova funzione di validazione va definita subito dopo, nello stesso blocco di helper di primo livello (fuori da qualunque handler HTTP).

- [ ] **Step 2: Scrivi la funzione di validazione risposta sondaggio**

Inserisci subito dopo la definizione di `parentSigOk`:

```js
// Valida una risposta a sondaggio prima di salvarla. Ritorna true se valida,
// false altrimenti — nessuna eccezione, il chiamante decide cosa rispondere.
// Regole (spec docs/superpowers/specs/2026-08-28-sondaggi-org-design.md):
// 1) il surveyId deve esistere in surveys
// 2) il sondaggio deve essere aperto: status === "open" e (closesAt nullo o non ancora passata)
// 3) le choices devono essere tutte incluse in options
// 4) se multiple === false, choices deve avere esattamente 1 elemento
function isValidSurveyResponse(surveys, surveyId, choices) {
  if (!surveys || typeof surveys !== 'object') return false;
  const survey = surveys[surveyId];
  if (!survey) return false;
  if (survey.status !== 'open') return false;
  if (survey.closesAt !== null && survey.closesAt !== undefined && Date.now() > survey.closesAt) return false;
  if (!Array.isArray(choices) || choices.length === 0) return false;
  const validOptions = new Set(survey.options || []);
  if (!choices.every(c => validOptions.has(c))) return false;
  if (!survey.multiple && choices.length !== 1) return false;
  return true;
}
```

- [ ] **Step 3: Verifica sintassi**

```bash
node --check api/data.js
```
Expected: nessun output (nessun errore di sintassi).

- [ ] **Step 4: Estendi il guard di scrittura non autenticata (riga 3116-3118)**

Trova il blocco esistente:

```js
// FIX v1.5.21: POST con solo calendarResponses o athleteDocs è permessa anche ai genitori non autenticati
const isCalendarResponsePost = req.method === 'POST' &&
  req.body && (req.body.calendarResponses !== undefined || req.body.athleteDocs !== undefined) &&
  Object.keys(req.body).length === 1;
```

Sostituiscilo con:

```js
// FIX v1.5.21: POST con solo calendarResponses o athleteDocs è permessa anche ai genitori non autenticati
// Estensione sondaggi: stesso trattamento per surveyResponses (validato più sotto prima del kv.set).
const isCalendarResponsePost = req.method === 'POST' &&
  req.body && (req.body.calendarResponses !== undefined || req.body.athleteDocs !== undefined
    || req.body.surveyResponses !== undefined) &&
  Object.keys(req.body).length === 1;
```

- [ ] **Step 5: Verifica sintassi**

```bash
node --check api/data.js
```
Expected: nessun output.

- [ ] **Step 6: Commit**

```bash
git add api/data.js
git commit -m "feat(sondaggi): validazione risposta sondaggio + guard scrittura genitore"
```

---

### Task 2: Lettura `surveys`/`surveyResponses` nei payload GET (staff + genitore)

**Files:**
- Modify: `api/data.js:3184-3219` (ramo `isParentMode`)
- Modify: `api/data.js:3260-3322` (ramo staff autenticato — payload completo per annata)

- [ ] **Step 1: Estendi il `Promise.all` e la risposta del ramo genitore (`isParentMode`)**

Trova (righe 3184-3198):

```js
const [calendarEvents, calendarResponses, convSettings, athletes, posts, globalPosts, documents, materiale, bachecaConfig, superadminBanners, convBg, convBg2, athleteDocs] = await Promise.all([
kv.get(`${prefix}:calendarEvents`),
kv.get(`${prefix}:calendarResponses`),
kv.get(`${prefix}:convSettings`),
kv.get(`${prefix}:athletes`),
kv.get(`${prefix}:posts`),
kv.get('global:posts'),
kv.get(`${prefix}:documents`),
kv.get(`${prefix}:materiale`),
kv.get('global:bachecaConfig'),
kv.get('global:superadminBanners'),
kv.get(`${prefix}:convBg`),
kv.get(`${prefix}:convBg2`),
kv.get(`${prefix}:athleteDocs`)  // ← documenti caricati dai genitori
]);
```

Sostituiscilo con (aggiunte `surveys`, `surveyResponses` in coda):

```js
const [calendarEvents, calendarResponses, convSettings, athletes, posts, globalPosts, documents, materiale, bachecaConfig, superadminBanners, convBg, convBg2, athleteDocs, surveys, surveyResponses] = await Promise.all([
kv.get(`${prefix}:calendarEvents`),
kv.get(`${prefix}:calendarResponses`),
kv.get(`${prefix}:convSettings`),
kv.get(`${prefix}:athletes`),
kv.get(`${prefix}:posts`),
kv.get('global:posts'),
kv.get(`${prefix}:documents`),
kv.get(`${prefix}:materiale`),
kv.get('global:bachecaConfig'),
kv.get('global:superadminBanners'),
kv.get(`${prefix}:convBg`),
kv.get(`${prefix}:convBg2`),
kv.get(`${prefix}:athleteDocs`),  // ← documenti caricati dai genitori
kv.get(`${prefix}:surveys`),
kv.get(`${prefix}:surveyResponses`)
]);
```

Poi trova (righe 3200-3219, l'oggetto di risposta) e aggiungi `surveys`/`surveyResponses` prima della chiusura `});`:

```js
return res.status(200).json({
calendarEvents: calendarEvents || {},
calendarResponses: calendarResponses || {},
teamName: resolvedTeamName,
convSettings: convSettings || {},
convBg:  convBg  || null,
convBg2: convBg2 || null,
athletes: (athletes || []).map(a => ({
id: a.id,
name: a.name,
ruolo: a.ruolo || a.role || ''
})),
posts: posts || [],
globalPosts: globalPosts || [],
documents: (documents || []).filter(d => (d.visibility || []).includes('pubblica')),
materiale: materiale || { items: [], assignments: {} },
bachecaConfig: bachecaConfig || {},
superadminBanners: superadminBanners || {},
athleteDocs: athleteDocs || {},  // ← incluso nella risposta
surveys: surveys || {},
surveyResponses: surveyResponses || {}
});
```

- [ ] **Step 2: Verifica sintassi**

```bash
node --check api/data.js
```
Expected: nessun output.

- [ ] **Step 3: Individua ed estendi il ramo staff autenticato**

Cerca con Grep il secondo `Promise.all` che elenca `calendarResponses` (righe vicine a 3260-3322, quello usato per l'utente autenticato con payload completo). Segui lo stesso pattern del Task precedente: aggiungi `kv.get(\`${prefix}:surveys\`)` e `kv.get(\`${prefix}:surveyResponses\`)` all'array del `Promise.all`, aggiungi le due variabili corrispondenti alla destrutturazione, e aggiungi `surveys: surveys || {}, surveyResponses: surveyResponses || {}` all'oggetto di risposta finale di quel ramo (vicino a dove oggi compare `bachecaConfig: bachecaConfig || {}` per quel ramo, riga ~3322).

Comando di verifica preliminare (esegui prima di modificare, per confermare i numeri di riga esatti nel tuo checkout):

```bash
grep -n "calendarResponses, convSettings, athletes, posts, globalPosts, documents, materiale, bachecaConfig, superadminBanners, convBg, convBg2, athleteDocs" api/data.js
```

Expected: due righe (una per il ramo `isParentMode` già modificato al Task precedente, una per il ramo staff). Modifica SOLO la seconda occorrenza rimasta (quella non ancora toccata) allo stesso modo del Task precedente.

- [ ] **Step 4: Verifica sintassi**

```bash
node --check api/data.js
```
Expected: nessun output.

- [ ] **Step 5: Commit**

```bash
git add api/data.js
git commit -m "feat(sondaggi): includi surveys/surveyResponses nei payload GET (staff + genitore)"
```

---

### Task 3: Scrittura `surveys` (staff) e `surveyResponses` (genitore) in `api/data.js`

**Files:**
- Modify: `api/data.js:3356-3359` (blocco scrittura per genitori non autenticati)
- Modify: `api/data.js:3500` circa (blocco scrittura staff autenticato, accanto a `body.posts`)

- [ ] **Step 1: Aggiungi la scrittura genitore con validazione**

Trova (righe 3356-3359):

```js
// FIX v1.5.21: calendarResponses può essere salvato da genitori (anche non autenticati)
if (body.calendarResponses !== undefined && Object.keys(body).length === 1) {
await kv.set(`${prefix}:calendarResponses`, body.calendarResponses);
```

Subito dopo la chiusura di quel blocco `if`, aggiungi:

```js
// Sondaggi: il genitore scrive SOLO surveyResponses (mai surveys), stesso
// schema di calendarResponses sopra. Validiamo ogni risposta prima di salvarla:
// un body malformato o un sondaggio già chiuso non deve scrivere silenziosamente.
if (body.surveyResponses !== undefined && Object.keys(body).length === 1) {
  const existingSurveys = (await kv.get(`${prefix}:surveys`)) || {};
  const incoming = body.surveyResponses || {};
  const validated = {};
  for (const surveyId of Object.keys(incoming)) {
    const perAthlete = incoming[surveyId] || {};
    const validAthleteEntries = {};
    for (const athleteId of Object.keys(perAthlete)) {
      const entry = perAthlete[athleteId];
      if (entry && isValidSurveyResponse(existingSurveys, surveyId, entry.choices)) {
        validAthleteEntries[athleteId] = {
          choices: entry.choices,
          respondedAt: Date.now()
        };
      }
    }
    if (Object.keys(validAthleteEntries).length > 0) {
      validated[surveyId] = validAthleteEntries;
    }
  }
  if (Object.keys(validated).length === 0) {
    return res.status(400).json({ success: false, message: 'Risposta sondaggio non valida o sondaggio chiuso' });
  }
  // Merge con le risposte esistenti (altri sondaggi/atleti non toccati da questa richiesta)
  const existingResponses = (await kv.get(`${prefix}:surveyResponses`)) || {};
  for (const surveyId of Object.keys(validated)) {
    existingResponses[surveyId] = Object.assign({}, existingResponses[surveyId] || {}, validated[surveyId]);
  }
  await kv.set(`${prefix}:surveyResponses`, existingResponses);
  return res.status(200).json({ success: true });
}
```

- [ ] **Step 2: Verifica sintassi**

```bash
node --check api/data.js
```
Expected: nessun output.

- [ ] **Step 3: Aggiungi la scrittura staff (`surveys`)**

Trova (riga ~3500):

```js
if (body.posts !== undefined) await kv.set(`${prefix}:posts`, body.posts);
```

Aggiungi subito dopo:

```js
if (body.surveys !== undefined) await kv.set(`${prefix}:surveys`, body.surveys);
```

Questa riga si trova nel blocco protetto da `if (!canWrite(session.role)) return res.status(403)...` (`api/data.js:3423-3425`), lo stesso guard che protegge `body.posts` e le altre chiavi elencate lì. **Verificato che `canWrite()` (righe 242-245) include già `dirigentel1`** (oltre ad `admin`, `coachl0/l1/l2`, `societal1`, `dirigentel2`) — quindi `dirigente_l1` può già scrivere `body.surveys` lato server senza alcuna modifica aggiuntiva, coerente con la decisione presa per i permessi lato client (Task 4/7: `['admin','coach_l1','coach_l2','dirigente_l1']`). Nessun controllo aggiuntivo necessario.

- [ ] **Step 4: Verifica sintassi**

```bash
node --check api/data.js
```
Expected: nessun output.

- [ ] **Step 5: Test manuale end-to-end con curl (richiede server locale o deploy di staging — se non disponibile, verifica logica leggendo il codice riga per riga e tracciando a mano un caso valido e uno invalido)**

Traccia a mano (nessun server disponibile in locale per questo progetto):
- Caso valido: `surveys = {"s1": {options:["A","B"], multiple:false, status:"open", closesAt:null}}`, body `{"surveyResponses":{"s1":{"a1":{"choices":["A"]}}}}` → `isValidSurveyResponse` ritorna true → scritto.
- Caso invalido (sondaggio chiuso): stesso survey con `status:"closed"` → `isValidSurveyResponse` ritorna false → `validated` resta vuoto → risposta 400, nessuna scrittura.
- Caso invalido (multiple:false con 2 scelte): `choices:["A","B"]` su survey `multiple:false` → `choices.length !== 1` → false → 400.

- [ ] **Step 6: Commit**

```bash
git add api/data.js
git commit -m "feat(sondaggi): scrittura surveys (staff) e surveyResponses (genitore, validata)"
```

---

### Task 4: Tab "Sondaggi" — markup e navigazione in `calendario.html`

**Files:**
- Modify: `public/calendario.html:1145-1148` (bottone tab)
- Modify: `public/calendario.html:1573` (nuovo `tab-content-sondaggi`, subito dopo la chiusura di `tab-content-athlete-docs`)
- Modify: `public/calendario.html:1648-1677` (`switchTab`, `labelMap`)
- Modify: `public/calendario.html:1589-1592` (variabile `_sondaggiTabReady`)
- Modify: `public/calendario.html:2465-2489` (nuova funzione `showSondaggiTab`, accanto a `showDocumentiTab`)

- [ ] **Step 1: Aggiungi il bottone tab**

Trova (righe 1145-1147):

```html
            <button class="page-tab" id="tab-athlete-docs" style="display:none;" onclick="switchTab('athlete-docs')">
                <i class="bi bi-file-earmark-check-fill"></i> Documenti Atleti
            </button>
        </div>
```

Sostituiscilo con:

```html
            <button class="page-tab" id="tab-athlete-docs" style="display:none;" onclick="switchTab('athlete-docs')">
                <i class="bi bi-file-earmark-check-fill"></i> Documenti Atleti
            </button>
            <button class="page-tab" id="tab-sondaggi" style="display:none;" onclick="switchTab('sondaggi')">
                <i class="bi bi-bar-chart-fill"></i> Sondaggi
            </button>
        </div>
```

- [ ] **Step 2: Aggiungi il contenitore `tab-content-sondaggi`**

Trova (righe 1569-1573):

```html
                <div id="athlete-docs-table-container">
                    <p style="color:#94a3b8;font-size:0.85rem;">Caricamento...</p>
                </div>
            </div>
        </div>
```

Sostituiscilo con (nota: la chiusura `</div></div>` di athlete-docs resta, si aggiunge il blocco sondaggi subito dopo):

```html
                <div id="athlete-docs-table-container">
                    <p style="color:#94a3b8;font-size:0.85rem;">Caricamento...</p>
                </div>
            </div>
        </div>

        <!-- ── TAB: Sondaggi ── -->
        <div class="tab-content" id="tab-content-sondaggi" style="display:none;">
            <div style="padding:8px 0;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
                    <h3 style="color:var(--text-primary);margin:0;font-size:1rem;font-weight:700;">
                        <i class="bi bi-bar-chart-fill" style="color:#3b82f6;"></i>
                        Sondaggi
                    </h3>
                    <button id="sondaggi-new-btn" onclick="window.sondaggiOpenForm()" style="margin-left:auto;background:#16a34a;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:0.82rem;font-weight:600;cursor:pointer;">
                        <i class="bi bi-plus-circle"></i> Nuovo Sondaggio
                    </button>
                </div>
                <div id="sondaggi-list-container">
                    <p style="color:#94a3b8;font-size:0.85rem;">Caricamento...</p>
                </div>
                <div id="sondaggi-form-container" style="display:none;"></div>
                <div id="sondaggi-detail-container" style="display:none;"></div>
            </div>
        </div>
```

- [ ] **Step 3: Aggiungi la variabile di stato `_sondaggiTabReady`**

Trova (riga 1589-1592):

```js
var _bachecaTabReady=false;
var _gareTabReady=false;
var _gareCanEdit=false;
var _documentiTabReady=false;
```

Sostituiscilo con:

```js
var _bachecaTabReady=false;
var _gareTabReady=false;
var _gareCanEdit=false;
var _documentiTabReady=false;
var _sondaggiTabReady=false;
```

- [ ] **Step 4: Aggiungi `showSondaggiTab()` accanto a `showDocumentiTab`**

Trova (righe 2484-2489, la fine di `showDocumentiTab`):

```js
    // Mostra anche tab Documenti Atleti (solo per coach, non genitore)
    var tabAd = document.getElementById('tab-athlete-docs');
    if (tabAd) {
        tabAd.style.display = '';
    }
}
```

Aggiungi subito dopo la chiusura `}`:

```js

// ── Mostra tab Sondaggi (chiamato dall'auth, simile a showBachecaTab) ──
// NOTA permessi: a differenza di Bacheca/Gare/Documenti (solo admin/coach_l1/
// coach_l2), i Sondaggi includono ANCHE dirigente_l1 — scelta esplicita
// dell'utente (vedi docs/superpowers/specs/2026-08-28-sondaggi-org-design.md,
// sezione Permessi), non un allineamento al pattern degli altri tab.
function showSondaggiTab(canEdit) {
    if (_sondaggiTabReady) return;
    // Modalità genitore: niente tab coach (vedi showBachecaTab per il perché).
    if (new URLSearchParams(location.search).get('athleteId')) return;
    _sondaggiTabReady = true;
    var tab = document.getElementById('tab-sondaggi');
    if (tab) tab.style.display = '';
    window._sondaggiCanEdit = !!canEdit;
    var newBtn = document.getElementById('sondaggi-new-btn');
    if (newBtn) newBtn.style.display = canEdit ? '' : 'none';
}
```

- [ ] **Step 5: Aggiungi il case `sondaggi` in `switchTab` e in `labelMap`**

Trova (righe 1663-1670):

```js
    if(tab==='documenti'){
        window._docCanEdit = true;
        _docsLoaded = false;
        if(typeof docLoad==='function')docLoad();
    }
    if(tab==='athlete-docs'){ window._loadAthleteDocsTab(); }
    // ── HAMBURGER mobile (v1.5.3): aggiorna label e chiudi menu ──
    var labelMap = { calendario: 'Calendario Squadra', bacheca: 'Bacheca Comunicazioni', gare: 'Gare da Disputare', documenti: 'Documenti Società', 'athlete-docs': 'Documenti Atleti' };
```

Sostituiscilo con:

```js
    if(tab==='documenti'){
        window._docCanEdit = true;
        _docsLoaded = false;
        if(typeof docLoad==='function')docLoad();
    }
    if(tab==='athlete-docs'){ window._loadAthleteDocsTab(); }
    if(tab==='sondaggi'){ if(typeof window.sondaggiLoad==='function') window.sondaggiLoad(); }
    // ── HAMBURGER mobile (v1.5.3): aggiorna label e chiudi menu ──
    var labelMap = { calendario: 'Calendario Squadra', bacheca: 'Bacheca Comunicazioni', gare: 'Gare da Disputare', documenti: 'Documenti Società', 'athlete-docs': 'Documenti Atleti', sondaggi: 'Sondaggi' };
```

- [ ] **Step 6: Verifica che i blocchi `<script>` inline restino sintatticamente validi**

Non esiste un linter diretto per JS embedded in HTML in questo progetto. Verifica manualmente: apri `public/calendario.html` e conta le parentesi graffe aperte/chiuse nelle funzioni appena modificate (`showSondaggiTab`, `switchTab`) confrontandole con l'originale — nessuna riga deve restare orfana.

- [ ] **Step 7: Commit**

```bash
git add public/calendario.html
git commit -m "feat(sondaggi): tab Sondaggi in Org. (markup + navigazione, senza logica dati)"
```

---

### Task 5: Logica staff — lista, form creazione, dettaglio/risultati in `calendario.html`

**Files:**
- Modify: `public/calendario.html` — nuovo blocco di funzioni JS `sondaggiLoad`, `sondaggiRender`, `sondaggiOpenForm`, `sondaggiSaveForm`, `sondaggiOpenDetail`, `sondaggiCloseSurvey`. Da inserire subito dopo la funzione `showSondaggiTab()` scritta nel Task 4 (stesso blocco logico, tra `showSondaggiTab` e `// ── switchTab hook: carica gare se necessario ──`).

- [ ] **Step 1: Scrivi il blocco funzioni staff**

Inserisci subito dopo la chiusura di `showSondaggiTab()` (scritta al Task 4):

```js

// ═══════════════════════════════════════════════════════════════════
// ████  SONDAGGI (staff)  ████
// ═══════════════════════════════════════════════════════════════════

var _sondaggi = {};          // { [surveyId]: Survey }
var _sondaggiResponses = {}; // { [surveyId]: { [athleteId]: Response } }
var _sondaggiAthletes = [];  // atleti dell'annata (per conteggio risposte)
var _sondaggiLoaded = false;

function _sondaggiAnnataId() {
    return sessionStorage.getItem('gosport_current_annata') || '';
}

window.sondaggiLoad = async function() {
    var container = document.getElementById('sondaggi-list-container');
    if (container) container.innerHTML = '<p style="color:#94a3b8;font-size:0.85rem;">Caricamento...</p>';
    try {
        var aid = _sondaggiAnnataId();
        var res = await fetch('/api/data', { cache: 'no-store', headers: { 'x-annata-id': aid } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var d = await res.json();
        _sondaggi = d.surveys || {};
        _sondaggiResponses = d.surveyResponses || {};
        _sondaggiAthletes = (d.athletes || []).filter(function(a){ return !a.isGuest && !a.isStaff; });
        _sondaggiLoaded = true;
    } catch (e) {
        console.warn('[Sondaggi] load err:', e);
        if (container) container.innerHTML = '<p style="color:#f87171;">Errore nel caricamento dei sondaggi.</p>';
        return;
    }
    sondaggiRenderList();
};

// Un sondaggio è considerato aperto solo se status==="open" E la scadenza
// (se impostata) non è ancora passata. Calcolato a runtime, mai scritto sul
// server automaticamente (vedi spec: nessun cron dedicato).
function _sondaggiIsOpen(survey) {
    if (!survey || survey.status !== 'open') return false;
    if (survey.closesAt !== null && survey.closesAt !== undefined && Date.now() > survey.closesAt) return false;
    return true;
}

function sondaggiRenderList() {
    var container = document.getElementById('sondaggi-list-container');
    if (!container) return;
    var ids = Object.keys(_sondaggi).sort(function(a, b) {
        return (_sondaggi[b].createdAt || 0) - (_sondaggi[a].createdAt || 0);
    });
    if (ids.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8;font-size:0.85rem;">Nessun sondaggio creato.</p>';
        return;
    }
    var totalAthletes = _sondaggiAthletes.length;
    var html = '';
    ids.forEach(function(id) {
        var s = _sondaggi[id];
        var open = _sondaggiIsOpen(s);
        var responded = Object.keys(_sondaggiResponses[id] || {}).length;
        var scadenzaTxt = s.closesAt ? new Date(s.closesAt).toLocaleString('it-IT') : 'Nessuna scadenza';
        html += '<div class="sondaggio-card" data-survey-id="' + id + '" '
            + 'style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;'
            + 'padding:14px;margin-bottom:10px;cursor:pointer;" onclick="window.sondaggiOpenDetail(\'' + id + '\')">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
            + '<strong style="color:var(--text-primary);">' + s.question.replace(/</g,'&lt;') + '</strong>'
            + '<span style="' + (open ? 'color:#16a34a;' : 'color:#94a3b8;') + 'font-weight:600;font-size:0.82rem;">'
            + (open ? '🟢 Aperto' : '⚫ Chiuso') + '</span>'
            + '</div>'
            + '<div style="color:var(--text-muted);font-size:0.78rem;margin-top:6px;">'
            + 'Scadenza: ' + scadenzaTxt + ' · ' + responded + '/' + totalAthletes + ' hanno risposto'
            + '</div></div>';
    });
    container.innerHTML = html;
}

window.sondaggiOpenForm = function() {
    document.getElementById('sondaggi-list-container').style.display = 'none';
    document.getElementById('sondaggi-detail-container').style.display = 'none';
    var formC = document.getElementById('sondaggi-form-container');
    formC.style.display = '';
    formC.innerHTML = ''
        + '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px;">'
        + '<h4 style="margin-top:0;color:var(--text-primary);">Nuovo Sondaggio</h4>'
        + '<label style="display:block;color:var(--text-muted);font-size:0.82rem;margin-bottom:4px;">Domanda</label>'
        + '<input type="text" id="sondaggi-f-question" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input,#0f172a);color:var(--text-primary);margin-bottom:10px;">'
        + '<label style="display:block;color:var(--text-muted);font-size:0.82rem;margin-bottom:4px;">Opzioni</label>'
        + '<div id="sondaggi-f-options"></div>'
        + '<button type="button" onclick="window.sondaggiAddOption()" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:0.78rem;cursor:pointer;margin-bottom:10px;">+ Aggiungi opzione</button>'
        + '<div style="margin-bottom:10px;">'
        + '<label style="color:var(--text-muted);font-size:0.82rem;"><input type="radio" name="sondaggi-f-multiple" value="0" checked> Scelta singola</label>'
        + '&nbsp;&nbsp;'
        + '<label style="color:var(--text-muted);font-size:0.82rem;"><input type="radio" name="sondaggi-f-multiple" value="1"> Scelta multipla</label>'
        + '</div>'
        + '<label style="display:block;color:var(--text-muted);font-size:0.82rem;margin-bottom:4px;">Scadenza (opzionale)</label>'
        + '<input type="datetime-local" id="sondaggi-f-closes" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input,#0f172a);color:var(--text-primary);margin-bottom:10px;">'
        + '<div style="margin-bottom:10px;">'
        + '<label style="color:var(--text-muted);font-size:0.82rem;"><input type="checkbox" id="sondaggi-f-show-results" checked onchange="document.getElementById(\'sondaggi-f-show-names-wrap\').style.display=this.checked?\'\':\'none\'"> Mostra risultati ai genitori</label>'
        + '</div>'
        + '<div id="sondaggi-f-show-names-wrap" style="margin-bottom:14px;">'
        + '<label style="color:var(--text-muted);font-size:0.82rem;"><input type="checkbox" id="sondaggi-f-show-names"> Mostra anche chi ha risposto cosa</label>'
        + '</div>'
        + '<button type="button" onclick="window.sondaggiSaveForm()" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-weight:600;cursor:pointer;">Crea Sondaggio</button>'
        + '&nbsp;'
        + '<button type="button" onclick="window.sondaggiCancelForm()" style="background:transparent;color:var(--text-muted);border:1px solid var(--border);border-radius:6px;padding:8px 16px;cursor:pointer;">Annulla</button>'
        + '</div>';
    // Due opzioni vuote di partenza (minimo richiesto)
    document.getElementById('sondaggi-f-options').innerHTML = '';
    window.sondaggiAddOption();
    window.sondaggiAddOption();
};

window.sondaggiAddOption = function() {
    var wrap = document.getElementById('sondaggi-f-options');
    var idx = wrap.children.length;
    var row = document.createElement('div');
    row.style.cssText = 'margin-bottom:6px;';
    row.innerHTML = '<input type="text" class="sondaggi-f-option" placeholder="Opzione ' + (idx + 1) + '" '
        + 'style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input,#0f172a);color:var(--text-primary);">';
    wrap.appendChild(row);
};

window.sondaggiCancelForm = function() {
    document.getElementById('sondaggi-form-container').style.display = 'none';
    document.getElementById('sondaggi-list-container').style.display = '';
};

window.sondaggiSaveForm = async function() {
    var question = (document.getElementById('sondaggi-f-question').value || '').trim();
    var optionEls = document.querySelectorAll('.sondaggi-f-option');
    var options = Array.prototype.map.call(optionEls, function(el) { return (el.value || '').trim(); })
        .filter(function(v) { return v.length > 0; });
    if (!question) { alert('Inserisci la domanda del sondaggio.'); return; }
    if (options.length < 2) { alert('Servono almeno 2 opzioni non vuote.'); return; }
    var multiple = document.querySelector('input[name="sondaggi-f-multiple"]:checked').value === '1';
    var closesVal = document.getElementById('sondaggi-f-closes').value;
    var closesAt = closesVal ? new Date(closesVal).getTime() : null;
    var showResultsToParents = document.getElementById('sondaggi-f-show-results').checked;
    var showNamesInResults = showResultsToParents && document.getElementById('sondaggi-f-show-names').checked;

    var id = 'srv_' + Date.now();
    var survey = {
        id: id,
        question: question,
        options: options,
        multiple: multiple,
        createdAt: Date.now(),
        closesAt: closesAt,
        status: 'open',
        showResultsToParents: showResultsToParents,
        showNamesInResults: showNamesInResults,
        createdBy: sessionStorage.getItem('gosport_auth_user') || ''
    };
    _sondaggi[id] = survey;
    await window.sondaggiPersist();
    window.sondaggiCancelForm();
    sondaggiRenderList();
};

window.sondaggiPersist = async function() {
    var aid = _sondaggiAnnataId();
    try {
        await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-annata-id': aid },
            body: JSON.stringify({ surveys: _sondaggi })
        });
    } catch (e) { console.warn('[Sondaggi] save err:', e); }
};

window.sondaggiOpenDetail = function(surveyId) {
    document.getElementById('sondaggi-list-container').style.display = 'none';
    document.getElementById('sondaggi-form-container').style.display = 'none';
    var detailC = document.getElementById('sondaggi-detail-container');
    detailC.style.display = '';
    var s = _sondaggi[surveyId];
    if (!s) { detailC.innerHTML = '<p>Sondaggio non trovato.</p>'; return; }
    var responses = _sondaggiResponses[surveyId] || {};
    var open = _sondaggiIsOpen(s);

    // Conteggio per opzione
    var counts = {};
    s.options.forEach(function(o) { counts[o] = 0; });
    var respondedIds = Object.keys(responses);
    respondedIds.forEach(function(aid) {
        (responses[aid].choices || []).forEach(function(c) {
            if (counts.hasOwnProperty(c)) counts[c]++;
        });
    });
    var totalResponses = respondedIds.length;

    var html = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px;">'
        + '<h4 style="margin-top:0;color:var(--text-primary);">' + s.question.replace(/</g,'&lt;') + '</h4>'
        + '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:12px;">'
        + (open ? '🟢 Aperto' : '⚫ Chiuso') + '</div>';

    if (totalResponses === 0) {
        html += '<p style="color:var(--text-muted);">Nessuna risposta ancora.</p>';
    } else {
        s.options.forEach(function(o) {
            var pct = totalResponses > 0 ? Math.round((counts[o] / totalResponses) * 100) : 0;
            html += '<div style="margin-bottom:8px;">'
                + '<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--text-primary);">'
                + '<span>' + o.replace(/</g,'&lt;') + '</span><span>' + counts[o] + ' (' + pct + '%)</span></div>'
                + '<div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden;">'
                + '<div style="background:#3b82f6;height:100%;width:' + pct + '%;"></div></div></div>';
        });
        html += '<h5 style="color:var(--text-primary);margin-top:16px;">Chi ha risposto cosa</h5><ul>';
        _sondaggiAthletes.forEach(function(a) {
            var r = responses[String(a.id)];
            html += '<li style="color:var(--text-muted);font-size:0.85rem;">' + a.name.replace(/</g,'&lt;') + ': '
                + (r ? r.choices.join(', ').replace(/</g,'&lt;') : '<em>non ha risposto</em>') + '</li>';
        });
        html += '</ul>';
    }

    html += '<button type="button" onclick="window.sondaggiCloseDetail()" style="background:transparent;color:var(--text-muted);border:1px solid var(--border);border-radius:6px;padding:8px 16px;cursor:pointer;">← Indietro</button>';
    // Bottone chiusura visibile solo a chi ha permesso di gestione (vedi showSondaggiTab:
    // admin/coach_l1/coach_l2/dirigente_l1 — dirigente_l1 incluso per scelta esplicita utente).
    if (open && window._sondaggiCanEdit) {
        html += '&nbsp;<button type="button" onclick="window.sondaggiCloseSurvey(\'' + surveyId + '\')" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-weight:600;cursor:pointer;">Chiudi sondaggio</button>';
    }
    html += '</div>';
    detailC.innerHTML = html;
};

window.sondaggiCloseDetail = function() {
    document.getElementById('sondaggi-detail-container').style.display = 'none';
    document.getElementById('sondaggi-list-container').style.display = '';
};

window.sondaggiCloseSurvey = async function(surveyId) {
    if (!confirm('Chiudere questo sondaggio? Non sarà più possibile rispondere.')) return;
    if (!_sondaggi[surveyId]) return;
    _sondaggi[surveyId].status = 'closed';
    await window.sondaggiPersist();
    sondaggiRenderList();
    window.sondaggiOpenDetail(surveyId);
};
```

- [ ] **Step 2: Verifica manuale delle parentesi/apici nel blocco appena inserito**

Rileggi il blocco appena scritto contando che ogni `function` aperta abbia la sua `}` di chiusura e che le stringhe concatenate con `+` non abbiano apici non bilanciati (in particolare le `onclick="...\'...\'"` con apici singoli escaped). Nessun tool di lint automatico è disponibile per JS embedded in questo file.

- [ ] **Step 3: Commit**

```bash
git add public/calendario.html
git commit -m "feat(sondaggi): logica staff — lista, creazione, risultati aggregati"
```

---

### Task 6: Sezione genitore — visualizzazione e risposta in `calendario-standalone.js`

**Files:**
- Modify: `public/calendario-standalone.js` — nuova funzione `window._renderParentSurveysSection()` (pattern identico a `_renderParentDocsSection`, righe 2437 e seguenti), da inserire subito dopo `_renderParentDocsSection` (dopo la sua chiusura `};`)
- Modify: `public/calendario-standalone.js:2034-2037` (hook di chiamata, accanto a `_renderParentDocsSection`)

- [ ] **Step 1: Individua la fine di `_renderParentDocsSection`**

Con Grep, trova dove finisce la funzione (cerca il prossimo `};` di primo livello dopo la riga 2437). Inserisci il nuovo blocco subito dopo quella chiusura.

- [ ] **Step 2: Scrivi `_renderParentSurveysSection`**

```js

// Renderizza la sezione sondaggi nella pagina genitore, sotto Bacheca/Documenti.
// Stesso pattern di _renderParentDocsSection: crea il contenitore se non esiste,
// lo inserisce subito dopo l'ultimo blocco genitore già presente nel DOM.
window._renderParentSurveysSection = function(athleteId, annataId, surveys, surveyResponses) {
  var openSurveys = Object.keys(surveys || {}).filter(function(id) {
    var s = surveys[id];
    if (!s || s.status !== 'open') return false;
    if (s.closesAt !== null && s.closesAt !== undefined && Date.now() > s.closesAt) return false;
    return true;
  });

  var container = document.getElementById('parent-surveys-section');
  if (!openSurveys.length) {
    if (container) container.style.display = 'none';
    return;
  }
  if (!container) {
    container = document.createElement('div');
    container.id = 'parent-surveys-section';
    container.style.cssText = 'margin-top:12px;';
    var anchor = document.getElementById('parent-docs-section') || document.getElementById('bacheca-genitori-container');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(container, anchor.nextSibling);
    }
  }
  container.style.display = '';

  var html = '<div style="background:#1a3a5f;border:1px solid #3b5a9d;border-radius:12px;padding:20px;">'
    + '<div style="color:#ffffff;font-size:1rem;font-weight:700;margin-bottom:14px;">📊 Sondaggi</div>';

  openSurveys.forEach(function(surveyId) {
    var s = surveys[surveyId];
    var myResponse = (surveyResponses[surveyId] || {})[String(athleteId)];
    var inputType = s.multiple ? 'checkbox' : 'radio';
    var inputName = 'survey-' + surveyId;

    html += '<div style="border-bottom:1px solid rgba(59,90,157,0.4);padding:12px 0;">'
      + '<div style="color:#e2e8f0;font-weight:600;margin-bottom:8px;">' + s.question.replace(/</g,'&lt;') + '</div>';

    s.options.forEach(function(opt, i) {
      var checked = myResponse && myResponse.choices && myResponse.choices.indexOf(opt) >= 0;
      html += '<label style="display:block;color:#cbd5e1;font-size:0.88rem;margin-bottom:4px;cursor:pointer;">'
        + '<input type="' + inputType + '" name="' + inputName + '" value="' + opt.replace(/"/g,'&quot;') + '" '
        + (checked ? 'checked ' : '') + 'data-survey-id="' + surveyId + '"> ' + opt.replace(/</g,'&lt;')
        + '</label>';
    });

    html += '<button type="button" class="survey-submit-btn" data-survey-id="' + surveyId + '" '
      + 'style="margin-top:6px;background:#16a34a;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:0.82rem;font-weight:600;cursor:pointer;">'
      + (myResponse ? 'Aggiorna risposta' : 'Invia risposta') + '</button>';

    if (s.showResultsToParents) {
      var responses = surveyResponses[surveyId] || {};
      var counts = {};
      s.options.forEach(function(o) { counts[o] = 0; });
      var respondedIds = Object.keys(responses);
      respondedIds.forEach(function(aid) {
        (responses[aid].choices || []).forEach(function(c) { if (counts.hasOwnProperty(c)) counts[c]++; });
      });
      var total = respondedIds.length;
      html += '<div style="margin-top:10px;">';
      s.options.forEach(function(o) {
        var pct = total > 0 ? Math.round((counts[o] / total) * 100) : 0;
        html += '<div style="font-size:0.78rem;color:#94a3b8;">' + o.replace(/</g,'&lt;') + ': ' + counts[o] + ' (' + pct + '%)</div>';
      });
      if (s.showNamesInResults) {
        html += '<div style="font-size:0.72rem;color:#64748b;margin-top:4px;">';
        respondedIds.forEach(function(aid) {
          html += (aid === String(athleteId) ? 'Tu' : aid) + ': ' + responses[aid].choices.join(', ') + '<br>';
        });
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.survey-submit-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var surveyId = this.getAttribute('data-survey-id');
      window._submitSurveyResponse(surveyId, athleteId, annataId);
    });
  });
};

// Invia la risposta al sondaggio: POST con SOLO surveyResponses (nessun'altra
// chiave), stesso schema già usato da markAbsence() per calendarResponses —
// il ramo server-side isCalendarResponsePost permette questa scrittura anche
// senza sessione autenticata.
window._submitSurveyResponse = async function(surveyId, athleteId, annataId) {
  var checked = document.querySelectorAll('input[name="survey-' + surveyId + '"]:checked');
  var choices = Array.prototype.map.call(checked, function(el) { return el.value; });
  if (choices.length === 0) { alert('Seleziona almeno un\'opzione.'); return; }

  try {
    var res = await fetch('/api/data?parentMode=1', {
      cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId }
    });
    var d = res.ok ? (await res.json()) : {};
    var existing = (d && d.surveyResponses) || {};
    if (!existing[surveyId]) existing[surveyId] = {};
    existing[surveyId][String(athleteId)] = { choices: choices };

    var saveRes = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId },
      body: JSON.stringify({ surveyResponses: existing })
    });
    if (!saveRes.ok) {
      var errBody = await saveRes.json().catch(function() { return {}; });
      alert('❌ ' + (errBody.message || 'Sondaggio chiuso, risposta non salvata.'));
      return;
    }
    alert('✅ Risposta inviata.');
    window._renderParentSurveysSection(athleteId, annataId, d.surveys || {}, existing);
  } catch (e) {
    alert('❌ Errore: ' + e.message);
  }
};
```

- [ ] **Step 3: Aggiungi l'hook di chiamata in `loadBachecaGenitori`**

Trova (righe 2034-2037):

```js
    // Mostra sezione documenti nella pagina genitore (sempre visibile)
    if (athleteIdParam) {
      window._renderParentDocsSection(athleteIdParam, annataId, d.athleteDocs || {});
    }
```

Sostituiscilo con:

```js
    // Mostra sezione documenti nella pagina genitore (sempre visibile)
    if (athleteIdParam) {
      window._renderParentDocsSection(athleteIdParam, annataId, d.athleteDocs || {});
      window._renderParentSurveysSection(athleteIdParam, annataId, d.surveys || {}, d.surveyResponses || {});
    }
```

- [ ] **Step 4: Verifica sintassi JS**

```bash
node --check public/calendario-standalone.js
```
Expected: nessun output (nessun errore di sintassi).

- [ ] **Step 5: Commit**

```bash
git add public/calendario-standalone.js
git commit -m "feat(sondaggi): sezione genitore — visualizza sondaggi aperti e invia risposta"
```

---

### Task 7: Collega `showSondaggiTab()` ai due punti di attivazione tab esistenti

**Files:**
- Modify: `public/calendario-standalone.js:619-631` (ramo "nessun evento")
- Modify: `public/calendario-standalone.js:694-710` (ramo normale)

- [ ] **Step 1: Aggiungi la chiamata nel ramo "nessun evento"**

Trova (righe 619-631):

```js
    var _noEvIsParent = new URLSearchParams(window.location.search).get('athleteId');
    if (!_noEvIsParent) {
      if (typeof showBachecaTab === 'function') showBachecaTab();
      var _noEvPlan = sessionStorage.getItem('gosport_license_plan') || 'platinum';
      if ((_noEvPlan === 'platinum' || _noEvPlan === 'demo') && typeof showDocumentiTab === 'function') {
        var _noEvRole = sessionStorage.getItem('gosport_user_role') || '';
        showDocumentiTab(['admin','coach_l1','coach_l2'].indexOf(_noEvRole) >= 0);
      }
      if (typeof showGareTab === 'function') {
        var _noEvGareRole = sessionStorage.getItem('gosport_user_role') || '';
        showGareTab(['admin','coach_l1','coach_l2'].indexOf(_noEvGareRole) >= 0);
      }
    }
    return;
```

Sostituiscilo con:

```js
    var _noEvIsParent = new URLSearchParams(window.location.search).get('athleteId');
    if (!_noEvIsParent) {
      if (typeof showBachecaTab === 'function') showBachecaTab();
      var _noEvPlan = sessionStorage.getItem('gosport_license_plan') || 'platinum';
      if ((_noEvPlan === 'platinum' || _noEvPlan === 'demo') && typeof showDocumentiTab === 'function') {
        var _noEvRole = sessionStorage.getItem('gosport_user_role') || '';
        showDocumentiTab(['admin','coach_l1','coach_l2'].indexOf(_noEvRole) >= 0);
      }
      if (typeof showGareTab === 'function') {
        var _noEvGareRole = sessionStorage.getItem('gosport_user_role') || '';
        showGareTab(['admin','coach_l1','coach_l2'].indexOf(_noEvGareRole) >= 0);
      }
      // Sondaggi: a differenza degli altri tab sopra, include ANCHE dirigente_l1
      // (scelta esplicita utente, vedi spec sezione Permessi).
      if (typeof showSondaggiTab === 'function') {
        var _noEvSondaggiRole = sessionStorage.getItem('gosport_user_role') || '';
        showSondaggiTab(['admin','coach_l1','coach_l2','dirigente_l1'].indexOf(_noEvSondaggiRole) >= 0);
      }
    }
    return;
```

- [ ] **Step 2: Aggiungi la chiamata nel ramo normale**

Trova (righe 694-710):

```js
  } else {
    isParentView = false;
    // Mostra tab Bacheca per coach/admin
    if (typeof showBachecaTab === 'function') showBachecaTab();
    // Documenti Società + Atleti: solo Platinum
    var _calPlan = sessionStorage.getItem('gosport_license_plan') || 'platinum';
    if ((_calPlan === 'platinum' || _calPlan === 'demo') && typeof showDocumentiTab === 'function') {
      var _dRole = sessionStorage.getItem('gosport_user_role') || '';
      showDocumentiTab(['admin','coach_l1','coach_l2'].indexOf(_dRole) >= 0);
    }
    // Mostra tab Gare per coach/admin (con permesso edit in base al ruolo)
    if (typeof showGareTab === 'function') {
      var _gareRole = sessionStorage.getItem('gosport_user_role') || '';
      var _gareEdit = ['admin','coach_l1','coach_l2'].indexOf(_gareRole) >= 0;
      showGareTab(_gareEdit);
    }
  }
```

Sostituiscilo con:

```js
  } else {
    isParentView = false;
    // Mostra tab Bacheca per coach/admin
    if (typeof showBachecaTab === 'function') showBachecaTab();
    // Documenti Società + Atleti: solo Platinum
    var _calPlan = sessionStorage.getItem('gosport_license_plan') || 'platinum';
    if ((_calPlan === 'platinum' || _calPlan === 'demo') && typeof showDocumentiTab === 'function') {
      var _dRole = sessionStorage.getItem('gosport_user_role') || '';
      showDocumentiTab(['admin','coach_l1','coach_l2'].indexOf(_dRole) >= 0);
    }
    // Mostra tab Gare per coach/admin (con permesso edit in base al ruolo)
    if (typeof showGareTab === 'function') {
      var _gareRole = sessionStorage.getItem('gosport_user_role') || '';
      var _gareEdit = ['admin','coach_l1','coach_l2'].indexOf(_gareRole) >= 0;
      showGareTab(_gareEdit);
    }
    // Mostra tab Sondaggi per coach/admin/dirigente_l1 — a differenza degli
    // altri tab sopra, include ANCHE dirigente_l1 (scelta esplicita utente,
    // vedi spec sezione Permessi).
    if (typeof showSondaggiTab === 'function') {
      var _sondaggiRole = sessionStorage.getItem('gosport_user_role') || '';
      showSondaggiTab(['admin','coach_l1','coach_l2','dirigente_l1'].indexOf(_sondaggiRole) >= 0);
    }
  }
```

- [ ] **Step 3: Verifica sintassi**

```bash
node --check public/calendario-standalone.js
```
Expected: nessun output.

- [ ] **Step 4: Commit**

```bash
git add public/calendario-standalone.js
git commit -m "feat(sondaggi): mostra tab Sondaggi in Org. per staff (entrambi i rami evento/nessun-evento)"
```

---

### Task 8: Aggiornamento knowledge graph e verifica manuale finale

**Files:** nessuna modifica di codice — solo verifica e manutenzione del grafo.

- [ ] **Step 1: Aggiorna il grafo graphify**

```bash
cd "d:/EDY/Go Calcio/Valutazione Atleti/Vercel/App-Allenatori_VR3/AppAllenamentoR1" && graphify update .
```
Expected: aggiornamento AST-only completato senza errori (nessun costo API).

- [ ] **Step 2: Verifica sintattica finale di tutti i file toccati**

```bash
node --check api/data.js && node --check public/calendario-standalone.js && echo "OK: sintassi valida"
```
Expected: `OK: sintassi valida`.

- [ ] **Step 3: Checklist di tracciamento manuale (nessun ambiente di test automatizzato disponibile per questo progetto)**

Traccia a mano, leggendo il codice scritto nei Task 1-7, questi scenari end-to-end:
1. Staff crea sondaggio "Sabato o Domenica?" con 2 opzioni, scelta singola, senza scadenza, risultati visibili senza nomi → verifica che `sondaggiSaveForm` produca un oggetto `Survey` con tutti i campi richiesti e che `sondaggiPersist` invii `{surveys: {...}}` con `Content-Type: application/json` e header `x-annata-id`.
2. Genitore apre `?athleteId=X`, vede la sezione Sondaggi con il sondaggio sopra, seleziona "Sabato", clicca Invia → verifica che `_submitSurveyResponse` mandi un body con **solo** `surveyResponses` (chiave singola), che passa il guard `isCalendarResponsePost` esteso al Task 1.
3. Staff apre il dettaglio del sondaggio → verifica che `sondaggiOpenDetail` mostri percentuali corrette e la lista nominativa, indipendentemente dai toggle (la vista staff è sempre completa, come da spec).
4. Genitore prova a rispondere a un sondaggio con `status:"closed"` (es. dopo chiusura manuale mentre aveva la pagina aperta) → verifica che il server (Task 3) risponda 400 e che il client mostri l'alert di errore, non un falso successo.

- [ ] **Step 4: Commit finale (se necessario, es. se il grafo produce file da versionare)**

```bash
git status
```
Se `graphify-out/` risulta modificato e il progetto lo versiona già (verificare con `git log --oneline -- graphify-out/` se ci sono commit precedenti su quella cartella), committa:
```bash
git add graphify-out/
git commit -m "chore: aggiorna knowledge graph dopo feature sondaggi"
```
Se `graphify-out/` non è mai stato versionato prima, non aggiungerlo (probabilmente è in `.gitignore` — verificare con `git check-ignore graphify-out/GRAPH_REPORT.md`).

---

## Note finali

- **Nessun deploy incluso in questo piano**: il vincolo di progetto richiede accordo esplicito dell'utente per ogni `git push`/deploy Vercel. Tutti i commit sopra sono locali; il push va fatto solo dopo che l'utente lo conferma esplicitamente in un turno successivo.
- **Eliminazione sondaggi**: esplicitamente fuori scope per questo piano (vedi spec, sezione "Fuori scope").
- **Notifiche push per nuovo sondaggio**: fuori scope, non incluso in nessun task.
