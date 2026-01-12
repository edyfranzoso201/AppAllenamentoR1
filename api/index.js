// api/index.js - VERSIONE DEFINITIVA FUNZIONANTE
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // GET - Carica dati
      let data = await kv.get('database');

      // Se vuoto, carica backup
      if (!data || !data.athletes || data.athletes.length === 0) {
        try {
          const backupData = require('./backup.json');
          data = backupData;
          await kv.set('database', data);
        } catch (e) {
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

      // Aggiungi campi calendario se mancano
      if (!data.calendarEvents) data.calendarEvents = {};
      if (!data.calendarResponses) data.calendarResponses = {};

      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      // POST - Salva dati
      const newData = req.body;
      
      // Assicura campi calendario
      if (!newData.calendarEvents) newData.calendarEvents = {};
      if (!newData.calendarResponses) newData.calendarResponses = {};
      
      await kv.set('database', newData);
      return res.status(200).json({ success: true, message: 'Dati salvati correttamente.' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Errore API:', error);
    return res.status(500).json({ 
      error: 'Errore server', 
      message: error.message 
    });
  }
};
