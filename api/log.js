// api/log.js — Salva e legge log accessi (senza annata richiesta)
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Valida il token di sessione (creato dal login). Ritorna i dati sessione o null.
async function getLogSession(req) {
  const token = String(req.headers['x-auth-session'] || '').trim();
  if (!token || token === 'true') return null;
  try {
    const sess = await kv.get(`session:${token}`);
    // TTL scorrevole: rinnova la scadenza della sessione a 8h da ora (soft)
    if (sess) { try { await kv.expire(`session:${token}`, 8 * 60 * 60); } catch (e) { /* non bloccante */ } }
    return sess;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Society-Id, X-Auth-Session');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'DELETE') {
      // Cancella i log della PROPRIA società (societyId dalla sessione, non dall'header)
      const sess = await getLogSession(req);
      if (!sess) return res.status(401).json({ ok: false, error: 'Non autorizzato' });
      const societyId = sess.societyId || '';
      const existing = await kv.get('access_log');
      const arr = Array.isArray(existing) ? existing : [];
      if (!societyId) {
        return res.status(400).json({ ok: false, error: 'societyId mancante nella sessione' });
      }
      const filtered = arr.filter(l => l.societyId !== societyId);
      await kv.set('access_log', filtered);
      console.log(`🗑️ Log azzerati per societyId=${societyId} — rimossi ${arr.length - filtered.length} entries`);
      return res.status(200).json({ ok: true, removed: arr.length - filtered.length });
    }

    if (req.method === 'POST') {
      // Scrivi log accesso. RICHIEDE sessione valida: senza questo controllo
      // l'endpoint era scrivibile da chiunque, permettendo di falsificare accessi,
      // inquinare i log di altre società e svuotare il ring-buffer (500) con spam.
      const sess = await getLogSession(req);
      if (!sess) return res.status(401).json({ ok: false, error: 'Non autorizzato' });

      // Legge un eventuale timestamp dal body ma NON si fida di username/role/
      // societyId inviati dal client: quei campi vengono SEMPRE dalla sessione,
      // così un log non può essere attribuito a un altro utente o a un'altra società.
      let body = req.body;
      if (!body) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
        catch { body = {}; }
      }
      const clientTs = body && body.entry && typeof body.entry.ts === 'string' ? body.entry.ts : null;

      const entry = {
        ts: clientTs || new Date().toISOString(),
        username: sess.username || '',
        role: sess.role || 'user',
        societyId: sess.societyId || null,
      };

      const existing = await kv.get('access_log');
      const arr = Array.isArray(existing) ? existing : [];
      const updated = [entry, ...arr].slice(0, 500);
      await kv.set('access_log', updated);
      return res.status(200).json({ ok: true, total: updated.length });

    } else {
      // Leggi log — richiede sessione valida; un admin vede solo la PROPRIA società
      const sess = await getLogSession(req);
      if (!sess) return res.status(401).json({ ok: false, error: 'Non autorizzato' });
      const logs = await kv.get('access_log');
      let arr = Array.isArray(logs) ? logs : [];
      if (sess.societyId) arr = arr.filter(l => l.societyId === sess.societyId);
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
