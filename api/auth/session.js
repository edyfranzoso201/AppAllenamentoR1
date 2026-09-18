// api/auth/session.js - Verifica e revoca sessioni lato server
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Durata della sessione, condivisa da tutti gli endpoint che la rinnovano.
// TTL scorrevole: ogni chiamata autenticata la riporta a questo valore, quindi
// conta l'INATTIVITA, non il tempo dal login. Deve restare allineata a
// SESSION_DURATION_MS in public/auth-multi-annata.js: se il client scade prima
// del server l'utente si ritrova la password richiesta mentre la sessione e
// ancora valida lato server (era il difetto delle 8 ore fisse).
const SESSION_TTL_SEC = 30 * 24 * 60 * 60; // 30 giorni

function setCors(req, res) {
  const origin = req.headers['origin'] || '';
  const allowed = [
    'https://app-allenamento-r1.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ];
  // Setta Allow-Origin SOLO per origini in whitelist. Per un'origine
  // sconosciuta non settiamo l'header: il browser blocca la richiesta
  // cross-origin. Le richieste senza header Origin (same-origin, cron,
  // server-to-server) non sono soggette a CORS e passano comunque.
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
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

      // Account scaduto DURANTE una sessione già attiva (l'admin ha impostato
      // una expiryDate dopo il login): revoca la sessione invece di rinnovarla,
      // così il prossimo verify (già chiamato ad ogni caricamento dashboard)
      // fa scattare il logout automatico lato client.
      const user = await kv.get(`auth:user:${String(data.username || '').toLowerCase()}`);
      if (user && user.expiryDate && user.expiryDate < new Date().toISOString().split('T')[0]) {
        await kv.del(`session:${token}`);
        return res.status(200).json({ valid: false, reason: 'expired' });
      }

      // TTL scorrevole: ogni verifica di una sessione valida rinnova la
      // scadenza a 8 ore da ora. Le sessioni inattive >8h scadono comunque.
      await kv.expire(`session:${token}`, SESSION_TTL_SEC);
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
