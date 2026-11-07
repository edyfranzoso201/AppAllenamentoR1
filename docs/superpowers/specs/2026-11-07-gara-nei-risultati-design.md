# Dati di Andamento Gara nei Risultati — Design

Data: 2026-11-07 · Stato: approvato dall'utente, da pianificare

## Obiettivo

Portare i dati raccolti in **Andamento Gara** (`public/gara/index.html`) dentro la
singola partita di **Risultati** (`public/script.js`, pannello "Modifica Risultato
Partita", `#matchResultModal`): punteggio, gol, cartellini, convocati, titolari,
sostituzioni e minutaggio. Oggi la gara vive solo nel `localStorage` del telefono
e "Azzera la gara" la cancella: il salvataggio in Risultati è anche il modo di
metterla al sicuro.

## Decisioni prese

| # | Domanda | Scelta |
|---|---------|--------|
| 1 | Partita in Risultati con dati già inseriti a mano | La gara **sovrascrive** punteggio, marcatori e cartellini dopo una **conferma con le differenze**; in Risultati resta sempre possibile correggere a mano |
| 2 | Dove si vedono i dettagli | Nel pannello **Modifica Risultato Partita**, in tre sezioni chiudibili (Formazione, Sostituzioni/Tabellino, Minutaggio) |
| 3 | Modificabilità | Formazione e sostituzioni **modificabili**; minutaggio **sempre calcolato** |
| 4 | Tendina avversario | In **Andamento Gara → Dati gara**, "Prendi dal calendario" come in Convocazioni |
| 5 | Gara fuori calendario | Cerca partita con stessa data+avversario; altrimenti propone di **crearla** come nuova partita (conta come le altre in classifiche e grafici) |

## 1. Andamento Gara → Dati gara: "Prendi dal calendario"

- Tendina in cima a Dati gara con le partite dell'annata (da `matchResults` /
  `calendarEvents` già nella risposta di `GET /api/data` che `caricaRosa()` legge).
  Stesso formato visivo di Convocazioni: `dom 08/11 · 17:00 · 🏠/✈️ Avversario`.
- Scegliendo una partita: compila `info.ospite`, `info.data`, `info.ora`,
  `info.luogo`, `info.noiCasa`, e salva `info.matchId` (persistito con il resto
  dello stato in `salvaStato()`).
- I campi restano editabili a mano. Modificare data o avversario a mano **non**
  scollega la partita, ma la tendina mostra a quale partita è legata la gara.
- `resetGara()` azzera anche `info.matchId`? **No**: azzera eventi e cronometro,
  non i Dati gara (comportamento attuale). Il legame si cambia dalla tendina.

## 2. Andamento Gara → Report: "💾 Salva nei Risultati"

Pulsante accanto a "Genera PDF" (`#btnGenPdf`).

