// api/auth/users.js - Lista tutti gli utenti
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo non consentito' });
  }

  try {
    // Carica lista utenti dal KV
    const users = (await kv.get('auth:users')) || [];
    
    console.log(`✅ Caricati ${users.length} utenti`);
    
    return res.status(200).json({ 
      success: true,
      users: users 
    });
    
  } catch (error) {
    console.error('❌ Errore in /api/auth/users:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}