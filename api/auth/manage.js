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
    // societyId dall'header — identifica quale società sta facendo la richiesta
    const societyId = req.headers['x-society-id'] || null;

    const { action, username, password, email, role, annate } = req.body || {};

    // ==========================================
    // GET - Lista utenti della società
    // ==========================================
    if (req.method === 'GET') {
      const users = (await kv.get('auth:users')) || [];

      // Filtra: ogni admin vede SOLO i suoi utenti
      const filtered = societyId
        ? users.filter(u => u.societyId === societyId)
        : users.filter(u => !u.societyId); // legacy

      // Non restituire le password
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
    // POST - Azioni: create, update, delete
    // ==========================================
    if (req.method === 'POST') {
      if (!action) {
        return res.status(400).json({ success: false, message: 'Parametro "action" obbligatorio (create, update, delete)' });
      }

      const users = (await kv.get('auth:users')) || [];

      // CREATE
      if (action === 'create') {
        if (!username || !password || !role) {
          return res.status(400).json({ success: false, message: 'Username, password e ruolo obbligatori' });
        }

        if (!['admin', 'supercoach', 'coach'].includes(role)) {
          return res.status(400).json({ success: false, message: 'Ruolo non valido' });
        }

        // Username univoco nella stessa società
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
          societyId: societyId || null,   // ← collegato alla società
          annate: (role === 'coach' || role === 'supercoach') ? (annate || []) : [],
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
        if (societyId && users[userIndex].societyId && users[userIndex].societyId !== societyId) {
          return res.status(403).json({ success: false, message: 'Non autorizzato' });
        }

        users[userIndex] = {
          ...users[userIndex],
          email: email || users[userIndex].email,
          role,
          annate: (role === 'coach' || role === 'supercoach') ? (annate || []) : [],
          updatedAt: new Date().toISOString()
        };

        if (password && password.trim() !== '') {
          users[userIndex].password = hashPassword(password);
        }

        await kv.set('auth:users', users);

        console.log(`✅ Utente aggiornato: ${username}`);
        return res.status(200).json({
          success: true,
          message: 'Utente aggiornato con successo',
          user: { username: users[userIndex].username, email: users[userIndex].email, role: users[userIndex].role, annate: users[userIndex].annate }
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

        // Sicurezza: non eliminare utenti di altre società (a meno che siano orfani senza societyId)
        if (societyId && user.societyId && user.societyId !== societyId) {
          return res.status(403).json({ success: false, message: 'Non autorizzato' });
        }

        if (user.role === 'admin') {
          return res.status(403).json({ success: false, message: 'Non è possibile eliminare un amministratore' });
        }

        await kv.set('auth:users', users.filter(u => u.username !== username));

        console.log(`✅ Utente eliminato: ${username}`);
        return res.status(200).json({ success: true, message: 'Utente eliminato con successo' });
      }

      // CLEANUP - Elimina utenti orfani (senza societyId o con societyId diverso)
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

        console.log(`✅ Cleanup: rimossi ${orphans.length} utenti orfani: ${orphanUsernames.join(', ')}`);
        return res.status(200).json({ 
          success: true, 
          message: `Rimossi ${orphans.length} utenti orfani`, 
          cleaned: orphans.length,
          removed: orphanUsernames
        });
      }

      // LIST_ALL - Debug: mostra tutti gli utenti nel database (solo per debug)
      if (action === 'list_all') {
        const allUsers = users.map(u => ({
          username: u.username,
          role: u.role,
          societyId: u.societyId || 'NESSUNO',
          annate: u.annate || []
        }));
        return res.status(200).json({ success: true, total: allUsers.length, users: allUsers });
      }

      return res.status(400).json({ success: false, message: 'Azione non valida. Usa: create, update, delete, cleanup, list_all' });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore in /api/auth/manage:', error);
    return res.status(500).json({ success: false, message: 'Errore del server', error: error.message });
  }
}
