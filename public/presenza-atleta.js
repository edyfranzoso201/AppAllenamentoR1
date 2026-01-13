// presenza-atleta.js - Sistema conferma presenze con blocco
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
    if (!path.includes('/presenza/')) return;

    const token = path.split('/presenza/')[1]?.replace(/[/.html]/g, '');
    if (!token) return;

    const athleteId = decodeToken(token);
    if (!athleteId) {
        showError('Link non valido');
        return;
    }

    let currentAthlete = null;
    let allEvents = {};
    let allResponses = {};

    function showError(msg) {
        document.body.innerHTML = `
            <div style="max-width:600px;margin:50px auto;padding:30px;text-align:center;background:white;border-radius:15px;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
                <h2 style="color:#ef4444;margin-bottom:20px;">⚠️ ${msg}</h2>
                <p>Contatta il coach per un nuovo link</p>
            </div>
        `;
    }

    async function init() {
        // Nascondi tutto e crea interfaccia presenza
        document.body.innerHTML = '';
        document.body.style.cssText = 'background:#f8f9fa;margin:0;padding:20px;font-family:system-ui;';

        const container = document.createElement('div');
        container.style.cssText = 'max-width:1200px;margin:0 auto;';
        container.innerHTML = `
            <div style="background:white;padding:30px;border-radius:15px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px;">
                <h1 style="color:#2563eb;margin:0 0 10px 0;">📅 Conferma Presenze GO SPORT</h1>
                <p id="athlete-name" style="font-size:18px;color:#64748b;margin:0;">Caricamento...</p>
            </div>
            <div id="events-container"></div>
        `;
        document.body.appendChild(container);

        await loadData();
    }

    async function loadData() {
        try {
            const r = await fetch('/api/data', {cache: 'no-store'});
            const data = await r.json();

            currentAthlete = (data.athletes || []).find(a => a.id == athleteId);
            if (!currentAthlete) {
                showError('Atleta non trovato');
                return;
            }

            allEvents = data.calendarEvents || {};
            allResponses = data.calendarResponses || {};

            document.getElementById('athlete-name').innerHTML = `
                <i class="bi bi-person-circle"></i> <strong>${currentAthlete.name}</strong>
            `;

            renderEvents();
        } catch (e) {
            showError('Errore caricamento dati');
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
                <div style="background:white;padding:30px;border-radius:15px;text-align:center;">
                    <p style="color:#64748b;">Nessun evento futuro</p>
                </div>
            `;
            return;
        }

        let html = '';
        dates.forEach(date => {
            const event = allEvents[date];
            const eventDate = new Date(date);
            const response = (allResponses[date] || {})[athleteId];
            
            // Verifica se è bloccato (48h prima)
            const hoursUntil = (eventDate - today) / (1000 * 60 * 60);
            const isLocked = hoursUntil < 48 || response?.locked;
            const canRespond = !isLocked && !response;

            html += `
                <div style="background:white;padding:25px;border-radius:15px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:15px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;">
                        <div style="flex:1;min-width:200px;">
                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                                <span style="font-size:24px;">${event.type === 'Partita' ? '🏆' : '⚽'}</span>
                                <h3 style="margin:0;color:#1e293b;font-size:20px;">${event.type}</h3>
                            </div>
                            <p style="margin:5px 0;color:#64748b;">
                                📅 ${eventDate.toLocaleDateString('it-IT', {weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'})}
                            </p>
                            <p style="margin:5px 0;color:#64748b;">
                                🕐 ${event.time}
                            </p>
                            ${event.notes ? `<p style="margin:5px 0;color:#64748b;font-size:14px;">${event.notes}</p>` : ''}
                            ${isLocked && !response ? `<p style="margin:10px 0 0 0;color:#ef4444;font-size:13px;">⚠️ Scaduto - Conferma non più possibile</p>` : ''}
                        </div>
                        <div style="text-align:right;">
                            ${renderResponseButtons(date, response, canRespond, isLocked)}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
            <div style="background:#e0f2fe;padding:20px;border-radius:15px;margin-top:20px;">
                <h4 style="margin:0 0 10px 0;color:#0369a1;">ℹ️ Come funziona:</h4>
                <ul style="margin:0;padding-left:20px;color:#0c4a6e;">
                    <li>Conferma presenza/assenza entro 2 giorni prima dell'evento</li>
                    <li>Dopo la conferma, la scelta è definitiva</li>
                    <li>Se presente: ✅ Verde | Se assente: ❌ Rosso</li>
                </ul>
            </div>
        `;

        container.innerHTML = html;
    }

    function renderResponseButtons(date, response, canRespond, isLocked) {
        if (response) {
            // Risposta già data
            const isPresent = response.presenza === 'Si';
            const color = isPresent ? '#10b981' : '#ef4444';
            const icon = isPresent ? '✅' : '❌';
            const text = isPresent ? 'PRESENTE' : 'ASSENTE';
            
            return `
                <div style="text-align:center;">
                    <div style="font-size:32px;margin-bottom:8px;">${icon}</div>
                    <div style="font-weight:600;color:${color};font-size:18px;margin-bottom:5px;">${text}</div>
                    ${response.motivazione ? `<div style="color:#64748b;font-size:14px;margin-top:8px;">"${response.motivazione}"</div>` : ''}
                    <div style="color:#64748b;font-size:12px;margin-top:8px;">
                        🔒 Confermato ${new Date(response.timestamp).toLocaleDateString('it-IT')}
                    </div>
                </div>
            `;
        }

        if (isLocked) {
            return `<div style="color:#94a3b8;font-style:italic;">Scaduto</div>`;
        }

        // Può ancora rispondere
        return `
            <button onclick="confirmPresence('${date}', 'Si')" 
                style="background:#10b981;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:8px;width:150px;display:block;"
                onmouseover="this.style.background='#059669'" 
                onmouseout="this.style.background='#10b981'">
                ✅ Sarò presente
            </button>
            <button onclick="confirmPresence('${date}', 'No')" 
                style="background:#ef4444;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;width:150px;display:block;"
                onmouseover="this.style.background='#dc2626'" 
                onmouseout="this.style.background='#ef4444'">
                ❌ Sarò assente
            </button>
        `;
    }

    window.confirmPresence = async function(date, presenza) {
        let motivazione = '';
        if (presenza === 'No') {
            motivazione = prompt('Motivo assenza (opzionale):') || '';
        }

        if (!confirm(`Confermare: ${presenza === 'Si' ? 'PRESENTE' : 'ASSENTE'}?\n\nAttenzione: Non potrai più modificare questa scelta!`)) {
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

            alert('✅ Presenza confermata!\n\nLa tua scelta è stata salvata.');
            location.reload();
        } catch (e) {
            alert('❌ Errore nel salvataggio. Riprova.');
        }
    };

    // Avvia
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
