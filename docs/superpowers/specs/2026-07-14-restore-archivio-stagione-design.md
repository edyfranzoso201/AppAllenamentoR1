# Ripristino selettivo da archivio stagione

Data: 2026-07-14

## Contesto

La sezione "Stagioni" di `index.html` permette di archiviare la stagione corrente (pulsante "Archivia e azzera") e di consultare in sola lettura gli archivi passati (pulsante "Vedi"). L'archivio di ogni stagione contiene 6 categorie di dati (`SEASON_KEYS` in `api/data.js`):

- `matchResults` — risultati partite (oggetto keyed per id partita)
- `evaluations` — valutazioni/presenze allenamento (oggetto keyed per data ISO, poi per atleta)
- `awards` — Hall of Fame / premi (oggetto keyed per data o per atleta, valore singolo o array)
- `calendarEvents` — eventi calendario (oggetto keyed per id evento)
- `calendarResponses` — RSVP calendario (oggetto keyed per data, poi per atleta)
- `trainingSessions` — allenamenti (oggetto keyed per id sessione)

più `inventory` (array di voci materiale), archiviato separatamente per società+annata.

La rosa atleti (`athletes`) **non fa parte** dell'archivio stagione: non viene mai azzerata dal reset, quindi non serve (e non è possibile) ripristinarla da qui.

Oggi non esiste alcun modo di riportare dati da un archivio alla stagione corrente. L'utente vuole poter reintrodurre selettivamente alcune di queste categorie (es. solo le presenze, o solo i risultati partite) nella stagione attiva, **senza mai sovrascrivere** dati già presenti — solo aggiungere ciò che manca.

## Obiettivo

Aggiungere un'azione di ripristino (restore) selettivo per categoria, dal pannello "Vedi" di un archivio già esistente, riservata al ruolo Admin, che unisce (merge additivo) i dati dell'archivio scelto nella stagione corrente senza mai sovrascrivere dati esistenti.

## Permessi

Solo `session.role === 'admin'`. Il pulsante di ripristino non compare nell'interfaccia per altri ruoli. Lato server, l'endpoint verifica esplicitamente il ruolo prima di scrivere qualunque dato (indipendentemente da cosa mostra il frontend).

## Backend — `api/data.js`

Nuovo branch `?action=season-restore` (POST), accanto ai branch esistenti `season-reset` e `season-archive`. Nessuna nuova funzione serverless (resta dentro `api/data.js`, rispettando il limite di 12 route di Vercel Hobby).

### Input

```json
{
  "annataId": "...",
  "label": "2025-26",
  "categories": ["matchResults", "evaluations", "awards", "calendarEvents", "calendarResponses", "trainingSessions", "inventory"]
}
```

`categories` è un sottoinsieme delle 7 chiavi disponibili (6 `SEASON_KEYS` + `inventory`); l'utente seleziona solo quelle che vuole ripristinare.

### Validazione

- `session.isAuthenticated && session.role === 'admin'` → altrimenti 403
- `annataId` valido (`isValidId`) → altrimenti 400
- `label` presente e corrispondente a un archivio esistente in `annate:<annataId>:archive` → altrimenti 404
- `categories` non vuoto e ogni elemento ⊆ insieme delle 7 chiavi valide → altrimenti 400 (elementi non validi vengono scartati silenziosamente, non è un errore bloccante se almeno una categoria valida resta)

### Logica di merge (per categoria selezionata)

Legge l'archivio (`archive[label].data[categoria]`) e la chiave corrente (`kv.get(prefix:categoria)` o, per inventory, `kv.get(society:<sid>:inventory:<annataId>)`). L'archivio **non viene mai modificato**: sola lettura, riutilizzabile quante volte si vuole.

Due strategie di merge, in base alla forma del dato:

**A. Oggetti keyed per ID** — `matchResults`, `calendarEvents`, `trainingSessions`, e `awards` quando keyed per id/atleta con valore singolo:
- Per ogni `id` presente nell'archivio: se `id` NON esiste già nella chiave corrente → viene copiato as-is (stesso id, stessi dati); se esiste già → viene saltato e conteggiato in `skipped`.
- Nota: si mantiene l'id originale (non si rigenera), perché la logica di conflitto è già "salta se l'id esiste" — coerente con la scelta dell'utente di non sovrascrivere mai. Se in futuro servisse invece "aggiungi sempre con nuovo id", sarà un'estensione separata.

**B. Oggetti keyed per data → poi per atleta** — `evaluations`, `calendarResponses`:
- Per ogni `data` (chiave ISO) nell'archivio:
  - Se la `data` non esiste nella stagione corrente → l'intero oggetto del giorno viene copiato.
  - Se la `data` esiste già → merge a livello di singolo atleta: per ogni `athleteId` dentro quel giorno nell'archivio, se l'atleta NON ha già un valore per quella data nella stagione corrente → viene aggiunto; se ce l'ha già → quel valore specifico viene saltato (conteggiato in `skipped`), il resto del giorno prosegue normalmente.

