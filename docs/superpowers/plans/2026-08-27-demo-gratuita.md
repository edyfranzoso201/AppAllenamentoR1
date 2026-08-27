# Demo Gratuita 3 Mesi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere a un prospect di registrarsi da solo per una prova gratuita di 3 mesi (3 atleti + 1 dirigente + 1 coach opzionale), con verifica email/telefono anti-abuso, ciclo di vita automatico (promemoria, scadenza, cancellazione), e gestione da pannello superadmin — senza aggiungere nessun nuovo file `.js` in `api/`.

**Architecture:** Tutta la logica nuova vive come `action` aggiuntive dentro i due file serverless già esistenti che la toccano: `api/data.js` (signup, verify, activate, limiti scrittura, cron) e `api/licenze.js` (estensione modello licenza + endpoint superadmin `update-demo-limits`). Una pagina statica nuova (`public/verify-demo.html`) gestisce la conferma email + scelta password — le pagine statiche non contano come funzioni serverless, solo i file in `api/` lo fanno. Il pannello superadmin esistente (`public/superadmin.html`) riceve badge/colonne/pulsanti per le licenze `plan: 'demo'`.

**Tech Stack:** Node.js su Vercel Serverless Functions, Redis (`@vercel/kv`), Nodemailer con Gmail SMTP, HMAC (`crypto.createHmac`) per i token di conferma, scrypt (`_password.js`) per l'hashing password.

---

## Vincolo tecnico da rispettare in OGNI task

Nessun nuovo file `.js` dentro `api/`. Ogni pezzo di logica server-side va dentro `action` nuove aggiunte a `api/data.js` o `api/licenze.js`. Il progetto ha già 12 funzioni attive (limite Hobby): `annate/list`, `annate/manage`, `annate/user-annate`, `auth/change-password`, `auth/login`, `auth/manage`, `auth/session`, `data`, `gdrive-img`, `licenze`, `log`, `registrations`. Non toccare questo elenco.

## Nota architetturale importante

`api/annate/manage.js` e `api/auth/manage.js` richiedono ENTRAMBI una sessione admin già attiva (vedi `api/annate/manage.js:32-50`, `api/auth/manage.js` check `isSuperAdmin`/sessione). Il flusso di signup demo avviene SENZA che nessuno sia loggato, quindi la creazione di annata/utente per la demo NON chiama questi endpoint: replica il loro pattern di generazione dati (stessi campi, stesso `generateAnnataId()`, stessa struttura `newUser`) come codice nuovo dentro `action=demo-signup` in `api/data.js`, con il gate di sessione admin sostituito dal controllo anti-abuso.

---

### Task 1: Indici anti-abuso + helper HMAC token demo in `api/data.js`

**Files:**
- Modify: `api/data.js` (aggiungere helper vicino a `icalSign`, righe 94-99)

- [ ] **Step 1: Aggiungere i helper per il token di conferma demo**

Vicino ai helper iCal esistenti (`api/data.js:94-99`), aggiungere:

```js
// ── Demo gratuita: token HMAC per conferma email (stesso meccanismo di icalSign,
//    riusato qui per non introdurre una nuova dipendenza) ──────────────────────
function demoTokenSecret() { return process.env.ICAL_SECRET || process.env.BACKUP_SECRET || ''; }
function generateDemoToken(email, ts) {
  const sig = crypto.createHmac('sha256', demoTokenSecret()).update(`demo:${email}:${ts}`).digest('hex').substring(0, 32);
  return Buffer.from(`${email}:${ts}:${sig}`).toString('base64url');
}
function verifyDemoToken(token) {
  try {
    const decoded = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return { ok: false };
    const [email, ts, sig] = parts;
    const expected = crypto.createHmac('sha256', demoTokenSecret()).update(`demo:${email}:${ts}`).digest('hex').substring(0, 32);
    if (sig !== expected) return { ok: false };
    const ageMs = Date.now() - Number(ts);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 48 * 60 * 60 * 1000) return { ok: false, expired: true };
    return { ok: true, email, ts: Number(ts) };
  } catch (e) { return { ok: false }; }
}
```

- [ ] **Step 2: Verificare che il file sia ancora sintatticamente valido**

Run: `node --check api/data.js`
Expected: nessun output (exit code 0)

- [ ] **Step 3: Commit**

```bash
git add api/data.js
git commit -m "feat(demo): aggiunge helper token HMAC per conferma demo"
```

---

### Task 2: Endpoint `action=demo-signup` in `api/data.js`

