// calendario-standalone.js - VERSIONE UNIFICATA (URL param + Token path)

const TRAINING = [
  { day: 1, time: '18:00-19:30' },
  { day: 3, time: '18:30-20:00' },
  { day: 5, time: '18:00-19:30' }
];
const END = new Date('2026-06-30');

let events = {};
let athletes = [];
let isParentView = false;
let currentAthleteId = null;
let currentAnnataId = null;

/**
 * Controlla se un evento è entro 72 ore
 */
function isWithin72Hours(eventDate) {
  const now = new Date();
  const event = new Date(eventDate);
  // Calcola differenza in ore (positiva = futuro, negativa = passato)
  const diffHours = (event - now) / (1000 * 60 * 60);
  // Blocca se l'evento è entro 72 ore NEL FUTURO oppure già PASSATO
  return diffHours < 72;
}

async function getAnnataId() {
    // 1. Prova dall'URL (PRIORITÀ MASSIMA)
    const urlParams = new URLSearchParams(window.location.search);
    const annataFromUrl = urlParams.get('annata');
    if (annataFromUrl) {
        currentAnnataId = annataFromUrl;
        localStorage.setItem('currentAnnata', annataFromUrl);
        console.log('[CALENDARIO] ✅ Annata da URL:', annataFromUrl);
        return annataFromUrl;
    }

    // 2. Se già abbiamo l'annata in memoria, usala
    if (currentAnnataId) {
        return currentAnnataId;
    }

    // 3. Prova dal localStorage
    const localAnnata = localStorage.getItem('currentAnnata');
    if (localAnnata) {
        currentAnnataId = localAnnata;
        console.log('[CALENDARIO] Annata da localStorage:', localAnnata);
        return localAnnata;
    }

    // 4. Prova dalla sessione
    const sessionAnnata = sessionStorage.getItem('gosport_current_annata');
    if (sessionAnnata) {
        currentAnnataId = sessionAnnata;
        console.log('[CALENDARIO] Annata da sessionStorage:', sessionAnnata);
        return sessionAnnata;
    }

    // 5. Prova da window.currentAnnata
    if (window.currentAnnata) {
        currentAnnataId = window.currentAnnata;
        console.log('[CALENDARIO] Annata da window.currentAnnata:', window.currentAnnata);
        return window.currentAnnata;
    }

    // 6. FALLBACK: Ottieni l'annata più recente dal server
    console.log('[CALENDARIO] ⚠️ Nessuna annata trovata, cerco la più recente...');
    try {
        const response = await fetch('/api/annate/list');
        if (!response.ok) throw new Error('Errore recupero annate');
        
        const annateData = await response.json();
        const annate = annateData.annate || [];
        
        if (annate.length === 0) {
            throw new Error('Nessuna annata disponibile nel database');
        }
        
        // Ordina per data inizio (più recente prima)
        const sorted = annate.sort((a, b) => {
            const dateA = new Date(a.dataInizio || a.year || '2000-01-01');
            const dateB = new Date(b.dataInizio || b.year || '2000-01-01');
            return dateB - dateA;
        });
        
        const annataId = sorted[0].id;
        currentAnnataId = annataId;
        localStorage.setItem('currentAnnata', annataId);
        console.log('[CALENDARIO] ✅ Annata più recente:', annataId);
        return annataId;
        
    } catch (error) {
        console.error('[CALENDARIO] ❌ Errore recupero annata:', error);
        return null;
    }
}

async function load() {
  try {
    console.log('[CALENDARIO] 🔥 Caricamento dati calendario...');
    
    const annataId = await getAnnataId();
    
    if (!annataId) {
      throw new Error('Nessuna annata disponibile');
    }
    
    console.log(`[CALENDARIO] 🔥 Caricamento per annata: ${annataId}`);
    
    // Chiamata API diretta con header (modalità genitore = dati ridotti)
    // FIX: mando ANCHE gli header di auth se l'utente è loggato.
    // Cosi' funziona sia per coach (che autenticano via session) sia per
    // genitori (che usano parentMode=1). Su browser non-Chrome (es. Samsung
    // Internet) gli header custom potrebbero essere gestiti diversamente
    // ma il pattern e' lo stesso usato da data-adapter-multi-annata.js.
    const _authHeaders = {};
    try {
      _authHeaders['x-auth-session'] = sessionStorage.getItem('gosport_auth_session') || '';
      _authHeaders['x-auth-user']    = sessionStorage.getItem('gosport_auth_user')    || '';
      _authHeaders['x-user-role']    = sessionStorage.getItem('gosport_user_role')    || '';
      _authHeaders['x-society-id']   = sessionStorage.getItem('gosport_society_id')   || '';
    } catch (e) { /* sessionStorage non disponibile (es. iframe sandbox) */ }

  const response = await fetch('/api/data?parentMode=1', {
    cache: 'no-store',
    headers: Object.assign({
    'Content-Type': 'application/json',
    'X-Annata-Id': annataId
    }, _authHeaders)
  });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const data = result.data || result;
    
    events = data.calendarEvents || {};
    
    // Converti TUTTI gli ID a stringhe
    athletes = (data.athletes || []).map(a => ({
      ...a,
      id: String(a.id)
    }));
    
    console.log('[CALENDARIO] ✅ Dati caricati:', {
      eventi: Object.keys(events).length,
      atleti: athletes.length,
      annata: annataId
    });
    
    window._cachedCalData = data;  // cache per bacheca genitori
    render(data);
  } catch (e) {
    console.error('[CALENDARIO] ❌ Errore caricamento:', e);
    document.getElementById('calendar').innerHTML = `<div class="alert alert-danger">Errore: ${e.message}</div>`;
  }
}

async function markAbsence(athleteId, date, currentStatus) {
  console.log('[PRESENZA] 🔔 markAbsence chiamata!', { athleteId, date, currentStatus });
  
  // CONTROLLO 72 ORE PER GENITORI
  if (isParentView && isWithin72Hours(date)) {
    alert('⚠️ NON PIÙ MODIFICABILE\n\nL\'evento è tra meno di 72 ore.\n\nContatta il dirigente o la società per modifiche dell\'ultimo minuto.');
    console.log('[PRESENZA] ⛔ Bloccato: evento entro 72 ore');
    return;
  }
  
  const newStatus = currentStatus === 'Assente' ? null : 'Assente';
  const statusText = newStatus === 'Assente' ? 'assente' : 'presente';
  
  if (!confirm(`Confermi di voler segnare l'atleta come ${statusText} per il ${new Date(date).toLocaleDateString('it-IT')}?`)) {
    console.log('[PRESENZA] ❌ Utente ha annullato');
    return;
  }
  
  try {
    console.log('[PRESENZA] 💾 Inizio salvataggio...');
    
    const annataId = await getAnnataId();
    
    if (!annataId) {
      throw new Error('Nessuna annata disponibile');
    }
    
    // Salva annata corrente
    currentAnnataId = annataId;
    
    // Carica i dati correnti
    const _authH = {};
    try {
      _authH['x-auth-session'] = sessionStorage.getItem('gosport_auth_session') || '';
      _authH['x-auth-user']    = sessionStorage.getItem('gosport_auth_user')    || '';
      _authH['x-user-role']    = sessionStorage.getItem('gosport_user_role')    || '';
      _authH['x-society-id']   = sessionStorage.getItem('gosport_society_id')   || '';
    } catch(e) {}

    const response = await fetch('/api/data?parentMode=1', {
      cache: 'no-store',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'X-Annata-Id': annataId
      }, _authH)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const data = result.data || result;
    
    console.log('[PRESENZA] 📦 Dati caricati per salvataggio');
    
    // Inizializza struttura
    if (!data.calendarResponses) {
      data.calendarResponses = {};
    }
    if (!data.calendarResponses[date]) {
      data.calendarResponses[date] = {};
    }
    
    // Imposta stato con STORICO
    const athleteIdStr = String(athleteId);
    const timestamp = new Date().toISOString();
    const modifiedBy = isParentView ? 'genitore' : 'coach';
    
    // Recupera record esistente o crea nuovo
    let record = data.calendarResponses[date][athleteIdStr];
    
    if (typeof record === 'string') {
      // Vecchio formato (solo stringa), converti a nuovo formato
      record = {
        status: record,
        lastModified: timestamp,
        modifiedBy: 'unknown',
        history: [{
          timestamp: timestamp,
          status: record,
          by: 'unknown',
          note: 'Migrato da vecchio formato'
        }]
      };
    } else if (!record || typeof record !== 'object') {
      // Nessun record, crea nuovo
      record = {
        status: 'Presente',
        lastModified: timestamp,
        modifiedBy: modifiedBy,
        history: []
      };
    }
    
    // Assicura che history esista
    if (!record.history) {
      record.history = [];
    }
    
    // Aggiungi nuova modifica allo storico
    const newEntry = {
      timestamp: timestamp,
      status: newStatus || 'Presente',
      by: modifiedBy
    };
    
    record.history.push(newEntry);
    
    // Aggiorna stato corrente
    record.status = newStatus || 'Presente';
    record.lastModified = timestamp;
    record.modifiedBy = modifiedBy;
    
    data.calendarResponses[date][athleteIdStr] = record;
    
    console.log(`[PRESENZA] ✅ Aggiornato: ${record.status} per ${athleteIdStr}`);
    console.log('[PRESENZA] 📜 Storico:', record.history.length, 'modifiche');
    
    // Salva SOLO calendarResponses (il backend ha un ramo speciale per questo
    // che richiede solo isAuthenticated, non canWrite — permette ai genitori di salvare)
    const saveResponse = await fetch('/api/data', {
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'X-Annata-Id': annataId
      }, _authH),
      body: JSON.stringify({ calendarResponses: data.calendarResponses })
    });
    
    if (!saveResponse.ok) {
      throw new Error(`Salvataggio fallito: HTTP ${saveResponse.status}`);
    }
    
    console.log('[PRESENZA] ✅ Stato salvato con successo!');
    alert('✅ Stato aggiornato: ' + (newStatus || 'presente'));
    
    // Ricarica pagina per mostrare nuovo stato
    location.reload();
    
  } catch (e) {
    console.error('[PRESENZA] ❌ Errore:', e);
    alert('❌ Errore nel salvataggio: ' + e.message);
  }
}

/**
 * Mostra lo storico delle modifiche per un atleta in una data
 */
