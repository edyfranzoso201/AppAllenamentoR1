// api/licenze.js - Gestione licenze GO Sport
// Questo endpoint gestisce la creazione, verifica e revoca delle licenze

import { createClient } from '@vercel/kv';
import crypto from 'crypto';

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

const SECRET_KEY = process.env.LICENSE_SECRET_KEY;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

if (!SECRET_KEY) throw new Error('Env var LICENSE_SECRET_KEY mancante');
if (!SUPER_ADMIN_PASSWORD) throw new Error('Env var SUPER_ADMIN_PASSWORD mancante');

// ==========================================
// UTILITY: Genera firma HMAC
// ==========================================
function generateSignature(data) {
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(JSON.stringify(data))
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
}

// ==========================================
// UTILITY: Genera chiave licenza leggibile
// ==========================================
function generateLicenseKey(email, expiry, societyId) {
  const payload = { email, expiry, societyId, ts: Date.now() };
  const signature = generateSignature(payload);
  
  // Codifica payload in base64 compatto
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  // Formato leggibile: GOSPORT-XXXX-XXXX-XXXX-SIGN
  const parts = encoded.match(/.{1,5}/g) || [];
  const keyBody = parts.slice(0, 4).map(p => p.toUpperCase()).join('-');
  
  return `GS-${keyBody}-${signature.substring(0, 8)}`;
}

// ==========================================
// UTILITY: Verifica firma licenza
// ==========================================
function verifyLicense(licenseKey, storedData) {
  if (!storedData) return false;
  const expectedSig = generateSignature({
    email: storedData.email,
    expiry: storedData.expiry,
    societyId: storedData.societyId,
    ts: storedData.ts
  });
  return storedData.signature === expectedSig.substring(0, 16).toUpperCase();
}

