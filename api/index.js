// api/index.js - Main API Router con gestione multi-annata
import { createClient } from '@vercel/kv';

// Configura KV client con variabili Upstash esistenti
const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function hashPassword(password) {
  // In produzione usare bcrypt, per ora hash semplice
  return Buffer.from(password).toString('base64');
}

async function verifyPassword(password, hash) {
  return Buffer.from(password).toString('base64') === hash;
}

// ==========================================
// AUTH ENDPOINTS
// ==========================================

async function handleLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username e password richiesti' });
    }

    // Recupera utente
    const user = await kv.hget('users', username);

    if (!user) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    // Verifica password
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    return res.status(200).json({
      success: true,
      user: {
        username: user.username,
        role: user.role || 'user'
      },
      role: user.role || 'user'
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

async function handleCreateUser(req, res) {
  try {
    const { username, password, role = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username e password richiesti' });
    }

    // Verifica se utente esiste già
    const existingUser = await kv.hget('users', username);

    if (existingUser) {
      return res.status(400).json({ message: 'Username già esistente' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Crea utente
    const newUser = {
      username,
      password: hashedPassword,
      role,
      annate: [],
      createdAt: new Date().toISOString()
    };

    await kv.hset('users', { [username]: newUser });

    return res.status(200).json({ success: true, message: 'Utente creato' });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

async function handleListUsers(req, res) {
  try {
    const usersData = await kv.hgetall('users');

    if (!usersData) {
      return res.status(200).json({ users: [] });
    }

    const users = Object.values(usersData).map(user => ({
      username: user.username,
      role: user.role,
      annate: user.annate || [],
      createdAt: user.createdAt
    }));

    return res.status(200).json({ users });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

async function handleDeleteUser(req, res) {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username richiesto' });
    }

    if (username === 'admin') {
      return res.status(403).json({ message: 'Non puoi eliminare l\'admin' });
    }

    await kv.hdel('users', username);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

// ==========================================
// ANNATE ENDPOINTS
// ==========================================

async function handleCreateAnnata(req, res) {
  try {
    const { nome, descrizione } = req.body;

    if (!nome) {
      return res.status(400).json({ message: 'Nome annata richiesto' });
    }

    const annataId = generateId();

    const newAnnata = {
      id: annataId,
      nome,
      descrizione: descrizione || '',
      createdAt: new Date().toISOString()
    };

    // Salva in hash delle annate
    await kv.hset('annate', { [annataId]: newAnnata });

    return res.status(200).json({ success: true, annata: newAnnata });
  } catch (error) {
    console.error('Create annata error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

async function handleListAnnate(req, res) {
  try {
    const annateData = await kv.hgetall('annate');

    if (!annateData) {
      return res.status(200).json({ annate: [] });
    }

    const annate = Object.values(annateData);

    return res.status(200).json({ annate });
  } catch (error) {
    console.error('List annate error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

async function handleDeleteAnnata(req, res) {
  try {
    const { annataId } = req.body;

    if (!annataId) {
      return res.status(400).json({ message: 'ID annata richiesto' });
    }

    // Elimina annata
    await kv.hdel('annate', annataId);

    // Elimina tutti i dati associati
    const dataKeys = [
      `data:${annataId}:athletes`,
      `data:${annataId}:evaluations`,
      `data:${annataId}:gpsData`,
      `data:${annataId}:awards`,
      `data:${annataId}:trainingSessions`,
      `data:${annataId}:formationData`,
      `data:${annataId}:matchResults`,
      `data:${annataId}:calendarEvents`,
      `data:${annataId}:calendarResponses`
    ];

    for (const key of dataKeys) {
      await kv.del(key);
    }

    // Rimuovi annata da tutti gli utenti
    const usersData = await kv.hgetall('users');
    if (usersData) {
      for (const [username, user] of Object.entries(usersData)) {
        if (user.annate && user.annate.includes(annataId)) {
          user.annate = user.annate.filter(a => a !== annataId);
          await kv.hset('users', { [username]: user });
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete annata error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

async function handleGetUserAnnata(req, res) {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ message: 'Username richiesto' });
    }

    const user = await kv.hget('users', username);

    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    const userAnnateIds = user.annate || [];
    const allAnnateData = await kv.hgetall('annate');

    let annate = [];
    if (allAnnateData) {
      annate = Object.values(allAnnateData).filter(a => userAnnateIds.includes(a.id));
    }

    return res.status(200).json({ annate });
  } catch (error) {
    console.error('Get user annate error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

async function handleAssignUserToAnnata(req, res) {
  try {
    const { username, annataId } = req.body;

    if (!username || !annataId) {
      return res.status(400).json({ message: 'Username e ID annata richiesti' });
    }

    const user = await kv.hget('users', username);

    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    if (!user.annate) {
      user.annate = [];
    }

    if (!user.annate.includes(annataId)) {
      user.annate.push(annataId);
      await kv.hset('users', { [username]: user });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Assign user error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}

// ==========================================
// DATA ENDPOINTS (compatibili con sistema esistente)
// ==========================================

async function handleData(req, res) {
  // Ottieni annata dalla sessione o da header personalizzato
  let annataId = req.headers['x-annata-id'];
  // Se non c'è header, prova a recuperare dalla query (per compatibilità)
  if (!annataId && req.query && req.query.annataId) {
    annataId = req.query.annataId;
  }

  // ✅ Fallback LEGACY: se nessuna annata, usa le chiavi globali (vecchio sistema)
  if (!annataId) {
    console.warn("⚠️ Nessun ID annata fornito. Utilizzo dati legacy globali.");
    if (req.method === 'GET') {
      try {
        const athletes = await kv.get('athletes') || [];
        const evaluations = await kv.get('evaluations') || {};
        const gpsData = await kv.get('gpsData') || {};
        const awards = await kv.get('awards') || {};
        const trainingSessions = await kv.get('trainingSessions') || {};
        const formationData = await kv.get('formationData') || { starters: [], bench: [], tokens: [] };
        const matchResults = await kv.get('matchResults') || {};
        const calendarEvents = await kv.get('calendarEvents') || {};
        const calendarResponses = await kv.get('calendarResponses') || {};

        return res.status(200).json({
          athletes,
          evaluations,
          gpsData,
          awards,
          trainingSessions,
          formationData,
          matchResults,
          calendarEvents,
          calendarResponses
        });
      } catch (error) {
        console.error('Get LEGACY data error:', error);
        return res.status(500).json({ message: 'Errore del server' });
      }
    } else if (req.method === 'POST') {
      try {
        const allData = req.body;
        if (allData.athletes !== undefined) await kv.set('athletes', allData.athletes);
        if (allData.evaluations !== undefined) await kv.set('evaluations', allData.evaluations);
        if (allData.gpsData !== undefined) await kv.set('gpsData', allData.gpsData);
        if (allData.awards !== undefined) await kv.set('awards', allData.awards);
        if (allData.trainingSessions !== undefined) await kv.set('trainingSessions', allData.trainingSessions);
        if (allData.formationData !== undefined) await kv.set('formationData', allData.formationData);
        if (allData.matchResults !== undefined) await kv.set('matchResults', allData.matchResults);
        if (allData.calendarEvents !== undefined) await kv.set('calendarEvents', allData.calendarEvents);
        if (allData.calendarResponses !== undefined) await kv.set('calendarResponses', allData.calendarResponses);
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Save LEGACY data error:', error);
        return res.status(500).json({ message: 'Errore del server' });
      }
    }
    return; // Fine gestione legacy
  }

  // ✅ Gestione MULTI-ANNATA (solo se annataId è presente)
  if (req.method === 'GET') {
    try {
      const athletes = await kv.get(`data:${annataId}:athletes`) || [];
      const evaluations = await kv.get(`data:${annataId}:evaluations`) || {};
      const gpsData = await kv.get(`data:${annataId}:gpsData`) || {};
      const awards = await kv.get(`data:${annataId}:awards`) || {};
      const trainingSessions = await kv.get(`data:${annataId}:trainingSessions`) || {};
      const formationData = await kv.get(`data:${annataId}:formationData`) || { starters: [], bench: [], tokens: [] };
      const matchResults = await kv.get(`data:${annataId}:matchResults`) || {};
      const calendarEvents = await kv.get(`data:${annataId}:calendarEvents`) || {};
      const calendarResponses = await kv.get(`data:${annataId}:calendarResponses`) || {};

      return res.status(200).json({
        athletes,
        evaluations,
        gpsData,
        awards,
        trainingSessions,
        formationData,
        matchResults,
        calendarEvents,
        calendarResponses
      });
    } catch (error) {
      console.error('Get data error:', error);
      return res.status(500).json({ message: 'Errore del server' });
    }
  } else if (req.method === 'POST') {
    try {
      const allData = req.body;
      if (allData.athletes !== undefined) await kv.set(`data:${annataId}:athletes`, allData.athletes);
      if (allData.evaluations !== undefined) await kv.set(`data:${annataId}:evaluations`, allData.evaluations);
      if (allData.gpsData !== undefined) await kv.set(`data:${annataId}:gpsData`, allData.gpsData);
      if (allData.awards !== undefined) await kv.set(`data:${annataId}:awards`, allData.awards);
      if (allData.trainingSessions !== undefined) await kv.set(`data:${annataId}:trainingSessions`, allData.trainingSessions);
      if (allData.formationData !== undefined) await kv.set(`data:${annataId}:formationData`, allData.formationData);
      if (allData.matchResults !== undefined) await kv.set(`data:${annataId}:matchResults`, allData.matchResults);
      if (allData.calendarEvents !== undefined) await kv.set(`data:${annataId}:calendarEvents`, allData.calendarEvents);
      if (allData.calendarResponses !== undefined) await kv.set(`data:${annataId}:calendarResponses`, allData.calendarResponses);

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Save data error:', error);
      return res.status(500).json({ message: 'Errore del server' });
    }
  }
}

// ==========================================
// MAIN ROUTER
// ==========================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Annata-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url.split('?')[0];

  // Parse JSON body per POST requests
  if (req.method === 'POST' && !req.body) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString();
    try {
      req.body = JSON.parse(body);
    } catch (e) {
      req.body = {};
    }
  }

  // Parse query string per GET requests
  if (req.method === 'GET' && req.url.includes('?')) {
    const queryString = req.url.split('?')[1];
    req.query = {};
    queryString.split('&').forEach(param => {
      const [key, value] = param.split('=');
      req.query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
  }

  try {
    // ============================================
    // ENDPOINT PRINCIPALE DATI (compatibile con sistema esistente)
    // ============================================
    if (path === '/api/data') {
      return await handleData(req, res);
    }

    // ============================================
    // Auth routes
    // ============================================
    if (path === '/api/auth/login') {
      return await handleLogin(req, res);
    }
    if (path === '/api/auth/create-user') {
      return await handleCreateUser(req, res);
    }
    if (path === '/api/auth/list-users') {
      return await handleListUsers(req, res);
    }
    if (path === '/api/auth/delete-user') {
      return await handleDeleteUser(req, res);
    }

    // ============================================
    // Annate routes
    // ============================================
    if (path === '/api/annate/create') {
      return await handleCreateAnnata(req, res);
    }
    if (path === '/api/annate/list') {
      return await handleListAnnate(req, res);
    }
    if (path === '/api/annate/delete') {
      return await handleDeleteAnnata(req, res);
    }
    if (path === '/api/annate/user-annate') {
      return await handleGetUserAnnata(req, res);
    }
    if (path === '/api/annate/assign-user') {
      return await handleAssignUserToAnnata(req, res);
    }

    // Route non trovata
    return res.status(404).json({ message: 'Route non trovata' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ message: 'Errore del server' });
  }
}