window.showHistory = function(athleteId, date) {
  // Recupera il nome dell'atleta dalla lista globale
  const athlete = athletes.find(a => String(a.id) === String(athleteId));
  const athleteName = athlete ? athlete.name : `Atleta ${athleteId}`;
  
  console.log('[STORICO] 📋 Richiesto storico per', athleteName, 'data', date);
  
  const annataId = currentAnnataId || localStorage.getItem('currentAnnata');
  
  // Recupera dati
  fetch('/api/data', {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Annata-Id': annataId
    }
  })
  .then(r => {
    if (!r.ok) throw new Error('Errore caricamento dati');
    return r.json();
  })
  .then(data => {
    const responses = data.calendarResponses || {};
    const athleteIdStr = String(athleteId);
    const record = responses[date] ? responses[date][athleteIdStr] : null;
    
    if (!record) {
      alert('📋 Nessuna modifica registrata per questo evento.');
      return;
    }
    
    // Converti vecchio formato se necessario
    let history = [];
    if (typeof record === 'string') {
      // Vecchio formato: solo una stringa
      history = [{
        timestamp: new Date().toISOString(),
        status: record,
        by: 'unknown',
        note: 'Dato nel vecchio formato'
      }];
    } else if (record.history && Array.isArray(record.history)) {
      history = record.history;
    }
    
    if (history.length === 0) {
      alert('📋 Nessuna modifica registrata per questo evento.');
      return;
    }
    
    // Crea modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    
    // Costruisci lista storico (dal più recente al più vecchio)
    const sortedHistory = [...history].reverse();
    let historyHTML = '';
    
    sortedHistory.forEach((entry, idx) => {
      const entryDate = new Date(entry.timestamp);
      const dateStr = entryDate.toLocaleDateString('it-IT', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const icon = entry.status === 'Assente' ? '❌' : '✅';
      const color = entry.status === 'Assente' ? '#d90429' : '#16a34a';
      const bgColor = entry.status === 'Assente' ? '#450a0a' : '#16a34a';
      const byIcon = entry.by === 'genitore' ? '👨‍👩‍👧' : (entry.by === 'coach' ? '👔' : '❓');
      const byText = entry.by === 'genitore' ? 'Genitore' : (entry.by === 'coach' ? 'Coach' : 'Sconosciuto');
      
      historyHTML += `
        <div style="padding:12px;background:${bgColor};border-radius:8px;margin-bottom:10px;border-left:4px solid ${color}">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div style="flex:1;min-width:150px;">
              <strong style="color:${color};font-size:1rem;">${icon} ${entry.status}</strong>
              <span style="margin-left:10px;color:#64748b;font-size:0.85rem;">${byIcon} ${byText}</span>
            </div>
            <span style="color:#64748b;font-size:0.8rem;white-space:nowrap;">${dateStr}</span>
          </div>
          ${entry.note ? `<div style="margin-top:8px;color:#64748b;font-size:0.85rem;font-style:italic;padding:8px;background:rgba(255,255,255,0.08);border-radius:4px;">${entry.note}</div>` : ''}
        </div>
      `;
    });
    
    // Stato attuale
    const currentStatus = typeof record === 'object' ? record.status : record;
    const currentColor = currentStatus === 'Assente' ? '#d90429' : '#16a34a';
    const currentBg = currentStatus === 'Assente' ? '#450a0a' : '#16a34a';
    
    modal.innerHTML = `
      <div style="background:#0f172a;padding:30px;border-radius:15px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.6);border:1px solid #1a3a5f;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;color:#e2e8f0;display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.5rem;">📋</span>
            <span>Storico Modifiche</span>
          </h3>
          <button onclick="this.closest('[style*=fixed]').remove()" 
            style="background:none;border:none;font-size:2rem;cursor:pointer;color:#64748b;line-height:1;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background 0.2s;"
            onmouseover="this.style.background='#1a3a5f'"
            onmouseout="this.style.background='none'">×</button>
        </div>
        
        <div style="background:#1e293b;padding:15px;border-radius:10px;margin-bottom:20px;border:2px solid #3b82f6;">
          <div style="color:#60a5fa;font-weight:600;margin-bottom:5px;font-size:1rem;">
            <i class="bi bi-person-circle"></i> ${athleteName}
          </div>
          <div style="color:#e2e8f0;font-size:0.9rem;">
            <i class="bi bi-calendar-event"></i> ${new Date(date).toLocaleDateString('it-IT', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </div>
        </div>
        
        <div style="margin-bottom:20px;padding:12px;background:${currentBg};border-radius:8px;border:2px solid ${currentColor};">
          <div style="font-size:0.85rem;color:#64748b;margin-bottom:5px;">Stato attuale:</div>
          <div style="font-size:1.1rem;font-weight:700;color:${currentColor};">
            ${currentStatus === 'Assente' ? '❌ ASSENTE' : '✅ PRESENTE'}
          </div>
        </div>
        
        <div style="margin-bottom:15px;">
          <div style="color:#64748b;font-size:0.9rem;margin-bottom:10px;">
            <strong>📜 Cronologia delle modifiche</strong>
            <span style="margin-left:8px;padding:2px 8px;background:#1a3a5f;border-radius:12px;font-size:0.75rem;">${history.length}</span>
          </div>
        </div>
        
        <div style="max-height:300px;overflow-y:auto;padding-right:5px;">
          ${historyHTML}
        </div>
        
        <div style="margin-top:25px;text-align:center;">
          <button onclick="this.closest('[style*=fixed]').remove()" 
            style="background:#64748b;color:white;border:none;padding:12px 40px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.95rem;transition:background 0.2s;"
            onmouseover="this.style.background='#64748b'"
            onmouseout="this.style.background='#64748b'">
            Chiudi
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Chiudi cliccando fuori
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  })
  .catch(e => {
    console.error('[STORICO] ❌ Errore:', e);
    alert('❌ Errore nel caricamento dello storico: ' + e.message);
  });
};

function getAttendanceStatus(athleteId, date, data) {
  console.log('[STATUS] 🔍 Cerco status per', { athleteId, date });
  
  if (!data) {
    console.log('[STATUS] ⚠️ Nessun dato fornito');
    return null;
  }
  
  const responses = data.calendarResponses || {};
  
  if (!responses[date]) {
    console.log('[STATUS] ⚠️ Nessuna risposta per', date);
    return null;
  }
  
  const athleteIdStr = String(athleteId);
  const record = responses[date][athleteIdStr] || responses[date][athleteId] || null;
  
  if (!record) {
    console.log('[STATUS] ⚠️ Nessun record per atleta', athleteIdStr);
    return null;
  }
  
  // Nuovo formato: oggetto con status e history
  if (typeof record === 'object' && record.status) {
    console.log('[STATUS] ✅ Stato trovato (nuovo formato):', record.status);
    return record;
  }
  
  // Vecchio formato: solo stringa
  if (typeof record === 'string') {
    console.log('[STATUS] ✅ Stato trovato (vecchio formato):', record);
    return {
      status: record,
      history: [],
      legacy: true
    };
  }
  
  console.log('[STATUS] ⚠️ Formato sconosciuto:', typeof record);
  return null;
}

async function render(loadedData) {
  // Disabilita presenza-calendar-mode.js per evitare conflitti
  window._CALENDARIO_STANDALONE_ACTIVE = true;
  
  const el = document.getElementById('calendar');
  const dates = Object.keys(events).sort();

  // Guard: se l'elemento calendar non esiste, esce senza crashare (i tab sono già visibili)
  if (!el) {
    console.warn('[RENDER] ⚠️ Elemento #calendar non trovato — tab mostrati, skip rendering calendario');
    return;
  }

  if (dates.length === 0) {
    // Anche senza eventi: mostra la tabella dei nomi con i link presenze
    const _noEvAtleti = athletes.filter(a => !a.isGuest && !a.guest);
    if (_noEvAtleti.length === 0) {
      el.innerHTML = `<div class="alert alert-info">Nessun evento e nessun atleta in rosa.</div>`;
      return;
    }
    const _urlP = new URLSearchParams(window.location.search);
    if (_urlP.get('athleteId')) {
      el.innerHTML = `<div class="alert alert-info">Nessun evento nel calendario.</div>`;
      return;
    }
    let _h = `<div class="alert alert-info mb-3">Nessun evento nel calendario. Puoi comunque generare i link presenze per atleti e staff.</div>`;
    _h += `<div class="table-responsive"><table class="table table-dark table-bordered table-sm">`;
    _h += `<thead><tr><th>#</th><th>Nome</th><th>Ruolo</th><th class="text-center">Link Presenze</th></tr></thead><tbody>`;
    _noEvAtleti.forEach(function(a, i) {
      var ruolo = a.isStaff ? (a.role || 'Staff') : (a.role || 'Atleta');
      var badge = a.isStaff
        ? `<span style="background:#f59e0b;color:#000;border-radius:4px;padding:1px 6px;font-size:0.75rem;">Staff</span>`
        : `<span style="background:#3b82f6;color:#ffffff;border-radius:4px;padding:1px 6px;font-size:0.75rem;">Atleta</span>`;
      _h += `<tr>`;
      _h += `<td style="color:#64748b;">${i+1}</td>`;
      _h += `<td style="color:#60a5fa;font-weight:600;">${a.name} ${badge}</td>`;
      _h += `<td style="color:#64748b;font-size:0.85rem;">${ruolo}</td>`;
      _h += `<td class="text-center"><button class="btn btn-sm btn-primary link-presenze-btn" data-athlete-id="${a.id}" data-athlete-name="${a.name.replace(/"/g,'&quot;')}"><i class="bi bi-link-45deg"></i> Link Presenze</button></td>`;
      _h += `</tr>`;
    });
    _h += `</tbody></table></div>`;
    el.innerHTML = _h;
    // Attiva i pulsanti link
    el.querySelectorAll('.link-presenze-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var aid = this.getAttribute('data-athlete-id');
        var aname = this.getAttribute('data-athlete-name');
        if (typeof window.generatePresenceLink === 'function') window.generatePresenceLink(aid, aname);
      });
    });
    return;
  }

  // SUPPORTO DOPPIO: parametro URL O token nel path
  const urlParams = new URLSearchParams(window.location.search);
  let athleteIdParam = urlParams.get('athleteId');
  
  let visibleAthletes = athletes.filter(a => !a.isGuest && !a.guest);
  
  if (athleteIdParam) {
    isParentView = true;
    currentAthleteId = athleteIdParam;
    
    console.log('[PRESENZA] 🔓 Modalità Genitore:', athleteIdParam);
    
    // NASCONDI tutti i pulsanti del coach in modalità genitore
    const coachButtons = document.querySelectorAll('#add-btn, #generate-btn, #import-btn, #responses-btn, #delete-btn');
    coachButtons.forEach(btn => {
      if (btn && btn.parentElement) {
        btn.parentElement.style.display = 'none';
      }
    });

    // ✅ Mostra bottone tema anche per genitori
const themeBtn = document.getElementById('cal-theme-btn');
if (themeBtn) {
  const calActions = document.getElementById('cal-actions') || themeBtn.parentElement;
  if (calActions) {
    calActions.style.display = 'flex';
    calActions.style.justifyContent = 'flex-end';
    calActions.style.padding = '4px 0';
  }
  themeBtn.style.display = 'flex';
  themeBtn.style.marginLeft = 'auto';
}

    // Nascondi anche il pulsante Dashboard
    const dashboardBtn = document.querySelector('.btn-outline-primary[href="/"]');
    if (dashboardBtn) {
      dashboardBtn.style.display = 'none';
    }
    
    visibleAthletes = visibleAthletes.filter(a => {
      return String(a.id) === String(athleteIdParam);
    });
    
    if (visibleAthletes.length === 0) {
  // Non mostrare errore, ma continua a caricare la bacheca
  console.warn('[CALENDARIO] ⚠️ Atleta', athleteIdParam, 'non trovato negli eventi, ma carico comunque la bacheca');
  el.innerHTML = `<div class="alert alert-info">Nessun evento nel calendario.</div>`;
  // NON fare return, continua a caricare la bacheca
} else {
  // FIX: log atleta solo se trovato (prima si tentava sempre [0].name
  // anche con array vuoto -> TypeError "Cannot read properties of undefined")
  console.log('[PRESENZA] ✅ Atleta trovato:', visibleAthletes[0].name);
}
  } else {
    isParentView = false;
    // Mostra tab Bacheca per coach/admin
    if (typeof showBachecaTab === 'function') showBachecaTab();
    if (typeof showDocumentiTab === 'function') {
      var _dRole = sessionStorage.getItem('gosport_user_role') || '';
      showDocumentiTab(['admin','coach_l1','coach_l2'].indexOf(_dRole) >= 0);
    }
    // Mostra tab Gare per coach/admin (con permesso edit in base al ruolo)
    if (typeof showGareTab === 'function') {
      var _gareRole = sessionStorage.getItem('gosport_user_role') || '';
      var _gareEdit = ['admin','coach_l1','coach_l2'].indexOf(_gareRole) >= 0;
      showGareTab(_gareEdit);
    }
  }

  if (isParentView) {
    const buttons = ['add-btn', 'generate-btn', 'import-btn', 'responses-btn', 'delete-btn'];
    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn && btn.closest('.col-md-2')) {
        btn.closest('.col-md-2').style.display = 'none';
      }
    });
  }

  let attendanceData = loadedData || {};
    const isLightNow = document.documentElement.classList.contains('theme-light')
                || document.body.classList.contains('theme-light');
      let h = '';
    h += `<div class="table-responsive">`;
    h += `<table class="table table-bordered calendar-table">`;

    // ✅ COLORI PER LE COLONNE FISSE (Sinistra: #, Atleta, Azioni, Nome, Evento)
    const stickyBg     = isLightNow ? '#e5e7eb' : '#0d1b2a'; // ← era #1d4ed8
    const stickyText   = isLightNow ? '#000000' : '#60a5fa'; // ← stesso colore del testo header
    const stickyBorder = isLightNow ? '#cccccc' : '#3b5a9d'; // ← stesso bordo del tema
    const stickyStyle = `color:${stickyText} !important; background:${stickyBg} !important; border-color:${stickyBorder} !important;`;
    console.log('[TEMA] isLightNow:', isLightNow);
    console.log('[TEMA] stickyStyle:', stickyStyle);
    console.log('[TEMA] stickyText:', stickyText);
    console.log('[TEMA] stickyBg:', stickyBg);

    h += `<thead>`;
    
    // === RIGA 1: DATE ===
    h += `<tr>`;
    h += `<th style="${stickyStyle}" class="sticky-col sticky-col-1">#</th>`;
    h += `<th style="${stickyStyle}" class="sticky-col sticky-col-2">Atleta</th>`;
    
    if (!isParentView) {
      h += `<th style="${stickyStyle}" class="sticky-col sticky-col-3">Azioni</th>`;
    } else {
      h += `<th class="sticky-col sticky-col-3" style="background:${stickyBg}; border-color:${stickyBorder};"></th>`;
    }

    dates.forEach(d => {
      const dt = new Date(d);
      const dateStyle = isLightNow 
      ? 'color:#000000 !important; background:#d1d5db !important; border-color:#9ca3af !important;'
      : 'color:#60a5fa !important; background:#0d1b2a !important; border-color:#3b5a9d !important;';
      h += `<th class="text-center" style="${dateStyle}">
        ${dt.toLocaleDateString('it-IT', { weekday: 'short' })}<br>
        ${dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
      </th>`;
    });
    h += `</tr>`;

    // === RIGA 2: EVENTI ===
    h += `<tr>`;
    h += `<th style="${stickyStyle}" class="sticky-col sticky-col-1"></th>`;
    h += `<th style="${stickyStyle}" class="sticky-col sticky-col-2">Nome</th>`;
    h += `<th class="sticky-col sticky-col-3" style="${stickyStyle}">Evento</th>`;

    dates.forEach(d => {
      const e = events[d];
      const eventIcon = e.type === 'Partita' ? '⚽' : e.type === 'Individual' ? '🏋️' : e.type === 'Torneo' ? '🏆' : e.type === 'Campionato' ? '🏅' : e.type === 'Finale' ? '🥇' : e.type === 'Semifinale' ? '🥈' : e.type === 'Evento' ? '📅' : e.type === 'Visita' ? '🏥' : '🏃';
      const athleteLine = (e.type === 'Individual' && e.athleteName)
        ? `<br><span style="color:#a855f7;font-size:0.7rem;font-weight:600">${e.athleteName}</span>`
        : '';
      const noteLine = e.note ? `<br><span style="font-style:italic;font-size:0.68rem;opacity:0.85;">${e.note}</span>` : '';
      
      const editBtn = !isParentView ? `<button onclick="editEvent('${d}')" class="btn btn-sm btn-warning ms-1" style="padding:0.1rem 0.3rem;font-size:0.6rem;color:#ffffff;" title="Modifica evento"><i class="bi bi-pencil"></i></button>` : '';
      const deleteBtn = !isParentView ? `<button onclick="deleteEvent('${d}')" class="btn btn-sm btn-danger ms-1" style="padding:0.1rem 0.3rem;font-size:0.6rem;color:#ffffff;" title="Elimina evento"><i class="bi bi-trash"></i></button>` : '';

      const thColor = isLightNow ? '#000000 !important' : '#ffffff !important';
      let thBg = '';
      if (e.type === 'Individual') {
        thBg = isLightNow ? '; background:#ddd6fe' : '; background:#1e1b4b';
      } else {
        thBg = isLightNow ? '; background:#f0f1f2 !important' : '';
      }
      
      h += `<th class="text-center" style="color:${thColor}${thBg}">
        <small>${eventIcon} ${e.type}${athleteLine}${noteLine}<br>${e.time}${editBtn}${deleteBtn}</small>
      </th>`;
    });
    h += `</tr>`;
    
    h += `</thead>`;
    h += `<tbody>`;

