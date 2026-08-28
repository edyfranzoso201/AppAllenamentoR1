# Cronografo Circuiti — Reset e Modalità Gruppo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un pulsante Reset al cronometro e una Modalità Gruppo che permette di cronometrare più atleti insieme, registrando un lap/parziale per ogni atleta ad ogni giro completato.

**Architecture:** Tutto il lavoro è in `public/cronografo.html` (nessun file nuovo, nessuna modifica server — vincolo Vercel Hobby 12 funzioni). Si aggiunge un pulsante Reset ai controlli esistenti, un toggle Individuale/Gruppo che scambia il pannello sotto il cronometro, e una mappa `groupLastMark` per calcolare i parziali per-atleta in modalità Gruppo. Il salvataggio (`saveSession`) viene esteso per collegare il **minimo** tra i giri di uno stesso atleta a `gpsData`, mantenendo tutte le entry granulari in `circuitTimes`.

**Tech Stack:** HTML/CSS/JS vanilla (nessun framework), Chart.js già incluso via CDN (non toccato in questo piano). Nessuna suite di test automatica nel progetto: la verifica è manuale via `node --check` per la sintassi e checklist funzionale nel browser (istruzioni esplicite in ogni task).

---

## Contesto per l'implementatore

Il file `public/cronografo.html` (999 righe) contiene tutto: HTML, CSS, e uno script inline. Elementi chiave già presenti che i task successivi useranno/estenderanno:

- **Stato globale**: `let running = false;`, `let lastElapsed = 0;`, `let lapMarks = [];`, `let sessionList = [];`, `let ATHLETES = [];` (array di `{id, name, ...}`).
- **Controlli cronometro** (righe 242-246 circa):
  ```html
  <div class="cr-btns">
    <button class="cr-btn cr-btn-start" id="cr-btn-start">▶ Start</button>
    <button class="cr-btn cr-btn-lap" id="cr-btn-lap" disabled>🏁 Lap</button>
    <button class="cr-btn cr-btn-stop" id="cr-btn-stop" disabled>⏹ Stop</button>
  </div>
  ```
- **Blocco assegnazione individuale** (righe 250-256):
  ```html
  <div class="cr-assign">
    <div style="flex:1;">
      <label for="cr-atleta">Assegna a</label>
      <select id="cr-atleta" disabled></select>
    </div>
    <button id="cr-btn-assign" disabled>+ Aggiungi alla lista</button>
  </div>
  ```
- **Funzioni cronometro esistenti**: `startTimer()`, `lapTimer()`, `stopTimer()`, `resetTimerKeepCircuit()`, `fmtTime(totalSec)`, `updateDisplay()`.
- **`sessionList`** è già un array di entry `{ athleteId, athleteName, circuito, tempoTotale, laps }` — la card "Sessione corrente" (`renderSessionList()`) già itera con `.map` senza deduplicare per atleta, quindi supporta più righe per lo stesso atleta **senza modifiche**.
- **`saveSession()`** (righe 922-994) fa già: rilettura fresca via `loadData()`, merge additivo in `circuitTimes[athleteId]`, collegamento a `gpsData[athleteId][today][0].tempo_circuito_totale_s`, POST a `/api/data`.
- **Stile toggle esistente da riusare** (per il nuovo toggle Individuale/Gruppo, righe 194-215):
  ```css
  .cr-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
  .cr-tab {
    flex: 1; text-align: center; padding: 10px; border-radius: 8px;
    border: 1px solid var(--border); background: #0a1622; color: var(--text-dim);
    cursor: pointer; font-size: 0.85rem;
  }
  .cr-tab.active {
    background: var(--accent); color: #04140b; border-color: var(--accent); font-weight: 600;
  }
  ```

