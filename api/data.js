// api/data.js - VERSIONE SICURA BASE
import { createClient } from '@vercel/kv';
import { gzipSync } from 'zlib';

const kv = createClient({
url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

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

function getSessionInfo(req) {
return {
isAuthenticated: (req.headers['x-auth-session'] || '') === 'true',
role: String(req.headers['x-user-role'] || '').trim(),
username: String(req.headers['x-auth-user'] || '').trim(),
societyId: String(req.headers['x-society-id'] || '').trim()
};
}

function isValidId(value) {
return /^[a-z0-9_-]+$/i.test(String(value || '').trim());
}

function canWrite(role) {
return ['admin', 'coach', 'coachl1', 'coachl2'].includes(String(role || '').toLowerCase());
}

export default async function handler(req, res) {
setCors(req, res);
res.setHeader('Access-Control-Allow-Headers',
'Content-Type, X-Annata-Id, X-Auth-Session, X-Auth-User, X-User-Role, X-Society-Id, X-Sa-Key');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

if (req.method === 'OPTIONS') return res.status(200).end();

try {
const session = getSessionInfo(req);

const rawAnnata = req.headers['x-annata-id'] || req.headers['X-Annata-Id'] || '';
const annataId = String(rawAnnata).split(',')[0].trim();

if (annataId && !isValidId(annataId)) {
return res.status(400).json({ success: false, message: 'Formato annataId non valido' });
}

// ── PUSH: subscribe ────────────────────────────────────────────────────────
if (req.query?.action === 'push-subscribe' && req.method === 'POST') {
  const { subscription, annataId: subAnnataId } = req.body || {};
  if (!subAnnataId || !subscription?.endpoint) {
    return res.status(400).json({ success: false, message: 'Dati mancanti' });
  }
  const key = `push:annata:${subAnnataId}:subs`;
  const subs = (await kv.get(key)) || [];
  if (!subs.find(s => s.endpoint === subscription.endpoint)) {
    subs.push(subscription);
    await kv.set(key, subs);
    const annateList = (await kv.get('push:annate')) || [];
    if (!annateList.includes(subAnnataId)) { annateList.push(subAnnataId); await kv.set('push:annate', annateList); }
  }
  return res.status(200).json({ success: true });
}

// ── PUSH: send ─────────────────────────────────────────────────────────────
if (req.query?.action === 'push-send' && req.method === 'POST') {
  if (!session.isAuthenticated) {
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  }
  const { title, body, url, annataId: sendAnnataId } = req.body || {};
  const aid = sendAnnataId || annataId;
  if (!aid) return res.status(400).json({ success: false, message: 'annataId mancante' });
  const subs = (await kv.get(`push:annata:${aid}:subs`)) || [];
  if (subs.length === 0) return res.status(200).json({ success: true, sent: 0 });
  const { default: webpush } = await import('web-push');
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@gosport.app'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  const payload = JSON.stringify({ title: title || 'GO Sport', body: body || '', url: url || '/' });
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, payload)));
  const valid = subs.filter((_, i) => !(results[i].status === 'rejected' && results[i].reason?.statusCode === 410));
  if (valid.length !== subs.length) await kv.set(`push:annata:${aid}:subs`, valid);
  return res.status(200).json({ success: true, sent: results.filter(r => r.status === 'fulfilled').length });
}

// ── PUSH: cron reminder (chiamato da Vercel Cron ogni mattina) ─────────────
if (req.query?.action === 'cron-remind' && req.method === 'GET') {
  const secret = process.env.CRON_SECRET || 'gs_cron_2026';
  const authOk = req.headers['authorization'] === `Bearer ${secret}`
              || req.query.token === secret;
  if (!authOk) {
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  }
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  let totalSent = 0;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const annateList = (await kv.get('push:annate')) || [];
    const { default: webpush } = await import('web-push');
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@gosport.app'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    for (const aid of annateList) {
      const subs = (await kv.get(`push:annata:${aid}:subs`)) || [];
      if (!subs.length) continue;
      const ts = (await kv.get(`annate:${aid}:trainingSessions`)) || {};
      const sessionsTomorrow = ts[tomorrowStr] || [];
      if (!sessionsTomorrow.length) continue;
      const session0 = sessionsTomorrow[0];
      const payload = JSON.stringify({
        title: '📅 Promemoria GO Sport',
        body: `Domani: ${session0.title || 'Sessione'}${session0.time ? ' ore ' + session0.time : ''}${session0.location ? ' @ ' + session0.location : ''}`,
        url: '/'
      });
      const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, payload)));
      const valid = subs.filter((_, i) => !(results[i].status === 'rejected' && results[i].reason?.statusCode === 410));
      if (valid.length !== subs.length) await kv.set(`push:annata:${aid}:subs`, valid);
      totalSent += results.filter(r => r.status === 'fulfilled').length;
    }
  }
  // ── Email alerts: scadenza visita medica e tessera ──────────────────────
  try {
    const { createTransport } = await import('nodemailer');
    const transporter = createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });
    const todayStr = new Date().toISOString().split('T')[0];
    const today0 = new Date(todayStr + 'T00:00:00Z');

    const allLicenseKeys = await kv.smembers('licenze:index');
    const allAnnate = (await kv.get('annate:list')) || [];
    let emailsSent = 0;

    for (const licKey of (allLicenseKeys || [])) {
      const lic = await kv.get(`licenze:${licKey}`);
      if (!lic || !lic.active || lic.plan !== 'platinum' || !lic.emailAlertsEnabled) continue;
      if (lic.expiry < todayStr) continue;

      const settings = (await kv.get(`society:${lic.societyId}:alertSettings`)) || { visitaDays: 60, tesseraDays: 15 };
      const societyAnnate = allAnnate.filter(a => !a.societyId || a.societyId === lic.societyId);

      const visitaAlert = new Date(today0); visitaAlert.setUTCDate(visitaAlert.getUTCDate() + Number(settings.visitaDays || 60));
      const tesseraAlert = new Date(today0); tesseraAlert.setUTCDate(tesseraAlert.getUTCDate() + Number(settings.tesseraDays || 15));
      const visitaAlertStr  = visitaAlert.toISOString().split('T')[0];
      const tesseraAlertStr = tesseraAlert.toISOString().split('T')[0];

      for (const annata of societyAnnate) {
        const athletes = (await kv.get(`annate:${annata.id}:athletes`)) || [];
        for (const athlete of athletes) {
          if (athlete.isGuest) continue;
          const emails = [];
          if (athlete.email) emails.push(athlete.email);
          if (athlete.parents?.parent1?.email) emails.push(athlete.parents.parent1.email);
          if (athlete.parents?.parent2?.email && athlete.parents.parent2.email !== athlete.parents?.parent1?.email) emails.push(athlete.parents.parent2.email);
          if (!emails.length) continue;

          const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });

          if (athlete.scadenzaVisita === visitaAlertStr) {
            try {
              await transporter.sendMail({
                from: `"Sport Monitoring" <${process.env.GMAIL_USER}>`,
                to: emails.join(','),
                subject: `⚕️ Scadenza Visita Medica — ${athlete.name}`,
                html: emailTemplate({ athleteName: athlete.name, societyName: lic.societyName, tipo: 'Visita Medica', scadenza: fmtDate(athlete.scadenzaVisita), giorni: settings.visitaDays || 60 })
              });
              emailsSent++;
            } catch(e) { console.error('[cron-email] Errore visita:', e.message); }
          }
          if (athlete.scadenzaTessera === tesseraAlertStr) {
            try {
              await transporter.sendMail({
                from: `"Sport Monitoring" <${process.env.GMAIL_USER}>`,
                to: emails.join(','),
                subject: `🎫 Scadenza Tessera Sportiva — ${athlete.name}`,
                html: emailTemplate({ athleteName: athlete.name, societyName: lic.societyName, tipo: 'Tessera Sportiva', scadenza: fmtDate(athlete.scadenzaTessera), giorni: settings.tesseraDays || 15 })
              });
              emailsSent++;
            } catch(e) { console.error('[cron-email] Errore tessera:', e.message); }
          }
        }
      }
    }
    totalSent += emailsSent;
  } catch(emailErr) {
    console.error('❌ Errore email alerts:', emailErr.message);
  }

  return res.status(200).json({ success: true, totalSent });
}

