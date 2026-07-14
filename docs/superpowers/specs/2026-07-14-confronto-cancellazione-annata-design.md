# Confronto e cancellazione dati per annata — Design

**Data:** 2026-07-14
**Sezioni coinvolte:** Risultati Partite, Valutazioni, Grafici Presenze (Conteggio Presenze Atleti)

## Contesto

L'app organizza già i dati per "annata" (stagione sportiva, tipicamente Ago-Lug): ogni annata ha le proprie chiavi Redis isolate (`annate:<annataId>:matchResults`, `annate:<annataId>:evaluations`, `annate:<annataId>:calendarResponses`, ecc.), selezionabile dal menu in alto. Il "Cambio Stagione" esistente (feature `season-restore`, deployata 2026-07-14) già offre archiviazione/ripristino massivo di 7 categorie insieme, ma è un'operazione ampia pensata per il passaggio tra stagioni intere.

Questa spec copre un bisogno diverso e più mirato: mentre si lavora nella stagione corrente, poter "richiamare" temporaneamente i dati di UNA annata passata dentro Risultati Partite, Valutazioni o Grafici Presenze — per consultarli mescolati a quelli correnti — e da lì eventualmente cancellare in blocco i dati di quella sola categoria per quella sola annata, senza toccare le altre categorie né l'annata corrente.

**Nota tecnica importante (emersa in fase di planning):** "Valutazioni" e "Conteggio Presenze Atleti" sono due sezioni UI distinte ma condividono la STESSA categoria dati lato server: `evaluations` (ogni voce di `evaluations[data][atletaId]` include sia i voti sia il campo `presenza-allenamento`; non esiste una categoria "presenze" separata — `calendarResponses`, che pure esiste, è usato solo dalla pagina calendario/RSVP separata, non da questo grafico). Su richiesta esplicita dell'utente, restano comunque **due pulsanti di cancellazione indipendenti** (uno nella sezione Valutazioni, uno nella sezione Conteggio Presenze), entrambi però operano sulla stessa chiave `evaluations` — cancellare da uno svuota anche i dati mostrati dall'altro, perché sono la stessa categoria. Questo va comunicato chiaramente nel testo di conferma di entrambi i pulsanti.

