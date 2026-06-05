// api/auth/login.js - Login con verifica automatica licenza
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Helper CORS — accetta solo domini autorizzati
function setCors(req, res) {
  const origin = req.headers['origin'] || '';
  const allowed = [
    'https://app-allenamento-r1.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ];
  const originToSet = allowed.includes(origin) ? origin : allowed[0];
  res.setHeader('Access-Control-Allow-Origin', originToSet);
  res.setHeader('Vary', 'Origin');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Hash legacy (base64) — usato SOLO per migrare le vecchie password
function hashPasswordLegacy(password) {
  return Buffer.from(password).toString('base64');
}

// Riconosce se un hash è SHA256 (64 caratteri hex) o base64 (legacy)
function isLegacyHash(hash) {
  return hash && !/^[0-9a-f]{64}$/.test(hash);
}

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
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
    case 'staff':
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
    default:
      return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: false };
  }
}

// Helper: incrementa contatore tentativi falliti
async function incrementRateLimit(kv, key, maxAttempts, windowSec) {
  const existing = await kv.get(key) || { attempts: 0, resetAt: 0 };
  const attempts = existing.attempts + 1;
  const resetAt = attempts >= maxAttempts
    ? Date.now() + windowSec * 1000
    : existing.resetAt;
  await kv.set(key, { attempts, resetAt });
  // TTL automatico per pulizia (windowSec + 60 secondi di margine)
  await kv.expire(key, windowSec + 60);
  return attempts;
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // ── Configurazione Rate Limiting ──────────────────────────────
  const RL_MAX_ATTEMPTS = 5;     // tentativi falliti prima del blocco
  const RL_WINDOW_SEC   = 15 * 60; // blocco di 15 minuti

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username e password obbligatori' });
    }

    // ── Controlla rate limit ────────────────────────────────────
    const rlKey = `ratelimit:${username.toLowerCase()}`;
    const rlData = await kv.get(rlKey);
    if (rlData && rlData.attempts >= RL_MAX_ATTEMPTS) {
      const remainingMs = (rlData.resetAt - Date.now());
      if (remainingMs > 0) {
        const mins = Math.ceil(remainingMs / 60000);
        console.log(`   🚫 Rate limit attivo per ${username} — ancora ${mins} min`);
        return res.status(429).json({
          success: false,
          message: `Troppi tentativi falliti. Riprova tra ${mins} minuti.`
        });
      }
      // Blocco scaduto — pulisci
      await kv.del(rlKey);
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
      await incrementRateLimit(kv, rlKey, RL_MAX_ATTEMPTS, RL_WINDOW_SEC);
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }

    // ── Verifica password con migrazione automatica ──────────────
    const passwordHashSHA256 = hashPassword(password);
    const passwordHashLegacy = hashPasswordLegacy(password);

    let passwordOk = false;
    let needsMigration = false;

    if (user.password === passwordHashSHA256) {
      // Password già in SHA256 — ok
      passwordOk = true;
    } else if (isLegacyHash(user.password) && user.password === passwordHashLegacy) {
      // Password ancora in base64 legacy — ok ma migriamo subito a SHA256
      passwordOk = true;
      needsMigration = true;
      console.log(`   🔄 Migrazione password a SHA256 per: ${username}`);
    }

    if (!passwordOk) {
      console.log(`   ❌ Password errata per ${username}`);
      const attempts = await incrementRateLimit(kv, rlKey, RL_MAX_ATTEMPTS, RL_WINDOW_SEC);
      const remaining = RL_MAX_ATTEMPTS - attempts;
      return res.status(401).json({
        success: false,
        message: remaining > 0
          ? `Credenziali non valide. Ancora ${remaining} tentativi prima del blocco.`
          : `Troppi tentativi falliti. Account bloccato per ${RL_WINDOW_SEC / 60} minuti.`
      });
    }

    // Migrazione automatica: risalva la password in SHA256
    if (needsMigration) {
      try {
        const allUsers = (await kv.get('auth:users')) || [];
        const idx = allUsers.findIndex(u => u.username === username);
        if (idx !== -1) {
          allUsers[idx].password = passwordHashSHA256;
          await kv.set('auth:users', allUsers);
          console.log(`   ✅ Password migrata a SHA256 per: ${username}`);
        }
      } catch(e) {
        // Migrazione fallita — non blocca il login
        console.warn(`   ⚠️ Migrazione SHA256 fallita per ${username}:`, e.message);
      }
    }

    // ── Login riuscito: azzera contatore tentativi ─────────────
    await kv.del(`ratelimit:${username.toLowerCase()}`);
    console.log(`   ✅ Login OK: ${username} (${user.role}) societyId=${user.societyId || 'legacy'}`);

    // ── Genera token di sessione lato server (TTL 8 ore) ─────────
    const sessionToken = crypto.randomUUID();
    await kv.set(`session:${sessionToken}`, {
      username: user.username,
      role: user.role,
      societyId: user.societyId || null
    });
    await kv.expire(`session:${sessionToken}`, 8 * 60 * 60);

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
        permissions: getPermissions(user.role)
      }
    });

  } catch (error) {
    console.error('❌ Errore in /api/auth/login:', error);
    return res.status(500).json({ success: false, message: 'Errore del server' });
  }
}
