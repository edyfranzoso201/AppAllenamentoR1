// calendario-standalone.js - VERSIONE FINALE FUNZIONANTE

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

// Ottiene l'annata corretta per la richiesta
async function getAnnataId() {
  // Se già abbiamo l'annata, usala
  if (currentAnnataId) {
    return currentAnnataId;
  }
  
  // Prova dalla sessione
  const sessionAnnata = sessionStorage.getItem('gosport_current_annata');
  if (sessionAnnata) {
    currentAnnataId = sessionAnnata;
    return sessionAnnata;
  }
  
  // Se in modalità genitore, ottieni l'annata più recente
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('athleteId')) {
    try {
      const response = await fetch('/api/annate/list');
      if (response.ok) {
        const data = await response.json();
        const annate = data.annate || [];
        if (annate.length > 0) {
          const sorted = annate.sort((a, b) => new Date(b.dataInizio) - new Date(a.dataInizio));
          currentAnnataId = sorted[0].id;
          console.log(`🔓 Modalità Genitore: usando annata ${currentAnnataId}`);
          return currentAnnataId;
        }
      }
    } catch (error) {
      console.error('Errore recupero annata:', error);
    }
  }
  
  return null;
}

async function load() {
  try {
    console.log('📥 Caricamento dati calendario...');
    
    const annataId = await getAnnataId();
    
    if (!annataId) {
      throw new Error('Nessuna annata disponibile');
    }
    
    console.log(`📥 Caricamento per annata: ${annataId}`);
    
    // Chiamata API diretta con header
    const response = await fetch('/api/data', {
      cache: 'no-store',
      headers: {
        'x-annata-id': annataId
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
    
    console.log('✅ Dati caricati:', {
      eventi: Object.keys(events).length,
      atleti: athletes.length,
      annata: annataId
    });
    
    render(data);
  } catch (e) {
    console.error('❌ Errore caricamento:', e);
    document.getElementById('calendar').innerHTML = `<div class="alert alert-danger">Errore: ${e.message}</div>`;
  }
}

async function markAbsence(athleteId, date, currentStatus) {
  console.log('🔔 markAbsence chiamata!', { athleteId, date, currentStatus });
  
  const newStatus = currentStatus === 'Assente' ? null : 'Assente';
  const statusText = newStatus === 'Assente' ? 'assente' : 'presente';
  
  if (!confirm(`Confermi di voler segnare l'atleta come ${statusText} per il ${new Date(date).toLocaleDateString('it-IT')}?`)) {
    console.log('❌ Utente ha annullato');
    return;
  }
  
  try {
    console.log('💾 Inizio salvataggio...');
    
    const annataId = await getAnnataId();
    
    if (!annataId) {
      throw new Error('Nessuna annata disponibile');
    }
    
    // Carica i dati correnti
    const response = await fetch('/api/data', {
      cache: 'no-store',
      headers: {
        'x-annata-id': annataId
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const data = result.data || result;
    
    console.log('📦 Dati caricati per salvataggio');
    
    // Inizializza struttura
    if (!data.attendanceResponses) {
      data.attendanceResponses = {};
    }
    if (!data.attendanceResponses[date]) {
      data.attendanceResponses[date] = {};
    }
    
    // Imposta stato - USA STRINGA
    const athleteIdStr = String(athleteId);
    if (newStatus === 'Assente') {
      data.attendanceResponses[date][athleteIdStr] = 'Assente';
      console.log(`✅ Impostato assente per ${athleteIdStr}`);
    } else {
      delete data.attendanceResponses[date][athleteIdStr];
      console.log(`✅ Rimosso assente per ${athleteIdStr}`);
    }
    
    console.log('💾 Salvataggio dati...', JSON.stringify(data.attendanceResponses[date], null, 2));
    
    // Salva con header
    const saveResponse = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-annata-id': annataId
      },
      body: JSON.stringify(data)
    });
    
    if (!saveResponse.ok) {
      throw new Error(`Salvataggio fallito: HTTP ${saveResponse.status}`);
    }
    
    const saveResult = await saveResponse.json();
    if (!saveResult.success) {
      throw new Error('API ritornò success=false');
    }
    
    console.log('✅ Stato salvato con successo!');
    
    // Mostra conferma e ricarica
    alert(`✅ Stato aggiornato: ${statusText}`);
    window.location.reload();
    
  } catch (e) {
    console.error('❌ Errore completo:', e);
    alert('❌ Errore: ' + e.message);
  }
}

function getAttendanceStatus(athleteId, date, data) {
  if (!data.attendanceResponses || !data.attendanceResponses[date]) {
    return null;
  }
  return data.attendanceResponses[date][athleteId] || null;
}

async function render(loadedData) {
  const el = document.getElementById('calendar');
  const dates = Object.keys(events).sort();
  
  if (dates.length === 0) {
    el.innerHTML = `<div class="alert alert-info">Nessun evento</div>`;
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const athleteIdParam = urlParams.get('athleteId');
  
  let visibleAthletes = athletes.filter(a => !a.guest);
  
  if (athleteIdParam) {
    isParentView = true;
    currentAthleteId = athleteIdParam;
    
    console.log('🔓 Modalità Genitore:', athleteIdParam);
    
    visibleAthletes = visibleAthletes.filter(a => {
      return String(a.id) === String(athleteIdParam);
    });
    
    if (visibleAthletes.length === 0) {
      el.innerHTML = `
        <div class="alert alert-danger mt-3">
          <h4>Link non valido o atleta non trovato</h4>
          <p>ID cercato: <code>${athleteIdParam}</code></p>
          <p>IDs disponibili nel database:</p>
          <ul>
            ${athletes.filter(a => !a.guest).map(a => `<li><code>${a.id}</code> - ${a.name}</li>`).join('')}
          </ul>
          <p>Contatta il coach per un nuovo link.</p>
        </div>
      `;
      return;
    }
    
    console.log('✅ Atleta trovato:', visibleAthletes[0].name);
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
      const status = getAttendanceStatus(a.id, date, attendanceData);
      
      if (isParentView) {
        if (status === 'Assente') {
          h += `<td class="text-center" style="background-color:#ffcccc; color:#000">
            <div style="display:flex; flex-direction:column; align-items:center; gap:5px">
              <span style="color:#dc3545; font-weight:bold">❌ Assente</span>
              <button class="btn btn-sm btn-success" onclick="markAbsence('${a.id}', '${date}', 'Assente')" style="font-size:0.75rem">
                Segna Presente
              </button>
            </div>
          </td>`;
        } else {
          h += `<td class="text-center" style="color:#000">
            <div style="display:flex; flex-direction:column; align-items:center; gap:5px">
              <span style="color:#28a745">✓ Presente</span>
              <button class="btn btn-sm btn-danger" onclick="markAbsence('${a.id}', '${date}', null)" style="font-size:0.75rem">
                Segna Assente
              </button>
            </div>
          </td>`;
        }
      } else {
        if (status === 'Assente') {
          h += `<td class="text-center" style="background-color:#ffcccc; color:#dc3545; font-weight:bold">❌ Assente</td>`;
        } else {
          h += `<td class="text-center" style="color:#000">-</td>`;
        }
      }
    });
    h += `</tr>`;
  });

  h += `</tbody></table></div>`;
  
  if (isParentView) {
    h += `<div class="alert alert-info mt-3">`;
    h += `<strong>ℹ️ Istruzioni:</strong> Usa i pulsanti per segnalare assenze. Predefinito: "Presente".`;
    h += `</div>`;
  }
  
  el.innerHTML = h;
  
  // Aggiungi event listener per i pulsanti Link Presenze
  if (!isParentView) {
    document.querySelectorAll('.link-presenze-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const athleteId = this.getAttribute('data-athlete-id');
        const athleteName = this.getAttribute('data-athlete-name');
        window.generatePresenceLink(athleteId, athleteName);
      });
    });
  }
}

