# Cronografo Circuiti — Design

**Data:** 2026-08-28
**Area:** Area Tecnica (`public/area-tecnica.html`) → nuova pagina standalone `public/cronografo.html`

## Obiettivo

Aggiungere un pulsante **"⏱️ Cronografo Circuiti"** accanto al già esistente **"⚡ Test Reattività"** in Area Tecnica. A differenza di Test Reattività (pagina puramente client-side, zero server), il Cronografo Circuiti deve:

1. Cronometrare dal vivo, con frazionamenti (lap), i tempi di un circuito/percorso per più atleti in sequenza nella stessa sessione.
2. Assegnare rapidamente ogni tempo cronometrato a un atleta dell'annata corrente.
3. Salvare uno storico persistente per annata, consultabile nel tempo.
4. Mostrare il miglioramento del singolo atleta (rispetto alla sua sessione precedente sullo stesso circuito) e il miglioramento della squadra (confronto tra due date sullo stesso circuito).
5. Riflettere il tempo cronometrato anche nella sezione "Dati Performance" della scheda atleta (Gestione Squadra), che oggi accetta questo dato come inserimento manuale.

## Punto di partenza già esistente (da riusare, non duplicare)

- **"Dati Performance"** (pulsante `gps-btn`, icona `bi-person-fill-gear`, in ogni card atleta di Gestione Squadra) apre un form che include già tre campi manuali `tempo_circuito_min/sec/cen`, convertiti e salvati come `tempo_circuito_totale_s` dentro `gpsData[athleteId][date]` (array di sessioni per giorno). Il cronografo non sostituisce questo form: lo alimenta automaticamente in aggiunta al nuovo storico dedicato.
- **Pattern pagina standalone zero-server**: `public/reattivita.html` è il riferimento per struttura, tema (`--bg:#060f1e`, `--accent:#1aa05e`, ecc.), header con back-link, niente controllo permessi dentro la pagina (l'accesso ad Area Tecnica è già filtrato a monte).
- **Pattern salvataggio staff per annata**: `sondaggiPersist()` in `calendario.html` e il blocco `canWrite` in `api/data.js` (riga ~3480+) sono il riferimento per come una nuova chiave per-annata viene letta/scritta senza creare nuovi file in `api/`.

## Architettura

Pagina singola `public/cronografo.html`, con back-link `← Area Tecnica`, che fa fetch/POST diretti su `/api/data` (nessun nuovo file `.js` in `api/`, resta dentro il file esistente `api/data.js`).

### Modello dati

Nuova chiave Redis per annata:

```
annate:<annataId>:circuitTimes = {
  [athleteId]: [
    {
      id: "ctime_<timestamp>_<rand5>",   // stesso pattern id dei sondaggi
      date: "YYYY-MM-DD",
      circuito: "Slalom 20m",
      tempoTotale: 8.42,                  // secondi, 2 decimali
      laps: [2.10, 3.05, 3.27],           // parziali in secondi; [] se nessun lap registrato
      createdBy: "coach"                  // da sessionStorage 'gosport_auth_user', come sondaggi
    },
    ...
  ]
}
```

Le righe sono ordinate per `date` decrescente quando mostrate (più recente prima).

### Collegamento con Dati Performance (gpsData)

Quando la sessione viene salvata, per ogni riga della sessione lo stesso salvataggio aggiorna anche `gpsData[athleteId][date]` (date = oggi, formato YYYY-MM-DD):

- Se esiste già almeno una sessione GPS per quell'atleta in data odierna, viene aggiornato il campo `tempo_circuito_totale_s` della sessione con indice `[0]` nell'array `gpsData[athleteId][date]` (comportamento deterministico e semplice: non si tenta di indovinare quale sessione tra più di una sia "quella giusta" — se in un giorno esistono più sessioni GPS, questa v1 tocca sempre e solo la prima). Se quella sessione ha già un `distanza_circuito` valorizzato viene ricalcolato `velocita_circuito` con la stessa formula già usata in `script.js` (`(distanza / tempo) * 3.6`). Nessun altro campo della sessione viene toccato.
- Se non esiste nessuna sessione GPS per quell'atleta in data odierna, ne viene creata una minimale:
  ```js
  { tempo_circuito_totale_s: 8.42, distanza_circuito: null, velocita_circuito: null, fonte: 'cronografo' }
  ```
  Il campo `fonte: 'cronografo'` è solo un marcatore diagnostico (non usato per logica), utile per distinguere in futuro le sessioni create da qui rispetto a quelle inserite a mano dal form Dati Performance.

Questo comportamento è quindi realizzato **client-side** dentro `cronografo.html`: la pagina, prima del salvataggio, fa GET di `gpsData` corrente, applica la logica sopra, e include il `gpsData` aggiornato insieme a `circuitTimes` nella stessa POST.

### Endpoint server (`api/data.js`)

Nessun nuovo file. Dentro il blocco protetto da `canWrite(session.role)` (lo stesso di `body.surveys`, riga ~3566), si aggiunge:

```js
if (body.circuitTimes !== undefined) await kv.set(`${prefix}:circuitTimes`, body.circuitTimes);
```

La scrittura di `gpsData` è già supportata dal blocco esistente (`if (body.gpsData !== undefined) await kv.set(...)`) — nessuna modifica server necessaria per quella parte, la pagina invia semplicemente l'oggetto `gpsData` già aggiornato.

Il GET esistente (`/api/data` con `x-annata-id`) deve includere `circuitTimes` nella risposta per lo staff autenticato, seguendo lo stesso pattern delle altre chiavi per-annata già restituite in quel ramo.

### Permessi

Nessun controllo aggiuntivo dentro `cronografo.html` (identico a `reattivita.html`): l'accesso alla pagina è già filtrato dal fatto che il link compare solo dentro Area Tecnica. La scrittura server resta comunque dietro `canWrite(session.role)`, come tutte le altre scritture staff.

## Interfaccia

### Sezione cronometro (parte superiore della pagina)

- **Campo Circuito**: `<input list="circuiti-list">` con `<datalist>` popolata dai nomi distinti già presenti in `circuitTimes` per l'annata corrente (case-insensitive dedup, es. "Slalom 20m" e "slalom 20m" contano come lo stesso). Testo libero: si può scrivere un nome nuovo in qualsiasi momento.
- **Display tempo**: grande, centrato, `font-variant-numeric: tabular-nums`, formato `MM:SS.cc`, aggiornato ogni 30-50ms mentre il cronometro è in corsa (stesso approccio di un cronometro JS classico basato su `Date.now()` per l'accuratezza, non su conteggio a intervalli).
- **Lista lap correnti**: sopra il display, una riga orizzontale con i parziali già registrati nella corsa in corso (es. "Tratto 1: 2.10s · Tratto 2: 3.05s"), visibile solo durante/dopo una corsa con lap.
- **Pulsanti**: `Start` (stato iniziale) → durante la corsa mostra `Lap` e `Stop` fianco a fianco. Nessun limite al numero di lap per corsa. `Stop` blocca il tempo finale a schermo (non si azzera da solo).
- **Assegnazione**: dopo lo Stop, appare un `<select>` con gli atleti dell'annata corrente (ordine alfabetico) e un pulsante `✓ Assegna tempo a ‹nome›`. Cliccandolo:
  - aggiunge una riga alla lista sessione (sotto),
  - resetta cronometro e lap a zero, pronto per la prossima corsa,
  - **mantiene** il campo Circuito invariato (tipicamente si cronometra più atleti sullo stesso circuito di fila),
  - **svuota** la selezione atleta (va sempre scelta di nuovo, per evitare assegnazioni accidentali al "solito" atleta rimasto selezionato).

### Lista sessione (sotto il cronometro)

Tabella con le righe non ancora salvate sul server in questa sessione di utilizzo pagina:

| Atleta | Tempo | Azioni |
|---|---|---|
| Mario Rossi | 8.42s | ✏️ (corregge il tempo totale a mano) · 🗑️ (rimuove la riga) |

I lap di ogni riga sono visibili passando il mouse/tap sul tempo (tooltip o riga espandibile — dettaglio implementativo lasciato al piano). In fondo alla tabella: pulsante **"💾 Salva tutti i tempi (N)"**, dove N è il conteggio righe. Disabilitato se la lista è vuota.

Il salvataggio:
1. Rilegge lo stato corrente di `circuitTimes` e `gpsData` dal server (per non sovrascrivere modifiche concorrenti di un altro utente),
2. applica il merge additivo descritto sopra,
3. invia un'unica POST `{ circuitTimes, gpsData }`,
4. in caso di successo, svuota la lista sessione e mostra una conferma (es. banner "✅ N tempi salvati"),
5. in caso di errore di rete, la lista sessione **non** viene svuotata (l'utente può ritentare "Salva tutti i tempi" senza perdere i dati già cronometrati).

### Sezione storico (parte inferiore della pagina)

Due viste selezionabili con due tab/pulsanti: **"Per atleta"** e **"Confronto squadra"**.

**Per atleta:**
- `<select>` atleta.
- Tabella con tutte le righe di quell'atleta da `circuitTimes`, ordinate per data decrescente: Data, Circuito, Tempo, Variazione.
- Variazione: confronta il tempo con quello **immediatamente precedente sullo stesso circuito** (per nome circuito, case-insensitive). `▼ 0.28s` in verde se il nuovo tempo è minore (migliorato), `▲ 0.15s` in rosso se maggiore (peggiorato), `—` se è il primo tempo registrato per quel circuito.

**Confronto squadra:**
- `<select>` circuito (nomi distinti presenti in `circuitTimes` per l'annata).
- Due `<select>` data (popolati con le date in cui quel circuito è stato cronometrato, ricavate dai dati — non un date picker libero, per evitare di scegliere date senza dati).
- Tabella: Atleta, Tempo data A, Tempo data B, Variazione — solo per gli atleti che hanno un tempo in **entrambe** le date scelte per quel circuito.
- Riga finale: **Media squadra** (media aritmetica delle variazioni individuali, stesso segno/colore ▼/▲).

## Casi limite

- **Nessun atleta nell'annata**: il `<select>` atleta mostra un messaggio placeholder ("Nessun atleto in questa annata") e il pulsante "Assegna" resta disabilitato.
- **Stop senza lap registrati**: `laps: []`, nessun errore — i lap sono sempre opzionali, solo il tempo totale è obbligatorio.
- **Stesso circuito scritto con maiuscole/minuscole diverse** (es. "Slalom" vs "slalom"): trattati come lo stesso circuito ai fini di autocomplete e confronto variazione (case-insensitive), ma il nome visualizzato resta quello scritto l'ultima volta (nessuna normalizzazione forzata del testo salvato).
- **Due tempi nello stesso circuito nello stesso giorno per lo stesso atleta** (es. ripetuto due volte): entrambi vengono salvati come righe distinte in `circuitTimes`; nel calcolo "variazione per atleta" si confronta sempre con la riga cronologicamente precedente, quindi un secondo tentativo nello stesso giorno si confronta col primo.
- **Tab del browser chiusa/ricaricata a metà sessione (prima di "Salva tutti i tempi")**: i tempi non ancora salvati vengono persi (nessun draft in localStorage previsto in questa v1 — YAGNI, si può aggiungere in futuro se capita spesso in pratica).
- **Errore di rete durante il salvataggio**: lista sessione preservata, messaggio di errore visibile, pulsante "Salva tutti i tempi" resta disponibile per ritentare.

## Fuori scope (v1)

- Nessuna eliminazione/modifica di righe già salvate nello storico (solo append da questa pagina). Se servirà, sarà una richiesta futura separata.
- Nessuna esportazione (Excel/PDF) dello storico circuiti in questa v1.
- Nessun collegamento con il "Cambio Stagione" (archiviazione): la retention di questa nuova chiave sarà valutata quando esisterà quella feature per `circuitTimes`, seguendo lo stesso schema già usato per le altre categorie.
