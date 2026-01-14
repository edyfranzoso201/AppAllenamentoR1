// presenza-intercept.js - BLOCCA TUTTO se è modalità presenza
(function() {
    'use strict';

    // Controlla subito il path
    const path = window.location.pathname;
    
    if (!path.includes('/presenza/')) {
        return; // Non è modalità presenza, lascia caricare normale
    }

    console.log('[PRESENZA] Modalità attivata, blocco caricamento dashboard...');

    // BLOCCA IMMEDIATAMENTE il rendering della pagina
    document.addEventListener('DOMContentLoaded', function(e) {
        e.stopImmediatePropagation();
    }, true);

    // Sostituisci l'intero HTML prima che carichi
    if (document.readyState === 'loading') {
        // Blocca parsing
        const observer = new MutationObserver(function() {
            if (document.body) {
                initPresenzaView();
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
        initPresenzaView();
    }

    function generateToken(athleteId) {
        const salt = 'GO_SPORT_2025_SECRET';
        let hash = 0;
        const str = salt + athleteId;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36) + athleteId.toString().split('').reverse().join('');
    }

    function decodeToken(token) {
        try {
            const match = token.match(/[0-9]+$/);
            return match ? match[0].split('').reverse().join('') : null;
        } catch (e) {
            return null;
        }
    }

    function initPresenzaView() {
        // Estrai token
        const parts = path.split('/presenza/');
        const token = parts[1] ? parts[1].replace(/[/.html]/g, '') : null;
        
        if (!token) {
            showError('Token mancante nel link');
            return;
        }

        const athleteId = decodeToken(token);
        if (!athleteId) {
            showError('Link non valido o corrotto');
            return;
        }

        // PULISCI TUTTO
        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conferma Presenze - GO SPORT</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: system-ui, -apple-system, sans-serif;
            background: #f8f9fa;
        }
        .event-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 15px;
        }
        .btn-presente {
            width: 100%;
            background: #10b981;
            color: white;
            border: none;
            padding: 14px;
            border-radius: 10px;
            font-size: 17px;
            font-weight: 700;
            cursor: pointer;
            margin-bottom: 10px;
        }
        .btn-presente:hover { background: #059669; }
        .btn-assente {
            width: 100%;
            background: #ef4444;
            color: white;
            border: none;
            padding: 14px;
            border-radius: 10px;
            font-size: 17px;
            font-weight: 700;
            cursor: pointer;
        }
        .btn-assente:hover { background: #dc2626; }
        .confirmed {
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .confirmed.presente { background: #d1fae5; }
        .confirmed.assente { background: #fee2e2; }
    </style>
</head>
<body>
    <div style="max-width: 1200px; margin: 0 auto;">
        <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0 0 10px 0; font-size: 28px;">📅 Conferma Presenze GO SPORT</h1>
            <p id="athlete-name" style="font-size: 18px; color: #64748b; margin: 0;">Caricamento...</p>
        </div>
        <div id="events-container">
            <div style="text-align: center; padding: 50px;">
                <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;"></div>
                <p style="margin-top: 20px; color: #64748b;">Caricamento eventi...</p>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        const ATHLETE_ID = '${athleteId}';
        let currentAthlete = null;
        let allEvents = {};
        let allResponses = {};

        async function loadData() {
            try {
                const r = await fetch('/api/data', {cache: 'no-store'});
                const data = await r.json();
                
                currentAthlete = (data.athletes || []).find(a => a.id == ATHLETE_ID);
                if (!currentAthlete) {
                    document.getElementById('events-container').innerHTML = '<div class="alert alert-danger">Atleta non trovato</div>';
                    return;
                }

                allEvents = data.calendarEvents || {};
                allResponses = data.calendarResponses || {};

                document.getElementById('athlete-name').innerHTML = '<strong>👤 ' + currentAthlete.name + '</strong>';
                renderEvents();
            } catch (e) {
                document.getElementById('events-container').innerHTML = '<div class="alert alert-danger">Errore caricamento</div>';
            }
        }

        function renderEvents() {
            const container = document.getElementById('events-container');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const dates = Object.keys(allEvents).filter(d => new Date(d) >= today).sort();

            if (dates.length === 0) {
                container.innerHTML = '<div class="event-card" style="text-align:center;"><div style="font-size:48px;">📭</div><p>Nessun evento futuro</p></div>';
                return;
            }

            let html = '';
            dates.forEach(date => {
                const event = allEvents[date];
                const eventDate = new Date(date);
                const response = (allResponses[date] || {})[ATHLETE_ID];
                const hoursUntil = (eventDate - today) / (1000 * 60 * 60);
                const isLocked = hoursUntil < 48 || (response && response.locked);

                const dayName = eventDate.toLocaleDateString('it-IT', {weekday: 'long'});
                const dateStr = eventDate.toLocaleDateString('it-IT', {day: '2-digit', month: 'long', year: 'numeric'});

                html += '<div class="event-card"><div class="row">';
                html += '<div class="col-md-8">';
                html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
                html += '<span style="font-size:28px;">' + (event.type === 'Partita' ? '🏆' : '⚽') + '</span>';
                html += '<h3 style="margin:0;font-size:22px;">' + event.type + '</h3>';
                html += '</div>';
                html += '<p style="margin:8px 0;color:#64748b;">📅 <strong>' + dayName + '</strong>, ' + dateStr + '</p>';
                html += '<p style="margin:8px 0;color:#64748b;">🕐 <strong>' + event.time + '</strong></p>';
                if (event.notes) html += '<p style="margin:8px 0;color:#64748b;font-size:14px;">' + event.notes + '</p>';
                html += '</div>';
                html += '<div class="col-md-4">';

                if (response) {
                    const isPresent = response.presenza === 'Si';
                    html += '<div class="confirmed ' + (isPresent ? 'presente' : 'assente') + '">';
                    html += '<div style="font-size:40px;">' + (isPresent ? '✅' : '❌') + '</div>';
                    html += '<div style="font-weight:700;font-size:20px;color:' + (isPresent ? '#10b981' : '#ef4444') + ';">' + (isPresent ? 'PRESENTE' : 'ASSENTE') + '</div>';
                    if (response.motivazione) html += '<div style="margin-top:10px;font-size:14px;">"' + response.motivazione + '"</div>';
                    html += '<div style="margin-top:10px;font-size:13px;color:#64748b;">🔒 Confermato</div>';
                    html += '</div>';
                } else if (isLocked) {
                    html += '<div style="text-align:center;padding:20px;"><div style="font-size:32px;">⏰</div><p style="color:#94a3b8;">Scaduto</p></div>';
                } else {
                    html += '<button class="btn-presente" onclick="confirm(\\''+date+'\\', \\'Si\\')">✅ Sarò presente</button>';
                    html += '<button class="btn-assente" onclick="confirm(\\''+date+'\\', \\'No\\')">❌ Sarò assente</button>';
                }

                html += '</div></div></div>';
            });

            html += '<div style="background:#e0f2fe;padding:25px;border-radius:15px;margin-top:20px;">';
            html += '<h4 style="margin:0 0 15px 0;color:#0369a1;">ℹ️ Come funziona</h4>';
            html += '<ul style="margin:0;padding-left:20px;color:#0c4a6e;"><li>Conferma entro 2 giorni prima</li><li>Dopo conferma: scelta definitiva</li></ul>';
            html += '</div>';

            container.innerHTML = html;
        }

        window.confirm = async function(date, presenza) {
            let motivazione = '';
            if (presenza === 'No') {
                motivazione = prompt('Motivo assenza (opzionale):') || '';
            }

            if (!window.confirm('Confermare ' + (presenza === 'Si' ? 'PRESENZA' : 'ASSENZA') + '?\\n\\nNon potrai più modificare!')) {
                return;
            }

            try {
                const r = await fetch('/api/data', {cache: 'no-store'});
                const data = await r.json();
                data.calendarResponses = data.calendarResponses || {};
                data.calendarResponses[date] = data.calendarResponses[date] || {};
                data.calendarResponses[date][ATHLETE_ID] = {
                    presenza: presenza,
                    motivazione: motivazione,
                    timestamp: new Date().toISOString(),
                    locked: true,
                    athleteName: currentAthlete.name
                };
                await fetch('/api/data', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
                alert('✅ Confermato!');
                location.reload();
            } catch (e) {
                alert('❌ Errore');
            }
        };

        loadData();
    </script>
</body>
</html>
        `;
    }

    function showError(msg) {
        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Errore</title>
    <style>
        body { margin: 0; padding: 50px; font-family: system-ui; background: #f8f9fa; }
        .error { max-width: 600px; margin: 0 auto; padding: 30px; background: white; border-radius: 15px; text-align: center; }
    </style>
</head>
<body>
    <div class="error">
        <h2 style="color: #ef4444;">⚠️ ${msg}</h2>
        <p style="color: #64748b;">Contatta il coach per un nuovo link</p>
    </div>
</body>
</html>
        `;
    }

})();
