// calendario-standalone.js - versione con link per singolo atleta (function)

const TRAINING = [
  { day: 1, time: '18:30-20:00' },
  { day: 3, time: '17:30-19:00' },
  { day: 5, time: '18:00-19:15' }
];
const END = new Date('2026-06-30');

let events = {};
let athletes = [];
let isParentView = false; // Flag per identificare se è la vista genitore
let currentAthleteId = null; // ID dell'atleta nella vista genitore

// Token usato per i link atleta
window.generateAthleteToken = function(athleteId) {
  const salt = 'GOSPORT2025SECRETKEY';
  const str = salt + athleteId;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36) + athleteId.toString().split('').reverse().join('');
};

// Decode del token coerente con presenza-atleta.js
window.decodePresenceToken = function(token) {
  try {
    const match = token.match(/(\d+)$/);
    return match ? match[0].split('').reverse().join('') : null;
  } catch (e) {
    return null;
  }
};

async function load() {
  try {
    const r = await fetch('api/data', { cache: 'no-store' });
    const d = await r.json();
    events = d.calendarEvents;
    athletes = d.athletes;
    render();
  } catch (e) {
    document.getElementById('calendar').innerHTML = `<div class="alert alert-danger">Errore caricamento dati</div>`;
  }
}

async function markAbsence(athleteId, date, currentStatus) {
  const newStatus = currentStatus === 'Assente' ? null : 'Assente';
  const statusText = newStatus === 'Assente' ? 'assente' : 'presente';
  
  if (!confirm(`Confermi di voler segnare l'atleta come ${statusText} per il ${new Date(date).toLocaleDateString('it-IT')}?`)) {
    return;
  }
  
  try {
    const r = await fetch('api/data', { cache: 'no-store' });
    const data = await r.json();
    
    // Inizializza la struttura se non esiste
    if (!data.attendanceResponses) {
      data.attendanceResponses = {};
    }
    if (!data.attendanceResponses[date]) {
      data.attendanceResponses[date] = {};
    }
    
    // Imposta lo stato
    if (newStatus === 'Assente') {
      data.attendanceResponses[date][athleteId] = 'Assente';
    } else {
      delete data.attendanceResponses[date][athleteId];
    }
    
    // Salva
    await fetch('api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    // Ricarica
    await load();
    alert(`✓ Stato aggiornato: ${statusText}`);
  } catch (e) {
    alert('Errore nel salvataggio: ' + e.message);
  }
}

function getAttendanceStatus(athleteId, date, data) {
  if (!data.attendanceResponses || !data.attendanceResponses[date]) {
    return null;
  }
  return data.attendanceResponses[date][athleteId] || null;
}

async function render() {
  const el = document.getElementById('calendar');
  const dates = Object.keys(events).sort();
  
  if (dates.length === 0) {
    el.innerHTML = `<div class="alert alert-info">Nessun evento. Usa i pulsanti sopra.</div>`;
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get('athlete');
  let visibleAthletes = athletes.filter(a => !a.guest);
  
  // Verifica se è la vista genitore
  if (tokenParam) {
    isParentView = true;
    const athleteId = window.decodePresenceToken(tokenParam);
    if (athleteId) {
      currentAthleteId = athleteId;
      visibleAthletes = visibleAthletes.filter(a => String(a.id) === String(athleteId));
      if (visibleAthletes.length === 0) {
        el.innerHTML = `<div class="alert alert-danger mt-3">Link non valido o atleta non trovato. Contatta il coach per un nuovo link.</div>`;
        return;
      }
    } else {
      el.innerHTML = `<div class="alert alert-danger mt-3">Link non valido. Contatta il coach per un nuovo link.</div>`;
      return;
    }
  } else {
    isParentView = false;
    currentAthleteId = null;
  }

  // Nascondi i pulsanti di gestione se è la vista genitore
  if (isParentView) {
    // Nascondi tutti i pulsanti di controllo
    const buttons = ['add-btn', 'generate-btn', 'import-btn', 'responses-btn', 'delete-btn'];
    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn && btn.closest('.col-md-2')) {
        btn.closest('.col-md-2').style.display = 'none';
      }
    });
    // Nascondi anche il file input
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.style.display = 'none';
    }
  }

  // Carica i dati delle presenze
  let attendanceData = {};
  try {
    const r = await fetch('api/data', { cache: 'no-store' });
    attendanceData = await r.json();
  } catch (e) {
    console.error('Errore caricamento dati presenze', e);
  }

  let h = '';
  h += `<div class="table-responsive">`;
  h += `<table class="table table-bordered calendar-table">`;
  h += `<thead>`;
  h += `<tr>`;
  h += `<th style="color:#000">#</th>`;
  h += `<th style="color:#000">Atleta</th>`;
  
  // Colonna Azioni solo per il coach
  if (!isParentView) {
    h += `<th style="color:#000">Azioni</th>`;
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
  h += `<th colspan="${isParentView ? 2 : 3}" style="color:#000">Evento</th>`;
  dates.forEach(d => {
    const e = events[d];
    h += `<th class="text-center" style="color:#000"><small>${e.type === 'Partita' ? '⚽ ' + e.type : '🏃 ' + e.type}<br>${e.time}</small></th>`;
  });
  h += `</tr>`;
  h += `</thead>`;
  h += `<tbody>`;

  visibleAthletes.forEach((a, i) => {
    h += `<tr>`;
    h += `<td style="color:#000">${i + 1}</td>`;
    h += `<td style="color:#000">${a.name}</td>`;
    
    // Colonna Azioni solo per il coach
    if (!isParentView) {
      h += `<td class="text-center">`;
      h += `<button class="btn btn-sm btn-primary" onclick="window.generatePresenceLink('${a.id}', '${a.name.replace(/'/g, '\\')}')">`;
      h += `<i class="bi bi-link-45deg"></i> Link Presenze`;
      h += `</button>`;
      h += `</td>`;
    }
    
    // Celle per ogni data
    dates.forEach(date => {
      const status = getAttendanceStatus(a.id, date, attendanceData);
      
      if (isParentView) {
        // Vista genitore: mostra stato e bottone per cambiarlo
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
        // Vista coach: solo visualizzazione stato
        if (status === 'Assente') {
          h += `<td class="text-center" style="background-color:#ffcccc; color:#dc3545; font-weight:bold">❌ Assente</td>`;
        } else {
          h += `<td class="text-center" style="color:#000">-</td>`;
        }
      }
    });
    h += `</tr>`;
  });

  h += `</tbody>`;
  h += `</table>`;
  h += `</div>`;
  
  // Info box diverso per coach e genitori
  if (isParentView) {
    h += `<div class="alert alert-info mt-3">`;
    h += `<strong><i class="bi bi-info-circle"></i> Istruzioni per i genitori:</strong><br>`;
    h += `Usa i pulsanti sotto ogni data per segnalare se tuo figlio sarà <strong>assente</strong> o <strong>presente</strong>.<br>`;
    h += `Lo stato predefinito è "Presente" - segnala solo se sarà assente.`;
    h += `</div>`;
  } else {
    h += `<div class="alert alert-info mt-3">`;
    h += `<strong><i class="bi bi-info-circle"></i> Come funziona:</strong><br>`;
    h += `Clicca "Link Presenze" per generare il link personale dell'atleta.<br>`;
    h += `Invia il link al genitore: vedrà solo la riga del proprio figlio nel calendario e potrà segnalare le assenze.`;
    h += `</div>`;
  }

  el.innerHTML = h;
}

