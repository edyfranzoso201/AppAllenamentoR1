// api/auth/session.js - Verifica e revoca sessioni lato server
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

function setCors(req, res) {
  const origin = req.headers['origin'] || '';
  const allowed = [
    'https://app-allenamento-r1.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ];
  const originToSet = allowed.includes(origin) ? origin : allowed[0];
  res.setHeader('Access-Control-Allow-Origin', originToSet);
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { action } = req.query;
  const body = req.body || {};
  const { token } = body;

  if (!token) {
    return res.status(400).json({ valid: false, message: 'token obbligatorio' });
  }

  try {
    // ── verify: controlla se il token esiste in Redis ─────────────
    if (action === 'verify') {
      const data = await kv.get(`session:${token}`);
      if (!data) {
        return res.status(200).json({ valid: false });
      }
      // TTL scorrevole: ogni verifica di una sessione valida rinnova la
      // scadenza a 8 ore da ora. Le sessioni inattive >8h scadono comunque.
      await kv.expire(`session:${token}`, 8 * 60 * 60);
      return res.status(200).json({
        valid: true,
        username: data.username,
        role: data.role,
        societyId: data.societyId || null
      });
    }

    // ── revoke: elimina il token (logout sicuro) ──────────────────
    if (action === 'revoke') {
      await kv.del(`session:${token}`);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ message: 'Azione non valida. Usa: verify, revoke' });

  } catch (error) {
    console.error('❌ Errore in /api/auth/session:', error);
    return res.status(500).json({ valid: false, message: 'Errore del server' });
  }
}
