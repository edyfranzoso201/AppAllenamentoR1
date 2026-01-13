// parent-view.js - Vista Singolo Atleta
(function() {
    'use strict';

    // Token functions
    window.generateAthleteToken = function(athleteId) {
        const salt = 'GO_SPORT_2025_SECRET_KEY';
        const str = salt + athleteId;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36) + athleteId.toString().split('').reverse().join('');
    };

    window.decodeAthleteToken = function(token) {
        try {
            const match = token.match(/[0-9]+$/);
            return match ? match[0].split('').reverse().join('') : null;
        } catch (e) {
            return null;
        }
    };

    // Check if we're in presence mode
    const path = window.location.pathname;
    if (!path.includes('/presenza/')) return;

    const token = path.split('/presenza/')[1]?.replace('.html', '').replace('/', '');
    if (!token) return;

    const athleteId = window.decodeAthleteToken(token);
    if (!athleteId) {
        alert('Link non valido');
        return;
    }

    // Wait for DOM
    function init() {
        // Hide everything except create our view
        const main = document.querySelector('main') || document.body;
        main.innerHTML = `
            <div style="max-width: 1400px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">📅 Conferma Presenze</h1>
                <p id="athlete-name" style="font-size: 18px; margin-bottom: 30px;">Caricamento...</p>
                <div id="calendar-view" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="text-align: center; padding: 40px;">
                        <div class="spinner-border text-primary"></div>
                        <p style="margin-top: 15px;">Caricamento calendario...</p>
                    </div>
                </div>
            </div>
        `;

        loadData();
    }

    async function loadData() {
        try {
            const r = await fetch('/api/data', {cache: 'no-store'});
            const data = await r.json();
            
            const athlete = (data.athletes || []).find(a => a.id == athleteId);
            if (!athlete) {
                document.getElementById('calendar-view').innerHTML = '<p style="color: red;">Atleta non trovato</p>';
                return;
            }

            document.getElementById('athlete-name').textContent = `👤 ${athlete.name}`;
            
            const events = data.calendarEvents || {};
            const responses = data.calendarResponses || {};
            
            renderCalendar(athlete, events, responses);
        } catch (e) {
            document.getElementById('calendar-view').innerHTML = '<p style="color: red;">Errore caricamento</p>';
        }
    }

    function renderCalendar(athlete, events, responses) {
        const dates = Object.keys(events).sort().filter(d => new Date(d) >= new Date().setHours(0,0,0,0));
        
        if (dates.length === 0) {
            document.getElementById('calendar-view').innerHTML = '<p>Nessun evento futuro</p>';
            return;
        }

        let html = '<table class="table table-bordered"><thead><tr><th>Atleta</th>';
        dates.forEach(d => {
            const dt = new Date(d);
            html += `<th class="text-center">${dt.toLocaleDateString('it-IT',{weekday:'short'})}<br>${dt.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})}</th>`;
        });
        html += '</tr><tr><th>Evento</th>';
        dates.forEach(d => {
            const e = events[d];
            html += `<th class="text-center"><small>${e.type==='Partita'?'🏆':'⚽'} ${e.type}<br>${e.time}</small></th>`;
        });
        html += '</tr></thead><tbody><tr><td>${athlete.name}</td>';
        
        dates.forEach(d => {
            const resp = (responses[d] || {})[athleteId];
            html += '<td class="text-center">';
            if (resp) {
                html += resp.presenza === 'Si' ? '<div style="font-size:24px;color:green;">✓</div><small>Presente</small>' : '<div style="font-size:24px;color:red;">✗</div><small>Assente</small>';
                if (resp.motivazione) html += `<br><small>${resp.motivazione}</small>`;
                html += `<br><button class="btn btn-sm btn-secondary mt-1" onclick="editResp('${d}')">Modifica</button>`;
            } else {
                html += `<button class="btn btn-primary btn-sm" onclick="showModal('${d}')">Rispondi</button>`;
            }
            html += '</td>';
        });
        
        html += '</tr></tbody></table>';
        html += '<div class="alert alert-info mt-3"><strong>Info:</strong> Clicca "Rispondi" per confermare presenza/assenza</div>';
        
        document.getElementById('calendar-view').innerHTML = html;
        
        window.currentEvents = events;
        window.currentAthleteId = athleteId;
    }

    window.showModal = function(date) {
        const e = window.currentEvents[date];
        const d = new Date(date).toLocaleDateString('it-IT');
        const resp = prompt(`${e.type} - ${d}\n${e.time}\n\nSarai presente? (scrivi: si o no)`);
        if (!resp) return;
        const presenza = resp.toLowerCase().includes('si') ? 'Si' : 'No';
        const note = prompt('Note opzionali:') || '';
        saveResponse(date, presenza, note);
    };

    window.editResp = function(date) {
        window.showModal(date);
    };

    async function saveResponse(date, presenza, motivazione) {
        try {
            const r = await fetch('/api/data', {cache: 'no-store'});
            const data = await r.json();
            data.calendarResponses = data.calendarResponses || {};
            data.calendarResponses[date] = data.calendarResponses[date] || {};
            data.calendarResponses[date][window.currentAthleteId] = {presenza, motivazione, timestamp: new Date().toISOString()};
            await fetch('/api/data', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
            alert('✅ Risposta salvata!');
            location.reload();
        } catch (e) {
            alert('❌ Errore');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