window.generatePresenceLink = function(athleteId, athleteName) {
  const token = window.generateAthleteToken(athleteId);
  const link = `${window.location.origin}/calendario.html?athlete=${encodeURIComponent(token)}`;
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:15px;max-width:600px;width:90%">
      <h3 style="margin:0 0 20px 0;color:#2563eb">🔗 Link Conferma Presenze</h3>
      <p style="margin-bottom:15px"><strong>Atleta:</strong> ${athleteName}</p>
      <div style="background:#f1f5f9;padding:15px;border-radius:8px;margin-bottom:20px;word-break:break-all;font-family:monospace;font-size:14px">
        ${link}
      </div>
      <div style="display:flex;gap:10px">
        <button onclick="navigator.clipboard.writeText('${link}').then(()=>alert('Link copiato!')).catch(()=>alert('Errore nella copia'))" 
          style="flex:1;background:#10b981;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600">
          📋 Copia Link
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
          style="flex:1;background:#64748b;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600">
          Chiudi
        </button>
      </div>
      <div style="margin-top:20px;padding:15px;background:#e0f2fe;border-radius:8px;font-size:14px;color:#0c4a6e">
        <strong>📲 Invia questo link al genitore via:</strong><br>
        WhatsApp, Email o SMS.<br><br>
        💡 Aprendo il link vedrà solo la riga di questo atleta e potrà segnalare le assenze.
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
};