**Fuori scope per questa fase:** qualunque cambiamento ai grafici (nessuna barra/serie aggiuntiva per l'annata precedente — quello è oggetto di una spec futura separata, Fase 2).

## Obiettivo

1. In ciascuna delle 3 sezioni, un controllo "+ Aggiungi annata precedente" che permette di selezionare una o più annate passate della stessa società.
2. I dati dell'annata selezionata vengono recuperati e fusi (solo lato client, in memoria) con quelli della stagione corrente, così la lista/tabella esistente li mostra assieme, ordinati come se fossero un'unica serie di dati.
3. Quando almeno un'annata precedente è selezionata, compare un pulsante "🗑️ Cancella dati [nome annata]" per quella sezione.
4. Confermando (con conferma testuale — l'utente ridigita il nome esatto dell'annata), il backend cancella **solo** la categoria dati di quella sezione per quell'annata specifica. Le altre categorie e l'annata corrente restano intatte.
5. Solo Admin può cancellare (stesso livello di permesso di "Cambio Stagione").

## Architettura

### Frontend (`public/script.js`)

**Tre punti UI, due categorie backend:**
- Risultati Partite → categoria `matchResults`
- Valutazioni → categoria `evaluations`
- Conteggio Presenze Atleti → categoria `evaluations` (STESSA chiave di Valutazioni — vedi nota tecnica sopra)

**Componente riutilizzabile**, parametrizzato per sezione:
- `category`: `'matchResults' | 'evaluations'`
- `sectionLabel`: es. "Risultati Partite", "Valutazioni", "Conteggio Presenze Atleti" (le ultime due condividono `category: 'evaluations'` ma restano istanze indipendenti del componente, ciascuna con il proprio selettore/pulsante)
- Selettore multi-scelta popolato da `/api/annate/list` (con header `X-Auth-Session`, escludendo l'annata corrente), stile dropdown con checkbox — coerente con il pattern già usato in altre parti dell'app.

**Merge dati per annata selezionata:**
- Per ogni annata selezionata, fetch dei dati di quella categoria specifica (endpoint esistente di lettura, cambiando header `X-Annata-Id` alla chiamata), SENZA modificare `window.matchResults` / `evaluations` globali (che restano quelli della stagione corrente).
- I dati fusi vivono in una variabile locale al componente (es. `comparisonData`), usata solo per il render della lista/tabella/grafico di quella sezione. La sezione Conteggio Presenze fonde i dati `evaluations` esattamente come fa Valutazioni, poi ne estrae solo il campo `presenza-allenamento` come già fa oggi `updateAttendanceChart()`.
- Deselezionando un'annata, i suoi dati spariscono dalla vista — nessun side-effect persistito.
- Ogni riga/voce proveniente da un'annata diversa da quella corrente mostra un badge discreto col nome dell'annata (per non confonderla con i dati della stagione attiva).

**Pulsante cancellazione:**
- Visibile solo se `sessionStorage.gosport_user_role === 'admin'` E almeno un'annata è selezionata nel dropdown di quella sezione.
- Un pulsante per annata selezionata (se sono selezionate 2 annate passate, 2 pulsanti separati) — evita ambiguità su quale annata si sta cancellando.
- Click → apre modal con: nome sezione, nome annata, campo di testo con placeholder "Scrivi \"<nome annata>\" per confermare", pulsante "Cancella definitivamente" disabilitato finché il testo non corrisponde esattamente.
- **Per Valutazioni e Conteggio Presenze specificamente**, il modal mostra un banner di avviso aggiuntivo, ben visibile (es. `alert alert-warning` sopra il campo di conferma, non un testo in piccolo), con questo contenuto: "⚠️ Valutazioni e Presenze condividono gli stessi dati: cancellando qui, i dati di [annata] spariranno ANCHE dall'altra sezione (Presenze/Valutazioni)." Il pulsante "Risultati Partite" non mostra questo banner, perché `matchResults` è indipendente.
- Alla conferma: POST all'endpoint di cancellazione; in caso di successo, rimuove l'annata dal dropdown/selezione e dalla vista in ENTRAMBE le sezioni Valutazioni e Conteggio Presenze (se la categoria è `evaluations`, il frontend deve invalidare la selezione annata in entrambe le sezioni, non solo in quella da cui è partita l'azione); mostra un messaggio di conferma con il conteggio di elementi cancellati.

### Backend (`api/data.js`)

Nuova azione integrata in `api/data.js` (non un nuovo file, per il limite di 12 funzioni Vercel Hobby già documentato):

```
POST /api/data?action=wipe-annata-category
Headers: X-Auth-Session (sessione admin), X-Annata-Id (annata attiva, per il controllo punto 5)
Body: { targetAnnataId: string, category: 'matchResults'|'evaluations' }
```

Logica:
1. Richiede sessione valida e `role === 'admin'` → 403 altrimenti.
2. Valida `category` contro whitelist `['matchResults', 'evaluations']` → 400 se non valida (nessun'altra categoria è raggiungibile da questo endpoint, a differenza di `season-restore` che ne copre 7 — qui il set è deliberatamente ristretto alle 2 categorie dietro le 3 sezioni di questa spec: `evaluations` serve sia Valutazioni sia Conteggio Presenze).
3. Valida `targetAnnataId` con `isValidId()` → 400 se non valido.
4. Verifica che l'annata target appartenga alla stessa società dell'admin (stesso controllo di isolamento già usato in `annate/list.js` e `push-send`: legge `annate:list`, confronta `societyId`) → 403 se di un'altra società.
5. Verifica che `targetAnnataId` non sia l'annata correntemente attiva per la sessione (`annataId` dell'header `X-Annata-Id`) → 400 "Non puoi cancellare l'annata attiva da qui, usa Cambio Stagione" (protezione contro cancellazioni accidentali della stagione in corso).
6. Legge la chiave corrente (`annate:<targetAnnataId>:<category>`), conta gli elementi per il messaggio di riepilogo (per `matchResults`: `Object.keys(...).length`; per `evaluations`: somma degli atleti in tutte le date, `Object.values(...).reduce((sum, byAthlete) => sum + Object.keys(byAthlete || {}).length, 0)`).
7. Sovrascrive la chiave con struttura vuota (`{}` — entrambe le categorie sono oggetti keyed, non array, quindi `{}` è coerente in entrambi i casi).
8. Logga l'operazione (stesso pattern di `logRetentionPurge`: data, categoria, annataId, conteggio eliminato, admin che ha agito) su una chiave di log dedicata (es. `audit:wipe-annata-log`), per tracciabilità essendo un'azione distruttiva.
9. Risponde `{ success: true, deletedCount: N }`.

## Flusso utente (esempio: Risultati Partite)

1. Admin apre Risultati Partite, vede solo le partite della stagione corrente (comportamento invariato).
2. Clicca "+ Aggiungi annata precedente", seleziona "2023-22" dal dropdown.
3. La tabella si aggiorna mostrando le partite di 2023-22 mescolate a quelle correnti, ciascuna con un badge "2023-22" per distinguerle.
4. Compare il pulsante "🗑️ Cancella dati 2023-22 da Risultati Partite".
5. Click → modal: "Stai per cancellare TUTTI i Risultati Partite dell'annata 2023-22. Azione irreversibile. Scrivi \"2023-22\" per confermare".
6. Admin digita "2023-22", il pulsante si abilita, conferma.
7. Backend cancella `annate:2023-22:matchResults`, risponde con conteggio.
8. Frontend mostra "✅ 14 partite eliminate da 2023-22", rimuove l'annata dalla vista, torna a mostrare solo la stagione corrente.

## Testing

Nessuna test-suite automatizzata nel repo (pattern consolidato in questo progetto — vedi feature "Cambio Stagione" e "Restore archivio", verificate con script Node isolati). Per questa feature:
- Script Node isolato che simula `wipe-annata-category` con mock KV: verifica whitelist categoria, isolamento società, blocco su annata attiva, conteggio corretto, chiave svuotata correttamente per ciascuna delle 2 categorie (`matchResults`, `evaluations`).
- Verifica manuale in ambiente reale (Playwright non praticabile per lo stesso motivo già documentato in "Restore archivio": bootstrap completo con auth reale non riproducibile senza backend Redis vero) — l'utente testerà il flusso end-to-end dopo il deploy.

## Domande aperte per la fase di planning

Nessuna: tutte le decisioni chiave (ambito cancellazione, permessi, conferma, categorie coinvolte, comportamento del merge) sono state fissate durante il brainstorming.
