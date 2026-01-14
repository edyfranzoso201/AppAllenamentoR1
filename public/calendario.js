// calendario-standalone.js - Versione finale semplificata
(function() {
    const TRAINING = [{day:1,time:'18:30-20:00'},{day:3,time:'17:30-19:00'},{day:5,time:'18:00-19:15'}];
    const END = new Date('2026-06-30');
    let events = {};
    let athletes = [];

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

    async function load() {
        try {
            const r = await fetch('/api/data', {cache:'no-store'});
            const d = await r.json();
            events = d.calendarEvents || {};
            athletes = d.athletes || [];
            render();
        } catch(e) {
            document.getElementById('calendar').innerHTML = '<div class="alert alert-danger">Errore caricamento</div>';
        }
    }

    function render() {
        const el = document.getElementById('calendar');
        const dates = Object.keys(events).sort();
        
        if (dates.length === 0) {
            el.innerHTML = '<div class="alert alert-info">Nessun evento. Usa i pulsanti sopra.</div>';
            return;
        }

        let h = '<div class="table-responsive"><table class="table table-bordered calendar-table"><thead><tr><th style="color:#000;">#</th><th style="color:#000;">Atleta</th><th style="color:#000;">Azioni</th>';
        dates.forEach(d => {
            const dt = new Date(d);
            h += `<th class="text-center" style="color:#000;">${dt.toLocaleDateString('it-IT',{weekday:'short'})}<br>${dt.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})}</th>`;
        });
        h += '</tr><tr><th colspan="3" style="color:#000;">Evento</th>';
        dates.forEach(d => {
            const e = events[d];
            h += `<th class="text-center" style="color:#000;"><small>${e.type==='Partita'?'🏆':'⚽'} ${e.type}<br>${e.time}</small></th>`;
        });
        h += '</tr></thead><tbody>';
        
        const regularAthletes = athletes.filter(a => !a.guest);
        regularAthletes.forEach((a,i) => {
            h += `<tr><td style="color:#000;">${i+1}</td><td style="color:#000;">${a.name}</td>`;
            h += `<td class="text-center">`;
            h += `<button class="btn btn-sm btn-primary" onclick="window.generatePresenceLink(${a.id}, '${a.name.replace(/'/g, "\\'")}')">`;
            h += `<i class="bi bi-link-45deg"></i> Link Presenze</button>`;
            h += `</td>`;
            dates.forEach(() => h += '<td class="text-center" style="color:#000;">-</td>');
            h += '</tr>';
        });
        
        h += '</tbody></table></div>';
        h += '<div class="alert alert-info mt-3">';
        h += '<strong><i class="bi bi-info-circle"></i> Come funziona:</strong><br>';
        h += '• Clicca "Scarica" per scaricare il file calendario (.ics)<br>';
        h += '• Invia il file al genitore via WhatsApp/Email<br>';
        h += '• Il genitore lo apre e lo importa nel suo Google Calendar/iPhone Calendar';
        h += '</div>';
        
        el.innerHTML = h;
    }

    window.downloadCalendar = function(athleteId, athleteName) {
        const dates = Object.keys(events).sort();
        const today = new Date();
        today.setHours(0,0,0,0);
        const futureEvents = dates.filter(d => new Date(d) >= today);
        
        if (futureEvents.length === 0) {
            alert('Nessun evento futuro da esportare');
            return;
        }
        
        let ical = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GO SPORT//Calendario//IT\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:GO SPORT - ' + athleteName + '\r\nX-WR-TIMEZONE:Europe/Rome\r\n';
        
        futureEvents.forEach(date => {
            const event = events[date];
            const timeParts = event.time.split('-');
            const startTime = timeParts[0].trim().replace(':', '');
            const endTime = timeParts[1] ? timeParts[1].trim().replace(':', '') : startTime;
            
            const startDateTime = date.replace(/-/g, '') + 'T' + startTime + '00';
            const endDateTime = date.replace(/-/g, '') + 'T' + endTime + '00';
            const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            
            ical += 'BEGIN:VEVENT\r\n';
            ical += `UID:${date}-${athleteId}@gosport.it\r\n`;
            ical += `DTSTAMP:${now}\r\n`;
            ical += `DTSTART:${startDateTime}\r\n`;
            ical += `DTEND:${endDateTime}\r\n`;
            ical += `SUMMARY:${event.type} - GO SPORT\r\n`;
            ical += `DESCRIPTION:Atleta: ${athleteName}\\n${event.notes || ''}\r\n`;
            ical += 'LOCATION:Campo GO SPORT\r\n';
            ical += 'STATUS:CONFIRMED\r\n';
            ical += 'END:VEVENT\r\n';
        });
        
        ical += 'END:VCALENDAR\r\n';
        
        const blob = new Blob([ical], {type: 'text/calendar;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GO-SPORT-${athleteName.replace(/ /g, '_')}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setTimeout(() => {
            alert(`✅ File scaricato: GO-SPORT-${athleteName.replace(/ /g, '_')}.ics\n\n📱 Invia questo file al genitore.\nPotrà aprirlo e aggiungerlo al suo calendario!`);
        }, 500);
    };

    async function genTraining() {
        const btn = document.getElementById('generate-btn');
        const oh = btn.innerHTML;
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generazione...';
            
            const ev = {};
            const td = new Date();
            td.setHours(0,0,0,0);
            let cd = new Date(td);
            
            while(cd <= END) {
                const dw = cd.getDay();
                const tr = TRAINING.find(t => t.day === dw);
                if(tr) {
                    const dk = cd.toISOString().split('T')[0];
                    if(!events[dk]) {
                        ev[dk] = {type:'Allenamento',time:tr.time,notes:'Allenamento settimanale',createdAt:new Date().toISOString()};
                    }
                }
                cd.setDate(cd.getDate() + 1);
            }
            
            if(Object.keys(ev).length === 0) {
                alert('✅ Tutti gli allenamenti già creati!');
                btn.innerHTML = oh;
                btn.disabled = false;
                return;
            }
            
            const r = await fetch('/api/data',{cache:'no-store'});
            const ad = await r.json();
            ad.calendarEvents = ad.calendarEvents || {};
            Object.assign(ad.calendarEvents, ev);
            
            await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ad)});
            
            events = ad.calendarEvents;
            render();
            
            btn.innerHTML = '<i class="bi bi-check-circle"></i> Fatto!';
            btn.className = 'btn btn-success w-100';
            setTimeout(() => {
                btn.innerHTML = oh;
                btn.className = 'btn btn-warning w-100';
                btn.disabled = false;
            }, 3000);
            
            alert(`✅ ${Object.keys(ev).length} allenamenti creati!`);
        } catch(e) {
            alert('❌ '+e.message);
            btn.innerHTML = oh;
            btn.className = 'btn btn-warning w-100';
            btn.disabled = false;
        }
    }

    async function impMatches(f) {
        const btn = document.getElementById('import-btn');
        const oh = btn.innerHTML;
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Importazione...';
            
            const rd = new FileReader();
            rd.onload = async (e) => {
                try {
                    const d = JSON.parse(e.target.result);
                    const ev = {};
                    d.forEach(m => {
                        const {data:dk,ora,avversario:av,casa:cs} = m;
                        if(!dk||!ora) return;
                        const loc = cs?'Casa':'Trasferta';
                        ev[dk] = {type:'Partita',time:ora,notes:`${loc} vs ${av||'TBD'}`,createdAt:new Date().toISOString()};
                    });
                    
                    const r = await fetch('/api/data',{cache:'no-store'});
                    const ad = await r.json();
                    ad.calendarEvents = ad.calendarEvents || {};
                    Object.assign(ad.calendarEvents, ev);
                    
                    await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ad)});
                    
                    events = ad.calendarEvents;
                    render();
                    
                    btn.innerHTML = '<i class="bi bi-check-circle"></i> Fatto!';
                    btn.className = 'btn btn-success w-100';
                    setTimeout(() => {
                        btn.innerHTML = oh;
                        btn.className = 'btn btn-info w-100';
                        btn.disabled = false;
                    }, 3000);
                    
                    alert(`✅ ${Object.keys(ev).length} partite importate!`);
                } catch(err) {
                    alert('❌ '+err.message);
                    btn.innerHTML = oh;
                    btn.className = 'btn btn-info w-100';
                    btn.disabled = false;
                }
            };
            rd.readAsText(f);
        } catch(e) {
            alert('❌ '+e.message);
            btn.innerHTML = oh;
            btn.className = 'btn btn-info w-100';
            btn.disabled = false;
        }
    }

    async function addEvent() {
        const date = prompt('📅 Data (YYYY-MM-DD):\nEs: 2026-02-15');
        if(!date) return;
        const type = confirm('Clicca OK per PARTITA, Annulla per ALLENAMENTO') ? 'Partita' : 'Allenamento';
        const time = prompt('🕐 Orario (HH:MM-HH:MM):\nEs: 15:00-16:30');
        if(!time) return;
        const notes = prompt('📝 Note:');
        
        try {
            const r = await fetch('/api/data',{cache:'no-store'});
            const ad = await r.json();
            ad.calendarEvents = ad.calendarEvents || {};
            ad.calendarEvents[date] = {type,time,notes:notes||'',createdAt:new Date().toISOString()};
            await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ad)});
            events = ad.calendarEvents;
            render();
            alert('✅ Evento aggiunto!');
        } catch(e) {
            alert('❌ '+e.message);
        }
    }

    async function deleteOld() {
        if(!confirm('⚠️ Eliminare eventi passati?')) return;
        try {
            const td = new Date();
            td.setHours(0,0,0,0);
            const tdStr = td.toISOString().split('T')[0];
            const r = await fetch('/api/data',{cache:'no-store'});
            const ad = await r.json();
            let deleted = 0;
            Object.keys(ad.calendarEvents || {}).forEach(d => {
                if(d < tdStr) {
                    delete ad.calendarEvents[d];
                    deleted++;
                }
            });
            await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ad)});
            events = ad.calendarEvents || {};
            render();
            alert(`✅ ${deleted} eventi eliminati!`);
        } catch(e) {
            alert('❌ '+e.message);
        }
    }

    document.getElementById('generate-btn').addEventListener('click', genTraining);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('add-btn').addEventListener('click', addEvent);
    document.getElementById('delete-btn').addEventListener('click', deleteOld);
    document.getElementById('responses-btn').addEventListener('click', window.showResponsesReport);
    document.getElementById('file-input').addEventListener('change', (e) => {
        if(e.target.files[0]) impMatches(e.target.files[0]);
        e.target.value = '';
    });

    load();
})();

