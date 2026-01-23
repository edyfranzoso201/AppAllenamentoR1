import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Questo endpoint è SOLO per diagnostica - da rimuovere dopo
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo GET permesso' });
  }

  try {
    console.log('🔍 INIZIO DIAGNOSTICA DATABASE');
    
    // 1. Controlla tutte le chiavi nel database
    const allKeys = await kv.keys('*');
    console.log('📋 Tutte le chiavi trovate:', allKeys);
    
    const report = {
      timestamp: new Date().toISOString(),
      totalKeys: allKeys.length,
      keys: allKeys,
      legacyData: {},
      annata2012Data: {},
      annata2013Data: {},
      migration: null
    };

    // 2. Controlla dati LEGACY (vecchio formato)
    const legacyKeys = ['athletes', 'calendarEvents', 'calendarResponses', 'awards', 'attendanceResponses'];
    
    for (const key of legacyKeys) {
      const data = await kv.get(key);
      report.legacyData[key] = {
        exists: data !== null,
        length: Array.isArray(data) ? data.length : 'N/A',
        sample: Array.isArray(data) && data.length > 0 ? data[0] : null
      };
      console.log(`📦 Legacy ${key}:`, report.legacyData[key]);
    }

    // 3. Controlla dati ANNATA 2012
    const annata2012Keys = [
      'annate:2012:athletes',
      'annate:2012:calendarEvents',
      'annate:2012:calendarResponses',
      'annate:2012:awards',
      'annate:2012:attendanceResponses'
    ];
    
    for (const key of annata2012Keys) {
      const data = await kv.get(key);
      const shortKey = key.replace('annate:2012:', '');
      report.annata2012Data[shortKey] = {
        exists: data !== null,
        length: Array.isArray(data) ? data.length : 'N/A',
        sample: Array.isArray(data) && data.length > 0 ? data[0] : null
      };
      console.log(`📊 Annata 2012 ${shortKey}:`, report.annata2012Data[shortKey]);
    }

    // 4. Controlla dati ANNATA 2013
    const annata2013Keys = [
      'annate:2013:athletes',
      'annate:2013:calendarEvents',
      'annate:2013:calendarResponses',
      'annate:2013:awards',
      'annate:2013:attendanceResponses'
    ];
    
    for (const key of annata2013Keys) {
      const data = await kv.get(key);
      const shortKey = key.replace('annate:2013:', '');
      report.annata2013Data[shortKey] = {
        exists: data !== null,
        length: Array.isArray(data) ? data.length : 'N/A'
      };
      console.log(`📊 Annata 2013 ${shortKey}:`, report.annata2013Data[shortKey]);
    }

    // 5. MIGRAZIONE AUTOMATICA se necessario
    const hasLegacyData = report.legacyData.athletes?.exists && report.legacyData.athletes.length > 0;
    const needs2012Migration = !report.annata2012Data.athletes?.exists || report.annata2012Data.athletes.length === 0;

    if (hasLegacyData && needs2012Migration) {
      console.log('🔄 ESEGUO MIGRAZIONE AUTOMATICA...');
      
      try {
        // Leggi tutti i dati legacy
        const athletes = await kv.get('athletes');
        const calendarEvents = await kv.get('calendarEvents');
        const calendarResponses = await kv.get('calendarResponses');
        const awards = await kv.get('awards');
        const attendanceResponses = await kv.get('attendanceResponses');

        // Salva nell'annata 2012
        await kv.set('annate:2012:athletes', athletes || []);
        await kv.set('annate:2012:calendarEvents', calendarEvents || []);
        await kv.set('annate:2012:calendarResponses', calendarResponses || []);
        await kv.set('annate:2012:awards', awards || []);
        await kv.set('annate:2012:attendanceResponses', attendanceResponses || []);

        report.migration = {
          status: 'SUCCESS',
          message: 'Dati legacy migrati all\'annata 2012',
          itemsMigrated: {
            athletes: athletes?.length || 0,
            calendarEvents: calendarEvents?.length || 0,
            calendarResponses: calendarResponses?.length || 0,
            awards: awards?.length || 0,
            attendanceResponses: attendanceResponses?.length || 0
          }
        };

        console.log('✅ MIGRAZIONE COMPLETATA:', report.migration);

      } catch (migrationError) {
        report.migration = {
          status: 'ERROR',
          message: migrationError.message
        };
        console.error('❌ ERRORE MIGRAZIONE:', migrationError);
      }
    } else if (!hasLegacyData) {
      report.migration = {
        status: 'SKIPPED',
        message: 'Nessun dato legacy da migrare'
      };
      console.log('⚠️ Nessun dato legacy trovato');
    } else {
      report.migration = {
        status: 'SKIPPED',
        message: 'Dati annata 2012 già presenti'
      };
      console.log('ℹ️ Dati annata 2012 già presenti');
    }

    // 6. Ritorna report completo
    return res.status(200).json({
      success: true,
      report: report,
      summary: {
        legacyDataExists: hasLegacyData,
        annata2012HasData: report.annata2012Data.athletes?.exists && report.annata2012Data.athletes.length > 0,
        annata2013HasData: report.annata2013Data.athletes?.exists && report.annata2013Data.athletes.length > 0,
        migrationPerformed: report.migration?.status === 'SUCCESS'
      }
    });

  } catch (error) {
    console.error('❌ ERRORE DIAGNOSTICA:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
