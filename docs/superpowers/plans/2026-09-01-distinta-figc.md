# Distinta F.I.G.C. in Convocazioni — Piano di Implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere in Convocazioni un pulsante "📋 Distinta" che apre un pannello di editing dedicato (giocatori, capitano/riserve, staff con 7 ruoli di firma, dati intestazione gara) e produce una stampa A4 fedele al modulo ufficiale F.I.G.C., riusando il meccanismo di stampa browser già esistente.

**Architecture:** Tutto client-side in `public/index.html` (+ un piccolo intervento in `public/script.js` per il nuovo campo staff). Nessun nuovo endpoint, nessun nuovo file `.js` in `api/`. `conv.distinta` è un campo opzionale annidato in ogni oggetto `conv` di `_convData`, salvato/letto con lo stesso `_convSaveData()`/payload `{convocazioni:[...]}` già esistente. La stampa apre una nuova finestra popup con HTML costruito al volo (`@page{size:A4 portrait}`), stesso pattern di `window.convStampa`.

**Tech Stack:** Vanilla JS (nessun framework), Bootstrap 5 (classi CSS già in uso nell'app), `fetch` verso `/api/data`, stampa via `window.print()` nativo del browser.

---

## File Structure

- **Modifica:** `public/script.js` — nuovo campo `athlete-matricola-lnd` nel modal condiviso atleta/staff (HTML inline in una stringa esistente), popolamento in edit, lettura in salvataggio.
- **Modifica:** `public/index.html` — sezione Convocazioni:
  - 2 nuovi upload immagine (Logo LND, Logo FIGC) nel pannello "Immagini Società" esistente.
  - Nuovo pannello HTML `#conv-distinta-panel` (editing Distinta).
  - Nuovo pulsante "📋 Distinta" nel form (`#conv-form-panel`) e nello storico (`_convRender`).
  - Nuove funzioni JS: `window.convDistintaApri(id)`, `window.convDistintaAggiungiGiocatore()`, `window.convDistintaRimuoviGiocatore(idx)`, `window.convDistintaMuovi(idx, dir)`, `window.convDistintaSalva()`, `window.convStampaDistinta(id)`.
  - Estensione di `window.convDeleteImg`/`window.convUploadImg` per i 2 nuovi tipi (`lnd`, `figc`).
  - Estensione di `_convApplySettings` per i 2 nuovi preview.

Nessun file nuovo — coerente con il vincolo "niente nuovi file `.js` in `api/`" e con lo stile del progetto (index.html già contiene tutta la UI+logica di Convocazioni).

---

### Task 1: Campo staff "Matricola/Tessera LND"

**Files:**
- Modify: `public/script.js:~261` (stringa HTML del modal, blocco "Dati Anagrafici FIGC")
- Modify: `public/script.js:4896-4897` (popolamento in edit)
- Modify: `public/script.js:5146-5147` (lettura in salvataggio)

- [ ] **Step 1: Aggiungere il campo HTML nel modal**

Nel modal condiviso atleta/staff, il blocco "Dati Anagrafici FIGC" contiene già i campi N° Tessera e N° Matricola sulla stessa riga (`<div class="row">...<div class="col-md-3 mb-3">N° Tessera...</div><div class="col-md-3 mb-3">N° Matricola...</div></div>`). Individua questo esatto frammento (cercalo con Grep su `numero-matricola` in `public/script.js` — è tutto su un'unica riga fisica lunghissima, quindi usa `Edit` con `old_string`/`new_string` mirati, non tentare di leggere l'intera riga) e aggiungi un nuovo campo full-width subito dopo, visibile sempre (come gli altri campi del modal condiviso), con etichetta che ne chiarisce lo scopo solo-staff:

```html
<div class="col-12 mb-3"><label class="form-label">N° Matricola/Tessera LND <small class="text-muted">(solo Staff — opzionale)</small></label><input type="text" class="form-control" id="athlete-matricola-lnd" placeholder="es. 987654"></div>
```

Il punto di innesto esatto: subito dopo la chiusura del `<div class="row">` che contiene Codice Fiscale / N° Tessera / N° Matricola, e prima del blocco "Certificato Medico". Usa `Edit` con questo `old_string` (il frammento esatto già presente, verificato in lettura):

```
<div class="col-md-3 mb-3"><label class="form-label">N° Matricola</label><input type="text" class="form-control" id="athlete-numero-matricola" placeholder="es. 12345678"></div></div>
```

sostituito con:

```
<div class="col-md-3 mb-3"><label class="form-label">N° Matricola</label><input type="text" class="form-control" id="athlete-numero-matricola" placeholder="es. 12345678"></div></div><div class="col-12 mb-3"><label class="form-label">N° Matricola/Tessera LND <small class="text-muted">(solo Staff — opzionale)</small></label><input type="text" class="form-control" id="athlete-matricola-lnd" placeholder="es. 987654"></div>
```

- [ ] **Step 2: Popolare il campo in modifica**

In `public/script.js`, subito dopo la riga:
```js
if (document.getElementById('athlete-numero-matricola')) document.getElementById('athlete-numero-matricola').value = athlete.numeroMatricola || '';
```
aggiungi:
```js
if (document.getElementById('athlete-matricola-lnd')) document.getElementById('athlete-matricola-lnd').value = athlete.matricolaLnd || '';
```

- [ ] **Step 3: Leggere il campo al salvataggio**

In `public/script.js`, nell'oggetto `athleteData` costruito al salvataggio, subito dopo la riga:
```js
numeroMatricola: (document.getElementById('athlete-numero-matricola')?.value || '').trim()
```
cambia la virgola finale e aggiungi il nuovo campo:
```js
numeroMatricola: (document.getElementById('athlete-numero-matricola')?.value || '').trim(),
matricolaLnd: (document.getElementById('athlete-matricola-lnd')?.value || '').trim()
```

- [ ] **Step 4: Verifica manuale**

Apri l'app in locale (o ambiente di sviluppo), vai in Gestione Squadra → Aggiungi Staff, compila il campo "N° Matricola/Tessera LND", salva. Riapri la scheda in modifica: il valore deve essere precompilato. Verifica anche che un atleta normale (non staff) possa vedere/compilare il campo senza errori (è nel form condiviso, comportamento atteso e voluto — l'etichetta chiarisce che è pensato per lo staff).

- [ ] **Step 5: Commit**

```bash
git add public/script.js
git commit -m "feat(distinta): aggiunge campo Matricola/Tessera LND allo staff"
```