function emailTemplate({ athleteName, societyName, tipo, scadenza, giorni }) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f1f5f9;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="text-align:center;margin-bottom:20px;">
    <span style="font-size:2.2rem;">⚽</span>
    <h2 style="margin:8px 0 4px;color:#0f172a;font-size:1.2rem;">Sport Monitoring</h2>
    <div style="color:#64748b;font-size:0.85rem;">${societyName}</div>
  </div>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
  <p style="color:#1e293b;font-size:1rem;">Gentile genitore / atleta,</p>
  <p style="color:#374151;">ti informiamo che la <strong>${tipo}</strong> di <strong>${athleteName}</strong> è in scadenza tra <strong>${giorni} giorni</strong>.</p>
  <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;padding:14px 18px;margin:20px 0;text-align:center;">
    <div style="font-size:0.8rem;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">Data scadenza</div>
    <div style="font-size:1.3rem;font-weight:700;color:#c2410c;margin-top:4px;">${scadenza}</div>
  </div>
  <p style="color:#475569;font-size:0.88rem;">Ti preghiamo di procedere al rinnovo prima della data indicata per evitare la sospensione dell'attività sportiva.</p>
  <p style="color:#475569;font-size:0.88rem;">Per informazioni contatta la tua società sportiva.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
  <p style="color:#94a3b8;font-size:0.75rem;text-align:center;">Questo messaggio è stato inviato automaticamente da Sport Monitoring.<br>Non rispondere a questa email.</p>