visibleAthletes.forEach((a, i) => {
  h += `<tr data-athlete-id="${a.id}">`;
  
  // ✅ Colonne sticky con colori adattivi
  h += `<td style="color:${stickyText};background:${stickyBg};border-color:${stickyBorder};" class="sticky-col sticky-col-1">${i + 1}</td>`;
  h += `<td style="color:${stickyText};background:${stickyBg};border-color:${stickyBorder};" class="sticky-col sticky-col-2">${a.name}</td>`;
  
  if (!isParentView) {
    h += `<td class="text-center sticky-col sticky-col-3">`;
    h += `<button class="btn btn-sm btn-primary link-presenze-btn" data-athlete-id="${a.id}" data-athlete-name="${a.name.replace(/"/g,'&quot;')}"><i class="bi bi-link-45deg"></i> Link Presenze</button>`;
    // ...
  } else {
    // ✅ Cella "Evento" con colori adattivi
    h += `<td class="sticky-col sticky-col-3" style="background:${stickyBg}; color:${stickyText}; border-color:${stickyBorder}; text-align:center;">Evento</td>`;
  }
  
  
  dates.forEach(date => {
    console.log('[RENDER] 📅 Data:', date, 'Atleta:', a.id, a.name);
    
    const statusRecord = getAttendanceStatus(a.id, date, attendanceData);
    
    // Estrai status effettivo (può essere oggetto o stringa)
    const status = statusRecord ? (statusRecord.status || statusRecord) : null;
    const hasHistory = statusRecord && statusRecord.history && statusRecord.history.length > 0;
    
    console.log('[RENDER] 📋 Status:', status, 'HasHistory:', hasHistory);
    
    const within72 = isWithin72Hours(date);
    const isBlocked = isParentView && within72;
    
    if (isParentView) {
      // ===== MODALITÀ GENITORE =====
      const cellTextColor = isLightNow ? '#000000' : '#e2e8f0';
      h += `<td class="text-center" style="position:relative;color:${cellTextColor};">`;
      
      if (isBlocked) {
        h += `
          <div style="background:#450a0a;color:#d90429;padding:12px 8px;border-radius:6px;font-size:0.75rem;font-weight:600;line-height:1.3;border:1px solid #450a0a;">
            🔒 NON MODIFICABILE<br>
            <span style="font-size:0.7rem;font-weight:normal;color:#d90429;">Contatta società</span>
          </div>
        `;
      } else if (status === 'Assente') {
        h += `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;background:#450a0a;padding:8px;border-radius:6px;border:1px solid #450a0a;">
            <span style="color:#d90429;font-weight:bold;">❌ Assente</span>
            <button class="btn btn-sm btn-success mark-presence-btn" 
                    data-athlete-id="${a.id}" 
                    data-date="${date}" 
                    data-current-status="Assente" 
                    style="font-size:0.75rem;font-weight:600;">
              ✅ Segna Presente
            </button>
          </div>
        `;
      } else {
        h += `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px;">
            <span style="color:#16a34a;font-weight:600;">✓ Presente</span>
            <button class="btn btn-sm btn-danger mark-absence-btn" 
                    data-athlete-id="${a.id}" 
                    data-date="${date}" 
                    data-current-status="" 
                    style="font-size:0.75rem;font-weight:600;">
              ❌ Segna Assente
            </button>
          </div>
        `;
      }
      
      // ICONA STORICO (se esiste)
      if (hasHistory) {
        h += `
          <button onclick="window.showHistory(${a.id}, '${date}')" 
            class="history-icon"
            title="Visualizza storico modifiche"
            style="position:absolute;top:2px;right:2px;background:#3b82f6;color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:0.75rem;box-shadow:0 2px 4px rgba(0,0,0,0.2);z-index:10;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"
            onmouseover="this.style.background='#3b82f6';this.style.transform='scale(1.1)'"
            onmouseout="this.style.background='#3b82f6';this.style.transform='scale(1)'">
            📋
          </button>
        `;
      }
      
      h += `</td>`;
      
    } else {
      // ===== MODALITÀ COACH =====
      h += `<td class="text-center" style="position:relative;`;
      
      if (status === 'Assente') {
        h += `background:#450a0a;color:#d90429;font-weight:bold;border-left:3px solid #d90429;">❌ Assente`;
      } else {
        h += `color:#64748b;">—`;
      }
      
      // ICONA STORICO (se esiste)
      if (hasHistory) {
        h += `
          <button onclick="window.showHistory(${a.id}, '${date}')" 
            class="history-icon"
            title="Visualizza storico modifiche"
            style="position:absolute;top:2px;right:2px;background:#3b82f6;color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:0.65rem;box-shadow:0 2px 4px rgba(0,0,0,0.2);z-index:10;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"
            onmouseover="this.style.background='#3b82f6';this.style.transform='scale(1.15)'"
            onmouseout="this.style.background='#3b82f6';this.style.transform='scale(1)'">
            📋
          </button>
        `;
      }
      
      h += `</td>`;
    }
  }); // ← CHIUSURA forEach DATE
  h += `</tr>`;
}); // ← CHIUSURA forEach ATLETI

  if (isParentView) {
    h += `<div style="margin-top:12px;padding:14px;background:${isLightNow ? '#e8eef5' : '#0d1b2a'};border:1px solid ${isLightNow ? '#9aa5b0' : '#3b5a9d'};border-radius:8px;color:${isLightNow ? '#1a3a5f' : '#60a5fa'};font-size:0.85rem;">`;
    h += `<strong>ℹ️ Istruzioni:</strong> Usa i pulsanti per segnalare assenze. Predefinito: "Presente".`;
    h += `</div>`;

  }
  
      el.innerHTML = h; // ← dopo questa riga

// ✅ METTI IL SETTIMEOUT QUI
setTimeout(() => {
    const isLightNow = document.documentElement.classList.contains('theme-light')
                    || document.body.classList.contains('theme-light');

    const stickyBg     = isLightNow ? '#e5e7eb' : '#0d1b2a'; // ← era #1e293b, ora #060f1e
    const stickyText   = isLightNow ? '#000000' : '#60a5fa';
    const stickyBorder = isLightNow ? '#cccccc' : '#3b5a9d';  // ← e il bordo un tono 

    // ✅ Forza sticky-col sia in chiaro che in scuro
    el.querySelectorAll('thead th.sticky-col, tbody td.sticky-col').forEach(cell => {
        cell.style.setProperty('background', stickyBg, 'important');
        cell.style.setProperty('color', stickyText, 'important');
        cell.style.setProperty('border-color', stickyBorder, 'important');
        cell.querySelectorAll('*').forEach(c =>
            c.style.setProperty('color', stickyText, 'important')
        );
    });

    // ✅ Celle normali tbody — solo tema chiaro ha bisogno di pulizia
    if (isLightNow) {
        el.querySelectorAll('tbody td:not(.sticky-col)').forEach(td => {
            td.style.removeProperty('background');
            td.style.removeProperty('color');
        });
    }

    console.log('[TEMA] Colori applicati!', isLightNow ? 'CHIARO' : 'SCURO');
}, 200); // 200ms per essere sicuri che il tema sia già applicato
  
  // Aggiungi event listener per i pulsanti Link Presenze (solo per coach)
  if (!isParentView) {
    document.querySelectorAll('.link-presenze-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const athleteId = this.getAttribute('data-athlete-id');
        const athleteName = this.getAttribute('data-athlete-name');
        window.generatePresenceLink(athleteId, athleteName);
      });
    });
    console.log('[RENDER] ✅ Event listener Link Presenze attaccati');
  }
  
  // Aggiungi event listener per i pulsanti Segna Assente/Presente (solo per genitori)
  if (isParentView) {
    const absenceBtns = document.querySelectorAll('.mark-absence-btn, .mark-presence-btn');
    console.log('[RENDER] 🔘 Trovati', absenceBtns.length, 'pulsanti presenza/assenza');
    
    absenceBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const athleteId = this.getAttribute('data-athlete-id');
        const date = this.getAttribute('data-date');
        const currentStatus = this.getAttribute('data-current-status') || null;
        
        console.log('[PRESENZA] 👆 Click rilevato!', { athleteId, date, currentStatus });
        markAbsence(athleteId, date, currentStatus);
      });
    });
    console.log('[RENDER] ✅ Event listener presenza/assenza attaccati');
  }
  
  console.log('[RENDER] ✅ Rendering completato!');
  
  // Carica bacheca per i genitori — passa i dati già caricati
  if (isParentView) {
    loadBachecaGenitori(loadedData);
  }
}



