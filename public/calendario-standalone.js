// calendario-standalone.js - versione SEMPLIFICATA senza token

const TRAINING = [
  { day: 1, time: '18:30-20:00' },  // Lunedì
  { day: 3, time: '17:30-19:00' },  // Mercoledì
  { day: 5, time: '18:00-19:15' }   // Venerdì
];
const END = new Date('2026-06-30');

let events = {};
let athletes = [];
let isParentView = false;
let currentAthleteId = null;

async function load() {
  try {
    console.log('📥 Caricamento dati calendario...');
    
    // USA loadData dal data-adapter
    let data = await window.loadData('full');
    
    if (!data) {
      console.warn('⚠️ loadData fallito, uso fetch diretto');
      const r = await fetch('/api/data', { cache: 'no-store' });
      const resp = await r.json();
      data = resp.data || resp;
    }
    
    events = data.calendarEvents || {};
    athletes = data.athletes || [];
    
    console.log('✅ Dati caricati:', {
      eventi: Object.keys(events).length,
      atleti: athletes.length,
      listaAtleti: athletes.map(a => ({ id: a.id, name: a.name }))
    });
    
    render();
  } catch (e) {
    console.error('❌ Errore caricamento:', e);
    document.getElementById('calendar').innerHTML = `<div class="alert alert-danger">Errore caricamento dati: ${e.message}</div>`;
  }
}