async function genTraining() {
  const btn = document.getElementById('generate-btn');
  const old = btn.innerHTML;
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generazione...';
    
    const ev = {};
    const td = new Date();
    td.setHours(0, 0, 0, 0);
    let cd = new Date(td);
    
    while (cd <= END) {
      const dw = cd.getDay();
      const tr = TRAINING.find(t => t.day === dw);
      if (tr) {
        const dk = cd.toISOString().split('T')[0];
        if (!events[dk]) {
          ev[dk] = {
            type: 'Allenamento',
            time: tr.time,
            notes: 'Allenamento settimanale',
            createdAt: new Date().toISOString()
          };
        }
      }
      cd.setDate(cd.getDate() + 1);
    }
    
    if (Object.keys(ev).length === 0) {
      alert('Tutti gli allenamenti sono già creati!');
      btn.innerHTML = old;
      btn.disabled = false;
      return;
    }
    
    const r = await fetch('api/data', { cache: 'no-store' });
    const ad = await r.json();
    ad.calendarEvents = Object.assign(ad.calendarEvents, ev);
    await fetch('api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ad)
    });
    events = ad.calendarEvents;
    render();
    
    btn.innerHTML = '<i class="bi bi-check-circle"></i> Fatto!';
    btn.className = 'btn btn-success w-100';
    setTimeout(() => {
      btn.innerHTML = old;
      btn.className = 'btn btn-warning w-100';
      btn.disabled = false;
    }, 3000);
    alert(`${Object.keys(ev).length} allenamenti creati!`);
  } catch (e) {
    alert(e.message);
    btn.innerHTML = old;
    btn.className = 'btn btn-warning w-100';
    btn.disabled = false;
  }
}

async function impMatches(f) {
  const btn = document.getElementById('import-btn');
  const old = btn.innerHTML;
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Importazione...';
    
    const rd = new FileReader();
    rd.onload = async (e) => {
      try {
        const d = JSON.parse(e.target.result);
        const ev = {};
        d.forEach(m => {
          const { data: dk, ora, avversario: av, casa: cs } = m;
          if (!dk || !ora) return;
          const loc = cs ? 'Casa' : 'Trasferta';
          ev[dk] = {
            type: 'Partita',
            time: ora,
            notes: `${loc} vs ${av || 'TBD'}`,
            createdAt: new Date().toISOString()
          };
        });
        
        const r = await fetch('api/data', { cache: 'no-store' });
        const ad = await r.json();
        ad.calendarEvents = Object.assign(ad.calendarEvents, ev);
        await fetch('api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ad)
        });
        events = ad.calendarEvents;
        render();
        
        btn.innerHTML = '<i class="bi bi-check-circle"></i> Fatto!';
        btn.className = 'btn btn-success w-100';
        setTimeout(() => {
          btn.innerHTML = old;
          btn.className = 'btn btn-info w-100';
          btn.disabled = false;
        }, 3000);
        alert(`${Object.keys(ev).length} partite importate!`);
      } catch (err) {
        alert(err.message);
        btn.innerHTML = old;
        btn.className = 'btn btn-info w-100';
        btn.disabled = false;
      }
    };
    rd.readAsText(f);
  } catch (e) {
    alert(e.message);
    btn.innerHTML = old;
    btn.className = 'btn btn-info w-100';
    btn.disabled = false;
  }
}

async function addEvent() {
  const date = prompt('Data (YYYY-MM-DD):', '2026-02-15');
  if (!date) return;
  const type = confirm('Clicca OK per PARTITA, Annulla per ALLENAMENTO') ? 'Partita' : 'Allenamento';
  const time = prompt('Orario (HH:MM-HH:MM):', '15:00-16:30');
  if (!time) return;
  const notes = prompt('Note:', '');
  
  try {
    const r = await fetch('api/data', { cache: 'no-store' });
    const ad = await r.json();
    ad.calendarEvents[date] = {
      type,
      time,
      notes: notes || '',
      createdAt: new Date().toISOString()
    };
    await fetch('api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ad)
    });
    events = ad.calendarEvents;
    render();
    alert('Evento aggiunto!');
  } catch (e) {
    alert(e.message);
  }
}

async function deleteOld() {
  if (!confirm('Eliminare eventi passati?')) return;
  try {
    const td = new Date();
    td.setHours(0, 0, 0, 0);
    const tdStr = td.toISOString().split('T')[0];
    
    const r = await fetch('api/data', { cache: 'no-store' });
    const ad = await r.json();
    ad.calendarEvents = ad.calendarEvents || {};
    let deleted = 0;
    Object.keys(ad.calendarEvents).forEach(d => {
      if (d < tdStr) {
        delete ad.calendarEvents[d];
        deleted++;
      }
    });
    await fetch('api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ad)
    });
    events = ad.calendarEvents;
    render();
    alert(`${deleted} eventi eliminati!`);
  } catch (e) {
    alert(e.message);
  }
}

// Rendi la funzione markAbsence globale
window.markAbsence = markAbsence;

document.addEventListener('DOMContentLoaded', () => {
  const genBtn = document.getElementById('generate-btn');
  if (genBtn) {
    genBtn.addEventListener('click', genTraining);
  }
  
  const impBtn = document.getElementById('import-btn');
  if (impBtn) {
    impBtn.addEventListener('click', () => {
      const fi = document.getElementById('file-input');
      if (fi) fi.click();
    });
  }
  
  const addBtn = document.getElementById('add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addEvent);
  }
  
  const delBtn = document.getElementById('delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', deleteOld);
  }
  
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        impMatches(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
  
  load();
});