</div></body></html>`;
}

// ── BACKUP dati (admin per società, superadmin per tutto Redis) ──────────
if (req.query?.action === 'backup') {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const saKey = (req.headers['x-sa-key'] || '').trim();
  const validSaKey = (process.env.SUPER_ADMIN_PASSWORD || '').trim();
  const isSuperAdmin = validSaKey && saKey === validSaKey;

  const isAdminSession = session.isAuthenticated && session.role === 'admin';
  const backupToken = req.headers['x-backup-token'] || req.query.token;
  const isValidToken = process.env.BACKUP_SECRET && backupToken === process.env.BACKUP_SECRET;

  if (!isSuperAdmin && !isAdminSession && !isValidToken) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  async function scanKeys(pattern) {
    const keys = [];
    let cursor = 0;
    do {
      const [next, batch] = await kv.scan(cursor, { match: pattern, count: 200 });
      cursor = parseInt(next, 10);
      keys.push(...batch);
    } while (cursor !== 0);
    return keys;
  }

  async function mgetBatched(keys) {
    const out = {};
    for (let i = 0; i < keys.length; i += 50) {
      const batch = keys.slice(i, i + 50);
      const values = await kv.mget(...batch);
      batch.forEach((k, idx) => { if (values[idx] !== null) out[k] = values[idx]; });
    }
    return out;
  }

  let exportData = {};
  let scope;

  if (isSuperAdmin || isValidToken) {
    // Export completo
    const allKeys = (await scanKeys('*')).filter(k =>
      !k.startsWith('rl:') && !k.startsWith('session:') && !k.startsWith('ratelimit:')
    );
    exportData = await mgetBatched(allKeys);
    scope = 'completo';
  } else {
    // Export per società
    const sid = session.societyId;
    if (!sid) return res.status(400).json({ error: 'societyId mancante' });
    scope = sid;

    const allAnnate = (await kv.get('annate:list')) || [];
    const societyAnnate = allAnnate.filter(a => !a.societyId || a.societyId === sid);
    exportData['annate:list'] = societyAnnate;

    for (const ann of societyAnnate) {
      const annKeys = await scanKeys(`annate:${ann.id}:*`);
      Object.assign(exportData, await mgetBatched(annKeys));
      const pushVal = await kv.get(`push:annata:${ann.id}:subs`);
      if (pushVal) exportData[`push:annata:${ann.id}:subs`] = pushVal;
    }

    const socKeys = await scanKeys(`society:${sid}:*`);
    Object.assign(exportData, await mgetBatched(socKeys));

    const licKey = await kv.get(`licenze_society:${sid}`);
    if (licKey) {
      exportData[`licenze_society:${sid}`] = licKey;
      const licData = await kv.get(`licenze:${licKey}`);
      if (licData) exportData[`licenze:${licKey}`] = licData;
    }

    const allUsers = (await kv.get('auth:users')) || [];
    const socUsers = allUsers.filter(u => u.societyId === sid);
    exportData['auth:users'] = socUsers;
    const uKeys = socUsers.map(u => `auth:user:${(u.username||'').toLowerCase()}`).filter(Boolean);
    if (uKeys.length) Object.assign(exportData, await mgetBatched(uKeys));
  }

  const dateStr = new Date().toISOString();
  if (!isValidToken) {
    res.setHeader('Content-Disposition',
      `attachment; filename="gosport-backup-${scope}-${dateStr.slice(0,10)}.json"`);
  }
  return res.status(200).json({
    exportedAt: dateStr, scope, keysCount: Object.keys(exportData).length, data: exportData
  });
}

// ── RESTORE dati (solo superadmin) ───────────────────────────────────────
if (req.query?.action === 'restore') {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const saKey = (req.headers['x-sa-key'] || '').trim();
  const validSaKey = (process.env.SUPER_ADMIN_PASSWORD || '').trim();
  if (!validSaKey || saKey !== validSaKey) {
    return res.status(401).json({ error: 'Non autorizzato — solo superadmin' });
  }

  const { data, confirmToken } = req.body || {};
  if (confirmToken !== 'RESTORE_CONFIRMED') {
    return res.status(400).json({ error: 'Token di conferma mancante' });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Payload data non valido' });
  }

  const keys = Object.keys(data);
  if (keys.length === 0) return res.status(400).json({ error: 'Nessuna chiave da ripristinare' });

  let keysRestored = 0;
  const errors = [];
  for (let i = 0; i < keys.length; i += 50) {
    const batch = keys.slice(i, i + 50);
    try {
      await Promise.all(batch.map(k => kv.set(k, data[k])));
      keysRestored += batch.length;
    } catch(e) {
      errors.push(`batch ${i}-${i+50}: ${e.message}`);
    }
  }
  return res.status(200).json({ success: true, keysRestored, errors });
}

// ── MONITORING: Redis INFO + Vercel usage (solo superadmin) ──────────────
if (req.query?.action === 'monitoring') {
  const saKey = (req.headers['x-sa-key'] || '').trim();
  const validSaKey = (process.env.SUPER_ADMIN_PASSWORD || '').trim();
  if (!validSaKey || saKey !== validSaKey) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const out = { redis: null, vercel: null, errors: [] };

  // ── Redis stats via existing KV credentials (no extra creds needed) ──────
  try {
    const kvUrl   = (process.env.KV_REST_API_URL || process.env.UPSTASH_KV_REST_API_URL || '').replace(/\/$/, '');
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_KV_REST_API_TOKEN;
    const hdr = { Authorization: `Bearer ${kvToken}` };

    const [infoRes, dbsizeRes] = await Promise.all([
      fetch(`${kvUrl}/info`, { headers: hdr }),
      fetch(`${kvUrl}/dbsize`, { headers: hdr })
    ]);
    const infoJson   = await infoRes.json();
    const dbsizeJson = await dbsizeRes.json();

    const info = {};
    if (typeof infoJson.result === 'string') {
      infoJson.result.split('\r\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const idx = line.indexOf(':');
          if (idx > 0) info[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      });
    }

    const maxmem = parseInt(info.maxmemory || 0) || 268435456; // 256MB free tier
    out.redis = {
      keys: dbsizeJson.result || 0,
      used_memory: parseInt(info.used_memory || 0),
      used_memory_human: info.used_memory_human || '—',
      maxmemory: maxmem,
      total_commands_processed: parseInt(info.total_commands_processed || 0),
      instantaneous_ops_per_sec: parseFloat(info.instantaneous_ops_per_sec || 0),
      keyspace_hits: parseInt(info.keyspace_hits || 0),
      keyspace_misses: parseInt(info.keyspace_misses || 0),
      connected_clients: parseInt(info.connected_clients || 0),
      uptime_in_seconds: parseInt(info.uptime_in_seconds || 0),
      redis_version: info.redis_version || '—'
    };
  } catch(e) { out.errors.push('Redis: ' + e.message); }

  // ── Vercel Usage API ─────────────────────────────────────────────────────
  const vToken = process.env.VERCEL_TOKEN;
  if (vToken) {
    try {
      const teamId = process.env.VERCEL_TEAM_ID || 'team_N703yzP0O3hsuLT1plfZhJ1S';
      const hdrV = { Authorization: `Bearer ${vToken}` };
      // Try multiple endpoints to find where usage data lives
      const [r1, r2] = await Promise.all([
        fetch(`https://api.vercel.com/v2/teams/${teamId}/usage`, { headers: hdrV }),
        fetch(`https://api.vercel.com/v2/usage?teamId=${teamId}`, { headers: hdrV })
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      out.vercel = d1;
      out.vercel2 = d2;
      out.vercel_status = r1.status;
      out.vercel2_status = r2.status;
    } catch(e) { out.errors.push('Vercel: ' + e.message); }
  } else {
    out.vercel = { _missing: true };
  }

  return res.status(200).json(out);
}

