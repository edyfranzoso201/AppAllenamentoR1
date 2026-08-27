# Demo Gratuita 3 Mesi — Design

## Obiettivo

Permettere a un prospect di provare l'app gratis per 3 mesi in autonomia (self-service), con un account isolato e limitato, per generare lead che l'utente (owner dell'app) converte poi manualmente a un piano a pagamento. Il pannello superadmin deve poter vedere queste demo e ampliare (mesi di prova, numero atleti/dirigenti/coach) i limiti di una demo specifica, senza modal dedicato.

## Fuori scope

- Verifica SMS del numero di telefono (costo per-messaggio non voluto in questa fase): il telefono viene solo validato nel formato (pattern IT), non confermato via OTP.
- Pagamento/upgrade self-service da demo a piano a pagamento: resta un processo manuale (l'owner contatta il prospect).
- Invito di più di 1 coach nella demo.

## Vincoli tecnici (hard constraint, non negoziabile)

**Nessun nuovo file `.js` dentro `api/`.** Il piano Vercel Hobby in uso ha un limite di 12 funzioni serverless (una per ogni file in `api/`), già saturato dal progetto — vedi [[project_ical_feed]] per il precedente in cui questo limite ha già vincolato una scelta di design. Ogni endpoint nuovo descritto in questo documento (`demo-signup`, `demo-verify`, `demo-activate`, `update-demo-limits`, logica cron) DEVE essere aggiunto come nuova `action` dentro un file `api/*.js` già esistente (`api/data.js` o `api/licenze.js`), mai come file a sé. Questo vale anche in fase di implementazione: se in corso d'opera sembra "più pulito" un file dedicato, non è un'opzione disponibile su questo progetto.

## Flusso 1 — Registrazione demo (landing page sport-monitoring)

**Punto di ingresso:** form pubblico sulla landing page esterna (`C:\Temp\sport-monitoring`), sezione "Prova gratis 3 mesi". Campi: nome società/squadra, nome referente, email, telefono. Nessuna password in questo step.

**Validazione client-side:** email formato valido, telefono pattern IT (es. `/^(\+39)?\s?3\d{8,9}$/` o simile, da confermare in fase di implementazione).

**Endpoint nuovo:** `POST /api/data?action=demo-signup` (in `api/data.js`, stesso file di tutte le altre action pubbliche/autenticate — nessuna nuova funzione serverless, per non consumare altro slot del limite di 12 funzioni su piano Hobby, vedi [[project_ical_feed]]).

Passi server-side:

1. Normalizza email (lowercase) e telefono (solo cifre + prefisso).
2. **Check anti-abuso**: verifica che né l'email né il telefono compaiano già negli indici `demo:usedEmails` (set) e `demo:usedPhones` (set) — usati da QUALSIASI demo passata, indipendentemente dal suo stato (attiva/scaduta/sospesa). Se già presenti → 400 con messaggio "Questa email/numero ha già usufruito della prova gratuita."
3. Se ok:
   - Genera `societyId` nuovo (stesso pattern di `crypto.randomUUID().replace(/-/g,'').substring(0,20)` usato in `api/licenze.js:237`).
   - Crea licenza con `plan: 'demo'` in `licenze:<licenseKey>` (vedi modello dati sotto), `active: true`, `demoExpiresAt` NON ancora impostato (verrà impostato alla conferma email, così i 90gg partono da quando l'account è davvero utilizzabile, non dalla richiesta).
   - Crea un'annata demo dentro quella società (stesso pattern di creazione annata già esistente in `annate:list` + `society:<sid>:inventory:<annataId>` ecc., ma vuota).
   - Crea un utente dirigente "owner" in stato `pending` (nessuna password), collegato a quell'email, dentro la società demo.
   - Genera un token di conferma (es. HMAC con lo stesso meccanismo già usato per iCal/link firmati, vedi [[project_ical_feed]]) con scadenza propria (es. 48h per completare la conferma).
   - Invia email di conferma (Gmail SMTP, stesso meccanismo di [[project_resend_email]]) con link [`https://app-allenamento-r1.vercel.app/verify-demo.html?token=...`](https://app-allenamento-r1.vercel.app/verify-demo.html).
   - Invia email di notifica all'owner dell'app (indirizzo fisso, es. edy.franzoso@gmail.com) con i dati del nuovo lead: nome società, referente, email, telefono.
4. Response: `{ success: true, message: "Controlla la tua email per confermare." }` — non rivela se account creato o meno in caso di errore anti-abuso generico (evita enumeration, ma qui l'utente ha già ricevuto messaggio esplicito al punto 2, quindi non è un problema di sicurezza rilevante essendo dati che l'utente stesso ha appena inserito).

## Flusso 2 — Conferma email e attivazione

**Pagina nuova:** `public/verify-demo.html`, raggiunta dal link nell'email.

1. Legge `token` da query string, chiama `GET /api/data?action=demo-verify&token=...` per validare (token valido, non scaduto, non già usato).
2. Se valido: mostra un mini-form "Scegli la tua password" (solo password + conferma password).
3. Submit → `POST /api/data?action=demo-activate` con `{ token, password }`:
   - Verifica di nuovo il token.
   - Imposta password sull'utente dirigente (hash, stesso meccanismo di [[project_password_individual]]).
   - Passa l'utente da `pending` ad attivo.
   - Imposta `licenze:<key>.demoExpiresAt = now + 90 giorni`.
   - Aggiunge email e telefono agli indici anti-abuso `demo:usedEmails` / `demo:usedPhones` (fatto qui, non al signup, così un signup mai confermato non "brucia" l'email/telefono per sempre — ANZI: da rivedere, vedi nota sotto).
   - Marca il token come usato.
4. Redirect a `index.html` (login normale dell'app).

> **Nota di design da confermare in fase di review spec:** se l'anti-abuso scatta solo alla conferma (non al signup), un utente potrebbe registrarsi N volte con la stessa email senza mai confermare, intasando la casella con email di conferma. Mitigazione minima: limitare a 1 signup "pending" non confermato per email/telefono (se già presente un record pending con lo stesso contatto e non scaduto, rifiuta il nuovo signup con lo stesso messaggio anti-abuso). Il campo dati per questo controllo è lo stesso indice, popolato però già al signup con uno stato `pending` e sostituito da `confirmed` alla conferma — vedi struttura dati sotto.

## Modello dati

### Licenza plan "demo" (estensione di `api/licenze.js`)

Oggi le licenze hanno solo `plan: 'silver'|'platinum'`, `expiry`, `active`, `notes` (vedi `api/licenze.js:214-259`). Si aggiunge un terzo valore `plan: 'demo'` con campi propri sullo stesso oggetto licenza:

```js
{
  // campi esistenti invariati: email, societyName, societyId, expiry, active, signature, ts, createdAt, lastAccess
  plan: 'demo',
  demoExpiresAt: '2026-11-25T00:00:00.000Z', // impostato alla conferma email (+90gg)
  demoLimits: {
    maxAtleti: 3,
    maxDirigenti: 1,   // fisso, non modificabile da superadmin (sempre 1 owner)
    maxCoach: 1
  },
  demoStatus: 'pending' | 'active' | 'expired' | 'purged'
}
```

`expiry` (campo esistente, usato per il controllo licenza generale) viene impostato uguale a `demoExpiresAt` per riusare tutta la logica di scadenza/controllo licenza già esistente altrove nell'app, evitando di dover aggiungere un secondo controllo parallelo ovunque si verifica `licenza.expiry`.

### Indici anti-abuso

```text
demo:usedEmails  → Set Redis di email normalizzate (lowercase)
demo:usedPhones  → Set Redis di telefoni normalizzati (solo cifre + prefisso)
```

Popolati (stato `pending`) al signup, promossi a definitivi alla conferma. Non vengono mai rimossi (nemmeno dopo l'oblio dei dati a fine grazia) — servono a bloccare futuri abusi anche dopo che la società demo è stata cancellata.

## Flusso 3 — Limiti tecnici lato server

Ogni endpoint che crea un atleta o un utente staff (coach) deve controllare, PRIMA di scrivere, se la licenza della società corrente è `plan: 'demo'`:

- Se sì, conta gli atleti/coach esistenti nella società e confronta con `demoLimits.maxAtleti` / `demoLimits.maxCoach`.
- Se il limite è già raggiunto → risposta 403 con messaggio: `"Hai raggiunto il limite di {N} atleti della prova gratuita. Contattaci per passare a un piano a pagamento."` (stesso pattern messaggi di errore già in uso, es. `api/data.js` risposte 403 esistenti).
- Il dirigente owner non può mai essere rimosso né un secondo dirigente aggiunto (maxDirigenti fisso a 1): il controllo va anche sull'endpoint di invito/creazione utenti staff con ruolo dirigente.

Punti di codice da toccare (da confermare in fase di piano): endpoint di creazione atleta e di creazione/invito utente staff in `api/data.js` — aggiungere il check limite demo come guardia iniziale, riusando la lettura licenza già presente per il controllo di scadenza generale.

## Flusso 4 — Notifiche e ciclo di vita (nel cron esistente)

Tutta la logica temporale entra dentro l'endpoint cron già esistente `GET /api/data?action=cron-remind` (`api/data.js:1496`, chiamato giornalmente da Vercel Cron, vedi `vercel.json`) — nessuna nuova funzione serverless.

Per ogni licenza con `plan: 'demo'` e `demoStatus: 'active'`:

1. **Preavviso 15gg / 3gg prima di `demoExpiresAt`:** invia email al dirigente owner (stesso meccanismo Gmail SMTP degli altri promemoria, es. R3 certificati in [[project_r3_cert_medici]]). Traccia l'invio (flag `demoReminder15Sent` / `demoReminder3Sent` sulla licenza) per non reinviare più volte.
2. **Scadenza (`now >= demoExpiresAt`):** imposta `demoStatus: 'expired'`. Da questo momento il login per gli utenti di quella società deve essere bloccato (controllo aggiuntivo nel flusso di login/verifica sessione: se licenza `plan==='demo' && demoStatus==='expired'`, nega l'accesso con messaggio "Prova scaduta. Contattaci per continuare." e un contatto). I dati restano intatti.
3. **Fine periodo di grazia (`now >= demoExpiresAt + 30gg`):** cancellazione automatica e definitiva:
   - Rimuove la società demo e tutti i suoi dati (stesso pattern di purge già usato per l'auto-oblio R2, vedi `purgeAthlete()` in `api/data.js:185` e il cron di retention in `api/data.js:1693` — qui però serve un purge "a livello di intera società", non solo del singolo atleta: enumerare e cancellare tutte le chiavi `society:<sid>:*` e rimuovere la licenza).
   - Imposta `demoStatus: 'purged'` sulla licenza (mantenuta per storico/anti-abuso, ma svuotata dei dati) oppure elimina la licenza stessa mantenendo solo email/telefono negli indici anti-abuso (da decidere in fase di piano quale sia più semplice da implementare in modo affidabile).
   - Logga l'operazione nello stesso registro di audit retention già esistente (`gdpr:retention-log`, `api/data.js:300`) per coerenza con l'approccio GDPR già in uso.

## Flusso 5 — Pannello superadmin (`public/superadmin.html`)

**Tabella esistente** (righe 504+, funzione `renderTable()` a riga 865): le licenze demo compaiono insieme a silver/platinum, ordinate come oggi per `createdAt`.

**Badge "DEMO":** se `l.plan === 'demo'`, la riga mostra un badge colorato distinto (stesso stile dei badge plan esistenti) accanto al nome società.

**Colonne extra solo per righe demo:**

- Giorni rimasti (calcolati da `demoExpiresAt`, stesso pattern di `daysLeft` già calcolato in `api/licenze.js:204` per `expiry`).
- Atleti usati/max (es. "2/3").
- Coach usati/max (es. "0/1").

**Controlli inline nella riga** (pulsanti, non modal): tre coppie di pulsanti +/- (o singoli pulsanti "+30gg", "+1 atleta", "+1 coach") visibili solo sulle righe demo, accanto ai pulsanti esistenti (✏️ Edit, 🗑️ Delete, 👁 Dettagli — righe 939-941). Ogni click chiama subito l'endpoint (nessun salvataggio a fine form).

**Endpoint nuovo:** `POST /api/licenze?action=update-demo-limits` con body `{ licenseKey, field: 'expiry'|'maxAtleti'|'maxCoach', delta: number }`:

- Verifica che la licenza sia `plan: 'demo'`.
- Applica il delta al campo richiesto (`demoExpiresAt` per `'expiry'` in giorni, `demoLimits.maxAtleti`/`demoLimits.maxCoach` per gli altri due).
- Se `field === 'expiry'` e la licenza era `demoStatus: 'expired'`, la riporta ad `'active'` (riattivazione: l'owner ha deciso di estendere una prova già scaduta) e resetta i flag di preavviso già inviati (`demoReminder15Sent`/`demoReminder3Sent = false`) così i promemoria ripartono per la nuova scadenza.
- Ritorna la licenza aggiornata; il client aggiorna solo quella riga senza ricaricare tutta la tabella.

Autenticazione: stesso meccanismo già in uso per tutte le altre action di `api/licenze.js` (sessione superadmin).

## Edge case e comportamenti da verificare in implementazione

- **Signup con email/telefono già "pending" non confermato:** rifiutato con lo stesso messaggio anti-abuso (vedi nota nel Flusso 2), a meno che il pending non sia scaduto (48h) — in tal caso il vecchio pending viene scartato silenziosamente e se ne crea uno nuovo.
- **Superadmin estende `maxAtleti` mentre il dirigente demo sta aggiungendo un atleta in parallelo:** nessuna race condition critica attesa (operazioni indipendenti su campi diversi della stessa licenza) ma va garantito un read-modify-write atomico o quantomeno un ultimo-vince accettabile, coerente con lo stile già usato altrove nel codebase (nessun lock esplicito in uso oggi).
- **Login durante il giorno esatto della scadenza:** il confronto usa `now >= demoExpiresAt` (non `>`), quindi l'ultimo giorno pieno di accesso è quello precedente la mezzanotte UTC di scadenza — coerente con gli altri controlli di scadenza (`expiry`) già in uso nell'app.
- **Cancellazione automatica dopo i 30gg di grazia:** deve essere idempotente (se il cron gira più volte sullo stesso giorno per qualche motivo, non deve fallire se i dati sono già stati rimossi).

## Collegamenti a memoria/contesto esistente

- [[project_ical_feed]] — limite 12 funzioni Hobby: nessun nuovo file in `api/`, tutto dentro action esistenti di `data.js`/`licenze.js`.
- [[project_resend_email]] — Gmail SMTP è il canale email da riusare per conferma/notifiche/promemoria.
- [[project_r3_cert_medici]] — pattern già rodato di promemoria+auto-rimozione dentro lo stesso cron giornaliero.
- [[project_password_individual]] — meccanismo di verifica/hash password lato server da riusare per l'attivazione.
- [[feedback_deploy_workflow]] — nessun deploy senza accordo esplicito, vale anche per questa feature una volta implementata.
