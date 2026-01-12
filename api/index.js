// api/index.js - Versione Vercel Serverless (NON Express)
const { createClient } = require('@vercel/kv');

// Crea il client KV
const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN,
});

// Importa backup (fallback)
let backupData;
try {
  backupData = require('./backup.json');
} catch (e) {
  console.log('Backup non disponibile, uso dati vuoti');
  backupData = {
    athletes: [],
    evaluations: {},
    gpsData: {},
    awards: {},
    trainingSessions: {},
    formationData: { starters: [], bench: [], tokens: [] },
    matchResults: {},
    calendarEvents: {},
    calendarResponses: {}
  };
}

// EXPORT DEFAULT per Vercel Serverless
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  // Gestisci OPTIONS per CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // GET - Carica dati
      console.log('GET /api - Caricamento dati...');
      let data = await kv.get('database');

      // Se database vuoto, carica backup
      if (!data || !data.athletes || data.athletes.length === 0) {
        console.log('Database vuoto, carico backup');
        data = backupData;
        await kv.set('database', data);
        console.log('Backup salvato nel database');
      }

      // Assicura che i campi calendario esistano
      if (!data.calendarEvents) {
        data.calendarEvents = {};
      }
      if (!data.calendarResponses) {
        data.calendarResponses = {};
      }

      console.log('Dati caricati:', {
        atleti: data.athletes?.length || 0,
        eventi: Object.keys(data.calendarEvents || {}).length,
        risposte: Object.keys(data.calendarResponses || {}).length
      });

      res.status(200).json(data);

    } else if (req.method === 'POST') {
      // POST - Salva dati
      console.log('POST /api - Salvataggio dati...');
      
      const dataToSave = {
        ...req.body,
        calendarEvents: req.body.calendarEvents || {},
        calendarResponses: req.body.calendarResponses || {}
      };

      await kv.set('database', dataToSave);

      console.log('Dati salvati:', {
        atleti: dataToSave.athletes?.length || 0,
        eventi: Object.keys(dataToSave.calendarEvents || {}).length,
        risposte: Object.keys(dataToSave.calendarResponses || {}).length
      });

      res.status(200).json({ 
        success: true, 
        message: 'Dati salvati correttamente.' 
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Errore API:', error);
    res.status(500).json({ 
      error: 'Errore server', 
      details: error.message 
    });
  }
};