window.deleteEvent = async function(date) {
  const event = events[date];
  if (!event) return;
  
  const dateFormatted = new Date(date).toLocaleDateString('it-IT', { 
    weekday: 'long', day: 'numeric', month: 'long' 
  });
  
  var _doPwd1 = prompt('🔐 Elimina evento del ' + dateFormatted + '\nPassword:');
  if (_doPwd1 === null) return;
  if (_doPwd1 !== '1234') { alert('❌ Password errata.'); return; }
  
  try {
    const annataId = currentAnnataId || 
                     sessionStorage.getItem('gosport_current_annata') ||
                     localStorage.getItem('currentAnnata');
    
    const response = await fetch('/api/data', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId }
    });
    
    const rawData = await response.json();
    const data = rawData.data || rawData;
    if (data.calendarEvents && data.calendarEvents[date]) {
      delete data.calendarEvents[date];
    }
    
    const saveResponse = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId },
      body: JSON.stringify(data)
    });
    
    if (saveResponse.ok) {
      alert('✅ Evento eliminato!');
      location.reload();
    } else {
      alert('❌ Errore nel salvataggio!');
    }
  } catch(e) {
    console.error('[DELETE EVENT] ❌ Errore:', e);
    alert('❌ Errore: ' + e.message);
  }
};

window.editEvent = function(date) {
  const event = events[date];
  if (!event) {
    alert('❌ Evento non trovato!');
    return;
  }

  // Crea modal di modifica
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
  
  const dateFormatted = new Date(date).toLocaleDateString('it-IT', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });

  modal.innerHTML = `
    <div style="background:#0f172a;padding:30px;border-radius:15px;max-width:450px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.7);border:1px solid #1a3a5f;">
      <h3 style="margin:0 0 20px 0;color:#e2e8f0;display:flex;align-items:center;gap:10px;">
        ✏️ Modifica Evento
      </h3>
      <div style="margin-bottom:15px;">
        <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">📅 Data:</label>
        <input id="edit-event-date" type="date" value="${date}" 
          style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;color:#e2e8f0;box-sizing:border-box;" />
      </div>

      <div style="margin-bottom:15px;">
        <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">Tipo Evento:</label>
        <select id="edit-event-type" style="width:100%;padding:10px;border:1px solid #1a3a5f;border-radius:8px;font-size:1rem;color:#e2e8f0;background:#060f1e;">
          <option value="Allenamento" ${event.type === 'Allenamento' ? 'selected' : ''}>🏃 Allenamento</option>
          <option value="Partita" ${event.type === 'Partita' ? 'selected' : ''}>⚽ Partita</option>
          <option value="Torneo" ${event.type === 'Torneo' ? 'selected' : ''}>🏆 Torneo</option>
          <option value="Campionato" ${event.type === 'Campionato' ? 'selected' : ''}>🏅 Campionato</option>
          <option value="Finale" ${event.type === 'Finale' ? 'selected' : ''}>🥇 Finale</option>
          <option value="Semifinale" ${event.type === 'Semifinale' ? 'selected' : ''}>🥈 Semifinale</option>
          <option value="Individual" ${event.type === 'Individual' ? 'selected' : ''}>🏋️ Individual</option>
          <option value="Evento" ${event.type === 'Evento' ? 'selected' : ''}>📅 Evento</option>
          <option value="Visita" ${event.type === 'Visita' ? 'selected' : ''}>🏥 Visita</option>
        </select>
      </div>
      
      <div style="margin-bottom:15px;">
        <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">Nota breve <span style="font-weight:400;font-size:0.85rem;">(opzionale)</span></label>
        <input id="edit-event-note" type="text" value="${event.note || ''}" placeholder="Es. Campo Paradiso" maxlength="120"
          style="width:100%;padding:10px;border:1px solid #1a3a5f;border-radius:8px;font-size:1rem;color:#e2e8f0;background:#060f1e;box-sizing:border-box;" />
      </div>

      <div style="margin-bottom:20px;">
        <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">Orario (es. 18:00-19:30):</label>
        <input id="edit-event-time" type="text" value="${event.time}" 
          placeholder="es. 18:00-19:30"
          style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;color:#e2e8f0;box-sizing:border-box;" />
      </div>
      
      <div style="display:flex;gap:10px;">
        <button id="edit-save-btn"
          style="flex:1;background:#16a34a;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;font-size:1rem;">
          ✅ Salva
        </button>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="flex:1;background:#64748b;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;font-size:1rem;">
          ❌ Annulla
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Focus sull'input orario
  setTimeout(() => document.getElementById('edit-event-time').focus(), 100);

  // Handler salvataggio
  document.getElementById('edit-save-btn').onclick = async function() {
    const newDate = document.getElementById('edit-event-date').value;
    const newType = document.getElementById('edit-event-type').value;
    const newTime = document.getElementById('edit-event-time').value.trim();
    const newNote = (document.getElementById('edit-event-note') || {value:''}).value.trim();
    
    if (!newDate) {
      alert('⚠️ Inserisci una data!');
      return;
    }
    if (!newTime) {
      alert('⚠️ Inserisci un orario!');
      return;
    }
    
    // Aggiorna evento
    events[newDate] = { type: newType, time: newTime };
    // Se la data è cambiata, elimina quella vecchia
    if (newDate !== date) {
      delete events[date];
    }
    
    // Salva su server
    try {
      const annataId = currentAnnataId || 
                       sessionStorage.getItem('gosport_current_annata') ||
                       localStorage.getItem('currentAnnata');
      
      const response = await fetch('/api/data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Annata-Id': annataId
        }
      });
      
      const rawData = await response.json();
      const data = rawData.data || rawData;
      data.calendarEvents = data.calendarEvents || {};
      
      console.log('[EDIT EVENT] 📦 Dati caricati, events:', Object.keys(data.calendarEvents).length);
      
      // Se la data è cambiata, elimina quella vecchia
      if (newDate !== date && data.calendarEvents[date]) {
        delete data.calendarEvents[date];
        console.log('[EDIT EVENT] 🗑️ Eliminata vecchia data:', date);
      }
      const newAthleteEl = document.getElementById('new-event-athlete');
      const newAthleteName = (newType === 'Individual' && newAthleteEl) ? newAthleteEl.value : '';
      data.calendarEvents[newDate] = { type: newType, time: newTime, ...(newAthleteName ? { athleteName: newAthleteName } : {}), ...(newNote ? { note: newNote } : {}) };
      console.log('[EDIT EVENT] ✅ Aggiunto nuovo evento:', newDate, newType, newTime);
      
      const saveResponse = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Annata-Id': annataId
        },
        body: JSON.stringify(data)
      });
      
      if (saveResponse.ok) {
        alert('✅ Evento aggiornato!');
        modal.remove();
        location.reload();
      } else {
        alert('❌ Errore nel salvataggio!');
      }
    } catch(e) {
      console.error('[EDIT EVENT] ❌ Errore:', e);
      alert('❌ Errore: ' + e.message);
    }
  };
  
  // Chiudi cliccando fuori
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
};

window.generatePresenceLink = function(athleteId, athleteName) {
  // IMPORTANTE: Ottieni l'annata corrente
  const currentAnnata = sessionStorage.getItem('gosport_current_annata') ||
                        window.currentAnnata || 
                        localStorage.getItem('currentAnnata') || 
                        sessionStorage.getItem('gosport:currentannata');
  
  // Link con athleteId E annata
  const link = currentAnnata 
    ? `${window.location.origin}/calendario.html?athleteId=${athleteId}&annata=${currentAnnata}`
    : `${window.location.origin}/calendario.html?athleteId=${athleteId}`;
  
  console.log('[CALENDARIO] 🔗 Link generato:', {
    athleteId,
    athleteName,
    annata: currentAnnata,
    link
  });
  
  // Modal di visualizzazione del link
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:#0f172a;padding:30px;border-radius:15px;max-width:600px;width:90%;border:1px solid #1a3a5f;">
      <h3 style="margin:0 0 20px 0;color:#60a5fa">🔗 Link Conferma Presenze</h3>
      <p style="margin-bottom:15px;color:#e2e8f0"><strong>Atleta:</strong> ${athleteName}</p>
      <p style="margin-bottom:10px;color:#e2e8f0"><strong>ID Atleta:</strong> <code style="color:#f59e0b;">${athleteId}</code></p>
      ${currentAnnata ? `<p style="margin-bottom:10px;color:#e2e8f0"><strong>Annata:</strong> <code style="color:#f59e0b;">${currentAnnata}</code></p>` : ''}
      <div style="background:#060f1e;padding:15px;border-radius:8px;margin-bottom:20px;word-break:break-all;font-family:monospace;font-size:13px;color:#60a5fa;border:1px solid #1a3a5f;">
        ${link}
      </div>
      <div style="display:flex;gap:10px">
        <button onclick="navigator.clipboard.writeText('${link}').then(() => alert('✅ Link copiato!')).catch(() => alert('❌ Errore'))" 
                style="flex:1;background:#16a34a;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600">
          📋 Copia Link
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                style="flex:1;background:#64748b;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600">
          ❌ Chiudi
        </button>
      </div>
      <div style="margin-top:20px;padding:15px;background:#1e293b;border-radius:8px;font-size:14px;color:#e2e8f0">
        <strong>📨 Invia questo link al genitore</strong><br>
        Il genitore potrà confermare presenza/assenza senza bisogno di login.
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
};

async function genTraining() {
  // Implementazione generazione allenamenti
  alert('Funzione non implementata in questa versione');
}

window.markAbsence = markAbsence;
// Funzione per il pulsante "Nuovo"
window.addEvent = function() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
  
  const today = new Date().toISOString().split('T')[0];
  
  modal.innerHTML = `
    <div style="background:#0f172a;padding:30px;border-radius:15px;max-width:450px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.7);border:1px solid #1a3a5f;">
      <h3 style="margin:0 0 20px 0;color:#e2e8f0;display:flex;align-items:center;gap:10px;">
        ➕ Nuovo Evento
      </h3>
      
      <div style="margin-bottom:15px;">
        <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">📅 Data:</label>
        <input id="new-event-date" type="date" value="${today}"
          style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;color:#e2e8f0;box-sizing:border-box;" />
      </div>

      <div style="margin-bottom:15px;">
        <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">Tipo Evento:</label>
        <select id="new-event-type" style="width:100%;padding:10px;border:1px solid #1a3a5f;border-radius:8px;font-size:1rem;color:#e2e8f0;background:#060f1e;">
          <option value="Allenamento">🏃 Allenamento</option>
          <option value="Partita">⚽ Partita</option>
          <option value="Torneo">🏆 Torneo</option>
          <option value="Campionato">🏅 Campionato</option>
          <option value="Finale">🥇 Finale</option>
          <option value="Semifinale">🥈 Semifinale</option>
          <option value="Individual">🏋️ Individual</option>
          <option value="Evento">📅 Evento</option>
          <option value="Visita">🏥 Visita</option>
        </select>
      </div>

      <div style="margin-bottom:15px;">
        <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">Nota breve <span style="font-weight:400;font-size:0.85rem;">(opzionale, max 15 parole)</span></label>
        <input id="new-event-note" type="text" placeholder="Es. Campo Paradiso, San Michele..." maxlength="120"
          style="width:100%;padding:10px;border:1px solid #1a3a5f;border-radius:8px;font-size:1rem;color:#e2e8f0;background:#060f1e;box-sizing:border-box;" />
      </div>
      
      <div style="margin-bottom:20px;">
        <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">Orario (es. 18:00-19:30):</label>
        <div id="individual-athlete-group-new" style="display:none;margin-bottom:12px;">
          <label style="display:block;font-weight:600;color:#60a5fa;margin-bottom:6px;">Atleta:</label>
          <select id="new-event-athlete" style="width:100%;padding:10px;border:1px solid #1a3a5f;border-radius:8px;font-size:1rem;color:#e2e8f0;background:#060f1e;">
            <option value="">-- Seleziona atleta --</option>
            ${athletes.filter(a=>!a.isGuest).map(a=>`<option value="${a.name}">${a.name}</option>`).join('')}
          </select>
        </div>
        <input id="new-event-time" type="text" placeholder="es. 18:00-19:30"
          style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;color:#e2e8f0;box-sizing:border-box;" />
      </div>
      
      <div style="display:flex;gap:10px;">
        <button id="new-save-btn"
          style="flex:1;background:#16a34a;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;font-size:1rem;">
          ✅ Salva
        </button>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="flex:1;background:#64748b;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;font-size:1rem;">
          ❌ Annulla
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('new-event-time').focus(), 100);

  // Mostra campo atleta solo per Individual
  document.getElementById('new-event-type').addEventListener('change', function() {
    const grp = document.getElementById('individual-athlete-group-new');
    if (grp) grp.style.display = this.value === 'Individual' ? 'block' : 'none';
  });
  
  document.getElementById('new-save-btn').onclick = async function() {
    const newDate = document.getElementById('new-event-date').value;
    const newType = document.getElementById('new-event-type').value;
    const newTime = document.getElementById('new-event-time').value.trim();
    const newNote = (document.getElementById('new-event-note') || {value:''}).value.trim();
    
    if (!newDate) { alert('⚠️ Inserisci una data!'); return; }
    if (!newTime) { alert('⚠️ Inserisci un orario!'); return; }
    
    try {
      const annataId = currentAnnataId || 
                       sessionStorage.getItem('gosport_current_annata') ||
                       localStorage.getItem('currentAnnata');
      
      const response = await fetch('/api/data', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId }
      });
      
      const rawData = await response.json();
      const data = rawData.data || rawData;
      data.calendarEvents = data.calendarEvents || {};
      data.calendarEvents[newDate] = { type: newType, time: newTime, ...(newNote ? { note: newNote } : {}) };
      
      console.log('[ADD EVENT] ✅ Aggiunto:', newDate, newType, newTime);
      
      const saveResponse = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId },
        body: JSON.stringify(data)
      });
      
      if (saveResponse.ok) {
        alert('✅ Evento aggiunto!');
        modal.remove();
        location.reload();
      } else {
        alert('❌ Errore nel salvataggio!');
      }
    } catch(e) {
      console.error('[ADD EVENT] ❌ Errore:', e);
      alert('❌ Errore: ' + e.message);
    }
  };
  
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
};

