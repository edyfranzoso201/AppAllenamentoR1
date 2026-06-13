// api/auth/change-password.js — cambio password self-service
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

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

function hashPasswordLegacy(password) {
  return Buffer.from(password).toString('base64');
}

function isLegacyHash(hash) {
  return hash && !/^[0-9a-f]{64}$/.test(hash);
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Session, X-Auth-User, X-User-Role, X-Society-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const sessionToken = req.headers['x-auth-session'];
    const { currentPassword, newPassword } = req.body;

    // Validazioni base
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Compilare tutti i campi' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'La nuova password deve avere almeno 6 caratteri' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'La nuova password deve essere diversa da quella attuale' });
    }

    // Verifica sessione attiva (usa il session token, non il flag booleano)
    if (!sessionToken) {
      return res.status(401).json({ success: false, message: 'Sessione non valida' });
    }
    const session = await kv.get(`session:${sessionToken}`);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Sessione scaduta, effettua nuovamente il login' });
    }
    // TTL scorrevole: rinnova la scadenza della sessione a 8h da ora (soft)
    try { await kv.expire(`session:${sessionToken}`, 8 * 60 * 60); } catch (e) { /* non bloccante */ }
    const username = session.username;

    // Carica l'utente dal KV
    let user = await kv.get(`auth:user:${username.toLowerCase()}`);
    if (user && user.username !== username) user = null;
    if (!user) {
      const users = (await kv.get('auth:users')) || [];
      user = users.find(u => u.username === username) || null;
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    // Verifica password attuale (SHA256 e legacy base64)
    const passwordOk =
      user.password === hashPassword(currentPassword) ||
      (isLegacyHash(user.password) && user.password === hashPasswordLegacy(currentPassword));

    if (!passwordOk) {
      return res.status(401).json({ success: false, message: 'Password attuale non corretta' });
    }

    // Aggiorna in entrambe le strutture KV (array + chiave individuale)
    const newHash = hashPassword(newPassword);
    const allUsers = (await kv.get('auth:users')) || [];
    const idx = allUsers.findIndex(u => u.username === username);
    if (idx !== -1) {
      allUsers[idx].password  = newHash;
      allUsers[idx].updatedAt = new Date().toISOString();
      await Promise.all([
        kv.set('auth:users', allUsers),
        kv.set(`auth:user:${username.toLowerCase()}`, allUsers[idx]),
      ]);
    }

    console.log(`✅ Password cambiata per: ${username}`);
    return res.status(200).json({ success: true, message: 'Password aggiornata con successo' });

  } catch (error) {
    console.error('❌ Errore in /api/auth/change-password:', error);
    return res.status(500).json({ success: false, message: 'Errore del server' });
  }
}