**C. `inventory`** (array):
- Per ogni voce dell'archivio: se non esiste già una voce con lo stesso `nome` + `taglia` (case-insensitive, trim) nell'inventario corrente → viene aggiunta (con nuovo id per evitare collisioni); se esiste → viene saltata.

**D. `awards`** quando il valore per chiave è un array (caso Hall of Fame con più premi per stessa chiave): si itera l'array e si applica la stessa logica A per ogni elemento, confrontando su un identificatore composito (es. `athleteId+date+reason`) per decidere se è già presente.

### Scrittura

Dopo aver calcolato in memoria i nuovi oggetti/array risultanti dal merge, si scrivono con `kv.set` solo le categorie effettivamente modificate (se `added === 0` per una categoria, si può comunque scrivere per semplicità — non è un'ottimizzazione critica).

### Output

```json
{
  "success": true,
  "summary": {
    "matchResults": { "added": 3, "skipped": 1 },
    "evaluations":  { "added": 12, "skipped": 2 },
    "awards":       { "added": 0, "skipped": 0 }
  }
}
```

Solo le categorie richieste compaiono nel summary. In caso di errore generico (es. archivio non trovato dopo il controllo iniziale, errore Redis) → 500 con `{ success:false, message }`.

## Frontend — `index.html` / `script.js`

Nel pannello dettaglio di un archivio (`_renderSeasonArchiveDetail`, già esistente e usato da "Vedi"), sotto ai contatori e prima/dopo la sezione Hall of Fame, si aggiunge — **solo se l'utente corrente è admin** — un blocco:

```
┌─ Ripristina nella stagione corrente ─────────────────┐
│ ☐ Risultati Partite (3)      ☐ Allenamenti (5)        │
│ ☐ Presenze/Valutazioni (12g) ☐ Hall of Fame (2)        │
│ ☐ Calendario Eventi (4)      ☐ Materiale (7)           │
│ ☐ RSVP Calendario (4g)                                 │
│                                                         │
│ [Ripristina selezionati]                               │
└─────────────────────────────────────────────────────────┘
```

Ogni checkbox mostra tra parentesi il conteggio già calcolato in `_renderSeasonArchiveDetail` (partite, eventi, allenamenti, giorniVal, giorniPres, awardItems.length) più il conteggio inventory (nuovo, da calcolare allo stesso modo: `(d.inventory || []).length`). Le checkbox con conteggio 0 sono disabilitate (nulla da ripristinare).

Click su "Ripristina selezionati":
1. Se nessuna checkbox selezionata → alert e stop.
2. `confirm()` di conferma esplicita, che ricorda che l'operazione aggiunge dati alla stagione corrente e non è reversibile in un click (è un'operazione di scrittura, coerente con le altre conferme già presenti per operazioni delicate come "Archivia e azzera" o l'eliminazione partite).
3. POST a `?action=season-restore` con `annataId`, `label`, `categories` (array delle checkbox selezionate).
4. Risposta: mostra un riepilogo leggibile (es. tramite `alert()` o un piccolo blocco inline, seguendo lo stile già usato altrove nella sezione Stagioni) — "Risultati Partite: 3 aggiunte, 1 già presente. Presenze: 12 aggiunte, 2 già presenti su quel giorno." per ogni categoria del summary.
5. Richiama `updateAllUI()` (o le singole `render*`/`update*` già chiamate da `loadData`) per riflettere subito i nuovi dati in tutte le viste correnti (Risultati, Grafici Presenze, Hall of Fame, Calendario, Materiale), esattamente come già avviene dopo altre operazioni di scrittura in questo file.

Il pulsante non è mostrato in `imported === true` (cioè quando si sta visualizzando un file .json importato localmente in sola lettura, non un archivio reale sul server) perché in quel caso non esiste un `label`/`annataId` server-side da cui il backend possa rileggere l'archivio.

## Casi limite

- **Categoria vuota nell'archivio** (es. nessuna partita quella stagione): checkbox disabilitata, non selezionabile.
- **Ripristino ripetuto della stessa categoria più volte**: idempotente per costruzione — la seconda volta tutto risulterà "skipped" perché gli id/date/atleti coincidono già.
- **Stagione corrente con categoria vuota `{}`**: il merge si comporta come "copia tutto", `skipped: 0`.
- **Utente non-admin che tenta la chiamata diretta all'endpoint** (bypassando la UI): bloccato dal controllo server-side `role === 'admin'`.
- **`label` valido ma non più esistente** (es. cancellato nel frattempo dalla retention automatica a 365gg): 404, frontend mostra errore e ricarica la lista archivi.
