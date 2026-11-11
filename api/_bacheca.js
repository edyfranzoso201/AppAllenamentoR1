// api/_bacheca.js — banner sponsor e comunicati "di società", ISOLATI per società.
//
// Prima stavano in tre chiavi uniche per tutto il database:
//   global:bachecaConfig   global:posts   global:postImg_<id>
// quindi una società cambiava i banner e i comunicati visti dai genitori di
// tutte le altre. Ora ogni società ha le sue:
//   society:<id>:bachecaConfig   society:<id>:posts   society:<id>:postImg_<id>
//
// NON riguarda global:superadminBanners: quelli sono del superadmin e devono
// comparire in tutte le società (si scrivono solo con la chiave superadmin).
//
// Le vecchie chiavi global:* restano:
//   - in sola lettura per chi arriva senza società (bacheca pubblica senza sid);
//   - come RIPIEGO IN SOLA LETTURA per una società che non ha ancora salvato
//     niente di suo, così i banner già configurati non spariscono col deploy.
//     Al primo salvataggio la società passa alla sua chiave e non le legge più.
// Nessuno scrive più in global:*: senza società il salvataggio non avviene.
//
// Il file ha prefisso "_" così Vercel NON lo espone come endpoint.

function idValido(value) {
  return /^[a-z0-9_-]+$/i.test(String(value || '').trim());
}

// Società di cui servire la bacheca.
//  - utente autenticato: SOLO quella della sessione (mai dagli header);
//  - anonimo con annata (link genitori): la società dell'annata;
//  - anonimo senza annata (bacheca pubblica): header X-Society-Id o ?sid=.
//    Sono dati pubblici per natura: il sid serve a scegliere quale bacheca
//    leggere, non dà alcun diritto di scrittura.
// Ritorna '' per le installazioni senza società (chiavi global:* storiche).
export function bachecaSocietyId(req, session, annataSocietyId) {
  let sid;
  if (session && session.isAuthenticated) sid = session.societyId;
  else if (annataSocietyId) sid = annataSocietyId;
  else sid = (req && req.headers && req.headers['x-society-id']) || (req && req.query && req.query.sid) || '';
  sid = String(sid || '').trim();
  return idValido(sid) ? sid : '';
}

function ns(sid) { return sid ? `society:${sid}` : 'global'; }

export async function leggiBachecaConfig(kv, sid) {
  if (sid) {
    const propria = await kv.get(`society:${sid}:bachecaConfig`);
    if (propria !== null && propria !== undefined) return propria;
  }
  return (await kv.get('global:bachecaConfig')) || {};
}

export async function salvaBachecaConfig(kv, sid, config) {
  if (!sid) return false; // mai scrivere in global:* (vedi sopra)
  await kv.set(`${ns(sid)}:bachecaConfig`, config);
}

// Comunicati di società. Per una società che non ha ancora una lista sua si
// ripiega sui vecchi comunicati globali, tenendo solo quelli suoi o senza
// società (quelli marcati con un'altra società non si mostrano).
export async function leggiPostSocieta(kv, sid) {
  if (sid) {
    const propri = await kv.get(`society:${sid}:posts`);
    if (Array.isArray(propri)) return propri;
    const vecchi = (await kv.get('global:posts')) || [];
    return vecchi.filter(p => p && (!p.societyId || String(p.societyId) === sid));
  }
  return (await kv.get('global:posts')) || [];
}

export async function salvaPostSocieta(kv, sid, posts) {
  if (!sid) return false;
  await kv.set(`${ns(sid)}:posts`, Array.isArray(posts) ? posts : []);
}

export async function leggiImmaginePost(kv, sid, postId) {
  if (sid) {
    const propria = await kv.get(`society:${sid}:postImg_${postId}`);
    if (propria) return propria;
  }
  return (await kv.get(`global:postImg_${postId}`)) || null;
}

// Immagini dei comunicati di società: { postId: immagine } per i post dati.
export async function leggiImmaginiPost(kv, sid, posts) {
  const out = {};
  await Promise.all((posts || []).map(async p => {
    if (!p || !p.id) return;
    const img = await leggiImmaginePost(kv, sid, p.id);
    if (img) out[p.id] = img;
  }));
  return out;
}

export async function salvaImmaginePost(kv, sid, postId, img) {
  if (!sid) return false;
  await kv.set(`${ns(sid)}:postImg_${postId}`, img);
}
