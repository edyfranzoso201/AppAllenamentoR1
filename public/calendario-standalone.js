// calendario-standalone.js - Versione completa con tutti i pulsanti
(function() {
    const TRAINING = [{day:1,time:'18:30-20:00'},{day:3,time:'17:30-19:00'},{day:5,time:'18:00-19:15'}];
    const END = new Date('2026-06-30');
    let events = {};
    let athletes = [];

    // Funzione per generare token atleta
    window.generateAthleteToken = function(athleteId) {
        const salt = 'GO_SPORT_2025_SECRET_KEY';
        const str = salt + athleteId;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const token = Math.abs(hash).toString(36) + athleteId.toString().split('').reverse().join('');
        return token;
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
            el.innerHTML = '<div class="alert alert-info">Nessun evento. Usa i pulsanti sopra per iniziare.</div>';
            return;
        }

        let h = '<div class="table-responsive"><table class="table table-bordered calendar-table"><thead><tr><th style="color:#000;">#</th><th style="color:#000;">Atleta</th><th style="color:#000;">Link</th>';
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
            const token = window.generateAthleteToken(a.id);
            const link = `${window.location.origin}/presenza/${token}`;
            h += `<tr><td style="color:#000;">${i+1}</td><td style="color:#000;">${a.name}</td>`;
            h += `<td class="text-center">`;
            h += `<button class="btn btn-sm btn-success" onclick="window.exportAthleteCalendar(${a.id},'${a.name}')"><i class="bi bi-download"></i> Scarica</button> <button class="btn btn-sm btn-primary" onclick="navigator.clipboard.writeText('${link}').then(() => alert('✅ Link copiato!')).catch(() => alert('❌ Errore copia'));" title="Copia link">`;
            h += `<i class="bi bi-link-45deg"></i></button>`;
            h += `<a href="${link}" target="_blank" class="btn btn-sm btn-outline-primary ms-1" title="Apri pagina"><i class="bi bi-box-arrow-up-right"></i></a>`;
            h += `</td>`;
            dates.forEach(() => h += '<td class="text-center" style="color:#000;">-</td>');
            h += '</tr>';
        });
        
        h += '</tbody></table></div>';
        
        h += '<div class="alert alert-info mt-3">';
        h += '<strong><i class="bi bi-info-circle"></i> Come funziona:</strong><br>';
        h += '• <i class="bi bi-link-45deg"></i> = Copia link (da inviare al genitore)<br>';
        h += '• <i class="bi bi-box-arrow-up-right"></i> = Apri pagina di conferma presenze<br>';
        h += '• Ogni genitore vedrà solo la riga del proprio atleta';
        h += '</div>';
        
        el.innerHTML = h;
    }

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
                alert('✅ Tutti gli allenamenti sono già stati creati!');
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
            
            btn.innerHTML = '<i class="bi bi-check-circle"></i> Creati!';
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
                    
                    btn.innerHTML = '<i class="bi bi-check-circle"></i> Importato!';
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
        const date = prompt('📅 Data evento (YYYY-MM-DD):\nEs: 2026-02-15');
        if(!date) return;
        
        const type = confirm('❓ Clicca OK per PARTITA, Annulla per ALLENAMENTO') ? 'Partita' : 'Allenamento';
        const time = prompt('🕐 Orario (HH:MM-HH:MM):\nEs: 15:00-16:30');
        if(!time) return;
        
        const notes = prompt('📝 Note (opzionale):');
        
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
            alert('❌ Errore: '+e.message);
        }
    }

    async function deleteOld() {
        if(!confirm('⚠️ Eliminare tutti gli eventi passati?')) return;
        
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
            alert('❌ Errore: '+e.message);
        }
    }

    document.getElementById('generate-btn').addEventListener('click', genTraining);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('add-btn').addEventListener('click', addEvent);
    document.getElementById('delete-btn').addEventListener('click', deleteOld);
    document.getElementById('file-input').addEventListener('change', (e) => {
        if(e.target.files[0]) impMatches(e.target.files[0]);
        e.target.value = '';
    });

    load();
})();

// Funzione per esportare calendario atleta in formato iCal
window.exportAthleteCalendar = function(athleteId, athleteName) {
    const dates = Object.keys(events).sort();
    const futureEvents = dates.filter(d => new Date(d) >= new Date().setHours(0,0,0,0));
    
    let ical = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GO SPORT//Calendario Squadra//IT\r\nCALSCALE:GREGORIAN\r\n';
    
    futureEvents.forEach(date => {
        const event = events[date];
        const [startTime, endTime] = event.time.split('-');
        const startDate = new Date(date + 'T' + startTime.replace(':', '') + '00');
        const endDate = new Date(date + 'T' + endTime.replace(':', '') + '00');
        
        const dtstart = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const dtend = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        ical += 'BEGIN:VEVENT\r\n';
        ical += `UID:${date}-${athleteId}@gosport.it\r\n`;
        ical += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\r\n`;
        ical += `DTSTART:${dtstart}\r\n`;
        ical += `DTEND:${dtend}\r\n`;
        ical += `SUMMARY:${event.type} GO SPORT\r\n`;
        ical += `DESCRIPTION:${event.notes || ''} - Atleta: ${athleteName}\r\n`;
        ical += `LOCATION:Campo GO SPORT\r\n`;
        ical += 'END:VEVENT\r\n';
    });
    
    ical += 'END:VCALENDAR\r\n';
    
    // Crea file e scarica
    const blob = new Blob([ical], {type: 'text/calendar'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendario-${athleteName.replace(/ /g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`✅ File calendario scaricato!\n\nOra puoi:\n1. Aprire il file .ics\n2. Importarlo in Google Calendar/iPhone Calendar\n3. Tutti gli eventi appariranno automaticamente!`);
};
