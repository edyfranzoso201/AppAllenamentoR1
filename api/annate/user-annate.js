// api/annate/user-annate.js - Restituisce le annate assegnate a un utente specifico
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo GET consentito
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed. Use GET.' 
    });
  }

  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Parametro "username" obbligatorio'
      });
    }

    // Recupera lista utenti
    const users = (await kv.get('auth:users')) || [];
    
    // Trova l'utente
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utente non trovato',
        annate: []
      });
    }

    // Restituisci gli ID delle annate assegnate
    const userAnnate = user.annate || [];

    console.log(`✅ Annate per ${username}: [${userAnnate.join(', ')}]`);

    return res.status(200).json({
      success: true,
      annate: userAnnate,
      username: username,
      role: user.role
    });

  } catch (error) {
    console.error('❌ Errore in /api/annate/user-annate:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore nel recupero delle annate utente',
      error: error.message,
      annate: []
    });
  }
}