// Funzione per il pulsante "Importa"
window.importData = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        // Importa i dati
        alert('✅ Dati importati con successo!');
        location.reload();
      } catch (err) {
        alert('❌ Errore: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

// Funzione per il pulsante "Risposte"
window.showResponses = function() {
  alert('Funzione Risposte non ancora implementata');
};

// Funzione per il pulsante "Elimina Vecchi"
window.deleteOldEvents = async function() {
  var _doPwd2 = prompt('🔐 Elimina TUTTI gli eventi passati e le relative presenze/assenze.\nPassword:');
  if (_doPwd2 === null) return;
  if (_doPwd2 !== '1234') { alert('❌ Password errata.'); return; }

  try {
    const today = new Date().toISOString().split('T')[0];
    const annataId = await getAnnataId();

    // Carica i dati aggiornati dal server
    const r = await fetch('/api/data', {
      cache: 'no-store',
      headers: annataId ? { 'X-Annata-Id': annataId } : {}
    });
    const data = await r.json();

    let deleted = 0;

    // Cancella eventi passati
    Object.keys(data.calendarEvents || {}).forEach(date => {
      if (date < today) {
        delete data.calendarEvents[date];
        deleted++;
      }
    });

    // Cancella anche le risposte per le date eliminate
    if (data.calendarResponses) {
      Object.keys(data.calendarResponses).forEach(date => {
        if (date < today) {
          delete data.calendarResponses[date];
        }
      });
      // Pulisci anche se le risposte sono indicizzate per atleta
      Object.keys(data.calendarResponses).forEach(key => {
        if (typeof data.calendarResponses[key] === 'object' && !Array.isArray(data.calendarResponses[key])) {
          Object.keys(data.calendarResponses[key]).forEach(date => {
            if (date < today) delete data.calendarResponses[key][date];
          });
        }
      });
    }

    // Salva su Redis con il corretto header annata
    const saveResp = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(annataId ? { 'X-Annata-Id': annataId } : {})
      },
      body: JSON.stringify(data)
    });

    if (!saveResp.ok) throw new Error(`Salvataggio fallito: HTTP ${saveResp.status}`);

    // Aggiorna la variabile locale e ridisegna
    events = data.calendarEvents || {};
    alert(`✅ ${deleted} eventi eliminati!\nIl calendario personale degli atleti è aggiornato.`);
    location.reload();

  } catch(e) {
    alert('❌ Errore: ' + e.message);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  load();
});

// ═══════════════════════════════════════════════════════════════════
// ████  BACHECA GENITORI  ████  (Step 3 — solo lettura)
// ═══════════════════════════════════════════════════════════════════
async function loadBachecaGenitori(cachedData) {
  const box = document.getElementById('bacheca-genitori-container');
  if (!box) return;
  box.style.display = '';
  box.innerHTML = `
    <div style="background:#1a3a5f;border:1px solid #3b5a9d;border-radius:12px;
                padding:20px;margin-top:12px;">
      <div style="color:#ffffff;font-size:1rem;font-weight:700;margin-bottom:14px;
                  display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span>📋</span> Bacheca Comunicazioni
        <button id="doc-upload-btn"
          style="margin-left:auto;background:#16a34a;color:#fff;border:none;border-radius:8px;
                 padding:7px 14px;font-size:0.82rem;font-weight:700;cursor:pointer;">
          📎 Carica Documenti
        </button>
      </div>
      <div id="bacheca-genitori-list" style="color:#64748b;font-size:0.85rem;">
        Caricamento comunicati...
      </div>
    </div>`;

  try {
    // Fetch identica al calendario iniziale (stesse opzioni che funzionano per atleti/eventi)
    const annataId = await getAnnataId();
    console.log('[Bacheca Genitori] 🔄 annataId:', annataId);
    // ✅ FIX 1 — fetch principale
const response = await fetch(`/api/data?parentMode=1`, {
  cache: 'no-store',
  headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId }
});

// ✅ FIX 2 — fetch lazy postImages (già ha ?action=postImages, aggiungi &parentMode=1)

    const result = await response.json();
    const d = result.data || result;

    // LOG COMPLETO per diagnosi

    const globalPosts = (d && d.globalPosts) || [];
    const annaPosts   = (d && d.posts)       || [];

    const all = [...globalPosts, ...annaPosts].sort(function(a, b) {
      if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return new Date(b.date || 0) - new Date(a.date || 0);
    });

    // Render iniziale senza immagini
    renderBachecaGenitori(all, {});

    // Collega pulsante upload documenti — ricarica sempre dati freschi al click
    const athleteIdParam = new URLSearchParams(window.location.search).get('athleteId');
    const uploadBtn = document.getElementById('doc-upload-btn');
    if (uploadBtn && athleteIdParam) {
      uploadBtn.addEventListener('click', async function() {
        // Ricarica dati freschi per avere stato aggiornato
        try {
          const freshRes = await fetch('/api/data?parentMode=1', {
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId }
          });
          const freshData = freshRes.ok ? (await freshRes.json()) : {};
          window._showDocUploadPanel(athleteIdParam, annataId, freshData.athleteDocs || {});
        } catch(e) {
          window._showDocUploadPanel(athleteIdParam, annataId, {});
        }
      });
    }

    // Mostra sezione documenti nella pagina genitore (sempre visibile)
    if (athleteIdParam) {
      window._renderParentDocsSection(athleteIdParam, annataId, d.athleteDocs || {});
    }

    // Mostra documenti pubblici
    const docs = (d && d.documents) || [];
    const pubDocs = docs.filter(function(doc) {
        return (doc.visibility||[]).includes('pubblica');
    });
    if (pubDocs.length > 0) renderDocumentiGenitori(pubDocs);

        // Abbigliamento atleta
const mat = (d && d.materiale) || { items: [], assignments: {} };
if (currentAthleteId && mat.items && mat.assignments) {
    window._lastMateriale = mat;
    window._lastAthleteId = String(currentAthleteId);
    renderMaterialeGenitore(mat, String(currentAthleteId));  // ← CHIAMA la funzione
}

    // ── BANNER SPONSOR (v1.5.16): legge bachecaConfig inclusa nella risposta parentMode ──
    // FIX v1.5.21: controlla flag bannersEnabled (default true se non definito)
    try {
      var spCfg = (d && d.bachecaConfig) || {};
      var bannersEnabled = spCfg.bannersEnabled !== false; // default true
      if (bannersEnabled) {
        var spSlots = [0,1,2,3,4]
          .map(function(k){ return spCfg[k] || {}; })
          .filter(function(s){ return s.img && s.img.trim(); });
        if (spSlots.length > 0) showSponsorBannerOverlay(spSlots);
      } else {
        console.log('[Banner] Banner sponsor disabilitati dal coach.');
      }
    } catch(e) { console.warn('[Banner] err:', e); }

    // Carica immagini in background (lazy)
    if (all.length > 0) {
      try {
        const imgRes = await fetch('/api/data?action=postImages&parentMode=1', {
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId }
        });
        const imgData = await imgRes.json();
        const postImages = (imgData && imgData.postImages) || {};
        if (Object.keys(postImages).length > 0) {
          renderBachecaGenitori(all, postImages);
        }
      } catch(e) { console.warn('[Bacheca Genitori] immagini err:', e); }
    }
  } catch(e) {
    console.warn('[Bacheca Genitori] errore:', e);
    const list = document.getElementById('bacheca-genitori-list');
    if (list) list.innerHTML = '<span style="color:#64748b;">Nessun comunicato disponibile.</span>';
  }
}