**Verifica sintassi (ripetere dopo ogni task che tocca lo script inline):**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('public/cronografo.html', 'utf8');
const start = html.indexOf('<script>', html.indexOf('chart.umd.min.js')) + '<script>'.length;
const end = html.indexOf('</script>', start);
fs.writeFileSync('/tmp/cr_check.js', html.slice(start, end));
"
node --check /tmp/cr_check.js && echo "SINTASSI OK"
```

Nota: su Windows/Git Bash, se `/tmp/cr_check.js` non è risolvibile da `node --check` (visto in sessioni precedenti), usare il path assoluto dello scratchpad di sessione al posto di `/tmp/cr_check.js` in entrambe le righe sopra.

---

### Task 1: Pulsante Reset

**Files:**
- Modify: `public/cronografo.html:242-246` (HTML controlli), `public/cronografo.html` (CSS `.cr-btn-*`), `public/cronografo.html:780-831` (funzioni cronometro)

- [ ] **Step 1: Aggiungi lo stile del pulsante Reset**

Nel blocco `<style>`, subito dopo la riga `.cr-btn-stop { background: var(--danger); color: #fff; }` (riga 113), aggiungi:

```css
  .cr-btn-reset { background: #1e3a52; color: var(--text-dim); }
```

- [ ] **Step 2: Aggiungi il bottone Reset nell'HTML**

Sostituisci il blocco `.cr-btns` (righe 242-246):

```html
    <div class="cr-btns">
      <button class="cr-btn cr-btn-start" id="cr-btn-start">▶ Start</button>
      <button class="cr-btn cr-btn-lap" id="cr-btn-lap" disabled>🏁 Lap</button>
      <button class="cr-btn cr-btn-stop" id="cr-btn-stop" disabled>⏹ Stop</button>
    </div>
```

con:

```html
    <div class="cr-btns">
      <button class="cr-btn cr-btn-start" id="cr-btn-start">▶ Start</button>
      <button class="cr-btn cr-btn-lap" id="cr-btn-lap" disabled>🏁 Lap</button>
      <button class="cr-btn cr-btn-stop" id="cr-btn-stop" disabled>⏹ Stop</button>
      <button class="cr-btn cr-btn-reset" id="cr-btn-reset" disabled>↺ Reset</button>
    </div>
```

- [ ] **Step 3: Implementa la funzione `resetTimer()` e collega gli stati disabled**

Il Reset deve essere abilitato quando il cronometro è in corsa OPPURE è fermo con un tempo diverso da zero (non allo stato "pronto" 00:00.00 mai avviato). Aggiungi questa funzione subito dopo `resetTimerKeepCircuit()` (dopo la riga 831, prima di `document.getElementById('cr-btn-start').addEventListener(...)`):

```javascript
function updateResetButtonState() {
  const resetBtn = document.getElementById('cr-btn-reset');
  resetBtn.disabled = !running && lastElapsed === 0;
}

function resetTimer() {
  if (!running && lastElapsed === 0) return; // stato "pronto", nulla da azzerare
  if (running) {
    running = false;
    clearInterval(timerInterval);
  }
  lastElapsed = 0;
  lapMarks = [];
  groupLastMark = {};
  document.getElementById('cr-display').textContent = '00:00.00';
  document.getElementById('cr-laps').innerHTML = '';
  document.getElementById('cr-circuito').disabled = false;
  document.getElementById('cr-atleta').value = '';
  document.getElementById('cr-atleta').disabled = true;
  document.getElementById('cr-btn-assign').disabled = true;
  document.getElementById('cr-btn-start').disabled = false;
  document.getElementById('cr-btn-lap').disabled = true;
  document.getElementById('cr-btn-stop').disabled = true;
  updateResetButtonState();
  if (crMode === 'gruppo') renderGroupAthleteList();
  toast('Cronometro azzerato');
}
```

Nota: `groupLastMark` e `crMode` e `renderGroupAthleteList` sono definiti nei Task 3-4 — questo task compila comunque perché JavaScript non richiede che le variabili/funzioni referenziate esistano finché la riga non viene davvero eseguita (nessuna chiamata a `resetTimer()` avviene in questo task). Se preferisci non lasciare riferimenti forward, sposta l'`if (crMode === 'gruppo')` sopra dentro il Task 4 — ma per semplicità di piano lo teniamo qui.

- [ ] **Step 4: Aggiorna `startTimer()` e `stopTimer()` per tenere aggiornato lo stato del bottone Reset**

In `startTimer()` (dopo la riga `document.getElementById('cr-circuito').disabled = true;`, riga 794), aggiungi:

```javascript
  updateResetButtonState();
```

In `stopTimer()` (dopo la riga `document.getElementById('cr-btn-assign').disabled = false;`, riga 819), aggiungi:

```javascript
  updateResetButtonState();
```

- [ ] **Step 5: Collega il listener del bottone**

Dopo la riga `document.getElementById('cr-btn-stop').addEventListener('click', stopTimer);` (riga 835), aggiungi:

```javascript
document.getElementById('cr-btn-reset').addEventListener('click', resetTimer);
```

- [ ] **Step 6: Verifica sintassi**

Esegui il comando di verifica sintassi indicato nella sezione "Contesto per l'implementatore". Atteso: `SINTASSI OK`.

- [ ] **Step 7: Verifica funzionale manuale**

Apri `public/cronografo.html` in un browser locale (o tramite il deploy di staging se disponibile). Passi:
1. Digita un nome circuito, premi Start. Verifica che "↺ Reset" diventi cliccabile.
2. Premi "↺ Reset". Verifica: cronometro torna a `00:00.00`, campo circuito riabilitato, bottoni Lap/Stop disabilitati, Start abilitato, Reset torna disabilitato.
3. Premi Start di nuovo, poi Stop (senza assegnare). Verifica che Reset sia ancora abilitato (tempo fermo ma diverso da zero). Premi Reset e verifica lo stesso comportamento del punto 2.

Expected: tutti i passaggi sopra si comportano come descritto, nessun errore in console.

- [ ] **Step 8: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): aggiunge pulsante Reset al cronometro

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Toggle Individuale/Gruppo — struttura HTML e stato

