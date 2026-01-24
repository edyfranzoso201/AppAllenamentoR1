// api/data.js - BACKWARD COMPATIBLE con index.html vecchio
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

  // Leggi annata dall'header (se presente)
  const annataId = req.headers['x-annata-id'];
  
  try {
    if (req.method === 'GET') {
      let data;
      
      // CASO 1: NESSUN HEADER (index.html vecchio) → USA CHIAVI LEGACY
      if (!annataId) {
        console.log('📥 GET senza header (modalità legacy)');
        data = {
          athletes: (await kv.get('athletes')) || [],
          evaluations: (await kv.get('evaluations')) || {},
          gpsData: (await kv.get('gpsData')) || {},
          awards: (await kv.get('awards')) || {},
          trainingSessions: (await kv.get('trainingSessions')) || {},
          formationData: (await kv.get('formationData')) || { starters: [], bench: [], tokens: [] },
          matchResults: (await kv.get('matchResults')) || {},
          calendarEvents: (await kv.get('calendarEvents')) || {},
          calendarResponses: (await kv.get('calendarResponses')) || {},
        };
      }
      // CASO 2: Annata 2012 → USA CHIAVI LEGACY
      else if (annataId === '2012') {
        console.log('📥 GET annata 2012 (chiavi legacy)');
        data = {
          athletes: (await kv.get('athletes')) || [],
          evaluations: (await kv.get('evaluations')) || {},
          gpsData: (await kv.get('gpsData')) || {},
          awards: (await kv.get('awards')) || {},
          trainingSessions: (await kv.get('trainingSessions')) || {},
          formationData: (await kv.get('formationData')) || { starters: [], bench: [], tokens: [] },
          matchResults: (await kv.get('matchResults')) || {},
          calendarEvents: (await kv.get('calendarEvents')) || {},
          calendarResponses: (await kv.get('calendarResponses')) || {},
        };
      }
      // CASO 3: Altre annate → USA CHIAVI SEPARATE
      else {
        console.log(`📥 GET annata ${annataId} (chiavi separate)`);
        data = {
          athletes: (await kv.get(`annate:${annataId}:athletes`)) || [],
          evaluations: (await kv.get(`annate:${annataId}:evaluations`)) || {},
          gpsData: (await kv.get(`annate:${annataId}:gpsData`)) || {},
          awards: (await kv.get(`annate:${annataId}:awards`)) || {},
          trainingSessions: (await kv.get(`annate:${annataId}:trainingSessions`)) || {},
          formationData: (await kv.get(`annate:${annataId}:formationData`)) || { starters: [], bench: [], tokens: [] },
          matchResults: (await kv.get(`annate:${annataId}:matchResults`)) || {},
          calendarEvents: (await kv.get(`annate:${annataId}:calendarEvents`)) || {},
          calendarResponses: (await kv.get(`annate:${annataId}:calendarResponses`)) || {},
        };
      }
      
      console.log(`✅ Ritornati ${data.athletes?.length || 0} atleti`);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body;
      
      // CASO 1: NESSUN HEADER (index.html vecchio) → USA CHIAVI LEGACY
      if (!annataId) {
        console.log('💾 POST senza header (modalità legacy)');
        if (body.athletes !== undefined) await kv.set('athletes', body.athletes);
        if (body.evaluations !== undefined) await kv.set('evaluations', body.evaluations);
        if (body.gpsData !== undefined) await kv.set('gpsData', body.gpsData);
        if (body.awards !== undefined) await kv.set('awards', body.awards);
        if (body.trainingSessions !== undefined) await kv.set('trainingSessions', body.trainingSessions);
        if (body.formationData !== undefined) await kv.set('formationData', body.formationData);
        if (body.matchResults !== undefined) await kv.set('matchResults', body.matchResults);
        if (body.calendarEvents !== undefined) await kv.set('calendarEvents', body.calendarEvents);
        if (body.calendarResponses !== undefined) await kv.set('calendarResponses', body.calendarResponses);
      }
      // CASO 2: Annata 2012 → USA CHIAVI LEGACY
      else if (annataId === '2012') {
        console.log('💾 POST annata 2012 (chiavi legacy)');
        if (body.athletes !== undefined) await kv.set('athletes', body.athletes);
        if (body.evaluations !== undefined) await kv.set('evaluations', body.evaluations);
        if (body.gpsData !== undefined) await kv.set('gpsData', body.gpsData);
        if (body.awards !== undefined) await kv.set('awards', body.awards);
        if (body.trainingSessions !== undefined) await kv.set('trainingSessions', body.trainingSessions);
        if (body.formationData !== undefined) await kv.set('formationData', body.formationData);
        if (body.matchResults !== undefined) await kv.set('matchResults', body.matchResults);
        if (body.calendarEvents !== undefined) await kv.set('calendarEvents', body.calendarEvents);
        if (body.calendarResponses !== undefined) await kv.set('calendarResponses', body.calendarResponses);
      }
      // CASO 3: Altre annate → USA CHIAVI SEPARATE
      else {
        console.log(`💾 POST annata ${annataId} (chiavi separate)`);
        if (body.athletes !== undefined) await kv.set(`annate:${annataId}:athletes`, body.athletes);
        if (body.evaluations !== undefined) await kv.set(`annate:${annataId}:evaluations`, body.evaluations);
        if (body.gpsData !== undefined) await kv.set(`annate:${annataId}:gpsData`, body.gpsData);
        if (body.awards !== undefined) await kv.set(`annate:${annataId}:awards`, body.awards);
        if (body.trainingSessions !== undefined) await kv.set(`annate:${annataId}:trainingSessions`, body.trainingSessions);
        if (body.formationData !== undefined) await kv.set(`annate:${annataId}:formationData`, body.formationData);
        if (body.matchResults !== undefined) await kv.set(`annate:${annataId}:matchResults`, body.matchResults);
        if (body.calendarEvents !== undefined) await kv.set(`annate:${annataId}:calendarEvents`, body.calendarEvents);
        if (body.calendarResponses !== undefined) await kv.set(`annate:${annataId}:calendarResponses`, body.calendarResponses);
      }

      console.log('✅ Dati salvati con successo');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });
  } catch (error) {
    console.error('❌ Errore in /api/data:', error);
    return res.status(500).json({ message: 'Errore del server', error: error.message });
  }
}