window.generatePresenceLink = function(athleteId, athleteName) {
  const link = `${window.location.origin}${window.location.pathname}?athleteId=${athleteId}`;
  
  console.log('🔗 Link generato:', { athleteId, athleteName, link });
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:15px;max-width:600px;width:90%;">
      <h3 style="margin:0 0 20px 0;color:#2563eb;">🔗 Link Conferma Presenze</h3>
      <p style="margin-bottom:15px;"><strong>Atleta:</strong> ${athleteName}</p>
      <p style="margin-bottom:10px;"><strong>ID Atleta:</strong> <code>${athleteId}</code></p>
      <div style="background:#f1f5f9;padding:15px;border-radius:8px;margin-bottom:20px;word-break:break-all;font-family:monospace;font-size:14px;">
        ${link}
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="navigator.clipboard.writeText('${link}').then(() => alert('✅ Link copiato!')).catch(() => alert('❌ Errore'))" 
          style="flex:1;background:#10b981;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
          📋 Copia Link
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
          style="flex:1;background:#64748b;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
          Chiudi
        </button>
      </div>
      <div style="margin-top:20px;padding:15px;background:#e0f2fe;border-radius:8px;font-size:14px;color:#0c4a6e;">
        <strong>📱 Invia questo link al genitore</strong>
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

document.addEventListener('DOMContentLoaded', () => {
  load();
});
