# Filtro e cancellazione dati per stagione calcistica — Design

**Data:** 2026-07-14
**Sezioni coinvolte:** Risultati Partite, Valutazioni, Conteggio Presenze Atleti

## Contesto

Questa spec **sostituisce** `docs/superpowers/specs/2026-07-14-confronto-cancellazione-annata-design.md` e il relativo piano `docs/superpowers/plans/2026-07-14-confronto-cancellazione-annata.md`, entrambi basati su un modello errato: confondevano la "stagione calcistica" (periodo Ago-Lug) con l'"annata-squadra" (entità del sistema multi-annata dell'app, es. "2012", "2013" — ogni annata-squadra ha le proprie chiavi Redis isolate `annate:<annataId>:matchResults`, ecc., selezionabile dal menu in alto).

Il bisogno reale dell'utente è diverso: **dentro una singola annata-squadra**, i record di Risultati Partite, Valutazioni e Conteggio Presenze si accumulano nel tempo con le loro date reali. L'utente vuole:
1. Vedere di default solo i dati della stagione calcistica corrente (01 Agosto–31 Luglio).
2. Poter aggiungere al confronto una o più stagioni calcistiche passate (per data reale del record), per consultarle affiancate a quelle correnti.
3. Poter cancellare in blocco tutti i dati di una stagione passata (mai quella corrente), per sezione.

**Vincolo esplicito e non negoziabile** (dal brainstorming): non si mescolano mai dati fra annate-squadra diverse. Tutto il filtro e la cancellazione per stagione operano esclusivamente dentro l'annata-squadra attualmente selezionata in sessione. La stagione calcistica è calcolata dalla data reale del record, mai da un campo "stagione" salvato esplicitamente, mai dall'id dell'annata-squadra.

**Nota tecnica importante (riconfermata da spec precedente):** "Valutazioni" e "Conteggio Presenze Atleti" sono due sezioni UI distinte ma condividono la STESSA categoria dati lato server: `evaluations` (ogni voce di `evaluations[data][atletaId]` include sia i voti sia il campo `presenza-allenamento`). `matchResults` è invece una categoria indipendente. Cancellare una stagione da Valutazioni cancella automaticamente gli stessi dati anche da Conteggio Presenze, e viceversa — questo va comunicato chiaramente nel modal di conferma di entrambe.

**Relazione con "Restore Archivio Stagione"** (feature esistente, deployata 2026-07-14): nessuna gestione speciale necessaria. I record ripristinati dall'archivio mantengono la loro data reale originale, quindi ricadono automaticamente nel bucket di stagione corretto per effetto del calcolo data-based — non serve alcuna integrazione esplicita fra le due feature.

## Obiettivo

