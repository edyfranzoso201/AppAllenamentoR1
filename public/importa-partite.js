// importa-partite.js - Script per importare partite di campionato
(function() {
    'use strict';

    /**
     * Importa partite da array di oggetti
     * Formato atteso: [{ data: 'YYYY-MM-DD', ora: 'HH:MM-HH:MM', avversario: 'Nome squadra', casa: true/false }]
     */
    async function importMatches(matchesData) {
        try {
            console.log('[Partite] Importazione in corso...');
            
            const events = {};
            
            matchesData.forEach(match => {
                const { data, ora, avversario, casa } = match;
                
                if (!data || !ora) {
                    console.warn('[Partite] Partita senza data/ora:', match);
                    return;
                }
                
                const dateKey = data; // Formato YYYY-MM-DD
                const location = casa ? 'Casa' : 'Trasferta';
                const notes = `${location} vs ${avversario || 'Avversario TBD'}`;
                
                events[dateKey] = {
                    type: 'Partita',
                    time: ora,
                    notes: notes,
                    createdAt: new Date().toISOString()
                };
            });

            // Salva nel database
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const allData = await response.json();
            allData.calendarEvents = allData.calendarEvents || {};
            
            // Merge con eventi esistenti (le partite sovrascrivono allenamenti)
            Object.assign(allData.calendarEvents, events);
            
            const saveResponse = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allData)
            });

            if (!saveResponse.ok) throw new Error('Errore nel salvataggio');

            // Aggiorna in memoria
            window.calendarEvents = allData.calendarEvents;

            // Ricarica vista
            if (typeof window.renderCalendarView === 'function') {
                window.renderCalendarView();
            }

            console.log(`[Partite] Importate ${Object.keys(events).length} partite`);
            return Object.keys(events).length;

        } catch (error) {
            console.error('[Partite] Errore importazione:', error);
            throw error;
        }
    }

    /**
     * Importa da file JSON
     */
    async function importMatchesFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const count = await importMatches(data);
                    resolve(count);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Errore lettura file'));
            reader.readAsText(file);
        });
    }

    /**
     * Importa da CSV
     * Formato: data,ora,avversario,casa
     * Esempio: 2026-01-15,18:30-20:00,Juventus,true
     */
    async function importMatchesFromCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n').filter(l => l.trim());
                    
                    // Salta header se presente
                    const startIndex = lines[0].toLowerCase().includes('data') ? 1 : 0;
                    
                    const matches = lines.slice(startIndex).map(line => {
                        const [data, ora, avversario, casa] = line.split(',').map(s => s.trim());
                        return {
                            data,
                            ora,
                            avversario,
                            casa: casa.toLowerCase() === 'true' || casa === '1'
                        };
                    });
                    
                    const count = await importMatches(matches);
                    resolve(count);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Errore lettura file'));
            reader.readAsText(file);
        });
    }

    /**
     * Aggiungi UI per importazione
     */
    function addImportUI() {
        const calendarSection = document.getElementById('team-calendar-section');
        if (!calendarSection) return;

        // Cerca il container dei pulsanti
        const buttonsContainer = calendarSection.querySelector('.row.mb-3');
        if (!buttonsContainer) return;

        // Aggiungi pulsante se non esiste già
        if (document.getElementById('import-matches-btn')) return;

        const buttonCol = document.createElement('div');
        buttonCol.className = 'col-lg-3 col-md-6';
        buttonCol.innerHTML = `
            <button class="btn btn-info w-100" id="import-matches-btn">
                <i class="bi bi-upload"></i> Importa Partite
            </button>
            <input type="file" id="import-matches-file" accept=".json,.csv" style="display:none">
        `;

        buttonsContainer.appendChild(buttonCol);

        // Event listeners
        const btn = document.getElementById('import-matches-btn');
        const fileInput = document.getElementById('import-matches-file');

        btn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const originalHTML = btn.innerHTML;
            
            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Importazione...';
                
                let count;
                if (file.name.endsWith('.json')) {
                    count = await importMatchesFromFile(file);
                } else if (file.name.endsWith('.csv')) {
                    count = await importMatchesFromCSV(file);
                } else {
                    throw new Error('Formato file non supportato');
                }
                
                btn.innerHTML = '<i class="bi bi-check-circle"></i> Importato!';
                btn.className = 'btn btn-success w-100';
                
                if (window.showAlert) {
                    window.showAlert('success', `Importate ${count} partite di campionato!`);
                }
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.className = 'btn btn-info w-100';
                    btn.disabled = false;
                }, 3000);
                
            } catch (error) {
                btn.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Errore';
                btn.className = 'btn btn-danger w-100';
                
                if (window.showAlert) {
                    window.showAlert('danger', 'Errore importazione: ' + error.message);
                }
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.className = 'btn btn-info w-100';
                    btn.disabled = false;
                }, 3000);
            }
            
            // Reset input
            fileInput.value = '';
        });
    }

    // Inizializza quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(addImportUI, 1000);
        });
    } else {
        setTimeout(addImportUI, 1000);
    }

    // Esponi funzioni globalmente
    window.importMatches = importMatches;
    window.importMatchesFromFile = importMatchesFromFile;
    window.importMatchesFromCSV = importMatchesFromCSV;

})();
