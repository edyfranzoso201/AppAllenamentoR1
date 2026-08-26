# Ricorrenza sessioni + Ora Fine — Design

## Contesto

Il modal "Pianifica Sessione" nel Calendario (`sessionModal` / `session-form`, generato come stringa HTML in `public/script.js` riga 261) permette oggi di creare **una sola sessione per volta**: Data, Tipo Attività, Titolo/Tipo, Nota breve, Ora Inizio, Luogo, Obiettivi, Descrizione, checkbox "Copia anche nel Calendario Squadra".

Le sessioni sono salvate in `trainingSessions[dateStr]` (oggetto chiavato per data ISO, valore = array di sessioni di quel giorno — un giorno può già contenere più sessioni). `openSessionModal(sessionData)` (script.js:2632) apre il modal in creazione (vuoto) o modifica (precompilato). Il submit handler (script.js:4415-4488) legge tutti i campi, costruisce l'oggetto sessione e lo inserisce/aggiorna in `trainingSessions`.

Esiste già, per un caso d'uso diverso (Pacchetto Individual in Gestione Atleta), un pattern di generazione ricorrente collaudato: `pianificaIndividualCalendario` (script.js:1414-1495). Itera giorno per giorno tra una data di inizio e una data di fine, filtra le date che cadono nei giorni della settimana selezionati (checkbox `ind-day-*`, valori 0=Domenica…6=Sabato), e per ciascuna data genera una sessione indipendente inserita in `trainingSessions`.

Questa spec copre due richieste distinte ma correlate (stesso modal):

1. Aggiungere un campo **Ora Fine** alla sessione.
2. Permettere di generare **più sessioni ricorrenti** (es. ogni Martedì e Giovedì, stessa ora, stesso tipo, su un range di più mesi) da un solo invio del modal, riusando il pattern già esistente.

## 1. Campo Ora Fine

- Nuovo input `session-end-time` (`type="time"`), opzionale, aggiunto nella riga che oggi contiene Ora Inizio + Luogo. La riga passa da 2 a 3 colonne: **Ora Inizio | Ora Fine | Luogo**.
- Salvato come `sessionData.endTime` nell'oggetto sessione, accanto a `time` (che resta l'ora inizio, invariato).
- `openSessionModal` precompila `session-end-time` da `sessionData.endTime || ''` quando in modifica; lo resetta (vuoto) in creazione, come già fa per gli altri campi.
- Visualizzazione: dove il calendario/dettaglio sessione mostra oggi l'orario (`sessionData.time`), se `endTime` è presente si mostra come intervallo `"HH:MM – HH:MM"`; se assente, solo `"HH:MM"` come oggi (nessuna modifica per le sessioni esistenti prive del campo).
- **Solo informativo**: nessun calcolo di durata, nessuna propagazione verso Presenze/GPS/report in questa iterazione. Retrocompatibile al 100% — le sessioni salvate prima di questa modifica non hanno `endTime` e continuano a funzionare invariate.

## 2. Ricorrenza (giorni multipli su range di date)

### UI

Nel modal, subito sotto il campo Data, un nuovo checkbox **"🔁 Ricorrenza"** (`session-recurring`, non spuntato di default → comportamento identico a oggi per chi non lo usa).