1. In ciascuna delle 3 sezioni, la vista di default mostra solo i record della stagione calcistica corrente (01 Ago–31 Lug, calcolata da oggi).
2. Un widget "+ Confronta stagione precedente" permette di aggiungere una o più stagioni calcistiche passate (trovate nei dati già caricati per l'annata attiva) alla vista, mostrandole affiancate a quella corrente con un badge identificativo.
3. Quando almeno una stagione passata è selezionata, compare un pulsante "🗑️ Cancella dati stagione [nome]" per sezione/stagione.
4. Confermando (con conferma testuale — l'utente ridigita il nome esatto della stagione), il backend cancella **solo** le entry di quella categoria dati la cui data reale ricade in quella stagione, dentro l'annata attiva. Le altre stagioni nella stessa chiave, le altre categorie, e le altre annate-squadra restano intatte. La stagione corrente non è mai cancellabile da questo flusso.
5. Solo Admin può cancellare.
6. Nei grafici di Valutazioni (`dailyTeamChart`, `monthlyComparisonChart`) e Presenze (`attendanceChart`), ogni stagione passata selezionata nel confronto appare come dataset/serie aggiuntiva e distinta, non fusa con quella corrente.

## Architettura

### Calcolo stagione (condiviso frontend + backend)

Funzione pura, replicata identica in `public/script.js` e `api/data.js` (nessun modulo condiviso esiste oggi fra client e serverless functions in questo progetto, quindi si duplica la funzione — è ~5 righe, rischio di divergenza basso e coerente con lo stile del progetto):

```js
function seasonOfDate(isoDate) { // "2026-03-15" -> "2025-26"
    const [y, m] = isoDate.split('-').map(Number);
    const startYear = m >= 8 ? y : y - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}
function currentSeasonKey() {
    return seasonOfDate(toLocalDateISO(new Date())); // lato server: new Date().toISOString().slice(0,10)
}
```

Campo data usato per calcolare la stagione, per categoria:
- `matchResults` → campo data della partita già presente su ogni record.
- `evaluations` → la chiave `data` di `evaluations[data]` (formato `YYYY-MM-DD`).

### Frontend (`public/script.js`)

**Vista di default**: ogni sezione filtra i dati già in memoria (`matchResults`, `evaluations`) tenendo solo i record con `seasonOfDate(...) === currentSeasonKey()`. Nessuna nuova chiamata di rete per la vista di default — i dati dell'annata attiva sono già tutti caricati.

**Widget "Confronta stagione precedente"** (riusa lo scheletro DOM già esistente `risultati-annata-compare-bar` / `valutazioni-annata-compare-bar` / `presenze-annata-compare-bar`, cambiandone semantica e contenuto — non più selezione di un'altra annata-squadra, ma di stagioni calcistiche passate dentro l'annata attiva):
- Etichetta fissa con la stagione corrente (es. "Stagione 2025-26").
- Pulsante "+ Confronta stagione precedente" → dropdown con checkbox, una voce per ogni stagione distinta presente nei dati e diversa da quella corrente: `[...new Set(Object.keys(evaluations).map(seasonOfDate))].filter(s => s !== currentSeasonKey()).sort().reverse()` (analogo per `matchResults`, usando il campo data partita). Se l'insieme è vuoto, il pulsante resta nascosto.
- Selezionando una o più stagioni: la lista/tabella della sezione mostra anche quei record, ciascuno con badge testuale della propria stagione (stile badge discreto, coerente col pattern già usato nel widget precedente).
- Deselezionando: i record di quella stagione spariscono dalla vista. Nessun dato persistito — puro stato locale del componente (variabile in memoria, non `localStorage`, si resetta a ricaricamento pagina).
- Il Conteggio Presenze fonde `evaluations` esattamente come fa Valutazioni, poi estrae solo `presenza-allenamento` come già fa oggi `updateAttendanceChart()`.

**Pulsante cancellazione**:
- Visibile solo se `sessionStorage.gosport_user_role === 'admin'` E almeno una stagione passata è selezionata nel widget di quella sezione.
- Un pulsante per stagione selezionata (se 2 stagioni passate sono selezionate, 2 pulsanti separati).
- Click → modal con: nome sezione, nome stagione, conteggio elementi coinvolti (calcolato client-side filtrando i record già in memoria per quella stagione), campo di testo con placeholder "Scrivi \"2023-24\" per confermare", pulsante "Cancella definitivamente" disabilitato finché il testo non corrisponde esattamente.
- **Per Valutazioni e Conteggio Presenze specificamente**, banner aggiuntivo `alert alert-warning` sopra il campo di conferma: "⚠️ Valutazioni e Presenze condividono gli stessi dati: cancellando qui, i dati della stagione [X] spariranno ANCHE dall'altra sezione (Presenze/Valutazioni)." Il pulsante di Risultati Partite non mostra questo banner (`matchResults` è indipendente).
- Alla conferma: POST all'endpoint di cancellazione; in caso di successo, rimuove la stagione dalla selezione/vista in ENTRAMBE Valutazioni e Conteggio Presenze se la categoria è `evaluations` (invalidazione crociata, stesso principio della spec precedente); mostra messaggio con conteggio elementi cancellati; aggiorna eventuali grafici aperti rimuovendo il relativo dataset.

**Grafici** (`updateEvaluationCharts` per `dailyTeamChart` e `monthlyComparisonChart`; `updateAttendanceChart` per `attendanceChart`):
- Le funzioni esistenti vengono estese per iterare su un array `[stagione corrente, ...stagioni passate selezionate nel widget]` invece di operare implicitamente solo sulla stagione corrente.
- Per ciascuna stagione dell'array, si costruisce un dataset separato, filtrando le entry di `evaluations` per `seasonOfDate(data) === quellaStagione` (oltre al filtro di periodo già esistente — giorno/settimana/mese/ecc. — applicato in modo relativo, es. "ultimi 7 giorni disponibili in quella stagione" invece di date assolute, per restare confrontabile con la stagione corrente).
- `dailyTeamChart` (tipo `line`): un dataset per stagione, colori distinti (verde per la corrente, palette neutra per le passate), `label` include il nome stagione.
- `monthlyComparisonChart` (tipo `bar` orizzontale): un dataset per stagione; Chart.js raggruppa automaticamente le barre per label (nome atleta) quando ci sono più dataset, ottenendo il confronto affiancato senza logica aggiuntiva.
- `attendanceChart`: stessa logica, dataset aggiuntivo per stagione passata selezionata.
- Deselezionando una stagione dal widget, la funzione di update rispettiva viene richiamata e il dataset relativo scompare (comportamento reattivo, pattern già presente per gli altri toggle di periodo).

### Backend (`api/data.js`)

Nuova azione integrata in `api/data.js` (nessun nuovo file, per il limite di 12 funzioni Vercel Hobby già documentato in questo progetto):

```
POST /api/data?action=wipe-season
Headers: X-Auth-Session (sessione admin), X-Annata-Id (annata attiva)
Body: { category: 'matchResults'|'evaluations', seasonKey: string }
```

Logica:
1. Richiede sessione valida e `role === 'admin'` → 403 altrimenti.
2. Valida `category` contro whitelist `['matchResults', 'evaluations']` → 400 se non valida.
3. Valida `seasonKey` con regex `^\d{4}-\d{2}$` → 400 se malformata.
4. Calcola `currentSeasonKey()` lato server (data odierna) e rifiuta se `seasonKey === currentSeasonKey()` → 400 "Non puoi cancellare la stagione corrente".
5. Legge la chiave corrente dell'annata attiva (`annate:<annataId>:<category>`).
6. Per ciascuna entry, calcola `seasonOfDate()` sul campo data pertinente (data partita per `matchResults`, chiave data per `evaluations`) e **rimuove solo le entry la cui stagione calcolata combacia con `seasonKey`** — le entry di altre stagioni nella stessa chiave restano intatte (differenza chiave rispetto al vecchio modello, dove l'intera chiave apparteneva a una sola annata-squadra e poteva essere svuotata per intero).
7. Conta gli elementi eliminati (per `matchResults`: numero di partite rimosse; per `evaluations`: somma degli atleti rimossi in tutte le date rimosse).
8. Scrive la chiave aggiornata (con le entry filtrate rimosse).
9. Logga l'operazione su `audit:wipe-season-log` (data operazione, categoria, seasonKey, annataId, admin che ha agito, conteggio eliminato) — stesso pattern di audit logging già usato per altre azioni distruttive nel progetto (es. `logRetentionPurge`).
10. Risponde `{ success: true, deletedCount: N }`.

Isolamento fra annate-squadra: non serve un controllo esplicito di "società/annata target" come nella spec precedente, perché questa azione non accetta più un `targetAnnataId` arbitrario — opera sempre e solo sull'annata già attiva nella sessione (header `X-Annata-Id`, già validata dal middleware di sessione esistente).

## Flusso utente (esempio: Valutazioni)

1. Admin apre Valutazioni, vede di default solo le valutazioni della stagione 2025-26 (comportamento invariato rispetto a "tutti i dati", ma ora filtrato).
2. Clicca "+ Confronta stagione precedente", seleziona "2023-24" dal dropdown (stagione calcolata dai dati esistenti, non da una lista di annate-squadra).
3. La vista si aggiorna mostrando anche le valutazioni con data ricadente nel 2023-24, ciascuna con badge "2023-24".
4. Compare il pulsante "🗑️ Cancella dati stagione 2023-24" sotto Valutazioni.
5. Click → modal: banner di avviso condivisione con Presenze, conteggio "42 valutazioni coinvolte", campo "Scrivi \"2023-24\" per confermare".
6. Admin digita "2023-24", il pulsante si abilita, conferma.
7. Backend rimuove da `annate:<id>:evaluations` solo le date che ricadono in Ago 2023–Lug 2024, risponde con conteggio.
8. Frontend mostra "✅ 42 valutazioni eliminate dalla stagione 2023-24", rimuove la stagione dalla vista e dal widget sia in Valutazioni sia in Conteggio Presenze, aggiorna i grafici togliendo il relativo dataset.

## Error handling

- Nessuna stagione passata trovata nei dati → pulsante "+ Confronta stagione precedente" nascosto.
- Tentativo di cancellare la stagione corrente (anche via chiamata diretta bypassando l'UI) → 400 dal backend.
- `seasonKey` malformata o `category` non in whitelist → 400.
- Utente non admin → 403 dal backend; pulsante cancellazione comunque nascosto lato client.
- Annata-squadra: nessun controllo di isolamento aggiuntivo necessario — l'azione opera sempre sull'annata già attiva e autenticata in sessione, mai su un id arbitrario passato dal client.
- Race condition fra due admin che cancellano la stessa stagione in parallelo → non gestita esplicitamente (stesso livello delle altre azioni distruttive esistenti come `season-restore`); l'ultima scrittura vince, rischio accettato coerente col resto dell'app.

## Testing

Nessuna test-suite automatizzata nel repo (pattern consolidato — vedi "Cambio Stagione" e "Restore archivio", verificate con script Node isolati). Per questa feature:
- Script Node isolato che simula `wipe-season` con mock KV: verifica whitelist categoria, formato `seasonKey`, blocco su stagione corrente, calcolo `seasonOfDate` sui casi di confine (31 luglio vs 1 agosto), conteggio corretto, che solo le entry della stagione target vengano rimosse e le altre stagioni nella stessa chiave restino intatte.
- Verifica manuale in ambiente reale post-deploy (Playwright non praticabile per lo stesso motivo già documentato in "Restore archivio": bootstrap completo con auth reale non riproducibile senza backend Redis vero) — l'utente testerà il flusso end-to-end.

## Domande aperte per la fase di planning

Nessuna: tutte le decisioni chiave (ambito, vista di default, filtro multi-stagione, permessi, conferma, banner condivisione dati, comportamento grafici, relazione con l'archivio) sono state fissate durante il brainstorming.
