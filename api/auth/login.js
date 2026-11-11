// api/auth/login.js - Login con verifica automatica licenza
import { createClient } from '@vercel/kv';
import crypto from 'crypto';
import { verifyPassword, hashPasswordScrypt } from './_password.js';
import { RL_LOGIN, ipDi, statoBloccoLogin, registraLoginFallito, azzeraLoginRiuscito } from './_login-ratelimit.js';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Durata della sessione, condivisa da tutti gli endpoint che la rinnovano.
// TTL scorrevole: ogni chiamata autenticata la riporta a questo valore, quindi
// conta l'INATTIVITA, non il tempo dal login. Deve restare allineata a
// SESSION_DURATION_MS in public/auth-multi-annata.js: se il client scade prima
// del server l'utente si ritrova la password richiesta mentre la sessione e
// ancora valida lato server (era il difetto delle 8 ore fisse).
const SESSION_TTL_SEC = 30 * 24 * 60 * 60; // 30 giorni

// Helper CORS — accetta solo domini autorizzati
function setCors(req, res) {
  const origin = req.headers['origin'] || '';
  const allowed = [
    'https://app-allenamento-r1.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ];
  // Setta Allow-Origin SOLO per origini in whitelist. Per un'origine
  // sconosciuta non settiamo l'header: il browser blocca la richiesta
  // cross-origin. Le richieste senza header Origin (same-origin, cron,
  // server-to-server) non sono soggette a CORS e passano comunque.
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
}

// L'hashing/verifica password vive in ./_password.js (scrypt salato + legacy
// SHA256/base64 con migrazione lazy). Importati: verifyPassword, hashPasswordScrypt.

// Restituisce i permessi in base al ruolo
function getPermissions(role) {
  switch(role) {
    case 'admin':
      return { canEditGeneral: true, canViewGPS: true, canEditGPS: true, isAdmin: true, isDashboard: false };
    case 'coach_l0':
      return { canEditGeneral: true, canViewGPS: true, canEditGPS: true, isAdmin: false, isDashboard: true };
    case 'coach_l1':
      return { canEditGeneral: true, canViewGPS: true, canEditGPS: true, isAdmin: false, isDashboard: false };
    case 'coach_l2':
      return { canEditGeneral: true, canViewGPS: true, canEditGPS: false, isAdmin: false, isDashboard: false };
    case 'coach_l3':
      return { canEditGeneral: false, canViewGPS: true, canEditGPS: false, isAdmin: false, isDashboard: false };
    case 'coach_readonly':
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: false };
    // Ruoli Dashboard — accesso solo alla Dashboard (licenza Platinum)
    case 'direttivo':
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
    case 'dirigente':
      // A2 Dirigente (ruolo Dashboard): sola visualizzazione nell'app principale.
      // canWrite() in api/data.js non lo ammette, quindi canEditGeneral:true gli
      // mostrava pulsanti di modifica che il server rifiutava con 403.
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
    case 'dirigente_l1':
    case 'dirigente_l2':
      // Dirigente L1 ("Edit + Materiale Completo") e L2 ("Edit + Materiale"):
      // possono creare/modificare atleti. Gli utenti sono creati col ruolo
      // suffissato (dirigente_l1/l2), non 'dirigente' base, quindi vanno elencati
      // esplicitamente qui. canEditGeneral:true DEVE combaciare col client
      // (script.js getPermissions + DASHBOARD_APP_PERMS) e con canWrite() in
      // api/data.js. Prima solo 'dirigente' base era gestito → il pulsante
      // "Salva Atleta" spariva e il salvataggio veniva rifiutato (perdita dati).
      return { canEditGeneral: true, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
    case 'dirigente_l3':
    case 'dirigente_l4':
      // L3 ("Squadra") e L4 ("Solo Materiale"): NON creano/modificano atleti.
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
    case 'staff':
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
    default:
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: false };
  }
}