**Files:**
- Modify: `api/data.js` (nuovo blocco `action`, va inserito PRIMA del blocco che richiede `getSessionInfo`/autenticazione — stesso punto in cui vive `action === 'contact'`, riga 387, che è anch'esso pubblico)

- [ ] **Step 1: Aggiungere il blocco `demo-signup`**

Inserire subito dopo il blocco `if (req.query?.action === 'contact' ...)` (che termina alla riga 427 circa, prima di `push-subscribe` a riga 464), questo nuovo blocco pubblico (nessuna sessione richiesta):

```js
// ── DEMO GRATUITA: registrazione self-service (3 mesi, 3 atleti + 1 dirigente + 1 coach) ──
if (req.query?.action === 'demo-signup' && req.method === 'POST') {
  const { societyName, refName, email: rawEmail, phone: rawPhone } = req.body || {};

  const email = String(rawEmail || '').trim().toLowerCase();
  const phone = String(rawPhone || '').replace(/[^\d+]/g, '');
  const nomeSocieta = String(societyName || '').trim().slice(0, 120);
  const nomeReferente = String(refName || '').trim().slice(0, 120);

  if (!nomeSocieta || !nomeReferente) {
    return res.status(400).json({ success: false, message: 'Nome società e nome referente obbligatori' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Email non valida' });
  }
  if (!/^(\+39)?3\d{8,9}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Numero di telefono non valido (formato italiano)' });
  }

  // ── Anti-abuso: blocca se email O telefono hanno già usufruito della demo ──
  const [emailUsed, phoneUsed] = await Promise.all([
    kv.sismember('demo:usedEmails', email),
    kv.sismember('demo:usedPhones', phone),
  ]);
  if (emailUsed || phoneUsed) {
    return res.status(400).json({ success: false, message: 'Questa email o questo numero ha già usufruito della prova gratuita.' });
  }

  // ── Blocca anche un pending non ancora confermato con stesso contatto ──
  const pendingKey = `demo:pending:${email}`;
  const existingPending = await kv.get(pendingKey);
  if (existingPending && (Date.now() - existingPending.ts) < 48 * 60 * 60 * 1000) {
    return res.status(400).json({ success: false, message: 'Hai già una registrazione in attesa di conferma. Controlla la tua email.' });
  }

  // ── Crea società/annata/licenza/utente pending ──
  const societyId = crypto.randomUUID().replace(/-/g, '').substring(0, 20);
  const annataId = crypto.randomBytes(8).toString('hex');
  const now = new Date();
  const annataNome = String(now.getFullYear());

  const newAnnata = {
    id: annataId,
    nome: annataNome,
    societyId,
    dataInizio: '',
    dataFine: '',
    descrizione: 'Annata demo',
    createdAt: now.toISOString(),
  };
  const annate = (await kv.get('annate:list')) || [];
  annate.push(newAnnata);

  const licenseTs = Date.now();
  const licensePayload = { email, expiry: '2099-01-01', societyId, ts: licenseTs };
  const licenseSignature = crypto
    .createHmac('sha256', process.env.LICENSE_SECRET_KEY || '')
    .update(JSON.stringify(licensePayload))
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
  const licenseKey = 'DEMO-' + crypto.randomBytes(6).toString('hex').toUpperCase();

  const licenseData = {
    email,
    societyName: nomeSocieta,
    societyId,
    expiry: '2099-01-01', // placeholder finché non confermata: demoExpiresAt parte dalla conferma
    plan: 'demo',
    notes: `Referente: ${nomeReferente} · Tel: ${phone}`,
    active: true,
    signature: licenseSignature,
    ts: licenseTs,
    createdAt: now.toISOString(),
    lastAccess: null,
    demoExpiresAt: null,
    demoLimits: { maxAtleti: 3, maxDirigenti: 1, maxCoach: 1 },
    demoStatus: 'pending',
    demoReminder15Sent: false,
    demoReminder3Sent: false,
  };

  const usernameDemo = ('demo_' + email.split('@')[0]).replace(/[^a-z0-9_]/gi, '').slice(0, 30).toLowerCase();
  const users = (await kv.get('auth:users')) || [];
  if (users.find(u => String(u.username || '').toLowerCase() === usernameDemo)) {
    return res.status(400).json({ success: false, message: 'Riprova tra qualche istante (conflitto temporaneo).' });
  }
  const newUser = {
    username: usernameDemo,
    password: null, // impostata alla conferma (Flusso 2)
    email,
    nome: nomeReferente,
    cognome: '',
    note: 'Utente demo — pending conferma email',
    role: 'dirigente_l1',
    annate: [annataId],
    societyId,
    expiryDate: null,
    createdAt: now.toISOString(),
    createdBySuperAdmin: false,
    demoPending: true,
  };

  const demoToken = generateDemoToken(email, licenseTs);

  await Promise.all([
    kv.set('annate:list', annate),
    kv.set(`annate:${annataId}:athletes`, []),
    kv.set(`annate:${annataId}:evaluations`, {}),
    kv.set(`annate:${annataId}:gpsData`, {}),
    kv.set(`annate:${annataId}:awards`, {}),
    kv.set(`annate:${annataId}:trainingSessions`, {}),
    kv.set(`annate:${annataId}:formationData`, { starters: [], bench: [], tokens: [] }),
    kv.set(`annate:${annataId}:matchResults`, {}),
    kv.set(`annate:${annataId}:calendarEvents`, {}),
    kv.set(`annate:${annataId}:calendarResponses`, {}),
    kv.set(`licenze:${licenseKey}`, licenseData),
    kv.set(`licenze_email:${email}`, licenseKey),
    kv.set(`licenze_society:${societyId}`, licenseKey),
    kv.sadd('licenze:index', licenseKey),
    kv.set('auth:users', [...users, newUser]),
    kv.set(`auth:user:${usernameDemo}`, newUser),
    kv.set(pendingKey, { ts: Date.now(), email, phone, societyId, licenseKey, username: usernameDemo }),
  ]);
  await kv.expire(pendingKey, 48 * 60 * 60);

  // ── Email di conferma al referente ──
  try {
    const { createTransport } = await import('nodemailer');
    const transporter = createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } });
    const confirmUrl = `https://app-allenamento-r1.vercel.app/verify-demo.html?token=${encodeURIComponent(demoToken)}`;
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Conferma la tua prova gratuita — Sport Monitoring',
      html: `<p>Ciao ${nomeReferente},</p><p>Conferma la tua registrazione a Sport Monitoring cliccando qui:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>Il link scade tra 48 ore.</p>`,
    });
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: `🆕 Nuovo lead demo: ${nomeSocieta}`,
      html: `<p>Società: ${nomeSocieta}<br>Referente: ${nomeReferente}<br>Email: ${email}<br>Telefono: ${phone}</p>`,
    });
  } catch (e) {
    console.error('[demo-signup] invio email fallito:', e?.message || e);
  }

  return res.status(200).json({ success: true, message: 'Controlla la tua email per confermare la registrazione.' });
}
```

- [ ] **Step 2: Verificare la sintassi**

Run: `node --check api/data.js`
Expected: nessun output (exit code 0)

- [ ] **Step 3: Test manuale con curl (locale o produzione, dopo deploy)**

Run:
```bash
curl -s -X POST "https://app-allenamento-r1.vercel.app/api/data?action=demo-signup" \
  -H "Content-Type: application/json" \
  -d '{"societyName":"Test ASD","refName":"Mario Rossi","email":"test-demo-1@example.com","phone":"3331234567"}'
