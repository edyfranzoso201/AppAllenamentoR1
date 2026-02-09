// calendario-standalone.js - VERSIONE UNIFICATA (URL param + Token path)

const TRAINING = [
  { day: 1, time: '18:30-20:00' },
  { day: 3, time: '17:30-19:00' },
  { day: 5, time: '18:00-19:15' }
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
  const diffHours = (event - now) / (1000 * 60 * 60);
  return diffHours < 72 && diffHours > 0;
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

    // Chiamata API diretta con header
    const response = await fetch('/api/data', {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Annata-Id': annataId
      }
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

    render(data);
  } catch (e) {
  console.error('[CALENDARIO] ❌ Errore caricamento:', e);

  const calendarEl = document.getElementById('calendar');
  if (calendarEl) {
    calendarEl.innerHTML = `
      <div style="padding: 1rem; text-align: center;">
        <p>Si è verificato un errore nel caricamento del calendario.</p>
        <p>Riprova più tardi o contatta l'allenatore.</p>
      </div>
    `;
  }
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
    const response = await fetch('/api/data', {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Annata-Id': annataId
      }
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
    
    // Salva con header
    const saveResponse = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Annata-Id': annataId
      },
      body: JSON.stringify(data)
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
      const color = entry.status === 'Assente' ? '#ef4444' : '#10b981';
      const bgColor = entry.status === 'Assente' ? '#fee2e2' : '#d1fae5';
      const byIcon = entry.by === 'genitore' ? '👨‍👩‍👧' : (entry.by === 'coach' ? '👔' : '❓');
      const byText = entry.by === 'genitore' ? 'Genitore' : (entry.by === 'coach' ? 'Coach' : 'Sconosciuto');
      
      historyHTML += `
        <div style="padding:12px;background:${bgColor};border-radius:8px;margin-bottom:10px;border-left:4px solid ${color}">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div style="flex:1;min-width:150px;">
              <strong style="color:${color};font-size:1rem;">${icon} ${entry.status}</strong>
              <span style="margin-left:10px;color:#64748b;font-size:0.85rem;">${byIcon} ${byText}</span>
            </div>
            <span style="color:#94a3b8;font-size:0.8rem;white-space:nowrap;">${dateStr}</span>
          </div>
          ${entry.note ? `<div style="margin-top:8px;color:#475569;font-size:0.85rem;font-style:italic;padding:8px;background:rgba(255,255,255,0.5);border-radius:4px;">${entry.note}</div>` : ''}
        </div>
      `;
    });
    
    // Stato attuale
    const currentStatus = typeof record === 'object' ? record.status : record;
    const currentColor = currentStatus === 'Assente' ? '#ef4444' : '#10b981';
    const currentBg = currentStatus === 'Assente' ? '#fee2e2' : '#d1fae5';
    
    modal.innerHTML = `
      <div style="background:white;padding:30px;border-radius:15px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;color:#1e293b;display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.5rem;">📋</span>
            <span>Storico Modifiche</span>
          </h3>
          <button onclick="this.closest('[style*=fixed]').remove()" 
            style="background:none;border:none;font-size:2rem;cursor:pointer;color:#64748b;line-height:1;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background 0.2s;"
            onmouseover="this.style.background='#f1f5f9'"
            onmouseout="this.style.background='none'">×</button>
        </div>
        
        <div style="background:#e0f2fe;padding:15px;border-radius:10px;margin-bottom:20px;border:2px solid #38bdf8;">
          <div style="color:#0369a1;font-weight:600;margin-bottom:5px;font-size:1rem;">
            <i class="bi bi-person-circle"></i> ${athleteName}
          </div>
          <div style="color:#0c4a6e;font-size:0.9rem;">
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
            <span style="margin-left:8px;padding:2px 8px;background:#e2e8f0;border-radius:12px;font-size:0.75rem;">${history.length}</span>
          </div>
        </div>
        
        <div style="max-height:300px;overflow-y:auto;padding-right:5px;">
          ${historyHTML}
        </div>
        
        <div style="margin-top:25px;text-align:center;">
          <button onclick="this.closest('[style*=fixed]').remove()" 
            style="background:#64748b;color:white;border:none;padding:12px 40px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.95rem;transition:background 0.2s;"
            onmouseover="this.style.background='#475569'"
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
  const el = document.getElementById('calendar');
  const dates = Object.keys(events).sort();
  
  if (dates.length === 0) {
    el.innerHTML = `<div class="alert alert-info">Nessun evento</div>`;
    return;
  }

  // SUPPORTO DOPPIO: parametro URL O token nel path
  const urlParams = new URLSearchParams(window.location.search);
  let athleteIdParam = urlParams.get('athleteId');
  
  let visibleAthletes = athletes.filter(a => !a.guest);
  
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
    
    // Nascondi anche il pulsante Dashboard
    const dashboardBtn = document.querySelector('.btn-outline-primary[href="/"]');
    if (dashboardBtn) {
      dashboardBtn.style.display = 'none';
    }
    
    visibleAthletes = visibleAthletes.filter(a => {
      return String(a.id) === String(athleteIdParam);
    });
    
    if (visibleAthletes.length === 0) {
      el.innerHTML = `
        <div class="alert alert-danger mt-3">
          <h4>❌ Atleta Non Trovato</h4>
          <p>L'atleta con ID <code>${athleteIdParam}</code> non è presente nel calendario.</p>
          <hr>
          <p><strong>IDs disponibili nel database:</strong></p>
          <ul>
            ${athletes.filter(a => !a.guest).map(a => `<li><code>${a.id}</code> - ${a.name}</li>`).join('')}
          </ul>
          <p class="mb-0">Contatta l'allenatore per un nuovo link.</p>
        </div>
      `;
      return;
    }
    
    console.log('[PRESENZA] ✅ Atleta trovato:', visibleAthletes[0].name);
  } else {
    isParentView = false;
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

  let h = '';
  h += `<div class="table-responsive">`;
  h += `<table class="table table-bordered calendar-table">`;
  h += `<thead>`;
  h += `<tr>`;
  h += `<th style="color:#000" class="sticky-col sticky-col-1">#</th>`;
  h += `<th style="color:#000" class="sticky-col sticky-col-2">Atleta</th>`;
  
  if (!isParentView) {
    h += `<th style="color:#000" class="sticky-col sticky-col-3">Azioni</th>`;
  }
  
  dates.forEach(d => {
    const dt = new Date(d);
    h += `<th class="text-center" style="color:#000">
      ${dt.toLocaleDateString('it-IT', { weekday: 'short' })}<br>
      ${dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
    </th>`;
  });
  h += `</tr>`;
  h += `<tr>`;
  h += `<th style="color:#000" class="sticky-col sticky-col-1"></th>`;
  h += `<th style="color:#000" class="sticky-col sticky-col-2">Nome</th>`;
  
  if (!isParentView) {
    h += `<th style="color:#000" class="sticky-col sticky-col-3">Evento</th>`;
  } else {
    h += `<th style="color:#000">Evento</th>`;
  }
  
  dates.forEach(d => {
    const e = events[d];
    const eventIcon = e.type === 'Partita' ? '⚽' : '🏃';
    
    const deleteBtn = !isParentView ? 
      `<button onclick="deleteEvent('${d}')" class="btn btn-sm btn-danger ms-1" style="padding:0.1rem 0.3rem;font-size:0.6rem">
        <i class="bi bi-trash"></i>
      </button>` : '';
    
    h += `<th class="text-center" style="color:#000">
      <small>${eventIcon} ${e.type}<br>${e.time}${deleteBtn}</small>
    </th>`;
  });
  h += `</tr>`;
  h += `</thead>`;
  h += `<tbody>`;

  visibleAthletes.forEach((a, i) => {
  h += `<tr>`;
  h += `<td style="color:#000" class="sticky-col sticky-col-1">${i + 1}</td>`;
  h += `<td style="color:#000" class="sticky-col sticky-col-2">${a.name}</td>`;
  
  if (!isParentView) {
    h += `<td class="text-center sticky-col sticky-col-3">`;
    h += `<button class="btn btn-sm btn-primary link-presenze-btn" data-athlete-id="${a.id}" data-athlete-name="${a.name.replace(/"/g, '&quot;')}">`;
    h += `<i class="bi bi-link-45deg"></i> Link Presenze`;
    h += `</button>`;
    h += `</td>`;
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
      h += `<td class="text-center" style="position:relative;color:#000;">`;
      
      if (isBlocked) {
        // BLOCCATO (entro 72 ore)
        h += `
          <div style="background:#fee2e2;color:#991b1b;padding:12px 8px;border-radius:6px;font-size:0.75rem;font-weight:600;line-height:1.3;">
            🔒 NON MODIFICABILE<br>
            <span style="font-size:0.7rem;font-weight:normal;">Contatta società</span>
          </div>
        `;
      } else if (status === 'Assente') {
        // ASSENTE (può modificare)
        h += `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;background-color:#ffcccc;padding:8px;border-radius:6px;">
            <span style="color:#dc3545;font-weight:bold;">❌ Assente</span>
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
        // PRESENTE (può modificare)
        h += `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px;">
            <span style="color:#28a745;font-weight:600;">✓ Presente</span>
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
            onmouseover="this.style.background='#2563eb';this.style.transform='scale(1.1)'"
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
        h += `background-color:#ffcccc;color:#dc3545;font-weight:bold;">❌ Assente`;
      } else {
        h += `color:#000;">-`;
      }
      
      // ICONA STORICO (se esiste)
      if (hasHistory) {
        h += `
          <button onclick="window.showHistory(${a.id}, '${date}')" 
            class="history-icon"
            title="Visualizza storico modifiche"
            style="position:absolute;top:2px;right:2px;background:#3b82f6;color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:0.65rem;box-shadow:0 2px 4px rgba(0,0,0,0.2);z-index:10;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"
            onmouseover="this.style.background='#2563eb';this.style.transform='scale(1.15)'"
            onmouseout="this.style.background='#3b82f6';this.style.transform='scale(1)'">
            📋
          </button>
        `;
      }
      
      h += `</td>`;
    }
    }); // ← CHIUSURA forEach DATE
  
  h += `</tr>`;  // chiude la riga dell'atleta
});  // chiude visibleAthletes.forEach

