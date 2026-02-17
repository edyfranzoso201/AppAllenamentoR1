// api/auth/login.js - Login con verifica automatica licenza
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username e password obbligatori' });
    }

    console.log(`🔐 Tentativo login: ${username}`);

    const users = (await kv.get('auth:users')) || [];
    const user = users.find(u => u.username === username);

    if (!user) {
      console.log(`   ❌ Utente "${username}" non trovato`);
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }

    const passwordHash = hashPassword(password);
    if (user.password !== passwordHash) {
      console.log(`   ❌ Password errata per ${username}`);
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }

    console.log(`   ✅ Login OK: ${username} (${user.role}) societyId=${user.societyId || 'legacy'}`);

    // ==========================================
    // VERIFICA LICENZA AUTOMATICA (solo admin)
    // ==========================================
    let licenseStatus = null;

    if (user.role === 'admin' && user.societyId) {
      // Trova tutte le licenze per questo societyId
      const licenseKeys = await kv.keys('licenze:*');
      let validLicense = null;

      for (const key of licenseKeys) {
        const license = await kv.get(key);
        if (license && license.societyId === user.societyId) {
          const today = new Date().toISOString().split('T')[0];
          
          if (!license.active) {
            licenseStatus = { valid: false, reason: 'revoked', message: 'Licenza disattivata' };
            break;
          }
          
          if (license.expiry < today) {
            licenseStatus = { valid: false, reason: 'expired', message: 'Licenza scaduta', expiry: license.expiry };
            break;
          }

          // Licenza valida trovata
          validLicense = license;
          licenseStatus = { 
            valid: true, 
            societyName: license.societyName,
            expiry: license.expiry,
            daysLeft: Math.ceil((new Date(license.expiry) - new Date()) / (1000 * 60 * 60 * 24))
          };

          // Aggiorna lastAccess
          license.lastAccess = new Date().toISOString();
          await kv.set(key, license);
          break;
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
      role: user.role,
      societyId: user.societyId || null,
      licenseStatus,  // ← il client usa questo per decidere se mostrare la schermata licenza
      user: {
        username: user.username,
        email: user.email || '',
        role: user.role,
        societyId: user.societyId || null,
        annate: user.annate || []
      }
    });

  } catch (error) {
    console.error('❌ Errore in /api/auth/login:', error);
    return res.status(500).json({ success: false, message: 'Errore del server', error: error.message });
  }
}