function renderDocumentiGenitori(docs) {
  var box = document.getElementById('bacheca-genitori-container');
  if (!box || !docs.length) return;
  var h = '<div style="background:#1a3a5f;border:1px solid #3b5a9d;border-radius:12px;padding:20px;margin-top:12px;">';
  h += '<div style="color:#ffffff;font-size:1rem;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;"><span>📁</span> Documenti Società</div>';
  docs.forEach(function(doc) {
    h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0f172a;border-radius:8px;margin-bottom:8px;">';
    h += '<i class="bi bi-file-earmark-text-fill" style="color:#60a5fa;font-size:1.2rem;flex-shrink:0;"></i>';
    h += '<div style="flex:1;"><div style="color:#e2e8f0;font-weight:600;font-size:0.9rem;">' + doc.name + '</div>';
    if (doc.desc) h += '<div style="color:#64748b;font-size:0.78rem;">' + doc.desc + '</div></div>';
    h += '</div><a href="' + doc.url + '" target="_blank" style="background:#1a3a5f;color:#60a5fa;border-radius:5px;padding:5px 10px;font-size:0.78rem;text-decoration:none;flex-shrink:0;white-space:nowrap;"><i class="bi bi-box-arrow-up-right"></i> Apri</a>';
    h += '</div>';
  });
  h += '</div>';
  box.insertAdjacentHTML('beforeend', h);
}

function renderBachecaGenitori(posts, images) {
  const list = document.getElementById('bacheca-genitori-list');
  if (!list) return;

  if (!posts.length) {
    list.innerHTML = `
      <div style="text-align:center;padding:24px 0;color:#64748b;">
        <div style="font-size:2rem;opacity:0.4;">📢</div>
        <p style="margin-top:8px;font-size:0.85rem;">Nessun comunicato pubblicato.</p>
      </div>`;
    return;
  }

  let h = '<div style="display:flex;flex-direction:column;gap:10px;">';
  posts.forEach(p => {
    const img    = images[p.id] || '';
    const pinned = p.pinned ? '📌 ' : '';
    const dateStr = p.date
      ? new Date(p.date).toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'})
      : '';
    const isGlobal = p.visibility === 'global';
    // FIX v1.5.21: badge bacheca con testo bianco
    // Bug 1: "Comunicato societa'" aveva color:#16a34a su #16a34a (verde su verde = invisibile, refuso)
    // Bug 2: "Questa stagione" aveva color:#60a5fa su #0d1b2a, in tema chiaro era scuro su scuro
    // Ora: testo bianco su sfondo verde brillante / viola brillante, leggibile in entrambi i temi
    const badge = isGlobal
      ? `<span style="font-size:0.7rem;padding:2px 8px;background:#16a34a;color:#ffffff;
                      border-radius:10px;font-weight:600;">🌐 Comunicato società</span>`
      : `<span style="font-size:0.7rem;padding:2px 8px;background:#7c3aed;color:#ffffff;
                      border-radius:10px;font-weight:600;">👥 Questa stagione</span>`;

    h += `<div style="background:#0d1b2a;border:1px solid #3b5a9d;border-radius:10px;
                      padding:14px;display:flex;gap:12px;align-items:flex-start;
                      ${p.pinned?'border-color:#f59e0b;':''}" >`;

    if (img) {
      h += `<img src="${img}" alt="" style="width:80px;height:80px;object-fit:cover;
                  border-radius:8px;flex-shrink:0;cursor:zoom-in;"
                  onclick="event.stopPropagation();
                  (function(s){
                    var e=document.getElementById('_img_lightbox');if(e)e.remove();
                    var o=document.createElement('div');
                    o.id='_img_lightbox';
                    o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
                    o.onclick=function(){o.remove();};
                    var i=document.createElement('img');
                    i.src=s;i.style.cssText='max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.6);object-fit:contain;';
                    i.onclick=function(e){e.stopPropagation();};
                    var b=document.createElement('button');
                    b.textContent='✕';b.style.cssText='position:fixed;top:16px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;z-index:100000;';
                    b.onclick=function(){o.remove();};
                    o.appendChild(i);o.appendChild(b);document.body.appendChild(o);
                  })(this.src);">`; 
    }

    h += `<div style="flex:1;min-width:0;">`;
    h += `<div style="color:#ffffff;font-weight:700;font-size:0.95rem;margin-bottom:4px;">${pinned}${p.title||''}</div>`;
    if (p.text) {
      h += `<div style="color:#60a5fa;font-size:0.85rem;white-space:pre-wrap;
                        word-break:break-word;margin-bottom:6px;">${p.text}</div>`;
    }
    // FIX v1.5.21: se il post ha convData, mostra pulsante per aprire il PDF
    if (p.convData) {
      const cdStr = encodeURIComponent(JSON.stringify(p.convData));
      h += `<div style="margin-bottom:6px;">
        <button class="_conv-pdf-btn" data-cd="${cdStr.replace(/"/g,'&quot;')}"
        style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:0.8rem;cursor:pointer;font-weight:600;">
          📄 Salva PDF Convocazione
        </button>
      </div>`;
    }
    h += `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${badge}
            <span style="color:#60a5fa;font-size:0.75rem;">${dateStr}</span>
          </div>`;
    h += `</div></div>`;
  });
  h += '</div>';
  list.innerHTML = h;

  // FIX v1.5.21: event listener per pulsanti "Salva PDF Convocazione"
  list.querySelectorAll('._conv-pdf-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cd = btn.getAttribute('data-cd');
      if (cd && window._openConvPdf) window._openConvPdf(cd);
    });
  });
}
function renderMaterialeGenitore(materiale, athleteId) {
// Salva per re-render al cambio tema
  const box = document.getElementById('bacheca-genitori-container');
  if (!box) return;

  const athId = String(athleteId);
  const assignments = (materiale.assignments || {})[athId] || {};
  const items = materiale.items || [];

  const assegnati = items.filter(itemName => {
    if (itemName === '_numero') return false;
    const val = assignments[itemName];
    return val !== undefined && val !== null && val !== '';
  });

  const numeroMaglia = assignments._numero || '';
  if (!assegnati.length && !numeroMaglia) return;

  // Rileva tema
  const isLight = document.documentElement.classList.contains('theme-light')
               || document.body.classList.contains('theme-light')
               || document.documentElement.getAttribute('data-bs-theme') === 'light';

  // ── Tema CHIARO: tutto nero su bianco/grigio chiarissimo ──────────────
  // ── Tema SCURO:  tutto bianco/azzurro su blu scuro ────────────────────
  const C = isLight ? {
    cardBg:         '#f5f5f5',
    cardBorder:     '#cccccc',
    title:          '#000000',
    rowBg:          '#ffffff',
    rowBorder:      '#cccccc',
    label:          '#000000',
    value:          '#1a3a5f',
    icon:           '#1a3a5f',
    // ✅ consegnato - verde PASTELLO chiaro
    okBg:           '#bbf7d0',
    okBorder:       '#4caf50',
    okLabel:        '#14532d',
    okValue:        '#166534',
    okIcon:         '#16a34a',
    // 🟠 restituito - arancione chiaro
    retBg:          '#ffedd5',   // ← arancione pastello
    retBorder:      '#f97316',   // ← bordo arancione
    retLabel:       '#7f1d1d',   // invariato
    retValue:       '#991b1b',   // invariato
    retIcon:        '#dc2626',   // invariato
    // 🔵 neutro - blu PASTELLO chiaro
    neutralBg:      '#dbeafe',
    neutralBorder:  '#93c5fd',
    neutralLabel:   '#1e3a5f',
    neutralValue:   '#1d4ed8',
    neutralIcon:    '#2563eb',
} : {
    // ── TEMA SCURO — colori ORIGINALI scuri intensi ──
    cardBg:         '#1a3a5f',
    cardBorder:     '#3b5a9d',
    title:          '#ffffff',
    rowBg:          '#0f172a',
    rowBorder:      '#1a3a5f',
    label:          '#e2e8f0',
    value:          '#60a5fa',
    icon:           '#60a5fa',
    // ✅ consegnato - verde SCURO intenso originale
    okBg:           '#123a28',
    okBorder:       '#16a34a',
    okLabel:        '#e2e8f0',
    okValue:        '#60a5fa',
    okIcon:         '#60a5fa',
    // 🟠 restituito - arancione scuro intenso
    retBg:          '#b44b05',   // ← arancione scuro
    retBorder:      '#ea580c',   // ← bordo arancione
    retLabel:       '#fecaca',   // invariato
    retValue:       '#fca5a5',   // invariato
    retIcon:        '#ef4444',   // invariato
    // ⚪ neutro - blu-nero originale
    neutralBg:      '#0f172a',
    neutralBorder:  '#1a3a5f',
    neutralLabel:   '#e2e8f0',
    neutralValue:   '#60a5fa',
    neutralIcon:    '#60a5fa',
};

  let h = `<div data-materiale="true" style="background:${C.cardBg};border:1px solid ${C.cardBorder};border-radius:12px;padding:20px;margin-top:12px;">`;
  h += `<div style="color:${C.title};font-size:1rem;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <span>👕</span> Materiale Atleta
        </div>`;

  if (numeroMaglia) {
    h += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${C.rowBg};border-radius:8px;margin-bottom:10px;border:1px solid ${C.rowBorder};">
            <i class="bi bi-hash" style="color:${C.icon};font-size:1rem;flex-shrink:0;"></i>
            <div style="flex:1;">
              <div style="color:${C.label};font-weight:600;font-size:0.9rem;">Numero maglia</div>
              <div style="color:${C.value};font-size:0.82rem;"><strong>${numeroMaglia}</strong></div>
            </div>
          </div>`;
  }

  h += `<div style="display:flex;flex-direction:column;gap:8px;">`;

  assegnati.forEach(itemName => {
    const val = assignments[itemName];
    let detail = '';
    let statoRaw = '';
    let isOk = false;

    if (typeof val === 'object' && val !== null) {
      const stato = val.status || val.stato || '';
      const qty   = val.qty || val.quantita || val.qta || '';
      const taglia = val.taglia || val.size || '';
      statoRaw = String(stato).toLowerCase().trim();
      isOk = statoRaw === 'consegnato';
      detail = [
        stato  ? `Stato: <strong>${stato}</strong>`   : '',
        qty    ? `Qtà: <strong>${qty}</strong>`        : '',
        taglia ? `Taglia: <strong>${taglia}</strong>`  : ''
      ].filter(Boolean).join(' · ');
    } else {
      detail = `<strong>${val}</strong>`;
    }
const isRet = statoRaw === 'restituito';

const bg     = isOk ? C.okBg           : isRet ? C.retBg      : C.neutralBg;
const border = isOk ? C.okBorder       : isRet ? C.retBorder   : C.neutralBorder;
const lbl    = isOk ? C.okLabel        : isRet ? C.retLabel    : C.neutralLabel;
const val2   = isOk ? C.okValue        : isRet ? C.retValue    : C.neutralValue;
const ico    = isOk ? C.okIcon         : isRet ? C.retIcon     : C.neutralIcon;

    h += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                      background:${bg};border-radius:8px;border:1px solid ${border};">
            <i class="bi bi-tag-fill" style="color:${ico};font-size:1rem;flex-shrink:0;"></i>
            <div style="flex:1;">
              <div style="color:${lbl};font-weight:600;font-size:0.9rem;">${itemName}</div>
              <div style="color:${val2};font-size:0.82rem;">${detail || 'Assegnato'}</div>
            </div>
          </div>`;
  });

  h += `</div></div>`;
  box.insertAdjacentHTML('beforeend', h);
}

