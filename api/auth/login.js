// api/auth/login.js - Endpoint per login utenti
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username e password obbligatori'
      });
    }

    // Carica tutti gli utenti
    const users = (await kv.get('auth:users')) || [];
    
    // Trova l'utente
    const user = users.find(u => u.username === username);
    
    if (!user) {
      console.log(`❌ Login fallito: utente "${username}" non trovato`);
      return res.status(401).json({
        success: false,
        message: 'Credenziali non valide'
      });
    }

    // Verifica password
    const passwordHash = hashPassword(password);
    
    if (user.password !== passwordHash) {
      console.log(`❌ Login fallito: password errata per "${username}"`);
      console.log(`   Hash ricevuto: ${passwordHash.substring(0, 20)}...`);
      console.log(`   Hash atteso:   ${user.password.substring(0, 20)}...`);
      return res.status(401).json({
        success: false,
        message: 'Credenziali non valide'
      });
    }

    // Login riuscito
    console.log(`✅ Login riuscito: ${username} (${user.role})`);
    
    return res.status(200).json({
      success: true,
      message: 'Login effettuato con successo',
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        annate: user.annate || []
      }
    });

  } catch (error) {
    console.error('❌ Errore in /api/auth/login:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore del server',
      error: error.message
    });
  }
}
