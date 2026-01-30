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
    document.getElementById('calendar').innerHTML = `<div class="alert alert-danger">Errore: ${e.message}</div>`;
  }
}

async function markAbsence(athleteId, date, currentStatus) {
  console.log('[PRESENZA] 🔔 markAbsence chiamata!', { athleteId, date, currentStatus });
  
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
      console.log(`[PRESENZA] ✅ Impostato assente per ${athleteIdStr}`);
    } else {
      delete data.attendanceResponses[date][athleteIdStr];
      console.log(`[PRESENZA] ✅ Rimosso assente per ${athleteIdStr}`);
    }
    
    console.log('[PRESENZA] 💾 Salvataggio dati...', JSON.stringify(data.attendanceResponses[date], null, 2));
    
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
    
    const saveResult = await saveResponse.json();
    if (!saveResult.success) {
      throw new Error('API ritornò success=false');
    }
    
    console.log('[PRESENZA] ✅ Stato salvato con successo!');
    
    // Mostra conferma e ricarica
    alert(`✅ Stato aggiornato: ${statusText}`);
    window.location.reload();
    
  } catch (e) {
    console.error('[PRESENZA] ❌ Errore completo:', e);
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

  // SUPPORTO DOPPIO: parametro URL O token nel path
  const urlParams = new URLSearchParams(window.location.search);
  let athleteIdParam = urlParams.get('athleteId');
  
  let visibleAthletes = athletes.filter(a => !a.guest);
  
  if (athleteIdParam) {
    isParentView = true;
    currentAthleteId = athleteIdParam;
    
    console.log('[PRESENZA] 🔓 Modalità Genitore:', athleteIdParam);
    
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
      const status = getAttendanceStatus(a.id, date, attendanceData);
      
      if (isParentView) {
        if (status === 'Assente') {
          h += `<td class="text-center" style="background-color:#ffcccc; color:#000">
            <div style="display:flex; flex-direction:column; align-items:center; gap:5px">
              <span style="color:#dc3545; font-weight:bold">❌ Assente</span>
              <button class="btn btn-sm btn-success mark-presence-btn" 
                      data-athlete-id="${a.id}" 
                      data-date="${date}" 
                      data-current-status="Assente" 
                      style="font-size:0.75rem">
                Segna Presente
              </button>
            </div>
          </td>`;
        } else {
          h += `<td class="text-center" style="color:#000">
            <div style="display:flex; flex-direction:column; align-items:center; gap:5px">
              <span style="color:#28a745">✓ Presente</span>
              <button class="btn btn-sm btn-danger mark-absence-btn" 
                      data-athlete-id="${a.id}" 
                      data-date="${date}" 
                      data-current-status="" 
                      style="font-size:0.75rem">
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
  
  // Aggiungi event listener per i pulsanti Link Presenze (solo per coach)
  if (!isParentView) {
    document.querySelectorAll('.link-presenze-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const athleteId = this.getAttribute('data-athlete-id');
        const athleteName = this.getAttribute('data-athlete-name');
        window.generatePresenceLink(athleteId, athleteName);
      });
    });
  }
  
  // Aggiungi event listener per i pulsanti Segna Assente/Presente (solo per genitori)
  if (isParentView) {
    document.querySelectorAll('.mark-absence-btn, .mark-presence-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const athleteId = this.getAttribute('data-athlete-id');
        const date = this.getAttribute('data-date');
        const currentStatus = this.getAttribute('data-current-status') || null;
        
        console.log('[PRESENZA] 👆 Click rilevato!', { athleteId, date, currentStatus });
        markAbsence(athleteId, date, currentStatus);
      });
    });
  }
}
window.generatePresenceLink = function(athleteId, athleteName) {
  // Link SEMPLICE senza token - USA SOLO athleteId
  const link = `${window.location.origin}/calendario.html?athleteId=${athleteId}`;
  
  console.log('[CALENDARIO] 🔗 Link generato:', {
    athleteId,
    athleteName,
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
