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
  // Setta Allow-Origin SOLO per origini in whitelist. Per un'origine
  // sconosciuta non settiamo l'header: il browser blocca la richiesta
  // cross-origin. Le richieste senza header Origin (same-origin, cron,
  // server-to-server) non sono soggette a CORS e passano comunque.
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
}

// Ruoli validi accettati dal sistema
const VALID_ROLES = [
  'admin',
  'coach_l0', 'coach_l1', 'coach_l2', 'coach_l3', 'coach_readonly',
  'dirigente_l1', 'dirigente_l2', 'dirigente_l3', 'dirigente_l4',
  'societa_l1', 'societa_l2', 'societa_l3',
  // Ruoli Dashboard (accesso solo licenza Platinum)
  'direttivo',  // A1 — Direttivo
  'dirigente',  // A2 — Dirigenti
  'staff',      // A3 — Staff (Dirigenti + Allenatori)
];

// SHA256 — stesso metodo usato da api/auth/login.js
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Society-Id, X-Super-Admin-Password, X-Auth-Session, X-Auth-User, X-User-Role');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const superAdminPwd = req.headers['x-super-admin-password'] || null;
  const SUPER_PWD = process.env.SUPER_ADMIN_PASSWORD;
  if (!SUPER_PWD) return res.status(500).json({ success: false, message: 'Configurazione server incompleta' });
  const isSuperAdmin = superAdminPwd === SUPER_PWD;

  try {
    // ── Autenticazione ──────────────────────────────────────────────────────
    // Superadmin (password) → agisce su qualsiasi società (societyId dal body).
    // Altrimenti serve un token di sessione valido con ruolo ADMIN: gestisce SOLO
    // gli utenti della PROPRIA società (societyId dalla SESSIONE, non dall'header
    // che sarebbe falsificabile). Impedisce account takeover via X-Society-Id.
    let societyId;
    if (isSuperAdmin) {
      societyId = req.headers['x-society-id'] || (req.body && req.body.societyId) || null;
    } else {
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
      if (String(sess.role || '').toLowerCase() !== 'admin') {
        return res.status(403).json({ success: false, message: 'Solo gli admin possono gestire gli utenti' });
      }
      societyId = sess.societyId || null;
    }

    // ==========================================
    // GET — Lista utenti
    // ==========================================
    if (req.method === 'GET') {
      const users = (await kv.get('auth:users')) || [];

      // Superadmin vede tutti gli utenti; altrimenti filtra per societyId
      const filtered = isSuperAdmin
        ? users
        : users.filter(u => !u.societyId || u.societyId === societyId);

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

        // Normalizza UNA volta: il record e la chiave individuale devono usare
        // la stessa base (trim) per non creare disallineamenti lista↔chiave.
        const usernameTrim = String(username).trim();
        if (!usernameTrim) {
          return res.status(400).json({ success: false, message: 'Username non valido' });
        }

        // Controlla duplicati (case-insensitive + trim, coerente con la DELETE)
        if (users.find(u => String(u.username || '').trim().toLowerCase() === usernameTrim.toLowerCase())) {
          return res.status(400).json({ success: false, message: 'Username già esistente' });
        }

        if (role && !VALID_ROLES.includes(role)) {
          return res.status(400).json({ success: false, message: `Ruolo non valido: ${role}` });
        }

        const newUser = {
          username:  usernameTrim,
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
        await Promise.all([
          kv.set('auth:users', users),
          kv.set(`auth:user:${usernameTrim.toLowerCase()}`, newUser),
        ]);

        console.log(`✅ Utente creato: ${username} (${newUser.role}) societyId=${societyId}`);
        return res.status(200).json({ success: true, message: 'Utente creato con successo' });
      }

      // ── UPDATE ────────────────────────────────
      if (action === 'update') {
        if (!username) {
          return res.status(400).json({ success: false, message: 'Username obbligatorio' });
        }

        // Match case-insensitive + trim (coerente con CREATE/DELETE)
        const updUnameLower = String(username).trim().toLowerCase();
        const idx = users.findIndex(u => String(u.username || '').trim().toLowerCase() === updUnameLower);
        if (idx === -1) {
          return res.status(404).json({ success: false, message: 'Utente non trovato' });
        }

        // Sicurezza: un admin di società può modificare SOLO utenti della propria società.
        if (!isSuperAdmin && (users[idx].societyId || null) !== (societyId || null)) {
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
        await Promise.all([
          kv.set('auth:users', users),
          // Usa l'username del record trovato (non l'input) per non creare una
          // chiave con casing diverso da quella esistente.
          kv.set(`auth:user:${String(updated.username || '').trim().toLowerCase()}`, updated),
        ]);

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

        // Match case-insensitive: la CREATE controlla i duplicati in modo
        // case-insensitive, quindi anche la DELETE deve esserlo, altrimenti un
        // record con casing diverso resterebbe "fantasma" (cancellato all'occhio
        // ma ancora presente → "username già esistente" alla ricreazione).
        const unameLower = String(username).trim().toLowerCase();
        const target = users.find(u => String(u.username || '').trim().toLowerCase() === unameLower);
        if (!target) {
          return res.status(404).json({ success: false, message: 'Utente non trovato' });
        }

        if (!isSuperAdmin && (target.societyId || null) !== (societyId || null)) {
          return res.status(403).json({ success: false, message: 'Non autorizzato' });
        }

        // Rimuove TUTTE le occorrenze (difensivo: eventuali duplicati storici)
        // confrontando in modo case-insensitive + trim.
        const updated = users.filter(u => String(u.username || '').trim().toLowerCase() !== unameLower);
        await Promise.all([
          kv.set('auth:users', updated),
          // Pulisce sia la chiave normalizzata sia quella basata sull'username
          // così com'è arrivato (per coprire chiavi legacy non normalizzate).
          kv.del(`auth:user:${unameLower}`),
          kv.del(`auth:user:${String(username).toLowerCase()}`),
        ]);

        console.log(`✅ Utente eliminato: ${username} (rimosse ${users.length - updated.length} occorrenze)`);
        return res.status(200).json({ success: true, message: 'Utente eliminato con successo' });
      }

      // ── MIGRATE ───────────────────────────────
      if (action === 'migrate' && isSuperAdmin) {
        const allUsers = (await kv.get('auth:users')) || [];
        await Promise.all(
          allUsers.map(u => kv.set(`auth:user:${u.username.toLowerCase()}`, u))
        );
        console.log(`✅ Migrazione: ${allUsers.length} chiavi individuali create`);
        return res.status(200).json({ success: true, migrated: allUsers.length });
      }

      return res.status(400).json({ success: false, message: 'Azione non valida. Usa: create, update, delete' });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore in /api/auth/manage:', error);
    return res.status(500).json({ success: false, message: 'Errore del server' });
  }
}
