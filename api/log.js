// api/log.js — Salva e legge log accessi (senza annata richiesta)
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Society-Id, X-Auth-Session');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'DELETE') {
      // Cancella i log della società specificata
      const societyId = req.headers['x-society-id'] || '';
      const existing = await kv.get('access_log');
      const arr = Array.isArray(existing) ? existing : [];
      if (!societyId) {
        // senza societyId non cancelliamo nulla per sicurezza
        return res.status(400).json({ ok: false, error: 'societyId obbligatorio' });
      }
      const filtered = arr.filter(l => l.societyId !== societyId);
      await kv.set('access_log', filtered);
      console.log(`🗑️ Log azzerati per societyId=${societyId} — rimossi ${arr.length - filtered.length} entries`);
      return res.status(200).json({ ok: true, removed: arr.length - filtered.length });
    }

    if (req.method === 'POST') {
      // Scrivi log
      let body = req.body;
      if (!body) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      }
      const entry = body.entry;
      if (!entry) return res.status(400).json({ error: 'entry mancante' });

      const existing = await kv.get('access_log');
      const arr = Array.isArray(existing) ? existing : [];
      const updated = [entry, ...arr].slice(0, 500);
      await kv.set('access_log', updated);
      return res.status(200).json({ ok: true, total: updated.length });

    } else {
      // Leggi log
      const logs = await kv.get('access_log');
      const arr = Array.isArray(logs) ? logs : [];
      const username = req.url.includes('username=')
        ? decodeURIComponent(req.url.split('username=')[1].split('&')[0])
        : null;
      return res.status(200).json({
        ok: true,
        logs: username ? arr.filter(l => l.username === username) : arr
      });
    }
  } catch(e) {
    console.error('log.js error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
