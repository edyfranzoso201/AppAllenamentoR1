// api/annate/list.js - Restituisce annate filtrate per società
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Society-Id, X-Auth-Session, X-Auth-User, X-User-Role, X-Annata-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use GET.' });
  }

  try {
    // Autenticazione: serve un token di sessione valido (creato dal login).
    const token = String(req.headers['x-auth-session'] || '').trim();
    if (!token || token === 'true') {
      return res.status(401).json({ success: false, message: 'Non autorizzato' });
    }
    const sess = await kv.get(`session:${token}`);
    if (!sess) {
      return res.status(401).json({ success: false, message: 'Sessione non valida o scaduta' });
    }
    // TTL scorrevole: rinnova la scadenza della sessione a 8h da ora (soft)
    try { await kv.expire(`session:${token}`, 8 * 60 * 60); } catch (e) { /* non bloccante */ }

    const annate = (await kv.get('annate:list')) || [];

    // societyId dalla SESSIONE (non dall'header, falsificabile): ognuno vede solo le proprie annate.
    const societyId = sess.societyId || null;

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
