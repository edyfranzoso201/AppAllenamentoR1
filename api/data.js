// api/data.js - Endpoint per caricare/salvare dati PER ANNATA
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Annata-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ottieni l'ID annata dall'header
    const annataId = req.headers['x-annata-id'] || req.headers['X-Annata-Id'];
    
    if (!annataId) {
      return res.status(400).json({ 
        success: false,
        message: 'Header X-Annata-Id obbligatorio' 
      });
    }

    // Prefisso per le chiavi di questa annata
    const prefix = `annate:${annataId}`;

    if (req.method === 'GET') {
      // Carica tutti i dati dell'annata specifica
      const data = {
        athletes: (await kv.get(`${prefix}:athletes`)) || [],
        evaluations: (await kv.get(`${prefix}:evaluations`)) || {},
        gpsData: (await kv.get(`${prefix}:gpsData`)) || {},
        awards: (await kv.get(`${prefix}:awards`)) || {},
        trainingSessions: (await kv.get(`${prefix}:trainingSessions`)) || {},
        formationData: (await kv.get(`${prefix}:formationData`)) || { starters: [], bench: [], tokens: [] },
        matchResults: (await kv.get(`${prefix}:matchResults`)) || {},
        calendarEvents: (await kv.get(`${prefix}:calendarEvents`)) || {},
        calendarResponses: (await kv.get(`${prefix}:calendarResponses`)) || {},
      };
      
      console.log(`✅ GET /api/data - Annata: ${annataId} - Atleti: ${data.athletes.length}`);
      
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // Salva tutti i dati dell'annata specifica
      const body = req.body;
      
      if (body.athletes !== undefined) await kv.set(`${prefix}:athletes`, body.athletes);
      if (body.evaluations !== undefined) await kv.set(`${prefix}:evaluations`, body.evaluations);
      if (body.gpsData !== undefined) await kv.set(`${prefix}:gpsData`, body.gpsData);
      if (body.awards !== undefined) await kv.set(`${prefix}:awards`, body.awards);
      if (body.trainingSessions !== undefined) await kv.set(`${prefix}:trainingSessions`, body.trainingSessions);
      if (body.formationData !== undefined) await kv.set(`${prefix}:formationData`, body.formationData);
      if (body.matchResults !== undefined) await kv.set(`${prefix}:matchResults`, body.matchResults);
      if (body.calendarEvents !== undefined) await kv.set(`${prefix}:calendarEvents`, body.calendarEvents);
      if (body.calendarResponses !== undefined) await kv.set(`${prefix}:calendarResponses`, body.calendarResponses);

      console.log(`✅ POST /api/data - Annata: ${annataId} - Dati salvati`);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });
  } catch (error) {
    console.error('❌ Errore in /api/data:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server',
      error: error.message 
    });
  }
}