Quando spuntato, tramite mostra/nascondi (stesso approccio già usato per `rientro-field` in `athlete-form`):
- Il campo "Data" esistente (`session-date`) viene rietichettato concettualmente come **data di inizio** (label invariata "Data" va bene, il contesto lo chiarisce).
- Appare un nuovo campo data **"Fino al"** (`session-recurring-until`).
- Appare un selettore giorni della settimana Lun–Dom, stesso markup a pillole/checkbox inline già usato in `#ind-days-selector` (7 checkbox `session-day-0`…`session-day-6`, valori 0=Domenica…6=Sabato per coerenza con `getDay()` e con l'implementazione Individual esistente).

Quando la ricorrenza è spuntata, l'etichetta del bottone submit cambia da "Salva Sessione" a **"Genera Sessioni"**.

Tutti gli altri campi del form (Tipo Attività, Titolo, Nota breve, Ora Inizio, Ora Fine, Luogo, Obiettivi, Descrizione, checkbox sync Calendario Squadra) restano gli stessi già esistenti e si applicano identici a ogni sessione generata.

La modifica (`openSessionModal` in edit) di una singola sessione già generata **non mostra mai la ricorrenza**: si comporta come oggi, editing di una singola sessione indipendente (vedi sotto "Indipendenza delle sessioni generate").

### Validazione e conferma

Al submit, se `session-recurring` è spuntato:
- Richiede: data inizio (`session-date`), data fine (`session-recurring-until`), almeno un giorno della settimana selezionato. Se manca uno di questi, alert bloccante — stesso stile di errore già usato in `pianificaIndividualCalendario` ("⚠️ Configura: ...").
- Se `session-recurring-until` precede `session-date`, stesso alert di errore (range non valido).
- Calcola in anteprima il numero di date risultanti (stesso ciclo di generazione, vedi sotto) e mostra un `confirm()` riepilogativo prima di procedere, es.:
  > "Verranno create 12 sessioni dal 02/09/2026 al 30/10/2026, ogni Martedì e Giovedì alle 18:00. Procedere?"
  
  Se l'utente annulla, il modal resta aperto senza modifiche (nessuna sessione creata).

### Generazione

Riusa la stessa logica di `pianificaIndividualCalendario` (righe 1438-1448: ciclo giorno-per-giorno con `Date` locali, confronto `getDay()` con l'array giorni selezionati), estratta in una funzione condivisa (vedi sezione Architettura) e applicata ai campi generici del modal invece che ai dati del pacchetto Individual.

Per ciascuna data risultante dal range:
- Genera un id univoco (`Date.now() + '_' + indice` per evitare collisioni quando più sessioni sono create nello stesso istante).
- Costruisce l'oggetto sessione con Tipo, Titolo, Nota, Ora Inizio, Ora Fine, Luogo, Obiettivi, Descrizione — identici per tutte le occorrenze, cambia solo `date`.
- **Aggiunge sempre in coda** all'array `trainingSessions[dateStr]` esistente per quella data, **senza mai sostituire o controllare sessioni già presenti** in quel giorno (decisione esplicita: niente prompt di conflitto per singola data, coerente col fatto che il calendario già supporta più sessioni per giorno).
- Se la checkbox "Copia anche nel Calendario Squadra" è spuntata, applica per ciascuna data generata lo stesso comportamento di sync già esistente nel submit handler attuale (incluso l'alert di conferma sostituzione se in quella data esiste già un evento in `calendarEvents` — comportamento invariato, solo eseguito in loop).

### Indipendenza delle sessioni generate

Le sessioni create dalla ricorrenza **non restano collegate tra loro in alcun modo**: nessun id di gruppo, nessun campo "serie". Una volta generate, ciascuna si apre/modifica/elimina singolarmente da calendario esattamente come qualunque altra sessione (o come le sessioni Individual esistenti oggi). Se una data va rimossa (es. festività), si elimina quella singola occorrenza dal calendario — non è previsto (in questa iterazione) un editing o cancellazione "di gruppo".

## Fuori ambito (YAGNI, per iterazioni future se richiesto)

- Editing o cancellazione in blocco di una serie ricorrente (richiederebbe un id di gruppo e UI dedicata).
- Esclusione manuale di date specifiche dentro il range prima della generazione (es. "salta le festività") — si gestisce post-hoc eliminando la singola occorrenza.
- Calcolo automatico di durata/minutaggio da Ora Fine, o sua propagazione a Presenze/GPS/report.
- Ricorrenze diverse da "giorni della settimana su range di date" (es. "ogni 2 settimane", "ultimo venerdì del mese").

## Architettura

Nessun nuovo file. Modifiche in `public/script.js`:

1. **Markup del modal** (stringa HTML, script.js:261, blocco `#sessionModal`): aggiunta del campo Ora Fine nella riga esistente; aggiunta del blocco ricorrenza (checkbox + data fine + selettore giorni), nascosto di default via CSS inline (`style="display:none;"`) e mostrato via un handler `change` sul checkbox `session-recurring`, stesso pattern già usato per `rientro-field` in `athlete-form`.
2. **`openSessionModal`** (script.js:2632): reset esplicito dei nuovi campi (`session-end-time`, `session-recurring`, `session-recurring-until`, checkbox giorni) e del blocco ricorrenza nascosto, sia in creazione che in modifica — una sessione in modifica non mostra mai la ricorrenza.
3. **Estrazione di una funzione condivisa** `generateRecurringDates(startDate, untilDate, weekDays)` che isola il ciclo di generazione date oggi duplicato solo in `pianificaIndividualCalendario` — usata da entrambi i flussi (Individual e Pianifica Sessione) per evitare doppia manutenzione della stessa logica.
4. **Submit handler** (script.js:4415-4488): branch iniziale su `session-recurring` spuntato o no.
   - Non spuntato: comportamento **invariato** rispetto a oggi (crea/aggiorna una singola sessione), con l'aggiunta del campo `endTime` nell'oggetto salvato.
   - Spuntato: valida, mostra il `confirm()` riepilogativo, poi cicla su `generateRecurringDates(...)` generando e inserendo una sessione per data come descritto sopra.

## Compatibilità

- Sessioni esistenti senza `endTime`: nessuna migrazione necessaria, il campo è opzionale e la sua assenza è già il comportamento previsto.
- Nessuna modifica a `trainingSessions`, `calendarEvents`, o ad altri moduli (Presenze, GPS, report, cambio stagione, backup): la forma dei dati resta la stessa (array di sessioni per data), solo con un campo opzionale in più e più elementi generati in un solo submit.
