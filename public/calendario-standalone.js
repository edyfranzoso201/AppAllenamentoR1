// calendario-standalone.js - Script standalone per pagina calendario
(function() {
    const TRAINING = [{day:1,time:'18:30-20:00'},{day:3,time:'17:30-19:00'},{day:5,time:'18:00-19:15'}];
    const END = new Date('2026-06-30');
    let events = {};
    let athletes = [];

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

        let h = '<div class="table-responsive"><table class="table table-bordered calendar-table"><thead><tr><th>#</th><th>Atleta</th>';
        dates.forEach(d => {
            const dt = new Date(d);
            h += `<th class="text-center">${dt.toLocaleDateString('it-IT',{weekday:'short'})}<br>${dt.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})}</th>`;
        });
        h += '</tr><tr><th colspan="2">Evento</th>';
        dates.forEach(d => {
            const e = events[d];
            h += `<th class="text-center"><small>${e.type==='Partita'?'🏆':'⚽'} ${e.type}<br>${e.time}</small></th>`;
        });
        h += '</tr></thead><tbody>';
        
        athletes.filter(a => !a.guest).forEach((a,i) => {
            h += `<tr><td>${i+1}</td><td>${a.name}</td>`;
            dates.forEach(() => h += '<td class="text-center">-</td>');
            h += '</tr>';
        });
        
        h += '</tbody></table></div>';
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
                alert('Già creati!');
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

    document.getElementById('generate-btn').addEventListener('click', genTraining);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', (e) => {
        if(e.target.files[0]) impMatches(e.target.files[0]);
    });

    load();
})();
