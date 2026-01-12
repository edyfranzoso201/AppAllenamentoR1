// api/index.js - VERSIONE DEFINITIVA
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  // Gestisci OPTIONS per CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // GET - Carica dati
      console.log('[API] GET request ricevuta');
      
      let data = await kv.get('database');

      // Se database vuoto, carica backup
      if (!data || !data.athletes || data.athletes.length === 0) {
        console.log('[API] Database vuoto, carico backup');
        try {
          const backupData = require('./backup.json');
          data = backupData;
          await kv.set('database', data);
          console.log('[API] Backup salvato nel database');
        } catch (e) {
          console.error('[API] Errore caricamento backup:', e);
          data = {
            athletes: [],
            evaluations: {},
            gpsData: {},
            awards: {},
            trainingSessions: {},
            formationData: { starters: [], bench: [], tokens: [] },
            matchResults: {}
          };
        }
      }

      // Assicura che i campi calendario esistano
      if (!data.calendarEvents) {
        data.calendarEvents = {};
      }
      if (!data.calendarResponses) {
        data.calendarResponses = {};
      }

      console.log('[API] Dati caricati con successo');
      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      // POST - Salva dati
      console.log('[API] POST request ricevuta');
      
      const newData = req.body;
      
      // Assicura campi calendario
      if (!newData.calendarEvents) {
        newData.calendarEvents = {};
      }
      if (!newData.calendarResponses) {
        newData.calendarResponses = {};
      }
      
      await kv.set('database', newData);
      
      console.log('[API] Dati salvati con successo');
      return res.status(200).json({ 
        success: true, 
        message: 'Dati salvati correttamente.' 
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('[API] ERRORE:', error);
    return res.status(500).json({ 
      error: 'Errore server', 
      message: error.message,
      stack: error.stack
    });
  }
};