// ═══ FINE BACHECA GENITORI ═══════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// ████  BANNER SPONSOR OVERLAY  (aggiunto v1.5.16)
// ═══════════════════════════════════════════════════════════════════
window.showSponsorBannerOverlay = function(slots) {
  if (!slots || !slots.length) return;
  if (window._bannerShown) return;
  window._bannerShown = true;

  var existing = document.getElementById('sponsor-overlay-container');
  if (existing) existing.remove();

  var container = document.createElement('div');
  container.id = 'sponsor-overlay-container';
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:min(340px,calc(100vw - 32px));';
  document.body.appendChild(container);

  slots.forEach(function(slot, idx) {
    setTimeout(function() {
      var card = document.createElement('div');
      card.style.cssText = 'background:rgba(13,27,42,0.97);border:1px solid #3b5a9d;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:auto;opacity:0;transform:translateY(20px);transition:opacity 0.4s ease,transform 0.4s ease;cursor:'+(slot.link?'pointer':'default')+';';

      var img = document.createElement('img');
      img.src = slot.img; img.alt = 'Sponsor';
      img.style.cssText = 'width:100%;max-height:160px;object-fit:cover;display:block;';
      img.onerror = function(){ card.remove(); };
      card.appendChild(img);

      var bar = document.createElement('div');
      bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(26,58,95,0.95);';
      var lbl = document.createElement('span');
      lbl.style.cssText = 'color:#f59e0b;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;';
      lbl.textContent = '⭐ SPONSOR';
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'background:none;border:none;color:#60a5fa;cursor:pointer;font-size:0.85rem;padding:2px 6px;line-height:1;';
      closeBtn.onclick = function(e){ e.stopPropagation(); fadeOutCard(card); };
      bar.appendChild(lbl); bar.appendChild(closeBtn);
      card.appendChild(bar);

      if (slot.link) card.onclick = function(){ window.open(slot.link,'_blank','noopener'); };
      container.appendChild(card);

      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        card.style.opacity='1'; card.style.transform='translateY(0)';
      }); });
      setTimeout(function(){ fadeOutCard(card); }, 6000);
    }, idx * 800);
  });

  function fadeOutCard(card){
    card.style.opacity='0'; card.style.transform='translateY(20px)';
    setTimeout(function(){ if(card.parentNode) card.parentNode.removeChild(card); }, 400);
  }
};
// Elimina un singolo documento
window._deleteAthleteDoc = async function(athleteId, annataId, docKey) {
  if (!confirm('Eliminare questo documento?')) return;
  try {
    var res = await fetch('/api/data?parentMode=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId },
      body: JSON.stringify({ athleteDocs: { [String(athleteId)]: { [docKey]: null } } })
    });
    if (res.ok) {
      alert('✅ Documento eliminato.');
      document.getElementById('_doc_upload_overlay')?.remove();
      // Ricarica sezione documenti
      const freshRes = await fetch('/api/data?parentMode=1', {
        cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId }
      });
      if (freshRes.ok) {
        const fd = await freshRes.json();
        window._renderParentDocsSection(athleteId, annataId, fd.athleteDocs || {});
      }
    } else { alert('❌ Errore: HTTP ' + res.status); }
  } catch(e) { alert('❌ Errore: ' + e.message); }
};

// Renderizza la sezione documenti nella pagina genitore (sempre visibile)
window._renderParentDocsSection = function(athleteId, annataId, allDocs) {
  var myDocs = (allDocs && allDocs[String(athleteId)]) || {};
  var container = document.getElementById('parent-docs-section');
  if (!container) {
    container = document.createElement('div');
    container.id = 'parent-docs-section';
    container.style.cssText = 'margin-top:12px;';
    var bachecaBox = document.getElementById('bacheca-genitori-container');
    if (bachecaBox && bachecaBox.parentNode) {
      bachecaBox.parentNode.insertBefore(container, bachecaBox.nextSibling);
    }
  }

  var annataEncoded = encodeURIComponent(annataId);
  var html = '<div style="background:#1a3a5f;border:1px solid #3b5a9d;border-radius:12px;padding:20px;">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">'
    + '<span style="color:#ffffff;font-size:1rem;font-weight:700;">📎 I miei Documenti</span>'
    + '<button id="manage-docs-btn" data-aid="' + athleteId + '" data-annata="' + annataId + '" '
    + 'style="margin-left:auto;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:0.82rem;font-weight:700;cursor:pointer;">✏️ Gestisci / Aggiungi</button>'
    + '</div>';

  var hasAny = false;
  _DOC_TYPES.forEach(function(dt) {
    var doc = myDocs[dt.key];
    if (doc && doc.url) {
      hasAny = true;
      var date = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('it-IT') : '';
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(59,90,157,0.4);flex-wrap:wrap;">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="color:#e2e8f0;font-size:0.88rem;font-weight:600;">' + dt.label + '</div>'
        + '<div style="color:#64748b;font-size:0.75rem;">Caricato il ' + date + '</div>'
        + '</div>'
        + '<a href="' + doc.url + '" target="_blank" '
        + 'style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:0.8rem;text-decoration:none;white-space:nowrap;">🔗 Apri</a>'
        + '<button data-del-aid="' + athleteId + '" data-del-annata="' + annataId + '" data-del-key="' + dt.key + '" '
        + 'style="background:#450a0a;color:#d90429;border:1px solid #d90429;border-radius:6px;padding:6px 10px;font-size:0.8rem;cursor:pointer;white-space:nowrap;">🗑️</button>'
        + '</div>';
    }
  });

  if (!hasAny) {
    html += '<p style="color:#64748b;font-size:0.85rem;margin:0;">Nessun documento caricato. Clicca "Gestisci / Aggiungi" per aggiungerne.</p>';
  }
  html += '</div>';
  container.innerHTML = html;

  // Event listeners sicuri (no inline onclick)
  var manageBtn = container.querySelector('#manage-docs-btn');
  if (manageBtn) {
    manageBtn.addEventListener('click', async function() {
      var aid = this.dataset.aid, ann = this.dataset.annata;
      try {
        var r = await fetch('/api/data?parentMode=1', { cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Annata-Id': ann } });
        var fd = r.ok ? await r.json() : {};
        window._showDocUploadPanel(aid, ann, fd.athleteDocs || {});
      } catch(e) { window._showDocUploadPanel(aid, ann, {}); }
    });
  }
  container.querySelectorAll('[data-del-aid]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      window._deleteAthleteDoc(btn.dataset.delAid, btn.dataset.delAnnata, btn.dataset.delKey);
    });
  });
};

// FIX v1.5.21: apre la convocazione con layout originale (sfondo, loghi, colori societari)
// Recupera i settings dal backend e ricostruisce l'HTML identico a convStampa in index.html
window._openConvPdf = async function(cdEncoded) {
  try {
    var cd = JSON.parse(decodeURIComponent(cdEncoded));
    var isPre = cd.isPre || false;

    // Recupera settings convocazione (sfondo, logo, sponsor) dal backend
    var annataId = '';
    try { annataId = sessionStorage.getItem('gosport_current_annata') || ''; } catch(e){}
    var urlParams = new URLSearchParams(window.location.search);
    var annataFromUrl = urlParams.get('annata');
    if (annataFromUrl) annataId = annataFromUrl;

    var s = { textColor: '#ffffff', textColor2: '#000000', firma: 'Sport Monitoring' };

    // Se il post ha già i settings salvati, usali direttamente (più veloci e annata corretta)
    if (cd._settings) {
      s.textColor = cd._settings.textColor || '#ffffff';
      s.firma     = cd._settings.firma     || 'Sport Monitoring';
      s.logo      = cd._settings.logo      || '';
      s.sponsor   = cd._settings.sponsor   || '';
      s._bg       = cd._settings._bg       || '';
    } else {
      // Fallback: fetch dal backend (vecchi post senza _settings)
      try {
        var res = await fetch('/api/data?parentMode=1', {
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId }
        });
        if (res.ok) {
          var d = await res.json();
          var cs = d.convSettings || {};
          s.textColor = cs.textColor || '#ffffff';
          s.firma     = cs.firma     || 'Sport Monitoring';
          s.logo      = cs.logo      || '';
          s.sponsor   = cs.sponsor   || '';
          s._bg       = (cd.isPre ? d.convBg2 : d.convBg) || '';
        }
      } catch(e) { console.warn('[ConvPdf] settings err:', e); }
    }

    var bgImg    = s._bg || '';
    var txtColor = s.textColor || '#ffffff';
    var dataLabel = cd.data ? new Date(cd.data+'T00:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
    var mapsUrl = cd.luogo ? 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(cd.luogo) : '#';

    // Atleti in 2 colonne
    var atleti = cd.atletiIds || [];
    var meta = Math.ceil(atleti.length/2);
    var col1 = atleti.slice(0, meta), col2 = atleti.slice(meta);
    var atletiRows = '';
    for (var i=0; i<Math.max(col1.length,col2.length); i++) {
      atletiRows += '<tr>'
        +'<td>'+(col1[i]?col1[i]+'<span class="sig-line"></span>':'')+'</td>'
        +'<td>'+(col2[i]?col2[i]+'<span class="sig-line"></span>':'')+'</td>'
        +'</tr>';
    }

    // Staff in 2 colonne (allenatori / dirigenti)
    var staff = cd.staffIds || [];
    var allenatori = staff.filter(function(n){ return cd.staffRoles ? cd.staffRoles[n]==='allenatore' : true; });
    var dirigenti  = staff.filter(function(n){ return allenatori.indexOf(n)<0; });
    // Se non abbiamo distinzione ruoli, mettiamo tutti in allenatori
    if (dirigenti.length === 0 && allenatori.length === staff.length) {
      allenatori = staff; dirigenti = [];
    }
    var staffRows = '';
    for (var si=0; si<Math.max(allenatori.length, dirigenti.length); si++) {
      var bg = si%2===0 ? ('background:rgba('+(isPre?'0,0,0':'255,255,255')+',0.06);') : '';
      staffRows += '<div class="staff-col-row" style="'+bg+'">'
        +'<div class="staff-col">'+(allenatori[si]||'')+'</div>'
        +'<div class="staff-col">'+(dirigenti[si]||'')+'</div>'
        +'</div>';
    }

    var logoCenter = s.logo
      ? '<img src="'+s.logo+'" style="height:100px;object-fit:contain;">'
      : '<span style="font-size:2rem;font-weight:900;color:'+txtColor+';">SPORT<br>MONITORING</span>';
    var logoSponsor = s.sponsor ? '<img src="'+s.sponsor+'" style="height:100px;object-fit:contain;">' : '';

    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">'
      +'<title>Convocazione '+cd.categoria+'</title>'
      +'<style>'
      +'*{margin:0;padding:0;box-sizing:border-box;}'
      +'@page{size:A4 portrait;margin:0;height:297mm;}'
      +'html,body{margin:0;padding:0;display:flex;justify-content:center;align-items:flex-start;height:297mm;max-height:297mm;overflow:hidden;}'
      +'*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}'
      +'.page{width:210mm;height:297mm;max-height:297mm;overflow:hidden;position:relative;flex-shrink:0;}'
      +'.bg-img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;display:block;}'
      +'.overlay{position:absolute;inset:0;background:'+(isPre?'rgba(240,240,240,0.55)':'rgba(0,0,0,0.40)')+';padding:0 20px 12px 20px;display:flex;flex-direction:column;gap:7px;overflow:hidden;z-index:1;}'
      +'.top-logos{display:flex;justify-content:space-between;align-items:center;min-height:40mm;padding-top:1mm;}'
      +'.top-logos div{flex:1;display:flex;justify-content:center;align-items:center;}'
      +'.categoria{text-align:center;font-size:2.4rem;font-weight:900;text-transform:uppercase;letter-spacing:3px;text-shadow:2px 2px 6px rgba(0,0,0,0.7);}'
      +'.conv-box{background:transparent;border-radius:10px;padding:10px 20px;text-align:center;}'
      +'.conv-box .tipo{font-size:1.1rem;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;}'
      +'.conv-box .avv{font-size:1.6rem;font-weight:400;}'
      +'.info-row{display:flex;gap:12px;}'
      +'.info-box{flex:1;background:rgba('+(isPre?'0,0,0':'255,255,255')+',0.08);border:1px solid rgba('+(isPre?'0,0,0':'255,255,255')+',0.2);border-radius:8px;padding:9px;text-align:center;}'
      +'.info-box .lbl{font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;color:'+txtColor+';}'
      +'.info-box .val{font-size:1.2rem;font-weight:400;color:'+txtColor+';}'
      +'.luogo-box{background:transparent;border-radius:8px;padding:12px 18px;text-align:center;}'
      +'.luogo-box .lbl{font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;color:'+txtColor+';}'
      +'.luogo-box a{color:#60a5fa;font-size:0.95rem;text-decoration:none;}'
      +'.note-box{background:transparent;border-radius:8px;padding:10px 18px;}'
      +'.note-box .lbl{font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:'+txtColor+';margin-bottom:4px;}'
      +'.note-box .note-text{color:'+txtColor+';font-size:0.85rem;}'
      +'.staff-section{padding:0 8px;}'
      +'.col-title{font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:2px;border-bottom:1px solid '+txtColor+';padding-bottom:4px;margin-bottom:6px;}'
      +'.staff-col-row{display:flex;gap:0;}'
      +'.staff-col-header{flex:1;font-size:0.65rem;font-weight:800;text-transform:uppercase;color:'+txtColor+';letter-spacing:1px;padding:4px 8px;}'
      +'.staff-col{flex:1;font-size:0.82rem;color:'+txtColor+';padding:3px 8px;}'
      +'.atleti-full{padding:0 8px;}'
      +'.atleti-full table{width:100%;border-collapse:collapse;}'
      +'.atleti-full td{width:50%;padding:2px 6px;font-size:0.78rem;color:'+txtColor+';}'
      +'.sig-line{display:inline-block;width:60px;height:1px;background:'+txtColor+';opacity:0.3;vertical-align:middle;margin-left:8px;}'
      +'.footer{margin-top:auto;text-align:right;font-size:0.7rem;color:'+txtColor+';opacity:0.6;padding:0 8px 4px;}'
      +'.conv-toolbar{position:fixed;top:10px;right:10px;z-index:9999;display:flex;gap:8px;}'
      +'@media print{.conv-toolbar{display:none!important;} @page{size:A4 portrait;margin:0;} body,html{height:297mm;overflow:hidden;}}'
      +'</style></head><body>'
      +'<div class="conv-toolbar">'
      +'<button onclick="window.print()" style="padding:8px 18px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;">🖨️ Stampa / Salva PDF</button>'
      +'<button onclick="window.close()" style="padding:8px 14px;background:#64748b;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">✕ Chiudi</button>'
      +'</div>'
      +'<div class="page">'
      +(bgImg ? '<img class="bg-img" src="'+bgImg+'">' : '')
      +'<div class="overlay">'
      +'<div class="top-logos">'
      +'<div>'+logoSponsor+'</div>'
      +'<div>'+logoCenter+'</div>'
      +'<div>'+logoSponsor+'</div>'
      +'</div>'
      +'<div class="categoria" style="color:'+txtColor+';">'+(cd.categoria||'')+'</div>'
      +'<div class="conv-box"><div class="tipo" style="color:'+txtColor+';">'+(cd.tipo||'')+'</div><div class="avv" style="color:'+txtColor+';">vs '+(cd.avversario||'')+'</div></div>'
      +'<div class="info-row">'
      +'<div class="info-box"><div class="lbl">Data</div><div class="val">'+dataLabel+'</div></div>'
      +'<div class="info-box"><div class="lbl">Ritrovo Ore</div><div class="val">'+(cd.ritrovo||'—')+'</div></div>'
      +'<div class="info-box"><div class="lbl">Inizio Gara Ore</div><div class="val">'+(cd.inizio||'—')+'</div></div>'
      +'</div>';

    if (cd.luogo) html += '<div class="luogo-box"><div class="lbl">Luogo</div><a href="'+mapsUrl+'" target="_blank">'+cd.luogo+' — Google Maps</a></div>';
    if (cd.note)  html += '<div class="note-box"><div class="lbl">Note</div><div class="note-text">'+cd.note+'</div></div>';

    if (staff.length) {
      html += '<div class="staff-section">'
        +'<div class="col-title" style="color:'+txtColor+';">Staff</div>'
        +'<div class="staff-col-row">'
        +'<div class="staff-col-header">Allenatori</div>'
        +'<div class="staff-col-header">Dirigenti</div>'
        +'</div>'
        +staffRows+'</div>';
    }

    html += '<div class="atleti-full">'
      +'<div class="col-title" style="color:'+txtColor+';">Atleti Convocati</div>'
      +'<table>'+atletiRows+'</table>'
      +'</div>'
      +'<div class="footer">By '+s.firma+'</div>'
      +'</div></div></body></html>';

    var w = window.open('', '_blank', 'width=820,height=1100');
    if (!w) { alert('Abilita i popup per aprire la convocazione.'); return; }
    w.document.write(html);
    w.document.close();
  } catch(e) { alert('Errore: '+e.message); }
};

