// api/annate/manage.js - Gestione annate con societyId per separazione società
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

function generateAnnataId() {
  return crypto.randomBytes(8).toString('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Society-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' });
  }

  try {
    const { action, id, nome, dataInizio, dataFine, descrizione } = req.body;

    // societyId dall'header — identifica a quale società appartiene l'annata
    const societyId = req.headers['x-society-id'] || null;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Parametro "action" obbligatorio (create, update, delete)' });
    }

    const annate = (await kv.get('annate:list')) || [];

    // ==========================================
    // CREATE
    // ==========================================
    if (action === 'create') {
      if (!nome) {
        return res.status(400).json({ success: false, message: 'Nome obbligatorio' });
      }

      // Controlla duplicati SOLO nella stessa società
      if (annate.find(a => a.nome === nome && a.societyId === societyId)) {
        return res.status(400).json({ success: false, message: "Esiste già un'annata con questo nome" });
      }

      const annataId = id || generateAnnataId();

      const newAnnata = {
        id: annataId,
        nome,
        societyId: societyId || null,   // ← collegata alla società
        dataInizio: dataInizio || '',
        dataFine: dataFine || '',
        descrizione: descrizione || '',
        createdAt: new Date().toISOString()
      };

      annate.push(newAnnata);
      await kv.set('annate:list', annate);

      // Verifica se esistono già dati per questo ID (recupero annata esistente)
      const existingAthletes = await kv.get(`annate:${annataId}:athletes`);

      if (existingAthletes && existingAthletes.length > 0) {
        console.log(`✅ Annata recuperata con dati esistenti: ${nome} (${annataId}) - ${existingAthletes.length} atleti`);
      } else {
        await kv.set(`annate:${annataId}:athletes`, []);
        await kv.set(`annate:${annataId}:evaluations`, {});
        await kv.set(`annate:${annataId}:gpsData`, {});
        await kv.set(`annate:${annataId}:awards`, {});
        await kv.set(`annate:${annataId}:trainingSessions`, {});
        await kv.set(`annate:${annataId}:formationData`, { starters: [], bench: [], tokens: [] });
        await kv.set(`annate:${annataId}:matchResults`, {});
        await kv.set(`annate:${annataId}:calendarEvents`, {});
        await kv.set(`annate:${annataId}:calendarResponses`, {});
        console.log(`✅ Annata creata vuota: ${nome} (${annataId}) societyId=${societyId}`);
      }

      return res.status(200).json({
        success: true,
        message: 'Annata creata con successo',
        annata: newAnnata,
        dataRecovered: !!(existingAthletes && existingAthletes.length > 0)
      });
    }

    // ==========================================
    // UPDATE
    // ==========================================
    if (action === 'update') {
      if (!id || !nome) {
        return res.status(400).json({ success: false, message: 'ID e nome obbligatori' });
      }

      const annataIndex = annate.findIndex(a => a.id === id);
      if (annataIndex === -1) {
        return res.status(404).json({ success: false, message: 'Annata non trovata' });
      }

      // Sicurezza: verifica che l'annata appartenga alla società che fa la richiesta
      if (societyId && annate[annataIndex].societyId && annate[annataIndex].societyId !== societyId) {
        return res.status(403).json({ success: false, message: 'Non autorizzato' });
      }

      annate[annataIndex] = {
        ...annate[annataIndex],
        nome,
        dataInizio: dataInizio || annate[annataIndex].dataInizio || '',
        dataFine: dataFine || annate[annataIndex].dataFine || '',
        descrizione: descrizione !== undefined ? descrizione : annate[annataIndex].descrizione || '',
        updatedAt: new Date().toISOString()
      };

      await kv.set('annate:list', annate);

      console.log(`✅ Annata aggiornata: ${nome} (${id})`);
      return res.status(200).json({ success: true, message: 'Annata aggiornata con successo', annata: annate[annataIndex] });
    }

    // ==========================================
    // DELETE
    // ==========================================
    if (action === 'delete') {
      if (!id) {
        return res.status(400).json({ success: false, message: 'ID annata obbligatorio' });
      }

      const annata = annate.find(a => a.id === id);
      if (!annata) {
        return res.status(404).json({ success: false, message: 'Annata non trovata' });
      }

      // Sicurezza: solo la società proprietaria può eliminare
      if (societyId && annata.societyId && annata.societyId !== societyId) {
        return res.status(403).json({ success: false, message: 'Non autorizzato' });
      }

      const updatedAnnate = annate.filter(a => a.id !== id);
      await kv.set('annate:list', updatedAnnate);

      const keysToDelete = [
        `annate:${id}:athletes`, `annate:${id}:evaluations`, `annate:${id}:gpsData`,
        `annate:${id}:awards`, `annate:${id}:trainingSessions`, `annate:${id}:formationData`,
        `annate:${id}:matchResults`, `annate:${id}:calendarEvents`, `annate:${id}:calendarResponses`
      ];

      for (const key of keysToDelete) {
        try { await kv.del(key); } catch(e) { console.warn(`Non eliminato: ${key}`); }
      }

      // Rimuovi annata dagli utenti coach
      const users = (await kv.get('auth:users')) || [];
      let usersUpdated = false;
      for (let i = 0; i < users.length; i++) {
        if (users[i].annate && users[i].annate.includes(id)) {
          users[i].annate = users[i].annate.filter(a => a !== id);
          usersUpdated = true;
        }
      }
      if (usersUpdated) await kv.set('auth:users', users);

      console.log(`✅ Annata eliminata: ${annata.nome} (${id})`);
      return res.status(200).json({ success: true, message: 'Annata eliminata con successo' });
    }

    return res.status(400).json({ success: false, message: 'Azione non valida. Usa: create, update, delete' });

  } catch (error) {
    console.error('❌ Errore in /api/annate/manage:', error);
    return res.status(500).json({ success: false, message: 'Errore del server', error: error.message });
  }
}
