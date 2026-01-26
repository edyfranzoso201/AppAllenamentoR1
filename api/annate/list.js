// api/annate/list.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Gestisci CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    // Carica tutte le annate
    const allAnnate = await kv.get('annate:list') || [];

    // Se c'è un header di autenticazione, filtra per ruolo (solo per coach)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const sessionToken = authHeader.replace('Bearer ', '');
      const usersData = await kv.get('auth:users');
      const users = Array.isArray(usersData) ? usersData : [];
      const currentUser = users.find(u => u.session === sessionToken);

      if (currentUser && currentUser.role === 'coach') {
        const userAnnateIds = Array.isArray(currentUser.annate) ? currentUser.annate : [];
        const filteredAnnate = allAnnate.filter(a => userAnnateIds.includes(a.id));
        return res.status(200).json({ annate: filteredAnnate });
      }
    }

    // Per admin o senza autenticazione, restituisci tutte le annate
    res.status(200).json({ annate: allAnnate });

  } catch (error) {
    console.error('Errore in /api/annate/list:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
}