**Files:**
- Modify: `public/cronografo.html` (CSS, HTML pannello cronometro, script — stato globale)

- [ ] **Step 1: Aggiungi CSS per il pannello atleti gruppo**

Nel blocco `<style>`, dopo la regola `.cr-empty { ... }` (righe 218-223), aggiungi:

```css
  .cr-group-search {
    margin-bottom: 10px;
  }
  .cr-group-list {
    max-height: 280px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .cr-group-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    font-size: 0.9rem;
  }
  .cr-group-row:last-child { border-bottom: none; }
  .cr-group-row.has-laps { background: rgba(74, 222, 128, 0.08); }
  .cr-group-row.disabled-row {
    pointer-events: none;
    opacity: 0.5;
    cursor: default;
  }
  .cr-group-row .cr-group-name { font-weight: 600; }
  .cr-group-row .cr-group-meta { color: var(--text-dim); font-size: 0.8rem; }
```

- [ ] **Step 2: Sostituisci il blocco cronometro con la versione con toggle**

Sostituisci l'intero blocco (righe 234-257, dalla `<h2>Cronometro</h2>` fino alla chiusura del `.cr-card` del cronometro):

```html
  <div class="cr-card">
    <h2>Cronometro</h2>
    <div class="cr-tabs">
      <div class="cr-tab active" id="cr-mode-individuale" data-mode="individuale">Individuale</div>
      <div class="cr-tab" id="cr-mode-gruppo" data-mode="gruppo">Gruppo</div>
    </div>
    <label for="cr-circuito">Nome circuito</label>
    <input type="text" id="cr-circuito" list="cr-circuiti-list" placeholder="Es. Slalom 20m">
    <datalist id="cr-circuiti-list"></datalist>

    <div class="cr-display" id="cr-display">00:00.00</div>

    <div class="cr-btns">
      <button class="cr-btn cr-btn-start" id="cr-btn-start">▶ Start</button>
      <button class="cr-btn cr-btn-lap" id="cr-btn-lap" disabled>🏁 Lap</button>
      <button class="cr-btn cr-btn-stop" id="cr-btn-stop" disabled>⏹ Stop</button>
      <button class="cr-btn cr-btn-reset" id="cr-btn-reset" disabled>↺ Reset</button>
    </div>

    <div class="cr-laps" id="cr-laps"></div>

    <div id="cr-panel-individuale">
      <div class="cr-assign">
        <div style="flex:1;">
          <label for="cr-atleta">Assegna a</label>
          <select id="cr-atleta" disabled></select>
        </div>
        <button id="cr-btn-assign" disabled>+ Aggiungi alla lista</button>
      </div>
    </div>

    <div id="cr-panel-gruppo" style="display:none;">
      <input type="text" id="cr-group-search" class="cr-group-search" placeholder="Cerca atleta…">
      <div class="cr-group-list" id="cr-group-list"></div>
    </div>
  </div>
```

