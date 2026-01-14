// presenza-atleta.js - Sistema conferma presenze genitori
(function() {
    'use strict';

    // Funzioni token
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

    // Verifica se siamo in modalità presenza
    const path = window.location.pathname;
    if (!path.includes('/presenza/')) {
        return; // Non è modalità presenza, esci
    }

    // Estrai token
    const parts = path.split('/presenza/');
    const token = parts[1] ? parts[1].replace(/[/.html]/g, '') : null;
    
    if (!token) {
        console.error('Token mancante');
        return;
    }

    const athleteId = decodeToken(token);
    if (!athleteId) {
        showError('Link non valido');
        return;
    }

    console.log('[Presenza] Modalità attiva per atleta ID:', athleteId);

    let currentAthlete = null;
    let allEvents = {};
    let allResponses = {};

    function showError(msg) {
        document.body.innerHTML = '';
        document.body.style.cssText = 'margin:0;padding:50px;font-family:system-ui;background:#f8f9fa;';
        const div = document.createElement('div');
        div.style.cssText = 'max-width:600px;margin:0 auto;padding:30px;background:white;border-radius:15px;box-shadow:0 4px 16px rgba(0,0,0,0.1);text-align:center;';
        div.innerHTML = `
            <h2 style="color:#ef4444;margin:0 0 20px 0;">⚠️ ${msg}</h2>
            <p style="color:#64748b;">Contatta il coach per un nuovo link</p>
        `;
        document.body.appendChild(div);
    }

    function hideAllAndInit() {
        // Nascondi completamente tutto
        document.body.innerHTML = '';
        document.body.style.cssText = 'margin:0;padding:20px;font-family:system-ui;background:#f8f9fa;';

        const container = document.createElement('div');
        container.style.cssText = 'max-width:1200px;margin:0 auto;';
        container.innerHTML = `
            <div style="background:white;padding:30px;border-radius:15px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px;">
                <h1 style="color:#2563eb;margin:0 0 10px 0;font-size:28px;">📅 Conferma Presenze GO SPORT</h1>
                <p id="athlete-name" style="font-size:18px;color:#64748b;margin:0;">Caricamento...</p>
            </div>
            <div id="events-container">
                <div style="text-align:center;padding:50px;">
                    <div style="display:inline-block;width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;"></div>
                    <p style="margin-top:20px;color:#64748b;">Caricamento eventi...</p>
                </div>
            </div>
        `;

        // Aggiungi animazione spin
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);

        document.body.appendChild(container);
    }

    async function loadData() {
        try {
            const r = await fetch('/api/data', {cache: 'no-store'});
            if (!r.ok) throw new Error('Errore HTTP');
            
            const data = await r.json();
            currentAthlete = (data.athletes || []).find(a => a.id == athleteId);
            
            if (!currentAthlete) {
                showError('Atleta non trovato nel sistema');
                return;
            }

            allEvents = data.calendarEvents || {};
            allResponses = data.calendarResponses || {};

            document.getElementById('athlete-name').innerHTML = `
                <strong style="color:#1e293b;">👤 ${currentAthlete.name}</strong>
            `;

            renderEvents();
        } catch (e) {
            console.error('Errore caricamento:', e);
            showError('Errore nel caricamento dei dati');
        }
    }

    function renderEvents() {
        const container = document.getElementById('events-container');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dates = Object.keys(allEvents)
            .filter(d => new Date(d) >= today)
            .sort();

        if (dates.length === 0) {
            container.innerHTML = `
                <div style="background:white;padding:40px;border-radius:15px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <div style="font-size:48px;margin-bottom:15px;">📭</div>
                    <p style="color:#64748b;font-size:18px;margin:0;">Nessun evento futuro in calendario</p>
                </div>
            `;
            return;
        }

        let html = '';
        dates.forEach(date => {
            const event = allEvents[date];
            const eventDate = new Date(date);
            const response = (allResponses[date] || {})[athleteId];
            
            // Calcola ore mancanti
            const hoursUntil = (eventDate - today) / (1000 * 60 * 60);
            const isLocked = hoursUntil < 48 || (response && response.locked);
            const canRespond = !isLocked && !response;

            const dayName = eventDate.toLocaleDateString('it-IT', {weekday: 'long'});
            const dateStr = eventDate.toLocaleDateString('it-IT', {day: '2-digit', month: 'long', year: 'numeric'});

            html += `
                <div style="background:white;padding:25px;border-radius:15px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:15px;">
                    <div style="display:flex;justify-content:space-between;align-items:start;gap:20px;flex-wrap:wrap;">
                        <div style="flex:1;min-width:250px;">
                            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                                <span style="font-size:28px;">${event.type === 'Partita' ? '🏆' : '⚽'}</span>
                                <h3 style="margin:0;color:#1e293b;font-size:22px;font-weight:700;">${event.type}</h3>
                            </div>
                            <p style="margin:8px 0;color:#64748b;font-size:16px;">
                                📅 <strong>${dayName}</strong>, ${dateStr}
                            </p>
                            <p style="margin:8px 0;color:#64748b;font-size:16px;">
                                🕐 <strong>${event.time}</strong>
                            </p>
                            ${event.notes ? `<p style="margin:8px 0;color:#64748b;font-size:14px;font-style:italic;">${event.notes}</p>` : ''}
                            ${isLocked && !response ? `<p style="margin:12px 0 0 0;color:#ef4444;font-size:14px;font-weight:600;">⚠️ Troppo vicino - Conferma non più possibile</p>` : ''}
                        </div>
                        <div style="min-width:180px;text-align:center;">
                            ${renderButtons(date, response, canRespond, isLocked)}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
            <div style="background:#e0f2fe;padding:25px;border-radius:15px;margin-top:20px;">
                <h4 style="margin:0 0 15px 0;color:#0369a1;font-size:18px;font-weight:700;">ℹ️ Come funziona</h4>
                <ul style="margin:0;padding-left:20px;color:#0c4a6e;line-height:1.8;">
                    <li>Conferma presenza o assenza <strong>entro 2 giorni</strong> prima dell'evento</li>
                    <li>Dopo la conferma, <strong>la scelta è definitiva</strong> e non può essere modificata</li>
                    <li>Se presente: <span style="color:#10b981;font-weight:700;">✅ Verde</span> | Se assente: <span style="color:#ef4444;font-weight:700;">❌ Rosso</span></li>
                </ul>
            </div>
        `;

        container.innerHTML = html;
    }

    function renderButtons(date, response, canRespond, isLocked) {
        if (response) {
            const isPresent = response.presenza === 'Si';
            const color = isPresent ? '#10b981' : '#ef4444';
            const icon = isPresent ? '✅' : '❌';
            const text = isPresent ? 'PRESENTE' : 'ASSENTE';
            const bgColor = isPresent ? '#d1fae5' : '#fee2e2';
            
            return `
                <div style="padding:20px;background:${bgColor};border-radius:12px;">
                    <div style="font-size:40px;margin-bottom:10px;">${icon}</div>
                    <div style="font-weight:700;color:${color};font-size:20px;margin-bottom:8px;">${text}</div>
                    ${response.motivazione ? `<div style="color:#64748b;font-size:14px;margin-top:12px;padding:10px;background:white;border-radius:8px;">"${response.motivazione}"</div>` : ''}
                    <div style="color:#64748b;font-size:13px;margin-top:12px;font-weight:600;">
                        🔒 Confermato il ${new Date(response.timestamp).toLocaleDateString('it-IT')}
                    </div>
                </div>
            `;
        }

        if (isLocked) {
            return `
                <div style="padding:20px;background:#f1f5f9;border-radius:12px;">
                    <div style="font-size:32px;margin-bottom:8px;">⏰</div>
                    <div style="color:#94a3b8;font-size:16px;font-weight:600;">Scaduto</div>
                    <div style="color:#94a3b8;font-size:13px;margin-top:8px;">Non è più possibile confermare</div>
                </div>
            `;
        }

        return `
            <button onclick="window.confirmPresenza('${date}', 'Si')" 
                style="width:100%;background:#10b981;color:white;border:none;padding:14px 20px;border-radius:10px;font-size:17px;font-weight:700;cursor:pointer;margin-bottom:10px;transition:all 0.2s;"
                onmouseover="this.style.background='#059669';this.style.transform='scale(1.02)'" 
                onmouseout="this.style.background='#10b981';this.style.transform='scale(1)'">
                ✅ Sarò presente
            </button>
            <button onclick="window.confirmPresenza('${date}', 'No')" 
                style="width:100%;background:#ef4444;color:white;border:none;padding:14px 20px;border-radius:10px;font-size:17px;font-weight:700;cursor:pointer;transition:all 0.2s;"
                onmouseover="this.style.background='#dc2626';this.style.transform='scale(1.02)'" 
                onmouseout="this.style.background='#ef4444';this.style.transform='scale(1)'">
                ❌ Sarò assente
            </button>
        `;
    }

    window.confirmPresenza = async function(date, presenza) {
        let motivazione = '';
        if (presenza === 'No') {
            motivazione = prompt('Motivo assenza (opzionale):') || '';
        }

        const confirmText = presenza === 'Si' 
            ? '✅ Confermare PRESENZA?\n\nAttenzione: Non potrai più modificare questa scelta!' 
            : '❌ Confermare ASSENZA?\n\nAttenzione: Non potrai più modificare questa scelta!';

        if (!confirm(confirmText)) {
            return;
        }

        try {
            const r = await fetch('/api/data', {cache: 'no-store'});
            const data = await r.json();

            data.calendarResponses = data.calendarResponses || {};
            data.calendarResponses[date] = data.calendarResponses[date] || {};
            data.calendarResponses[date][athleteId] = {
                presenza: presenza,
                motivazione: motivazione,
                timestamp: new Date().toISOString(),
                locked: true,
                athleteName: currentAthlete.name
            };

            await fetch('/api/data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });

            alert('✅ Presenza confermata!\n\nLa tua scelta è stata salvata correttamente.');
            window.location.reload();
        } catch (e) {
            console.error('Errore salvataggio:', e);
            alert('❌ Errore nel salvataggio.\n\nRiprova tra qualche istante.');
        }
    };

    // Inizializza quando DOM è pronto
    function init() {
        hideAllAndInit();
        loadData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
