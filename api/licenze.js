// api/licenze.js - Gestione licenze GO Sport
// Questo endpoint gestisce la creazione, verifica e revoca delle licenze

import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Chiave segreta per firmare le licenze - CAMBIA QUESTO VALORE!
const SECRET_KEY = process.env.LICENSE_SECRET_KEY || 'GOSPORT_SECRET_2026_CAMBIA_QUESTO';

// Password Super Admin - CAMBIA QUESTO VALORE!
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'superadmin_gosport_2026';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      const keys = await kv.keys('licenze:*');
      const licenze = [];
      
      for (const key of keys) {
        const data = await kv.get(key);
        if (data) {
          const today = new Date().toISOString().split('T')[0];
          licenze.push({
            ...data,
            licenseKey: key.replace('licenze:', ''),
            isExpired: data.expiry < today,
            daysLeft: Math.ceil((new Date(data.expiry) - new Date()) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // Ordina per data creazione (più recenti prima)
      licenze.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return res.status(200).json({ success: true, licenze });
    }

    // ==========================================
    // ACTION: create - Crea nuova licenza
    // ==========================================
    if (action === 'create' && req.method === 'POST') {
      const { email, societyName, expiry, notes } = req.body;

      if (!email || !societyName || !expiry) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email, nome società e scadenza obbligatori' 
        });
      }

      // Controlla se esiste già una licenza attiva per questa email
      const existingKeys = await kv.keys('licenze:*');
      for (const key of existingKeys) {
        const existing = await kv.get(key);
        if (existing && existing.email.toLowerCase() === email.toLowerCase() && existing.active) {
          return res.status(400).json({ 
            success: false, 
            message: `Esiste già una licenza attiva per ${email}` 
          });
        }
      }

      // Genera ID univoco per la società
      const societyId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
      
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
        notes: notes || '',
        active: true,
        signature,
        ts,
        createdAt: new Date().toISOString(),
        lastAccess: null
      };

      await kv.set(`licenze:${licenseKey}`, licenseData);
      
      // Salva anche indice per trovare licenza da email
      await kv.set(`licenze_email:${email.toLowerCase()}`, licenseKey);

      console.log(`✅ Nuova licenza creata: ${licenseKey} per ${email} (${societyName})`);

      return res.status(200).json({ 
        success: true, 
        licenseKey,
        licenseData: { ...licenseData, licenseKey }
      });
    }

    // ==========================================
    // ACTION: update - Modifica licenza (rinnovo, revoca)
    // ==========================================
    if (action === 'update' && req.method === 'PUT') {
      const { licenseKey, expiry, active, notes } = req.body;

      if (!licenseKey) {
        return res.status(400).json({ success: false, message: 'licenseKey obbligatorio' });
      }

      const stored = await kv.get(`licenze:${licenseKey}`);
      if (!stored) {
        return res.status(404).json({ success: false, message: 'Licenza non trovata' });
      }

      if (expiry !== undefined) stored.expiry = expiry;
      if (active !== undefined) stored.active = active;
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

      await kv.del(`licenze:${licenseKey}`);
      await kv.del(`licenze_email:${stored.email}`);

      return res.status(200).json({ success: true, message: 'Licenza eliminata' });
    }

    return res.status(405).json({ message: 'Metodo o azione non consentiti' });

  } catch (error) {
    console.error('❌ Errore in /api/licenze:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Errore del server',
      error: error.message 
    });
  }
}
