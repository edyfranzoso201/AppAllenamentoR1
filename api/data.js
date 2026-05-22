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

  const systemPrompt = `Sei un assistente esperto di gestione impianti sportivi per la piattaforma GO Sport.
Hai accesso ai dati in tempo reale dell'impianto e rispondi sempre in italiano in modo conciso e pratico.

DATI IMPIANTO CORRENTI:
${context ? JSON.stringify(context, null, 2) : 'Nessun dato disponibile'}

Regole:
- Rispondi in italiano
- Sii conciso e diretto
- Se rilevi conflitti o problemi negli slot, evidenziali
- Se suggerisci cambiamenti, spiega il motivo
- Per domande sui giorni usa: L=Lunedì M=Martedì Me=Mercoledì G=Giovedì V=Venerdì S=Sabato D=Domenica`;

  // Prepend system context as first user/model exchange (gemini-pro doesn't support system_instruction)
  const contents = [
    { role: 'user',  parts: [{ text: `[ISTRUZIONI]\n${systemPrompt}` }] },
    { role: 'model', parts: [{ text: 'Capito. Sono pronto ad assistere con la gestione impianti GO Sport.' }] },
    ...(messages || []).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  ];

  // Try models in order: 1.5-flash → 1.5-flash-latest → gemini-pro
  const MODELS = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro'];
  let lastError = '';
  for (const model of MODELS) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } })
        }
      );
      const data = await resp.json();
      if (!resp.ok) { lastError = data.error?.message || `Errore ${model}`; continue; }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '(nessuna risposta)';
      return res.status(200).json({ success: true, reply: text });
    } catch(e) { lastError = e.message; }
  }
  return res.status(500).json({ success: false, message: lastError || 'Tutti i modelli non disponibili' });
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
