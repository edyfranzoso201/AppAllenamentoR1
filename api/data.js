// api/data.js - Endpoint per caricare/salvare dati PER ANNATA
import { createClient } from '@vercel/kv';
import { gzipSync } from 'zlib';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Helper CORS — accetta solo domini autorizzati
function setCors(req, res) {
  const origin = req.headers['origin'] || '';
  const allowed = [
    'https://app-allenamento-r1.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ];
  const originToSet = allowed.includes(origin) ? origin : allowed[0];
  res.setHeader('Access-Control-Allow-Origin', originToSet);
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  // CORS
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Annata-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ottieni l'ID annata dall'header
    // Prende solo il primo valore (evita duplicati da adapter: "id, id")
    const _rawAnnata = req.headers['x-annata-id'] || req.headers['X-Annata-Id'] || '';
    const annataId = _rawAnnata.split(',')[0].trim();

    // Validazione formato annataId — solo caratteri alfanumerici
    if (annataId && !/^[a-z0-9]+$/i.test(annataId)) {
      return res.status(400).json({ success: false, message: 'Formato annataId non valido' });
    }

    if (!annataId) {
      // Senza annataId: restituisce solo i post globali (pagina bacheca pubblica)
      if (req.method === 'GET') {
        const globalPosts = (await kv.get('global:posts')) || [];
        const teamName = (await kv.get('global:teamName')) || 'GO SPORT';
        const bachecaConfig = (await kv.get('global:bachecaConfig')) || {};
        // postImages escluse — si caricano via ?action=postImages
        return res.status(200).json({ globalPosts, postImages: {}, posts: [], teamName, bachecaConfig });
      }
      // Salvataggio configurazione bacheca pubblica (sponsor/locandine)
      if (req.method === 'POST' && req.body && req.body.bachecaConfig !== undefined) {
        await kv.set('global:bachecaConfig', req.body.bachecaConfig);
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ success: false, message: 'Header X-Annata-Id obbligatorio' });
    }

    // Prefisso per le chiavi di questa annata
    const prefix = `annate:${annataId}`;

    // ── Endpoint lazy: carica solo le immagini post ──────────────
    // ── Endpoint Gare (accorpato per rispettare limite 12 funzioni Vercel) ──
    if (req.query && req.query.action === 'gare') {
      const sid = req.query.societyId || (req.body && req.body.societyId) || null;
      if (!sid || !/^[a-z0-9]+$/i.test(sid)) {
        return res.status(400).json({ success: false, message: 'societyId non valido' });
      }
      const gareKey    = `gare:${sid}:gare`;
      const squadreKey = `gare:${sid}:squadre`;
      if (req.method === 'GET') {
        const [gare, squadre] = await Promise.all([kv.get(gareKey), kv.get(squadreKey)]);
        return res.status(200).json({ success: true, gare: gare || [], squadre: squadre || [] });
      }
      if (req.method === 'POST') {
        const body = req.body || {};
        const saves = [];
        if (body.gare    !== undefined) saves.push(kv.set(gareKey,    body.gare));
        if (body.squadre !== undefined) saves.push(kv.set(squadreKey, body.squadre));
        if (saves.length) await Promise.all(saves);
        return res.status(200).json({ success: true });
      }
    }

    if (req.method === 'GET' && req.query && req.query.action === 'postImages') {
      const [ps, gps] = await Promise.all([
        kv.get(`${prefix}:posts`),
        kv.get('global:posts')
      ]);
      const posts_     = ps  || [];
      const gPosts_    = gps || [];
      const postImages = {};
      await Promise.all([
        ...posts_.map(async p => {
          if (p && p.id) {
            const img = await kv.get(`${prefix}:postImg_${p.id}`);
            if (img) postImages[p.id] = img;
          }
        }),
        ...gPosts_.map(async p => {
          if (p && p.id) {
            const img = await kv.get(`global:postImg_${p.id}`);
            if (img) postImages[p.id] = img;
          }
        })
      ]);
      return res.status(200).json({ postImages });
    }

    if (req.method === 'GET') {
      // Carica tutti i dati in parallelo con Promise.all
      const t0 = Date.now();
      const [
        athletes, evaluations, gpsData, awards, trainingSessions,
        formationData, matchResults, calendarEvents, calendarResponses,
        materiale, pagamenti, convocazioni, convSettings,
        convBg, convBg2, posts, globalPosts, teamName, individualPassword,
        ratingSheets,
        documents
      ] = await Promise.all([
        kv.get(`${prefix}:athletes`),
        kv.get(`${prefix}:evaluations`),
        kv.get(`${prefix}:gpsData`),
        kv.get(`${prefix}:awards`),
        kv.get(`${prefix}:trainingSessions`),
        kv.get(`${prefix}:formationData`),
        kv.get(`${prefix}:matchResults`),
        kv.get(`${prefix}:calendarEvents`),
        kv.get(`${prefix}:calendarResponses`),
        kv.get(`${prefix}:materiale`),
        kv.get(`${prefix}:pagamenti`),
        kv.get(`${prefix}:convocazioni`),
        kv.get(`${prefix}:convSettings`),
        kv.get(`${prefix}:convBg`),
        kv.get(`${prefix}:convBg2`),
        kv.get(`${prefix}:posts`),
        kv.get('global:posts'),
        kv.get('global:teamName'),
        kv.get(`${prefix}:individualPassword`),
        kv.get(`${prefix}:ratingSheets`),
        kv.get(`${prefix}:documents`),
      ]);

      // Immagini post escluse dal payload principale — si caricano lazy via ?action=postImages
      const ps  = posts       || [];
      const gps = globalPosts || [];
      const postImages = {}; // vuoto: il client le carica separatamente

      const data = {
        athletes:          athletes          || [],
        evaluations:       evaluations       || {},
        gpsData:           gpsData           || {},
        awards:            awards            || {},
        trainingSessions:  trainingSessions  || {},
        formationData:     formationData     || { starters: [], bench: [], tokens: [] },
        matchResults:      matchResults      || {},
        calendarEvents:    calendarEvents    || {},
        calendarResponses: calendarResponses || {},
        materiale:         materiale         || { items: [], assignments: {} },
        pagamenti:         pagamenti         || {},
        convocazioni:      convocazioni      || [],
        convSettings:      convSettings      || {},
        convBg:            convBg            || null,
        convBg2:           convBg2           || null,
        posts:             ps,
        globalPosts:       gps,
        postImages,
        teamName:          teamName          || 'GO SPORT',
        individualPassword: individualPassword || '1234',
        ratingSheets: ratingSheets || {},
        documents:    documents    || [],
        // access_log rimosso dal payload — leggibile solo via /api/log
      };

      console.log(`✅ GET /api/data - Annata: ${annataId} - Atleti: ${data.athletes.length} - ${Date.now()-t0}ms`);

      // Compressione gzip se il client la supporta
      const acceptEncoding = req.headers['accept-encoding'] || '';
      if (acceptEncoding.includes('gzip')) {
        const jsonStr = JSON.stringify(data);
        const compressed = gzipSync(Buffer.from(jsonStr, 'utf8'));
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Vary', 'Accept-Encoding');
        return res.status(200).end(compressed);
      }
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // Salva tutti i dati dell'annata specifica
      const body = req.body;
      
      if (body.athletes !== undefined) await kv.set(`${prefix}:athletes`, body.athletes);
      if (body.evaluations !== undefined) await kv.set(`${prefix}:evaluations`, body.evaluations);
      if (body.gpsData !== undefined) await kv.set(`${prefix}:gpsData`, body.gpsData);
      if (body.awards !== undefined) await kv.set(`${prefix}:awards`, body.awards);
      if (body.trainingSessions !== undefined) await kv.set(`${prefix}:trainingSessions`, body.trainingSessions);
      if (body.formationData !== undefined) await kv.set(`${prefix}:formationData`, body.formationData);
      if (body.matchResults !== undefined) await kv.set(`${prefix}:matchResults`, body.matchResults);
      if (body.calendarEvents !== undefined) await kv.set(`${prefix}:calendarEvents`, body.calendarEvents);
      if (body.calendarResponses !== undefined) await kv.set(`${prefix}:calendarResponses`, body.calendarResponses);
      if (body.materiale !== undefined) await kv.set(`${prefix}:materiale`, body.materiale);
      if (body.individualPassword !== undefined) await kv.set(`${prefix}:individualPassword`, body.individualPassword);
      if (body.pagamenti !== undefined) await kv.set(`${prefix}:pagamenti`, body.pagamenti);
      if (body.ratingSheets !== undefined) await kv.set(`${prefix}:ratingSheets`, body.ratingSheets);
      if (body.documents  !== undefined) await kv.set(`${prefix}:documents`,   body.documents);
      if (body.convocazioni !== undefined) await kv.set(`${prefix}:convocazioni`, body.convocazioni);
      if (body.convSettings !== undefined) await kv.set(`${prefix}:convSettings`, body.convSettings);
      if (body.convBg  !== undefined) { if (body.convBg)  await kv.set(`${prefix}:convBg`,  body.convBg);  else await kv.del(`${prefix}:convBg`);  }
      if (body.convBg2 !== undefined) { if (body.convBg2) await kv.set(`${prefix}:convBg2`, body.convBg2); else await kv.del(`${prefix}:convBg2`); }
      if (body.posts !== undefined) await kv.set(`${prefix}:posts`, body.posts);
      // Immagini singole — usa global: se il post è globale, altrimenti prefisso annata
      const globalPostIds = ((await kv.get(`global:posts`)) || []).map(p => p.id);
      for (const key of Object.keys(body)) {
        if (key.startsWith('postImg_')) {
          const postId = key.replace('postImg_', '');
          if (globalPostIds.includes(postId)) {
            await kv.set(`global:${key}`, body[key]);
          } else {
            await kv.set(`${prefix}:${key}`, body[key]);
          }
        }
      }
      if (body.globalPosts !== undefined) await kv.set(`global:posts`, body.globalPosts);

      // access_log: scrittura rimossa — gestito solo da /api/log

      console.log(`✅ POST /api/data - Annata: ${annataId} - Dati salvati`);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Metodo non consentito' });
  } catch (error) {
    console.error('❌ Errore in /api/data:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Errore del server' });
  }
}
