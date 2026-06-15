// api/ical.js — Feed calendario LIVE (iCal/Google/Apple) per singolo atleta.
//
// Due modalità:
//  1) ?action=link&a=<athleteId>&annata=<id>  → ritorna { url, webcal } firmati
//     (chiamato dalla pagina genitore; l'HMAC è calcolato qui, il segreto NON
//      esce mai dal server).
//  2) ?a=<athleteId>&annata=<id>&sig=<HMAC>   → ritorna il .ics (chiamato dal
//     calendario di Google/Apple/Outlook, senza login). Verifica la firma.
//
// Include gli eventi SQUADRA dell'annata, ESCLUSI quelli dove l'atleta ha
// segnalato assenza. Sicurezza: link firmato HMAC (non indovinabile).
import { createClient } from '@vercel/kv';
import crypto from 'crypto';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Segreto per la firma: dedicato ICAL_SECRET, con fallback su BACKUP_SECRET
// (già configurato) così funziona anche prima di creare la env dedicata.
function icalSecret() {
  return process.env.ICAL_SECRET || process.env.BACKUP_SECRET || '';
}

// Firma HMAC del payload "athleteId:annataId" (stabile → stesso link sempre).
function sign(athleteId, annataId) {
  return crypto.createHmac('sha256', icalSecret())
    .update(`${athleteId}:${annataId}`)
    .digest('hex')
    .substring(0, 32);
}

function isValidId(v) { return /^[a-z0-9_-]+$/i.test(String(v || '').trim()); }

// Escape testo per iCal (RFC 5545): backslash, virgola, punto e virgola, newline.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// "HH:MM-HH:MM" o "HH:MM" → { start:'HHMM00', end:'HHMM00' }
function parseTime(t) {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/g) || [];
  const toHHMMSS = hm => hm.replace(':', '').padStart(4, '0') + '00';
  const start = m[0] ? toHHMMSS(m[0]) : '180000';
  const end = m[1] ? toHHMMSS(m[1]) : null;
  return { start, end };
}

const TYPE_ICON = {
  Allenamento: '🏃', Partita: '⚽', Torneo: '🏆', Campionato: '🏅',
  Finale: '🥇', Semifinale: '🥈', Individual: '🏋️', Visita: '🏥',
  Evento: '📅', Varie: '🎉',
};

export default async function handler(req, res) {
  const athleteId = String(req.query.a || '').trim();
  const annataId = String(req.query.annata || '').trim();

  if (!athleteId || !annataId || !isValidId(annataId)) {
    return res.status(400).json({ error: 'Parametri mancanti o non validi' });
  }
  if (!icalSecret()) {
    return res.status(503).json({ error: 'Feed calendario non configurato' });
  }

  // ── Modalità 1: genera il link firmato (per la pagina genitore) ───────────
  if (req.query.action === 'link') {
    const sig = sign(athleteId, annataId);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = `${host}/api/ical?a=${encodeURIComponent(athleteId)}&annata=${encodeURIComponent(annataId)}&sig=${sig}`;
    return res.status(200).json({
      url: `https://${base}`,
      webcal: `webcal://${base}`,
    });
  }

  // ── Modalità 2: serve il .ics (per Google/Apple). Verifica firma HMAC ─────
  const sig = String(req.query.sig || '').trim();
  const expected = sign(athleteId, annataId);
  // Confronto timing-safe
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Firma non valida' });
  }

  try {
    const [events, responses, annateList] = await Promise.all([
      kv.get(`annate:${annataId}:calendarEvents`),
      kv.get(`annate:${annataId}:calendarResponses`),
      kv.get('annate:list'),
    ]);
    const evs = events || {};
    const resp = responses || {};
    const annata = (annateList || []).find(x => String(x.id) === annataId);
    const calName = `${(annata && (annata.nome || annata.label)) || 'Squadra'} — Calendario`;

    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    let ics = 'BEGIN:VCALENDAR\r\n'
      + 'VERSION:2.0\r\n'
      + 'PRODID:-//Sport Monitoring//Calendario//IT\r\n'
      + 'CALSCALE:GREGORIAN\r\n'
      + 'METHOD:PUBLISH\r\n'
      + `X-WR-CALNAME:${esc(calName)}\r\n`
      + 'X-WR-TIMEZONE:Europe/Rome\r\n';

    Object.keys(evs).sort().forEach(date => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const ev = evs[date];
      if (!ev || !ev.type) return;

      // Escludi gli eventi dove l'atleta ha segnalato ASSENZA.
      const rec = resp[date] && (resp[date][athleteId] || resp[date][String(athleteId)]);
      const status = rec ? (typeof rec === 'object' ? rec.status : rec) : null;
      if (status === 'Assente') return;

      const { start, end } = parseTime(ev.time);
      const d = date.replace(/-/g, '');
      const icon = TYPE_ICON[ev.type] || '📌';
      const summary = `${icon} ${ev.type}${ev.note ? ' — ' + ev.note : ''}`;
      const descParts = [];
      if (ev.time) descParts.push(`Orario: ${ev.time}`);
      if (ev.note) descParts.push(ev.note);
      if (ev.athleteName) descParts.push(`Atleta: ${ev.athleteName}`);

      ics += 'BEGIN:VEVENT\r\n'
        + `UID:${date}-${athleteId}-${annataId}@sportmonitoring\r\n`
        + `DTSTAMP:${nowStamp}\r\n`
        + `DTSTART;TZID=Europe/Rome:${d}T${start}\r\n`
        + (end ? `DTEND;TZID=Europe/Rome:${d}T${end}\r\n` : '')
        + `SUMMARY:${esc(summary)}\r\n`
        + (descParts.length ? `DESCRIPTION:${esc(descParts.join('\n'))}\r\n` : '')
        + 'STATUS:CONFIRMED\r\n'
        + 'END:VEVENT\r\n';
    });

    ics += 'END:VCALENDAR\r\n';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="calendario.ics"');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // i calendari ricaricano ~ogni ora
    return res.status(200).send(ics);
  } catch (e) {
    console.error('[ical] errore:', e);
    return res.status(500).json({ error: 'Errore generazione feed' });
  }
}
