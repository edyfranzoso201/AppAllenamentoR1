# Distinta F.I.G.C. in Convocazioni — Design

**Data:** 2026-09-01
**Stato:** Approvato, in attesa di piano di implementazione

## Contesto

La sezione Convocazioni (`public/index.html`, `#convocazioni-section`) permette oggi di
creare una convocazione (categoria, tipo, avversario, data, luogo, staff e atleti
selezionati), salvarla, e stamparla in due varianti grafiche (🟥 Convocazione, ⬜
Pre-Convocazione) tramite `window.convStampa()`, che apre una finestra con HTML
costruito al volo e stile `@page{size:A4}`, pronta per il dialogo di stampa del
browser (l'utente sceglie "Salva come PDF").

Per i tornei, le società devono presentare all'organizzazione la **Distinta
F.I.G.C.** ufficiale (modulo Lega Nazionale Dilettanti): un elenco firmato dei
giocatori e dello staff partecipanti alla gara, con dati anagrafici e numeri di
tessera/matricola. Oggi questo modulo va compilato a mano fuori dall'app.

Gli atleti in Gestione Squadra hanno già salvati i campi necessari:
`athlete.dataNascita`, `athlete.numeroTessera`, `athlete.numeroMatricola`. Lo staff
(`isStaff:true`) ha solo `name`/`role` — nessun campo matricola/tessera LND, che
questo lavoro aggiunge.

## Cosa costruiamo

Un nuovo pulsante **"📋 Distinta"** nella card di ogni Convocazione (form e riga di
Storico), accanto ai pulsanti di stampa esistenti. Apre un pannello di editing
dedicato, precompilato con i dati della Convocazione, che produce in stampa un
modulo A4 fedele al layout ufficiale F.I.G.C. (vedi `fax simile compilata.pdf` /
`vergine.pdf` allegati), a colori, tramite lo stesso meccanismo di stampa browser
già usato per Convocazione/Pre-Conv.

## 1. Nuovo campo staff: Matricola/Tessera LND

- In Gestione Squadra, scheda di un membro dello staff (`isStaff:true`), nuovo
  campo di testo libero **"Matricola/Tessera LND"** (`athlete.matricolaLnd`),
  accanto ai campi esistenti (nome, ruolo). Salvato con lo stesso `saveAthlete()`
  già esistente, nessun nuovo endpoint.
- Editabile e opzionale: se vuoto, la distinta lo mostra vuoto (da scrivere a
  penna).

## 2. Dati della Distinta — dove vivono

Ogni Convocazione (`conv` in `_convData`) guadagna un nuovo campo opzionale
`conv.distinta`, con questa forma:

```js
conv.distinta = {
  affiliazione: '',        // opzionale, es. "949543"
  societa: 'Sport Monitoring', // editabile, default = nome app
  campionato: '',          // precompilato da conv.tipo/conv.categoria, editabile
  avversario: '',          // precompilato da conv.avversario, editabile
  data: '',                // precompilato da conv.data, editabile
  luogo: '',                // precompilato da conv.luogo, editabile
  giocatori: [
    // una entry per riga, ordine = ordine di stampa
    {
      athleteId: '123',
      ruolo: 1,             // progressivo, riordinabile
      riserva: '',          // testo libero, es. "R"
      capitano: '',         // testo libero, es. "C" o "VC"
      docTipo: 'Tess.',
      docNumero: '',        // precompilato da athlete.numeroTessera
      docRilasciato: 'FIGC'
    }
  ],
  staffRuoli: {
    // chiave = slot di firma del modello, valore = { athleteId, nome, matricola }
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
```

Salvato/letto insieme al resto della Convocazione tramite lo stesso
`_convSaveData()` / payload `{convocazioni:_convData}` già esistente — nessuna
modifica lato server, nessun nuovo endpoint, nessun nuovo file `.js` in `api/`
(vincolo Vercel Hobby).

## 3. Pannello di editing "Distinta"

Nuovo pannello (stesso stile card di `#conv-form-panel`), aperto da
`window.convDistintaApri(id)`:

**Intestazione gara** (precompilata, tutti i campi editabili solo qui, non
retro-propagati sulla Convocazione originale):
- N° Affiliazione (opzionale)
- Nome Società (default: nome app)
- Campionato/Torneo, Avversario, Data, Luogo

**Elenco giocatori** — tabella con una riga per atleta in `conv.atletiIds`, più un
menu a tendina **"+ Aggiungi giocatore"** per includerne altri anche non
convocati (utile per liste torneo più ampie della singola convocazione). Colonne
per riga:
- N. ruolo (progressivo automatico, frecce ↑↓ per riordinare)
- Data nascita (auto, sola lettura, da `athlete.dataNascita`)
- Cognome e Nome (auto, sola lettura, da `athlete.name`)
- Riserve (testo libero corto)
- Capitano/V.Capit. (testo libero corto)
- N. Matricola FIGC (auto, sola lettura, da `athlete.numeroMatricola`)
- Documento — Tipo / Numero / Rilasciato (precompilati Tess./`numeroTessera`/FIGC,
  tutti e 3 editabili inline)
- 🗑️ rimuovi riga

**Sezione firme/staff** — per ciascuno dei 7 ruoli del modello, un menu a tendina
che pesca dallo staff (`isStaff:true`), precompila nome e `matricolaLnd` se
presente sulla scheda, entrambi editabili dopo la selezione.

**Note**: campo di testo libero opzionale.

**Azioni**: `Salva` (scrive `conv.distinta`, richiama `_convSaveData()`),
`Annulla`, **`🖨️ Stampa Distinta`**.

## 4. Stampa

`window.convStampaDistinta(id)` apre una finestra HTML costruita al volo
(`@page{size:A4 portrait}`), stile bianco su nero — modulo a sé stante,
indipendente dagli sfondi/loghi scuri usati per la stampa Convocazione/Pre-Conv. —
a colori, con lo stesso meccanismo di stampa browser già in uso (l'utente sceglie
"Salva come PDF" dal dialogo di stampa nativo — nessuna libreria PDF nuova).

Layout, in ordine, replicando il modello allegato:

1. **Riga loghi**: tre slot immagine affiancati — Logo LND (sinistra), Logo
   Società (centro, stesso slot già esistente in Convocazioni), Logo FIGC/Italia
   (destra). I due nuovi slot (LND, FIGC) sono nuovi upload nel pannello
   "Immagini Società" già presente in cima a Convocazioni, accanto a quelli
   esistenti — stesso pattern di `window.convUploadImg`/`window.convDeleteImg`.
   Se un logo non è caricato, quello spazio resta vuoto (nessun placeholder).
2. **Intestazione testuale**: "Distinta n°", "F.I.G.C. - LEGA NAZIONALE
   DILETTANTI", riga con N° Affiliazione + Nome Società, riga "Distinta
   dei/delle giocatori/trici partecipanti alla gara [Società] - [Avversario]",
   righe Campionato/Data/Luogo.
3. **Tabella giocatori**: colonne N. ruolo, Data Nascita (G/M/A separate come nel
   modello), Cognome e Nome, Riserve, Capitano/V.Capit., N. Matricola F.I.G.C.,
   Documento di identificazione (Tipo/Numero/Rilasciato), Espulsi, Ammoniti (le
   ultime due colonne stampate vuote, da compilare a penna durante la gara).
   Righe dinamiche: tante quante `conv.distinta.giocatori.length`, nessuna riga
   vuota finale.
4. **Sezione firme**: una riga per ciascuno dei 7 ruoli di `staffRuoli`
   valorizzati (etichetta ruolo + nome + matricola), poi le due caselle finali
   "L'ARBITRO" / "IL DIRIGENTE ACCOMPAGNATORE UFFICIALE" vuote per firma a penna,
   come nel modello.
5. Bordi a tabella in stile documento ufficiale (bordi neri sottili, sfondo
   bianco, font leggibile da stampa) — stessa gabbia a colonne/proporzioni del
   modello, senza inseguire pixel-perfect ogni dettaglio grafico del modulo
   ufficiale oltre ai tre loghi.

## Cosa NON cambia

- Convocazione e Pre-Convocazione (stampa, salvataggio, storico): nessuna
  modifica di comportamento.
- Struttura dati esistente di `_convData`/`conv`: solo aggiunta additiva del
  campo opzionale `conv.distinta` — nessuna rottura di convocazioni già salvate
  senza quel campo (trattate come "Distinta non ancora compilata").
- Nessun nuovo file `.js` in `api/` — tutto il lavoro è client-side in
  `public/index.html`, il payload POST a `/api/data` resta nella stessa forma
  (`{convocazioni:[...]}`), con `distinta` come proprietà annidata in ciascuna
  convocazione.
- Nessuna nuova libreria: la generazione PDF riusa il dialogo di stampa nativo
  del browser, stesso pattern di `convStampa`.

## Edge case

- **Distinta senza atleti selezionati in Convocazione**: il pannello si apre
  comunque, con la tabella vuota e solo il menu "+ Aggiungi giocatore" per
  popolarla da zero.
- **Atleta senza numeroTessera/numeroMatricola/dataNascita compilati**: i campi
  auto restano vuoti (nessun placeholder tipo "N/D"), l'utente può comunque
  scrivere a mano Tipo/Numero/Rilasciato del documento riga per riga.
- **Staff senza matricolaLnd compilata**: la riga firma stampa nome + matricola
  vuota, editabile manualmente nel pannello prima di stampare.
- **Riordino righe**: le frecce ↑↓ scambiano la entry con la precedente/successiva
  nell'array `giocatori` e rinumerano `ruolo` in sequenza 1..N dopo ogni mossa.
- **Convocazione eliminata**: elimina anche `conv.distinta` insieme al resto
  dell'oggetto (nessuno storage separato da ripulire).
- **Loghi LND/FIGC non caricati**: la stampa mostra solo gli slot valorizzati,
  senza rompere il layout a tre colonne (spazio vuoto al posto dell'immagine
  mancante).
