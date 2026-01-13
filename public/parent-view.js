// parent-view.js - Vista Genitore Integrata con Token Crittografato
(function() {
    'use strict';

    // Funzione per generare hash semplice (usata anche lato admin)
    window.generateAthleteToken = function(athleteId) {
        // Usa un salt fisso + ID atleta per generare token univoco
        const salt = 'GO_SPORT_2025_SECRET_KEY'; // Cambia questo per maggiore sicurezza
        const str = salt + athleteId;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        // Converti in base36 e aggiungi padding
        const token = Math.abs(hash).toString(36) + athleteId.toString().split('').reverse().join('');
        return token;
    };

    // Decodifica token per ottenere athleteId
    window.decodeAthleteToken = function(token) {
        try {
            // Estrai la parte invertita dell'ID (dopo il hash)
            const reversed = token.match(/[0-9]+$/);
            if (!reversed) return null;
            const athleteId = reversed[0].split('').reverse().join('');
            return athleteId;
        } catch (e) {
            console.error('Errore decodifica token:', e);
            return null;
        }
    };

    // Controlla se siamo in modalità genitore
    const path = window.location.pathname;
    const isParentMode = path.includes('/presenza/');
    
    if (!isParentMode) return; // Non è modalità genitore

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
        document.body.innerHTML = '<div style="padding:50px;text-align:center;"><h2>⚠️ Link non valido</h2><p>Il link che hai usato non è corretto.</p></div>';
        return;
    }

    console.log('[Parent Mode] Token decodificato, Atleta ID:', athleteId);

    // Nascondi tutto tranne la sezione calendario
    function hideAllExceptCalendar() {
        const sections = document.querySelectorAll('[id$="-section"]');
        sections.forEach(section => {
            if (section.id !== 'team-calendar-section') {
                section.style.display = 'none';
            }
        });
        
        // Nascondi navigazione e pulsanti admin
        const nav = document.querySelector('.navbar');
        if (nav) nav.style.display = 'none';
        
        const rapidNav = document.querySelector('.rapid-navigation');
        if (rapidNav) rapidNav.style.display = 'none';
        
        // Nascondi pulsanti admin nel calendario
        const adminButtons = document.querySelectorAll('#team-calendar-section .no-print');
        adminButtons.forEach(btn => btn.style.display = 'none');
    }

    // Crea vista personalizzata per il genitore
    function createParentView() {
        const calendarSection = document.getElementById('team-calendar-section');
        if (!calendarSection) return;

        // Trova il nome dell'atleta
        const athlete = window.athletes ? window.athletes.find(a => a.id == athleteId) : null;
        const athleteName = athlete ? athlete.name : 'Atleta';

        // Crea header personalizzato
        const header = document.createElement('div');
        header.className = 'parent-view-header';
        header.style.cssText = 'background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; margin: -20px -20px 30px -20px; border-radius: 15px 15px 0 0; box-shadow: 0 4px 15px rgba(0,0,0,0.2);';
        header.innerHTML = `
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; display: flex; align-items: center; gap: 15px;">
                <i class="bi bi-calendar-check-fill" style="font-size: 36px;"></i>
                Calendario Presenze
            </h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.95;">
                <i class="bi bi-person-circle"></i> ${athleteName}
            </p>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8;">
                Clicca su ogni evento per confermare la tua presenza
            </p>
        `;

        calendarSection.insertBefore(header, calendarSection.firstChild);

        // Nascondi titolo originale
        const originalTitle = calendarSection.querySelector('.main-title');
        if (originalTitle) originalTitle.parentElement.style.display = 'none';
    }

    // Carica dati e renderizza calendario per questo atleta
    async function loadParentData() {
        try {
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error('Errore caricamento dati');
            
            const data = await response.json();
            window.athletes = data.athletes || [];
            window.calendarEvents = data.calendarEvents || {};
            window.calendarResponses = data.calendarResponses || {};

            // Verifica che l'atleta esista
            const athlete = window.athletes.find(a => a.id == athleteId);
            if (!athlete) {
                document.body.innerHTML = '<div style="padding:50px;text-align:center;"><h2>⚠️ Atleta non trovato</h2><p>L\'atleta associato a questo link non esiste nel sistema.</p></div>';
                return;
            }

            // Filtra solo gli ospiti
            if (athlete.guest) {
                document.body.innerHTML = '<div style="padding:50px;text-align:center;"><h2>ℹ️ Atleta Ospite</h2><p>Gli atleti ospiti non hanno accesso al calendario presenze.</p></div>';
                return;
            }

            renderParentCalendar(athleteId);
        } catch (error) {
            console.error('Errore:', error);
            alert('Errore nel caricamento dei dati. Riprova più tardi.');
        }
    }

    // Renderizza calendario per vista genitore
    function renderParentCalendar(athleteId) {
        const calendarSection = document.getElementById('team-calendar-section');
        if (!calendarSection) return;

        const cardBody = calendarSection.querySelector('.card-body');
        if (!cardBody) return;

        // Trova container calendario o crealo
        let container = cardBody.querySelector('#calendar-view-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'calendar-view-container';
            cardBody.appendChild(container);
        }

        // Ordina eventi per data
        const sortedDates = Object.keys(window.calendarEvents).sort();
        
        // Filtra solo eventi futuri o di oggi
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingEvents = sortedDates.filter(dateKey => {
            const eventDate = new Date(dateKey);
            return eventDate >= today;
        });

        if (upcomingEvents.length === 0) {
            container.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle"></i> Nessun evento futuro in calendario.</div>';
            return;
        }

        // Crea tabella eventi
        let html = '<div class="table-responsive" style="max-height: 600px; overflow-y: auto;">';
        html += '<table class="table table-hover" style="margin: 0;">';
        html += '<thead style="position: sticky; top: 0; background: #1e293b; z-index: 10;"><tr>';
        html += '<th style="color: white; padding: 15px;">Data</th>';
        html += '<th style="color: white; padding: 15px;">Evento</th>';
        html += '<th style="color: white; padding: 15px;">Orario</th>';
        html += '<th style="color: white; padding: 15px; text-align: center;">La Tua Risposta</th>';
        html += '</tr></thead><tbody>';

        upcomingEvents.forEach(dateKey => {
            const event = window.calendarEvents[dateKey];
            const responses = window.calendarResponses[dateKey] || {};
            const userResponse = responses[athleteId] || null;

            const date = new Date(dateKey);
            const dayName = date.toLocaleDateString('it-IT', { weekday: 'long' });
            const dateStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

            const eventIcon = event.type === 'Partita' ? '🏆' : '⚽';
            const eventTypeClass = event.type === 'Partita' ? 'badge bg-danger' : 'badge bg-primary';

            html += '<tr>';
            html += `<td style="padding: 15px;"><strong>${dayName}</strong><br>${dateStr}</td>`;
            html += `<td style="padding: 15px;"><span class="${eventTypeClass}">${eventIcon} ${event.type}</span><br><small>${event.notes || ''}</small></td>`;
            html += `<td style="padding: 15px;"><i class="bi bi-clock"></i> ${event.time}</td>`;
            html += `<td style="padding: 15px; text-align: center;">`;
            
            if (userResponse) {
                const isPresent = userResponse.presenza === 'Si';
                const statusIcon = isPresent ? 
                    '<i class="bi bi-check-circle-fill text-success" style="font-size: 24px;"></i>' : 
                    '<i class="bi bi-x-circle-fill text-danger" style="font-size: 24px;"></i>';
                const statusText = isPresent ? 'Presente' : 'Assente';
                
                html += `<div>${statusIcon}<br><strong>${statusText}</strong></div>`;
                
                if (userResponse.motivazione) {
                    html += `<small class="text-muted"><br>Note: ${userResponse.motivazione}</small>`;
                }
                
                html += `<button class="btn btn-sm btn-outline-secondary mt-2" onclick="window.editParentResponse('${dateKey}', ${athleteId})">
                    <i class="bi bi-pencil"></i> Modifica
                </button>`;
            } else {
                html += `<button class="btn btn-primary" onclick="window.showParentResponseModal('${dateKey}', ${athleteId})">
                    <i class="bi bi-calendar-check"></i> Rispondi
                </button>`;
            }
            
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';

        // Legenda
        html += '<div class="alert alert-info mt-3" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3);">';
        html += '<i class="bi bi-info-circle"></i> <strong>Come funziona:</strong><br>';
        html += '• Clicca su "Rispondi" per confermare se l\'atleta sarà presente o assente<br>';
        html += '• Puoi modificare la risposta in qualsiasi momento cliccando su "Modifica"<br>';
        html += '• Ricordati di rispondere per ogni evento!';
        html += '</div>';

        container.innerHTML = html;
    }

    // Mostra modal per risposta genitore
    window.showParentResponseModal = function(dateKey, athleteId) {
        const event = window.calendarEvents[dateKey];
        const date = new Date(dateKey).toLocaleDateString('it-IT', { 
            weekday: 'long', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });

        const modalHTML = `
            <div class="modal fade" id="parentResponseModal" tabindex="-1">
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
                                <label class="form-label"><strong>L'atleta sarà presente?</strong></label>
                                <select class="form-select" id="parent-presenza-select" style="background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.2);">
                                    <option value="Si">✅ SI, sarò presente</option>
                                    <option value="No">❌ NO, sarò assente</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Note (opzionale):</label>
                                <textarea class="form-control" id="parent-motivazione-input" rows="3" 
                                    placeholder="Es: Malato, Impegno familiare, ecc." 
                                    style="background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.2);"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer" style="border-top: 1px solid rgba(255,255,255,0.1);">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" onclick="window.saveParentResponse('${dateKey}', ${athleteId})">
                                <i class="bi bi-check-circle"></i> Salva Risposta
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Rimuovi modal esistente
        const existingModal = document.getElementById('parentResponseModal');
        if (existingModal) existingModal.remove();

        // Aggiungi nuovo modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Mostra modal
        const modal = new bootstrap.Modal(document.getElementById('parentResponseModal'));
        modal.show();
    };

    // Salva risposta genitore
    window.saveParentResponse = async function(dateKey, athleteId) {
        const presenza = document.getElementById('parent-presenza-select').value;
        const motivazione = document.getElementById('parent-motivazione-input').value.trim();

        try {
            // Carica dati
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error('Errore caricamento');
            
            const allData = await response.json();
            
            // Aggiorna risposta
            if (!allData.calendarResponses) allData.calendarResponses = {};
            if (!allData.calendarResponses[dateKey]) allData.calendarResponses[dateKey] = {};
            
            allData.calendarResponses[dateKey][athleteId] = {
                presenza: presenza,
                motivazione: motivazione,
                timestamp: new Date().toISOString()
            };

            // Salva
            const saveResponse = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allData)
            });

            if (!saveResponse.ok) throw new Error('Errore salvataggio');

            // Aggiorna dati locali
            window.calendarResponses = allData.calendarResponses;

            // Chiudi modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('parentResponseModal'));
            modal.hide();

            // Mostra conferma
            const alert = document.createElement('div');
            alert.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
            alert.style.zIndex = '9999';
            alert.innerHTML = `
                <i class="bi bi-check-circle-fill"></i> Risposta salvata con successo!
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            document.body.appendChild(alert);
            setTimeout(() => alert.remove(), 3000);

            // Ricarica vista
            renderParentCalendar(athleteId);

        } catch (error) {
            console.error('Errore:', error);
            alert('Errore nel salvataggio. Riprova.');
        }
    };

    // Modifica risposta esistente
    window.editParentResponse = function(dateKey, athleteId) {
        const responses = window.calendarResponses[dateKey] || {};
        const currentResponse = responses[athleteId];

        window.showParentResponseModal(dateKey, athleteId);

        // Pre-compila i campi
        setTimeout(() => {
            if (currentResponse) {
                document.getElementById('parent-presenza-select').value = currentResponse.presenza;
                if (currentResponse.motivazione) {
                    document.getElementById('parent-motivazione-input').value = currentResponse.motivazione;
                }
            }
        }, 100);
    };

    // Helper per icone risposta
    window.getResponseIcon = function(responseType) {
        if (responseType === 'Si') {
            return '<i class="bi bi-check-circle-fill"></i> SI, sarò presente';
        } else {
            return '<i class="bi bi-x-circle-fill"></i> NO, sarò assente';
        }
    };

    // Inizializzazione
    const init = () => {
        hideAllExceptCalendar();
        createParentView();
        loadParentData();
    };

    // Avvia quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