- [ ] **Step 3: Aggiungi lo stato globale per la modalità**

Vicino alla dichiarazione `let atletaChart = null;` (riga 349), aggiungi:

```javascript
let crMode = 'individuale'; // 'individuale' | 'gruppo'
let groupLastMark = {}; // athleteId -> ultimo tempo assoluto (s) registrato in modalità Gruppo
```

- [ ] **Step 4: Verifica sintassi**

Esegui il comando di verifica sintassi indicato nella sezione "Contesto per l'implementatore". Atteso: `SINTASSI OK`.

- [ ] **Step 5: Verifica funzionale manuale**

Apri la pagina nel browser. Verifica: il toggle "Individuale / Gruppo" è visibile sopra il campo circuito, "Individuale" è evidenziato di default, il pannello sotto i lap mostra ancora "Assegna a" + select (comportamento Task 3 lo renderà funzionante per il cambio tab — per ora il click sul tab "Gruppo" non fa ancora nulla, atteso in questo task).

- [ ] **Step 6: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): aggiunge struttura HTML per toggle Individuale/Gruppo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Logica di cambio modalità (toggle funzionante)

**Files:**
- Modify: `public/cronografo.html` (script — nuove funzioni, `init()`)

- [ ] **Step 1: Implementa `setupModeToggle()`**

Aggiungi questa funzione subito dopo `setupTabListeners()` (dopo la riga 422, prima del commento `// ── Storico: vista Per atleta ──`):

```javascript
// ── Toggle Individuale / Gruppo ──────────────────────────────────────────
function setupModeToggle() {
  document.getElementById('cr-mode-individuale').addEventListener('click', () => {
    if (running) { toast('Ferma il cronometro prima di cambiare modalità'); return; }
    setCrMode('individuale');
  });
  document.getElementById('cr-mode-gruppo').addEventListener('click', () => {
    if (running) { toast('Ferma il cronometro prima di cambiare modalità'); return; }
    setCrMode('gruppo');
  });
}

function setCrMode(mode) {
  crMode = mode;
  document.getElementById('cr-mode-individuale').classList.toggle('active', mode === 'individuale');
  document.getElementById('cr-mode-gruppo').classList.toggle('active', mode === 'gruppo');
  document.getElementById('cr-panel-individuale').style.display = mode === 'individuale' ? '' : 'none';
  document.getElementById('cr-panel-gruppo').style.display = mode === 'gruppo' ? '' : 'none';
  if (mode === 'gruppo') {
    groupLastMark = {};
    renderGroupAthleteList();
  }
}
```

- [ ] **Step 2: Chiama `setupModeToggle()` in `init()`**

In `init()` (righe 357-371), dopo la riga `setupTabListeners();`, aggiungi:

```javascript
  setupModeToggle();
```

- [ ] **Step 3: Aggiungi uno stub temporaneo per `renderGroupAthleteList()`**

Questa funzione sarà completata nel Task 4. Per non rompere `setCrMode` in questo task, aggiungi uno stub subito dopo `setCrMode`:

```javascript
function renderGroupAthleteList() {
  // Implementata nel Task 4 (pannello atleti con filtro e conteggio giri)
}
```

- [ ] **Step 4: Verifica sintassi**

Esegui il comando di verifica sintassi indicato nella sezione "Contesto per l'implementatore". Atteso: `SINTASSI OK`.

