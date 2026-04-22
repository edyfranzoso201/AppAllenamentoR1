// api/auth/manage.js - Gestione utenti (create, update, delete, list)
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Helper CORS — accetta solo domini autorizzati
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

// Ruoli validi accettati dal sistema
const VALID_ROLES = [
  'admin',
  'coach_l1', 'coach_l2', 'coach_l3', 'coach_readonly',
  'dirigente_l1', 'dirigente_l2', 'dirigente_l3', 'dirigente_l4',
  'societa_l1', 'societa_l2', 'societa_l3',
];

// SHA256 — stesso metodo usato da api/auth/login.js
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Society-Id, X-Super-Admin-Password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Il superadmin può passare societyId esplicitamente nel body
  const superAdminPwd = req.headers['x-super-admin-password'] || null;
  const SUPER_PWD = process.env.SUPER_ADMIN_PASSWORD || 'superadmin_gosport_2026';
  const isSuperAdmin = superAdminPwd === SUPER_PWD;
  const societyId = req.headers['x-society-id'] || (req.body && req.body.societyId) || null;

  try {
    // ==========================================
    // GET — Lista utenti
    // ==========================================
    if (req.method === 'GET') {
      const users = (await kv.get('auth:users')) || [];

      // Superadmin vede tutti gli utenti; altrimenti filtra per societyId
      const filtered = isSuperAdmin
        ? users
        : societyId
          ? users.filter(u => !u.societyId || u.societyId === societyId)
          : users;

      // Restituisce i dati senza la password
      const safeUsers = filtered.map(u => ({
        username:  u.username,
        email:     u.email     || '',
        nome:      u.nome      || '',
        cognome:   u.cognome   || '',
        note:      u.note      || '',
        role:      u.role      || 'coach_readonly',
        annate:    u.annate    || [],
        societyId: u.societyId || null,
        createdAt: u.createdAt || null,
        updatedAt: u.updatedAt || null,
      }));

      console.log(`✅ GET /api/auth/manage - ${safeUsers.length} utenti`);
      return res.status(200).json({ users: safeUsers });
    }

    // ==========================================
    // POST — Azioni CRUD
    // ==========================================
    if (req.method === 'POST') {
      const { action, username, password, email, nome, cognome, note, role, annate } = req.body;

      if (!action) {
        return res.status(400).json({ success: false, message: 'Parametro "action" obbligatorio' });
      }

      const users = (await kv.get('auth:users')) || [];

      // ── CREATE ────────────────────────────────
      if (action === 'create') {
        if (!username || !password) {
          return res.status(400).json({ success: false, message: 'Username e password obbligatori' });
        }

        // Controlla duplicati (case-insensitive)
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
          return res.status(400).json({ success: false, message: 'Username già esistente' });
        }

        if (role && !VALID_ROLES.includes(role)) {
          return res.status(400).json({ success: false, message: `Ruolo non valido: ${role}` });
        }

        const newUser = {
          username:  username.trim(),
          password:  hashPassword(password),
          email:     (email     || '').trim(),
          nome:      (nome      || '').trim(),
          cognome:   (cognome   || '').trim(),
          note:      (note      || '').trim(),
          role:      role || 'coach_readonly',
          annate:    role === 'admin' ? [] : (annate || []),
          societyId: societyId || null,
          createdAt: new Date().toISOString(),
          createdBySuperAdmin: isSuperAdmin || false,
        };

        users.push(newUser);
        await kv.set('auth:users', users);

        console.log(`✅ Utente creato: ${username} (${newUser.role}) societyId=${societyId}`);
        return res.status(200).json({ success: true, message: 'Utente creato con successo' });
      }

      // ── UPDATE ────────────────────────────────
      if (action === 'update') {
        if (!username) {
          return res.status(400).json({ success: false, message: 'Username obbligatorio' });
        }

        const idx = users.findIndex(u => u.username === username);
        if (idx === -1) {
          return res.status(404).json({ success: false, message: 'Utente non trovato' });
        }

        // Sicurezza: un utente di una società non può modificare utenti di un'altra
        if (!isSuperAdmin && societyId && users[idx].societyId && users[idx].societyId !== societyId) {
          return res.status(403).json({ success: false, message: 'Non autorizzato' });
        }

        if (role && !VALID_ROLES.includes(role)) {
          return res.status(400).json({ success: false, message: `Ruolo non valido: ${role}` });
        }

        // Aggiorna solo i campi forniti, mantieni quelli esistenti
        const updated = { ...users[idx] };

        if (email     !== undefined) updated.email     = email.trim();
        if (nome      !== undefined) updated.nome      = nome.trim();
        if (cognome   !== undefined) updated.cognome   = cognome.trim();
        if (note      !== undefined) updated.note      = note.trim();
        if (role      !== undefined) updated.role      = role;
        if (annate    !== undefined) updated.annate    = role === 'admin' ? [] : annate;
        if (password  && password.trim() !== '') {
          updated.password = hashPassword(password.trim());
        }
        updated.updatedAt = new Date().toISOString();

        users[idx] = updated;
        await kv.set('auth:users', users);

        console.log(`✅ Utente aggiornato: ${username} (${updated.role})`);
        return res.status(200).json({ success: true, message: 'Utente aggiornato con successo' });
      }

      // ── DELETE ────────────────────────────────
      if (action === 'delete') {
        if (!username) {
          return res.status(400).json({ success: false, message: 'Username obbligatorio' });
        }

        // Protezione: non si può eliminare l'admin principale (a meno che non sia superadmin)
        if (username === 'admin' && !isSuperAdmin) {
          return res.status(403).json({ success: false, message: 'Non puoi eliminare l\'utente admin principale' });
        }

        const target = users.find(u => u.username === username);
        if (!target) {
          return res.status(404).json({ success: false, message: 'Utente non trovato' });
        }

        if (!isSuperAdmin && societyId && target.societyId && target.societyId !== societyId) {
          return res.status(403).json({ success: false, message: 'Non autorizzato' });
        }

        const updated = users.filter(u => u.username !== username);
        await kv.set('auth:users', updated);

        console.log(`✅ Utente eliminato: ${username}`);
        return res.status(200).json({ success: true, message: 'Utente eliminato con successo' });
      }

      return res.status(400).json({ success: false, message: 'Azione non valida. Usa: create, update, delete' });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore in /api/auth/manage:', error);
    return res.status(500).json({ success: false, message: 'Errore del server' });
  }
}
