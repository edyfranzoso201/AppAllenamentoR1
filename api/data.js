// /api/data.js - VERSIONE FINALE CON MULTI-ANNATA

import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // CORS con supporto header X-Annata-Id
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Annata-Id');  // ✅ AGGIUNTO!
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Leggi annataId dall'header
    const annataId = req.headers['x-annata-id'];
    console.log(`📋 /api/data ${req.method} | annataId: ${annataId || 'LEGACY'}`);

    if (req.method === 'GET') {
      let data = {};

      if (annataId) {
        // 🆕 MULTI-ANNATA: chiavi con namespace
        console.log(`✅ Caricamento dati per annata: ${annataId}`);
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
        console.log(`📦 Dati caricati: ${data.athletes.length} atleti per annata ${annataId}`);
      } else {
        // 🔧 LEGACY: chiavi globali (sistema vecchio)
        console.log(`⚠️ Modalità LEGACY - carico dati globali`);
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
        console.log(`📦 Dati LEGACY: ${data.athletes.length} atleti`);
      }

      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body;

      if (annataId) {
        // 🆕 SALVA CON NAMESPACE
        console.log(`✅ Salvataggio dati per annata: ${annataId}`);
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
      } else {
        // 🔧 SALVA LEGACY
        console.log(`⚠️ Salvataggio LEGACY`);
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
      }

      console.log(`✅ Dati salvati con successo`);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore /api/data:', error.message);
    return res.status(500).json({ message: 'Errore del server', error: error.message });
  }
}
