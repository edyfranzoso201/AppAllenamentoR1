// api/annate/list.js - Restituisce tutte le annate disponibili
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
    // Recupera tutte le annate
    const annate = (await kv.get('annate:list')) || [];
    
    // Ordina per data di inizio (più recenti prima)
    const sortedAnnate = annate.sort((a, b) => {
      return new Date(b.dataInizio) - new Date(a.dataInizio);
    });

    console.log(`✅ Lista annate richiesta: ${sortedAnnate.length} annate trovate`);

    return res.status(200).json({
      success: true,
      annate: sortedAnnate
    });

  } catch (error) {
    console.error('❌ Errore in /api/annate/list:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore nel recupero delle annate',
      error: error.message
    });
  }
}