// ── SUPERADMIN: banner config ────────────────────────────────────────────
if (req.query?.action === 'superadmin-config') {
  const saKey = (req.headers['x-sa-key'] || '').trim();
  const validKey = (process.env.SUPER_ADMIN_PASSWORD || '').trim();
  if (!validKey) {
    return res.status(403).json({ success: false, message: 'ENV_NOT_SET' });
  }
  if (saKey !== validKey) {
    return res.status(403).json({ success: false, message: 'WRONG_KEY' });
  }
  if (req.method === 'GET') {
    const cfg = (await kv.get('global:superadminBanners')) || {};
    return res.status(200).json({ success: true, superadminBanners: cfg });
  }
  if (req.method === 'POST') {
    await kv.set('global:superadminBanners', req.body);
    return res.status(200).json({ success: true });
  }
}

// ── Alert settings per società (usato da pannello admin) ────────────────
if (req.query?.action === 'alert-settings') {
  const sid = (req.headers['x-society-id'] || '').trim();
  if (!sid) return res.status(400).json({ success: false, message: 'societyId obbligatorio' });
  if (req.method === 'GET') {
    const s = (await kv.get(`society:${sid}:alertSettings`)) || { visitaDays: 60, tesseraDays: 15 };
    return res.status(200).json({ success: true, settings: s });
  }
  if (req.method === 'POST') {
    if (!session.isAuthenticated) return res.status(401).json({ success: false });
    const { visitaDays, tesseraDays } = req.body;
    await kv.set(`society:${sid}:alertSettings`, {
      visitaDays: Math.max(1, Math.min(365, parseInt(visitaDays) || 60)),
      tesseraDays: Math.max(1, Math.min(365, parseInt(tesseraDays) || 15))
    });
    return res.status(200).json({ success: true });
  }
}

// ── Impianti: campi e spogliatoi (solo Platinum — ruoli direttivo/dirigente/staff/admin) ──
function canImpianti(role) {
  return ['admin','direttivo','dirigente','staff'].includes(String(role||'').toLowerCase());
}

if (req.query?.action === 'impianti-annate-config') {
  const sid = (req.headers['x-society-id'] || '').trim();
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  if (req.method === 'GET') {
    const cfg = (await kv.get(`society:${sid}:impianti:annate-config`)) || [];
    return res.status(200).json({ success: true, config: cfg });
  }
  if (req.method === 'POST') {
    const { config } = req.body || {};
    await kv.set(`society:${sid}:impianti:annate-config`, Array.isArray(config) ? config : []);
    return res.status(200).json({ success: true });
  }
}

if (req.query?.action === 'impianti-annate') {
  const sid = (req.headers['x-society-id'] || '').trim();
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  const allAnnate = (await kv.get('annate:list')) || [];
  const societyAnnate = allAnnate.filter(a => !a.societyId || a.societyId === sid);
  const withCounts = await Promise.all(societyAnnate.map(async a => {
    const athletes = (await kv.get(`annate:${a.id}:athletes`)) || [];
    return { id: a.id, name: a.name || a.id, atletiCount: athletes.filter(x => !x.isGuest).length };
  }));
  return res.status(200).json({ success: true, annate: withCounts });
}

if (req.query?.action === 'impianti-config') {
  const sid = (req.headers['x-society-id'] || '').trim();
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  if (req.method === 'GET') {
    const config = (await kv.get(`society:${sid}:impianti:config`)) || { campi: [], spogliatoi: 0 };
    return res.status(200).json({ success: true, config });
  }
  if (req.method === 'POST') {
    const { campi, spogliatoi } = req.body || {};
    await kv.set(`society:${sid}:impianti:config`, {
      campi: Array.isArray(campi) ? campi : [],
      spogliatoi: Math.max(0, parseInt(spogliatoi) || 0)
    });
    return res.status(200).json({ success: true });
  }
}

if (req.query?.action === 'impianti-slots') {
  const sid = (req.headers['x-society-id'] || '').trim();
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  if (req.method === 'GET') {
    const slots = (await kv.get(`society:${sid}:impianti:slots`)) || [];
    return res.status(200).json({ success: true, slots });
  }
  if (req.method === 'POST') {
    const { slot, deleteId, replaceAll } = req.body || {};
    let slots = (await kv.get(`society:${sid}:impianti:slots`)) || [];
    if (Array.isArray(replaceAll)) {
      slots = replaceAll;
    } else if (deleteId) {
      slots = slots.filter(s => s.id !== deleteId);
    } else if (slot && slot.id) {
      const idx = slots.findIndex(s => s.id === slot.id);
      if (idx >= 0) slots[idx] = slot; else slots.push(slot);
    }
    await kv.set(`society:${sid}:impianti:slots`, slots);
    return res.status(200).json({ success: true, slots });
  }
}

