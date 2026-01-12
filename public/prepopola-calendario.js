// prepopola-calendario.js - Script per creare eventi allenamento automatici
(function() {
    'use strict';

    // Configurazione allenamenti settimanali
    const TRAINING_SCHEDULE = [
        { day: 1, time: '18:30-20:00' },      // Lunedì
        { day: 3, time: '17:30-19:00' },      // Mercoledì
        { day: 5, time: '18:00-19:15' }       // Venerdì
    ];

    // Data fine (30 Giugno 2026)
    const END_DATE = new Date('2026-06-30');

    /**
     * Genera tutti gli eventi di allenamento da oggi fino a fine giugno
     */
    function generateTrainingEvents() {
        const events = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let currentDate = new Date(today);

        // Continua fino a fine giugno
        while (currentDate <= END_DATE) {
            const dayOfWeek = currentDate.getDay(); // 0=Domenica, 1=Lunedì, ...

            // Controlla se è un giorno di allenamento
            const training = TRAINING_SCHEDULE.find(t => t.day === dayOfWeek);
            
            if (training) {
                const dateKey = formatDateKey(currentDate);
                
                // Crea evento solo se non esiste già
                if (!window.calendarEvents[dateKey]) {
                    events[dateKey] = {
                        type: 'Allenamento',
                        time: training.time,
                        notes: 'Allenamento settimanale',
                        createdAt: new Date().toISOString()
                    };
                }
            }

            // Vai al giorno successivo
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return events;
    }

    /**
     * Formatta data come YYYY-MM-DD
     */
    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Salva eventi nel database
     */
    async function saveEventsToDatabase(newEvents) {
        try {
            // Carica dati attuali
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const allData = await response.json();
            
            // Merge con eventi esistenti
            allData.calendarEvents = allData.calendarEvents || {};
            Object.assign(allData.calendarEvents, newEvents);
            
            // Salva
            const saveResponse = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allData)
            });

            if (!saveResponse.ok) throw new Error('Errore nel salvataggio');

            return Object.keys(newEvents).length;
        } catch (error) {
            console.error('Errore salvataggio eventi:', error);
            throw error;
        }
    }

    /**
     * Inizializza eventi automaticamente
     */
    async function initializeTrainingEvents() {
        try {
            console.log('[Calendario] Generazione eventi allenamento...');
            
            const newEvents = generateTrainingEvents();
            const count = Object.keys(newEvents).length;

            if (count === 0) {
                console.log('[Calendario] Nessun nuovo evento da creare');
                return 0;
            }

            console.log(`[Calendario] Generati ${count} eventi allenamento`);
            
            const saved = await saveEventsToDatabase(newEvents);
            console.log(`[Calendario] Salvati ${saved} eventi nel database`);

            // Aggiorna anche in memoria
            window.calendarEvents = window.calendarEvents || {};
            Object.assign(window.calendarEvents, newEvents);

            // Ricarica la vista se siamo nella sezione calendario
            if (typeof window.renderCalendarView === 'function') {
                window.renderCalendarView();
            }

            return saved;
        } catch (error) {
            console.error('[Calendario] Errore inizializzazione:', error);
            throw error;
        }
    }

    /**
     * Pulsante manuale per generare eventi
     */
    function addGenerateButton() {
        const calendarSection = document.getElementById('team-calendar-section');
        if (!calendarSection) return;

        // Cerca il container dei pulsanti
        const buttonsContainer = calendarSection.querySelector('.row.mb-3');
        if (!buttonsContainer) return;

        // Aggiungi pulsante se non esiste già
        if (document.getElementById('auto-generate-training-btn')) return;

        const buttonCol = document.createElement('div');
        buttonCol.className = 'col-lg-3 col-md-6';
        buttonCol.innerHTML = `
            <button class="btn btn-warning w-100" id="auto-generate-training-btn">
                <i class="bi bi-magic"></i> Genera Allenamenti
            </button>
        `;

        buttonsContainer.appendChild(buttonCol);

        // Event listener
        document.getElementById('auto-generate-training-btn').addEventListener('click', async function() {
            const btn = this;
            const originalHTML = btn.innerHTML;
            
            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generazione...';
                
                const count = await initializeTrainingEvents();
                
                btn.innerHTML = '<i class="bi bi-check-circle"></i> Completato!';
                btn.className = 'btn btn-success w-100';
                
                // Mostra notifica
                if (window.showAlert) {
                    window.showAlert('success', `Creati ${count} eventi di allenamento fino a Giugno 2026!`);
                }
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.className = 'btn btn-warning w-100';
                    btn.disabled = false;
                }, 3000);
                
            } catch (error) {
                btn.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Errore';
                btn.className = 'btn btn-danger w-100';
                
                if (window.showAlert) {
                    window.showAlert('danger', 'Errore nella generazione degli eventi: ' + error.message);
                }
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.className = 'btn btn-warning w-100';
                    btn.disabled = false;
                }, 3000);
            }
        });
    }

    // Inizializza quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(addGenerateButton, 1000);
        });
    } else {
        setTimeout(addGenerateButton, 1000);
    }

    // Esponi funzioni globalmente per uso manuale
    window.generateTrainingEvents = generateTrainingEvents;
    window.initializeTrainingEvents = initializeTrainingEvents;

})();