// I limiti sui tentativi falliti (per utente+IP, per IP, per utente) stanno in
// ./_login-ratelimit.js.

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body || {};

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Username e password obbligatori' });
    }

    // ── Controlla rate limit ────────────────────────────────────
    // Il blocco dopo 5 errori vale per utente + indirizzo: chi sbaglia apposta
    // la password di un altro blocca se stesso, non il titolare dell'account.
    const ip = ipDi(req);
    const blocco = await statoBloccoLogin(kv, username, ip);
    if (blocco.bloccato) {
      console.log(`   🚫 Rate limit (${blocco.motivo}) per ${username} — ancora ${blocco.minuti} min`);
      return res.status(429).json({
        success: false,
        message: blocco.motivo === 'ip'
          ? `Troppi tentativi falliti da questa rete. Riprova tra ${blocco.minuti} minuti.`
          : `Troppi tentativi falliti. Riprova tra ${blocco.minuti} minuti.`
      });
    }

    console.log(`🔐 Tentativo login: ${username}`);

    // Lookup O(1) per chiave individuale, fallback a scansione array
    let user = await kv.get(`auth:user:${username.toLowerCase()}`);
    if (user && user.username !== username) user = null; // case-sensitive check
    if (!user) {
      const users = (await kv.get('auth:users')) || [];
      user = users.find(u => u.username === username) || null;
    }

    if (!user) {
      console.log(`   ❌ Utente "${username}" non trovato`);
      // Incrementa contatore anche per utenti inesistenti (evita user enumeration)
      await registraLoginFallito(kv, username, ip);
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }

    // ── Blocco account scaduto ─────────────────────────────────
    // expiryDate è 'YYYY-MM-DD': confronto lessicografico con la data odierna
    // (stesso formato) è equivalente al confronto cronologico, senza fusi orari.
    if (user.expiryDate && user.expiryDate < new Date().toISOString().split('T')[0]) {
      console.log(`   ❌ Account scaduto: ${username} (expiryDate=${user.expiryDate})`);
      return res.status(403).json({ success: false, message: 'Account scaduto. Contatta l\'amministratore per il rinnovo.' });
    }

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

    // ── Verifica password con migrazione automatica ──────────────
    // verifyPassword gestisce scrypt (nuovo) + SHA256/base64 (legacy).
    // needsMigration=true quando la password era valida ma in formato legacy:
    // la risalviamo in scrypt (lazy migration), così il parco si aggiorna.
    const { ok: passwordOk, needsMigration } = verifyPassword(password, user.password);

    if (!passwordOk) {
      console.log(`   ❌ Password errata per ${username}`);
      const remaining = await registraLoginFallito(kv, username, ip);
      return res.status(401).json({
        success: false,
        message: remaining > 0
          ? `Credenziali non valide. Ancora ${remaining} tentativi prima del blocco.`
          : `Troppi tentativi falliti. Accesso bloccato per ${RL_LOGIN.WINDOW_SEC / 60} minuti.`
      });
    }

    // Un account senza società non entra. Prima otteneva una sessione "legacy"
    // (societyId null) che vedeva tutte le annate senza società e scriveva i
    // banner globali. Il controllo sta DOPO la password: chi non la conosce non
    // deve poter capire quali account esistono.
    if (!user.societyId) {
      console.log(`   ❌ Account senza società: ${username}`);
      return res.status(403).json({ success: false, message: "Account non associato a una società. Contatta l'assistenza." });
    }

    // Migrazione automatica: risalva la password in scrypt (salt random).
    // Va aggiornata SIA la lista auth:users SIA la chiave individuale
    // auth:user:<lower> (il login fa lookup O(1) da quella chiave: se non la
    // migrassi, al prossimo login rileggerebbe ancora l'hash legacy).
    if (needsMigration) {
      try {
        const newHash = hashPasswordScrypt(password);
        const lower = username.toLowerCase();
        const allUsers = (await kv.get('auth:users')) || [];
        const idx = allUsers.findIndex(u => u.username === username);
        const ops = [];
        if (idx !== -1) {
          allUsers[idx].password = newHash;
          ops.push(kv.set('auth:users', allUsers));
        }
        // Aggiorna anche la chiave individuale (se esiste)
        const indUser = await kv.get(`auth:user:${lower}`);
        if (indUser) {
          indUser.password = newHash;
          ops.push(kv.set(`auth:user:${lower}`, indUser));
        }
        await Promise.all(ops);
        console.log(`   ✅ Password migrata a scrypt per: ${username}`);
      } catch(e) {
        // Migrazione fallita — non blocca il login
        console.warn(`   ⚠️ Migrazione scrypt fallita per ${username}:`, e.message);
      }
    }

    // ── Login riuscito: azzera contatore tentativi ─────────────
    await azzeraLoginRiuscito(kv, username, ip);
    console.log(`   ✅ Login OK: ${username} (${user.role}) societyId=${user.societyId}`);

    // ── Genera token di sessione lato server (TTL 8 ore) ─────────
    const sessionToken = crypto.randomUUID();
    await kv.set(`session:${sessionToken}`, {
      username: user.username,
      role: user.role,
      societyId: user.societyId
    });
    await kv.expire(`session:${sessionToken}`, SESSION_TTL_SEC);

    // ==========================================
    // VERIFICA LICENZA AUTOMATICA (solo admin)
    // ==========================================
    let licenseStatus = null;

    if (user.role === 'admin' && user.societyId) {
      // Lookup diretto tramite indice societyId (2 query invece di N)
      const licenseKey = await kv.get(`licenze_society:${user.societyId}`);
      let validLicense = null;

      if (licenseKey) {
        const license = await kv.get(`licenze:${licenseKey}`);
        if (license && license.societyId === user.societyId) {
          const today = new Date().toISOString().split('T')[0];

          if (!license.active) {
            licenseStatus = { valid: false, reason: 'revoked', message: 'Licenza disattivata' };
          } else if (license.expiry < today) {
            licenseStatus = { valid: false, reason: 'expired', message: 'Licenza scaduta', expiry: license.expiry };
          } else {
            validLicense = license;
            licenseStatus = {
              valid: true,
              societyName: license.societyName,
              expiry: license.expiry,
              plan: license.plan || 'platinum',
              aiEnabled: license.aiEnabled === true,
              daysLeft: Math.ceil((new Date(license.expiry) - new Date()) / (1000 * 60 * 60 * 24))
            };
            license.lastAccess = new Date().toISOString();
            await kv.set(`licenze:${licenseKey}`, license);
          }
        }
      }

      // Nessuna licenza trovata per questo societyId
      if (!validLicense && !licenseStatus) {
        licenseStatus = { valid: false, reason: 'missing', message: 'Nessuna licenza attiva' };
      }
    }

    // ==========================================
    // RISPOSTA
    // ==========================================
    return res.status(200).json({
      success: true,
      message: 'Login effettuato con successo',
      sessionToken,
      role: user.role,
      societyId: user.societyId || null,
      licenseStatus,  // ← il client usa questo per decidere se mostrare la schermata licenza
      user: {
        username: user.username,
        email: user.email || '',
        role: user.role,
        societyId: user.societyId || null,
        annate: user.annate || [],
        expiryDate: user.expiryDate || null,
        permissions: getPermissions(user.role)
      }
    });

  } catch (error) {
    console.error('❌ Errore in /api/auth/login:', error);
    return res.status(500).json({ success: false, message: 'Errore del server' });
  }
}