// ═══ UPLOAD DOCUMENTI GENITORI (v1.5.21) ═════════════════════════════════

// Tipi di documento supportati
const _DOC_TYPES = [
  { key: 'certificato',  label: '🏥 Certificato Medico' },
  { key: 'iscrizione',   label: '📝 Modulo Iscrizione' },
  { key: 'scarico',      label: '⚠️ Scarico Responsabilità' },
  { key: 'generico',     label: '📎 Documento Generico' }
];

// Mostra il pannello upload documenti nella vista genitore
window._showDocUploadPanel = function(athleteId, annataId, existingDocs) {
  var existing = (existingDocs && existingDocs[String(athleteId)]) || {};
  var overlay = document.createElement('div');
  overlay.id = '_doc_upload_overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  
  var panel = document.createElement('div');
  panel.style.cssText = 'background:#0d1b2a;border:1px solid #3b5a9d;border-radius:12px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;padding:24px;';
  
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<h3 style="color:#60a5fa;margin:0;font-size:1.1rem;">📎 Carica Documenti</h3>'
    + '<button onclick="document.getElementById(\'_doc_upload_overlay\').remove()" '
    + 'style="background:none;border:none;color:#94a3b8;font-size:1.5rem;cursor:pointer;line-height:1;">✕</button>'
    + '</div>';

  // Istruzioni Google Drive
  html += '<div style="background:#1e293b;border:1px solid #3b5a9d;border-radius:8px;padding:12px;margin-bottom:16px;">'
    + '<p style="color:#60a5fa;font-weight:700;margin:0 0 8px 0;font-size:0.9rem;">ℹ️ Come ottenere il link Google Drive:</p>'
    + '<ol style="color:#94a3b8;margin:0;padding-left:18px;font-size:0.82rem;line-height:1.8;">'
    + '<li>Vai su <strong style="color:#e2e8f0;">Google Drive</strong> e carica il file</li>'
    + '<li>Clicca con tasto destro sul file → <strong style="color:#e2e8f0;">Condividi</strong></li>'
    + '<li>Imposta accesso: <strong style="color:#e2e8f0;">"Chiunque abbia il link"</strong> → Visualizzatore</li>'
    + '<li>Clicca <strong style="color:#e2e8f0;">Copia link</strong></li>'
    + '<li>Incolla il link qui sotto nel campo corretto</li>'
    + '</ol>'
    + '<p style="color:#64748b;font-size:0.75rem;margin:8px 0 0 0;">💡 Il file rimane su Google Drive, qui salviamo solo il link.</p>'
    + '</div>';

  // Riepilogo documenti già caricati
  var hasExisting = Object.keys(existing).some(function(k){ return existing[k] && existing[k].url; });
  if (hasExisting) {
    html += '<div style="background:#1e293b;border:1px solid #22c55e;border-radius:8px;padding:12px;margin-bottom:16px;">'
      + '<p style="color:#22c55e;font-weight:700;margin:0 0 10px 0;font-size:0.88rem;">📋 Documenti già caricati:</p>';
    _DOC_TYPES.forEach(function(dt) {
      var doc = existing[dt.key];
      if (doc && doc.url) {
        var date = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('it-IT') : '';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">'
          + '<span style="color:#e2e8f0;font-size:0.82rem;flex:1;">' + dt.label + '</span>'
          + '<a href="' + doc.url + '" target="_blank" style="color:#60a5fa;font-size:0.78rem;text-decoration:none;">🔗 Apri</a>'
          + '<span style="color:#64748b;font-size:0.72rem;">' + date + '</span>'
          + '<button onclick="window._deleteAthleteDoc(\'' + athleteId + '\',\'' + annataId + '\',\'' + dt.key + '\')" '
          + 'style="background:#450a0a;color:#d90429;border:1px solid #d90429;border-radius:4px;padding:2px 8px;font-size:0.72rem;cursor:pointer;">🗑️ Elimina</button>'
          + '</div>';
      }
    });
    html += '</div>';
  }

  // Campi per ogni tipo documento
  _DOC_TYPES.forEach(function(dt) {
    var val = (existing[dt.key] && existing[dt.key].url) ? existing[dt.key].url : '';
    var uploadedAt = (existing[dt.key] && existing[dt.key].uploadedAt) ? existing[dt.key].uploadedAt : '';
    var dateLabel = uploadedAt ? ' <span style="font-size:0.7rem;color:#22c55e;">✅ Caricato: ' + new Date(uploadedAt).toLocaleDateString('it-IT') + '</span>' : '';
    html += '<div style="margin-bottom:14px;">'
      + '<label style="display:block;color:#e2e8f0;font-size:0.85rem;font-weight:600;margin-bottom:6px;">'
      + dt.label + dateLabel + '</label>'
      + '<input type="text" id="doc-url-' + dt.key + '" value="' + (val || '') + '" '
      + 'placeholder="Incolla il link Google Drive..." '
      + 'style="width:100%;padding:9px 12px;background:#060f1e;border:1px solid #3b5a9d;border-radius:6px;color:#e2e8f0;font-size:0.82rem;box-sizing:border-box;">'
      + '</div>';
  });

  html += '<div style="display:flex;gap:10px;margin-top:8px;">'
    + '<button onclick="window._saveAthleteDoc(\'' + athleteId + '\',\'' + annataId + '\')" '
    + 'style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:11px;font-size:0.9rem;font-weight:700;cursor:pointer;">💾 Salva Documenti</button>'
    + '<button onclick="document.getElementById(\'_doc_upload_overlay\').remove()" '
    + 'style="background:#374151;color:#9ca3af;border:none;border-radius:8px;padding:11px;font-size:0.9rem;cursor:pointer;">Annulla</button>'
    + '</div>';

  panel.innerHTML = html;
  overlay.appendChild(panel);
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

// Salva i documenti su Redis tramite POST
window._saveAthleteDoc = async function(athleteId, annataId) {
  var docs = {};
  var hasAny = false;
  _DOC_TYPES.forEach(function(dt) {
    var input = document.getElementById('doc-url-' + dt.key);
    var url = input ? input.value.trim() : '';
    // Converti link Drive share → link diretto
    url = url.replace(/drive\.google\.com\/file\/d\/([^\/]+)\/view[^"']*/g, 'drive.google.com/uc?id=$1');
    if (url) {
      docs[dt.key] = { url: url, uploadedAt: new Date().toISOString(), uploadedBy: 'genitore' };
      hasAny = true;
    }
  });

  if (!hasAny) {
    alert('Inserisci almeno un link documento.');
    return;
  }

  try {
    var payload = {};
    payload[String(athleteId)] = docs;
    var res = await fetch('/api/data?parentMode=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId },
      body: JSON.stringify({ athleteDocs: payload })
    });
    if (res.ok) {
      alert('✅ Documenti salvati con successo!');
      document.getElementById('_doc_upload_overlay')?.remove();
    } else {
      alert('❌ Errore nel salvataggio: HTTP ' + res.status);
    }
  } catch(e) {
    alert('❌ Errore: ' + e.message);
  }
};
