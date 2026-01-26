// api/annate/list.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Aggiungi intestazioni CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const allAnnate = await kv.get('annate:list') || [];
    res.status(200).json({ annate: allAnnate });

  } catch (error) {
    console.error('Errore in /api/annate/list:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
}