- [ ] **Step 5: Verifica funzionale manuale**

Apri la pagina. Verifica:
1. Click su "Gruppo": il tab diventa evidenziato, il pannello "Assegna a" sparisce, appare il pannello con campo "Cerca atleta…" (vuoto, atteso — la lista è uno stub).
2. Click su "Individuale": torna il pannello "Assegna a".
3. Premi Start, poi prova a cliccare "Gruppo" mentre il cronometro è in corsa: verifica il toast "Ferma il cronometro prima di cambiare modalità" e che il tab NON cambi.

- [ ] **Step 6: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): implementa il cambio di modalità Individuale/Gruppo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Pannello atleti Gruppo — lista, filtro, conteggio giri

**Files:**
- Modify: `public/cronografo.html` (script — sostituisce lo stub `renderGroupAthleteList()`, aggiunge filtro)

- [ ] **Step 1: Sostituisci lo stub `renderGroupAthleteList()` con l'implementazione completa**

Sostituisci lo stub creato nel Task 3:

```javascript
function renderGroupAthleteList() {
  // Implementata nel Task 4 (pannello atleti con filtro e conteggio giri)
}
```

con:

```javascript
function groupLapCountFor(athleteId) {
  // Conta solo le entry di QUESTA sessione (sessionList), non lo storico già salvato:
  // il contatore deve riflettere i giri segnati "adesso", per dare feedback immediato.
  return sessionList.filter(e => String(e.athleteId) === String(athleteId)).length;
}

function groupLastTimeFor(athleteId) {
  const entries = sessionList.filter(e => String(e.athleteId) === String(athleteId));
  if (!entries.length) return null;
  return entries[entries.length - 1].tempoTotale;
}

function renderGroupAthleteList() {
  const list = document.getElementById('cr-group-list');
  const filterText = (document.getElementById('cr-group-search').value || '').trim().toLowerCase();
  const filtered = ATHLETES
    .filter(a => a.name.toLowerCase().includes(filterText))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));

  if (!filtered.length) {
    list.innerHTML = '<div class="cr-empty">Nessun atleta trovato</div>';
    return;
  }

  list.innerHTML = filtered.map(a => {
    const count = groupLapCountFor(a.id);
    const lastTime = groupLastTimeFor(a.id);
    const meta = count > 0 ? `${count} gir${count === 1 ? 'o' : 'i'} · ultimo ${fmtTime(lastTime)}` : 'nessun giro';
    const rowClasses = ['cr-group-row'];
    if (count > 0) rowClasses.push('has-laps');
    if (!running) rowClasses.push('disabled-row');
    return `
      <div class="${rowClasses.join(' ')}" data-athlete-id="${esc(a.id)}">
        <span class="cr-group-name">${esc(a.name)}</span>
        <span class="cr-group-meta">${esc(meta)}</span>
      </div>
    `;
  }).join('');
}
```

- [ ] **Step 2: Collega il filtro di ricerca**

Nella funzione `setupModeToggle()` (Task 3), aggiungi alla fine (prima della chiusura `}`):

```javascript
  document.getElementById('cr-group-search').addEventListener('input', renderGroupAthleteList);
```

- [ ] **Step 3: Verifica sintassi**

Esegui il comando di verifica sintassi indicato nella sezione "Contesto per l'implementatore". Atteso: `SINTASSI OK`.

- [ ] **Step 4: Verifica funzionale manuale**

Apri la pagina, passa in modalità Gruppo. Verifica:
1. La lista mostra tutti gli atleti dell'annata in ordine alfabetico, ciascuno con "nessun giro" e opacità ridotta (cronometro fermo → righe non cliccabili visivamente).
2. Digitando nel campo "Cerca atleta…" la lista si filtra live (case-insensitive, substring).
3. Digitando un testo che non corrisponde a nessun atleta, appare "Nessun atleta trovato".

- [ ] **Step 5: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): pannello atleti Gruppo con filtro e conteggio giri

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Registrazione di un passaggio (tocco su atleta) in modalità Gruppo

