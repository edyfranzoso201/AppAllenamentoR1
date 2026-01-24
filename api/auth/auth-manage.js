// api/auth/manage.js - Gestione unificata utenti
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action, username, password, email, role, annate } = req.body || {};

    // ==========================================
    // GET - Lista tutti gli utenti
    // ==========================================
    if (req.method === 'GET') {
      const users = (await kv.get('auth:users')) || [];
      console.log(`✅ Caricati ${users.length} utenti`);
      return res.status(200).json({ success: true, users });
    }

    // ==========================================
    // POST - Azioni: create, update, delete
    // ==========================================
    if (req.method === 'POST') {
      if (!action) {
        return res.status(400).json({ 
          success: false, 
          message: 'Parametro "action" obbligatorio (create, update, delete)' 
        });
      }

      const users = (await kv.get('auth:users')) || [];

      // CREATE
      if (action === 'create') {
        if (!username || !password || !role) {
          return res.status(400).json({ 
            success: false,
            message: 'Username, password e ruolo obbligatori' 
          });
        }

        if (!['admin', 'supercoach', 'coach'].includes(role)) {
          return res.status(400).json({ 
            success: false,
            message: 'Ruolo non valido' 
          });
        }

        if (users.find(u => u.username === username)) {
          return res.status(400).json({ 
            success: false,
            message: 'Username già esistente' 
          });
        }

        const newUser = {
          username,
          password: hashPassword(password),
          email: email || '',
          role,
          annate: role === 'coach' ? (annate || []) : [],
          createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await kv.set('auth:users', users);

        console.log(`✅ Utente creato: ${username} (${role})`);
        return res.status(200).json({ 
          success: true,
          message: 'Utente creato con successo',
          user: { username: newUser.username, email: newUser.email, role: newUser.role, annate: newUser.annate }
        });
      }

      // UPDATE
      if (action === 'update') {
        if (!username || !role) {
          return res.status(400).json({ 
            success: false,
            message: 'Username e ruolo obbligatori' 
          });
        }

        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex === -1) {
          return res.status(404).json({ 
            success: false,
            message: 'Utente non trovato' 
          });
        }

        users[userIndex] = {
          ...users[userIndex],
          email: email || users[userIndex].email,
          role,
          annate: role === 'coach' ? (annate || []) : [],
          updatedAt: new Date().toISOString()
        };

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
          return res.status(400).json({ 
            success: false,
            message: 'Username obbligatorio' 
          });
        }

        const user = users.find(u => u.username === username);
        if (!user) {
          return res.status(404).json({ 
            success: false,
            message: 'Utente non trovato' 
          });
        }

        if (user.role === 'admin') {
          return res.status(403).json({ 
            success: false,
            message: 'Non è possibile eliminare un amministratore' 
          });
        }

        const updatedUsers = users.filter(u => u.username !== username);
        await kv.set('auth:users', updatedUsers);

        console.log(`✅ Utente eliminato: ${username}`);
        return res.status(200).json({ 
          success: true,
          message: 'Utente eliminato con successo'
        });
      }

      return res.status(400).json({ 
        success: false,
        message: 'Azione non valida. Usa: create, update, delete' 
      });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore in /api/auth/manage:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}
