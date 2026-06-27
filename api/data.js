// api/data.js - VERSIONE SICURA BASE
import { createClient } from '@vercel/kv';
import { gzipSync } from 'zlib';
import crypto from 'crypto';

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
// Setta Allow-Origin SOLO per origini in whitelist. Per un'origine
// sconosciuta non settiamo l'header: il browser blocca la richiesta
// cross-origin. Le richieste senza header Origin (same-origin, cron,
// server-to-server, backup bot) non sono soggette a CORS e passano comunque.
if (origin && allowed.includes(origin)) {
res.setHeader('Access-Control-Allow-Origin', origin);
}
res.setHeader('Vary', 'Origin');
}

async function getSessionInfo(req) {
const rawAuth = String(req.headers['x-auth-session'] || '').trim();
const empty = { isAuthenticated: false, role: '', username: '', societyId: '' };
// Serve un token di sessione reale (creato dal login, TTL 8h). Niente più flag 'true'.
if (!rawAuth || rawAuth === 'true') return empty;
let sessionData = null;
try {
sessionData = await kv.get(`session:${rawAuth}`);
} catch (e) {
console.warn('Errore lookup sessione:', e?.message || e);
return empty;
}
if (!sessionData) return empty;
// TTL scorrevole: ogni chiamata API con sessione valida rinnova la scadenza a
// 8h da ora, così l'utente attivo non viene disconnesso mentre lavora. Le
// sessioni inattive >8h scadono comunque. Soft: un errore qui non blocca la richiesta.
try { await kv.expire(`session:${rawAuth}`, 8 * 60 * 60); } catch (e) { /* non bloccante */ }
// Ruolo/utente/società vengono dalla sessione salvata server-side, NON dagli header
// del client (che sarebbero falsificabili). Questo impedisce l'escalation di privilegi.
return {
isAuthenticated: true,
role: String(sessionData.role || '').trim(),
username: String(sessionData.username || '').trim(),
societyId: String(sessionData.societyId || '').trim()
};
}

function isValidId(value) {
return /^[a-z0-9_-]+$/i.test(String(value || '').trim());
}

// Nome squadra ISOLATO per società: ricavato dal societyName della licenza
// della società indicata. Questo evita che il nome sia condiviso tra società
// (la vecchia chiave global:teamName era unica per tutti). Fallback in ordine:
// societyName licenza → global:teamName (retrocompat mono-società) → generico.
async function resolveTeamName(societyId) {
  try {
    if (societyId) {
      const licKey = await kv.get(`licenze_society:${societyId}`);
      if (licKey) {
        const lic = await kv.get(`licenze:${licKey}`);
        if (lic && lic.societyName) return lic.societyName;
      }
    }
  } catch (e) { /* fallback sotto */ }
  const legacy = await kv.get('global:teamName');
  return legacy || 'La mia squadra';
}

// ── iCal feed helpers (integrati qui per non superare il limite di funzioni
//    serverless del piano Hobby; logica originariamente in api/ical.js) ──────
function icalSecret() { return process.env.ICAL_SECRET || process.env.BACKUP_SECRET || ''; }
function icalSign(athleteId, annataId) {
  return crypto.createHmac('sha256', icalSecret()).update(`${athleteId}:${annataId}`).digest('hex').substring(0, 32);
}
function icalEsc(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icalParseTime(t) {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/g) || [];
  const toHHMMSS = hm => hm.replace(':', '').padStart(4, '0') + '00';
  return { start: m[0] ? toHHMMSS(m[0]) : '180000', end: m[1] ? toHHMMSS(m[1]) : null };
}
const ICAL_TYPE_ICON = { Allenamento:'🏃', Partita:'⚽', Torneo:'🏆', Campionato:'🏅', Finale:'🥇', Semifinale:'🥈', Individual:'🏋️', Visita:'🏥', Evento:'📅', Varie:'🎉' };

function canWrite(role) {
return ['admin', 'coach', 'coachl1', 'coachl2'].includes(String(role || '').toLowerCase());
}

// Il cambio stagione è un'operazione delicata (archivia + azzera): consentita
// SOLO ad admin, dirigente (D-L1) e coach_l1 (C-L1). Normalizza il ruolo
// rimuovendo underscore così matcha sia 'coach_l1' sia 'coachl1'.
function canSeasonReset(role) {
const r = String(role || '').toLowerCase().replace(/_/g, '');
return ['admin', 'dirigente', 'coachl1'].includes(r);
}

// ── R2: cancellazione atleta che propaga (GDPR art. 17) ───────────────────────
// Le strutture per-atleta sono chiavi Redis SEPARATE: una delete fatta solo
// lato client (che carica/salva un sottoinsieme) lascerebbe dati orfani in
// ratingSheets, pagamenti, athleteDocs, materiale.assignments, convocazioni.
// purgeAthlete() rimuove l'atleta da TUTTE le chiavi del prefix, lato server,
// in modo affidabile. Usata sia dalla delete manuale (action=purge-athlete)
// sia dal cron di retention (auto-oblio dopo 12 mesi di archiviazione).
// Ritorna true se l'atleta era presente ed è stato rimosso.
async function purgeAthlete(prefix, athleteId) {
  const aid = String(athleteId);
  if (!aid) return false;

  const athletes = (await kv.get(`${prefix}:athletes`)) || [];
  const existed = athletes.some(a => String(a.id) === aid);
  const writes = [];

  // 1. anagrafica (include individualPackage, parents, scadenze: tutto dentro l'oggetto)
  const newAthletes = athletes.filter(a => String(a.id) !== aid);
  writes.push(kv.set(`${prefix}:athletes`, newAthletes));

  // 2. mappe {date:{id:...}} → cancella la voce dell'atleta in ogni data
  for (const k of ['evaluations', 'calendarResponses']) {
    const obj = await kv.get(`${prefix}:${k}`);
    if (obj && typeof obj === 'object') {
      let dirty = false;
      for (const date of Object.keys(obj)) {
        if (obj[date] && typeof obj[date] === 'object' && aid in obj[date]) {
          delete obj[date][aid]; dirty = true;
        }
      }
      if (dirty) writes.push(kv.set(`${prefix}:${k}`, obj));
    }
  }

  // 3. mappe {id:...} → cancella la chiave dell'atleta
  for (const k of ['gpsData', 'ratingSheets', 'pagamenti', 'athleteDocs', 'infortuni']) {
    const obj = await kv.get(`${prefix}:${k}`);
    if (obj && typeof obj === 'object' && aid in obj) {
      delete obj[aid];
      writes.push(kv.set(`${prefix}:${k}`, obj));
    }
  }

  // 4. awards {date:[{athleteId}]} → filtra
  const awards = await kv.get(`${prefix}:awards`);
  if (awards && typeof awards === 'object') {
    let dirty = false;
    for (const date of Object.keys(awards)) {
      if (Array.isArray(awards[date])) {
        const before = awards[date].length;
        awards[date] = awards[date].filter(a => String(a.athleteId) !== aid);
        if (awards[date].length !== before) dirty = true;
      }
    }
    if (dirty) writes.push(kv.set(`${prefix}:awards`, awards));
  }

  // 5. matchResults {matchId:{scorers,cards,assists}} → filtra ogni lista
  const matchResults = await kv.get(`${prefix}:matchResults`);
  if (matchResults && typeof matchResults === 'object') {
    let dirty = false;
    for (const mid of Object.keys(matchResults)) {
      const m = matchResults[mid];
      if (!m || typeof m !== 'object') continue;
      for (const list of ['scorers', 'cards', 'assists']) {
        if (Array.isArray(m[list])) {
          const before = m[list].length;
          m[list] = m[list].filter(x => String(x.athleteId) !== aid);
          if (m[list].length !== before) dirty = true;
        }
      }
    }
    if (dirty) writes.push(kv.set(`${prefix}:matchResults`, matchResults));
  }

  // 6. formationData {starters,bench,tokens} → filtra per athleteId
  const formationData = await kv.get(`${prefix}:formationData`);
  if (formationData && typeof formationData === 'object') {
    let dirty = false;
    for (const list of ['starters', 'bench', 'tokens']) {
      if (Array.isArray(formationData[list])) {
        const before = formationData[list].length;
        formationData[list] = formationData[list].filter(p => String(p.athleteId) !== aid);
        if (formationData[list].length !== before) dirty = true;
      }
    }
    if (dirty) writes.push(kv.set(`${prefix}:formationData`, formationData));
  }

  // 7. materiale.assignments {id:{...}} → cancella la chiave dell'atleta
  const materiale = await kv.get(`${prefix}:materiale`);
  if (materiale && typeof materiale === 'object' && materiale.assignments && aid in materiale.assignments) {
    delete materiale.assignments[aid];
    writes.push(kv.set(`${prefix}:materiale`, materiale));
  }

  // 8. convocazioni [{atletiIds,staffIds}] → rimuovi l'id dalle liste
  const convocazioni = await kv.get(`${prefix}:convocazioni`);
  if (Array.isArray(convocazioni)) {
    let dirty = false;
    for (const c of convocazioni) {
      if (!c || typeof c !== 'object') continue;
      for (const list of ['atletiIds', 'staffIds']) {
        if (Array.isArray(c[list])) {
          const before = c[list].length;
          c[list] = c[list].filter(x => String(x) !== aid);
          if (c[list].length !== before) dirty = true;
        }
      }
    }
    if (dirty) writes.push(kv.set(`${prefix}:convocazioni`, convocazioni));
  }

  await Promise.all(writes);
  return existed;
}

