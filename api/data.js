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
      console.error('❌ Header X-Annata-Id mancante');
      return res.status(400).json({ 
        success: false, 
        message: 'Header X-Annata-Id obbligatorio' 
      });
    }

    // Prefisso per le chiavi di questa annata
    const prefix = `annate:${annataId}`;
    console.log(`📡 API data.js - Metodo: ${req.method} - Annata: ${annataId}`);

    if (req.method === 'GET') {
      // Carica tutti i dati dell'annata specifica con gestione null sicura
      const rawData = {
        athletes: await kv.get(`${prefix}:athletes`),
        evaluations: await kv.get(`${prefix}:evaluations`),
        gpsData: await kv.get(`${prefix}:gpsData`),
        awards: await kv.get(`${prefix}:awards`),
        trainingSessions: await kv.get(`${prefix}:trainingSessions`),
        formationData: await kv.get(`${prefix}:formationData`),
        matchResults: await kv.get(`${prefix}:matchResults`),
        calendarEvents: await kv.get(`${prefix}:calendarEvents`),
        calendarResponses: await kv.get(`${prefix}:calendarResponses`),
      };

      // Gestisci valori null da Redis con fallback sicuri
      const data = {
        athletes: rawData.athletes ?? [],
        evaluations: rawData.evaluations ?? {},
        gpsData: rawData.gpsData ?? {},
        awards: rawData.awards ?? {},
        trainingSessions: rawData.trainingSessions ?? {},
        formationData: rawData.formationData ?? { starters: [], bench: [], tokens: [] },
        matchResults: rawData.matchResults ?? {},
        calendarEvents: rawData.calendarEvents ?? {},
        calendarResponses: rawData.calendarResponses ?? {},
      };

      // Log dettagliato per debug
      console.log(`✅ GET /api/data - Annata: ${annataId}`);
      console.log(`   📊 Athletes: ${Array.isArray(data.athletes) ? data.athletes.length : 0}`);
      console.log(`   📊 Evaluations: ${Object.keys(data.evaluations).length}`);
      console.log(`   📊 GpsData: ${Object.keys(data.gpsData).length}`);
      console.log(`   📊 MatchResults: ${Object.keys(data.matchResults).length}`);

      // Verifica se tutti i dati sono vuoti
      const isEmpty = 
        data.athletes.length === 0 &&
        Object.keys(data.evaluations).length === 0 &&
        Object.keys(data.gpsData).length === 0;

      if (isEmpty) {
        console.warn(`⚠️ ATTENZIONE: Database Redis vuoto per annata ${annataId}`);
      }

      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // Salva tutti i dati dell'annata specifica
      const body = req.body;

      console.log(`💾 POST /api/data - Annata: ${annataId}`);
      console.log(`   📥 Athletes ricevuti: ${body.athletes?.length || 0}`);
      console.log(`   📥 Evaluations ricevute: ${Object.keys(body.evaluations || {}).length}`);

      // Salva solo i dati presenti nel body
      const savePromises = [];

      if (body.athletes !== undefined) {
        savePromises.push(kv.set(`${prefix}:athletes`, body.athletes));
      }
      if (body.evaluations !== undefined) {
        savePromises.push(kv.set(`${prefix}:evaluations`, body.evaluations));
      }
      if (body.gpsData !== undefined) {
        savePromises.push(kv.set(`${prefix}:gpsData`, body.gpsData));
      }
      if (body.awards !== undefined) {
        savePromises.push(kv.set(`${prefix}:awards`, body.awards));
      }
      if (body.trainingSessions !== undefined) {
        savePromises.push(kv.set(`${prefix}:trainingSessions`, body.trainingSessions));
      }
      if (body.formationData !== undefined) {
        savePromises.push(kv.set(`${prefix}:formationData`, body.formationData));
      }
      if (body.matchResults !== undefined) {
        savePromises.push(kv.set(`${prefix}:matchResults`, body.matchResults));
      }
      if (body.calendarEvents !== undefined) {
        savePromises.push(kv.set(`${prefix}:calendarEvents`, body.calendarEvents));
      }
      if (body.calendarResponses !== undefined) {
        savePromises.push(kv.set(`${prefix}:calendarResponses`, body.calendarResponses));
      }

      // Esegui tutti i salvataggi in parallelo
      await Promise.all(savePromises);

      console.log(`✅ POST /api/data - Dati salvati per annata ${annataId}`);
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