export default async function handler(req, res) {
  // CORS - accetta chiamate anche da file:// locale
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Super-Admin-Password, X-License-Key, X-License-Email');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {

    // ==========================================
    // ACTION: verify - Verifica licenza (pubblica)
    // Usata dall'app del cliente al login
    // ==========================================
    if (action === 'verify') {
      const licenseKey = req.headers['x-license-key'] || req.body?.licenseKey;
      const email = req.headers['x-license-email'] || req.body?.email;

      if (!licenseKey || !email) {
        return res.status(400).json({ 
          valid: false, 
          message: 'Chiave licenza e email obbligatorie' 
        });
      }

      const stored = await kv.get(`licenze:${licenseKey}`);

      if (!stored) {
        return res.status(200).json({ valid: false, message: 'Licenza non trovata' });
      }

      // Verifica email
      if (stored.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(200).json({ valid: false, message: 'Email non corrisponde alla licenza' });
      }

      // Verifica scadenza
      const today = new Date().toISOString().split('T')[0];
      if (stored.expiry < today) {
        return res.status(200).json({ 
          valid: false, 
          expired: true,
          message: `Licenza scaduta il ${new Date(stored.expiry).toLocaleDateString('it-IT')}` 
        });
      }

      // Verifica attiva
      if (!stored.active) {
        return res.status(200).json({ valid: false, message: 'Licenza disattivata' });
      }

      // Aggiorna lastAccess
      stored.lastAccess = new Date().toISOString();
      await kv.set(`licenze:${licenseKey}`, stored);

      return res.status(200).json({
        valid: true,
        societyName: stored.societyName,
        societyId: stored.societyId,
        expiry: stored.expiry,
        plan: stored.plan || 'silver',
        aiEnabled: stored.aiEnabled === true,
        daysLeft: Math.ceil((new Date(stored.expiry) - new Date()) / (1000 * 60 * 60 * 24))
      });
    }

    // ==========================================
    // Da qui in poi: solo Super Admin
    // ==========================================
    const adminPassword = req.headers['x-super-admin-password'] || req.body?.adminPassword;
    if (adminPassword !== SUPER_ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Password Super Admin non valida' });
    }

    // ==========================================
    // ACTION: list - Lista tutte le licenze
    // ==========================================
    if (action === 'list' && req.method === 'GET') {
      const keys = await kv.smembers('licenze:index');
      const today = new Date().toISOString().split('T')[0];
      const results = await Promise.all(keys.map(k => kv.get(`licenze:${k}`)));
      const licenze = results
        .filter(Boolean)
        .map((data, i) => ({
          ...data,
          licenseKey: keys[i],
          isExpired: data.expiry < today,
          daysLeft: Math.ceil((new Date(data.expiry) - new Date()) / (1000 * 60 * 60 * 24))
        }));

      licenze.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ success: true, licenze });
    }

    // ==========================================
    // ACTION: create - Crea nuova licenza
    // ==========================================
    if (action === 'create' && req.method === 'POST') {
      const { email, societyName, expiry, notes, plan } = req.body;

      if (!email || !societyName || !expiry) {
        return res.status(400).json({
          success: false,
          message: 'Email, nome società e scadenza obbligatori'
        });
      }

      // Controlla se esiste già una licenza attiva per questa email (usa indice)
      const existingKey = await kv.get(`licenze_email:${email.toLowerCase()}`);
      if (existingKey) {
        const existing = await kv.get(`licenze:${existingKey}`);
        if (existing && existing.active) {
          return res.status(400).json({
            success: false,
            message: `Esiste già una licenza attiva per ${email}`
          });
        }
      }

      // Genera ID univoco per la società
      const societyId = crypto.randomUUID().replace(/-/g, '').substring(0, 20);
      
      // Genera payload e firma
      const ts = Date.now();
      const payload = { email, expiry, societyId, ts };
      const signature = generateSignature(payload);

      // Genera chiave licenza
      const licenseKey = generateLicenseKey(email, expiry, societyId);

      const licenseData = {
        email: email.toLowerCase(),
        societyName,
        societyId,
        expiry,
        plan: plan || 'platinum',
        notes: notes || '',
        active: true,
        signature,
        ts,
        createdAt: new Date().toISOString(),
        lastAccess: null
      };

      await Promise.all([
        kv.set(`licenze:${licenseKey}`, licenseData),
        kv.set(`licenze_email:${email.toLowerCase()}`, licenseKey),
        kv.set(`licenze_society:${societyId}`, licenseKey),
        kv.sadd('licenze:index', licenseKey),
      ]);

      console.log(`✅ Nuova licenza creata: ${licenseKey} per ${email} (${societyName})`);

      return res.status(200).json({ 
        success: true, 
        licenseKey,
        licenseData: { ...licenseData, licenseKey }
      });
    }

    // ==========================================
    // ACTION: toggle-ai - Attiva/disattiva funzionalità AI per la licenza
    // ==========================================
    if (action === 'toggle-ai' && req.method === 'POST') {
      const { licenseKey } = req.body;
      if (!licenseKey) return res.status(400).json({ success: false, message: 'licenseKey obbligatorio' });
      const stored = await kv.get(`licenze:${licenseKey}`);
      if (!stored) return res.status(404).json({ success: false, message: 'Licenza non trovata' });
      stored.aiEnabled = !stored.aiEnabled;
      stored.updatedAt = new Date().toISOString();
      await kv.set(`licenze:${licenseKey}`, stored);
      return res.status(200).json({ success: true, aiEnabled: stored.aiEnabled });
    }

    // ACTION: toggle-email-alerts - Attiva/disattiva alert email per licenza Platinum
    // ==========================================
    if (action === 'toggle-email-alerts' && req.method === 'POST') {
      const { licenseKey } = req.body;
      if (!licenseKey) return res.status(400).json({ success: false, message: 'licenseKey obbligatorio' });
      const stored = await kv.get(`licenze:${licenseKey}`);
      if (!stored) return res.status(404).json({ success: false, message: 'Licenza non trovata' });
      if (stored.plan !== 'platinum') return res.status(403).json({ success: false, message: 'Solo licenze Platinum' });
      stored.emailAlertsEnabled = !stored.emailAlertsEnabled;
      stored.updatedAt = new Date().toISOString();
      await kv.set(`licenze:${licenseKey}`, stored);
      return res.status(200).json({ success: true, emailAlertsEnabled: stored.emailAlertsEnabled });
    }

    // ACTION: update - Modifica licenza (rinnovo, revoca)
    // ==========================================
    if (action === 'update' && req.method === 'PUT') {
      const { licenseKey, expiry, active, plan, notes } = req.body;

      if (!licenseKey) {
        return res.status(400).json({ success: false, message: 'licenseKey obbligatorio' });
      }

      const stored = await kv.get(`licenze:${licenseKey}`);
      if (!stored) {
        return res.status(404).json({ success: false, message: 'Licenza non trovata' });
      }

      if (expiry !== undefined) stored.expiry = expiry;
      if (active !== undefined) stored.active = active;
      if (plan  !== undefined) stored.plan  = plan;
      if (notes !== undefined) stored.notes = notes;
      stored.updatedAt = new Date().toISOString();

      await kv.set(`licenze:${licenseKey}`, stored);

      return res.status(200).json({ success: true, licenseData: stored });
    }

    // ==========================================
    // ACTION: delete - Elimina licenza
    // ==========================================
    if (action === 'delete' && req.method === 'DELETE') {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        return res.status(400).json({ success: false, message: 'licenseKey obbligatorio' });
      }

      const stored = await kv.get(`licenze:${licenseKey}`);
      if (!stored) {
        return res.status(404).json({ success: false, message: 'Licenza non trovata' });
      }

      await Promise.all([
        kv.del(`licenze:${licenseKey}`),
        kv.del(`licenze_email:${stored.email}`),
        kv.del(`licenze_society:${stored.societyId}`),
        kv.srem('licenze:index', licenseKey),
      ]);

      return res.status(200).json({ success: true, message: 'Licenza eliminata' });
    }

    // ==========================================
    // ACTION: societyStats - Atleti/Staff per società (SuperAdmin)
    // ==========================================
    if (action === 'societyStats' && req.method === 'GET') {
      const { societyId } = req.query;
      if (!societyId) {
        return res.status(400).json({ success: false, message: 'societyId obbligatorio' });
      }

      const allAnnate = (await kv.get('annate:list')) || [];
      const annate = allAnnate.filter(a => a.societyId === societyId);

      const annateCounts = await Promise.all(
        annate.map(async a => {
          const athletes = (await kv.get(`annate:${a.id}:athletes`)) || [];
          const atleti = athletes.filter(x => !x.isStaff && !x.isGuest).length;
          const staff  = athletes.filter(x =>  x.isStaff && !x.isGuest).length;
          return { id: a.id, nome: a.nome || a.id, dataInizio: a.dataInizio, atleti, staff, totale: atleti + staff };
        })
      );

      annateCounts.sort((a, b) => new Date(b.dataInizio) - new Date(a.dataInizio));

      const totAtleti = annateCounts.reduce((s, a) => s + a.atleti, 0);
      const totStaff  = annateCounts.reduce((s, a) => s + a.staff, 0);

      return res.status(200).json({
        success: true,
        annate: annateCounts,
        totali: { atleti: totAtleti, staff: totStaff, totale: totAtleti + totStaff }
      });
    }

    // ==========================================
    // ACTION: migrate - Costruisce indici da licenze esistenti (una tantum)
    // ==========================================
    if (action === 'migrate' && req.method === 'POST') {
      const keys = await kv.keys('licenze:*');
      const licenseKeys = keys.filter(k => !k.includes(':index') && !k.includes('_email:') && !k.includes('_society:'));
      const ops = [];
      for (const key of licenseKeys) {
        const data = await kv.get(key);
        if (!data) continue;
        const lk = key.replace('licenze:', '');
        ops.push(kv.sadd('licenze:index', lk));
        if (data.societyId) ops.push(kv.set(`licenze_society:${data.societyId}`, lk));
        if (data.email) ops.push(kv.set(`licenze_email:${data.email.toLowerCase()}`, lk));
      }
      await Promise.all(ops);
      return res.status(200).json({ success: true, migrated: licenseKeys.length });
    }

    return res.status(405).json({ message: 'Metodo o azione non consentiti' });

  } catch (error) {
    console.error('❌ Errore in /api/licenze:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Errore del server' });
  }
}
