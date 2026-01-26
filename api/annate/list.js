// api/annate/list.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace('Bearer ', '') || null;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Non autenticato' });
  }

  try {
    const usersData = await kv.get('auth:users');
    const users = Array.isArray(usersData) ? usersData : [];
    const currentUser = users.find(u => u.session === sessionToken);

    if (!currentUser) {
      return res.status(401).json({ error: 'Utente non trovato' });
    }

    const allAnnateData = await kv.get('annate:list');
    const allAnnate = Array.isArray(allAnnateData) ? allAnnateData : [];
    let annateToReturn = allAnnate;

    if (currentUser.role === 'coach') {
      const userAnnateIds = Array.isArray(currentUser.annate) ? currentUser.annate : [];
      annateToReturn = allAnnate.filter(a => userAnnateIds.includes(a.id));
    }

    res.status(200).json({ annate: annateToReturn });
  } catch (error) {
    console.error('Errore in /api/annate/list:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
}