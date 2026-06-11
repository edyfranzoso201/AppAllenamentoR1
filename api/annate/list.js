// api/annate/list.js - Restituisce annate filtrate per società
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Society-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use GET.' });
  }

  try {
    const annate = (await kv.get('annate:list')) || [];

    // Legge societyId dall'header (aggiunto automaticamente dal fetch interceptor)
    const societyId = req.headers['x-society-id'];

    let filtered;
    if (societyId) {
      // Ogni società vede SOLO le proprie annate
      filtered = annate.filter(a => a.societyId === societyId);
    } else {
      // Retrocompatibilità: utenti legacy (senza societyId) vedono annate legacy
      filtered = annate.filter(a => !a.societyId);
    }

    const sortedAnnate = filtered.sort((a, b) => new Date(b.dataInizio) - new Date(a.dataInizio));

    console.log(`✅ Lista annate: ${sortedAnnate.length} per societyId=${societyId || 'legacy'}`);

    return res.status(200).json({ success: true, annate: sortedAnnate });

  } catch (error) {
    console.error('❌ Errore in /api/annate/list:', error);
    return res.status(500).json({ success: false, message: 'Errore nel recupero delle annate', error: error.message });
  }
}
