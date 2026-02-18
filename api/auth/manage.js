// api/auth/manage.js - Gestione utenti con societyId per separazione società
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Society-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const societyId = req.headers['x-society-id'] || null;

    const { action, username, password, email, role, annate } = req.body || {};

    // ==========================================
    // GET - Lista utenti della società
    // ==========================================
    if (req.method === 'GET') {
      const users = (await kv.get('auth:users')) || [];

      const filtered = societyId
        ? users.filter(u => u.societyId === societyId)
        : users.filter(u => !u.societyId);

      const safeUsers = filtered.map(u => ({
        username: u.username,
        email: u.email || '',
        role: u.role,
        annate: u.annate || [],
        societyId: u.societyId || null,
        createdAt: u.createdAt
      }));

      console.log(`✅ Caricati ${safeUsers.length} utenti per societyId=${societyId || 'legacy'}`);
      return res.status(200).json({ success: true, users: safeUsers });
    }

    // ==========================================
    // POST - Azioni: create, update, delete, fix_society
    // ==========================================
    if (req.method === 'POST') {
      if (!action) {
        return res.status(400).json({ success: false, message: 'Parametro "action" obbligatorio' });
      }

      const users = (await kv.get('auth:users')) || [];

      // CREATE
      if (action === 'create') {
        if (!username || !password || !role) {
          return res.status(400).json({ success: false, message: 'Username, password e ruolo obbligatori' });
        }

        if (!['admin', 'coach_l1', 'coach_l2', 'coach_l3', 'coach_readonly'].includes(role)) {
          return res.status(400).json({ success: false, message: 'Ruolo non valido' });
        }

        const duplicateInSociety = users.find(u =>
          u.username === username &&
          (societyId ? u.societyId === societyId : !u.societyId)
        );
        if (duplicateInSociety) {
          return res.status(400).json({ success: false, message: 'Username già esistente' });
        }

        const newUser = {
          username,
          password: hashPassword(password),
          email: email || '',
          role,
          societyId: societyId || null,
          annate: role !== 'admin' ? (annate || []) : [],
          createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await kv.set('auth:users', users);

        console.log(`✅ Utente creato: ${username} (${role}) societyId=${societyId}`);
        return res.status(200).json({
          success: true,
          message: 'Utente creato con successo',
          user: { username: newUser.username, email: newUser.email, role: newUser.role, annate: newUser.annate }
        });
      }

      // UPDATE
      if (action === 'update') {
        if (!username || !role) {
          return res.status(400).json({ success: false, message: 'Username e ruolo obbligatori' });
        }

        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex === -1) {
          return res.status(404).json({ success: false, message: 'Utente non trovato' });
        }

        // Sicurezza: non modificare utenti di altre società
        // MA permetti aggiornamento se l'utente non ha societyId (orfano)
        if (societyId && users[userIndex].societyId && users[userIndex].societyId !== societyId) {
          return res.status(403).json({ success: false, message: 'Non autorizzato' });
        }

        users[userIndex] = {
          ...users[userIndex],
          email: email || users[userIndex].email,
          role,
          // ✅ FIX: aggiorna societyId se l'utente era orfano (societyId null/undefined)
          societyId: users[userIndex].societyId || societyId || null,
          annate: role !== 'admin' ? (annate || []) : [],
          updatedAt: new Date().toISOString()
        };

        if (password && password.trim() !== '') {
          users[userIndex].password = hashPassword(password);
        }

        await kv.set('auth:users', users);

        console.log(`✅ Utente aggiornato: ${username} societyId=${users[userIndex].societyId}`);
        return res.status(200).json({
          success: true,
          message: 'Utente aggiornato con successo',
          user: { username: users[userIndex].username, email: users[userIndex].email, role: users[userIndex].role, annate: users[userIndex].annate, societyId: users[userIndex].societyId }
        });
      }

      // DELETE
      if (action === 'delete') {
        if (!username) {
          return res.status(400).json({ success: false, message: 'Username obbligatorio' });
        }

        const user = users.find(u => u.username === username);
        if (!user) {
          return res.status(404).json({ success: false, message: 'Utente non trovato' });
        }

        if (societyId && user.societyId && user.societyId !== societyId) {
          return res.status(403).json({ success: false, message: 'Non autorizzato' });
        }

        if (user.role === 'admin') { // protected
          return res.status(403).json({ success: false, message: 'Non è possibile eliminare un amministratore' });
        }

        await kv.set('auth:users', users.filter(u => u.username !== username));

        console.log(`✅ Utente eliminato: ${username}`);
        return res.status(200).json({ success: true, message: 'Utente eliminato con successo' });
      }

      // ==========================================
      // FIX_SOCIETY - Assegna societyId agli utenti orfani
      // ==========================================
      if (action === 'fix_society') {
        if (!societyId) {
          return res.status(400).json({ success: false, message: 'X-Society-Id header obbligatorio' });
        }

        const orphans = users.filter(u => !u.societyId || u.societyId === 'NESSUNO');
        if (orphans.length === 0) {
          return res.status(200).json({ success: true, message: 'Nessun utente orfano trovato', fixed: 0 });
        }

        let fixedCount = 0;
        for (let i = 0; i < users.length; i++) {
          if (!users[i].societyId || users[i].societyId === 'NESSUNO') {
            users[i].societyId = societyId;
            fixedCount++;
            console.log(`✅ Fix societyId per utente: ${users[i].username} → ${societyId}`);
          }
        }

        await kv.set('auth:users', users);

        return res.status(200).json({
          success: true,
          message: `Corretti ${fixedCount} utenti orfani`,
          fixed: fixedCount,
          users: orphans.map(u => u.username)
        });
      }

      // CLEANUP
      if (action === 'cleanup') {
        const orphans = users.filter(u =>
          u.role !== 'admin' &&
          societyId &&
          u.societyId !== societyId &&
          u.username !== 'admin'
        );

        if (orphans.length === 0) {
          return res.status(200).json({ success: true, message: 'Nessun utente orfano trovato', cleaned: 0 });
        }

        const orphanUsernames = orphans.map(u => u.username);
        const cleanedUsers = users.filter(u => !orphanUsernames.includes(u.username));
        await kv.set('auth:users', cleanedUsers);

        console.log(`✅ Cleanup: rimossi ${orphans.length} utenti orfani`);
        return res.status(200).json({
          success: true,
          message: `Rimossi ${orphans.length} utenti orfani`,
          cleaned: orphans.length,
          removed: orphanUsernames
        });
      }

      // LIST_ALL - Debug
      if (action === 'list_all') {
        const allUsers = users.map(u => ({
          username: u.username,
          role: u.role,
          societyId: u.societyId || 'NESSUNO',
          annate: u.annate || []
        }));
        return res.status(200).json({ success: true, total: allUsers.length, users: allUsers });
      }

      return res.status(400).json({ success: false, message: 'Azione non valida. Usa: create, update, delete, fix_society, cleanup, list_all' });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore in /api/auth/manage:', error);
    return res.status(500).json({ success: false, message: 'Errore del server', error: error.message });
  }
}