if (req.query?.action === 'impianti-eventi') {
  const sid = (req.headers['x-society-id'] || '').trim();
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  if (req.method === 'GET') {
    const eventi = (await kv.get(`society:${sid}:impianti:eventi`)) || [];
    return res.status(200).json({ success: true, eventi });
  }
  if (req.method === 'POST') {
    const { evento, deleteId } = req.body || {};
    let eventi = (await kv.get(`society:${sid}:impianti:eventi`)) || [];
    if (deleteId) {
      eventi = eventi.filter(e => e.id !== deleteId);
    } else if (evento && evento.id) {
      const idx = eventi.findIndex(e => e.id === evento.id);
      if (idx >= 0) eventi[idx] = evento; else eventi.push(evento);
    }
    await kv.set(`society:${sid}:impianti:eventi`, eventi);
    return res.status(200).json({ success: true, eventi });
  }
}

// ── AI Chat (Gemini) ─────────────────────────────────────────────────────
if (req.query?.action === 'ai-chat') {
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  if (req.method !== 'POST')
    return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { messages, context } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, message: 'API key non configurata' });

  const GIORNI_NOMI_CHAT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  const systemPrompt = `Sei un assistente esperto di pianificazione allenamenti per la piattaforma GO Sport.
Rispondi SEMPRE in italiano, in modo diretto e pratico. Puoi fare domande di chiarimento, proporre varianti e ragionare insieme all'utente.

DATI IMPIANTO CORRENTI:
${context ? JSON.stringify(context, null, 2) : 'Nessun dato disponibile'}

GIORNI: 0=Dom 1=Lun 2=Mar 3=Mer 4=Gio 5=Ven 6=Sab

REGOLE DI PIANIFICAZIONE (applica sempre):
- Mai 3 giorni consecutivi per la stessa squadra
- Squadre "grandi" (nate 2009-2011) si allenano preferibilmente sul campo grande A11
- Squadre "medi/piccoli" (nate 2012+) possono usare anche il campo piccolo A7
- Squadre con "coppiaCon" devono condividere gli stessi giorni
- Distribuisci il carico uniformemente nei giorni disponibili

COME PROPORRE UNA PIANIFICAZIONE:
Quando l'utente ti chiede di generare o modificare una pianificazione, ragiona ad alta voce spiegando le scelte, poi IN FONDO alla risposta includi ESATTAMENTE questo blocco (tutte squadre, anche quelle non modificate):
[PROPOSTA: {"NomeSquadra":[giorno,...],"AltraSquadra":[giorno,...]}]
Usa i numeri per i giorni (1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab, 0=Dom).
Se non sei sicuro dei dati di una squadra, chiedi all'utente prima di proporre.
Se la richiesta è solo informativa (analisi, domanda), NON includere il blocco PROPOSTA.`;

  const geminiMessages = (messages || []).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const CHAT_MODELS = [
    { id: 'gemini-2.5-flash',    thinking: true  },
    { id: 'gemini-1.5-flash',    thinking: false },
    { id: 'gemini-1.5-flash-8b', thinking: false },
  ];
  let lastErr = 'Nessun modello disponibile';
  for (const { id, thinking } of CHAT_MODELS) {
    try {
      const genCfg = { temperature: 0.7, maxOutputTokens: 1024 };
      if (thinking) genCfg.thinkingConfig = { thinkingBudget: 0 };
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiMessages,
            generationConfig: genCfg
          })
        }
      );
      const data = await resp.json();
      if (!resp.ok) { lastErr = data.error?.message || `Errore ${id}`; continue; }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '(nessuna risposta)';
      return res.status(200).json({ success: true, reply: text, model: id });
    } catch(e) { lastErr = e.message; }
  }
  return res.status(500).json({ success: false, message: lastErr });
}

