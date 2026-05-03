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
'Content-Type, X-Annata-Id, X-Auth-Session, X-Auth-User, X-User-Role, X-Society-Id');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

if (req.method === 'OPTIONS') return res.status(200).end();

try {
const session = getSessionInfo(req);

const rawAnnata = req.headers['x-annata-id'] || req.headers['X-Annata-Id'] || '';
const annataId = String(rawAnnata).split(',')[0].trim();

if (annataId && !isValidId(annataId)) {
return res.status(400).json({ success: false, message: 'Formato annataId non valido' });
}

// ── Senza annataId: dati globali / bacheca pubblica ──────────────────────
if (!annataId) {
if (req.method === 'GET') {
const globalPosts = (await kv.get('global:posts')) || [];
const teamName = (await kv.get('global:teamName')) || 'GO SPORT';
const bachecaConfig = (await kv.get('global:bachecaConfig')) || {};
return res.status(200).json({
success: true, globalPosts, postImages: {}, posts: [], teamName, bachecaConfig
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

const isParentMode = (function() {
    if (req.method !== 'GET') return false;
    const q = req.query || {};
    const v = q.parentMode ?? q.parentmode ?? q.PARENTMODE;
    if (v === undefined || v === null) return false;
    const s = String(v).toLowerCase().trim();
    return s === '1' || s === 'true' || s === 'yes';
})();

// LOG DIAGNOSTICO (rimuovere dopo verifica): mostra cosa arriva
console.log(`[/api/data] method=${req.method} annataId=${annataId} isAuth=${session.isAuthenticated} parentMode=${isParentMode} rawQuery=${JSON.stringify(req.query || {})}`);

if (!session.isAuthenticated && !isParentMode) {
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
const [calendarEvents, calendarResponses, teamName, convSettings, athletes, posts, globalPosts, documents, materiale, bachecaConfig] = await Promise.all([
kv.get(`${prefix}:calendarEvents`),
kv.get(`${prefix}:calendarResponses`),
kv.get('global:teamName'),
kv.get(`${prefix}:convSettings`),
kv.get(`${prefix}:athletes`),
kv.get(`${prefix}:posts`),
kv.get('global:posts'),
kv.get(`${prefix}:documents`),
kv.get(`${prefix}:materiale`),
kv.get('global:bachecaConfig')   // ← FIX: aggiunto per i banner sponsor
]);

return res.status(200).json({
calendarEvents: calendarEvents || {},
calendarResponses: calendarResponses || {},
teamName: teamName || 'GO SPORT',
convSettings: convSettings || {},
athletes: (athletes || []).map(a => ({
id: a.id,
name: a.name,
ruolo: a.ruolo || a.role || ''
})),
posts: posts || [],
globalPosts: globalPosts || [],
documents: (documents || []).filter(d => (d.visibility || []).includes('pubblica')),
materiale: materiale || { items: [], assignments: {} },
bachecaConfig: bachecaConfig || {}   // ← FIX: incluso nella risposta
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
ratingSheets, documents
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
kv.get(`${prefix}:documents`)
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
documents: documents || []
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
if (!canWrite(session.role)) {
return res.status(403).json({ success: false, message: 'Permesso negato' });
}

const body = req.body || {};

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
