// api/annate/create.js - Crea nuova annata
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

function generateAnnataId() {
  return crypto.randomBytes(8).toString('hex');
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
    const { nome, dataInizio, dataFine, descrizione } = req.body;
    
    // Validazione
    if (!nome || !dataInizio || !dataFine) {
      return res.status(400).json({ 
        success: false,
        message: 'Nome, data inizio e data fine sono obbligatori' 
      });
    }
    
    // Carica annate esistenti
    const annate = (await kv.get('annate:list')) || [];
    
    // Verifica se nome esiste già
    if (annate.find(a => a.nome === nome)) {
      return res.status(400).json({ 
        success: false,
        message: 'Esiste già un\'annata con questo nome' 
      });
    }
    
    // Crea nuova annata
    const newAnnata = {
      id: generateAnnataId(),
      nome,
      dataInizio,
      dataFine,
      descrizione: descrizione || '',
      createdAt: new Date().toISOString()
    };
    
    annate.push(newAnnata);
    
    // Salva lista annate
    await kv.set('annate:list', annate);
    
    // Inizializza dati vuoti per la nuova annata
    await kv.set(`annate:${newAnnata.id}:athletes`, []);
    await kv.set(`annate:${newAnnata.id}:evaluations`, {});
    await kv.set(`annate:${newAnnata.id}:gpsData`, {});
    await kv.set(`annate:${newAnnata.id}:awards`, {});
    await kv.set(`annate:${newAnnata.id}:trainingSessions`, {});
    await kv.set(`annate:${newAnnata.id}:formationData`, { starters: [], bench: [], tokens: [] });
    await kv.set(`annate:${newAnnata.id}:matchResults`, {});
    await kv.set(`annate:${newAnnata.id}:calendarEvents`, {});
    await kv.set(`annate:${newAnnata.id}:calendarResponses`, {});
    
    console.log(`✅ Annata creata: ${nome} (${newAnnata.id})`);
    
    return res.status(200).json({ 
      success: true,
      message: 'Annata creata con successo',
      annata: newAnnata
    });
    
  } catch (error) {
    console.error('❌ Errore in /api/annate/create:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}