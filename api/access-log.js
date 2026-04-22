// api/access-log.js - Log accessi utenti
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Annata-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Metodo non consentito' });

  try {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const username = params.get('username');

    // Usa kv.get/set - stessa tecnica usata per tutti gli altri dati
    const all = await kv.get('access_log') || [];
    const logs = username ? all.filter(l => l.username === username) : all;

    return res.status(200).json({ logs });
  } catch (error) {
    console.error('Access log error:', error);
    return res.status(500).json({ message: 'Errore', logs: [], error: error.message });
  }
}