// Log adempimento art. 17 SENZA dati personali: solo data/annata/conteggio.
// Serve come prova documentale che l'oblio per retention è stato applicato.
// `extra` (opz.) aggiunge campi non personali, es. {kind:'season', label:'2025-26'}.
async function logRetentionPurge(annataId, count, extra) {
  if (!count) return;
  try {
    const key = 'gdpr:retention-log';
    const log = (await kv.get(key)) || [];
    log.push({ date: new Date().toISOString().split('T')[0], annataId: String(annataId), count, ...(extra || {}) });
    // tieni le ultime 500 righe per non far crescere all'infinito
    await kv.set(key, log.slice(-500));
  } catch (e) { console.error('[retention-log]', e?.message || e); }
}

export default async function handler(req, res) {
setCors(req, res);
res.setHeader('Access-Control-Allow-Headers',
'Content-Type, X-Annata-Id, X-Auth-Session, X-Auth-User, X-User-Role, X-Society-Id, X-Sa-Key');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

if (req.method === 'OPTIONS') return res.status(200).end();

// ── iCal feed (pubblico, protetto da firma HMAC) — PRIMA dell'auth ─────────
// ?action=ical&sub=link&a=<id>&annata=<id>  → link feed firmato (per genitore)
// ?action=ical&a=<id>&annata=<id>&sig=<HMAC> → .ics live (per Google/Apple)
if (req.query?.action === 'ical') {
  const aId = String(req.query.a || '').trim();
  const annId = String(req.query.annata || '').trim();
  if (!aId || !annId || !isValidId(annId)) return res.status(400).json({ error: 'Parametri non validi' });
  if (!icalSecret()) return res.status(503).json({ error: 'Feed non configurato' });

  if (req.query.sub === 'link') {
    const sig = icalSign(aId, annId);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = `${host}/api/data?action=ical&a=${encodeURIComponent(aId)}&annata=${encodeURIComponent(annId)}&sig=${sig}`;
    return res.status(200).json({ url: `https://${base}`, webcal: `webcal://${base}` });
  }

  // Verifica firma (timing-safe)
  const got = String(req.query.sig || '').trim();
  const exp = icalSign(aId, annId);
  const ga = Buffer.from(got), gb = Buffer.from(exp);
  if (ga.length !== gb.length || !crypto.timingSafeEqual(ga, gb)) {
    return res.status(403).json({ error: 'Firma non valida' });
  }

  const [evRaw, respRaw, annListRaw] = await Promise.all([
    kv.get(`annate:${annId}:calendarEvents`),
    kv.get(`annate:${annId}:calendarResponses`),
    kv.get('annate:list'),
  ]);
  const evs = evRaw || {}, resp = respRaw || {};
  const annata = (annListRaw || []).find(x => String(x.id) === annId);
  const calName = `${(annata && (annata.nome || annata.label)) || 'Squadra'} — Calendario`;
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sport Monitoring//Calendario//IT\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n'
    + `X-WR-CALNAME:${icalEsc(calName)}\r\nX-WR-TIMEZONE:Europe/Rome\r\n`;
  Object.keys(evs).sort().forEach(date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const ev = evs[date];
    if (!ev || !ev.type) return;
    const rec = resp[date] && (resp[date][aId] || resp[date][String(aId)]);
    const status = rec ? (typeof rec === 'object' ? rec.status : rec) : null;
    if (status === 'Assente') return; // esclude le assenze segnalate
    const { start, end } = icalParseTime(ev.time);
    const d = date.replace(/-/g, '');
    const icon = ICAL_TYPE_ICON[ev.type] || '📌';
    const summary = `${icon} ${ev.type}${ev.note ? ' — ' + ev.note : ''}`;
    const desc = [];
    if (ev.time) desc.push(`Orario: ${ev.time}`);
    if (ev.note) desc.push(ev.note);
    if (ev.athleteName) desc.push(`Atleta: ${ev.athleteName}`);
    ics += 'BEGIN:VEVENT\r\n'
      + `UID:${date}-${aId}-${annId}@sportmonitoring\r\n`
      + `DTSTAMP:${nowStamp}\r\n`
      + `DTSTART;TZID=Europe/Rome:${d}T${start}\r\n`
      + (end ? `DTEND;TZID=Europe/Rome:${d}T${end}\r\n` : '')
      + `SUMMARY:${icalEsc(summary)}\r\n`
      + (desc.length ? `DESCRIPTION:${icalEsc(desc.join('\n'))}\r\n` : '')
      + 'STATUS:CONFIRMED\r\nEND:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR\r\n';
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="calendario.ics"');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(ics);
}

try {
const session = await getSessionInfo(req);

const rawAnnata = req.headers['x-annata-id'] || req.headers['X-Annata-Id'] || '';
const annataId = String(rawAnnata).split(',')[0].trim();

if (annataId && !isValidId(annataId)) {
return res.status(400).json({ success: false, message: 'Formato annataId non valido' });
}

// ── PUSH: subscribe ────────────────────────────────────────────────────────
// Endpoint pubblico (genitori/bacheca senza login): non richiede auth, ma è
// indurito contro abusi — id annata valido, annata esistente, endpoint https,
// e cap sul numero di sottoscrizioni per annata per evitare di gonfiare il KV.
if (req.query?.action === 'push-subscribe' && req.method === 'POST') {
  const { subscription, annataId: subAnnataId } = req.body || {};
  if (!subAnnataId || !subscription?.endpoint) {
    return res.status(400).json({ success: false, message: 'Dati mancanti' });
  }
  if (!isValidId(subAnnataId)) {
    return res.status(400).json({ success: false, message: 'annataId non valido' });
  }
  // L'endpoint push deve essere un URL https (web push valido)
  if (typeof subscription.endpoint !== 'string' || !subscription.endpoint.startsWith('https://')) {
    return res.status(400).json({ success: false, message: 'subscription non valida' });
  }
  // L'annata deve esistere: niente liste push per annate inventate
  const pushAnnateList = (await kv.get('annate:list')) || [];
  if (!pushAnnateList.some(a => String(a.id) === String(subAnnataId))) {
    return res.status(404).json({ success: false, message: 'Annata non trovata' });
  }
  const key = `push:annata:${subAnnataId}:subs`;
  const subs = (await kv.get(key)) || [];
  if (!subs.find(s => s.endpoint === subscription.endpoint)) {
    if (subs.length >= 2000) {
      return res.status(429).json({ success: false, message: 'Limite sottoscrizioni raggiunto' });
    }
    subs.push(subscription);
    await kv.set(key, subs);
    const annateList = (await kv.get('push:annate')) || [];
    if (!annateList.includes(subAnnataId)) { annateList.push(subAnnataId); await kv.set('push:annate', annateList); }
  }
  return res.status(200).json({ success: true });
}

// ── R2: cancellazione atleta che propaga (GDPR art. 17) ──────────────────────
// Cancella un atleta da TUTTE le chiavi del prefix lato server (no orfani).
// Solo ruoli con permesso di scrittura. annataId dall'header (X-Annata-Id).
if (req.query?.action === 'purge-athlete' && req.method === 'POST') {
  if (!session.isAuthenticated || !canWrite(session.role)) {
    return res.status(403).json({ success: false, message: 'Permesso negato' });
  }
  if (!annataId || !isValidId(annataId)) {
    return res.status(400).json({ success: false, message: 'annataId non valido' });
  }
  const athleteId = String((req.body && req.body.athleteId) || '').trim();
  if (!athleteId) {
    return res.status(400).json({ success: false, message: 'athleteId mancante' });
  }
  try {
    const removed = await purgeAthlete(`annate:${annataId}`, athleteId);
    return res.status(200).json({ success: true, removed });
  } catch (e) {
    console.error('[purge-athlete]', e?.message || e);
    return res.status(500).json({ success: false, message: 'Errore cancellazione' });
  }
}

// ── INFORTUNI: storico per atleta (dato sensibile art.9 — SOLO staff) ────────
// Struttura: annate:<id>:infortuni = { athleteId: [ {id,dataInizio,
// dataRientroPrevista,dataRientroEffettiva,tipo,zona,note,attivo}, ... ] }.
// NON è incluso nel GET dati (né va ai genitori): endpoint dedicato e protetto.
// Lo stato "infortunato" sull'atleta è derivato: c'è un infortunio attivo.
if (req.query?.action === 'infortuni') {
  if (!session.isAuthenticated || !canWrite(session.role)) {
    return res.status(403).json({ success: false, message: 'Permesso negato' });
  }
  if (!annataId || !isValidId(annataId)) {
    return res.status(400).json({ success: false, message: 'annataId non valido' });
  }
  const prefix = `annate:${annataId}`;
  const key = `${prefix}:infortuni`;

  if (req.method === 'GET') {
    const infortuni = (await kv.get(key)) || {};
    return res.status(200).json({ success: true, infortuni });
  }

  if (req.method === 'POST') {
    const athleteId = String((req.body && req.body.athleteId) || '').trim();
    if (!athleteId) return res.status(400).json({ success: false, message: 'athleteId mancante' });
    const { infortunio, deleteId } = req.body || {};
    const all = (await kv.get(key)) || {};
    let lista = Array.isArray(all[athleteId]) ? all[athleteId] : [];

    if (deleteId) {
      lista = lista.filter(x => x.id !== deleteId);
    } else if (infortunio && typeof infortunio === 'object') {
      // tipo limitato a categorie generiche (no diagnosi mediche dettagliate)
      const tipiOk = ['muscolare', 'articolare', 'trauma', 'altro'];
      const v = {
        id: infortunio.id || ('inf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        dataInizio: String(infortunio.dataInizio || '').slice(0, 10),
        dataRientroPrevista: String(infortunio.dataRientroPrevista || '').slice(0, 10),
        dataRientroEffettiva: String(infortunio.dataRientroEffettiva || '').slice(0, 10),
        tipo: tipiOk.includes(infortunio.tipo) ? infortunio.tipo : 'altro',
        zona: String(infortunio.zona || '').slice(0, 60),
        note: String(infortunio.note || '').slice(0, 300),
        linkDoc: (/^(https?:\/\/|file:\/\/|\\\\)/i.test(String(infortunio.linkDoc || '').trim())) ? String(infortunio.linkDoc).trim().slice(0, 500) : '',
        attivo: !infortunio.dataRientroEffettiva
      };
      const idx = lista.findIndex(x => x.id === v.id);
      if (idx >= 0) lista[idx] = v; else lista.push(v);
    }

    if (lista.length) all[athleteId] = lista; else delete all[athleteId];
    await kv.set(key, all);

    // Aggiorna lo stato derivato sull'atleta (infortunato + dataRientro) così la
    // UI esistente (badge card, formazioni) resta coerente senza altre fetch.
    try {
      const athletes = (await kv.get(`${prefix}:athletes`)) || [];
      const att = lista.find(x => x.attivo);
      const i = athletes.findIndex(a => String(a.id) === athleteId);
      if (i >= 0) {
        if (att) { athletes[i].infortunato = true; athletes[i].dataRientro = att.dataRientroPrevista || ''; }
        else { athletes[i].infortunato = false; delete athletes[i].dataRientro; }
        await kv.set(`${prefix}:athletes`, athletes);
      }
    } catch (e) { console.error('[infortuni] sync athlete state:', e?.message || e); }

    return res.status(200).json({ success: true, infortuni: all });
  }
}

// ── AREA TECNICA: libreria video + (futuro) esercizi/schede/documenti ────────
// Storage annate:<id>:areaTecnica = [ {id,tipo,titolo,url,fonte,categoria,data,
// note,createdAt}, ... ]. tipo: video|esercizio|scheda|documento (Fase 1: video).
// SOLO staff (canWrite). url validato come per infortuni (https/\\/file://).
if (req.query?.action === 'area-tecnica') {
  if (!session.isAuthenticated || !canWrite(session.role)) {
    return res.status(403).json({ success: false, message: 'Permesso negato' });
  }
  if (!annataId || !isValidId(annataId)) {
    return res.status(400).json({ success: false, message: 'annataId non valido' });
  }
  const key = `annate:${annataId}:areaTecnica`;

  if (req.method === 'GET') {
    const items = (await kv.get(key)) || [];
    return res.status(200).json({ success: true, items });
  }

  if (req.method === 'POST') {
    const { item, deleteId } = req.body || {};
    let items = (await kv.get(key)) || [];
    if (deleteId) {
      items = items.filter(x => x.id !== deleteId);
    } else if (item && typeof item === 'object') {
      const tipiOk = ['video', 'esercizio', 'scheda', 'documento'];
      const catOk = ['allenamento', 'partita', 'stralcio', 'tattica', 'altro'];
      const fontiOk = ['drive', 'youtube', 'locale', 'altro'];
      const url = String(item.url || '').trim();
      if (!/^(https?:\/\/|file:\/\/|\\\\)/i.test(url)) {
        return res.status(400).json({ success: false, message: 'Link non valido (usa https://, percorso di rete \\\\… o file://)' });
      }
      const colore = String(item.colore || '').trim();
      const cover  = String(item.cover  || '').trim();
      const v = {
        id: item.id || ('at' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        tipo: tipiOk.includes(item.tipo) ? item.tipo : 'video',
        titolo: String(item.titolo || '').slice(0, 120),
        url: url.slice(0, 600),
        fonte: fontiOk.includes(item.fonte) ? item.fonte : 'altro',
        categoria: catOk.includes(item.categoria) ? item.categoria : 'altro',
        data: String(item.data || '').slice(0, 10),
        note: String(item.note || '').slice(0, 400),
        createdAt: item.createdAt || new Date().toISOString()
      };
      if (colore && /^#[0-9a-fA-F]{6}$/.test(colore)) v.colore = colore;
      if (cover  && /^https?:\/\//i.test(cover))       v.cover  = cover.slice(0, 500);
      const idx = items.findIndex(x => x.id === v.id);
      if (idx >= 0) items[idx] = v; else items.push(v);
    }
    await kv.set(key, items);
    return res.status(200).json({ success: true, items });
  }
}

// ── PERSONALIZZA MENU: configurazione admin per società ──────────────────────
// Pannello 1 (governance): l'admin decide quali tab opzionali sono "fisse per
// tutti" e quali "personalizzabili" dal singolo utente. Salvata PER SOCIETÀ in
// society:<id>:menuConfig = { locked: ["data-tab", ...] } (l'array elenca le tab
// che l'admin ha BLOCCATO come sempre-visibili; tutte le altre opzionali sono
// personalizzabili). Pannello 2 (vista utente) è 100% client/localStorage e non
// passa di qui. GET: tutti gli autenticati (serve all'utente per sapere cosa può
// personalizzare). POST: solo admin. Niente nuovo file serverless (limite Hobby).
if (req.query?.action === 'menu-config') {
  if (!session.isAuthenticated) {
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  }
  const sid = session.societyId || '_default';
  const key = `society:${sid}:menuConfig`;

  if (req.method === 'GET') {
    const cfg = (await kv.get(key)) || { locked: [] };
    if (!Array.isArray(cfg.locked)) cfg.locked = [];
    return res.status(200).json({ success: true, config: cfg });
  }

  if (req.method === 'POST') {
    if (String(session.role).toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo l\'amministratore può configurare il menu della società' });
    }
    let locked = (req.body && req.body.locked) || [];
    if (!Array.isArray(locked)) locked = [];
    // Sanifica: solo stringhe brevi tipo data-tab/identificatori (max 40 voci)
    locked = locked
      .filter(x => typeof x === 'string' && /^[\w-]{1,60}$/.test(x))
      .slice(0, 40);
    const cfg = { locked, updatedAt: new Date().toISOString() };
    await kv.set(key, cfg);
    return res.status(200).json({ success: true, config: cfg });
  }
}

// ── INVENTARIO MATERIALE (per annata) ────────────────────────────────────────
// Chiavi: society:<sid>:inventory:<annataId>  → array di voci
//         society:<sid>:inventoryCategories   → array di stringhe (categorie custom)
// Permessi scrittura: admin, dirigente, coach_l1. Lettura: tutti gli autenticati.
// Niente nuovo file serverless (limite Hobby 12 route).
const INV_WRITE_ROLES = ['admin', 'dirigente', 'coachl1', 'coach_l1'];
function canInventory(role) { return INV_WRITE_ROLES.includes(String(role || '').toLowerCase().replace(/ /g, '')); }
const INV_CAT_WRITE_ROLES = ['admin', 'dirigente'];
function canInventoryCat(role) { return INV_CAT_WRITE_ROLES.includes(String(role || '').toLowerCase()); }

const INV_DEFAULT_CATS = ['Maglie da calcio', 'Pantaloncini', 'Calzettoni', 'Palloni', 'Porte / Reti', 'Coni / Paletti', 'Pettorine', 'Altro'];

function sanitizeInvItem(raw) {
  const TAGLIE = ['', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '6 anni', '8 anni', '10 anni', '12 anni', '14 anni', 'Unica',
                  '6', '8', '10', '12', '14',
                  '23-26 (n°5)', '27-30 (n°6)', '31-34 (n°7)', '35-38 (n°8)',
                  '39-42 (n°9)', '43-46 (n°10)', '47-49 (n°11)',
                  '37', '38', '39', '40', '41', '42', '43', '44', '45'];
  const COND = ['buono', 'riparazione', 'fuori_uso', 'mancante'];
  const item = {
    id:         String(raw.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || crypto.randomUUID().replace(/-/g,'').slice(0,16),
    categoria:  String(raw.categoria || 'Altro').slice(0, 80),
    nome:       String(raw.nome || '').slice(0, 120),
    quantita:   Math.max(0, Math.min(9999, parseInt(raw.quantita) || 0)),
    taglia:     TAGLIE.includes(raw.taglia) ? raw.taglia : '',
    condizione: COND.includes(raw.condizione) ? raw.condizione : 'buono',
    note:       String(raw.note || '').slice(0, 500),
    updatedAt:  new Date().toISOString(),
  };
  // Metadati kit maglie numerato
  // Normalizza _ktName (legacy) → _kitName: tutti i nuovi item usano sempre _kitName
  const resolvedKitName = String(raw._kitName || raw._ktName || '').slice(0, 80);
  if (resolvedKitName) item._kitName = resolvedKitName;
  if (raw._kitNum  != null) item._kitNum = String(raw._kitNum).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || '1';
  if (raw._kitExtra) item._kitExtra = true;
  // Colore + Tipologia a livello di set (testo libero)
  if (raw._kitColore)    item._kitColore    = String(raw._kitColore).slice(0, 40);
  if (raw._kitTipologia) item._kitTipologia = String(raw._kitTipologia).slice(0, 60);
  // _ktName NON viene più salvato (legacy sostituito da _kitName sopra)
  // Sponsor
  item.sponsor     = !!raw.sponsor;
  item.sponsorNome = item.sponsor ? String(raw.sponsorNome || '').slice(0, 120) : '';
  return item;
}

if (req.query?.action === 'inventory') {
  if (!session.isAuthenticated) return res.status(401).json({ success: false, message: 'Non autorizzato' });
  const sid    = session.societyId || '_default';
  const catKey = `society:${sid}:inventoryCategories`;

  // save-categories è per-società (non per-annata): gestito prima del check annataId
  if (req.method === 'POST' && String((req.body && req.body.act) || '') === 'save-categories') {
    if (!canInventoryCat(session.role)) return res.status(403).json({ success: false, message: 'Solo admin o dirigente' });
    let cats = (req.body && req.body.categories) || [];
    if (!Array.isArray(cats)) cats = [];
    cats = cats.map(c => String(c).trim().slice(0, 80)).filter(c => c && !INV_DEFAULT_CATS.includes(c)).slice(0, 20);
    await kv.set(catKey, cats);
    return res.status(200).json({ success: true, categories: [...INV_DEFAULT_CATS, ...cats] });
  }

  // Tutte le altre operazioni richiedono annataId
  if (!annataId || !isValidId(annataId)) return res.status(400).json({ success: false, message: 'annataId mancante' });
  const invKey = `society:${sid}:inventory:${annataId}`;

  if (req.method === 'GET') {
    const [items, customCats] = await Promise.all([kv.get(invKey), kv.get(catKey)]);
    const cats = [...INV_DEFAULT_CATS, ...((Array.isArray(customCats) ? customCats : []).filter(c => !INV_DEFAULT_CATS.includes(c)))];
    return res.status(200).json({ success: true, items: Array.isArray(items) ? items : [], categories: cats });
  }

  if (req.method === 'POST') {
    if (!canInventory(session.role)) return res.status(403).json({ success: false, message: 'Permesso negato' });
    const act = String((req.body && req.body.act) || '');

    if (act === 'upsert') {
      const item = sanitizeInvItem(req.body.item || {});
      let items = (await kv.get(invKey)) || [];
      if (!Array.isArray(items)) items = [];
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) items[idx] = item; else items.push(item);
      await kv.set(invKey, items);
      return res.status(200).json({ success: true, item });
    }

    // Inserisce più voci in una sola chiamata (importa da Materiale)
    if (act === 'upsert-many') {
      let rawItems = (req.body && Array.isArray(req.body.items)) ? req.body.items : [];
      rawItems = rawItems.slice(0, 300);
      const sanitized = rawItems.map(sanitizeInvItem);
      let items = (await kv.get(invKey)) || [];
      if (!Array.isArray(items)) items = [];
      // Replace per kit: se l'import contiene item di un kit (_kitName), rimuovo
      // PRIMA tutti gli item esistenti di quei kit, così re-importare non duplica.
      const importedKits = new Set(sanitized.map(i => i._kitName).filter(Boolean));
      if (importedKits.size) {
        items = items.filter(i => !(i._kitName && importedKits.has(i._kitName)));
      }
      sanitized.forEach(item => {
        const idx = item.id ? items.findIndex(i => i.id === item.id) : -1;
        if (idx >= 0) items[idx] = item; else items.push(item);
      });
      await kv.set(invKey, items);
      return res.status(200).json({ success: true, count: sanitized.length });
    }

    // Salva un intero kit (array di voci) in una sola chiamata — replace atomico del set
    if (act === 'upsert-kit') {
      let rawItems = (req.body && Array.isArray(req.body.items)) ? req.body.items : [];
      rawItems = rawItems.slice(0, 100); // max 100 voci per kit
      const sanitized = rawItems.map(sanitizeInvItem);
      // kitName = nome VECCHIO da rimuovere; newKitName = nome NUOVO da assegnare (rinomina)
      // Se newKitName non è presente, il kit mantiene lo stesso nome.
      const kitName    = String((req.body && req.body.kitName)    || '').slice(0, 80) || null;
      const newKitName = String((req.body && req.body.newKitName) || '').slice(0, 80) || kitName;
      // Se il client ha inviato newKitName diverso da kitName, aggiorna _kitName su tutti i nuovi item
      if (newKitName && newKitName !== kitName) {
        sanitized.forEach(it => { if (it._kitName) it._kitName = newKitName; });
      }
      // id espliciti da rimuovere (passati dal client per evitare orfani/duplicati)
      const removeIds = new Set((Array.isArray(req.body?.removeIds) ? req.body.removeIds : [])
                                  .map(x => String(x)));
      let items = (await kv.get(invKey)) || [];
      if (!Array.isArray(items)) items = [];
      // Replace atomico: rimuove gli item del kit ORIGINALE (per nome e legacy _ktName) + id espliciti
      if (kitName) {
        items = items.filter(i => i._kitName !== kitName && i._ktName !== kitName);
      }
      if (removeIds.size) {
        items = items.filter(i => !removeIds.has(String(i.id)));
      }
      items = items.concat(sanitized);
      await kv.set(invKey, items);
      return res.status(200).json({ success: true, count: sanitized.length });
    }

    if (act === 'delete') {
      const id = String((req.body && req.body.id) || '').replace(/[^a-z0-9_-]/gi, '');
      if (!id) return res.status(400).json({ success: false, message: 'id mancante' });
      let items = (await kv.get(invKey)) || [];
      if (!Array.isArray(items)) items = [];
      items = items.filter(i => i.id !== id);
      await kv.set(invKey, items);
      return res.status(200).json({ success: true });
    }

    // Rimuove i duplicati: per gli item con _kitName+_kitNum tiene il primo che
    // ha una taglia valorizzata (o il primo in assoluto). Gli item senza _kitNum
    // (scorte/mancanti/voci singole) non vengono toccati.
    if (act === 'dedup-kit') {
      let items = (await kv.get(invKey)) || [];
      if (!Array.isArray(items)) items = [];
      // Prima passata: normalizza _ktName (legacy) → _kitName su tutti gli item
      items = items.map(it => {
        if (!it._kitName && it._ktName) {
          const clone = { ...it, _kitName: it._ktName };
          delete clone._ktName;
          return clone;
        }
        return it;
      });
      // Seconda passata: deuplica per _kitName+_kitNum (tieni quello con taglia)
      const seen = new Map();
      const result = [];
      let removed = 0;
      items.forEach(it => {
        if (it._kitName && it._kitNum != null && !it._kitExtra) {
          const key = it._kitName + '||' + it._kitNum;
          if (!seen.has(key)) {
            seen.set(key, result.length);
            result.push(it);
          } else {
            const idx = seen.get(key);
            if (!result[idx].taglia && it.taglia) result[idx] = it;
            removed++;
          }
        } else {
          result.push(it);
        }
      });
      await kv.set(invKey, result);
      return res.status(200).json({ success: true, removed });
    }

    if (act === 'delete-kit') {
      const kitName = String((req.body && req.body.kitName) || '').slice(0, 80);
      if (!kitName) return res.status(400).json({ success: false, message: 'kitName mancante' });
      let items = (await kv.get(invKey)) || [];
      if (!Array.isArray(items)) items = [];
      const before = items.length;
      items = items.filter(i => i._kitName !== kitName && i._ktName !== kitName);
      await kv.set(invKey, items);
      return res.status(200).json({ success: true, deleted: before - items.length });
    }

    if (act === 'delete-cat') {
      const categoria = String((req.body && req.body.categoria) || '').slice(0, 80);
      if (!categoria) return res.status(400).json({ success: false, message: 'categoria mancante' });
      let items = (await kv.get(invKey)) || [];
      if (!Array.isArray(items)) items = [];
      const before = items.length;
      items = items.filter(i => (i.categoria || 'Altro') !== categoria);
      await kv.set(invKey, items);
      return res.status(200).json({ success: true, deleted: before - items.length });
    }

    // Copia struttura inventario in un'altra annata (solo admin)
    if (act === 'template-copy') {
      if (String(session.role || '').toLowerCase() !== 'admin') {
        return res.status(403).json({ success: false, message: 'Solo admin' });
      }
      const destAnnataId = String(req.headers['x-dest-annata-id'] || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
      if (!destAnnataId) return res.status(400).json({ success: false, message: 'annata destinazione mancante' });
      let rawItems = (req.body && Array.isArray(req.body.items)) ? req.body.items : [];
      rawItems = rawItems.slice(0, 200);
      const destKey = `society:${sid}:inventory:${destAnnataId}`;
      let destItems = (await kv.get(destKey)) || [];
      if (!Array.isArray(destItems)) destItems = [];
      const existingNames = new Set(destItems.map(i => (i.categoria || '') + '|' + (i.nome || '')));
      let added = 0;
      rawItems.forEach(raw => {
        const item = sanitizeInvItem(raw); // genera nuovo id, azzera condizione/note
        item.quantita  = 0;
        item.condizione = 'buono';
        item.note       = '';
        const key = (item.categoria || '') + '|' + (item.nome || '');
        if (!existingNames.has(key)) {
          destItems.push(item);
          existingNames.add(key);
          added++;
        }
      });
      await kv.set(destKey, destItems);
      return res.status(200).json({ success: true, added });
    }

    return res.status(400).json({ success: false, message: 'act non valido' });
  }
}

// ── CAMBIO STAGIONE: reset + archivio ────────────────────────────────────────
// Le 4 categorie "di stagione" (risultati partite, presenze, hall of fame,
// calendario) vengono copiate in annate:<id>:archive[<label>] con archivedAt
// (timer di conservazione 1 anno), poi le chiavi correnti vengono AZZERATE.
// La rosa atleti, pagamenti, certificati e GPS restano intatti.
// Le valutazioni (evaluations) includono il campo presenza-allenamento → il
// report presenze allenamenti legge da lì, quindi vanno archiviate/azzerate
// insieme; trainingSessions sono gli allenamenti a calendario.
// Niente nuovo file serverless: tutto passa da data.js (limite Hobby 12 route).
const SEASON_KEYS = ['matchResults', 'calendarResponses', 'awards', 'calendarEvents', 'evaluations', 'trainingSessions'];

if (req.query?.action === 'season-reset' && req.method === 'POST') {
  if (!session.isAuthenticated || !canSeasonReset(session.role)) {
    return res.status(403).json({ success: false, message: 'Permesso negato: solo Admin, Dirigente (D-L1) e Coach L1 (C-L1)' });
  }
  if (!annataId || !isValidId(annataId)) {
    return res.status(400).json({ success: false, message: 'annataId non valido' });
  }
  // Etichetta stagione che si sta chiudendo (es. "2025-26"). Validata e usata
  // come chiave dell'archivio: deve essere leggibile e priva di caratteri strani.
  const label = String((req.body && req.body.label) || '').trim();
  if (!label || !/^[\w .\-\/]{1,40}$/.test(label)) {
    return res.status(400).json({ success: false, message: 'Etichetta stagione non valida (es. "2025-26")' });
  }
  try {
    const prefix = `annate:${annataId}`;
    const sid = session.societyId || '_default';
    // Snapshot delle categorie correnti
    const snapshot = {};
    for (const k of SEASON_KEYS) {
      snapshot[k] = (await kv.get(`${prefix}:${k}`)) || {};
    }
    // Includi anche inventario nel snapshot (archiviato per società+annata)
    snapshot['inventory'] = (await kv.get(`society:${sid}:inventory:${annataId}`)) || [];
    const archive = (await kv.get(`${prefix}:archive`)) || {};
    if (archive[label]) {
      return res.status(409).json({ success: false, message: `Esiste già un archivio "${label}". Usa un'etichetta diversa.` });
    }
    archive[label] = {
      label,
      archivedAt: new Date().toISOString(),
      data: snapshot,
    };
    await kv.set(`${prefix}:archive`, archive);
    // Azzera le categorie correnti (la nuova stagione parte pulita)
    const writes = SEASON_KEYS.map(k => kv.set(`${prefix}:${k}`, {}));
    writes.push(kv.set(`society:${sid}:inventory:${annataId}`, []));
    await Promise.all(writes);
    return res.status(200).json({ success: true, label, archivedAt: archive[label].archivedAt });
  } catch (e) {
    console.error('[season-reset]', e?.message || e);
    return res.status(500).json({ success: false, message: 'Errore reset stagione' });
  }
}

// ── CAMBIO STAGIONE: lettura archivi (sola lettura) ──────────────────────────
// ?action=season-archive            → lista archivi (label, date, conteggi)
// ?action=season-archive&label=...  → dettaglio completo di una stagione
if (req.query?.action === 'season-archive' && req.method === 'GET') {
  if (!session.isAuthenticated) {
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  }
  if (!annataId || !isValidId(annataId)) {
    return res.status(400).json({ success: false, message: 'annataId non valido' });
  }
  const RETENTION_DAYS = 365, DAY = 24 * 60 * 60 * 1000;
  const archive = (await kv.get(`annate:${annataId}:archive`)) || {};
  const wantLabel = String(req.query.label || '').trim();
  if (wantLabel) {
    const entry = archive[wantLabel];
    if (!entry) return res.status(404).json({ success: false, message: 'Archivio non trovato' });
    return res.status(200).json({ success: true, archive: entry });
  }
  // Lista sintetica: per ogni stagione, conteggi + data prevista cancellazione
  const list = Object.values(archive).map(entry => {
    const d = entry.data || {};
    const archMs = new Date(entry.archivedAt).getTime();
    const expiresAt = isNaN(archMs) ? null : new Date(archMs + RETENTION_DAYS * DAY).toISOString();
    return {
      label: entry.label,
      archivedAt: entry.archivedAt,
      expiresAt,
      counts: {
        matchResults: d.matchResults ? Object.keys(d.matchResults).length : 0,
        calendarResponses: d.calendarResponses ? Object.keys(d.calendarResponses).length : 0,
        awards: d.awards ? Object.keys(d.awards).length : 0,
        calendarEvents: d.calendarEvents ? Object.keys(d.calendarEvents).length : 0,
        evaluations: d.evaluations ? Object.keys(d.evaluations).length : 0,
        trainingSessions: d.trainingSessions ? Object.keys(d.trainingSessions).length : 0,
      },
    };
  }).sort((a, b) => String(b.archivedAt).localeCompare(String(a.archivedAt)));
  return res.status(200).json({ success: true, archives: list });
}

// ── PASSWORD INDIVIDUAL: cambio sicuro (verifica vecchia lato server) ────────
// Per cambiare serve conoscere la password ATTUALE: il server la verifica e solo
// allora salva la nuova. La password attuale non viene MAI restituita al client
// da questo endpoint. Solo admin autenticato.
if (req.query?.action === 'change-individual-pwd' && req.method === 'POST') {
  if (!session.isAuthenticated || String(session.role).toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Permesso negato' });
  }
  if (!annataId || !isValidId(annataId)) {
    return res.status(400).json({ success: false, message: 'annataId non valido' });
  }
  const oldPassword = String((req.body && req.body.oldPassword) || '');
  const newPassword = String((req.body && req.body.newPassword) || '').trim();
  if (!newPassword) {
    return res.status(400).json({ success: false, message: 'Nuova password mancante' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ success: false, message: 'La nuova password deve avere almeno 4 caratteri' });
  }
  // Password attuale: quella salvata, o '1234' di default se mai impostata.
  const current = (await kv.get(`annate:${annataId}:individualPassword`)) || '1234';
  if (oldPassword !== current) {
    return res.status(401).json({ success: false, message: 'Password attuale errata' });
  }
  await kv.set(`annate:${annataId}:individualPassword`, newPassword);
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
  const payload = JSON.stringify({ title: title || 'Sport Monitoring', body: body || '', url: url || '/' });
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, payload)));
  const valid = subs.filter((_, i) => !(results[i].status === 'rejected' && results[i].reason?.statusCode === 410));
  if (valid.length !== subs.length) await kv.set(`push:annata:${aid}:subs`, valid);
  return res.status(200).json({ success: true, sent: results.filter(r => r.status === 'fulfilled').length });
}

// ── PUSH: cron reminder (chiamato da Vercel Cron ogni mattina) ─────────────
if (req.query?.action === 'cron-remind' && req.method === 'GET') {
  // S7: CRON_SECRET obbligatorio — niente più default hardcoded debole.
  // Se manca l'env var, l'endpoint è disabilitato (fail-closed) invece di
  // accettare un secret prevedibile.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron-remind] CRON_SECRET non configurato — endpoint disabilitato');
    return res.status(503).json({ success: false, message: 'Cron non configurato' });
  }
  // S8: il secret si accetta SOLO dall'header Authorization (canale usato da
  // Vercel Cron). Niente più ?token= in query string, che finirebbe nei log
  // di accesso / cronologia URL.
  const authOk = req.headers['authorization'] === `Bearer ${secret}`;
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
        title: '📅 Promemoria Sport Monitoring',
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

          const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
          const visitaDue  = athlete.scadenzaVisita === visitaAlertStr;
          const tesseraDue = athlete.scadenzaTessera === tesseraAlertStr;

          // ── Email (richiede almeno un indirizzo) ────────────────────────
          const emails = [];
          if (athlete.email) emails.push(athlete.email);
          if (athlete.parents?.parent1?.email) emails.push(athlete.parents.parent1.email);
          if (athlete.parents?.parent2?.email && athlete.parents.parent2.email !== athlete.parents?.parent1?.email) emails.push(athlete.parents.parent2.email);
          if (!emails.length) continue;

          if (visitaDue) {
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
          if (tesseraDue) {
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

  // ── R3: gestione link certificato medico (dato sanitario minore) ─────────
  // Il genitore carica il link Drive del certificato (athleteDocs[id].certificato).
  // Per limitare l'esposizione: dopo 60gg dall'upload il LINK viene RIMOSSO
  // (resta uploadedAt/nota → "consegnato il [data], link rimosso"). Qualche
  // giorno prima parte un promemoria alla società per scaricarlo in tempo.
  try {
    const REMOVE_DAYS = 60;          // dopo quanti giorni si azzera il link
    const REMIND_DAYS_BEFORE = 7;    // promemoria N giorni prima della rimozione
    const nowMs = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const { createTransport: ctR3 } = await import('nodemailer');
    const transR3 = ctR3({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } });

    const licKeysR3 = await kv.smembers('licenze:index');
    const annateR3 = (await kv.get('annate:list')) || [];

    for (const licKey of (licKeysR3 || [])) {
      const lic = await kv.get(`licenze:${licKey}`);
      if (!lic || !lic.active) continue;
      const socAnnate = annateR3.filter(a => !a.societyId || a.societyId === lic.societyId);
      const inScadenza = []; // certificati il cui link sta per essere rimosso

      for (const annata of socAnnate) {
        const docsKey = `annate:${annata.id}:athleteDocs`;
        const allDocs = await kv.get(docsKey);
        if (!allDocs || typeof allDocs !== 'object') continue;
        let dirty = false;

        for (const aid of Object.keys(allDocs)) {
          const cert = allDocs[aid] && allDocs[aid].certificato;
          if (!cert || !cert.url || !cert.uploadedAt) continue;
          const ageMs = nowMs - new Date(cert.uploadedAt).getTime();
          if (isNaN(ageMs)) continue;
          const ageDays = ageMs / DAY;

          if (ageDays >= REMOVE_DAYS) {
            // Rimuove SOLO il link, conserva la prova di consegna.
            cert.url = '';
            cert.linkRemovedAt = new Date().toISOString();
            dirty = true;
          } else if (ageDays >= (REMOVE_DAYS - REMIND_DAYS_BEFORE) && !cert.remindSent) {
            // Promemoria una sola volta (flag remindSent).
            const giorniRimasti = Math.max(1, Math.ceil(REMOVE_DAYS - ageDays));
            inScadenza.push({ aid, giorni: giorniRimasti });
            cert.remindSent = true;
            dirty = true;
          }
        }
        if (dirty) { try { await kv.set(docsKey, allDocs); } catch(e) { console.error('[cron-r3] save athleteDocs:', e.message); } }
      }

      // Un solo promemoria raggruppato per società (se ci sono certificati in scadenza).
      if (inScadenza.length && lic.email) {
        try {
          await transR3.sendMail({
            from: `"Sport Monitoring" <${process.env.GMAIL_USER}>`,
            to: lic.email,
            subject: `📄 Certificati medici da scaricare (${inScadenza.length})`,
            html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f1f5f9;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="text-align:center;margin-bottom:16px;"><span style="font-size:2rem;">⚽</span>
  <h2 style="margin:8px 0 4px;color:#0f172a;font-size:1.15rem;">Sport Monitoring</h2>
  <div style="color:#64748b;font-size:0.85rem;">${lic.societyName || ''}</div></div>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;">
  <p style="color:#1e293b;">Ci sono <strong>${inScadenza.length} certificati medici</strong> il cui link di download verrà <strong>rimosso a breve</strong> (per tutela dei dati sanitari dei minori).</p>
  <p style="color:#374151;font-size:0.9rem;">Accedi all'app e <strong>scarica i certificati</strong> ancora disponibili prima della rimozione del link.</p>
  <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;padding:12px 16px;margin:16px 0;color:#92400e;font-size:0.85rem;">Dopo la rimozione resterà solo la data di consegna; per un nuovo download dovrai richiedere il link al genitore.</div>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
  <p style="color:#94a3b8;font-size:0.72rem;text-align:center;">Messaggio automatico da Sport Monitoring. Non rispondere.</p>
</div></body></html>`
          });
        } catch(e) { console.error('[cron-r3] email promemoria:', e.message); }
      }
    }
  } catch(r3Err) {
    console.error('❌ Errore R3 certificati:', r3Err.message);
  }

  // ── R2: auto-oblio atleti archiviati (GDPR art. 17 — limitazione conservazione)
  // Un atleta archiviato (archived:true + archivedAt) viene CANCELLATO in modo
  // completo dopo RETENTION_DAYS dall'archiviazione. I backup giornalieri si
  // auto-smaltiscono con la rotazione già attiva → entro pochi giorni il dato
  // sparisce anche da lì. Viene registrata una riga di log SENZA dati personali.
  try {
    const RETENTION_DAYS = 365;        // 12 mesi: copre la stagione + margine
    const nowMsRet = Date.now();
    const DAY_RET = 24 * 60 * 60 * 1000;
    const annateRet = (await kv.get('annate:list')) || [];

    for (const annata of annateRet) {
      const prefix = `annate:${annata.id}`;
      const athletesRet = (await kv.get(`${prefix}:athletes`)) || [];
      const daCancellare = athletesRet.filter(a =>
        a && a.archived && a.archivedAt &&
        !isNaN(new Date(a.archivedAt).getTime()) &&
        (nowMsRet - new Date(a.archivedAt).getTime()) >= RETENTION_DAYS * DAY_RET
      );
      let purged = 0;
      for (const a of daCancellare) {
        try {
          if (await purgeAthlete(prefix, a.id)) purged++;
        } catch(e) { console.error('[cron-retention] purge:', e.message); }
      }
      if (purged) {
        await logRetentionPurge(annata.id, purged);
        console.log(`🗑️ [retention] annata ${annata.id}: ${purged} atleti cancellati (>${RETENTION_DAYS}gg in archivio)`);
      }
    }
  } catch(retErr) {
    console.error('❌ Errore R2 retention:', retErr.message);
  }

  // ── CAMBIO STAGIONE: retention archivi (preavviso 15gg + cancellazione 365gg)
  // Ogni archivio di stagione (annate:<id>:archive[<label>]) vive 1 anno dalla
  // sua data di archiviazione. A 15 giorni dalla scadenza manda UNA push di
  // preavviso (flag preavvisoInviato); a scadenza cancella l'archivio, manda una
  // push di conferma e registra il log GDPR (senza dati personali). Entrambe le
  // notifiche citano stagione + annata + cosa contiene → autoesplicative.
  try {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const ARCH_RETENTION_DAYS = 365;
      const PREAVVISO_DAYS = 15;
      const DAY_ARCH = 24 * 60 * 60 * 1000;
      const nowMsArch = Date.now();
      const annateListArch = (await kv.get('annate:list')) || [];
      const { default: webpushA } = await import('web-push');
      webpushA.setVapidDetails(
        `mailto:${process.env.VAPID_EMAIL || 'admin@gosport.app'}`,
        process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY
      );

      const sendArchPush = async (aid, title, body) => {
        const subs = (await kv.get(`push:annata:${aid}:subs`)) || [];
        if (!subs.length) return 0;
        const payload = JSON.stringify({ title, body, url: '/' });
        const r = await Promise.allSettled(subs.map(s => webpushA.sendNotification(s, payload)));
        const valid = subs.filter((_, i) => !(r[i].status === 'rejected' && r[i].reason?.statusCode === 410));
        if (valid.length !== subs.length) await kv.set(`push:annata:${aid}:subs`, valid);
        return r.filter(x => x.status === 'fulfilled').length;
      };

      for (const annata of annateListArch) {
        const aid = annata.id;
        const nomeAnnata = annata.nome || annata.label || annata.name || `annata ${aid}`;
        const archive = (await kv.get(`annate:${aid}:archive`)) || {};
        let dirty = false;

        for (const label of Object.keys(archive)) {
          const entry = archive[label];
          const archMs = entry && entry.archivedAt ? new Date(entry.archivedAt).getTime() : NaN;
          if (isNaN(archMs)) continue;
          const ageMs = nowMsArch - archMs;
          const expireMs = ARCH_RETENTION_DAYS * DAY_ARCH;

          // 1) SCADUTO → cancella + push conferma + log GDPR
          if (ageMs >= expireMs) {
            delete archive[label];
            dirty = true;
            totalSent += await sendArchPush(aid,
              '🗂️ Archivio stagione eliminato',
              `La stagione ${label} (${nomeAnnata}) è stata cancellata automaticamente: era in archivio da oltre 1 anno (conservazione GDPR scaduta). Rimossi: risultati partite, presenze, hall of fame e calendario.`
            );
            await logRetentionPurge(aid, 1, { kind: 'season', label });
            console.log(`🗑️ [retention-archivio] annata ${aid}: archivio "${label}" cancellato (>${ARCH_RETENTION_DAYS}gg)`);
            continue;
          }

          // 2) IN SCADENZA tra <=15gg → push preavviso UNA volta sola
          const giorniRimasti = Math.ceil((expireMs - ageMs) / DAY_ARCH);
          if (giorniRimasti <= PREAVVISO_DAYS && !entry.preavvisoInviato) {
            totalSent += await sendArchPush(aid,
              '⏳ Archivio stagione in scadenza',
              `La stagione ${label} (${nomeAnnata}) sarà cancellata tra ${giorniRimasti} ${giorniRimasti === 1 ? 'giorno' : 'giorni'}. Contiene risultati partite, presenze, hall of fame e calendario. Se vuoi conservarla, aprila in "Stagioni passate" e scarica il backup prima di quella data.`
            );
            entry.preavvisoInviato = true;
            dirty = true;
            console.log(`⏳ [retention-archivio] annata ${aid}: preavviso archivio "${label}" (${giorniRimasti}gg)`);
          }
        }

        if (dirty) await kv.set(`annate:${aid}:archive`, archive);
      }
    }
  } catch(archErr) {
    console.error('❌ Errore retention archivi stagione:', archErr.message);
  }

  // ── Alert 57h prima delle PARTITE (campionato/tornei) ────────────────────
  // Rete di sicurezza per la gara: il promemoria del lunedì può essere troppo
  // lontano da una partita del weekend. Gira ogni giorno (cron-remind 6:00 UTC):
  // beccando la finestra ~48-72h prende la partita di domenica al run del venerdì.
  try {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const MATCH_TYPES = ['Partita', 'Campionato', 'Torneo', 'Finale', 'Semifinale'];
      const nowMs = Date.now();
      const H48 = 48 * 60 * 60 * 1000, H72 = 72 * 60 * 60 * 1000;
      const { default: wp } = await import('web-push');
      wp.setVapidDetails(`mailto:${process.env.VAPID_EMAIL || 'admin@gosport.app'}`, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

      const annateList2 = (await kv.get('push:annate')) || [];
      for (const aid of annateList2) {
        const subs = (await kv.get(`push:annata:${aid}:subs`)) || [];
        if (!subs.length) continue;
        const events = (await kv.get(`annate:${aid}:calendarEvents`)) || {};
        for (const [dateStr, ev] of Object.entries(events)) {
          if (!ev || !MATCH_TYPES.includes(ev.type)) continue;
          // Data+ora evento (mezzogiorno se manca l'ora, per stare nella finestra)
          const evMs = new Date(`${dateStr}T${ev.time && /^\d{1,2}:\d{2}/.test(ev.time) ? ev.time.slice(0,5) : '12:00'}:00`).getTime();
          if (isNaN(evMs)) continue;
          const delta = evMs - nowMs;
          if (delta < H48 || delta > H72) continue; // solo finestra ~48-72h
          const giorno = new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' });
          const payload = JSON.stringify({
            title: '⚽ Partita in arrivo — conferma la presenza',
            body: `${ev.type}${ev.note ? ' ' + ev.note : ''} ${giorno}${ev.time ? ' ore ' + ev.time : ''}. Segnala subito eventuali assenze!`,
            url: '/calendario.html'
          });
          const r = await Promise.allSettled(subs.map(s => wp.sendNotification(s, payload)));
          const valid = subs.filter((_, i) => !(r[i].status === 'rejected' && r[i].reason?.statusCode === 410));
          if (valid.length !== subs.length) await kv.set(`push:annata:${aid}:subs`, valid);
          totalSent += r.filter(x => x.status === 'fulfilled').length;
        }
      }
    }
  } catch(matchErr) {
    console.error('❌ Errore alert 57h partita:', matchErr.message);
  }

  return res.status(200).json({ success: true, totalSent });
}

// ── PRESENCE-REMIND: promemoria settimanale "segnala le assenze" ───────────
// Chiamato dai cron del LUNEDÌ (slot=morning 07:00 UTC, slot=evening 18:00 UTC).
// Manda una push a tutta l'annata SOLO se ci sono eventi nella settimana
// corrente (lun-dom). Mattina = gentile, sera = insistente. Spinge i genitori
// a segnalare le assenze prima che il coach prepari le convocazioni.
if (req.query?.action === 'cron-presence-remind' && req.method === 'GET') {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ success: false, message: 'Cron non configurato' });
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  }

  const slot = req.query.slot === 'evening' ? 'evening' : 'morning';

  // Finestra settimana corrente (lun-dom) in date ISO YYYY-MM-DD.
  const now = new Date();
  const dow = now.getUTCDay();            // 0=dom..6=sab
  const daysSinceMon = (dow + 6) % 7;     // lun=0
  const monday = new Date(now); monday.setUTCDate(now.getUTCDate() - daysSinceMon);
  const weekDates = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setUTCDate(monday.getUTCDate() + i);
    weekDates.add(d.toISOString().split('T')[0]);
  }

  let totalSent = 0, annateNotified = 0;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const { default: webpush } = await import('web-push');
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@gosport.app'}`,
      process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY
    );

    const payload = JSON.stringify(slot === 'evening'
      ? { title: '⚠️ ULTIMO PROMEMORIA della settimana', body: 'Hai segnalato le assenze? Gli allenatori stanno preparando le convocazioni.', url: '/calendario.html' }
      : { title: '📅 Nuova settimana!', body: 'Controlla gli impegni e segnala eventuali assenze ad allenamenti e partite.', url: '/calendario.html' }
    );

    const annateList = (await kv.get('push:annate')) || [];
    for (const aid of annateList) {
      const subs = (await kv.get(`push:annata:${aid}:subs`)) || [];
      if (!subs.length) continue;
      // SOLO se ci sono eventi in questa settimana per l'annata.
      const events = (await kv.get(`annate:${aid}:calendarEvents`)) || {};
      const hasEventThisWeek = Object.keys(events).some(dateStr => weekDates.has(dateStr));
      if (!hasEventThisWeek) continue;

      const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, payload)));
      const valid = subs.filter((_, i) => !(results[i].status === 'rejected' && results[i].reason?.statusCode === 410));
      if (valid.length !== subs.length) await kv.set(`push:annata:${aid}:subs`, valid);
      totalSent += results.filter(r => r.status === 'fulfilled').length;
      annateNotified++;
    }
  }
  console.log(`✅ cron-presence-remind (${slot}): ${totalSent} push a ${annateNotified} annate`);
  return res.status(200).json({ success: true, slot, totalSent, annateNotified });
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

// ── BACKUP-STORE: snapshot completo su Vercel Blob (privato) ─────────────
// Chiamato dalla GitHub Action notturna. Sostituisce il vecchio backup che
// committava i .json nel repo (dati di minori in git → rischio GDPR).
// Lo snapshot completo viene gzippato e caricato su Blob come
// backups/YYYY-MM-DD.json.gz, poi si ruotano i blob più vecchi di RETENTION
// giorni. Protetto da BACKUP_SECRET (header o query). Auth Blob via OIDC.
if (req.query?.action === 'backup-store') {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const tok = req.headers['x-backup-token'] || req.query.token;
  if (!process.env.BACKUP_SECRET || tok !== process.env.BACKUP_SECRET) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const scanAll = async (pattern) => {
    const keys = []; let cursor = 0;
    do {
      const [next, batch] = await kv.scan(cursor, { match: pattern, count: 200 });
      cursor = parseInt(next, 10); keys.push(...batch);
    } while (cursor !== 0);
    return keys;
  };
  const mgetAll = async (keys) => {
    const out = {};
    for (let i = 0; i < keys.length; i += 50) {
      const batch = keys.slice(i, i + 50);
      const values = await kv.mget(...batch);
      batch.forEach((k, idx) => { if (values[idx] !== null) out[k] = values[idx]; });
    }
    return out;
  };

  try {
    // Export completo (escludendo chiavi volatili), come il backup superadmin.
    const allKeys = (await scanAll('*')).filter(k =>
      !k.startsWith('rl:') && !k.startsWith('session:') && !k.startsWith('ratelimit:')
    );
    const exportData = await mgetAll(allKeys);
    const dateStr = new Date().toISOString();
    const payload = JSON.stringify({
      exportedAt: dateStr, scope: 'completo',
      keysCount: Object.keys(exportData).length, data: exportData
    });

    // Comprimi (gzip): lo snapshot non compresso è ~8MB, gzip lo riduce molto.
    const gz = gzipSync(Buffer.from(payload, 'utf8'));

    const { put, list, del } = await import('@vercel/blob');
    const RETENTION_DAYS = 14;
    const fileName = `backups/${dateStr.slice(0, 10)}.json.gz`;

    // La RISERVATEZZA dipende dallo STORE (creato come Private): qualunque blob
    // al suo interno richiede comunque un token per essere letto, anche se
    // put() viene chiamato con access:'public'. Il parametro `access` è solo
    // un'etichetta richiesta dal SDK e varia tra versioni (le più vecchie
    // accettano solo 'public'). Proviamo 'private' e, se il SDK lo rifiuta,
    // ricadiamo su 'public' — la protezione resta garantita dallo store Private.
    const putOpts = { contentType: 'application/gzip', addRandomSuffix: false, allowOverwrite: true };
    let blob;
    try {
      blob = await put(fileName, gz, { ...putOpts, access: 'private' });
    } catch (e) {
      if (/access must be/i.test(String(e?.message || ''))) {
        blob = await put(fileName, gz, { ...putOpts, access: 'public' });
      } else {
        throw e;
      }
    }

    // Rotazione: elimina i blob più vecchi di RETENTION_DAYS.
    let removed = 0;
    try {
      const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const { blobs } = await list({ prefix: 'backups/' });
      const toDelete = blobs
        .filter(b => new Date(b.uploadedAt).getTime() < cutoff)
        .map(b => b.url);
      if (toDelete.length) { await del(toDelete); removed = toDelete.length; }
    } catch (e) { console.warn('[backup-store] rotazione fallita:', e.message); }

    console.log(`✅ backup-store: ${fileName} (${gz.length} byte gz, ${Object.keys(exportData).length} chiavi), rimossi ${removed} vecchi`);
    return res.status(200).json({
      success: true, file: fileName, bytesGz: gz.length,
      keysCount: Object.keys(exportData).length, rotated: removed, url: blob.url
    });
  } catch (e) {
    console.error('❌ backup-store error:', e);
    return res.status(500).json({ error: 'Backup fallito', detail: e.message });
  }
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

    // Account della società. Includo anche quelli senza societyId (legacy/orfani),
    // coerente col filtro delle annate sopra, per non perderli dal backup.
    const allUsers = (await kv.get('auth:users')) || [];
    const socUsers = allUsers.filter(u => !u.societyId || u.societyId === sid);
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

  // ── Redis: INFO + scan locale (scanKeys ridefinita localmente) ──────────
  async function monScanKeys(pattern) {
    const keys = [];
    let cursor = 0;
    do {
      const [next, batch] = await kv.scan(cursor, { match: pattern, count: 200 });
      cursor = parseInt(next, 10);
      keys.push(...batch);
    } while (cursor !== 0);
    return keys;
  }

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

    const appKeys = (await monScanKeys('*')).filter(k =>
      !k.startsWith('rl:') && !k.startsWith('session:') && !k.startsWith('ratelimit:')
    );
    const maxmem = parseInt(info.maxmemory || 0) || 268435456;
    out.redis = {
      keys_total: dbsizeJson.result || 0,
      keys_app: appKeys.length,
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

  // ── Vercel: deployments + prova Storage API per comandi Redis mensili ────
  const vToken = process.env.VERCEL_TOKEN;
  if (vToken) {
    try {
      const teamId = process.env.VERCEL_TEAM_ID || 'team_N703yzP0O3hsuLT1plfZhJ1S';
      const hdrV = { Authorization: `Bearer ${vToken}` };
      const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const [rDeps, rStores] = await Promise.all([
        fetch(`https://api.vercel.com/v6/deployments?teamId=${teamId}&since=${since30}&limit=100`, { headers: hdrV }),
        fetch(`https://api.vercel.com/v1/storage/stores?teamId=${teamId}`, { headers: hdrV })
      ]);
      const [dataDeps, dataStores] = await Promise.all([rDeps.json(), rStores.json()]);

      const deps = dataDeps.deployments || [];
      const ok   = deps.filter(d => d.state === 'READY').length;
      const fail = deps.filter(d => d.state === 'ERROR').length;
      const last = deps[0] || null;

      // Cerca il KV store Upstash nella lista storage
      const stores = dataStores.stores || dataStores.data || [];
      const kvHost = (process.env.KV_REST_API_URL || process.env.UPSTASH_KV_REST_API_URL || '')
        .replace('https://', '').split('/')[0];
      const kvStore = stores.find(s => (s.dsn||s.url||'').includes(kvHost) || s.type === 'upstash-redis') || stores[0] || null;

      out.vercel = {
        total30: deps.length,
        ok30: ok,
        fail30: fail,
        lastDeploy: last ? { date: last.created, state: last.state, commit: last.meta?.githubCommitMessage?.split('\n')[0] || '' } : null,
        kvStore: kvStore ? {
          name: kvStore.name || kvStore.storeName || '—',
          commandsUsed: kvStore.commandsUsed || kvStore.monthly_request_count || kvStore.requestCount || null,
          commandsLimit: kvStore.commandsLimit || kvStore.max_monthly_request_count || 500000,
          storageUsed: kvStore.storageUsed || kvStore.used_memory || kvStore.dataSize || null,
          storageLimit: kvStore.storageLimit || kvStore.max_data_size || 268435456
        } : null,
        stores_raw_keys: stores.length ? Object.keys(stores[0]) : []
      };
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
  // GET: lettura (anche senza sessione) → usa l'header. POST (scrittura): la società
  // è SEMPRE quella della sessione, così un utente non può scrivere su un'altra società.
  const sid = resolveSocietyId(req, session);
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

// ── Impianti: campi e spogliatoi (solo Platinum — ruoli direttivo/dirigente/staff/admin + ruoli interni dashboard) ──
function canImpianti(role) {
  return ['admin','direttivo','dirigente','staff','societa_l1','societa_l3','dirigente_l1'].includes(String(role||'').toLowerCase());
}

// Isolamento società: per un utente autenticato la società è SEMPRE quella della
// sessione (server-side), mai l'header X-Society-Id che il client può falsificare.
// Impedisce che un utente di una società legga/scriva config impianti/alert di un'altra.
function resolveSocietyId(req, session) {
  if (session.isAuthenticated && session.societyId) return session.societyId;
  return String(req.headers['x-society-id'] || '').trim();
}

if (req.query?.action === 'impianti-annate-config') {
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  const sid = resolveSocietyId(req, session);
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
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
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  const sid = resolveSocietyId(req, session);
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
  const allAnnate = (await kv.get('annate:list')) || [];
  const societyAnnate = allAnnate.filter(a => !a.societyId || a.societyId === sid);
  const withCounts = await Promise.all(societyAnnate.map(async a => {
    const athletes = (await kv.get(`annate:${a.id}:athletes`)) || [];
    return { id: a.id, name: a.name || a.id, atletiCount: athletes.filter(x => !x.isGuest).length };
  }));
  return res.status(200).json({ success: true, annate: withCounts });
}

if (req.query?.action === 'impianti-config') {
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  const sid = resolveSocietyId(req, session);
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
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
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  const sid = resolveSocietyId(req, session);
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
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
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  const sid = resolveSocietyId(req, session);
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
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

// ── IMPIANTI: TORNEI (gestore tornei — eliminazione diretta, girone, ecc.) ───
// Un torneo è un oggetto { id, nome, formato, squadre[], partite[], config }.
// Tabellone e classifica si calcolano lato client in modo deterministico; qui
// si fa solo storage (upsert/delete) come per gli eventi. Stesso file (12/12).
if (req.query?.action === 'impianti-tornei') {
  if (!session.isAuthenticated || !canImpianti(session.role))
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  const sid = resolveSocietyId(req, session);
  if (!sid) return res.status(400).json({ success: false, message: 'societyId mancante' });
  if (req.method === 'GET') {
    const tornei = (await kv.get(`society:${sid}:impianti:tornei`)) || [];
    return res.status(200).json({ success: true, tornei });
  }
  if (req.method === 'POST') {
    const { torneo, deleteId } = req.body || {};
    let tornei = (await kv.get(`society:${sid}:impianti:tornei`)) || [];
    if (deleteId) {
      tornei = tornei.filter(t => t.id !== deleteId);
    } else if (torneo && torneo.id) {
      const idx = tornei.findIndex(t => t.id === torneo.id);
      if (idx >= 0) tornei[idx] = torneo; else tornei.push(torneo);
    }
    await kv.set(`society:${sid}:impianti:tornei`, tornei);
    return res.status(200).json({ success: true, tornei });
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
  const systemPrompt = `Sei un assistente esperto di pianificazione allenamenti per la piattaforma Sport Monitoring.
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
const teamName = (await kv.get('global:teamName')) || 'La mia squadra';
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

// ── Isolamento multi-società ────────────────────────────────────────────────
// Un utente autenticato può accedere solo alle annate della PROPRIA società.
// Impedisce di leggere/scrivere dati di un'altra società cambiando X-Annata-Id.
// I genitori (parentMode / calendarResponse) non hanno sessione → saltano il check.
if (session.isAuthenticated) {
const annateList = (await kv.get('annate:list')) || [];
const annataMeta = annateList.find(a => String(a.id) === annataId);
if (annataMeta) {
const annataSoc = annataMeta.societyId || null;
const userSoc = session.societyId || null;
if (annataSoc !== userSoc) {
console.warn(`⛔ Accesso annata negato: user=${session.username} soc=${userSoc} → annata=${annataId} soc=${annataSoc}`);
return res.status(403).json({ success: false, message: 'Accesso negato: annata di un\'altra società' });
}
}
// Annata non presente in annate:list (orfana): consentita — nessun dato cross-società da proteggere.
}

const prefix = `annate:${annataId}`;

// Nome squadra isolato per società: societyId dalla sessione (coach) o
// dall'annata (genitori senza sessione). Risolto una volta, usato nei GET.
let _tnSocietyId = session.societyId || null;
if (!_tnSocietyId) {
  try {
    const _al = (await kv.get('annate:list')) || [];
    const _am = _al.find(a => String(a.id) === annataId);
    _tnSocietyId = _am ? (_am.societyId || null) : null;
  } catch (e) { /* niente */ }
}
const resolvedTeamName = await resolveTeamName(_tnSocietyId);

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
const [calendarEvents, calendarResponses, convSettings, athletes, posts, globalPosts, documents, materiale, bachecaConfig, superadminBanners, convBg, convBg2, athleteDocs] = await Promise.all([
kv.get(`${prefix}:calendarEvents`),
kv.get(`${prefix}:calendarResponses`),
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
teamName: resolvedTeamName,
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
// GET pubblico per design: i genitori vedono il calendario gare dal link
// calendario senza login. Il societyId è validato (isValidId) e non enumerabile;
// dati a bassa sensibilità (calendario partite). La POST resta protetta (canWrite).
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
convBg, convBg2, posts, globalPosts, individualPassword,
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
teamName: resolvedTeamName,
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
