# Cronografo Circuiti — Reset e Modalità Gruppo — Design

**Data:** 2026-08-28
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

Il Cronografo Circuiti (`public/cronografo.html`) permette oggi di cronometrare un
circuito per **un atleta alla volta**: si avvia il cronometro, si segnano lap generici
con il bottone "🏁 Lap", si ferma, si assegna il tempo totale a un atleta scelto da un
select, e si ripete per l'atleta successivo (con `resetTimerKeepCircuit()` implicito
dopo ogni assegnazione).

Due mancanze emerse nell'uso reale:

1. **Manca un Reset esplicito**: non c'è modo di azzerare il cronometro a metà corsa
   se si sbaglia il via, senza dover fermarlo e scartare l'assegnazione.
2. **Nessun supporto per gruppi che corrono insieme**: quando più atleti fanno lo
   stesso circuito ad anello contemporaneamente (es. giri di pista), oggi bisognerebbe
   cronometrare ogni atleta separatamente. Serve invece **un solo cronometro per tutto
   il gruppo**, con la possibilità di segnare il passaggio di ogni atleta ad ogni giro.

## Scenario d'uso (Modalità Gruppo)

Un gruppo di atleti (tutta la rosa dell'annata, tipicamente 15-25+) parte insieme su
un percorso ad anello. L'allenatore avvia un solo cronometro. Ad ogni giro completato,
un atleta passa dal traguardo e l'allenatore tocca il suo nome in una lista: viene
registrato il **tempo del suo giro** (parziale, cioè la differenza tra il passaggio
attuale e il suo passaggio precedente — o dal via, se è il primo). Lo stesso atleta può
essere toccato più volte nella stessa sessione, una volta per ogni giro che completa.

## 1. Reset del cronometro

- Nuovo pulsante **↺ Reset** nella riga dei controlli, accanto a Start/Lap/Stop.
- Abilitato quando il cronometro è in corsa o è fermo con un tempo diverso da zero
  (cioè in ogni stato tranne "pronto, mai avviato" a 00:00.00).
- Effetto: azzera il cronometro (`lastElapsed = 0`, display `00:00.00`), svuota
  `lapMarks` e la lista lap visualizzata, riabilita il campo nome circuito, riporta lo
  stato dei controlli allo stato "pronto" (Start abilitato, Lap/Stop/Reset disabilitati).
- In Modalità Gruppo, azzera anche i contatori-giro per atleta della sessione **in
  corso non ancora toccata** — ma **non tocca `sessionList`**: i tempi già assegnati o
  già registrati in attesa di salvataggio restano intatti e visibili nella card
  "Sessione corrente".
- Non richiede conferma (azione a basso rischio, non tocca dati salvati o già in
  `sessionList`).

## 2. Modalità Gruppo

### Selettore di modalità

Un toggle a due opzioni sopra il cronometro, stile identico ai tab "Storico" già
esistenti (`.cr-tab`/`.cr-tab.active`):

```text
[ Individuale ]  [ Gruppo ]
```

- **Individuale** (default, comportamento invariato): select singolo "Assegna a" +
  bottone "+ Aggiungi alla lista" + bottone "🏁 Lap" generico, esattamente come oggi.
- **Gruppo**: il bottone "🏁 Lap" generico e il blocco "Assegna a" (select + bottone)
  spariscono. Al loro posto compare il pannello atleti (sotto).

Il cambio di modalità è permesso solo quando il cronometro **non è in corsa** (per
evitare di perdere lo stato di lap/parziali a metà sessione). Se si tenta di cambiare
modalità mentre il cronometro gira, mostrare un toast e ignorare il cambio.

### Pannello atleti (solo Modalità Gruppo)

- Un campo di testo **"Cerca atleta…"** fisso sopra la lista, filtra live (case
  insensitive, substring match sul nome) mentre si digita.
- Sotto, una lista scorrevole (stile simile a `.cr-laps`, ma righe cliccabili) con
  **tutti gli atleti dell'annata** (stesso elenco di `ATHLETES` usato altrove), una
  riga per atleta, in ordine alfabetico:
  - Testo riga: `Nome atleta — N giri · ultimo Xs` (es. `Mario Rossi — 3 giri · ultimo 42.10s`)
    oppure `Nome atleta — nessun giro` se N=0.
  - Riga con sfondo leggermente verde tenue (variante di `--accent`, es.
    `rgba(74, 222, 128, 0.08)`) quando N≥1, per colpo d'occhio rapido su chi è già
    partito/passato almeno una volta.
- Le righe sono toccabili (cliccabili) **solo quando il cronometro è in corsa**
  (`running === true`); a cronometro fermo la lista resta visibile ma non interattiva
  (righe con `pointer-events: none` e opacità ridotta), per coerenza con "Lap" che oggi
  è disabilitato a cronometro fermo.

### Registrazione di un passaggio (tocco su un atleta)

Al tocco su un atleta mentre il cronometro è in corsa:

1. Calcola `elapsed = (Date.now() - timerStart) / 1000` (tempo assoluto dal via,
   come già fa `lapTimer()`).
2. Recupera l'ultimo tempo assoluto registrato **per quello specifico atleta** in
   questa sessione di gruppo (mappa in memoria `groupLastMark[athleteId]`, non
   condivisa con gli altri atleti — a differenza di `lapMarks` che oggi è unico e
   globale). Se non esiste ancora, il riferimento è 0 (dal via).
3. `tempoGiro = elapsed - groupLastMark[athleteId] (o 0)`, arrotondato a 2 decimali
   come già fa il codice esistente (`Math.round(x * 100) / 100`).
4. Aggiorna `groupLastMark[athleteId] = elapsed`.
5. Aggiunge una entry a `sessionList`: stessa struttura dati usata oggi in modalità
   Individuale — `{ athleteId, athleteName, circuito, tempoTotale, laps: [] }` — dove
   `tempoTotale` è il `tempoGiro` appena calcolato. Campo `laps` vuoto (i giri di
   gruppo non hanno frazionamenti interni propri; ogni giro È già un "lap" a sé).
6. Ri-renderizza sia la card "Sessione corrente" (`renderSessionList()`, invariata)
   sia il pannello atleti (per aggiornare contatore giri/ultimo tempo/evidenziazione
   di quell'atleta).
7. Nessun toast per ogni tocco (il gruppo può generare decine di tocchi in pochi
   minuti; un toast per ognuno sarebbe rumore) — il feedback visivo è
   l'aggiornamento immediato della riga atleta e della card sessione.

Lo stesso atleta può quindi comparire **più volte** in `sessionList` durante una
sessione di gruppo — una riga per ogni giro completato. La card "Sessione corrente"
esistente già supporta questo senza modifiche (itera su `sessionList` con `.map`,
non deduplica per atleta).

### Stop e Reset in Modalità Gruppo

- **Stop**: ferma il cronometro come oggi. A differenza della modalità Individuale,
  non serve più nessuna azione di "assegna" successiva: i tempi sono già tutti in
  `sessionList` (accumulati tocco dopo tocco). Poiché in modalità Individuale è
  proprio l'assegnazione (`resetTimerKeepCircuit()`) a riabilitare il campo
  circuito dopo lo Stop, e in modalità Gruppo quel passo non esiste, **lo Stop
  stesso deve riabilitare il campo circuito quando si è in modalità Gruppo**
  (mentre in modalità Individuale lo Stop continua a lasciarlo disabilitato fino
  all'assegnazione, comportamento invariato).
- **Reset**: come da sezione 1, azzera anche `groupLastMark` (la mappa
  atleta→ultimo-tempo-assoluto), cosicché il prossimo giro dopo un reset ripre a
  contare da zero per tutti.

### Salvataggio (`saveSession`)

Il salvataggio in `circuitTimes` non cambia: ogni entry di `sessionList` (una per
ogni giro/atleta) diventa una entry separata in `circuitTimes[athleteId]`, con il
proprio `id`, `date`, `circuito`, `tempoTotale`, `laps: []` — lo storico resta
completo e granulare, un giro = una entry, esattamente come farebbe oggi con N
sessioni Individuale separate.

**Collegamento a `gpsData` (`tempo_circuito_totale_s`)**: quando più entry della
stessa sessione appartengono allo stesso atleta (caso Gruppo), si usa il **minor
tempo tra i suoi giri** ("miglior giro") come valore scritto in
`gpsData[athleteId][today][0].tempo_circuito_totale_s` — coerente con l'uso di
questo campo come indicatore di performance del circuito. La logica in `saveSession`
va quindi aggiornata da "un'unica entry per atleta" a "raggruppa le entry di
`sessionList` per `athleteId`, prendi il minimo di `tempoTotale` nel gruppo" prima di
scrivere in `gpsData`. Il resto della logica (crea se assente, ricalcola
`velocita_circuito` se `distanza_circuito` presente) resta invariato, applicato al
minimo così calcolato.

## Cosa NON cambia

- Modalità Individuale: nessuna modifica di comportamento.
- Struttura dati di `circuitTimes` e `gpsData`: nessuna modifica di schema, solo più
  entry per la stessa data/atleta quando si usa la modalità Gruppo.
- Viste Storico "Per atleta" e "Confronto squadra": nessuna modifica — già
  funzionano correttamente con N entry per atleta/data/circuito (vedi
  `latestEntryForAthleteDate` che già gestisce più entry per giorno prendendo la più
  recente per timestamp; qui si aggiungerà semplicemente più densità di dati, non un
  caso nuovo da gestire).
- Nessun nuovo file `.js` in `api/` (vincolo Vercel Hobby, 12 funzioni serverless
  già sature) — nessuna modifica lato server necessaria: tutto il lavoro è nel
  client `cronografo.html`, il payload POST a `/api/data` resta identico nella forma
  (`{ circuitTimes, gpsData }`).

## Edge case

- **Tocco doppio accidentale sullo stesso atleta in rapida successione**: registra
  comunque un giro con tempo molto piccolo (es. 0.3s) — non c'è deduplica automatica,
  ma l'entry resta modificabile/rimuovibile dalla card "Sessione corrente" (bottoni
  ✏️/🗑️ già esistenti) prima del salvataggio.
- **Reset a cronometro mai avviato** (00:00.00, stato "pronto"): il bottone Reset è
  disabilitato, nessuna azione.
- **Cambio circuito a metà sessione di gruppo**: non permesso mentre `running`, come
  già oggi il campo circuito si disabilita durante la corsa (`cr-circuito.disabled =
  true` in `startTimer()`).
- **Nessun atleta nella ricerca** (`Cerca atleta…` non trova corrispondenze): la
  lista mostra un messaggio vuoto tipo "Nessun atleta trovato", coerente con lo stile
  `.cr-empty` già usato altrove.