// Modifica rendering per aggiungere colonna Link
window.generatePresenceLink = function(athleteId, athleteName) {
    const token = window.generateAthleteToken(athleteId);
    const link = `${window.location.origin}/presenza/${token}`;
    
    // Mostra modal con link
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
        <div style="background:white;padding:30px;border-radius:15px;max-width:600px;width:90%;">
            <h3 style="margin:0 0 20px 0;color:#2563eb;">🔗 Link Conferma Presenze</h3>
            <p style="margin-bottom:15px;"><strong>Atleta:</strong> ${athleteName}</p>
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
                Il genitore potrà confermare presenze entro 48h prima di ogni evento.
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
};

// Report risposte
window.showResponsesReport = async function() {
    try {
        const r = await fetch('/api/data', {cache:'no-store'});
        const data = await r.json();
        const responses = data.calendarResponses || {};
        const dates = Object.keys(events).sort();
        
        let html = '<div style="padding:20px;max-height:80vh;overflow-y:auto;">';
        html += '<h3 style="color:#2563eb;margin:0 0 20px 0;">📊 Report Conferme Presenze</h3>';
        
        dates.forEach(date => {
            const event = events[date];
            const dateResponses = responses[date] || {};
            const respondedCount = Object.keys(dateResponses).length;
            const presentCount = Object.values(dateResponses).filter(r => r.presenza === 'Si').length;
            const absentCount = Object.values(dateResponses).filter(r => r.presenza === 'No').length;
            
            html += `<div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:15px;">`;
            html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">`;
            html += `<div><strong>${event.type === 'Partita' ? '🏆' : '⚽'} ${event.type}</strong> - ${new Date(date).toLocaleDateString('it-IT')}</div>`;
            html += `<div><span style="color:#10b981;">✅ ${presentCount}</span> | <span style="color:#ef4444;">❌ ${absentCount}</span> | <span style="color:#94a3b8;">? ${athletes.filter(a => !a.guest).length - respondedCount}</span></div>`;
            html += `</div>`;
            
            if (respondedCount > 0) {
                html += '<div style="font-size:13px;color:#64748b;">';
                Object.entries(dateResponses).forEach(([aid, resp]) => {
                    const athlete = athletes.find(a => a.id == aid);
                    const icon = resp.presenza === 'Si' ? '✅' : '❌';
                    const color = resp.presenza === 'Si' ? '#10b981' : '#ef4444';
                    html += `<div style="margin:5px 0;"><span style="color:${color};">${icon} ${athlete?.name || 'Atleta ' + aid}</span>`;
                    if (resp.motivazione) html += ` - <i>"${resp.motivazione}"</i>`;
                    html += `</div>`;
                });
                html += '</div>';
            }
            html += `</div>`;
        });
        
        html += '</div>';
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
        modal.innerHTML = `
            <div style="background:white;border-radius:15px;max-width:900px;width:90%;max-height:90vh;display:flex;flex-direction:column;">
                ${html}
                <div style="padding:20px;border-top:1px solid #e5e7eb;">
                    <button onclick="this.closest('div[style*=position]').remove()" 
                        style="background:#64748b;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;width:100%;font-weight:600;">
                        Chiudi
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    } catch (e) {
        alert('❌ Errore: ' + e.message);
    }
};
