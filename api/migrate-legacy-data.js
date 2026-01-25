// api/migrate-legacy-data.js - Script di migrazione dati legacy → annata 2012
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Solo POST' });
  }

  try {
    const ANNATA_2012_ID = 'mko5iuzhw2xrxxiuoi';
    const prefix = `annate:${ANNATA_2012_ID}`;
    
    console.log('🔄 Inizio migrazione dati legacy...');
    
    // Leggi dati dalle chiavi legacy
    const legacyData = {
      athletes: await kv.get('athletes'),
      evaluations: await kv.get('evaluations'),
      gpsData: await kv.get('gpsData'),
      awards: await kv.get('awards'),
      trainingSessions: await kv.get('trainingSessions'),
      formationData: await kv.get('formationData'),
      matchResults: await kv.get('matchResults'),
      calendarEvents: await kv.get('calendarEvents'),
      calendarResponses: await kv.get('calendarResponses'),
    };
    
    let migrated = 0;
    const report = {};
    
    // Copia nelle nuove chiavi con prefisso annata
    if (legacyData.athletes) {
      await kv.set(`${prefix}:athletes`, legacyData.athletes);
      report.athletes = legacyData.athletes.length;
      migrated++;
    }
    
    if (legacyData.evaluations) {
      await kv.set(`${prefix}:evaluations`, legacyData.evaluations);
      report.evaluations = Object.keys(legacyData.evaluations).length;
      migrated++;
    }
    
    if (legacyData.gpsData) {
      await kv.set(`${prefix}:gpsData`, legacyData.gpsData);
      report.gpsData = Object.keys(legacyData.gpsData).length;
      migrated++;
    }
    
    if (legacyData.awards) {
      await kv.set(`${prefix}:awards`, legacyData.awards);
      report.awards = Object.keys(legacyData.awards).length;
      migrated++;
    }
    
    if (legacyData.trainingSessions) {
      await kv.set(`${prefix}:trainingSessions`, legacyData.trainingSessions);
      report.trainingSessions = Object.keys(legacyData.trainingSessions).length;
      migrated++;
    }
    
    if (legacyData.formationData) {
      await kv.set(`${prefix}:formationData`, legacyData.formationData);
      report.formationData = 'migrated';
      migrated++;
    }
    
    if (legacyData.matchResults) {
      await kv.set(`${prefix}:matchResults`, legacyData.matchResults);
      report.matchResults = Object.keys(legacyData.matchResults).length;
      migrated++;
    }
    
    if (legacyData.calendarEvents) {
      await kv.set(`${prefix}:calendarEvents`, legacyData.calendarEvents);
      report.calendarEvents = Object.keys(legacyData.calendarEvents).length;
      migrated++;
    }
    
    if (legacyData.calendarResponses) {
      await kv.set(`${prefix}:calendarResponses`, legacyData.calendarResponses);
      report.calendarResponses = Object.keys(legacyData.calendarResponses).length;
      migrated++;
    }
    
    console.log('✅ Migrazione completata:', report);
    
    return res.status(200).json({
      success: true,
      message: '✅ Migrazione completata con successo!',
      annataId: ANNATA_2012_ID,
      chiavi_migrate: migrated,
      dettagli: report
    });
    
  } catch (error) {
    console.error('❌ Errore migrazione:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore durante la migrazione',
      error: error.message
    });
  }
}