async function markAbsence(athleteId, date, currentStatus) {
  const newStatus = currentStatus === 'Assente' ? null : 'Assente';
  const statusText = newStatus === 'Assente' ? 'assente' : 'presente';
  
  if (!confirm(`Confermi di voler segnare l'atleta come ${statusText} per il ${new Date(date).toLocaleDateString('it-IT')}?`)) {
    return;
  }
  
  try {
    console.log('💾 Salvataggio stato presenza:', { athleteId, date, newStatus });
    
    let data = await window.loadData('full');
    
    if (!data) {
      const r = await fetch('/api/data', { cache: 'no-store' });
      const resp = await r.json();
      data = resp.data || resp;
    }
    
    // Inizializza la struttura
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
    
    console.log('💾 Dati da salvare:', { date, athleteId, status: newStatus });
    
    // Salva
    const saved = await window.saveData('full', data);
    
    if (!saved) {
      throw new Error('Salvataggio fallito');
    }
    
    console.log('✅ Stato salvato con successo');
    
    // Ricarica
    await load();
    alert(`✅ Stato aggiornato: ${statusText}`);
  } catch (e) {
    console.error('❌ Errore salvataggio:', e);
    alert('❌ Errore nel salvataggio: ' + e.message);
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
  
  // SEMPLICISSIMO: usa direttamente athleteId dall'URL
  const athleteIdParam = urlParams.get('athleteId');
  
  let visibleAthletes = athletes.filter(a => !a.guest);
  
  console.log('🔍 Parametri URL:', { athleteIdParam });
  console.log('👥 Atleti disponibili:', visibleAthletes.map(a => ({ id: a.id, name: a.name })));
  
  // Verifica se è la vista genitore
  if (athleteIdParam) {
    isParentView = true;
    currentAthleteId = athleteIdParam;
    
    console.log('🔓 Modalità Genitore rilevata, cerco atleta con ID:', athleteIdParam);
    
    // Filtra per ID - prova sia come stringa che come numero
    visibleAthletes = visibleAthletes.filter(a => {
      const match = String(a.id) === String(athleteIdParam) || 
                    Number(a.id) === Number(athleteIdParam);
      console.log(`  Confronto atleta ${a.name}: ${a.id} === ${athleteIdParam}? ${match}`);
      return match;
    });
    
    if (visibleAthletes.length === 0) {
      console.error('❌ Atleta non trovato:', athleteIdParam);
      console.error('   IDs disponibili:', athletes.filter(a => !a.guest).map(a => a.id));
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
    currentAthleteId = null;
  }

  // Nascondi i pulsanti di gestione se è la vista genitore
  if (isParentView) {
    const buttons = ['add-btn', 'generate-btn', 'import-btn', 'responses-btn', 'delete-btn'];
    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn && btn.closest('.col-md-2')) {
        btn.closest('.col-md-2').style.display = 'none';
      }
    });
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.style.display = 'none';
    }
  }

  // Carica i dati delle presenze
  let attendanceData = {};
  try {
    const data = await window.loadData('full');
    if (data) {
      attendanceData = data;
    } else {
      const r = await fetch('/api/data', { cache: 'no-store' });
      const resp = await r.json();
      attendanceData = resp.data || resp;
    }
  } catch (e) {
    console.error('Errore caricamento dati presenze', e);
  }

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
      `<button onclick="deleteEvent('${d}')" class="btn btn-sm btn-danger ms-1" style="padding:0.1rem 0.3rem;font-size:0.6rem" title="Elimina evento">
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
      h += `<button class="btn btn-sm btn-primary" onclick="window.generatePresenceLink('${a.id}', '${a.name.replace(/'/g, '\\')}')">`;
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
    h += `<strong><i class="bi bi-info-circle"></i> Istruzioni:</strong> Usa i pulsanti per segnalare assenze o presenze. Predefinito: "Presente".`;
    h += `</div>`;
  }
  
  el.innerHTML = h;
}

// GENERA LINK SEMPLICE - SOLO ID, NIENTE TOKEN
window.generatePresenceLink = function(athleteId, athleteName) {
  // Link semplicissimo con solo l'ID
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
        <strong>📱 Invia questo link al genitore via:</strong><br>
        • WhatsApp<br>
        • Email<br>
        • SMS<br><br>
        Il genitore potrà segnare assenze in qualsiasi momento.
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
  if (!btn) return;
  const old = btn.innerHTML;
  
  if (!confirm('Creare gli allenamenti settimanali fino a giugno 2026?')) {
    return;
  }
  
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
    
    const data = await window.loadData('full') || { calendarEvents: {}, athletes: [] };
    data.calendarEvents = Object.assign(data.calendarEvents || {}, ev);
    
    await window.saveData('full', data);
    
    events = data.calendarEvents;
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
        
        const data = await window.loadData('full') || { calendarEvents: {}, athletes: [] };
        data.calendarEvents = Object.assign(data.calendarEvents || {}, ev);
        
        await window.saveData('full', data);
        
        events = data.calendarEvents;
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
    const data = await window.loadData('full') || { calendarEvents: {}, athletes: [] };
    data.calendarEvents[date] = {
      type,
      time,
      notes: notes || '',
      createdAt: new Date().toISOString()
    };
    
    await window.saveData('full', data);
    
    events = data.calendarEvents;
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
    
    const data = await window.loadData('full') || { calendarEvents: {}, athletes: [] };
    data.calendarEvents = data.calendarEvents || {};
    
    let deleted = 0;
    Object.keys(data.calendarEvents).forEach(d => {
      if (d < tdStr) {
        delete data.calendarEvents[d];
        deleted++;
      }
    });
    
    await window.saveData('full', data);
    
    events = data.calendarEvents;
    render();
    alert(`${deleted} eventi eliminati!`);
  } catch (e) {
    alert(e.message);
  }
}

async function deleteEvent(date) {
  const eventInfo = events[date];
  const dateFormatted = new Date(date).toLocaleDateString('it-IT');
  
  if (!confirm(`Vuoi eliminare l'evento del ${dateFormatted}?\n\n${eventInfo.type} - ${eventInfo.time}\n${eventInfo.notes || ''}`)) {
    return;
  }
  
  try {
    const data = await window.loadData('full') || { calendarEvents: {}, athletes: [] };
    
    delete data.calendarEvents[date];
    
    if (data.attendanceResponses && data.attendanceResponses[date]) {
      delete data.attendanceResponses[date];
    }
    
    await window.saveData('full', data);
    
    events = data.calendarEvents;
    render();
    alert(`✓ Evento del ${dateFormatted} eliminato!`);
  } catch (e) {
    alert('Errore durante l\'eliminazione: ' + e.message);
  }
}

window.markAbsence = markAbsence;
window.deleteEvent = deleteEvent;

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
