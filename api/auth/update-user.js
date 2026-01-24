// api/auth/update-user.js - Modifica utente esistente
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

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
    const { username, email, role, annate } = req.body;
    
    if (!username || !role) {
      return res.status(400).json({ 
        success: false,
        message: 'Username e ruolo sono obbligatori' 
      });
    }
    
    // Carica utenti
    const users = (await kv.get('auth:users')) || [];
    
    // Trova utente
    const userIndex = users.findIndex(u => u.username === username);
    
    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Utente non trovato' 
      });
    }
    
    // Aggiorna (mantieni password originale)
    users[userIndex] = {
      ...users[userIndex],
      email: email || users[userIndex].email,
      role,
      annate: role === 'coach' ? (annate || []) : [],
      updatedAt: new Date().toISOString()
    };
    
    // Salva
    await kv.set('auth:users', users);
    
    console.log(`✅ Utente aggiornato: ${username}`);
    
    return res.status(200).json({ 
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        username: users[userIndex].username,
        email: users[userIndex].email,
        role: users[userIndex].role,
        annate: users[userIndex].annate
      }
    });
    
  } catch (error) {
    console.error('❌ Errore in /api/auth/update-user:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}