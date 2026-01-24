// api/auth/init.js - Inizializza utente admin (esegui UNA VOLTA)
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verifica se esistono già utenti
    const existingUsers = (await kv.get('auth:users')) || [];
    
    if (existingUsers.length > 0) {
      return res.status(200).json({ 
        success: true,
        message: 'Sistema già inizializzato',
        users: existingUsers.length
      });
    }
    
    // Crea utente admin di default
    const adminUser = {
      username: 'admin',
      password: hashPassword('admin201'), // Password di default
      email: 'admin@gosport.com',
      role: 'admin',
      annate: [],
      createdAt: new Date().toISOString()
    };
    
    await kv.set('auth:users', [adminUser]);
    
    console.log('✅ Utente admin creato: admin / admin201');
    
    return res.status(200).json({ 
      success: true,
      message: 'Sistema inizializzato con successo',
      credentials: {
        username: 'admin',
        password: 'admin201'
      },
      warning: 'CAMBIA LA PASSWORD AL PRIMO ACCESSO!'
    });
    
  } catch (error) {
    console.error('❌ Errore in /api/auth/init:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}