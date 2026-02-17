// api/migrate-society.js
// Endpoint temporaneo per collegare utenti/annate esistenti a un societyId
// USARE UNA VOLTA SOLA poi si può eliminare

import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'superadmin_gosport_2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Super-Admin-Password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Protetto da password Super Admin
  const pwd = req.headers['x-super-admin-password'];
  if (pwd !== SUPER_ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  }

  try {
    const { societyId, usernames, annataIds } = req.body;

    if (!societyId) {
      return res.status(400).json({ success: false, message: 'societyId obbligatorio' });
    }

    const results = { users: [], annate: [] };

    // ==========================================
    // Collega utenti al societyId
    // ==========================================
    if (usernames && usernames.length > 0) {
      const users = (await kv.get('auth:users')) || [];
      let updated = 0;

      for (const username of usernames) {
        const idx = users.findIndex(u => u.username === username);
        if (idx !== -1) {
          users[idx].societyId = societyId;
          updated++;
          results.users.push(`✅ ${username} → societyId=${societyId}`);
        } else {
          results.users.push(`❌ ${username} non trovato`);
        }
      }

      if (updated > 0) await kv.set('auth:users', users);
    }

    // ==========================================
    // Collega annate al societyId
    // ==========================================
    if (annataIds && annataIds.length > 0) {
      const annate = (await kv.get('annate:list')) || [];
      let updated = 0;

      for (const annataId of annataIds) {
        const idx = annate.findIndex(a => a.id === annataId);
        if (idx !== -1) {
          annate[idx].societyId = societyId;
          updated++;
          results.annate.push(`✅ ${annate[idx].nome} (${annataId}) → societyId=${societyId}`);
        } else {
          results.annate.push(`❌ annata ${annataId} non trovata`);
        }
      }

      if (updated > 0) await kv.set('annate:list', annate);
    }

    console.log('✅ Migrazione completata:', results);
    return res.status(200).json({ success: true, results });

  } catch (error) {
    console.error('❌ Errore migrazione:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
