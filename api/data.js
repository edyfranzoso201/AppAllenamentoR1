// api/data.js - Endpoint compatibile con multi-annata E sistema legacy

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
    // ✅ Ottieni annataId dall'header (supporto multi-annata)
    let annataId = req.headers['x-annata-id'];
    
    // Se non c'è header, usa il sistema LEGACY (chiavi globali)
    const isLegacy = !annataId;
    
    if (isLegacy) {
      console.warn("⚠️ Modalità LEGACY - nessun header x-annata-id");
    } else {
      console.log(`✅ Modalità MULTI-ANNATA - annataId: ${annataId}`);
    }

    if (req.method === 'GET') {
      // Carica dati
      let data;
      
      if (isLegacy) {
        // Sistema vecchio - chiavi globali
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
          attendanceResponses: (await kv.get('attendanceResponses')) || {},
        };
      } else {
        // Sistema multi-annata - chiavi con namespace
        data = {
          athletes: (await kv.get(`data:${annataId}:athletes`)) || [],
          evaluations: (await kv.get(`data:${annataId}:evaluations`)) || {},
          gpsData: (await kv.get(`data:${annataId}:gpsData`)) || {},
          awards: (await kv.get(`data:${annataId}:awards`)) || {},
          trainingSessions: (await kv.get(`data:${annataId}:trainingSessions`)) || {},
          formationData: (await kv.get(`data:${annataId}:formationData`)) || { starters: [], bench: [], tokens: [] },
          matchResults: (await kv.get(`data:${annataId}:matchResults`)) || {},
          calendarEvents: (await kv.get(`data:${annataId}:calendarEvents`)) || {},
          calendarResponses: (await kv.get(`data:${annataId}:calendarResponses`)) || {},
          attendanceResponses: (await kv.get(`data:${annataId}:attendanceResponses`)) || {},
        };
      }
      
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // Salva dati
      const body = req.body;
      
      if (isLegacy) {
        // Sistema vecchio - chiavi globali
        if (body.athletes !== undefined) await kv.set('athletes', body.athletes);
        if (body.evaluations !== undefined) await kv.set('evaluations', body.evaluations);
        if (body.gpsData !== undefined) await kv.set('gpsData', body.gpsData);
        if (body.awards !== undefined) await kv.set('awards', body.awards);
        if (body.trainingSessions !== undefined) await kv.set('trainingSessions', body.trainingSessions);
        if (body.formationData !== undefined) await kv.set('formationData', body.formationData);
        if (body.matchResults !== undefined) await kv.set('matchResults', body.matchResults);
        if (body.calendarEvents !== undefined) await kv.set('calendarEvents', body.calendarEvents);
        if (body.calendarResponses !== undefined) await kv.set('calendarResponses', body.calendarResponses);
        if (body.attendanceResponses !== undefined) await kv.set('attendanceResponses', body.attendanceResponses);
      } else {
        // Sistema multi-annata - chiavi con namespace
        if (body.athletes !== undefined) await kv.set(`data:${annataId}:athletes`, body.athletes);
        if (body.evaluations !== undefined) await kv.set(`data:${annataId}:evaluations`, body.evaluations);
        if (body.gpsData !== undefined) await kv.set(`data:${annataId}:gpsData`, body.gpsData);
        if (body.awards !== undefined) await kv.set(`data:${annataId}:awards`, body.awards);
        if (body.trainingSessions !== undefined) await kv.set(`data:${annataId}:trainingSessions`, body.trainingSessions);
        if (body.formationData !== undefined) await kv.set(`data:${annataId}:formationData`, body.formationData);
        if (body.matchResults !== undefined) await kv.set(`data:${annataId}:matchResults`, body.matchResults);
        if (body.calendarEvents !== undefined) await kv.set(`data:${annataId}:calendarEvents`, body.calendarEvents);
        if (body.calendarResponses !== undefined) await kv.set(`data:${annataId}:calendarResponses`, body.calendarResponses);
        if (body.attendanceResponses !== undefined) await kv.set(`data:${annataId}:attendanceResponses`, body.attendanceResponses);
      }
      
      console.log(`✅ Dati salvati con successo (${isLegacy ? 'LEGACY' : 'annata: ' + annataId})`);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore in /api/data:', error);
    return res.status(500).json({ message: 'Errore del server', error: error.message });
  }
}
