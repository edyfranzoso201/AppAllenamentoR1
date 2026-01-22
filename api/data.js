// /api/data.js - Versione SEMPLICE + FIX CALENDARIO

import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // 📖 CARICA tutti i dati GLOBALI
      const data = {
        athletes: (await kv.get('athletes')) || [],
        evaluations: (await kv.get('evaluations')) || {},
        gpsData: (await kv.get('gpsData')) || {},
        awards: (await kv.get('awards')) || {},
        trainingSessions: (await kv.get('trainingSessions')) || {},
        formationData: (await kv.get('formationData')) || { starters: [], bench: [], tokens: [] },
        matchResults: (await kv.get('matchResults')) || {},
        calendarEvents: (await kv.get('calendarEvents')) || {},
        calendarResponses: (await kv.get('calendarResponses')) || {},
        attendanceResponses: (await kv.get('attendanceResponses')) || {}, // ✅ AGGIUNTO - FIX CALENDARIO
      };
      
      console.log(`✅ GET /api/data - ${data.athletes?.length || 0} atleti caricati`);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // 💾 SALVA tutti i dati GLOBALI
      const body = req.body;
      
      if (body.athletes !== undefined) await kv.set('athletes', body.athletes);
      if (body.evaluations !== undefined) await kv.set('evaluations', body.evaluations);
      if (body.gpsData !== undefined) await kv.set('gpsData', body.gpsData);
      if (body.awards !== undefined) await kv.set('awards', body.awards);
      if (body.trainingSessions !== undefined) await kv.set('trainingSessions', body.trainingSessions);
      if (body.formationData !== undefined) await kv.set('formationData', body.formationData);
      if (body.matchResults !== undefined) await kv.set('matchResults', body.matchResults);
      if (body.calendarEvents !== undefined) await kv.set('calendarEvents', body.calendarEvents);
      if (body.calendarResponses !== undefined) await kv.set('calendarResponses', body.calendarResponses);
      if (body.attendanceResponses !== undefined) await kv.set('attendanceResponses', body.attendanceResponses); // ✅ AGGIUNTO
      
      console.log(`✅ POST /api/data - dati salvati`);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore /api/data:', error.message);
    return res.status(500).json({ message: 'Errore del server', error: error.message });
  }
}
