# Disabilita Export/Backup/Import per account Demo — Design

**Goal:** Nella versione demo dell'app, disabilitare tutte le funzioni di estrazione dati (Excel/PDF), backup (JSON/Excel) e importazione dati, in tutta l'app.

**Contesto:** Estensione di [2026-08-27-demo-gratuita-design.md](2026-08-27-demo-gratuita-design.md). Un utente con licenza `plan === 'demo'` non deve poter scaricare/importare dati della società — è una versione di prova, non deve portarsi via né sovrascrivere dati.

---

## Perché solo lato client

Le funzioni di export/backup/import individuate sono tutte operazioni **client-side pure**: generano o leggono file direttamente nel browser (SheetJS per Excel, jsPDF per PDF, `JSON.stringify`/`FileReader` per il backup JSON) a partire dai dati che l'utente admin ha già ricevuto con le normali chiamate API per usare l'app. Non esiste un endpoint server dedicato "esporta questo file" su cui agganciare un controllo lato server.

Un utente demo tecnicamente esperto potrebbe comunque copiare i dati a mano (F12, view-source, selezione testo): bloccare solo l'export non elimina questa possibilità in astratto. Non è quindi un controllo di sicurezza contro un accesso non autorizzato (l'utente demo *è* autorizzato a vedere quei dati, sono i suoi), ma una scelta di prodotto — scoraggiare l'uso della prova gratuita come mezzo per estrarre/migrare dati in modo strutturato. **Decisione presa con l'utente**: disabilitazione lato client, senza costruire un endpoint gateway aggiuntivo.

## Come il client sa che è un account demo

Il login (`api/auth/login.js`) già ritorna `licenseStatus.plan` per gli utenti con ruolo `admin` (ruolo assegnato alla demo). Questo valore è già salvato oggi in `sessionStorage` da `auth-multi-annata.js`:

```js
sessionStorage.setItem('gosport_license_plan', planFromLogin);
```

Nessuna modifica serve qui: la spec introduce solo una funzione di lettura in `script.js`.

## Funzione di gating

Nuova funzione helper in `public/script.js`, definita una volta a livello di modulo:

```js
function isDemoAccount() {
    return sessionStorage.getItem('gosport_license_plan') === 'demo';
}
```

## Punti UI da disabilitare (individuati)

| # | Elemento | File | Funzione |
|---|----------|------|----------|
| 1 | `#export-all-data-btn` | index.html:1507 | Backup Dati (JSON completo) |
| 2 | `#export-excel-btn` | index.html:1508 | Backup Excel (Quick Actions) |
| 3 | `#restore-backup-btn` | index.html:1510 | Ripristina Backup (apre il file picker) |
| 4 | label `for="import-file-input"` + `#import-file-input` | index.html:1757-1758 | Importa Dati |
| 5 | `#export-excel` / `#export-pdf` | script.js:4015 (generati dinamicamente) | Export Excel/PDF di report |
| 6 | `window.exportSeasonArchive(...)` bottoni | script.js:2000 | Backup singola stagione archiviata |
| 7 | `window.exportSeasonArchiveObj()` bottone | script.js:2128 | Scarica archivio corrente |
| 8 | `#season-import-input` | index.html:3167 | Importa archivio stagione (tab "Stagioni") |

## Comportamento UI

Per ogni pulsante/elemento sopra, quando `isDemoAccount()` è vero:
- `disabled = true` (per `<button>`) o `pointer-events: none` + `opacity` ridotta (per la `<label>` che avvolge l'input file, che non supporta `disabled` nativamente)
- `title = "Non disponibile nella versione demo"` (tooltip nativo del browser)

Il pulsante resta visibile (non nascosto) — come richiesto dall'utente — per far capire che la funzione esiste ma non è inclusa nella prova gratuita.

## Quando applicare il gating

Due meccanismi diversi, scelti in base a come l'elemento viene creato:

- **Elementi statici** (#1, #2, #3 — già presenti in index.html al caricamento pagina): una funzione `applyDemoRestrictions()` li disabilita via DOM (`disabled=true`/`title=...`), chiamata una volta dopo il login riuscito (subito dopo che `gosport_license_plan` è scritto in sessionStorage) e di nuovo all'avvio pagina se la sessione è già attiva (refresh).
- **Elementi generati dinamicamente** (#4, #5, #6 — ricostruiti via `innerHTML =` ogni volta che la lista archivi/report viene renderizzata): invece di richiamare `applyDemoRestrictions()` dopo ogni singolo blocco `innerHTML=` (fragile, facile dimenticarne uno in futuro), l'attributo va generato **direttamente dentro il template string**, condizionato da `isDemoAccount()` in un'unica espressione riusabile:
  ```js
  const demoAttrs = isDemoAccount() ? `disabled title="Non disponibile nella versione demo"` : '';
  // ... `<button class="..." ${demoAttrs} onclick="...">`
  ```
  Questo garantisce che il pulsante nasca già disabilitato ogni volta che il blocco HTML viene rigenerato, senza dover tracciare ogni punto di rendering.

## Fuori scope

- Non tocca l'import avatar-atleta (`athlete-avatar-input`, script.js:5051) — è upload di una foto profilo, non importazione di dati società.
- Non introduce nessun endpoint server nuovo (rispetta il vincolo dei 12 file `api/`).
- Non blocca copia manuale dei dati a schermo (fuori scope, vedi sezione "Perché solo lato client").