---

### Task 2: Due nuovi upload immagine — Logo LND e Logo FIGC

**Files:**
- Modify: `public/index.html:2908-2987` (pannello "Immagini Società")
- Modify: `public/index.html` — `window.convDeleteImg` (~5273-5309)
- Modify: `public/index.html` — `_convApplySettings` (~5248-5270)

- [ ] **Step 1: Aggiungere i due blocchi upload nel pannello Immagini Società**

In `public/index.html`, nel pannello "Immagini Società" (`<div class="d-flex gap-3 flex-wrap align-items-center">`), individua il blocco "Logo Società (centro)" (righe 2927-2939) e aggiungi due nuovi blocchi analoghi subito prima di esso (così appaiono Logo LND, poi Logo Società, poi Logo Sponsor, coerente con l'ordine di stampa sinistra→centro→destra):

```html
<div>
    <label class="form-label small mb-1">Logo LND (distinta, sx)</label><br>
    <div style="display:inline-flex;align-items:center;gap:4px;">
        <img id="conv-lnd-preview" src="" style="height:48px;border-radius:4px;border:1px solid var(--bg-blue);display:none;">
        <button id="conv-lnd-preview-del" onclick="window.convDeleteImg('lnd')" title="Elimina immagine"
            style="display:none;background:#450a0a;color:#d90429;border:none;border-radius:4px;
                   padding:2px 6px;font-size:0.75rem;cursor:pointer;line-height:1.4;">✕</button>
    </div>
    <label class="btn btn-sm btn-outline-secondary mt-1 no-print">
        <i class="bi bi-upload"></i> Carica Logo LND
        <input type="file" accept="image/*" id="conv-lnd-upload" style="display:none;" onchange="window.convUploadImg(this,'lnd')">
    </label>
</div>
<div>
    <label class="form-label small mb-1">Logo FIGC (distinta, dx)</label><br>
    <div style="display:inline-flex;align-items:center;gap:4px;">
        <img id="conv-figc-preview" src="" style="height:48px;border-radius:4px;border:1px solid var(--bg-blue);display:none;">
        <button id="conv-figc-preview-del" onclick="window.convDeleteImg('figc')" title="Elimina immagine"
            style="display:none;background:#450a0a;color:#d90429;border:none;border-radius:4px;
                   padding:2px 6px;font-size:0.75rem;cursor:pointer;line-height:1.4;">✕</button>
    </div>
    <label class="btn btn-sm btn-outline-secondary mt-1 no-print">
        <i class="bi bi-upload"></i> Carica Logo FIGC
        <input type="file" accept="image/*" id="conv-figc-upload" style="display:none;" onchange="window.convUploadImg(this,'figc')">
    </label>
</div>
```

Usa `Edit` con `old_string` il blocco esistente che inizia con `<div>\n                                <label class="form-label small mb-1">Logo Società (centro)</label>` (il testo esatto va confermato con Read/Grep al momento dell'esecuzione, la struttura è quella mostrata sopra alle righe 2927-2939 di `public/index.html`), inserendo i due nuovi blocchi subito prima.

- [ ] **Step 2: Estendere `window.convDeleteImg` per riconoscere `lnd`/`figc`**

In `public/index.html`, dentro `window.convDeleteImg`, la variabile `previewId`/`uploadId` è calcolata con una catena di ternari che copre solo `bg`/`bg2`/`logo`/`sponsor`. Sostituisci quella logica con una mappa esplicita che copre tutti e 6 i tipi. Trova:

```js
var previewId = type === 'bg' ? 'conv-bg-preview'
              : type === 'bg2' ? 'conv-bg2-preview'
              : type === 'logo' ? 'conv-logo-preview'
              : 'conv-sponsor-preview';
var uploadId = type === 'bg' ? 'conv-bg-upload'
             : type === 'bg2' ? 'conv-bg2-upload'
             : type === 'logo' ? 'conv-logo-upload'
             : 'conv-sponsor-upload';
```

Sostituisci con:

```js
var previewId = type === 'bg' ? 'conv-bg-preview'
              : type === 'bg2' ? 'conv-bg2-preview'
              : type === 'logo' ? 'conv-logo-preview'
              : type === 'lnd' ? 'conv-lnd-preview'
              : type === 'figc' ? 'conv-figc-preview'
              : 'conv-sponsor-preview';
var uploadId = type === 'bg' ? 'conv-bg-upload'
             : type === 'bg2' ? 'conv-bg2-upload'
             : type === 'logo' ? 'conv-logo-upload'
             : type === 'lnd' ? 'conv-lnd-upload'
             : type === 'figc' ? 'conv-figc-upload'
             : 'conv-sponsor-upload';
```

`lnd`/`figc` non hanno una `redisKey` dedicata (come `logo`/`sponsor` già oggi) — restano quindi nel ramo `else` esistente della funzione (`_convSettings[type] = null; _convSaveSettings();`), che già gestisce correttamente qualunque `type` non elencato in `redisKey`. Nessuna altra modifica necessaria in questa funzione.

- [ ] **Step 3: Estendere `_convApplySettings` per mostrare i due nuovi preview**

In `public/index.html`, dentro `_convApplySettings`, dopo la riga:
```js
setImg('conv-bg2-preview',     s._bg2 || s.bg2);
```
aggiungi:
```js
setImg('conv-lnd-preview',     s.lnd);
setImg('conv-figc-preview',    s.figc);
```

(`lnd`/`figc` seguono lo stesso pattern di `logo`/`sponsor`: salvati dentro `_convSettings` via `convSaveSettings`/localStorage-like meccanismo esistente, non nei redisKey dedicati `convBg`/`convBg2`.)

- [ ] **Step 4: Verifica manuale**

In Convocazioni, carica un'immagine in "Logo LND" e una in "Logo FIGC". Ricarica la pagina: entrambe le preview devono ricomparire. Premi ✕ su una delle due: deve sparire e il file input deve resettarsi. Verifica in console che non ci siano errori JS.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): aggiunge upload Logo LND e Logo FIGC in Convocazioni"
```

---

### Task 3: Struttura dati `conv.distinta` — helper di lettura/scrittura

**Files:**
- Modify: `public/index.html` — vicino a `window.convSalva` (~5423-5453)

- [ ] **Step 1: Aggiungere una funzione factory per una Distinta vuota**

Subito prima di `window.convSalva = function() {`, aggiungi:

```js
// ── Distinta F.I.G.C. — factory oggetto vuoto/precompilato ──────
function _convDistintaVuota(conv) {
    return {
        affiliazione: '',
        societa: (window.appName || document.title || 'Sport Monitoring').replace(/\s*[-–—].*$/, '').trim() || 'Sport Monitoring',
        campionato: [conv.tipo, conv.categoria].filter(Boolean).join(' — '),
        avversario: conv.avversario || '',
        data: conv.data || '',
        luogo: conv.luogo || '',
        giocatori: [],
        staffRuoli: {
            dirigenteAccompagnatore: { athleteId:'', nome:'', matricola:'' },
            dirigenteUfficialiGara:  { athleteId:'', nome:'', matricola:'' },
            medicoSociale:           { athleteId:'', nome:'', matricola:'' },
            allenatoreSeconda:       { athleteId:'', nome:'', matricola:'' },
            dirigenteMassaggiatore:  { athleteId:'', nome:'', matricola:'' },
            preparatoreAtletico:     { athleteId:'', nome:'', matricola:'' },
            preparatorePortieri:     { athleteId:'', nome:'', matricola:'' }
        },
        note: ''
    };
}

// Costruisce una riga giocatore a partire da un atleta di Gestione Squadra
function _convDistintaRigaDaAtleta(athlete) {
    return {
        athleteId: String(athlete.id),
        ruolo: 0, // rinumerato da _convDistintaRinumera()
        riserva: '',
        capitano: athlete.isCaptain ? 'C' : (athlete.isViceCaptain ? 'VC' : ''),
        docTipo: 'Tess.',
        docNumero: athlete.numeroTessera || '',
        docRilasciato: 'FIGC'
    };
}

function _convDistintaRinumera(giocatori) {
    giocatori.forEach(function(g, i) { g.ruolo = i + 1; });
}
```

- [ ] **Step 2: Verifica manuale**

Apri la console del browser sull'app, dopo il caricamento della pagina esegui `typeof window.convDistintaApri` — a questo punto sarà ancora `undefined` (verrà creata nel Task 4), ma verifica che non ci siano errori di sintassi JS in console dopo aver salvato il file (nessun `Uncaught SyntaxError`).

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): aggiunge helper factory per conv.distinta"
```

---

### Task 4: Pannello HTML di editing "Distinta"

**Files:**
- Modify: `public/index.html` — dentro `#convocazioni-section`, subito dopo la chiusura di `#conv-form-panel` (dopo riga 3050, prima di `<!-- Lista convocazioni salvate -->`)

- [ ] **Step 1: Aggiungere il pannello HTML**

Inserisci questo blocco subito dopo la chiusura di `#conv-form-panel` (`</div>\n            </div>` alla riga 3050) e prima del commento `<!-- Lista convocazioni salvate -->`:

```html
<!-- Pannello Distinta F.I.G.C. -->
<div class="col-12 mb-3" id="conv-distinta-panel" style="display:none;">
    <div class="card chart-card">
        <div class="card-body p-3">
            <h6 style="color:#60a5fa;" class="mb-3">📋 Distinta F.I.G.C.</h6>
            <input type="hidden" id="distinta-conv-id">
            <div class="row">
                <div class="col-md-3 mb-2"><label class="form-label small">N° Affiliazione <small class="text-muted">(opz.)</small></label>
                    <input type="text" class="form-control form-control-sm" id="distinta-affiliazione">
                </div>
                <div class="col-md-5 mb-2"><label class="form-label small">Nome Società</label>
                    <input type="text" class="form-control form-control-sm" id="distinta-societa">
                </div>
                <div class="col-md-4 mb-2"><label class="form-label small">Campionato/Torneo</label>
                    <input type="text" class="form-control form-control-sm" id="distinta-campionato">
                </div>
                <div class="col-md-4 mb-2"><label class="form-label small">Avversario</label>
                    <input type="text" class="form-control form-control-sm" id="distinta-avversario">
                </div>
                <div class="col-md-4 mb-2"><label class="form-label small">Data</label>
                    <input type="date" class="form-control form-control-sm" id="distinta-data">
                </div>
                <div class="col-md-4 mb-2"><label class="form-label small">Luogo</label>
                    <input type="text" class="form-control form-control-sm" id="distinta-luogo">
                </div>
            </div>
            <hr class="my-2">
            <div class="d-flex align-items-center justify-content-between mb-2">
                <label class="form-label small fw-bold mb-0" style="color:#16a34a;">⚽ Elenco Giocatori</label>
                <div class="d-flex gap-1 align-items-center no-print">
                    <select class="form-select form-select-sm" id="distinta-add-giocatore-sel" style="max-width:220px;"></select>
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="window.convDistintaAggiungiGiocatore()">+ Aggiungi</button>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table class="table table-sm align-middle" style="min-width:900px;">
                    <thead>
                        <tr style="font-size:0.75rem;color:#94a3b8;">
                            <th>N.</th><th>Data Nascita</th><th>Cognome e Nome</th><th>Riserve</th><th>Cap/VC</th>
                            <th>N. Matricola</th><th>Doc. Tipo</th><th>Doc. Numero</th><th>Doc. Rilasciato</th><th></th>
                        </tr>
                    </thead>
                    <tbody id="distinta-giocatori-body"></tbody>
                </table>
            </div>
            <hr class="my-2">
            <label class="form-label small fw-bold mb-2" style="color:#f59e0b;">👔 Staff / Firme</label>
            <div id="distinta-staff-body" class="row"></div>
            <div class="mb-2 mt-2"><label class="form-label small">Note</label>
                <textarea class="form-control form-control-sm" id="distinta-note" rows="2"></textarea>
            </div>
            <div class="d-flex gap-2 mt-3 flex-wrap">
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('conv-distinta-panel').style.display='none'">Annulla</button>
                <button type="button" class="btn btn-primary-custom btn-sm" onclick="window.convDistintaSalva()"><i class="bi bi-save"></i> Salva</button>
                <button type="button" class="btn btn-success btn-sm ms-auto" onclick="window.convStampaDistinta(document.getElementById('distinta-conv-id').value)"><i class="bi bi-printer-fill"></i> 🖨️ Stampa Distinta</button>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Verifica manuale**

Ricarica la pagina, apri i DevTools → Elements, cerca `#conv-distinta-panel`: deve esistere nel DOM con `display:none`. Nessun errore HTML (tag non chiusi) in console.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): aggiunge pannello HTML editing Distinta F.I.G.C."
```

---

### Task 5: Pulsante "📋 Distinta" nel form e nello storico

**Files:**
- Modify: `public/index.html:3041-3047` (barra azioni form)
- Modify: `public/index.html` — `_convRender` (~5469-5475)

- [ ] **Step 1: Bottone nel form**

Trova il blocco azioni del form:
```html
<div class="d-flex gap-2 mt-3 flex-wrap">
    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('conv-form-panel').style.display='none'">Annulla</button>
    <button type="button" class="btn btn-primary-custom btn-sm" onclick="window.convSalva()"><i class="bi bi-save"></i> Salva</button>
    <button type="button" class="btn btn-success btn-sm ms-auto" onclick="window.convStampa(null,false)"><i class="bi bi-printer-fill"></i> 🟥 Convocazione</button>
    <button type="button" class="btn btn-outline-light btn-sm" onclick="window.convStampa(null,true)"><i class="bi bi-printer"></i> ⬜ Pre-Conv.</button>
    <button type="button" class="btn btn-sm" style="background:#3b82f6;color:#fff;border:none;" onclick="window.convInviaBacheca(null)" title="Pubblica in Bacheca"><i class="bi bi-megaphone-fill"></i> Bacheca</button>
</div>
```

Aggiungi un bottone "📋 Distinta" prima del bottone Bacheca (richiede che la convocazione sia già stata salvata, quindi usa l'id corrente dal campo nascosto `#conv-edit-id`; se vuoto, avvisa di salvare prima):

```html
<div class="d-flex gap-2 mt-3 flex-wrap">
    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('conv-form-panel').style.display='none'">Annulla</button>
    <button type="button" class="btn btn-primary-custom btn-sm" onclick="window.convSalva()"><i class="bi bi-save"></i> Salva</button>
    <button type="button" class="btn btn-success btn-sm ms-auto" onclick="window.convStampa(null,false)"><i class="bi bi-printer-fill"></i> 🟥 Convocazione</button>
    <button type="button" class="btn btn-outline-light btn-sm" onclick="window.convStampa(null,true)"><i class="bi bi-printer"></i> ⬜ Pre-Conv.</button>
    <button type="button" class="btn btn-outline-info btn-sm" onclick="window.convDistintaDaForm()"><i class="bi bi-clipboard-check-fill"></i> 📋 Distinta</button>
    <button type="button" class="btn btn-sm" style="background:#3b82f6;color:#fff;border:none;" onclick="window.convInviaBacheca(null)" title="Pubblica in Bacheca"><i class="bi bi-megaphone-fill"></i> Bacheca</button>
</div>
```

- [ ] **Step 2: Bottone nello storico**

In `_convRender`, dentro il blocco `.d-flex.gap-1.no-print`, trova:
```js
h += '<button onclick="window.convStampa(\''+c.id+'\',true)" class="btn btn-sm btn-outline-light" title="⬜ Pre-Convocazione"><i class="bi bi-printer"></i></button>';
h += '<button onclick="window.convInviaBacheca(\''+c.id+'\')" class="btn btn-sm" style="background:#3b82f6;color:#fff;border:none;" title="Pubblica in Bacheca"><i class="bi bi-megaphone-fill"></i></button>';
```

Inserisci un bottone Distinta tra i due:
```js
h += '<button onclick="window.convStampa(\''+c.id+'\',true)" class="btn btn-sm btn-outline-light" title="⬜ Pre-Convocazione"><i class="bi bi-printer"></i></button>';
h += '<button onclick="window.convDistintaApri(\''+c.id+'\')" class="btn btn-sm btn-outline-info" title="📋 Distinta F.I.G.C."><i class="bi bi-clipboard-check-fill"></i></button>';
h += '<button onclick="window.convInviaBacheca(\''+c.id+'\')" class="btn btn-sm" style="background:#3b82f6;color:#fff;border:none;" title="Pubblica in Bacheca"><i class="bi bi-megaphone-fill"></i></button>';
```

- [ ] **Step 3: `convDistintaDaForm` — ponte dal form (che può non avere ancora un id salvato)**

Aggiungi questa funzione subito prima di `window.convDistintaApri` (creata nel Task 6):
```js
// Ponte dal form: richiede che la convocazione sia già salvata (serve un id)
window.convDistintaDaForm = function() {
    var id = document.getElementById('conv-edit-id').value;
    if (!id) { alert('Salva prima la convocazione, poi apri la Distinta.'); return; }
    window.convDistintaApri(id);
};
```

- [ ] **Step 4: Verifica manuale**

Apri una Convocazione nuova (non salvata): il bottone "📋 Distinta" nel form deve mostrare l'alert "Salva prima...". Salva la convocazione, poi premi di nuovo il bottone: non deve più mostrare l'alert (la funzione `convDistintaApri` sarà implementata nel Task 6 — per ora verifica solo che non lanci errori diversi da "not a function" se non ancora definita, oppure esegui questo step insieme al Task 6).

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): aggiunge pulsanti Distinta in form e storico Convocazioni"
```

---

### Task 6: Apertura e popolamento del pannello (`convDistintaApri`)

**Files:**
- Modify: `public/index.html` — subito dopo `window.convSelectAll` (~5418-5420), prima di `window.convSalva`

- [ ] **Step 1: Implementare `window.convDistintaApri`**

```js
// ── Apri pannello Distinta per una convocazione esistente ───────
window.convDistintaApri = function(id) {
    var conv = _convData.find(function(x){ return x.id === id; });
    if (!conv) { alert('Convocazione non trovata.'); return; }
    document.getElementById('conv-form-panel').style.display = 'none';
    document.getElementById('conv-distinta-panel').style.display = '';
    document.getElementById('distinta-conv-id').value = id;

    var d = conv.distinta ? JSON.parse(JSON.stringify(conv.distinta)) : _convDistintaVuota(conv);
    // Se mancano giocatori e la convocazione ha atleti selezionati, precompila da quelli
    if (!d.giocatori.length && (conv.atletiIds || []).length) {
        var all = (window.athletes || []).filter(function(a){ return !a.isGuest && !a.isStaff; });
        conv.atletiIds.forEach(function(aid) {
            var a = all.find(function(x){ return String(x.id) === String(aid); });
            if (a) d.giocatori.push(_convDistintaRigaDaAtleta(a));
        });
        _convDistintaRinumera(d.giocatori);
    }
    window._distintaState = d;

    document.getElementById('distinta-affiliazione').value = d.affiliazione || '';
    document.getElementById('distinta-societa').value      = d.societa || '';
    document.getElementById('distinta-campionato').value   = d.campionato || '';
    document.getElementById('distinta-avversario').value   = d.avversario || '';
    document.getElementById('distinta-data').value          = d.data || '';
    document.getElementById('distinta-luogo').value          = d.luogo || '';
    document.getElementById('distinta-note').value           = d.note || '';

    _convDistintaPopolaSelectAggiungi();
    _convDistintaRenderGiocatori();
    _convDistintaRenderStaff();
};

// Menu a tendina "+ Aggiungi giocatore": tutti gli atleti non staff/non ospiti,
// esclusi quelli già in tabella
function _convDistintaPopolaSelectAggiungi() {
    var sel = document.getElementById('distinta-add-giocatore-sel');
    var d = window._distintaState;
    var giaPresenti = d.giocatori.map(function(g){ return String(g.athleteId); });
    var all = (window.athletes || []).filter(function(a){ return !a.isGuest && !a.isStaff; });
    var html = '<option value="">— seleziona atleta —</option>';
    all.forEach(function(a) {
        if (giaPresenti.indexOf(String(a.id)) !== -1) return;
        html += '<option value="'+a.id+'">'+a.name+'</option>';
    });
    sel.innerHTML = html;
}
```

- [ ] **Step 2: Verifica manuale**

Salva una Convocazione con almeno 2 atleti selezionati, premi "📋 Distinta" nel relativo form o nello storico: il pannello deve aprirsi (per ora tabella/staff vuoti in visualizzazione, verranno renderizzati nel Task 7-8), i campi intestazione devono essere precompilati (societa = nome app, campionato = tipo+categoria, avversario/data/luogo dalla convocazione). Il menu a tendina "+ Aggiungi" deve elencare gli atleti NON già presenti in `d.giocatori`.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): implementa apertura e precompilazione pannello Distinta"
```

---

### Task 7: Tabella giocatori — render, aggiungi, rimuovi, riordina

**Files:**
- Modify: `public/index.html` — subito dopo le funzioni del Task 6

- [ ] **Step 1: Implementare il render della tabella**

```js
function _convDistintaRenderGiocatori() {
    var body = document.getElementById('distinta-giocatori-body');
    var d = window._distintaState;
    var atletiMap = {};
    (window.athletes || []).forEach(function(a){ atletiMap[String(a.id)] = a; });

    var html = '';
    d.giocatori.forEach(function(g, i) {
        var a = atletiMap[String(g.athleteId)];
        var nome = a ? a.name : '(atleta rimosso)';
        var dataNascita = a && a.dataNascita ? new Date(a.dataNascita + 'T00:00:00').toLocaleDateString('it-IT') : '';
        html += '<tr>'
            + '<td style="white-space:nowrap;">'
            +   '<button type="button" class="btn btn-sm btn-outline-secondary no-print" style="padding:0 6px;" onclick="window.convDistintaMuovi('+i+',-1)" '+(i===0?'disabled':'')+'>↑</button> '
            +   g.ruolo
            +   ' <button type="button" class="btn btn-sm btn-outline-secondary no-print" style="padding:0 6px;" onclick="window.convDistintaMuovi('+i+',1)" '+(i===d.giocatori.length-1?'disabled':'')+'>↓</button>'
            + '</td>'
            + '<td>'+dataNascita+'</td>'
            + '<td>'+nome+'</td>'
            + '<td><input type="text" class="form-control form-control-sm" style="width:60px;" value="'+(g.riserva||'')+'" onchange="window.convDistintaCampo('+i+',\'riserva\',this.value)"></td>'
            + '<td><input type="text" class="form-control form-control-sm" style="width:60px;" value="'+(g.capitano||'')+'" onchange="window.convDistintaCampo('+i+',\'capitano\',this.value)"></td>'
            + '<td>'+(a ? (a.numeroMatricola||'') : '')+'</td>'
            + '<td><input type="text" class="form-control form-control-sm" style="width:70px;" value="'+(g.docTipo||'')+'" onchange="window.convDistintaCampo('+i+',\'docTipo\',this.value)"></td>'
            + '<td><input type="text" class="form-control form-control-sm" style="width:90px;" value="'+(g.docNumero||'')+'" onchange="window.convDistintaCampo('+i+',\'docNumero\',this.value)"></td>'
            + '<td><input type="text" class="form-control form-control-sm" style="width:70px;" value="'+(g.docRilasciato||'')+'" onchange="window.convDistintaCampo('+i+',\'docRilasciato\',this.value)"></td>'
            + '<td><button type="button" class="btn btn-sm btn-outline-danger no-print" onclick="window.convDistintaRimuoviGiocatore('+i+')" title="Rimuovi"><i class="bi bi-trash-fill"></i></button></td>'
            + '</tr>';
    });
    body.innerHTML = html || '<tr><td colspan="10" class="text-muted small">Nessun giocatore. Usa "+ Aggiungi" qui sopra.</td></tr>';
}

window.convDistintaCampo = function(idx, campo, val) {
    window._distintaState.giocatori[idx][campo] = val;
};

window.convDistintaAggiungiGiocatore = function() {
    var sel = document.getElementById('distinta-add-giocatore-sel');
    var athleteId = sel.value;
    if (!athleteId) return;
    var a = (window.athletes || []).find(function(x){ return String(x.id) === String(athleteId); });
    if (!a) return;
    var d = window._distintaState;
    d.giocatori.push(_convDistintaRigaDaAtleta(a));
    _convDistintaRinumera(d.giocatori);
    _convDistintaPopolaSelectAggiungi();
    _convDistintaRenderGiocatori();
};

window.convDistintaRimuoviGiocatore = function(idx) {
    var d = window._distintaState;
    d.giocatori.splice(idx, 1);
    _convDistintaRinumera(d.giocatori);
    _convDistintaPopolaSelectAggiungi();
    _convDistintaRenderGiocatori();
};

window.convDistintaMuovi = function(idx, dir) {
    var d = window._distintaState;
    var target = idx + dir;
    if (target < 0 || target >= d.giocatori.length) return;
    var tmp = d.giocatori[idx];
    d.giocatori[idx] = d.giocatori[target];
    d.giocatori[target] = tmp;
    _convDistintaRinumera(d.giocatori);
    _convDistintaRenderGiocatori();
};
```

- [ ] **Step 2: Verifica manuale**

Apri il pannello Distinta di una convocazione con atleti. La tabella deve mostrare una riga per atleta, con N. progressivo, data nascita, nome, matricola (se presente su Gestione Squadra), documento precompilato (Tess./numeroTessera/FIGC). Prova ad aggiungere un giocatore extra dal menu a tendina: deve comparire in fondo alla tabella e sparire dal menu. Prova a rimuoverne uno: la tabella si aggiorna e la numerazione si ricompatta 1..N. Prova le frecce ↑↓: la riga scambia posizione e la numerazione si aggiorna.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): render e gestione tabella giocatori (aggiungi/rimuovi/riordina)"
```

---

### Task 8: Sezione firme/staff (7 ruoli)

**Files:**
- Modify: `public/index.html` — subito dopo le funzioni del Task 7

- [ ] **Step 1: Implementare il render della sezione staff**

```js
var _DISTINTA_RUOLI = [
    { key: 'dirigenteAccompagnatore', label: 'Dirigente Accompagnatore Ufficiale' },
    { key: 'dirigenteUfficialiGara',  label: 'Dirigente add. Ufficiali di Gara' },
    { key: 'medicoSociale',           label: 'Medico Sociale' },
    { key: 'allenatoreSeconda',       label: 'Allenatore / 2° Allenatore' },
    { key: 'dirigenteMassaggiatore',  label: 'Massaggiatore' },
    { key: 'preparatoreAtletico',     label: 'Preparatore Atletico' },
    { key: 'preparatorePortieri',     label: 'Preparatore Portieri' }
];

function _convDistintaRenderStaff() {
    var box = document.getElementById('distinta-staff-body');
    var d = window._distintaState;
    var staff = (window.athletes || []).filter(function(a){ return a.isStaff && !a.isGuest; });

    var html = '';
    _DISTINTA_RUOLI.forEach(function(r) {
        var cur = d.staffRuoli[r.key] || { athleteId:'', nome:'', matricola:'' };
        var options = '<option value="">— nessuno —</option>';
        staff.forEach(function(s) {
            var sel = String(s.id) === String(cur.athleteId) ? 'selected' : '';
            options += '<option value="'+s.id+'" '+sel+'>'+s.name+'</option>';
        });
        html += '<div class="col-md-6 mb-2">'
            + '<label class="form-label small">'+r.label+'</label>'
            + '<div class="d-flex gap-1">'
            + '<select class="form-select form-select-sm" onchange="window.convDistintaSelStaff(\''+r.key+'\',this.value)">'+options+'</select>'
            + '<input type="text" class="form-control form-control-sm" style="max-width:120px;" placeholder="Matricola" value="'+(cur.matricola||'')+'" onchange="window.convDistintaCampoStaff(\''+r.key+'\',\'matricola\',this.value)">'
            + '</div>'
            + '</div>';
    });
    box.innerHTML = html;
}

window.convDistintaSelStaff = function(ruoloKey, athleteId) {
    var d = window._distintaState;
    if (!athleteId) {
        d.staffRuoli[ruoloKey] = { athleteId:'', nome:'', matricola:'' };
    } else {
        var s = (window.athletes || []).find(function(x){ return String(x.id) === String(athleteId); });
        d.staffRuoli[ruoloKey] = {
            athleteId: athleteId,
            nome: s ? s.name : '',
            matricola: s ? (s.matricolaLnd || '') : ''
        };
    }
    _convDistintaRenderStaff();
};

window.convDistintaCampoStaff = function(ruoloKey, campo, val) {
    window._distintaState.staffRuoli[ruoloKey][campo] = val;
};
```

- [ ] **Step 2: Verifica manuale**

Nel pannello Distinta, la sezione "Staff / Firme" deve mostrare 7 righe, ciascuna con un menu a tendina (popolato dallo staff di Gestione Squadra) e un campo matricola. Seleziona un membro dello staff che ha `matricolaLnd` compilata (dal Task 1): il campo matricola deve precompilarsi automaticamente e restare editabile. Seleziona "— nessuno —": il campo matricola deve svuotarsi.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): render e gestione sezione firme staff (7 ruoli)"
```

---

### Task 9: Salvataggio della Distinta (`convDistintaSalva`)

**Files:**
- Modify: `public/index.html` — subito dopo le funzioni del Task 8

- [ ] **Step 1: Implementare il salvataggio**

```js
window.convDistintaSalva = function() {
    var id = document.getElementById('distinta-conv-id').value;
    var conv = _convData.find(function(x){ return x.id === id; });
    if (!conv) { alert('Convocazione non trovata.'); return; }

    var d = window._distintaState;
    d.affiliazione = document.getElementById('distinta-affiliazione').value;
    d.societa      = document.getElementById('distinta-societa').value;
    d.campionato   = document.getElementById('distinta-campionato').value;
    d.avversario   = document.getElementById('distinta-avversario').value;
    d.data         = document.getElementById('distinta-data').value;
    d.luogo        = document.getElementById('distinta-luogo').value;
    d.note         = document.getElementById('distinta-note').value;

    conv.distinta = d;
    _convSaveData();
    alert('✅ Distinta salvata!');
};
```

- [ ] **Step 2: Verifica manuale**

Compila alcuni campi (capitano su una riga, matricola su uno staff, note), premi Salva. Ricarica la pagina, riapri la Distinta della stessa convocazione: tutti i valori devono essere ripristinati esattamente come inseriti (incluso l'ordine dei giocatori). Verifica in Network/DevTools che la richiesta POST a `/api/data` includa `convocazioni` con `distinta` annidato nell'oggetto convocazione corretto.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): implementa salvataggio conv.distinta"
```

---

### Task 10: Stampa `window.convStampaDistinta(id)`

**Files:**
- Modify: `public/index.html` — subito dopo `window.convDistintaSalva`

Questa è la funzione più corposa: costruisce l'HTML di stampa A4 replicando il layout del modello F.I.G.C. allegato (3 loghi, intestazione testuale, tabella giocatori con colonne Espulsi/Ammoniti vuote, sezione firme, stile bianco su nero/testo nero su sfondo bianco, colori). Riusa lo stesso pattern di apertura finestra di `window.convStampa` (`window.open('','_blank',...)`, `document.write`, bottone stampa).

- [ ] **Step 1: Implementare `window.convStampaDistinta`**

```js
window.convStampaDistinta = function(id) {
    var conv = _convData.find(function(x){ return x.id === id; });
    if (!conv) { alert('Convocazione non trovata.'); return; }
    var d = conv.distinta;
    if (!d) { alert('Compila e salva prima la Distinta.'); return; }

    var s = _convSettings || {};
    var atletiMap = {};
    (window.athletes || []).forEach(function(a){ atletiMap[String(a.id)] = a; });

    function fmtDataParti(iso) {
        if (!iso) return { g:'', m:'', a:'' };
        var parts = iso.split('-'); // YYYY-MM-DD
        return { g: parts[2]||'', m: parts[1]||'', a: parts[0]||'' };
    }
    function esc(v) { return (v===undefined||v===null) ? '' : String(v); }

    // ── Tabella giocatori ──────────────────────────────────────────
    var righeGiocatori = '';
    d.giocatori.forEach(function(g) {
        var a = atletiMap[String(g.athleteId)];
        var nome = a ? a.name : '';
        var dn = fmtDataParti(a ? a.dataNascita : '');
        var matricola = a ? (a.numeroMatricola || '') : '';
        righeGiocatori += '<tr>'
            + '<td class="tc">'+esc(g.ruolo)+'</td>'
            + '<td class="tc">'+dn.g+'</td>'
            + '<td class="tc">'+dn.m+'</td>'
            + '<td class="tc">'+dn.a+'</td>'
            + '<td class="tl">'+esc(nome)+'</td>'
            + '<td class="tc">'+esc(g.riserva)+'</td>'
            + '<td class="tc">'+esc(g.capitano)+'</td>'
            + '<td class="tc">'+esc(matricola)+'</td>'
            + '<td class="tc">'+esc(g.docTipo)+'</td>'
            + '<td class="tc">'+esc(g.docNumero)+'</td>'
            + '<td class="tc">'+esc(g.docRilasciato)+'</td>'
            + '<td class="tc"></td>'
            + '<td class="tc"></td>'
            + '</tr>';
    });

    // ── Sezione firme ────────────────────────────────────────────
    var labelRuolo = {
        dirigenteAccompagnatore: 'Dirigente Accompagnatore Ufficiale',
        dirigenteUfficialiGara:  'Dirigente add. Ufficiali di Gara',
        medicoSociale:           'Medico Sociale',
        allenatoreSeconda:       'Allenatore / 2° Allenatore',
        dirigenteMassaggiatore:  'Massaggiatore',
        preparatoreAtletico:     'Preparatore Atletico',
        preparatorePortieri:     'Preparatore Portieri'
    };
    var righeFirme = '';
    Object.keys(labelRuolo).forEach(function(key) {
        var r = d.staffRuoli[key];
        if (!r || !r.athleteId) return;
        righeFirme += '<div class="firma-row"><span class="firma-label">'+labelRuolo[key]+':</span> '
            + '<span class="firma-nome">'+esc(r.nome)+'</span>'
            + (r.matricola ? ' <span class="firma-matricola">(matr. '+esc(r.matricola)+')</span>' : '')
            + '</div>';
    });

    var logoLnd  = s.lnd  || '';
    var logoSoc  = s.logo || '';
    var logoFigc = s.figc || '';

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Distinta F.I.G.C.</title>'
        + '<style>'
        + '@page{size:A4 portrait;margin:10mm;}'
        + 'body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;margin:0;padding:0;}'
        + '.page{width:100%;max-width:190mm;margin:0 auto;}'
        + '.loghi-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}'
        + '.loghi-row img{max-height:60px;max-width:110px;object-fit:contain;}'
        + '.loghi-row .spacer{flex:1;}'
        + '.testata{text-align:center;margin-bottom:6px;}'
        + '.testata h1{font-size:1.1rem;margin:2px 0;}'
        + '.testata h2{font-size:0.95rem;margin:2px 0;font-weight:700;}'
        + '.testata .riga{font-size:0.85rem;margin:2px 0;}'
        + 'table.distinta{width:100%;border-collapse:collapse;margin-top:8px;font-size:0.72rem;}'
        + 'table.distinta th,table.distinta td{border:1px solid #000;padding:3px 4px;}'
        + 'table.distinta th{background:#f0f0f0;font-size:0.68rem;text-align:center;}'
        + '.tc{text-align:center;}.tl{text-align:left;}'
        + '.firme-box{margin-top:14px;font-size:0.8rem;}'
        + '.firma-row{margin-bottom:4px;}'
        + '.firma-label{font-weight:700;}'
        + '.firme-finali{display:flex;justify-content:space-between;margin-top:24px;}'
        + '.firme-finali div{width:45%;border-top:1px solid #000;text-align:center;padding-top:4px;font-size:0.78rem;}'
        + '@media print{.conv-toolbar{display:none!important;}}'
        + '</style></head><body>'
        + '<div class="page">'
        + '<div class="loghi-row">'
        +   (logoLnd  ? '<img src="'+logoLnd+'">'  : '<div class="spacer"></div>')
        +   (logoSoc  ? '<img src="'+logoSoc+'">'  : '<div class="spacer"></div>')
        +   (logoFigc ? '<img src="'+logoFigc+'">' : '<div class="spacer"></div>')
        + '</div>'
        + '<div class="testata">'
        +   '<h1>DISTINTA</h1>'
        +   '<h2>F.I.G.C. — LEGA NAZIONALE DILETTANTI</h2>'
        +   '<div class="riga">'+(d.affiliazione ? 'N° Affiliazione: '+esc(d.affiliazione)+' — ' : '')+esc(d.societa)+'</div>'
        +   '<div class="riga">Distinta dei giocatori partecipanti alla gara: '+esc(d.societa)+(d.avversario ? ' — '+esc(d.avversario) : '')+'</div>'
        +   '<div class="riga">'+(d.campionato ? esc(d.campionato)+' · ' : '')+(d.data ? new Date(d.data+'T00:00:00').toLocaleDateString('it-IT') : '')+(d.luogo ? ' · '+esc(d.luogo) : '')+'</div>'
        + '</div>'
        + '<table class="distinta"><thead><tr>'
        +   '<th rowspan="2">N.</th><th colspan="3">Data Nascita</th><th rowspan="2">Cognome e Nome</th>'
        +   '<th rowspan="2">Riserve</th><th rowspan="2">Cap/<br>V.Cap.</th><th rowspan="2">N. Matricola<br>F.I.G.C.</th>'
        +   '<th colspan="3">Documento di identificazione</th><th rowspan="2">Espulsi</th><th rowspan="2">Ammoniti</th>'
        + '</tr><tr>'
        +   '<th>G</th><th>M</th><th>A</th><th>Tipo</th><th>Numero</th><th>Rilasciato</th>'
        + '</tr></thead><tbody>'
        + righeGiocatori
        + '</tbody></table>'
        + '<div class="firme-box">'
        + righeFirme
        + '</div>'
        + '<div class="firme-finali"><div>L\'ARBITRO</div><div>IL DIRIGENTE ACCOMPAGNATORE UFFICIALE</div></div>'
        + (d.note ? '<div style="margin-top:10px;font-size:0.78rem;"><strong>Note:</strong> '+esc(d.note)+'</div>' : '')
        + '</div>'
        + '<div class="conv-toolbar" style="position:fixed;top:10px;right:10px;z-index:9999;display:flex;gap:8px;">'
        + '<button onclick="window.print()" style="padding:8px 18px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;">🖨️ Stampa / Salva PDF</button>'
        + '<button onclick="window.close()" style="padding:8px 14px;background:#64748b;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">✕ Chiudi</button>'
        + '</div>'
        + '</body></html>';

    var w = window.open('', '_blank', 'width=900,height=1200');
    w.document.write(html);
    w.document.close();
};
```

- [ ] **Step 2: Verifica manuale**

Compila e salva una Distinta con almeno 3 giocatori, capitano/riserva su alcune righe, 2-3 ruoli staff valorizzati, note. Premi "🖨️ Stampa Distinta": deve aprirsi una nuova finestra con sfondo bianco, testo nero, tre slot loghi (vuoti se non caricati, altrimenti le immagini caricate nel Task 2), intestazione testuale, tabella con tutte le colonne del modello (incluse Espulsi/Ammoniti vuote), sezione firme con solo i ruoli valorizzati, le due caselle finali "L'ARBITRO"/"IL DIRIGENTE...". Il bottone "🖨️ Stampa / Salva PDF" deve aprire il dialogo di stampa nativo del browser con layout A4 verticale e nessun elemento della toolbar visibile nell'anteprima di stampa. Confronta visivamente con `fax simile compilata.pdf` per la disposizione generale delle colonne.

Prova anche il caso "Distinta senza atleti": righe tabella vuote, nessun errore.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(distinta): implementa stampa A4 Distinta F.I.G.C."
```

---

## Self-Review

**1. Spec coverage:**
- Sezione 1 (campo staff `matricolaLnd`) → Task 1. ✅
- Sezione 2 (struttura dati `conv.distinta`) → Task 3 (factory) + Task 9 (salvataggio effettivo nell'oggetto `conv`). ✅
- Sezione 3 (pannello editing: intestazione, elenco giocatori con riordino, staff/firme, note, azioni Salva/Annulla/Stampa) → Task 4 (HTML), 6 (apertura/precompilazione), 7 (tabella), 8 (staff), 9 (salvataggio). ✅
- Sezione 4 (stampa A4 fedele, 3 loghi, righe dinamiche, sezione firme, colori) → Task 2 (upload loghi) + Task 10 (stampa). ✅
- Pulsante "📋 Distinta" in form e storico → Task 5. ✅
- Edge case "Distinta senza atleti" → gestito in Task 6 (`if (!d.giocatori.length ...)`, la tabella resta vuota con solo il menu aggiungi) e Task 7 (render mostra riga placeholder "Nessun giocatore"). ✅
- Edge case "atleta senza numeroTessera/numeroMatricola/dataNascita" → Task 7/10 usano `|| ''`, nessun placeholder "N/D". ✅
- Edge case "staff senza matricolaLnd" → Task 8 (`s.matricolaLnd || ''`) e Task 10 (stampa condizionale `r.matricola ? ... : ''`). ✅
- Edge case "riordino righe" → Task 7 (`convDistintaMuovi` + rinumerazione). ✅
- Edge case "convocazione eliminata" → nessuna modifica necessaria: `window.convElimina` già esistente rimuove l'intero oggetto `conv` da `_convData`, `conv.distinta` sparisce con esso (nessuno storage separato creato in questo piano). Non serve un task dedicato.
- Edge case "loghi non caricati" → Task 10 (`logoLnd ? '<img...' : '<div class="spacer">'`). ✅
- "Nessun nuovo file .js in api/" → rispettato, tutte le modifiche sono in `public/index.html`/`public/script.js`, payload invariato. ✅

**2. Placeholder scan:** nessun "TBD"/"TODO"/"implementa poi" nei blocchi di codice — ogni step ha codice completo e diff-applicabile.

**3. Type consistency:** verificato che i nomi usati siano coerenti in tutti i task:
- `conv.distinta` con le chiavi esatte dello spec (`affiliazione`, `societa`, `campionato`, `avversario`, `data`, `luogo`, `giocatori[]`, `staffRuoli{}`, `note`) — usate identicamente in Task 3, 6, 9, 10.
- `giocatori[].{athleteId,ruolo,riserva,capitano,docTipo,docNumero,docRilasciato}` — stessi nomi in Task 3 (factory), 7 (render/edit), 10 (stampa).
- `staffRuoli.{dirigenteAccompagnatore,dirigenteUfficialiGara,medicoSociale,allenatoreSeconda,dirigenteMassaggiatore,preparatoreAtletico,preparatorePortieri}` — stessi 7 nomi in Task 3, 8, 10.
- `window._distintaState` come singolo stato in-memory del pannello aperto — usato coerentemente in Task 6/7/8/9 (nessuna doppia dichiarazione di stato).
- Funzioni pubbliche: `convDistintaApri`, `convDistintaDaForm`, `convDistintaAggiungiGiocatore`, `convDistintaRimuoviGiocatore`, `convDistintaMuovi`, `convDistintaCampo`, `convDistintaSelStaff`, `convDistintaCampoStaff`, `convDistintaSalva`, `convStampaDistinta` — ogni riferimento negli `onclick=` HTML (Task 4, 5, 7, 8) corrisponde esattamente al nome definito nel task JS relativo (Task 6-10). Nessuna discrepanza tipo `clearLayers` vs `clearFullLayers`.
- `matricolaLnd` (staff, Task 1) → letto in Task 8 (`s.matricolaLnd || ''`) con lo stesso nome esatto.

Nessun gap residuo.
