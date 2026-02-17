// api/auth/login.js - Login con restituzione societyId
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
    console.log(`   📊 Totale utenti nel DB: ${users.length}`);

    const user = users.find(u => u.username === username);

    if (!user) {
      console.log(`   ❌ Utente "${username}" non trovato`);
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }

    console.log(`   ✅ Utente trovato: ${username} (${user.role}) societyId=${user.societyId || 'legacy'}`);

    const passwordHash = hashPassword(password);
    if (user.password !== passwordHash) {
      console.log(`   ❌ Password errata`);
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }

    console.log(`   ✅ Password corretta!`);

    // Login riuscito — restituisce societyId fondamentale per il filtro
    return res.status(200).json({
      success: true,
      message: 'Login effettuato con successo',
      role: user.role,
      societyId: user.societyId || null,   // ← il client salva questo in sessionStorage
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