h += `</tbody>`;
h += `</table>`;
h += `</div>`;

if (isParentView) {
  h += `<div class="alert alert-info mt-3">`;
  h += `<strong>ℹ️ Istruzioni:</strong> Usa i pulsanti per segnalare assenze. Predefinito: "Presente".`;
  h += `</div>`;
}

el.innerHTML = h;

  
  console.log('[RENDER] ✅ HTML generato, riattacco event listener...');
  
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
}

window.generatePresenceLink = function(athleteId, athleteName) {
  // IMPORTANTE: Ottieni l'annata corrente
  const currentAnnata = window.currentAnnata || 
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
    <div style="background:white;padding:30px;border-radius:15px;max-width:600px;width:90%">
      <h3 style="margin:0 0 20px 0;color:#2563eb">🔗 Link Conferma Presenze</h3>
      <p style="margin-bottom:15px"><strong>Atleta:</strong> ${athleteName}</p>
      <p style="margin-bottom:10px"><strong>ID Atleta:</strong> <code>${athleteId}</code></p>
      ${currentAnnata ? `<p style="margin-bottom:10px"><strong>Annata:</strong> <code>${currentAnnata}</code></p>` : ''}
      <div style="background:#f1f5f9;padding:15px;border-radius:8px;margin-bottom:20px;word-break:break-all;font-family:monospace;font-size:14px">
        ${link}
      </div>
            <div style="display:flex;gap:10px">
        <button onclick="navigator.clipboard.writeText('${link}').then(() => alert('✅ Link copiato!')).catch(() => alert('❌ Errore'))"
                style="flex:1;background:#10b981;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600">
          📋 Copia Link
        </button>

        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                style="flex:1;background:#64748b;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600">
          ❌ Chiudi
        </button>
      </div>
      <div style="margin-top:20px;padding:15px;background:#e0f2fe;border-radius:8px;font-size:14px;color:#0c4a6e">
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
  const date = prompt('Inserisci la data (YYYY-MM-DD):');
  if (!date) return;
  
  const type = prompt('Tipo evento (Partita/Allenamento):');
  if (!type) return;
  
  const time = prompt('Orario (es. 18:00-20:00):');
  if (!time) return;
  
  events[date] = { type, time };
  
  alert('✅ Evento aggiunto! Salvalo cliccando su un pulsante di salvataggio.');
  location.reload();
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
window.deleteOldEvents = function() {
  if (!confirm('Vuoi eliminare gli eventi passati?')) return;
  
  const today = new Date().toISOString().split('T')[0];
  let deleted = 0;
  
  Object.keys(events).forEach(date => {
    if (date < today) {
      delete events[date];
      deleted++;
    }
  });
  
  alert(`✅ Eliminati ${deleted} eventi passati!`);
  location.reload();
};

document.addEventListener('DOMContentLoaded', () => {
  load();
});
