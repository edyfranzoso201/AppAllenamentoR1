// api/annate/update.js - Modifica annata esistente
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
    const { id, nome, dataInizio, dataFine, descrizione } = req.body;
    
    if (!id || !nome || !dataInizio || !dataFine) {
      return res.status(400).json({ 
        success: false,
        message: 'ID, nome, data inizio e data fine sono obbligatori' 
      });
    }
    
    // Carica annate
    const annate = (await kv.get('annate:list')) || [];
    
    // Trova annata
    const annataIndex = annate.findIndex(a => a.id === id);
    
    if (annataIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Annata non trovata' 
      });
    }
    
    // Aggiorna
    annate[annataIndex] = {
      ...annate[annataIndex],
      nome,
      dataInizio,
      dataFine,
      descrizione: descrizione || '',
      updatedAt: new Date().toISOString()
    };
    
    // Salva
    await kv.set('annate:list', annate);
    
    console.log(`✅ Annata aggiornata: ${nome} (${id})`);
    
    return res.status(200).json({ 
      success: true,
      message: 'Annata aggiornata con successo',
      annata: annate[annataIndex]
    });
    
  } catch (error) {
    console.error('❌ Errore in /api/annate/update:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}