import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Annata-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const annataId = req.headers['x-annata-id'];
  
  if (!annataId) {
    return res.status(400).json({ error: 'Header X-Annata-Id mancante' });
  }

  try {
    if (req.method === 'GET') {
      // Chiavi per l'annata specifica
      const athletesKey = `annate:${annataId}:athletes`;
      const eventsKey = `annate:${annataId}:calendarEvents`;
      const responsesKey = `annate:${annataId}:calendarResponses`;
      const awardsKey = `annate:${annataId}:awards`;
      const attendanceKey = `annate:${annataId}:attendanceResponses`;

      // Leggi dati per annata
      let athletes = await kv.get(athletesKey);
      let calendarEvents = await kv.get(eventsKey);
      let calendarResponses = await kv.get(responsesKey);
      let awards = await kv.get(awardsKey);
      let attendanceResponses = await kv.get(attendanceKey);

      // MIGRAZIONE AUTOMATICA: Se non ci sono dati per questa annata, prova a leggere i dati legacy
      if (!athletes || athletes.length === 0) {
        console.log(`Nessun dato trovato per annata ${annataId}, tento migrazione legacy...`);
        
        // Leggi dati legacy
        const legacyAthletes = await kv.get('athletes');
        const legacyEvents = await kv.get('calendarEvents');
        const legacyResponses = await kv.get('calendarResponses');
        const legacyAwards = await kv.get('awards');
        const legacyAttendance = await kv.get('attendanceResponses');

        // Se i dati legacy esistono, migra nell'annata 2012 (annata principale)
        if (legacyAthletes && legacyAthletes.length > 0 && annataId === '2012') {
          console.log('Migrazione dati legacy in corso...');
          
          await kv.set(athletesKey, legacyAthletes);
          await kv.set(eventsKey, legacyEvents || []);
          await kv.set(responsesKey, legacyResponses || []);
          await kv.set(awardsKey, legacyAwards || []);
          await kv.set(attendanceKey, legacyAttendance || []);

          athletes = legacyAthletes;
          calendarEvents = legacyEvents || [];
          calendarResponses = legacyResponses || [];
          awards = legacyAwards || [];
          attendanceResponses = legacyAttendance || [];
          
          console.log('Migrazione completata!');
        }
      }

      return res.status(200).json({
        athletes: athletes || [],
        calendarEvents: calendarEvents || [],
        calendarResponses: calendarResponses || [],
        awards: awards || [],
        attendanceResponses: attendanceResponses || []
      });
    }

    if (req.method === 'POST') {
      const { type, data } = req.body;
      
      if (!type || !data) {
        return res.status(400).json({ error: 'Parametri type e data richiesti' });
      }

      // Chiave specifica per annata
      const key = `annate:${annataId}:${type}`;
      await kv.set(key, data);

      return res.status(200).json({ success: true, message: `${type} salvati per annata ${annataId}` });
    }

    if (req.method === 'DELETE') {
      const { type } = req.body;
      
      if (!type) {
        return res.status(400).json({ error: 'Parametro type richiesto' });
      }

      const key = `annate:${annataId}:${type}`;
      await kv.del(key);

      return res.status(200).json({ success: true, message: `${type} eliminati per annata ${annataId}` });
    }

    return res.status(405).json({ error: 'Metodo non permesso' });

  } catch (error) {
    console.error('Errore API data:', error);
    return res.status(500).json({ error: error.message });
  }
}