if (req.query?.action === 'ai-optimize') {
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  if (req.method !== 'POST')
    return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { giorni, oraInizio, oraFine, annateConfig, campi, spogliatoi } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, message: 'API key non configurata' });

  const toMin = t => { const [h,m]=(t||'0:0').split(':').map(Number); return h*60+m; };
  const toTime = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const GIORNI_NOMI = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  const CAMPO_MAX   = { a11:55, a9:35, a7:25, a5:15 };
  const midMin = Math.floor((toMin(oraInizio) + toMin(oraFine)) / 2);

  const campiDesc = (campi||[]).map(c =>
    `"${c.nome}" tipo:${c.tipo} porzioni:${c.porzioni||1} capienza:${CAMPO_MAX[c.tipo]||50}atleti`
  ).join(' | ');

  const annateDesc = (annateConfig||[]).map(a =>
    `Nome:"${a.nome}" Atleti:${a.atletiCount||a.atleti||0} Campo:${a.campoTipo||a.campo} CampoAlt:${a.campoTipoAlt||'—'} Durata:${a.durata}min GiorniPref:[${(a.giorniPref||[]).map(d=>GIORNI_NOMI[d]||d).join(',')}] Fascia:${a.fascia||'libera'} CoppiaCon:"${a.coppiaCon||''}" Doccia:${a.doccia!==false}`
  ).join('\n');

  // Prompt compatto: chiede solo l'assegnazione giorni per squadra (~50 token output)
  // Il frontend userà quei giorni con l'algoritmo esistente → zero conflitti garantiti
  const squadreCompact = (annateConfig||[]).map(a => {
    const pref = (a.giorniPref||giorni).filter(d => giorni.includes(d));
    return `${a.nome}:${pref.length||giorni.length}gg,pref:[${pref.map(d=>GIORNI_NOMI[d]).join(',')}]${a.coppiaCon?`,coppia:${a.coppiaCon}`:''}`;
  }).join(' | ');

  const prompt = `Pianifica i giorni di allenamento settimanali per squadre di calcio italiane.
Giorni disponibili: ${(giorni||[]).map(d=>`${GIORNI_NOMI[d]}=${d}`).join(',')}
Squadre (nome:giorni_richiesti,preferenze): ${squadreCompact}
VINCOLI: 1) MAI 3 giorni consecutivi. 2) Rispetta le preferenze. 3) Squadre "coppia" condividano gli stessi giorni. 4) Distribuisci il carico uniformemente.
OBBLIGATORIO: ogni squadra deve ricevere ESATTAMENTE il numero di giorni indicato (Ngg = N giorni nel JSON). Non uno di meno.
Rispondi SOLO con JSON compatto su una riga: {"NomeSquadra":[giorno,...],...}
Esempio: {"U2010":[1,3,5],"U2011":[2,4,6]}`;

  const extractJSON = raw => {
    try { return JSON.parse(raw); } catch(_) {}
    const md = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (md) { try { return JSON.parse(md[1].trim()); } catch(_) {} }
    const s = raw.indexOf('{'), e2 = raw.lastIndexOf('}');
    if (s >= 0 && e2 > s) return JSON.parse(raw.slice(s, e2 + 1));
    throw new Error('Nessun JSON trovato nella risposta');
  };

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } }
        })
      }
    );
    const data = await resp.json();
    if (!resp.ok)
      return res.status(500).json({ success: false, message: `Gemini: ${data.error?.message || resp.status}` });
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try { parsed = extractJSON(raw); } catch(e) {
      return res.status(500).json({ success: false, message: `JSON parse: ${e.message}`, debug_raw: raw.substring(0,300) });
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed) || !Object.keys(parsed).length)
      return res.status(500).json({ success: false, message: 'AI non ha restituito assegnazioni valide' });

    // Valida e integra: se l'AI ha assegnato meno giorni del necessario, supplementa
    const dayLoad = {};
    giorni.forEach(d => { dayLoad[d] = 0; });
    Object.values(parsed).forEach(days => (days||[]).forEach(d => { if (dayLoad[d] !== undefined) dayLoad[d]++; }));

    const supplemented = [];
    const validated = {};
    for (const ac of (annateConfig||[])) {
      const pref = (ac.giorniPref||giorni).filter(d => giorni.includes(d));
      const required = pref.length || giorni.length;
      let assigned = [...new Set((parsed[ac.nome]||[]).filter(d => giorni.includes(d)))];
      if (assigned.length < required) {
        supplemented.push(ac.nome);
        const usedDays = new Set(assigned);
        const prefSet = new Set(pref);
        const candidates = [...giorni]
          .filter(d => !usedDays.has(d))
          .sort((a, b) => {
            const ap = prefSet.has(a) ? 0 : 1, bp = prefSet.has(b) ? 0 : 1;
            return ap !== bp ? ap - bp : dayLoad[a] - dayLoad[b];
          });
        while (assigned.length < required && candidates.length > 0) {
          const d = candidates.shift();
          assigned.push(d);
          dayLoad[d]++;
        }
      }
      validated[ac.nome] = assigned;
    }

    return res.status(200).json({ success: true, dayAssignments: validated, supplemented });
  } catch(e) {
    return res.status(500).json({ success: false, message: `Gemini: ${e.message}` });
  }
}

// ── Senza annataId: dati globali / bacheca pubblica ──────────────────────
if (!annataId) {
if (req.method === 'GET') {
const globalPosts = (await kv.get('global:posts')) || [];
const teamName = (await kv.get('global:teamName')) || 'GO SPORT';
const bachecaConfig = (await kv.get('global:bachecaConfig')) || {};
const superadminBanners = (await kv.get('global:superadminBanners')) || {};
const postImages = {};
await Promise.all(globalPosts.map(async p => {
  if (p?.id) { const img = await kv.get(`global:postImg_${p.id}`); if (img) postImages[p.id] = img; }
}));
return res.status(200).json({
success: true, globalPosts, postImages, posts: [], teamName, bachecaConfig, superadminBanners
});
}

if (req.method === 'POST' && req.body && req.body.bachecaConfig !== undefined) {
if (!session.isAuthenticated || !canWrite(session.role)) {
return res.status(401).json({ success: false, message: 'Non autorizzato' });
}
await kv.set('global:bachecaConfig', req.body.bachecaConfig);
return res.status(200).json({ success: true });
}

return res.status(400).json({ success: false, message: 'Header X-Annata-Id obbligatorio' });
}

const isParentMode = req.query?.parentMode === '1' && req.method === 'GET';
// FIX v1.5.21: POST con solo calendarResponses o athleteDocs è permessa anche ai genitori non autenticati
const isCalendarResponsePost = req.method === 'POST' &&
  req.body && (req.body.calendarResponses !== undefined || req.body.athleteDocs !== undefined) &&
  Object.keys(req.body).length === 1;

