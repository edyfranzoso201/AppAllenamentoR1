// api/annate/delete.js - Elimina annata e tutti i suoi dati
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
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: 'ID annata obbligatorio' 
      });
    }
    
    // Carica annate
    const annate = (await kv.get('annate:list')) || [];
    
    // Trova annata
    const annata = annate.find(a => a.id === id);
    
    if (!annata) {
      return res.status(404).json({ 
        success: false,
        message: 'Annata non trovata' 
      });
    }
    
    // Rimuovi annata dalla lista
    const updatedAnnate = annate.filter(a => a.id !== id);
    await kv.set('annate:list', updatedAnnate);
    
    // Elimina tutti i dati dell'annata
    const keysToDelete = [
      `annate:${id}:athletes`,
      `annate:${id}:evaluations`,
      `annate:${id}:gpsData`,
      `annate:${id}:awards`,
      `annate:${id}:trainingSessions`,
      `annate:${id}:formationData`,
      `annate:${id}:matchResults`,
      `annate:${id}:calendarEvents`,
      `annate:${id}:calendarResponses`
    ];
    
    for (const key of keysToDelete) {
      try {
        await kv.del(key);
      } catch (e) {
        console.warn(`Impossibile eliminare chiave: ${key}`);
      }
    }
    
    // Rimuovi annata dagli utenti coach
    const users = (await kv.get('auth:users')) || [];
    let usersUpdated = false;
    
    for (let i = 0; i < users.length; i++) {
      if (users[i].annate && users[i].annate.includes(id)) {
        users[i].annate = users[i].annate.filter(a => a !== id);
        usersUpdated = true;
      }
    }
    
    if (usersUpdated) {
      await kv.set('auth:users', users);
    }
    
    console.log(`✅ Annata eliminata: ${annata.nome} (${id})`);
    
    return res.status(200).json({ 
      success: true,
      message: 'Annata eliminata con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore in /api/annate/delete:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}