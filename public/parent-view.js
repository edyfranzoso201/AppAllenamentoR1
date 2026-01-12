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

    // Funzione per decodificare token e ottenere athlete ID
    window.decodeAthleteToken = function(token) {
        try {
            // Estrai la parte finale che contiene l'ID invertito
            const reversed = token.slice(-5); // Prende ultimi caratteri
            const athleteId = reversed.split('').reverse().join('');
            
            // Verifica che il token sia valido rigenerandolo
            const expectedToken = window.generateAthleteToken(athleteId);
            if (token === expectedToken) {
                return athleteId;
            }
            return null;
        } catch (e) {
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

    const athleteId = window.decodeAthleteToken(token);
    if (!athleteId) {
        console.error('Token non valido');
    }

    let athleteName = '';
    let events = {};
    let responses = {};

    console.log('Modalità Genitore attivata con token crittografato');

    // Nascondi tutto tranne la sezione calendario
    const hideAllExceptCalendar = () => {
        // Nascondi navbar
        const navbar = document.querySelector('nav');
        if (navbar) navbar.style.display = 'none';

        // Nascondi footer
        const footer = document.querySelector('footer');
        if (footer) footer.style.display = 'none';

        // Nascondi tutte le sezioni tranne team-calendar
        const sections = document.querySelectorAll('main > div[class*="row"]');
        sections.forEach(section => {
            if (!section.id || section.id !== 'team-calendar-section') {
                section.style.display = 'none';
            }
        });

        // Mostra solo la sezione calendario
        const calendarSection = document.getElementById('team-calendar-section');
        if (calendarSection) {
            calendarSection.style.display = 'block';
            
            // Nascondi i pulsanti admin
            const adminButtons = calendarSection.querySelector('.row.g-3.mb-4');
            if (adminButtons) adminButtons.style.display = 'none';

            // Nascondi la tabella admin
            const calendarTable = document.getElementById('calendar-table');
            if (calendarTable) calendarTable.style.display = 'none';

            const emptyState = document.getElementById('calendar-empty-state');
            if (emptyState) emptyState.style.display = 'none';
        }

        // Cambia il titolo
        document.title = 'Calendario Presenze - GO Sport';
        
        // Aggiungi stile per evitare scroll inutile
        document.body.style.overflow = 'auto';
    };

    // Crea la vista genitore
    const createParentView = () => {
        const calendarSection = document.getElementById('team-calendar-section');
        if (!calendarSection) return;

        const cardBody = calendarSection.querySelector('.card-body');
        if (!cardBody) return;

        // Svuota e ricrea il contenuto
        cardBody.innerHTML = `
            <div id="parent-loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
                <p class="mt-3">Caricamento calendario...</p>
            </div>
            
            <div id="parent-error" class="alert alert-danger" style="display: none;">
                <h5><i class="bi bi-exclamation-triangle-fill"></i> Accesso non valido</h5>
                <p>Il link non è valido o è scaduto. Contatta l'allenatore per ottenere un nuovo link.</p>
            </div>
            
            <div id="parent-calendar" style="display: none;">
                <div class="text-center mb-4 pb-3 border-bottom">
                    <h3 class="text-primary mb-2"><i class="bi bi-calendar-check"></i> Calendario Presenze</h3>
                    <h4 id="parent-athlete-name" class="text-white mb-0">-</h4>
                    <small class="text-muted">GO Sport - Stagione 2024/2025</small>
                </div>
                <div id="parent-events-container">
                    <!-- Eventi caricati qui -->
                </div>
                <div id="parent-no-events" class="text-center py-5" style="display: none;">
                    <i class="bi bi-calendar-x" style="font-size: 4rem; color: #6c757d;"></i>
                    <h4 class="mt-3">Nessun evento programmato</h4>
                    <p class="text-muted">Al momento non ci sono allenamenti o partite in calendario.</p>
                </div>
            </div>
        `;
    };

    // Carica i dati
    const loadParentData = async () => {
        try {
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error('Errore caricamento');

            const data = await response.json();
            
            // Trova atleta
            const athlete = data.athletes?.find(a => String(a.id) === String(athleteId));
            if (!athlete) {
                showError();
                return;
            }

            athleteName = athlete.name;
            events = data.calendarEvents || {};
            responses = data.calendarResponses || {};

            showParentCalendar();
        } catch (error) {
            console.error('Errore:', error);
            showError();
        }
    };

    const showError = () => {
        document.getElementById('parent-loading').style.display = 'none';
        document.getElementById('parent-error').style.display = 'block';
    };

    const showParentCalendar = () => {
        document.getElementById('parent-loading').style.display = 'none';
        document.getElementById('parent-calendar').style.display = 'block';
        document.getElementById('parent-athlete-name').textContent = athleteName;

        renderParentEvents();
    };

    // Renderizza eventi
    const renderParentEvents = () => {
        const container = document.getElementById('parent-events-container');
        const noEvents = document.getElementById('parent-no-events');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filtra eventi futuri
        const futureEvents = Object.entries(events)
            .filter(([date]) => new Date(date) >= today)
            .sort(([a], [b]) => new Date(a) - new Date(b));

        if (futureEvents.length === 0) {
            container.innerHTML = '';
            noEvents.style.display = 'block';
            return;
        }

        noEvents.style.display = 'none';

        container.innerHTML = futureEvents.map(([eventDate, eventData]) => {
            const eventDateObj = new Date(eventDate);
            const response = responses[eventDate]?.[athleteId];
            const isLocked = isEventLocked(eventDate, eventData.lockDaysBefore || 0);

            return createEventCard(eventDate, eventDateObj, eventData, response, isLocked);
        }).join('');

        // Event listeners
        document.querySelectorAll('.parent-response-btn').forEach(btn => {
            btn.addEventListener('click', handleResponse);
        });
    };

    const createEventCard = (eventDate, eventDateObj, eventData, response, isLocked) => {
        const dayName = eventDateObj.toLocaleDateString('it-IT', { weekday: 'long' });
        const dateStr = eventDateObj.toLocaleDateString('it-IT', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric' 
        });

        const typeColor = eventData.type === 'Partita' ? 'danger' : 'success';
        
        let responseHtml = '';
        let currentResponseHtml = '';

        if (response) {
            const icon = response.presenza === 'Si' ? '✅' : '❌';
            const badgeClass = response.presenza === 'Si' ? 'bg-success' : 'bg-danger';
            currentResponseHtml = `
                <div class="alert alert-info">
                    <strong>Tua risposta:</strong> 
                    <span class="badge ${badgeClass} ms-2">${icon} ${response.presenza}</span>
                    <div class="mt-2"><em>"${response.motivazione}"</em></div>
                    <small class="text-muted d-block mt-1">
                        Inviata il ${new Date(response.timestamp).toLocaleString('it-IT')}
                    </small>
                </div>
            `;
        }

        if (isLocked) {
            responseHtml = `
                <div class="alert alert-warning">
                    <i class="bi bi-lock-fill"></i> Termine per le risposte scaduto
                </div>
            `;
        } else {
            responseHtml = `
                <div class="d-grid gap-2 mt-3">
                    <button class="btn btn-success parent-response-btn" 
                            data-date="${eventDate}" 
                            data-response="Si">
                        <i class="bi bi-check-circle-fill"></i> SI, sarò presente
                    </button>
                    <button class="btn btn-danger parent-response-btn" 
                            data-date="${eventDate}" 
                            data-response="No">
                        <i class="bi bi-x-circle-fill"></i> NO, sarò assente
                    </button>
                </div>
                ${response ? '<small class="text-muted text-center d-block mt-2">Puoi modificare la tua risposta</small>' : ''}
            `;
        }

        return `
            <div class="card mb-3 ${isLocked ? 'opacity-75' : ''}">
                <div class="card-header bg-${typeColor} text-white">
                    <h5 class="mb-0">
                        <i class="bi bi-${eventData.type === 'Partita' ? 'trophy' : 'dribbble'}"></i>
                        ${eventData.type}
                    </h5>
                </div>
                <div class="card-body">
                    <p class="mb-2">
                        <i class="bi bi-calendar-event"></i> 
                        <strong>${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dateStr}</strong>
                    </p>
                    ${eventData.time ? `<p class="mb-2"><i class="bi bi-clock"></i> Orario: ${eventData.time}</p>` : ''}
                    ${currentResponseHtml}
                    ${responseHtml}
                </div>
            </div>
        `;
    };

    const isEventLocked = (eventDate, lockDays) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const eventDateObj = new Date(eventDate);
        const lockDate = new Date(eventDateObj);
        lockDate.setDate(lockDate.getDate() - lockDays);
        
        return today > lockDate;
    };

    const handleResponse = async (e) => {
        const eventDate = e.currentTarget.dataset.date;
        const responseType = e.currentTarget.dataset.response;

        const motivazione = prompt(
            `Motivazione (obbligatoria):\n\n` +
            `Esempio: "Sarò presente", "Impegno familiare", "Influenza", ecc.`
        );

        if (!motivazione || motivazione.trim() === '') {
            alert('La motivazione è obbligatoria!');
            return;
        }

        const responseData = {
            eventDate,
            athleteId,
            presenza: responseType,
            motivazione: motivazione.trim(),
            timestamp: new Date().toISOString()
        };

        try {
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvataggio...';

            // Salva direttamente nei dati
            if (!responses[eventDate]) responses[eventDate] = {};
            responses[eventDate][athleteId] = responseData;

            // Aggiorna window.calendarResponses
            window.calendarResponses = responses;

            // Chiama la funzione di salvataggio globale
            const saved = await window.saveData();
            if (!saved) throw new Error('Errore salvataggio');

            // Ricarica vista
            renderParentEvents();

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

        } catch (error) {
            console.error('Errore:', error);
            alert('Errore nel salvataggio. Riprova.');
            e.currentTarget.disabled = false;
            e.currentTarget.innerHTML = responseType === 'Si' ? 
                '<i class="bi bi-check-circle-fill"></i> SI, sarò presente' :
                '<i class="bi bi-x-circle-fill"></i> NO, sarò assente';
        }
    };

    // Inizializzazione
    const init = () => {
        if (!athleteId) {
            showError();
            return;
        }
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

    let athleteName = '';
    let events = {};
    let responses = {};

    console.log('Modalità Genitore attivata per atleta:', athleteId);

    // Nascondi tutto tranne la sezione calendario
    const hideAllExceptCalendar = () => {
        // Nascondi navbar
        const navbar = document.querySelector('nav');
        if (navbar) navbar.style.display = 'none';

        // Nascondi footer
        const footer = document.querySelector('footer');
        if (footer) footer.style.display = 'none';

        // Nascondi tutte le sezioni tranne team-calendar
        const sections = document.querySelectorAll('main > div[class*="row"]');
        sections.forEach(section => {
            if (!section.id || section.id !== 'team-calendar-section') {
                section.style.display = 'none';
            }
        });

        // Mostra solo la sezione calendario
        const calendarSection = document.getElementById('team-calendar-section');
        if (calendarSection) {
            calendarSection.style.display = 'block';
            
            // Nascondi i pulsanti admin
            const adminButtons = calendarSection.querySelector('.row.g-3.mb-4');
            if (adminButtons) adminButtons.style.display = 'none';

            // Nascondi la tabella admin
            const calendarTable = document.getElementById('calendar-table');
            if (calendarTable) calendarTable.style.display = 'none';

            const emptyState = document.getElementById('calendar-empty-state');
            if (emptyState) emptyState.style.display = 'none';
        }

        // Cambia il titolo
        document.title = 'Calendario Presenze - GO Sport';
    };

    // Crea la vista genitore
    const createParentView = () => {
        const calendarSection = document.getElementById('team-calendar-section');
        if (!calendarSection) return;

        const cardBody = calendarSection.querySelector('.card-body');
        if (!cardBody) return;

        // Svuota e ricrea il contenuto
        cardBody.innerHTML = `
            <div id="parent-loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
                <p class="mt-3">Caricamento calendario...</p>
            </div>
            
            <div id="parent-error" class="alert alert-danger" style="display: none;">
                <h5><i class="bi bi-exclamation-triangle-fill"></i> Accesso non valido</h5>
                <p>Il link non è valido o è scaduto. Contatta l'allenatore.</p>
            </div>
            
            <div id="parent-calendar" style="display: none;">
                <div class="text-center mb-4">
                    <h3 class="text-primary"><i class="bi bi-calendar-check"></i> Calendario Presenze</h3>
                    <h4 id="parent-athlete-name" class="text-white">-</h4>
                </div>
                <div id="parent-events-container">
                    <!-- Eventi caricati qui -->
                </div>
                <div id="parent-no-events" class="text-center py-5" style="display: none;">
                    <i class="bi bi-calendar-x" style="font-size: 4rem; color: #6c757d;"></i>
                    <h4 class="mt-3">Nessun evento programmato</h4>
                    <p class="text-muted">Al momento non ci sono allenamenti o partite in calendario.</p>
                </div>
            </div>
        `;
    };

    // Carica i dati
    const loadParentData = async () => {
        try {
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error('Errore caricamento');

            const data = await response.json();
            
            // Trova atleta
            const athlete = data.athletes?.find(a => String(a.id) === String(athleteId));
            if (!athlete) {
                showError();
                return;
            }

            athleteName = athlete.name;
            events = data.calendarEvents || {};
            responses = data.calendarResponses || {};

            showParentCalendar();
        } catch (error) {
            console.error('Errore:', error);
            showError();
        }
    };

    const showError = () => {
        document.getElementById('parent-loading').style.display = 'none';
        document.getElementById('parent-error').style.display = 'block';
    };

    const showParentCalendar = () => {
        document.getElementById('parent-loading').style.display = 'none';
        document.getElementById('parent-calendar').style.display = 'block';
        document.getElementById('parent-athlete-name').textContent = athleteName;

        renderParentEvents();
    };

    // Renderizza eventi
    const renderParentEvents = () => {
        const container = document.getElementById('parent-events-container');
        const noEvents = document.getElementById('parent-no-events');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filtra eventi futuri
        const futureEvents = Object.entries(events)
            .filter(([date]) => new Date(date) >= today)
            .sort(([a], [b]) => new Date(a) - new Date(b));

        if (futureEvents.length === 0) {
            container.innerHTML = '';
            noEvents.style.display = 'block';
            return;
        }

        noEvents.style.display = 'none';

        container.innerHTML = futureEvents.map(([eventDate, eventData]) => {
            const eventDateObj = new Date(eventDate);
            const response = responses[eventDate]?.[athleteId];
            const isLocked = isEventLocked(eventDate, eventData.lockDaysBefore || 0);

            return createEventCard(eventDate, eventDateObj, eventData, response, isLocked);
        }).join('');

        // Event listeners
        document.querySelectorAll('.parent-response-btn').forEach(btn => {
            btn.addEventListener('click', handleResponse);
        });
    };

    const createEventCard = (eventDate, eventDateObj, eventData, response, isLocked) => {
        const dayName = eventDateObj.toLocaleDateString('it-IT', { weekday: 'long' });
        const dateStr = eventDateObj.toLocaleDateString('it-IT', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric' 
        });

        const typeColor = eventData.type === 'Partita' ? 'danger' : 'success';
        
        let responseHtml = '';
        let currentResponseHtml = '';

        if (response) {
            const icon = response.presenza === 'Si' ? '✅' : '❌';
            const badgeClass = response.presenza === 'Si' ? 'bg-success' : 'bg-danger';
            currentResponseHtml = `
                <div class="alert alert-info">
                    <strong>Tua risposta:</strong> 
                    <span class="badge ${badgeClass}">${icon} ${response.presenza}</span>
                    <div class="mt-2"><em>"${response.motivazione}"</em></div>
                    <small class="text-muted d-block mt-1">
                        Inviata il ${new Date(response.timestamp).toLocaleString('it-IT')}
                    </small>
                </div>
            `;
        }

        if (isLocked) {
            responseHtml = `
                <div class="alert alert-warning">
                    <i class="bi bi-lock-fill"></i> Termine per le risposte scaduto
                </div>
            `;
        } else {
            responseHtml = `
                <div class="d-grid gap-2 mt-3">
                    <button class="btn btn-success parent-response-btn" 
                            data-date="${eventDate}" 
                            data-response="Si">
                        <i class="bi bi-check-circle-fill"></i> SI, sarò presente
                    </button>
                    <button class="btn btn-danger parent-response-btn" 
                            data-date="${eventDate}" 
                            data-response="No">
                        <i class="bi bi-x-circle-fill"></i> NO, sarò assente
                    </button>
                </div>
                ${response ? '<small class="text-muted text-center d-block mt-2">Puoi modificare la tua risposta</small>' : ''}
            `;
        }

        return `
            <div class="card mb-3 ${isLocked ? 'opacity-75' : ''}">
                <div class="card-header bg-${typeColor} text-white">
                    <h5 class="mb-0">
                        <i class="bi bi-${eventData.type === 'Partita' ? 'trophy' : 'dribbble'}"></i>
                        ${eventData.type}
                    </h5>
                </div>
                <div class="card-body">
                    <p class="mb-2">
                        <i class="bi bi-calendar-event"></i> 
                        <strong>${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dateStr}</strong>
                    </p>
                    ${eventData.time ? `<p class="mb-2"><i class="bi bi-clock"></i> Orario: ${eventData.time}</p>` : ''}
                    ${currentResponseHtml}
                    ${responseHtml}
                </div>
            </div>
        `;
    };

    const isEventLocked = (eventDate, lockDays) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const eventDateObj = new Date(eventDate);
        const lockDate = new Date(eventDateObj);
        lockDate.setDate(lockDate.getDate() - lockDays);
        
        return today > lockDate;
    };

    const handleResponse = async (e) => {
        const eventDate = e.currentTarget.dataset.date;
        const responseType = e.currentTarget.dataset.response;

        const motivazione = prompt(
            `Motivazione (obbligatoria):\n\n` +
            `Esempio: "Sarò presente", "Impegno familiare", "Influenza", ecc.`
        );

        if (!motivazione || motivazione.trim() === '') {
            alert('La motivazione è obbligatoria!');
            return;
        }

        const responseData = {
            eventDate,
            athleteId,
            presenza: responseType,
            motivazione: motivazione.trim(),
            timestamp: new Date().toISOString()
        };

        try {
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvataggio...';

            // Salva direttamente nei dati
            if (!responses[eventDate]) responses[eventDate] = {};
            responses[eventDate][athleteId] = responseData;

            // Aggiorna window.calendarResponses
            window.calendarResponses = responses;

            // Chiama la funzione di salvataggio globale
            const saved = await window.saveData();
            if (!saved) throw new Error('Errore salvataggio');

            // Ricarica vista
            renderParentEvents();

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

        } catch (error) {
            console.error('Errore:', error);
            alert('Errore nel salvataggio. Riprova.');
            e.currentTarget.disabled = false;
            e.currentTarget.innerHTML = responseType === 'Si' ? 
                '<i class="bi bi-check-circle-fill"></i> SI, sarò presente' :
                '<i class="bi bi-x-circle-fill"></i> NO, sarò assente';
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