```
Expected: `{"success":true,"message":"Controlla la tua email per confermare la registrazione."}`

- [ ] **Step 4: Test anti-abuso — stessa email di nuovo (pending non scaduto)**

Run: stesso comando dello Step 3 immediatamente dopo
Expected: `{"success":false,"message":"Hai già una registrazione in attesa di conferma. Controlla la tua email."}`

- [ ] **Step 5: Commit**

```bash
git add api/data.js
git commit -m "feat(demo): aggiunge endpoint demo-signup con anti-abuso e creazione società/annata/utente pending"
```

---

### Task 3: Endpoint `action=demo-verify` e `action=demo-activate` in `api/data.js`

**Files:**
- Modify: `api/data.js` (subito dopo il blocco `demo-signup` del Task 2)

- [ ] **Step 1: Aggiungere `demo-verify` (GET, valida il token senza consumarlo)**

```js
// ── DEMO GRATUITA: verifica token di conferma (chiamato da verify-demo.html) ──
if (req.query?.action === 'demo-verify' && req.method === 'GET') {
  const check = verifyDemoToken(req.query.token);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.expired ? 'Link scaduto.' : 'Link non valido.' });
  }
  const pendingKey = `demo:pending:${check.email}`;
  const pending = await kv.get(pendingKey);
  if (!pending) {
    return res.status(400).json({ success: false, message: 'Registrazione non trovata o già confermata.' });
  }
  return res.status(200).json({ success: true, email: check.email, societyName: (await kv.get(`licenze:${pending.licenseKey}`))?.societyName || '' });
}
```

- [ ] **Step 2: Aggiungere `demo-activate` (POST, imposta password e attiva)**

```js
// ── DEMO GRATUITA: attivazione — imposta password, marca attiva, avvia i 90gg ──
if (req.query?.action === 'demo-activate' && req.method === 'POST') {
  const { token, password } = req.body || {};
  const check = verifyDemoToken(token);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.expired ? 'Link scaduto.' : 'Link non valido.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ success: false, message: 'La password deve avere almeno 8 caratteri' });
  }
  const pendingKey = `demo:pending:${check.email}`;
  const pending = await kv.get(pendingKey);
  if (!pending) {
    return res.status(400).json({ success: false, message: 'Registrazione non trovata o già confermata.' });
  }

  const license = await kv.get(`licenze:${pending.licenseKey}`);
  if (!license) return res.status(404).json({ success: false, message: 'Licenza non trovata' });

  const demoExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  license.demoExpiresAt = demoExpiresAt.toISOString();
  license.expiry = demoExpiresAt.toISOString().split('T')[0];
  license.demoStatus = 'active';

  const hashed = hashPasswordScrypt(String(password));
  const users = (await kv.get('auth:users')) || [];
  const idx = users.findIndex(u => u.username === pending.username);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Utente non trovato' });
  users[idx].password = hashed;
  users[idx].demoPending = false;

  const indUser = await kv.get(`auth:user:${pending.username}`);
  if (indUser) { indUser.password = hashed; indUser.demoPending = false; }

  await Promise.all([
    kv.set(`licenze:${pending.licenseKey}`, license),
    kv.set('auth:users', users),
    indUser ? kv.set(`auth:user:${pending.username}`, indUser) : Promise.resolve(),
    kv.sadd('demo:usedEmails', pending.email),
    kv.sadd('demo:usedPhones', pending.phone),
    kv.del(pendingKey),
  ]);

  return res.status(200).json({ success: true, message: 'Account attivato. Ora puoi accedere.', username: pending.username });
}
```

**Nota:** `hashPasswordScrypt` va importato in cima a `api/data.js`. Verificare se `api/data.js` già importa da `../auth/_password.js`; se no, aggiungere `import { hashPasswordScrypt } from './auth/_password.js';` vicino agli altri import in cima al file.

- [ ] **Step 3: Verificare l'import**

Run: `grep -n "hashPasswordScrypt\|^import" api/data.js | head -20`
Expected: se manca la riga `import { hashPasswordScrypt } from './auth/_password.js';`, aggiungerla subito dopo gli import esistenti (`import { createClient } from '@vercel/kv';` ecc.)

- [ ] **Step 4: Verificare la sintassi**

Run: `node --check api/data.js`
Expected: nessun output (exit code 0)

- [ ] **Step 5: Test manuale end-to-end (dopo deploy)**

Prendere il token dall'email reale ricevuta nel test del Task 2, poi:
```bash
curl -s "https://app-allenamento-r1.vercel.app/api/data?action=demo-verify&token=<TOKEN>"
```
Expected: `{"success":true,"email":"test-demo-1@example.com","societyName":"Test ASD"}`

```bash
curl -s -X POST "https://app-allenamento-r1.vercel.app/api/data?action=demo-activate" \
  -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN>","password":"provaProva123"}'