**Files:**
- Modify: `public/cronografo.html` (script — listener click sulla lista, `startTimer()`/`stopTimer()`)

- [ ] **Step 1: Aggiungi il listener di click sulla lista atleti**

Dopo il blocco del listener `document.getElementById('cr-btn-assign').addEventListener('click', () => { ... });` (dopo la riga 857, prima del commento `// ── Lista sessione ──`), aggiungi:

```javascript
document.getElementById('cr-group-list').addEventListener('click', (ev) => {
  const row = ev.target.closest('.cr-group-row');
  if (!row || !running) return;
  const athleteId = row.dataset.athleteId;
  const athlete = ATHLETES.find(a => String(a.id) === String(athleteId));
  if (!athlete) return;

  const circuito = document.getElementById('cr-circuito').value.trim();
  const elapsed = (Date.now() - timerStart) / 1000;
  const prevMark = Object.prototype.hasOwnProperty.call(groupLastMark, athleteId) ? groupLastMark[athleteId] : 0;
  const tempoGiro = Math.round((elapsed - prevMark) * 100) / 100;
  groupLastMark[athleteId] = elapsed;

  sessionList.push({
    athleteId: athlete.id,
    athleteName: athlete.name,
    circuito,
    tempoTotale: tempoGiro,
    laps: []
  });
  renderSessionList();
  renderGroupAthleteList();
});
```

- [ ] **Step 2: Aggiorna `startTimer()` per abilitare visivamente la lista gruppo**

In `startTimer()`, dopo la riga `updateResetButtonState();` aggiunta nel Task 1, aggiungi:

```javascript
  if (crMode === 'gruppo') renderGroupAthleteList();
```

(Questo rimuove la classe `disabled-row` dalle righe, dato che `renderGroupAthleteList()` calcola `disabled-row` in base a `running`.)

- [ ] **Step 3: Aggiorna `stopTimer()` — riabilita il campo circuito in modalità Gruppo e aggiorna la lista**

Sostituisci il corpo di `stopTimer()`:

```javascript
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
  updateResetButtonState();
  if (crMode === 'gruppo') {
    // In modalità Gruppo non c'è un passo di assegnazione successivo: il campo
    // circuito va riabilitato subito per permettere la sessione successiva
    // (in modalità Individuale resta disabilitato fino all'assegnazione, invariato).
    document.getElementById('cr-circuito').disabled = false;
    renderGroupAthleteList();
  }
}
```

- [ ] **Step 4: Verifica sintassi**

Esegui il comando di verifica sintassi indicato nella sezione "Contesto per l'implementatore". Atteso: `SINTASSI OK`.

- [ ] **Step 5: Verifica funzionale manuale**

Apri la pagina, passa in modalità Gruppo, digita un nome circuito, premi Start. Verifica:
1. Le righe atleti diventano cliccabili (niente più opacità ridotta).
2. Clicca due atleti diversi: ognuno compare nella card "Sessione corrente" con un tempo piccolo (pochi secondi), e la lista atleti mostra "1 giro · ultimo Xs" con sfondo verde tenue per entrambi.
3. Clicca di nuovo lo stesso atleta dopo qualche secondo: verifica che compaia una SECONDA riga in "Sessione corrente" per lo stesso atleta, con un tempo pari alla differenza dal tocco precedente (non il tempo assoluto dal via). La lista atleti mostra ora "2 giri · ultimo Xs".
4. Premi Stop. Verifica: il campo circuito si riabilita subito (diversamente da modalità Individuale), le righe atleti tornano non cliccabili (opacità ridotta) ma il conteggio giri resta visibile.

- [ ] **Step 6: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): registra un lap per atleta al tocco in modalità Gruppo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Reset azzera anche lo stato Gruppo

**Files:**
- Modify: `public/cronografo.html:` funzione `resetTimer()` (Task 1)

- [ ] **Step 1: Verifica che `resetTimer()` azzeri `groupLastMark` e aggiorni la lista**

