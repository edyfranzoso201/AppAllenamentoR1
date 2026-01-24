// api/auth/create-user.js - Crea nuovo utente
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
    const { username, password, email, role, annate } = req.body;
    
    // Validazione
    if (!username || !password || !role) {
      return res.status(400).json({ 
        success: false,
        message: 'Username, password e ruolo sono obbligatori' 
      });
    }
    
    if (!['admin', 'supercoach', 'coach'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: 'Ruolo non valido' 
      });
    }
    
    // Carica utenti esistenti
    const users = (await kv.get('auth:users')) || [];
    
    // Verifica se username esiste già
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ 
        success: false,
        message: 'Username già esistente' 
      });
    }
    
    // Crea nuovo utente
    const newUser = {
      username,
      password: hashPassword(password),
      email: email || '',
      role,
      annate: role === 'coach' ? (annate || []) : [],
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    // Salva
    await kv.set('auth:users', users);
    
    console.log(`✅ Utente creato: ${username} (${role})`);
    
    return res.status(200).json({ 
      success: true,
      message: 'Utente creato con successo',
      user: {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        annate: newUser.annate
      }
    });
    
  } catch (error) {
    console.error('❌ Errore in /api/auth/create-user:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}