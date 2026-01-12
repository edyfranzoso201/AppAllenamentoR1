// api/index.js - Versione Semplificata per Debug
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
      console.log('[API] GET richiesta ricevuta');
      
      let data = await kv.get('database');
      
      if (!data) {
        console.log('[API] Database vuoto, carico backup');
        // Carica backup
        try {
          data = require('./backup.json');
          await kv.set('database', data);
        } catch (e) {
          console.error('[API] Errore caricamento backup:', e);
          data = { athletes: [], evaluations: {}, gpsData: {}, awards: {}, trainingSessions: {}, formationData: {}, matchResults: {} };
        }
      }

      // Aggiungi campi calendario se non esistono
      if (!data.calendarEvents) data.calendarEvents = {};
      if (!data.calendarResponses) data.calendarResponses = {};

      console.log('[API] Dati caricati:', Object.keys(data));
      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      // POST - Salva dati
      console.log('[API] POST richiesta ricevuta');
      
      const newData = req.body;
      await kv.set('database', newData);
      
      console.log('[API] Dati salvati');
      return res.status(200).json({ success: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('[API] ERRORE:', error);
    return res.status(500).json({ 
      error: 'Errore server',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
