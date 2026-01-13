// parent-view.js - Vista Atleta per Conferma Presenze
(function() {
    'use strict';

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

    // Decodifica token per ottenere athleteId
    window.decodeAthleteToken = function(token) {
        try {
            const reversed = token.match(/[0-9]+$/);
            if (!reversed) return null;
            const athleteId = reversed[0].split('').reverse().join('');
            return athleteId;
        } catch (e) {
            console.error('Errore decodifica token:', e);
            return null;
        }
    };

    // Controlla se siamo in modalità presenza
    const path = window.location.pathname;
    const isPresenzaMode = path.includes('/presenza/');
    
    if (!isPresenzaMode) return; // Non è modalità presenza, esci

    // Estrai token dal path
    const pathParts = path.split('/presenza/');
    const token = pathParts[1] ? pathParts[1].replace('.html', '').replace('/', '') : null;
    
    if (!token) {
        console.error('Token mancante nel path');
        return;
    }

    // Decodifica token per ottenere athleteId
    const athleteId = window.decodeAthleteToken(token);
    
    if (!athleteId) {
        document.body.innerHTML = '<div style="padding:50px;text-align:center;background:#0f172a;color:#fff;min-height:100vh;"><h2>⚠️ Link non valido</h2><p>Il link che hai usato non è corretto.</p></div>';
        return;
    }

    console.log('[Presenza Mode] Token decodificato, Atleta ID:', athleteId);

    // Nascondi tutta la dashboard e mostra solo calendario atleta
    function hideAllAndShowAthleteCalendar() {
        // Imposta sfondo
        document.body.style.backgroundColor = '#0f172a';
        document.body.style.color = '#ffffff';
        document.body.style.minHeight = '100vh';
        document.body.style.padding = '20px';
        
        // Nascondi tutto
        document.body.innerHTML = '';
        
        // Crea contenitore vista atleta
        const container = document.createElement('div');
        container.className = 'container-fluid';
        container.id = 'athlete-presence-view';
        container.innerHTML = `
            <div class="row mb-4">
                <div class="col-12">
                    <h1 style="color: #60a5fa; font-weight: 700;">
                        <i class="bi bi-calendar-check-fill"></i> Conferma Presenze
                    </h1>
                    <p id="athlete-name" style="font-size: 20px; margin-top: 10px;">Caricamento...</p>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <div id="calendar-container" style="background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 15px; padding: 30px;">
                        <div class="text-center p-5">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Caricamento...</span>
                            </div>
                            <p class="mt-3">Caricamento calendario...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }

    // Carica dati e mostra solo la riga dell'atleta
    async function loadAthleteData() {
        try {
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error('Errore caricamento dati');
            
            const data = await response.json();
            const athletes = data.athletes || [];
            const calendarEvents = data.calendarEvents || {};
            const calendarResponses = data.calendarResponses || {};

            // Trova atleta
            const athlete = athletes.find(a => a.id == athleteId);
            if (!athlete) {
                document.getElementById('calendar-container').innerHTML = 
                    '<div class="alert alert-danger">⚠️ Atleta non trovato nel sistema.</div>';
                return;
            }

            if (athlete.guest) {
                document.getElementById('calendar-container').innerHTML = 
                    '<div class="alert alert-info">ℹ️ Gli atleti ospiti non hanno accesso al calendario presenze.</div>';
                return;
            }

            // Aggiorna nome atleta
            document.getElementById('athlete-name').innerHTML = `
                <i class="bi bi-person-circle"></i> <strong>${athlete.name}</strong>
            `;

            // Renderizza calendario solo per questo atleta
            renderAthleteCalendar(athlete, calendarEvents, calendarResponses);

        } catch (error) {
            console.error('Errore:', error);
            document.getElementById('calendar-container').innerHTML = 
                '<div class="alert alert-danger">❌ Errore nel caricamento dei dati. Riprova più tardi.</div>';
        }
    }

    // Renderizza calendario per singolo atleta
    function renderAthleteCalendar(athlete, calendarEvents, calendarResponses) {
        const container = document.getElementById('calendar-container');
        const sortedDates = Object.keys(calendarEvents).sort();
        
        // Filtra solo eventi futuri
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingEvents = sortedDates.filter(dateKey => {
            const eventDate = new Date(dateKey);
            return eventDate >= today;
        });

        if (upcomingEvents.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nessun evento futuro in calendario.</div>';
            return;
        }

        // Crea tabella orizzontale: una riga per l'atleta
        let html = '<div class="table-responsive">';
        html += '<table class="table table-bordered" style="color: #fff;">';
        html += '<thead style="background: #1e293b;"><tr>';
        html += '<th>Atleta</th>';
        
        // Header date
        upcomingEvents.forEach(date => {
            const d = new Date(date);
            const day = d.toLocaleDateString('it-IT', {weekday: 'short'});
            const dateStr = d.toLocaleDateString('it-IT', {day: '2-digit', month: '2-digit'});
            html += `<th class="text-center" style="min-width: 150px;">${day}<br>${dateStr}</th>`;
        });
        html += '</tr>';
        
        // Riga tipo evento
        html += '<tr><th style="background: #1e293b;">Evento</th>';
        upcomingEvents.forEach(date => {
            const event = calendarEvents[date];
            const icon = event.type === 'Partita' ? '🏆' : '⚽';
            const badgeClass = event.type === 'Partita' ? 'badge bg-danger' : 'badge bg-primary';
            html += `<th class="text-center" style="background: #1e293b;">`;
            html += `<span class="${badgeClass}">${icon} ${event.type}</span><br>`;
            html += `<small><i class="bi bi-clock"></i> ${event.time}</small>`;
            if (event.notes) html += `<br><small style="opacity: 0.7;">${event.notes}</small>`;
            html += `</th>`;
        });
        html += '</tr></thead><tbody>';

        // Riga atleta
        html += `<tr><td><strong>${athlete.name}</strong></td>`;
        upcomingEvents.forEach(date => {
            const responses = calendarResponses[date] || {};
            const userResponse = responses[athleteId] || null;
            
            html += '<td class="text-center" style="vertical-align: middle;">';
            
            if (userResponse) {
                const isPresent = userResponse.presenza === 'Si';
                if (isPresent) {
                    html += '<div style="font-size: 32px; color: #10b981;">✓</div>';
                    html += '<div><strong style="color: #10b981;">Presente</strong></div>';
                } else {
                    html += '<div style="font-size: 32px; color: #ef4444;">✗</div>';
                    html += '<div><strong style="color: #ef4444;">Assente</strong></div>';
                }
                if (userResponse.motivazione) {
                    html += `<small style="display: block; margin-top: 5px; opacity: 0.7;">${userResponse.motivazione}</small>`;
                }
                html += `<button class="btn btn-sm btn-outline-secondary mt-2" onclick="window.editResponse('${date}')">
                    <i class="bi bi-pencil"></i> Modifica
                </button>`;
            } else {
                html += `<button class="btn btn-primary" onclick="window.showResponseModal('${date}')">
                    <i class="bi bi-calendar-check"></i> Rispondi
                </button>`;
            }
            
            html += '</td>';
        });
        html += '</tr>';

        html += '</tbody></table></div>';

        // Legenda
        html += '<div class="alert alert-info mt-3" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3);">';
        html += '<strong><i class="bi bi-info-circle"></i> Come funziona:</strong><br>';
        html += '• Clicca su "Rispondi" per confermare se sarai presente o assente<br>';
        html += '• Puoi modificare la risposta in qualsiasi momento cliccando su "Modifica"<br>';
        html += '• ✓ = Presente | ✗ = Assente';
        html += '</div>';

        container.innerHTML = html;
    }

    // Mostra modal per risposta
    window.showResponseModal = function(dateKey) {
        const event = window.currentCalendarEvents[dateKey];
        const date = new Date(dateKey).toLocaleDateString('it-IT', { 
            weekday: 'long', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });

        const modalHTML = `
            <div class="modal fade" id="responseModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content" style="background: #1e293b; color: white;">
                        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <h5 class="modal-title">
                                <i class="bi bi-calendar-check"></i> Conferma Presenza
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <strong>${event.type === 'Partita' ? '🏆' : '⚽'} ${event.type}</strong><br>
                                <small>${date}</small><br>
                                <small><i class="bi bi-clock"></i> ${event.time}</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label"><strong>Sarai presente?</strong></label>
                                <select class="form-select" id="presenza-select" style="background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.2);">
                                    <option value="Si">✅ SI, sarò presente</option>
                                    <option value="No">❌ NO, sarò assente</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Note (opzionale):</label>
                                <textarea class="form-control" id="motivazione-input" rows="3" 
                                    placeholder="Es: Malato, Impegno familiare, ecc." 
                                    style="background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.2);"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer" style="border-top: 1px solid rgba(255,255,255,0.1);">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" onclick="window.saveResponse('${dateKey}')">
                                <i class="bi bi-check-circle"></i> Salva Risposta
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('responseModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('responseModal'));
        modal.show();
    };

    // Salva risposta
    window.saveResponse = async function(dateKey) {
        const presenza = document.getElementById('presenza-select').value;
        const motivazione = document.getElementById('motivazione-input').value.trim();

        try {
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error('Errore caricamento');
            
            const allData = await response.json();
            
            if (!allData.calendarResponses) allData.calendarResponses = {};
            if (!allData.calendarResponses[dateKey]) allData.calendarResponses[dateKey] = {};
            
            allData.calendarResponses[dateKey][athleteId] = {
                presenza: presenza,
                motivazione: motivazione,
                timestamp: new Date().toISOString()
            };

            const saveResponse = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allData)
            });

            if (!saveResponse.ok) throw new Error('Errore salvataggio');

            // Chiudi modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('responseModal'));
            modal.hide();

            // Mostra conferma
            alert('✅ Risposta salvata con successo!');

            // Ricarica pagina
            window.location.reload();

        } catch (error) {
            console.error('Errore:', error);
            alert('❌ Errore nel salvataggio. Riprova.');
        }
    };

    // Modifica risposta
    window.editResponse = function(dateKey) {
        window.showResponseModal(dateKey);
        
        setTimeout(async () => {
            try {
                const response = await fetch('/api/data', { cache: 'no-store' });
                const data = await response.json();
                const responses = data.calendarResponses[dateKey] || {};
                const currentResponse = responses[athleteId];
                
                if (currentResponse) {
                    document.getElementById('presenza-select').value = currentResponse.presenza;
                    if (currentResponse.motivazione) {
                        document.getElementById('motivazione-input').value = currentResponse.motivazione;
                    }
                }
            } catch (e) {
                console.error('Errore caricamento risposta:', e);
            }
        }, 100);
    };

    // Inizializzazione
    async function init() {
        hideAllAndShowAthleteCalendar();
        
        // Carica dati
        try {
            const response = await fetch('/api/data', { cache: 'no-store' });
            const data = await response.json();
            window.currentCalendarEvents = data.calendarEvents || {};
            await loadAthleteData();
        } catch (error) {
            console.error('Errore init:', error);
        }
    }

    // Avvia quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