if (!session.isAuthenticated && !isParentMode && !isCalendarResponsePost) {
return res.status(401).json({ success: false, message: 'Accesso non autorizzato. Effettua il login.' });
}
const prefix = `annate:${annataId}`;

// ── PostImages lazy ───────────────────────────────────────────────────────
if (req.method === 'GET' && req.query && req.query.action === 'postImages') {
const [ps, gps] = await Promise.all([
kv.get(`${prefix}:posts`),
kv.get('global:posts')
]);
const postImages = {};
await Promise.all([
...(ps || []).map(async p => { if (p?.id) { const img = await kv.get(`${prefix}:postImg_${p.id}`); if (img) postImages[p.id] = img; } }),
...(gps || []).map(async p => { if (p?.id) { const img = await kv.get(`global:postImg_${p.id}`); if (img) postImages[p.id] = img; } })
]);
return res.status(200).json({ success: true, postImages });
}

// ── Risposta ridotta per genitori ────────────────────────────────────────
if (isParentMode) {
const [calendarEvents, calendarResponses, teamName, convSettings, athletes, posts, globalPosts, documents, materiale, bachecaConfig, superadminBanners, convBg, convBg2, athleteDocs] = await Promise.all([
kv.get(`${prefix}:calendarEvents`),
kv.get(`${prefix}:calendarResponses`),
kv.get('global:teamName'),
kv.get(`${prefix}:convSettings`),
kv.get(`${prefix}:athletes`),
kv.get(`${prefix}:posts`),
kv.get('global:posts'),
kv.get(`${prefix}:documents`),
kv.get(`${prefix}:materiale`),
kv.get('global:bachecaConfig'),
kv.get('global:superadminBanners'),
kv.get(`${prefix}:convBg`),
kv.get(`${prefix}:convBg2`),
kv.get(`${prefix}:athleteDocs`)  // ← documenti caricati dai genitori
]);

return res.status(200).json({
calendarEvents: calendarEvents || {},
calendarResponses: calendarResponses || {},
teamName: teamName || 'GO SPORT',
convSettings: convSettings || {},
convBg:  convBg  || null,
convBg2: convBg2 || null,
athletes: (athletes || []).map(a => ({
id: a.id,
name: a.name,
ruolo: a.ruolo || a.role || ''
})),
posts: posts || [],
globalPosts: globalPosts || [],
documents: (documents || []).filter(d => (d.visibility || []).includes('pubblica')),
materiale: materiale || { items: [], assignments: {} },
bachecaConfig: bachecaConfig || {},
superadminBanners: superadminBanners || {},
athleteDocs: athleteDocs || {}  // ← incluso nella risposta
});
}

// ── Gare ─────────────────────────────────────────────────────────────────
if (req.query && req.query.action === 'gare') {
const sid = req.query.societyId || (req.body && req.body.societyId) || session.societyId || null;

if (!sid || !isValidId(sid)) {
return res.status(400).json({ success: false, message: 'societyId non valido' });
}

const gareKey = `gare:${sid}:gare`;
const squadreKey = `gare:${sid}:squadre`;

if (req.method === 'GET') {
const [gare, squadre] = await Promise.all([kv.get(gareKey), kv.get(squadreKey)]);
return res.status(200).json({ success: true, gare: gare || [], squadre: squadre || [] });
}

if (req.method === 'POST') {
if (!canWrite(session.role)) {
return res.status(403).json({ success: false, message: 'Permesso negato' });
}
const body = req.body || {};
const saves = [];
if (body.gare !== undefined) saves.push(kv.set(gareKey, body.gare));
if (body.squadre !== undefined) saves.push(kv.set(squadreKey, body.squadre));
if (saves.length) await Promise.all(saves);
return res.status(200).json({ success: true });
}
}

// ── GET dati principali ───────────────────────────────────────────────────
if (req.method === 'GET') {
const t0 = Date.now();

const [
athletes, evaluations, gpsData, awards, trainingSessions,
formationData, matchResults, calendarEvents, calendarResponses,
materiale, pagamenti, pagVoci, pagLabels, convocazioni, convSettings,
convBg, convBg2, posts, globalPosts, teamName, individualPassword,
ratingSheets, documents, athleteDocs, bachecaConfig, superadminBanners
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
kv.get(`${prefix}:pagVoci`),
kv.get(`${prefix}:pagLabels`),
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
kv.get(`${prefix}:athleteDocs`),
kv.get('global:bachecaConfig'),
kv.get('global:superadminBanners')
]);

const data = {
athletes: athletes || [],
evaluations: evaluations || {},
gpsData: gpsData || {},
awards: awards || {},
trainingSessions: trainingSessions || {},
formationData: formationData || { starters: [], bench: [], tokens: [] },
matchResults: matchResults || {},
calendarEvents: calendarEvents || {},
calendarResponses: calendarResponses || {},
materiale: materiale || { items: [], assignments: {} },
pagamenti: pagamenti || {},
pagVoci: pagVoci || null,
pagLabels: pagLabels || null,
convocazioni: convocazioni || [],
convSettings: convSettings || {},
convBg: convBg || null,
convBg2: convBg2 || null,
posts: posts || [],
globalPosts: globalPosts || [],
postImages: {},
teamName: teamName || 'GO SPORT',
individualPassword: individualPassword || '1234',
ratingSheets: ratingSheets || {},
documents: documents || [],
athleteDocs: athleteDocs || {},
bachecaConfig: bachecaConfig || {},
superadminBanners: superadminBanners || {}
};

