// api/annate/manage.js - Gestione unificata annate
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' });
  }

  try {
    const { action, id, nome, dataInizio, dataFine, descrizione } = req.body;

    if (!action) {
      return res.status(400).json({ 
        success: false,
        message: 'Parametro "action" obbligatorio (create, update, delete)' 
      });
    }

    const annate = (await kv.get('annate:list')) || [];

    // ==========================================
    // CREATE - Crea nuova annata
    // ==========================================
    if (action === 'create') {
      if (!nome || !dataInizio || !dataFine) {
        return res.status(400).json({ 
          success: false,
          message: 'Nome, data inizio e data fine obbligatori' 
        });
      }

      if (annate.find(a => a.nome === nome)) {
        return res.status(400).json({ 
          success: false,
          message: 'Esiste già un\'annata con questo nome' 
        });
      }

      const newAnnata = {
        id: id || generateAnnataId(),  // ← Usa ID fornito o genera
        nome,
        dataInizio,
        dataFine,
        descrizione: descrizione || '',
        createdAt: new Date().toISOString()
      };

      annate.push(newAnnata);
      await kv.set('annate:list', annate);

      // Inizializza dati vuoti
      await kv.set(`annate:${newAnnata.id}:athletes`, []);
      await kv.set(`annate:${newAnnata.id}:evaluations`, {});
      await kv.set(`annate:${newAnnata.id}:gpsData`, {});
      await kv.set(`annate:${newAnnata.id}:awards`, {});
      await kv.set(`annate:${newAnnata.id}:trainingSessions`, {});
      await kv.set(`annate:${newAnnata.id}:formationData`, { starters: [], bench: [], tokens: [] });
      await kv.set(`annate:${newAnnata.id}:matchResults`, {});
      await kv.set(`annate:${newAnnata.id}:calendarEvents`, {});
      await kv.set(`annate:${newAnnata.id}:calendarResponses`, {});

      console.log(`✅ Annata creata: ${nome} (${newAnnata.id})`);
      return res.status(200).json({ 
        success: true,
        message: 'Annata creata con successo',
        annata: newAnnata
      });
    }

    // ==========================================
    // UPDATE - Modifica annata esistente
    // ==========================================
    if (action === 'update') {
      if (!id || !nome || !dataInizio || !dataFine) {
        return res.status(400).json({ 
          success: false,
          message: 'ID, nome, data inizio e data fine obbligatori' 
        });
      }

      const annataIndex = annate.findIndex(a => a.id === id);
      if (annataIndex === -1) {
        return res.status(404).json({ 
          success: false,
          message: 'Annata non trovata' 
        });
      }

      annate[annataIndex] = {
        ...annate[annataIndex],
        nome,
        dataInizio,
        dataFine,
        descrizione: descrizione || '',
        updatedAt: new Date().toISOString()
      };

      await kv.set('annate:list', annate);

      console.log(`✅ Annata aggiornata: ${nome} (${id})`);
      return res.status(200).json({ 
        success: true,
        message: 'Annata aggiornata con successo',
        annata: annate[annataIndex]
      });
    }

    // ==========================================
    // DELETE - Elimina annata
    // ==========================================
    if (action === 'delete') {
      if (!id) {
        return res.status(400).json({ 
          success: false,
          message: 'ID annata obbligatorio' 
        });
      }

      const annata = annate.find(a => a.id === id);
      if (!annata) {
        return res.status(404).json({ 
          success: false,
          message: 'Annata non trovata' 
        });
      }

      // Rimuovi dalla lista
      const updatedAnnate = annate.filter(a => a.id !== id);
      await kv.set('annate:list', updatedAnnate);

      // Elimina dati
      const keysToDelete = [
        `annate:${id}:athletes`,
        `annate:${id}:evaluations`,
        `annate:${id}:gpsData`,
        `annate:${id}:awards`,
        `annate:${id}:trainingSessions`,
        `annate:${id}:formationData`,
        `annate:${id}:matchResults`,
        `annate:${id}:calendarEvents`,
        `annate:${id}:calendarResponses`
      ];

      for (const key of keysToDelete) {
        try {
          await kv.del(key);
        } catch (e) {
          console.warn(`Impossibile eliminare: ${key}`);
        }
      }

      // Rimuovi da utenti coach
      const users = (await kv.get('auth:users')) || [];
      let usersUpdated = false;

      for (let i = 0; i < users.length; i++) {
        if (users[i].annate && users[i].annate.includes(id)) {
          users[i].annate = users[i].annate.filter(a => a !== id);
          usersUpdated = true;
        }
      }

      if (usersUpdated) {
        await kv.set('auth:users', users);
      }

      console.log(`✅ Annata eliminata: ${annata.nome} (${id})`);
      return res.status(200).json({ 
        success: true,
        message: 'Annata eliminata con successo'
      });
    }

    return res.status(400).json({ 
      success: false,
      message: 'Azione non valida. Usa: create, update, delete' 
    });

  } catch (error) {
    console.error('❌ Errore in /api/annate/manage:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server', 
      error: error.message 
    });
  }
}
