// api/annate/add-existing.js - Aggiungi annata esistente alla lista
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
    return res.status(405).json({ message: 'Use POST' });
  }

  try {
    const { id, nome, dataInizio, dataFine, descrizione } = req.body;

    if (!id || !nome || !dataInizio || !dataFine) {
      return res.status(400).json({
        success: false,
        message: 'Campi obbligatori: id, nome, dataInizio, dataFine'
      });
    }

    // Recupera lista annate esistente
    const annate = (await kv.get('annate:list')) || [];

    // Verifica se l'annata esiste già
    if (annate.find(a => a.id === id)) {
      return res.status(400).json({
        success: false,
        message: 'Annata già presente nella lista'
      });
    }

    // Verifica che i dati esistano effettivamente
    const athletes = await kv.get(`annate:${id}:athletes`);
    if (!athletes) {
      return res.status(404).json({
        success: false,
        message: `Nessun dato trovato per l'ID ${id}`
      });
    }

    // Aggiungi l'annata alla lista
    const newAnnata = {
      id,
      nome,
      dataInizio,
      dataFine,
      descrizione: descrizione || '',
      createdAt: new Date().toISOString(),
      recovered: true // Flag per indicare che è stata recuperata
    };

    annate.push(newAnnata);
    await kv.set('annate:list', annate);

    console.log(`✅ Annata recuperata e aggiunta: ${nome} (${id})`);
    console.log(`   Atleti trovati: ${athletes.length}`);

    return res.status(200).json({
      success: true,
      message: 'Annata aggiunta con successo alla lista',
      annata: newAnnata,
      athletesCount: athletes.length
    });

  } catch (error) {
    console.error('❌ Errore in add-existing:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore del server',
      error: error.message
    });
  }
}