### Destinazione
1. `info.matchId` presente ed esistente in `matchResults` → quella partita.
2. Altrimenti cerca una partita con **stessa data e stesso avversario**
   (confronto normalizzato: minuscole, spazi) → la propone ("Salvo su
   *Olympic Collegno, 08/11*?").
3. Altrimenti: "Questa gara non è in Risultati: la aggiungo come nuova
   partita?" → crea la partita con data, ora, luogo, avversario, casa/trasferta.

### Conferma con differenze
Prima di scrivere, se la partita ha già punteggio, marcatori o cartellini,
mostra il confronto (es. "Marcatori in Risultati: Bivol, Aiesi · dalla gara:
Bivol, Aiesi, Runza"). Annulla = nessuna scrittura. Vale anche al secondo
salvataggio della stessa gara: una correzione fatta a mano in Risultati non
deve sparire in silenzio.

### Mappatura dei dati

| Dato gara | Destinazione in `matchResults[id]` |
|-----------|------------------------------------|
| `scoreHome` / `scoreAway` (secondo `info.noiCasa`) | `homeScore` / `awayScore` |
| eventi `gol` | `scorers: [{athleteId, min}]` |
| eventi `ammonizione` / `espulsione` | `cards: [{athleteId, tipo, min}]` (stesso `tipo` usato oggi dal pannello) |
| — | `assists`: **non toccati** (la gara non li registra) |
| convocati, titolari | `gara.convocati: [id]`, `gara.titolari: [id]` |
| eventi `cambio` | `gara.cambi: [{esce, entra, min, periodo, intervallo}]` |
| espulsioni (anche per minutaggio) | lette da `cards` con tipo espulsione + `gara.espulsioni: [{athleteId, min, periodo}]` |
| tempi | `gara.tempi: {numero, durata, durateTempi}` |
| metadati | `gara.salvataIl`, `gara.salvataDa`, `gara.incompleta` (true se XI vuoto) |

I gol avversari aggiornano solo il punteggio. Le note della cronologia non
vengono portate (restano nel PDF).

### Senza XI schierato
Avviso: "Titolari non schierati: il minutaggio sarà incompleto. Schierali
ora?" → **Schiera** (porta a Distinta) oppure **Salva comunque**
(`gara.incompleta = true`, mostrato nel pannello Risultati).

### Errori
Rete assente o errore server: messaggio chiaro, dati restano sul telefono,
si riprova. Il pulsante mostra l'ultima data di salvataggio riuscito
(`info.salvataNeiRisultati`).

### Server
Nuova azione dentro `api/data.js` (**nessun file nuovo**: limite 12 funzioni
del piano Hobby), es. `POST ?action=match-gara`:
- valida sessione, società, annata (`X-Annata-Id`), ruolo con permesso di
  scrittura sui Risultati (stessa regola di `canWrite`);
- legge `annate:<id>:matchResults`, modifica **solo** la partita indicata (o la
  crea), riscrive. Non passa per il `saveData` globale: evita il lost update
  già visto con le presenze (vedi memoria project_presenze_lost_update).

## 3. Risultati → pannello "Modifica Risultato Partita"

Sotto Marcatori / Assist / Cartellini, tre sezioni chiudibili, visibili se la
partita ha `gara` oppure se si sceglie "➕ Aggiungi formazione":

- **Formazione**: titolari e panchina (convocati − titolari); un tocco sposta
  un atleta fra le due; tendina rosa per aggiungere/togliere convocati.
  Badge "minutaggio incompleto" se `gara.incompleta` e XI ancora vuoto.
- **Sostituzioni**: righe Esce / Entra / Minuto (accetta `45+2`, `Int.`), con
  aggiungi ed elimina. Ordinate per periodo e minuto.
- **Minutaggio** (sola lettura, ricalcolato a ogni modifica): atleta, minuti,
  barretta proporzionale. Stessa regola di `calcolaMinutaggio()` della gara
  (somma i rientri, espulsione = fine minutaggio, cambio all'intervallo = 0'
  del tempo successivo). La funzione va **estratta in un file condiviso**
  (es. `public/minutaggio.js`) usato sia dalla gara sia da Risultati, così le
  due viste non divergono.
- **Cronologia** (sola lettura): gol, cartellini e cambi in ordine di tempo.

"Salva Partita" salva tutto insieme, come oggi. Le partite senza `gara` si
comportano esattamente come ora.

## Cosa non cambia
- Card compatta della griglia, Classifica Marcatori, Andamento Risultati
  (leggono `scorers` come prima).
- Export Excel/JSON e archivio di stagione includono già `matchResults`.

## Trappole da gestire
1. **GDPR / purgeAthlete** (`api/data.js` ~riga 408): oggi filtra
   `scorers`/`cards`/`assists` di ogni partita. Deve filtrare anche
   `gara.convocati`, `gara.titolari`, `gara.cambi`, `gara.espulsioni`, o un
   atleta cancellato resta nei dati.
2. **Atleti archiviati o tolti dalla rosa**: in Risultati mostrare comunque il
   nome dagli id salvati (storico), mai filtrarli: è storico, non operativo
   (memoria project_atleti_archiviati_filtro).
3. **Annata**: senza `X-Annata-Id` la gara non ha `matchResults`; la tendina
   mostra "nessuna partita" con spiegazione, non una lista vuota muta.
4. **Minuti testuali** (`45+2`, `Int.`, tempi 1-4): riusare il parsing della
   gara, non uno nuovo.
5. **Service worker gara**: bump `CACHE` in `public/gara/sw.js`; bump `?v=` dei
   file toccati nell'app principale.

## Test
- Gara legata da tendina → salva → card giusta con punteggio/marcatori/cartellini e sezioni compilate.
- Risultati con dati manuali → conferma mostra differenze; Annulla non scrive.
- Gara non legata, partita esistente per data+avversario → proposta corretta.
- Gara fuori calendario → nuova partita creata, presente in Classifica Marcatori.
- Senza XI → avviso, "Salva comunque" → badge incompleto.
- In Risultati: spostare titolare, cambiare minuto di un cambio → minutaggio ricalcolato.
- Due salvataggi concorrenti su partite diverse → nessuna delle due perde dati.
- purgeAthlete su un atleta presente in `gara` → rimosso ovunque.