console.log(`GET /api/data - annata=${annataId} user=${session.username} role=${session.role} atleti=${Array.isArray(data.athletes) ? data.athletes.length : 0} tempo=${Date.now() - t0}ms`);

const acceptEncoding = req.headers['accept-encoding'] || '';
if (acceptEncoding.includes('gzip')) {
const compressed = gzipSync(Buffer.from(JSON.stringify(data), 'utf8'));
res.setHeader('Content-Encoding', 'gzip');
res.setHeader('Content-Type', 'application/json');
res.setHeader('Vary', 'Accept-Encoding');
return res.status(200).end(compressed);
}

return res.status(200).json(data);
}

// ── POST salvataggio ──────────────────────────────────────────────────────
if (req.method === 'POST') {
const body = req.body || {};

// FIX v1.5.21: bachecaConfig è un salvataggio globale che richiede solo
// autenticazione (non canWrite), gestito PRIMA del check canWrite.
// Salviamo anche quando arriva con annataId (perché l'interceptor lo aggiunge sempre).
if (body.bachecaConfig !== undefined) {
if (!session.isAuthenticated) {
return res.status(401).json({ success: false, message: 'Non autorizzato' });
}
await kv.set('global:bachecaConfig', body.bachecaConfig);
return res.status(200).json({ success: true });
}

// FIX v1.5.21: calendarResponses può essere salvato da genitori (anche non autenticati)
// Il check isCalendarResponsePost è già stato fatto sopra
if (body.calendarResponses !== undefined && Object.keys(body).length === 1) {
await kv.set(`${prefix}:calendarResponses`, body.calendarResponses);
return res.status(200).json({ success: true });
}

// athleteDocs: documenti caricati dai genitori (link Google Drive)
// Accessibile senza canWrite — il genitore carica il proprio documento
if (body.athleteDocs !== undefined && Object.keys(body).length === 1) {
// Leggi i docs esistenti e fai merge (non sovrascrivere tutto)
const existing = await kv.get(`${prefix}:athleteDocs`) || {};
// Merge profondo: per ogni atleta, merge dei tipi documento
// Se un valore è null → elimina quella chiave
for (const athleteId of Object.keys(body.athleteDocs)) {
  const incoming = body.athleteDocs[athleteId] || {};
  const current = existing[athleteId] || {};
  for (const docKey of Object.keys(incoming)) {
    if (incoming[docKey] === null) {
      delete current[docKey]; // elimina documento
    } else {
      current[docKey] = incoming[docKey]; // aggiorna/aggiungi
    }
  }
  if (Object.keys(current).length === 0) {
    delete existing[athleteId]; // rimuovi atleta se non ha più documenti
  } else {
    existing[athleteId] = current;
  }
}
await kv.set(`${prefix}:athleteDocs`, existing);
return res.status(200).json({ success: true });
}

if (!canWrite(session.role)) {
return res.status(403).json({ success: false, message: 'Permesso negato' });
}

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
if (body.pagVoci !== undefined) await kv.set(`${prefix}:pagVoci`, body.pagVoci);
if (body.pagLabels !== undefined) await kv.set(`${prefix}:pagLabels`, body.pagLabels);
if (body.ratingSheets !== undefined) await kv.set(`${prefix}:ratingSheets`, body.ratingSheets);
if (body.documents !== undefined) await kv.set(`${prefix}:documents`, body.documents);
if (body.athleteDocs !== undefined) await kv.set(`${prefix}:athleteDocs`, body.athleteDocs);

// Log scaricamento documento (aggiorna solo il campo downloadLog)
if (body.athleteDocDownload !== undefined) {
  const { athleteId, docKey, user } = body.athleteDocDownload;
  if (athleteId && docKey) {
    const existing = await kv.get(`${prefix}:athleteDocs`) || {};
    if (existing[athleteId] && existing[athleteId][docKey]) {
      existing[athleteId][docKey].downloadLog = { user: user || 'coach', at: new Date().toISOString() };
      await kv.set(`${prefix}:athleteDocs`, existing);
    }
  }
}
if (body.convocazioni !== undefined) await kv.set(`${prefix}:convocazioni`, body.convocazioni);
if (body.convSettings !== undefined) await kv.set(`${prefix}:convSettings`, body.convSettings);

if (body.convBg !== undefined) { if (body.convBg) await kv.set(`${prefix}:convBg`, body.convBg); else await kv.del(`${prefix}:convBg`); }
if (body.convBg2 !== undefined) { if (body.convBg2) await kv.set(`${prefix}:convBg2`, body.convBg2); else await kv.del(`${prefix}:convBg2`); }

if (body.posts !== undefined) await kv.set(`${prefix}:posts`, body.posts);

const globalPostIds = ((await kv.get('global:posts')) || []).map(p => p.id);
for (const key of Object.keys(body)) {
if (key.startsWith('postImg_')) {
const postId = key.replace('postImg_', '');
if (globalPostIds.includes(postId)) await kv.set(`global:${key}`, body[key]);
else await kv.set(`${prefix}:${key}`, body[key]);
}
}

if (body.globalPosts !== undefined) await kv.set('global:posts', body.globalPosts);

console.log(`POST /api/data - annata=${annataId} user=${session.username} role=${session.role}`);
return res.status(200).json({ success: true });
}

return res.status(405).json({ success: false, message: 'Metodo non consentito' });

} catch (error) {
console.error('Errore in /api/data:', error);
return res.status(500).json({ success: false, message: 'Errore del server' });
}
}