```
Expected: `{"success":true,"message":"Account attivato. Ora puoi accedere.","username":"demo_test-demo-1"}`

- [ ] **Step 6: Commit**

```bash
git add api/data.js
git commit -m "feat(demo): aggiunge demo-verify e demo-activate, avvio scadenza 90gg alla conferma"
```

---

### Task 4: Pagina `public/verify-demo.html`

**Files:**
- Create: `public/verify-demo.html`

- [ ] **Step 1: Creare la pagina di conferma + scelta password**

```html
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Conferma prova gratuita — Sport Monitoring</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#060f1e; color:#e2e8f0; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#0f1c33; border:1px solid #1e293b; border-radius:14px; padding:32px; max-width:400px; width:90%; }
  h1 { font-size:1.3rem; margin:0 0 8px; color:#fff; }
  p { color:#94a3b8; font-size:0.9rem; line-height:1.5; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; border-radius:8px; border:1px solid #334155; background:#0a1628; color:#e2e8f0; margin:8px 0; font-size:0.95rem; }
  button { width:100%; padding:11px; border:none; border-radius:8px; background:#198754; color:#fff; font-weight:600; cursor:pointer; font-size:0.95rem; margin-top:8px; }
  button:disabled { opacity:0.6; cursor:not-allowed; }
  .msg { margin-top:12px; font-size:0.85rem; }
  .msg.error { color:#ef4444; }
  .msg.success { color:#10b981; }
</style>
</head>
<body>
<div class="card">
  <h1>🎉 Conferma la tua prova gratuita</h1>
  <div id="content">
    <p>Verifica in corso...</p>
  </div>
</div>
<script>
const API_BASE = '';
const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
const content = document.getElementById('content');

async function init() {
  if (!token) {
    content.innerHTML = '<p class="msg error">Link non valido: token mancante.</p>';
    return;
  }
  try {
    const r = await fetch(`${API_BASE}/api/data?action=demo-verify&token=${encodeURIComponent(token)}`);
    const d = await r.json();
    if (!d.success) {
      content.innerHTML = `<p class="msg error">${d.message}</p>`;
      return;
    }
    content.innerHTML = `
      <p>Società: <strong>${d.societyName}</strong><br>Email: <strong>${d.email}</strong></p>
      <p>Scegli una password per accedere (minimo 8 caratteri):</p>
      <input type="password" id="pwd" placeholder="Password" autocomplete="new-password">
      <input type="password" id="pwd2" placeholder="Conferma password" autocomplete="new-password">
      <button id="btn-activate">Attiva account</button>
      <div id="msg" class="msg"></div>
    `;
    document.getElementById('btn-activate').addEventListener('click', activate);
  } catch (e) {
    content.innerHTML = '<p class="msg error">Errore di rete. Riprova.</p>';
  }
}

async function activate() {
  const pwd = document.getElementById('pwd').value;
  const pwd2 = document.getElementById('pwd2').value;
  const msg = document.getElementById('msg');
  const btn = document.getElementById('btn-activate');
  if (pwd.length < 8) { msg.textContent = 'La password deve avere almeno 8 caratteri'; msg.className = 'msg error'; return; }
  if (pwd !== pwd2) { msg.textContent = 'Le password non coincidono'; msg.className = 'msg error'; return; }
  btn.disabled = true; btn.textContent = 'Attivazione...';
  try {
    const r = await fetch(`${API_BASE}/api/data?action=demo-activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: pwd })
    });
    const d = await r.json();
    if (!d.success) {
      msg.textContent = d.message; msg.className = 'msg error';
      btn.disabled = false; btn.textContent = 'Attiva account';
      return;
    }
    msg.textContent = 'Account attivato! Ti reindirizziamo al login...'; msg.className = 'msg success';
    setTimeout(() => { location.href = '/index.html'; }, 2000);
  } catch (e) {
    msg.textContent = 'Errore di rete. Riprova.'; msg.className = 'msg error';
    btn.disabled = false; btn.textContent = 'Attiva account';
  }
}

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificare che il file sia HTML valido**

Run: `node -e "require('fs').readFileSync('public/verify-demo.html','utf8')"`
Expected: nessun errore (file leggibile)

- [ ] **Step 3: Commit**

```bash
git add public/verify-demo.html
git commit -m "feat(demo): aggiunge pagina di conferma email e scelta password per la demo"
```

---

### Task 5: Limiti server-side su salvataggio atleti e creazione utenti staff

**Files:**
- Modify: `api/data.js:2946-2950` (salvataggio `body.athletes`)
- Modify: `api/auth/manage.js` (creazione utente, action `create`)

**Nota tecnica:** gli atleti si salvano scrivendo l'INTERO array in un colpo solo (`api/data.js:2950`, `if (body.athletes !== undefined) await kv.set(...)`), non un endpoint "aggiungi singolo atleta". Il controllo limite quindi confronta la LUNGHEZZA dell'array in arrivo (esclusi gli ospiti, coerente con `atletiCount` calcolato altrove con `athletes.filter(x => !x.isGuest).length`, vedi `api/data.js:2334`).

- [ ] **Step 1: Aggiungere il check limite demo prima del salvataggio atleti in `api/data.js`**

Modificare il blocco esistente (righe 2946-2950):

```js
if (!canWrite(session.role)) {
return res.status(403).json({ success: false, message: 'Permesso negato' });
}

if (body.athletes !== undefined) await kv.set(`${prefix}:athletes`, body.athletes);
```

in:

```js
if (!canWrite(session.role)) {
return res.status(403).json({ success: false, message: 'Permesso negato' });
}

// ── Limite demo: max atleti (esclusi ospiti) per società con plan 'demo' ──
if (body.athletes !== undefined && session.societyId) {
  const licKey = await kv.get(`licenze_society:${session.societyId}`);
  const lic = licKey ? await kv.get(`licenze:${licKey}`) : null;
  if (lic && lic.plan === 'demo' && lic.demoLimits) {
    const nonGuestCount = (body.athletes || []).filter(a => !a.isGuest).length;
    if (nonGuestCount > lic.demoLimits.maxAtleti) {
      return res.status(403).json({
        success: false,
        message: `Hai raggiunto il limite di ${lic.demoLimits.maxAtleti} atleti della prova gratuita. Contattaci per passare a un piano a pagamento.`
      });
    }
  }
}

if (body.athletes !== undefined) await kv.set(`${prefix}:athletes`, body.athletes);
```

- [ ] **Step 2: Aggiungere il check limite demo su creazione utente coach in `api/auth/manage.js`**

Nel blocco `action === 'create'` di `api/auth/manage.js` (righe 138-178), subito dopo il controllo duplicati username (dopo riga 153, prima di `if (role && !VALID_ROLES...)`), aggiungere:

```js
        // ── Limite demo: max 1 coach, max 1 dirigente (fisso) per società demo ──
        if (societyId) {
          const licKey = await kv.get(`licenze_society:${societyId}`);
          const lic = licKey ? await kv.get(`licenze:${licKey}`) : null;
          if (lic && lic.plan === 'demo' && lic.demoLimits) {
            const isCoachRole = String(role || '').startsWith('coach');
            const isDirigenteRole = String(role || '').startsWith('dirigente');
            if (isCoachRole) {
              const coachCount = users.filter(u => u.societyId === societyId && String(u.role || '').startsWith('coach')).length;
              if (coachCount >= lic.demoLimits.maxCoach) {
                return res.status(403).json({ success: false, message: `Hai raggiunto il limite di ${lic.demoLimits.maxCoach} coach della prova gratuita. Contattaci per passare a un piano a pagamento.` });
              }
            }
            if (isDirigenteRole) {
              const dirigenteCount = users.filter(u => u.societyId === societyId && String(u.role || '').startsWith('dirigente')).length;
              if (dirigenteCount >= lic.demoLimits.maxDirigenti) {
                return res.status(403).json({ success: false, message: `Hai raggiunto il limite di ${lic.demoLimits.maxDirigenti} dirigente della prova gratuita. Contattaci per passare a un piano a pagamento.` });
              }
            }
          }
        }

```

- [ ] **Step 3: Verificare la sintassi di entrambi i file**

Run: `node --check api/data.js && node --check api/auth/manage.js`
Expected: nessun output (exit code 0)

- [ ] **Step 4: Commit**

```bash
git add api/data.js api/auth/manage.js
git commit -m "feat(demo): applica limiti atleti/coach/dirigenti lato server per licenze demo"
```

---

### Task 6: Blocco login per demo scadute in `api/auth/login.js`

**Files:**
- Modify: `api/auth/login.js` (dopo il blocco `expiryDate` esistente, righe 141-147)

**Nota:** il controllo esistente su `license.expiry` (righe 214-248) si applica SOLO a `user.role === 'admin'`. Il dirigente demo ha ruolo `dirigente_l1`, quindi serve un controllo aggiuntivo, indipendente dal ruolo, sulla licenza della società.

- [ ] **Step 1: Aggiungere il blocco dopo il controllo `expiryDate` (dopo riga 147)**

```js
    // ── Blocco demo scaduta (qualsiasi ruolo, non solo admin) ─────────────
    if (user.societyId) {
      try {
        const licKey = await kv.get(`licenze_society:${user.societyId}`);
        const lic = licKey ? await kv.get(`licenze:${licKey}`) : null;
        if (lic && lic.plan === 'demo' && lic.demoStatus === 'expired') {
          console.log(`   ❌ Demo scaduta: ${username} (societyId=${user.societyId})`);
          return res.status(403).json({ success: false, message: 'Prova gratuita scaduta. Contattaci per continuare a usare Sport Monitoring.' });
        }
      } catch (e) { /* non bloccante: se la lettura licenza fallisce, non impedire il login */ }
    }
```

- [ ] **Step 2: Verificare la sintassi**

Run: `node --check api/auth/login.js`
Expected: nessun output (exit code 0)

- [ ] **Step 3: Commit**

```bash
git add api/auth/login.js
git commit -m "feat(demo): blocca il login quando la demo è scaduta, per qualsiasi ruolo"
```

---

### Task 7: Ciclo di vita demo nel cron esistente (`action=cron-remind`)

**Files:**
- Modify: `api/data.js` (dentro il blocco `cron-remind`, dopo la sezione email alerts platinum che termina intorno alla riga 1600+; inserire come sezione indipendente, riusando il `transporter` già istanziato)

- [ ] **Step 1: Individuare il punto di inserimento esatto**

Run: `grep -n "cron-remind\|emailsSent\|return res.status(200).json({ success: true, message" api/data.js | head -20`

Cercare la riga dove termina il blocco email-alerts (subito prima della risposta finale del cron, es. `return res.status(200).json({ success: true, pushSent: totalSent, emailsSent... })`). Il nuovo blocco va inserito PRIMA di quella risposta finale, ancora dentro il blocco `try` che ha già `transporter` disponibile.

- [ ] **Step 2: Aggiungere la sezione ciclo di vita demo**

```js
    // ── DEMO GRATUITA: promemoria scadenza + blocco + oblio dopo 30gg di grazia ──
    let demoProcessed = 0;
    try {
      const demoKeys = await kv.smembers('licenze:index');
      const nowMs = Date.now();
      for (const licKey of (demoKeys || [])) {
        const lic = await kv.get(`licenze:${licKey}`);
        if (!lic || lic.plan !== 'demo' || !lic.demoExpiresAt) continue;

        const expiresMs = new Date(lic.demoExpiresAt).getTime();
        const msLeft = expiresMs - nowMs;
        const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

        // Promemoria 15gg / 3gg (solo se ancora attiva)
        if (lic.demoStatus === 'active') {
          if (daysLeft <= 15 && daysLeft > 3 && !lic.demoReminder15Sent) {
            await transporter.sendMail({
              from: process.env.GMAIL_USER, to: lic.email,
              subject: '⏳ La tua prova gratuita sta per scadere',
              html: `<p>Ciao,</p><p>La tua prova gratuita di Sport Monitoring per <strong>${lic.societyName}</strong> scade tra ${daysLeft} giorni. Contattaci per continuare a usarla senza interruzioni.</p>`
            });
            lic.demoReminder15Sent = true;
            await kv.set(`licenze:${licKey}`, lic);
            demoProcessed++;
          } else if (daysLeft <= 3 && daysLeft >= 0 && !lic.demoReminder3Sent) {
            await transporter.sendMail({
              from: process.env.GMAIL_USER, to: lic.email,
              subject: '🚨 Ultimi giorni di prova gratuita',
              html: `<p>Ciao,</p><p>La tua prova gratuita per <strong>${lic.societyName}</strong> scade tra ${daysLeft} giorni. Contattaci subito per non perdere i tuoi dati.</p>`
            });
            lic.demoReminder3Sent = true;
            await kv.set(`licenze:${licKey}`, lic);
            demoProcessed++;
          }
        }

        // Scadenza: passa a 'expired' (blocco login gestito in auth/login.js)
        if (lic.demoStatus === 'active' && msLeft <= 0) {
          lic.demoStatus = 'expired';
          await kv.set(`licenze:${licKey}`, lic);
          demoProcessed++;
        }

        // Fine periodo di grazia (30gg dopo la scadenza): purge completo
        const graceMs = expiresMs + 30 * 24 * 60 * 60 * 1000;
        if (lic.demoStatus === 'expired' && nowMs >= graceMs) {
          const societyId = lic.societyId;
          const allAnnate = (await kv.get('annate:list')) || [];
          const societyAnnate = allAnnate.filter(a => a.societyId === societyId);
          const remainingAnnate = allAnnate.filter(a => a.societyId !== societyId);

          for (const annata of societyAnnate) {
            const keysToDelete = [
              `annate:${annata.id}:athletes`, `annate:${annata.id}:evaluations`, `annate:${annata.id}:gpsData`,
              `annate:${annata.id}:awards`, `annate:${annata.id}:trainingSessions`, `annate:${annata.id}:formationData`,
              `annate:${annata.id}:matchResults`, `annate:${annata.id}:calendarEvents`, `annate:${annata.id}:calendarResponses`,
              `society:${societyId}:inventoryCatPhotos:${annata.id}`,
            ];
            for (const k of keysToDelete) { try { await kv.del(k); } catch (e) { /* già assente: ok, idempotente */ } }
          }
          await kv.set('annate:list', remainingAnnate);

          const allUsers = (await kv.get('auth:users')) || [];
          const remainingUsers = allUsers.filter(u => u.societyId !== societyId);
          const removedUsers = allUsers.filter(u => u.societyId === societyId);
          await kv.set('auth:users', remainingUsers);
          for (const u of removedUsers) { try { await kv.del(`auth:user:${String(u.username).toLowerCase()}`); } catch (e) { /* idempotente */ } }

          try { await kv.del(`licenze_society:${societyId}`); } catch (e) { /* idempotente */ }

          lic.demoStatus = 'purged';
          await kv.set(`licenze:${licKey}`, lic);

          const retentionLog = (await kv.get('gdpr:retention-log')) || [];
          retentionLog.push({
            type: 'demo-purge', societyId, societyName: lic.societyName,
            email: lic.email, purgedAt: new Date().toISOString(),
          });
          await kv.set('gdpr:retention-log', retentionLog);
          demoProcessed++;
        }
      }
    } catch (e) {
      console.error('[cron-remind] errore ciclo vita demo:', e?.message || e);
    }
```

- [ ] **Step 3: Includere `demoProcessed` nella risposta finale del cron**

Trovare la riga di risposta finale del blocco `cron-remind` (es. `return res.status(200).json({ success: true, pushSent: totalSent, emailsSent, ... })`) e aggiungere `demoProcessed` all'oggetto.

- [ ] **Step 4: Verificare la sintassi**

Run: `node --check api/data.js`
Expected: nessun output (exit code 0)

- [ ] **Step 5: Test manuale del cron (con CRON_SECRET reale, dopo deploy)**

Run:
```bash
curl -s "https://app-allenamento-r1.vercel.app/api/data?action=cron-remind" \
  -H "Authorization: Bearer <CRON_SECRET>"
```
Expected: risposta 200 con `success:true` e campo `demoProcessed` presente (numero, anche 0 se nessuna demo è in finestra di promemoria/scadenza quel giorno)

- [ ] **Step 6: Commit**

```bash
git add api/data.js
git commit -m "feat(demo): aggiunge ciclo di vita demo al cron esistente (promemoria, scadenza, purge dopo 30gg)"
```

---

### Task 8: Endpoint superadmin `action=update-demo-limits` in `api/licenze.js`

**Files:**
- Modify: `api/licenze.js` (nuovo blocco, subito dopo `toggle-email-alerts`, righe 291-303)

- [ ] **Step 1: Aggiungere il blocco action**

```js
    // ==========================================
    // ACTION: update-demo-limits - Superadmin amplia mesi/limiti di una demo
    // ==========================================
    if (action === 'update-demo-limits' && req.method === 'POST') {
      const saCheck = await verifySuperAdmin(req, kv);
      if (!saCheck.ok) {
        if (saCheck.blocked) return res.status(429).json({ success: false, message: `Troppi tentativi. Riprova tra ${saCheck.retryAfterMin} minuti.` });
        return res.status(401).json({ success: false, message: 'Non autorizzato' });
      }
      const { licenseKey, field, delta } = req.body || {};
      if (!licenseKey || !field) return res.status(400).json({ success: false, message: 'licenseKey e field obbligatori' });
      const deltaNum = Number(delta);
      if (!Number.isFinite(deltaNum)) return res.status(400).json({ success: false, message: 'delta non valido' });

      const stored = await kv.get(`licenze:${licenseKey}`);
      if (!stored) return res.status(404).json({ success: false, message: 'Licenza non trovata' });
      if (stored.plan !== 'demo') return res.status(403).json({ success: false, message: 'Solo licenze demo' });

      if (field === 'expiry') {
        const current = stored.demoExpiresAt ? new Date(stored.demoExpiresAt) : new Date();
        current.setDate(current.getDate() + deltaNum);
        stored.demoExpiresAt = current.toISOString();
        stored.expiry = current.toISOString().split('T')[0];
        if (stored.demoStatus === 'expired' && current.getTime() > Date.now()) {
          stored.demoStatus = 'active';
          stored.demoReminder15Sent = false;
          stored.demoReminder3Sent = false;
        }
      } else if (field === 'maxAtleti' || field === 'maxCoach') {
        if (!stored.demoLimits) stored.demoLimits = { maxAtleti: 3, maxDirigenti: 1, maxCoach: 1 };
        stored.demoLimits[field] = Math.max(0, (stored.demoLimits[field] || 0) + deltaNum);
      } else {
        return res.status(400).json({ success: false, message: 'field non valido (usa: expiry, maxAtleti, maxCoach)' });
      }

      stored.updatedAt = new Date().toISOString();
      await kv.set(`licenze:${licenseKey}`, stored);
      return res.status(200).json({ success: true, licenza: { ...stored, licenseKey } });
    }

```

- [ ] **Step 2: Verificare la sintassi**

Run: `node --check api/licenze.js`
Expected: nessun output (exit code 0)

- [ ] **Step 3: Commit**

```bash
git add api/licenze.js
git commit -m "feat(demo): aggiunge endpoint superadmin update-demo-limits (estende scadenza/limiti demo)"
```

---

### Task 9: Badge, colonne e controlli inline demo in `public/superadmin.html`

**Files:**
- Modify: `public/superadmin.html:877-968` (funzione `renderTable`)
- Modify: `public/superadmin.html` (aggiungere le funzioni JS di controllo, vicino a `toggleAI`/`toggleEmailAlerts`, righe 1249-1295)

- [ ] **Step 1: Estendere la colonna "Piano" per mostrare il badge DEMO**

In `renderTable()`, modificare la riga 916:

```js
            <td>
                ${l.plan === 'platinum' ? '<span class="badge" style="background:#7c3aed;color:#ede9fe">💎 Platinum</span>' : l.plan === 'gold' ? '<span class="badge" style="background:#b45309;color:#fef3c7">🥇 Gold</span>' : '<span class="badge" style="background:#374151;color:#d1d5db">🥈 Silver</span>'}
            </td>
```

in:

```js
            <td>
                ${l.plan === 'demo' ? '<span class="badge" style="background:#0891b2;color:#cffafe">🎁 DEMO</span>' : l.plan === 'platinum' ? '<span class="badge" style="background:#7c3aed;color:#ede9fe">💎 Platinum</span>' : l.plan === 'gold' ? '<span class="badge" style="background:#b45309;color:#fef3c7">🥇 Gold</span>' : '<span class="badge" style="background:#374151;color:#d1d5db">🥈 Silver</span>'}
                ${l.plan === 'demo' ? `<div style="font-size:0.72rem;color:#94a3b8;margin-top:3px">Atleti: ${(l.demoAtletiCount ?? 0)}/${l.demoLimits?.maxAtleti ?? 3} · Coach: ${(l.demoCoachCount ?? 0)}/${l.demoLimits?.maxCoach ?? 1}</div>` : ''}
            </td>
```

- [ ] **Step 2: Aggiungere i controlli inline demo nella cella Azioni**

Modificare la cella `actions-cell` (righe 937-943):

```js
            <td>
                <div class="actions-cell">
                    <button class="btn btn-warning btn-sm" onclick="openEdit('${l.licenseKey}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="openDelete('${l.licenseKey}', '${l.societyName.replace(/'/g,"\\'")}')">🗑️</button>
                    <button class="btn btn-sm" id="btn-det-${safeKey}" style="background:#0369a1;color:#fff;font-size:0.78rem;padding:3px 8px" title="Vedi atleti e staff" onclick="toggleDetails('${l.licenseKey}','${(l.societyId||'').replace(/'/g,"\\'")}','${safeKey}')">👁 Dettagli</button>
                    ${l.plan === 'demo' ? `
                    <button class="btn btn-sm" style="background:#0891b2;color:#fff;font-size:0.72rem;padding:3px 6px" title="Aggiungi 30 giorni" onclick="updateDemoLimit('${l.licenseKey}','${safeKey}','expiry',30)">+30gg</button>
                    <button class="btn btn-sm" style="background:#0891b2;color:#fff;font-size:0.72rem;padding:3px 6px" title="Aggiungi 1 atleta" onclick="updateDemoLimit('${l.licenseKey}','${safeKey}','maxAtleti',1)">+1 atl.</button>
                    <button class="btn btn-sm" style="background:#0891b2;color:#fff;font-size:0.72rem;padding:3px 6px" title="Aggiungi 1 coach" onclick="updateDemoLimit('${l.licenseKey}','${safeKey}','maxCoach',1)">+1 coach</button>
                    ` : ''}
                </div>
            </td>
```

- [ ] **Step 3: Aggiungere la funzione JS `updateDemoLimit`**

Subito dopo `toggleAI` (dopo riga 1295):

```js
async function updateDemoLimit(licenseKey, safeKey, field, delta) {
    try {
        const r = await fetch(`${API_BASE}/api/licenze?action=update-demo-limits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Super-Admin-Password': ADMIN_PWD },
            body: JSON.stringify({ licenseKey, field, delta })
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.message || 'Errore');
        showToast(field === 'expiry' ? `✅ +${delta} giorni aggiunti` : `✅ Limite ${field} aggiornato`);
        loadLicenze(); // ricarica l'intera tabella per riflettere il nuovo stato
    } catch (e) {
        showToast('❌ ' + e.message);
    }
}
```

**Nota:** verificare il nome esatto della funzione che ricarica la tabella (cercare `function loadLicenze` o simile in `public/superadmin.html`); se il nome è diverso, usare quello esistente.

- [ ] **Step 4: Verificare il nome della funzione di reload**

Run: `grep -n "async function load\|function fetchLicenze\|function refreshLicenze" public/superadmin.html`
Expected: individuare il nome corretto, correggere `loadLicenze()` nello Step 3 se necessario

- [ ] **Step 5: Commit**

```bash
git add public/superadmin.html
git commit -m "feat(demo): aggiunge badge DEMO, colonne atleti/coach e controlli inline nel pannello superadmin"
```

---

### Task 10: Popolare `demoAtletiCount`/`demoCoachCount` nella action `list` di `api/licenze.js`

**Files:**
- Modify: `api/licenze.js:195-209` (action che restituisce l'elenco licenze usato da `renderTable`)

**Motivo:** il Task 9 usa `l.demoAtletiCount`/`l.demoCoachCount` nella UI, ma la action `list` oggi non calcola questi campi — vanno aggiunti lato server per le sole righe `plan === 'demo'`.

- [ ] **Step 1: Individuare la action `list` esatta**

Run: `grep -n "action === 'list'\|action = req.query" api/licenze.js`

- [ ] **Step 2: Estendere il blocco che costruisce `licenze` (righe 195-209 circa)**

Sostituire:

```js
      const keys = await kv.smembers('licenze:index');
      const today = new Date().toISOString().split('T')[0];
      const results = await Promise.all(keys.map(k => kv.get(`licenze:${k}`)));
      const licenze = results
        .filter(Boolean)
        .map((data, i) => ({
          ...data,
          licenseKey: keys[i],
          isExpired: data.expiry < today,
          daysLeft: Math.ceil((new Date(data.expiry) - new Date()) / (1000 * 60 * 60 * 24))
        }));
```

con:

```js
      const keys = await kv.smembers('licenze:index');
      const today = new Date().toISOString().split('T')[0];
      const results = await Promise.all(keys.map(k => kv.get(`licenze:${k}`)));
      const allAnnateForCount = results.some(d => d && d.plan === 'demo') ? ((await kv.get('annate:list')) || []) : [];
      const allUsersForCount = results.some(d => d && d.plan === 'demo') ? ((await kv.get('auth:users')) || []) : [];
      const licenze = await Promise.all(results
        .filter(Boolean)
        .map(async (data, i) => {
          const base = {
            ...data,
            licenseKey: keys[i],
            isExpired: data.expiry < today,
            daysLeft: Math.ceil((new Date(data.expiry) - new Date()) / (1000 * 60 * 60 * 24))
          };
          if (data.plan === 'demo') {
            const societyAnnate = allAnnateForCount.filter(a => a.societyId === data.societyId);
            let atletiCount = 0;
            for (const annata of societyAnnate) {
              const athletes = (await kv.get(`annate:${annata.id}:athletes`)) || [];
              atletiCount += athletes.filter(a => !a.isGuest).length;
            }
            const coachCount = allUsersForCount.filter(u => u.societyId === data.societyId && String(u.role || '').startsWith('coach')).length;
            base.demoAtletiCount = atletiCount;
            base.demoCoachCount = coachCount;
          }
          return base;
        }));
```

- [ ] **Step 3: Verificare la sintassi**

Run: `node --check api/licenze.js`
Expected: nessun output (exit code 0)

- [ ] **Step 4: Test manuale (dopo deploy)**

Run:
```bash
curl -s "https://app-allenamento-r1.vercel.app/api/licenze?action=list" \
  -H "X-Super-Admin-Password: <SUPER_ADMIN_PASSWORD>" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      const j=JSON.parse(d);
      const demo = j.licenze.filter(l=>l.plan==='demo');
      console.log(JSON.stringify(demo, null, 2));
    })"
```
Expected: le licenze demo mostrano `demoAtletiCount` e `demoCoachCount` come numeri

- [ ] **Step 5: Commit**

```bash
git add api/licenze.js
git commit -m "feat(demo): calcola conteggio atleti/coach per licenze demo nella action list"
```

---

### Task 11: Form pubblico "Prova gratis 3 mesi" sulla landing page

**Files:**
- Modify: file HTML della landing page in `C:\Temp\sport-monitoring` (individuare il file esatto — verosimilmente `index.html` — con `Glob`/`Grep` prima di procedere, la struttura esatta non è stata ancora ispezionata in questa sessione)

- [ ] **Step 1: Individuare il file e la sezione dove inserire il form**

Run: `grep -rn "form\|Prova gratis\|contact" "C:\Temp\sport-monitoring\index.html" | head -20`

(Se il file principale ha un nome diverso, cercarlo prima con un elenco della cartella.)

- [ ] **Step 2: Aggiungere una sezione form con i 4 campi richiesti**

Il form deve avere: nome società/squadra, nome referente, email, telefono. Validazione client-side su email (regex standard) e telefono (`/^(\+39)?\s?3\d{8,9}$/`), poi POST verso `https://app-allenamento-r1.vercel.app/api/data?action=demo-signup` con body `{societyName, refName, email, phone}` (stessi nomi campo dell'endpoint del Task 2). Il contenuto HTML esatto e lo stile vanno adattati al design esistente della landing page — ispezionare `index.html` per riusare le classi CSS già presenti (stesso pattern del form contatti già esistente, se presente).

- [ ] **Step 3: Test manuale nel browser (dopo deploy della landing page)**

Compilare il form con dati di test e verificare che arrivi l'email di conferma e l'email di notifica lead.

- [ ] **Step 4: Commit (nel repo della landing page, separato da questo progetto)**

```bash
cd "C:\Temp\sport-monitoring"
git add .
git commit -m "feat: aggiunge form Prova gratis 3 mesi collegato a demo-signup"
```

---

## Self-Review

**1. Spec coverage:**
- Flusso 1 (registrazione) → Task 2, Task 11 ✅
- Flusso 2 (conferma + attivazione) → Task 3, Task 4 ✅
- Modello dati (licenza demo, indici anti-abuso) → Task 2 (creazione), Task 3 (promozione indici) ✅
- Flusso 3 (limiti server-side) → Task 5 ✅
- Flusso 4 (notifiche/ciclo di vita nel cron) → Task 7 ✅
- Blocco login su demo scaduta → Task 6 (dettaglio scoperto in fase di ricerca, non esplicito nello spec come task separato ma necessario per realizzare "Blocco login totale" del Flusso 4) ✅
- Flusso 5 (pannello superadmin) → Task 8, Task 9, Task 10 ✅
- Vincolo tecnico (nessun nuovo file `.js`) → rispettato in tutti i task, nessun file nuovo in `api/` ✅
- Edge case "pending duplicato" → gestito in Task 2 (check `demo:pending:<email>` con TTL 48h) ✅
- Edge case "confronto scadenza `>=`" → Task 7 usa `msLeft <= 0` equivalente a `now >= demoExpiresAt` ✅
- Edge case "idempotenza cancellazione" → Task 7, ogni `kv.del` è in try/catch isolato, il purge non fallisce se già eseguito ✅

**2. Placeholder scan:** nessun "TBD"/"TODO" nei task. Task 11 ha un passo di ricerca esplicito perché la struttura della landing page non è stata ispezionata in questa sessione (non è un placeholder di codice, è un passo di lavoro reale — coerente con l'incertezza dichiarata).

**3. Type consistency:** `demoLimits: {maxAtleti, maxDirigenti, maxCoach}` usato identico in Task 2, 5, 8, 10. `demoStatus: 'pending'|'active'|'expired'|'purged'` usato identico in Task 2, 3, 7, 8. Funzioni `generateDemoToken`/`verifyDemoToken` definite in Task 1 e usate senza modifiche di firma in Task 2/3. `hashPasswordScrypt` importato in Task 3, stesso nome esportato da `_password.js` verificato in fase di ricerca.

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-27-demo-gratuita.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
