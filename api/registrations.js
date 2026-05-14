// api/registrations.js — Gestione richieste iscrizione atleti
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary', 'Origin');
}

function kvKey(societyId) {
  return `registrations:${societyId}`;
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Session, X-Society-Id, X-Super-Admin-Password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {

    // ── SUBMIT (pubblica, senza auth) ────────────────────────────────────
    if (action === 'submit' && req.method === 'POST') {
      const body = req.body || {};
      const { societyId, nome, cognome, dataNascita, isAdult,
              email, cellulare, codiceFiscale, genitore, privacyAccepted } = body;

      if (!societyId || !nome || !cognome || !dataNascita) {
        return res.status(400).json({ success: false, message: 'Dati obbligatori mancanti' });
      }
      if (!privacyAccepted) {
        return res.status(400).json({ success: false, message: 'Consenso privacy obbligatorio' });
      }

      // Verifica che societyId esista (licenza attiva)
      const licenseKey = await kv.get(`licenze_society:${societyId}`);
      if (!licenseKey) {
        return res.status(404).json({ success: false, message: 'Società non trovata' });
      }

      const existing = (await kv.get(kvKey(societyId))) || [];
      const newEntry = {
        id: crypto.randomUUID(),
        societyId,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        nome: nome.trim(),
        cognome: cognome.trim(),
        dataNascita,
        isAdult: !!isAdult,
        email: isAdult ? (email || '').trim() : '',
        cellulare: isAdult ? (cellulare || '').trim() : '',
        codiceFiscale: isAdult ? (codiceFiscale || '').trim() : '',
        genitore: !isAdult ? (genitore || {}) : null,
        privacyAccepted: true,
      };

      await kv.set(kvKey(societyId), [newEntry, ...existing]);
      console.log(`✅ Nuova richiesta iscrizione: ${nome} ${cognome} per societyId=${societyId}`);
      return res.status(200).json({ success: true, id: newEntry.id });
    }

    // ── Da qui: richiede sessione attiva ─────────────────────────────────
    const sessionToken = req.headers['x-auth-session'];
    const societyId    = req.headers['x-society-id'];

    if (!sessionToken || !societyId) {
      return res.status(401).json({ success: false, message: 'Autenticazione richiesta' });
    }
    const session = await kv.get(`session:${sessionToken}`);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Sessione scaduta' });
    }

    // ── LIST ─────────────────────────────────────────────────────────────
    if (action === 'list' && req.method === 'GET') {
      const all = (await kv.get(kvKey(societyId))) || [];
      const sorted = [...all].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      const pending = sorted.filter(r => r.status === 'pending').length;
      return res.status(200).json({ success: true, registrations: sorted, pending });
    }

    // ── ACCEPT ───────────────────────────────────────────────────────────
    if (action === 'accept' && req.method === 'PUT') {
      const { id, annataId } = req.body || {};
      if (!id) return res.status(400).json({ success: false, message: 'id obbligatorio' });

      const all = (await kv.get(kvKey(societyId))) || [];
      const idx = all.findIndex(r => r.id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Richiesta non trovata' });

      all[idx] = {
        ...all[idx],
        status: 'accepted',
        respondedAt: new Date().toISOString(),
        respondedBy: session.username,
        annataId: annataId || null,
      };
      await kv.set(kvKey(societyId), all);
      return res.status(200).json({ success: true });
    }

    // ── REJECT ───────────────────────────────────────────────────────────
    if (action === 'reject' && req.method === 'PUT') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ success: false, message: 'id obbligatorio' });

      const all = (await kv.get(kvKey(societyId))) || [];
      const idx = all.findIndex(r => r.id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Richiesta non trovata' });

      all[idx] = {
        ...all[idx],
        status: 'rejected',
        respondedAt: new Date().toISOString(),
        respondedBy: session.username,
      };
      await kv.set(kvKey(societyId), all);
      return res.status(200).json({ success: true });
    }

    // ── DELETE ───────────────────────────────────────────────────────────
    if (action === 'delete' && req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ success: false, message: 'id obbligatorio' });

      const all = (await kv.get(kvKey(societyId))) || [];
      await kv.set(kvKey(societyId), all.filter(r => r.id !== id));
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: 'Azione non supportata' });

  } catch (error) {
    console.error('❌ Errore in /api/registrations:', error);
    return res.status(500).json({ success: false, message: 'Errore del server' });
  }
}
