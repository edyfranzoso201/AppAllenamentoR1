// api/auth/diagnose.js - TEMPORANEO: diagnostica sistemi utenti (da rimuovere dopo uso)
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPER_PWD = process.env.SUPER_ADMIN_PASSWORD;
  if (!SUPER_PWD) return res.status(500).json({ message: 'Configurazione server incompleta' });

  const pwd = req.headers['x-super-admin-password'];
  if (pwd !== SUPER_PWD) return res.status(401).json({ message: 'Non autorizzato' });

  // Leggi sistema attivo: auth:users (array)
  const authUsers = (await kv.get('auth:users')) || [];

  // Leggi sistema legacy: users (hash Redis)
  const legacyUsers = (await kv.hgetall('users')) || {};
  const legacyList = Object.values(legacyUsers).map(u => ({
    username: u.username,
    role: u.role,
    createdAt: u.createdAt || null
  }));

  const activeUsernames = new Set(authUsers.map(u => u.username));
  const legacyUsernames = new Set(legacyList.map(u => u.username));

  // Utenti solo nel legacy (non nel sistema attivo)
  const onlyInLegacy = legacyList.filter(u => !activeUsernames.has(u.username));

  // Utenti solo nel sistema attivo (non nel legacy)
  const onlyInActive = authUsers
    .filter(u => !legacyUsernames.has(u.username))
    .map(u => ({ username: u.username, role: u.role, createdAt: u.createdAt || null }));

  // Utenti in entrambi
  const inBoth = authUsers
    .filter(u => legacyUsernames.has(u.username))
    .map(u => ({ username: u.username, role: u.role }));

  return res.status(200).json({
    sistemaAttivo: {
      chiave: 'auth:users',
      totale: authUsers.length,
      utenti: authUsers.map(u => ({ username: u.username, role: u.role, createdAt: u.createdAt || null }))
    },
    sistemaLegacy: {
      chiave: 'users (hash)',
      totale: legacyList.length,
      utenti: legacyList
    },
    analisi: {
      soloInLegacy: onlyInLegacy,
      soloInAttivo: onlyInActive,
      inEntrambi: inBoth
    }
  });
}
