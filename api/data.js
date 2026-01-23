// api/data.js - Versione compatibile con multi-annata E dati legacy
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Annata-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ottieni l'annata dall'header (default: 2012 per compatibilità)
  const annataId = req.headers['x-annata-id'] || '2012';
  console.log(`📌 ${req.method} per annata: ${annataId}`);

  try {
    if (req.method === 'GET') {
      console.log(`📥 Caricamento dati per annata ${annataId}`);
      
      // Prova prima con le chiavi dell'annata specifica
      const athletesKey = `annate:${annataId}:athletes`;
      const evaluationsKey = `annate:${annataId}:evaluations`;
      const gpsDataKey = `annate:${annataId}:gpsData`;
      const awardsKey = `annate:${annataId}:awards`;
      const sessionsKey = `annate:${annataId}:trainingSessions`;
      const formationKey = `annate:${annataId}:formationData`;
      const matchResultsKey = `annate:${annataId}:matchResults`;
      const eventsKey = `annate:${annataId}:calendarEvents`;
      const responsesKey = `annate:${annataId}:calendarResponses`;

      let athletes = await kv.get(athletesKey);
      let evaluations = await kv.get(evaluationsKey);
      let gpsData = await kv.get(gpsDataKey);
      let awards = await kv.get(awardsKey);
      let trainingSessions = await kv.get(sessionsKey);
      let formationData = await kv.get(formationKey);
      let matchResults = await kv.get(matchResultsKey);
      let calendarEvents = await kv.get(eventsKey);
      let calendarResponses = await kv.get(responsesKey);

      // Se l'annata è 2012 e non ci sono dati, carica dai dati legacy (chiavi vecchie)
      if (annataId === '2012' && (!athletes || (Array.isArray(athletes) && athletes.length === 0))) {
        console.log('⚠️ Nessun dato per annata 2012, carico dati legacy...');
        
        athletes = await kv.get('athletes');
        evaluations = await kv.get('evaluations');
        gpsData = await kv.get('gpsData');
        awards = await kv.get('awards');
        trainingSessions = await kv.get('trainingSessions');
        formationData = await kv.get('formationData');
        matchResults = await kv.get('matchResults');
        calendarEvents = await kv.get('calendarEvents');
        calendarResponses = await kv.get('calendarResponses');

        console.log('📦 Dati legacy caricati:', {
          athletes: athletes ? (Array.isArray(athletes) ? athletes.length : 'obj') : 0,
          evaluations: evaluations ? Object.keys(evaluations).length : 0
        });

        // Se ci sono dati legacy, migrali nelle chiavi dell'annata 2012
        if (athletes && (Array.isArray(athletes) ? athletes.length > 0 : true)) {
          console.log('🔄 Migrazione dati legacy -> annata 2012...');
          
          await kv.set(athletesKey, athletes);
          await kv.set(evaluationsKey, evaluations || {});
          await kv.set(gpsDataKey, gpsData || {});
          await kv.set(awardsKey, awards || {});
          await kv.set(sessionsKey, trainingSessions || {});
          await kv.set(formationKey, formationData || { starters: [], bench: [], tokens: [] });
          await kv.set(matchResultsKey, matchResults || {});
          await kv.set(eventsKey, calendarEvents || {});
          await kv.set(responsesKey, calendarResponses || {});
          
          console.log('✅ Migrazione completata!');
        }
      }

      const data = {
        athletes: athletes || [],
        evaluations: evaluations || {},
        gpsData: gpsData || {},
        awards: awards || {},
        trainingSessions: trainingSessions || {},
        formationData: formationData || { starters: [], bench: [], tokens: [] },
        matchResults: matchResults || {},
        calendarEvents: calendarEvents || {},
        calendarResponses: calendarResponses || {}
      };

      console.log('📊 Dati ritornati:', {
        athletes: Array.isArray(data.athletes) ? data.athletes.length : 'obj',
        evaluations: Object.keys(data.evaluations).length,
        gpsData: Object.keys(data.gpsData).length
      });

      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body;
      console.log(`💾 Salvataggio per annata ${annataId}`);

      // SUPPORTO DOPPIO FORMATO:
      
      // Formato 1: { type: 'athletes', data: [...] } - usato dal calendario
      if (body.type && body.data !== undefined) {
        console.log(`📝 Formato calendario - type: ${body.type}`);
        const key = `annate:${annataId}:${body.type}`;
        await kv.set(key, body.data);
        console.log(`✅ Salvato: ${key}`);
        return res.status(200).json({ success: true, message: `${body.type} salvati` });
      }
      
      // Formato 2: { athletes: [...], evaluations: {...}, ... } - usato da script.js
      else {
        console.log(`📝 Formato completo - salvo tutti i campi`);
        
        const promises = [];
        
        if (body.athletes !== undefined) {
          promises.push(kv.set(`annate:${annataId}:athletes`, body.athletes));
          console.log(`  → athletes: ${Array.isArray(body.athletes) ? body.athletes.length : 'obj'} items`);
        }
        if (body.evaluations !== undefined) {
          promises.push(kv.set(`annate:${annataId}:evaluations`, body.evaluations));
          console.log(`  → evaluations: ${Object.keys(body.evaluations).length} items`);
        }
        if (body.gpsData !== undefined) {
          promises.push(kv.set(`annate:${annataId}:gpsData`, body.gpsData));
          console.log(`  → gpsData: ${Object.keys(body.gpsData).length} items`);
        }
        if (body.awards !== undefined) {
          promises.push(kv.set(`annate:${annataId}:awards`, body.awards));
        }
        if (body.trainingSessions !== undefined) {
          promises.push(kv.set(`annate:${annataId}:trainingSessions`, body.trainingSessions));
        }
        if (body.formationData !== undefined) {
          promises.push(kv.set(`annate:${annataId}:formationData`, body.formationData));
        }
        if (body.matchResults !== undefined) {
          promises.push(kv.set(`annate:${annataId}:matchResults`, body.matchResults));
        }
        if (body.calendarEvents !== undefined) {
          promises.push(kv.set(`annate:${annataId}:calendarEvents`, body.calendarEvents));
        }
        if (body.calendarResponses !== undefined) {
          promises.push(kv.set(`annate:${annataId}:calendarResponses`, body.calendarResponses));
        }

        await Promise.all(promises);
        console.log(`✅ Salvati ${promises.length} oggetti per annata ${annataId}`);
        
        return res.status(200).json({ success: true, itemsSaved: promises.length });
      }
    }

    if (req.method === 'DELETE') {
      const { type } = req.body;
      
      if (!type) {
        return res.status(400).json({ error: 'Parametro type richiesto' });
      }

      const key = `annate:${annataId}:${type}`;
      await kv.del(key);
      console.log(`🗑️ Eliminato: ${key}`);

      return res.status(200).json({ success: true, message: `${type} eliminati` });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });
    
  } catch (error) {
    console.error('❌ Errore in /api/data:', error);
    return res.status(500).json({ 
      message: 'Errore del server',
      error: error.message 
    });
  }
}