Questo è già previsto nel codice del Task 1 (`groupLastMark = {};` e `if (crMode === 'gruppo') renderGroupAthleteList();`). Questo task esiste per **verificarlo esplicitamente in combinazione con la modalità Gruppo**, dato che al momento del Task 1 la modalità Gruppo non esisteva ancora. Rileggi la funzione `resetTimer()` nel file e conferma che contenga entrambe le righe:

```javascript
  groupLastMark = {};
  ...
  if (crMode === 'gruppo') renderGroupAthleteList();
```

Se una delle due righe manca (es. persa in un merge/refactor tra i task precedenti), aggiungila ora nel punto corrispondente della funzione `resetTimer()`.

- [ ] **Step 2: Verifica sintassi**

Esegui il comando di verifica sintassi indicato nella sezione "Contesto per l'implementatore". Atteso: `SINTASSI OK`.

- [ ] **Step 3: Verifica funzionale manuale**

In modalità Gruppo: Start, tocca un atleta (1 giro), premi Reset. Verifica:
1. Il cronometro torna a `00:00.00`.
2. Riavvia con Start e tocca lo stesso atleta: il tempo registrato deve essere calcolato dal nuovo via (piccolo, pochi secondi) e NON dalla differenza col giro registrato prima del reset — cioè `groupLastMark` per quell'atleta è stato azzerato.
3. La card "Sessione corrente" mantiene comunque la riga del giro registrato PRIMA del reset (il Reset non tocca `sessionList`, come da spec).

- [ ] **Step 4: Commit**

Se non sono state necessarie modifiche al Step 1 (il codice era già corretto), non serve alcun commit — annota nel report finale "Task 6: nessuna modifica necessaria, verificato che `resetTimer()` già gestiva correttamente lo stato Gruppo". Se invece è stata necessaria una correzione:

```bash
git add public/cronografo.html
git commit -m "fix(cronografo): assicura che Reset azzeri lo stato Gruppo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Salvataggio — collega il miglior giro (minimo) a gpsData

**Files:**
- Modify: `public/cronografo.html:922-994` (funzione `saveSession()`)

- [ ] **Step 1: Sostituisci la sezione 3 di `saveSession()` (collegamento a gpsData)**

Nella funzione `saveSession()`, sostituisci questo blocco (il commento "3. Collegamento con Dati Performance" e il suo `sessionList.forEach`):

```javascript
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
```

con:

```javascript
    // 3. Collegamento con Dati Performance (gpsData): aggiorna/crea la sessione odierna,
    //    sempre indice [0] dell'array, mai indovinare quale sessione tra più di una.
    //    Quando un atleta ha più entry nella stessa sessione (modalità Gruppo, un
    //    giro per tocco), si collega il MIGLIOR giro (tempo minimo) a gpsData —
    //    lo storico in circuitTimes resta comunque granulare, un'entry per giro.
    const bestTimeByAthlete = {};
    sessionList.forEach(entry => {
      const athleteId = String(entry.athleteId);
      if (!(athleteId in bestTimeByAthlete) || entry.tempoTotale < bestTimeByAthlete[athleteId]) {
        bestTimeByAthlete[athleteId] = entry.tempoTotale;
      }
    });
    Object.keys(bestTimeByAthlete).forEach(athleteId => {
      const bestTime = bestTimeByAthlete[athleteId];
      if (!freshGpsData[athleteId]) freshGpsData[athleteId] = {};
      if (!freshGpsData[athleteId][today] || !Array.isArray(freshGpsData[athleteId][today]) || !freshGpsData[athleteId][today].length) {
        freshGpsData[athleteId][today] = [{
          tempo_circuito_totale_s: bestTime,
          distanza_circuito: null,
          velocita_circuito: null,
          fonte: 'cronografo'
        }];
      } else {
        const session0 = freshGpsData[athleteId][today][0];
        session0.tempo_circuito_totale_s = bestTime;
        if (session0.distanza_circuito) {
          session0.velocita_circuito = parseFloat(((session0.distanza_circuito / bestTime) * 3.6).toFixed(2));
        }
      }
    });
