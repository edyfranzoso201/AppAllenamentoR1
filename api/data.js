// api/data.js - VERSIONE FINALE CON MULTI-ANNATA

import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Annata-Id');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const annataId = req.headers['x-annata-id'];

    if (req.method === 'GET') {
      let data = {};

      if (annataId) {
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

        if (data.athletes.length === 0) {
          const legacy = (await kv.get('athletes')) || [];
          if (legacy.length > 0) {
            console.log(`🔄 Migrazione ${legacy.length} atleti legacy → ${annataId}`);
            data = {
              athletes: legacy,
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
            await Promise.all([
              kv.set(`data:${annataId}:athletes`, data.athletes),
              kv.set(`data:${annataId}:evaluations`, data.evaluations),
              kv.set(`data:${annataId}:gpsData`, data.gpsData),
              kv.set(`data:${annataId}:awards`, data.awards),
              kv.set(`data:${annataId}:trainingSessions`, data.trainingSessions),
              kv.set(`data:${annataId}:formationData`, data.formationData),
              kv.set(`data:${annataId}:matchResults`, data.matchResults),
              kv.set(`data:${annataId}:calendarEvents`, data.calendarEvents),
              kv.set(`data:${annataId}:calendarResponses`, data.calendarResponses),
              kv.set(`data:${annataId}:attendanceResponses`, data.attendanceResponses)
            ]);
            console.log(`✅ Migrazione completata!`);
          }
        }
      } else {
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
      }

      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body;

      if (annataId) {
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

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });

  } catch (error) {
    console.error('❌ Errore /api/data:', error);
    return res.status(500).json({ message: 'Errore del server', error: error.message });
  }
}
