# Sondaggi in Org. — Design

## Contesto e obiettivo

Oggi in Org. (`calendario.html`) lo staff gestisce Calendario, Bacheca, Gare, Documenti. Manca un modo per raccogliere pareri strutturati dai genitori (es. "Chi viene alla cena sociale?", "Preferite allenamento sabato o domenica?") e vederne il riepilogo aggregato, con controllo su cosa i genitori stessi possono rivedere del risultato.

**Obiettivo**: aggiungere un sistema di sondaggi per annata, creati dallo staff in Org., a cui i genitori rispondono dal proprio link presenze (`?athleteId=...`), con riepilogo sempre visibile allo staff e visibilità del risultato ai genitori configurabile per singolo sondaggio.

## Vincoli di progetto

- Nessun nuovo file `.js` in `api/` (limite 12 funzioni serverless Vercel Hobby già saturato) — tutto dentro `api/data.js`, seguendo i pattern esistenti.
- Nessuna nuova tabella/DB: stesso store Redis (Vercel KV) via `kv.get`/`kv.set`, con chiavi per annata come già avviene per `calendarEvents`/`calendarResponses`/`posts`.
- Il link genitore (`?athleteId=...`) resta senza token/autenticazione — stesso livello di fiducia già accettato oggi per le presenze (rischio noto e accettato dall'utente, vedi `calendarResponses`).

## Modello dati

Due chiavi Redis per annata, seguendo esattamente il pattern già in uso per `calendarEvents`/`calendarResponses`:

```
annate:<annataId>:surveys           →  { [surveyId]: Survey }
annate:<annataId>:surveyResponses   →  { [surveyId]: { [athleteId]: Response } }
```

Separare definizione e risposte (invece di un unico blob) replica la stessa scelta già fatta per calendario: un genitore scrive **solo** `surveyResponses`, mai `surveys`, quindi può farlo senza autenticazione senza rischio di alterare la definizione del sondaggio.

```ts
type Survey = {
  id: string;                    // uuid o timestamp-based, generato lato client staff
  question: string;
  options: string[];             // min 2
  multiple: boolean;             // scelta singola vs multipla
  createdAt: number;             // epoch ms
  closesAt: number | null;       // epoch ms, opzionale
  status: "open" | "closed";     // chiusura manuale; la scadenza è calcolata a runtime (vedi sotto)
  showResultsToParents: boolean; // default true alla creazione
  showNamesInResults: boolean;   // rilevante solo se showResultsToParents=true; default false
  createdBy: string;             // username/coach che l'ha creato
};

type Response = {
  choices: string[];   // sottoinsieme di options; length 1 se multiple=false
  respondedAt: number; // epoch ms, sovrascritto ad ogni modifica
};
```

**Scadenza calcolata a runtime, non da cron**: `status` resta `"open"` sul server finché lo staff non preme "Chiudi sondaggio". Sia la UI staff che quella genitore confrontano `closesAt` con `Date.now()` e trattano il sondaggio come chiuso se la data è passata, indipendentemente dal campo `status`. Stesso approccio già usato per le scadenze dei certificati medici (calcolo lato client/render, non batch) — nessuna modifica al cron esistente.

## Endpoint (dentro `api/data.js`, nessun nuovo file)

**Lettura**: `surveys` e `surveyResponses` vengono aggiunti al payload già restituito per annata (stesso `Promise.all` che oggi carica `calendarEvents, calendarResponses, posts, ...` — righe ~3171-3193 e ~3283-3289 di `api/data.js`), così sono già disponibili sia in Org. che nella vista genitore senza un endpoint dedicato.

**Scrittura staff** (crea/modifica sondaggio, richiede sessione con permesso `canEditGeneral` — stesso ruolo che oggi gestisce eventi/bacheca): `POST` con `body.surveys` — stesso pattern già usato per `body.posts` (`api/data.js:3500`, scrittura per annata via `kv.set(\`${prefix}:surveys\`, body.surveys)`).

**Scrittura genitore** (risposta): `POST` con **solo** `body.surveyResponses` (nessun'altra chiave nel body). Replica esatta del blocco esistente per `calendarResponses`:

```js
// Pattern esistente (api/data.js:3356-3359), da replicare identico per i sondaggi:
if (body.calendarResponses !== undefined && Object.keys(body).length === 1) {
    await kv.set(`${prefix}:calendarResponses`, body.calendarResponses);
}
// Nuovo, stesso identico schema:
if (body.surveyResponses !== undefined && Object.keys(body).length === 1) {
    // validazione minima prima di salvare (vedi sotto)
    await kv.set(`${prefix}:surveyResponses`, body.surveyResponses);
}
```

**Validazione lato server minima** prima di accettare una risposta (protegge da input pubblico malformato o da race condition sulla chiusura):
1. il `surveyId` referenziato deve esistere in `surveys` per quell'annata;
2. il sondaggio deve risultare aperto: `status === "open"` **e** (`closesAt === null` oppure `closesAt > Date.now()`); altrimenti la richiesta è rifiutata con errore esplicito (non un falso successo silenzioso);
3. le `choices` inviate devono essere tutte contenute in `options`;
4. se `multiple === false`, `choices.length` deve essere esattamente 1 — altrimenti rifiuto esplicito (niente troncamento silenzioso).

## UI Staff — nuovo tab "Sondaggi" in Org.

Aggiunto come quinto tab in `calendario.html`, accanto a Calendario/Bacheca/Gare/Documenti, con lo stesso meccanismo (`page-tabs`, funzione `showSondaggiTab()` con guard `athleteId` che la nasconde in modalità genitore — stesso pattern di `showBachecaTab`/`showGareTab`/`showDocumentiTab`).

**Vista lista** (default all'apertura del tab):
- Una card per sondaggio: domanda, badge di stato (🟢 Aperto / ⚫ Chiuso — calcolato a runtime come sopra), scadenza se impostata, conteggio risposte ("12/18 hanno risposto", calcolato contando gli `athleteId` presenti in `surveyResponses[surveyId]` sul totale atleti dell'annata).
- Bottone "➕ Nuovo Sondaggio" in alto.
- Click su una card → vista dettaglio/risultati dello stesso sondaggio.

**Form creazione**:
- Campo domanda (testo libero, obbligatorio).
- Lista opzioni dinamica (minimo 2, bottone "+ Aggiungi opzione"); submit bloccato lato client se meno di 2 opzioni non vuote.
- Radio "Scelta singola" / "Scelta multipla" → `multiple`.
- Data di scadenza opzionale (date/time picker) → `closesAt`; se lasciata vuota, `closesAt: null` (il sondaggio resta aperto finché non chiuso manualmente).
- Toggle "Mostra risultati ai genitori" → `showResultsToParents`, default ON.
- Se ON, secondo toggle annidato "Mostra anche chi ha risposto cosa" → `showNamesInResults`, default OFF (privacy by default: senza azione esplicita dello staff, i genitori vedono solo l'aggregato anonimo).

**Vista risultati (staff)**: sempre completa e nominativa, indipendentemente dai due toggle sopra — che regolano solo cosa vede il genitore, mai cosa vede lo staff. Mostra:
- barra percentuale per ogni opzione (calcolata sulle risposte presenti);
- elenco di chi ha risposto cosa, e separatamente chi non ha ancora risposto;
- se zero risposte: messaggio "Nessuna risposta ancora" al posto di barre vuote;
- bottone "Chiudi sondaggio" (imposta `status: "closed"` esplicitamente, indipendente dalla scadenza).

## UI Genitore — sezione sotto il calendario presenze

In `calendario.html` / `presenza-calendar-mode.js`, sotto la tabella "Conferma Presenze" già esistente per il link `?athleteId=...`, nuova sezione "📊 Sondaggi" che compare solo se esiste almeno un sondaggio effettivamente aperto (stesso calcolo runtime `status === "open"` e `closesAt` non scaduta) per quell'annata.

Per ogni sondaggio aperto:
- domanda + opzioni renderizzate come radio (scelta singola) o checkbox (scelta multipla), in base a `multiple`;
- bottone "Invia risposta"; se l'atleta ha già una risposta salvata, i controlli sono precompilati e il bottone diventa "Aggiorna risposta" (la risposta resta modificabile finché il sondaggio è aperto, come da requisito);
- se `showResultsToParents === true`: sotto il form, il risultato aggregato in barre percentuale — con i nominativi di chi ha risposto cosa se `showNamesInResults === true`, altrimenti solo percentuali/conteggi.

Sondaggi chiusi non vengono mostrati al genitore (YAGNI: lo storico/sola-lettura non è stato richiesto, e lo staff ha già la vista completa in Org.).

## Gestione errori ed edge case

| Caso | Comportamento |
|---|---|
| Sondaggio scaduto (`closesAt` passata) ma `status` ancora `"open"` sul server | Trattato come chiuso a runtime sia lato staff (badge ⚫) sia lato genitore (non mostrato); nessun cron necessario |
| Genitore invia risposta dopo la chiusura (race condition) | Server rifiuta con errore esplicito; client mostra "Sondaggio chiuso, risposta non salvata" — mai falso successo |
| Form staff con meno di 2 opzioni valide | Submit bloccato lato client prima dell'invio |
| `multiple: false` ma il client invia più `choices` | Server rifiuta esplicitamente (niente troncamento silenzioso alla prima scelta) |
| `athleteId` non trovato in nessuna annata attiva | Comportamento già esistente e invariato: `presenza-calendar-mode.js` mostra "Atleta Non Trovato" prima che la sezione sondaggi venga renderizzata |
| Sondaggio senza risposte | Vista risultati staff mostra "Nessuna risposta ancora" invece di barre a zero |
| Eliminazione sondaggio | Fuori scope: resta solo "Chiudi" (manuale); l'eliminazione potrà essere aggiunta in futuro se richiesta (YAGNI) |

## Permessi (riepilogo)

- **Creazione/modifica/chiusura sondaggio**: stessi ruoli che oggi possono gestire eventi calendario/bacheca in Org. (`canEditGeneral`: coach_l1, coach_l2, dirigente_l1, admin) — nessun nuovo livello di permesso introdotto.
- **Risposta**: chiunque abbia un link genitore valido (`?athleteId=...`), senza token né verifica aggiuntiva — stesso livello di fiducia già in uso e accettato per le presenze.

## Fuori scope (esplicitamente escluso)

- Eliminazione sondaggi (solo chiusura).
- Notifiche push per nuovo sondaggio (potrà essere una fase successiva, riusando l'infrastruttura VAPID già esistente per altri eventi — non richiesto ora).
- Vista storico/sola-lettura dei sondaggi chiusi lato genitore.
- Sondaggi globali (multi-annata): restano sempre per singola annata.