```

- [ ] **Step 2: Verifica sintassi**

Esegui il comando di verifica sintassi indicato nella sezione "Contesto per l'implementatore". Atteso: `SINTASSI OK`.

- [ ] **Step 3: Verifica funzionale manuale**

In modalità Gruppo: Start, tocca lo stesso atleta 3 volte con tempi diversi (es. 8.5s, 7.2s, 9.1s di parziale), poi Stop, poi "💾 Salva tutti i tempi". Dopo il salvataggio:
1. Vai al tab "Per atleta" nello Storico, seleziona l'atleta e il circuito: verifica che compaiano **3 entry separate** nella tabella/grafico (una per ogni giro salvato), non una sola.
2. Verifica (tramite l'endpoint `/api/data` o l'app Area Tecnica → Dati Performance, se disponibile) che `gpsData[athleteId][oggi][0].tempo_circuito_totale_s` sia il valore **minimo** dei tre (7.2s nell'esempio), non l'ultimo né il primo.

- [ ] **Step 4: Commit**

```bash
git add public/cronografo.html
git commit -m "feat(cronografo): collega il miglior giro a gpsData quando un atleta ha più tempi in sessione

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Aggiornamento grafo graphify

**Files:**
- Nessuna modifica di codice; solo comando da eseguire.

- [ ] **Step 1: Aggiorna il grafo (AST-only, nessun costo API)**

```bash
graphify . --update --code-only
```

Expected: il comando processa solo i file di codice modificati (`public/cronografo.html`), nessun errore di chiave LLM mancante (i file doc/immagine non-code vengono saltati con `--code-only`).

- [ ] **Step 2: Rigenera i report di community**

```bash
graphify . --cluster-only
```

Expected: rigenera `graphify-out/GRAPH_REPORT.md`, `graph.html`, `graph.json` con le community aggiornate.

- [ ] **Step 3: Nessun commit necessario**

`graphify-out/` è in `.gitignore` (righe 3-4: `.graphify_python`, `graphify-out/`) — verificalo con:

```bash
git status --short | grep graphify
```

Expected: nessun output (la cartella non è tracciata, nulla da committare).

---

## Self-Review (svolta durante la scrittura del piano)

**1. Copertura spec:**
- Reset del cronometro → Task 1, 6.
- Toggle Individuale/Gruppo (struttura + logica) → Task 2, 3.
- Pannello atleti con filtro, conteggio giri, evidenziazione → Task 4.
- Registrazione parziale per atleta al tocco, righe multiple per stesso atleta → Task 5.
- Stop che riabilita il campo circuito in modalità Gruppo → Task 5, Step 3.
- Salvataggio: entry granulari in `circuitTimes` (nessuna modifica necessaria, già supportato) + collegamento del miglior giro a `gpsData` → Task 7.
- Vincolo "nessun nuovo file in api/" → rispettato, nessuna modifica server in tutto il piano.
- Aggiornamento graphify dopo modifica codice → Task 8.
- Edge case "nessun atleta trovato nella ricerca" → Task 4, gestito con `.cr-empty`.
- Edge case "cambio modalità mentre in corsa" → Task 3, bloccato con toast.
- Edge case "reset a cronometro mai avviato" → Task 1, `resetTimer()` fa un no-op silenzioso (return anticipato).

**2. Scansione placeholder:** nessun "TBD"/"implement later" nel piano; ogni step ha codice completo o comando esatto con output atteso.

**3. Coerenza dei tipi/nomi:** verificato che `crMode`, `groupLastMark`, `renderGroupAthleteList()`, `setCrMode()`, `resetTimer()`, `updateResetButtonState()`, `groupLapCountFor()`, `groupLastTimeFor()` siano usati con lo stesso nome/firma in tutti i task che li referenziano (Task 1 dichiara `groupLastMark`/`crMode` come riferimenti in avanti già chiariti nella nota del Task 1 Step 3; Task 2 li dichiara davvero; Task 3 li usa; Task 4 li legge; Task 5 li aggiorna; Task 6 li verifica).
