// api/auth/delete-user.js - Elimina utente
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
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false,
        message: 'Username obbligatorio' 
      });
    }
    
    // Carica utenti
    const users = (await kv.get('auth:users')) || [];
    
    // Trova utente
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Utente non trovato' 
      });
    }
    
    // Non permettere eliminazione admin
    if (user.role === 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Non è possibile eliminare un amministratore' 
      });
    }
    
    // Rimuovi utente
    const updatedUsers = users.filter(u => u.username !== username);
    
    // Salva
    await kv.set('auth:users', updatedUsers);
    
    console.log(`✅ Utente eliminato: ${username}`);
    
    return res.status(200).json({ 
      success: true,
      message: 'Utente eliminato con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore in /api/auth/delete-user:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}