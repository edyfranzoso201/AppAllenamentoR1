// presenza-calendar-mode.js - Modalità presenza con ?athleteId= (NO TOKEN)
(function() {
    'use strict';

    console.log('[PRESENZA MODE] 🚀 Script caricato');

    // ===== RILEVA MODALITÀ PRESENZA DA URL PARAMETER =====
    const urlParams = new URLSearchParams(window.location.search);
    const athleteId = urlParams.get('athleteId');
    
    if (!athleteId) {
        console.log('[PRESENZA MODE] ℹ️ Nessun athleteId, modalità normale');
        return; // Modalità normale (coach)
    }

    console.log('[PRESENZA MODE] ⚡ Modalità genitore attivata per ID:', athleteId);

    // FIX: nascondi subito i controlli coach e il titolo, PRIMA di aspettare
    // che la tabella sia renderizzata. In precedenza questo avveniva solo
    // dentro applyPresenzaMode(), chiamata dal polling una volta trovate righe
    // in tabella: due difetti concreti ne derivavano —
    // 1) con calendario popolato, il pannello coach restava visibile per il
    //    tempo del polling (flash prima della vista genitore);
    // 2) con calendario VUOTO (nessuna riga, es. nessuna attività
    //    programmata), il polling andava sempre in timeout e
    //    hideCoachControls() non veniva mai chiamata: il genitore restava
    //    bloccato sul pannello staff completo (Nuovo/Importa/Elimina/Bacheca).
    // Nascondendoli subito, sono già invisibili in entrambi i casi.
    hideCoachControls();
    updateTitle();

    // ===== ASPETTA CHE IL CALENDARIO SIA RENDERIZZATO =====
    function waitForCalendar() {
        let attempts = 0;
        const maxAttempts = 150; // 15 secondi

        const interval = setInterval(() => {
            attempts++;
            const table = document.querySelector('.calendar-table');
            const rows = table ? table.querySelectorAll('tbody tr') : [];

            // Aspetta che la tabella abbia righe (almeno 1)
            if (table && rows.length > 0) {
                clearInterval(interval);
                console.log('[PRESENZA MODE] ✅ Tabella trovata con', rows.length, 'righe dopo', attempts * 100, 'ms');
                applyPresenzaMode(athleteId);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.error('[PRESENZA MODE] ❌ Timeout: tabella non caricata dopo 15 secondi');
                showError('Timeout', 'Il calendario non si è caricato. Ricarica la pagina.');
            }
        }, 100);
    }

    // ===== APPLICA MODALITÀ PRESENZA =====
    function applyPresenzaMode(athleteId) {
        console.log('[PRESENZA MODE] 🔧 Applicazione modalità presenza...');

        // 1. NASCONDI TUTTI I CONTROLLI COACH (già fatto subito all'avvio, ma
        // rifatto qui per sicurezza: alcuni pulsanti potrebbero essere stati
        // reinseriti nel DOM dal render del calendario nel frattempo).
        hideCoachControls();

        // 2. CAMBIA TITOLO
        updateTitle();

        // 3. TROVA TABELLA E ATLETA
        const table = document.querySelector('.calendar-table');
        if (!table) {
            console.error('[PRESENZA MODE] ❌ Tabella non trovata');
            return;
        }

        const { athleteRow, athleteName } = findAthleteRow(table, athleteId);
        
        if (!athleteRow) {
            console.error('[PRESENZA MODE] ❌ Atleta non trovato per ID:', athleteId);
            showError(
                'Atleta Non Trovato',
                `L'atleta con ID ${athleteId} non è presente in questo calendario.`,
                'Contatta l\'allenatore per un nuovo link.'
            );
            return;
        }

        console.log('[PRESENZA MODE] 👤 Atleta trovato:', athleteName);

        // 4. NASCONDI TUTTE LE ALTRE RIGHE
        hideOtherRows(table, athleteRow);

        // 5. NASCONDI COLONNA AZIONI
        hideActionsColumn(table, athleteRow);

        // 6. AGGIUNGI INTESTAZIONE PERSONALIZZATA
        addPersonalizedHeader(athleteName);

        // 7. MOSTRA SOLO RIGA ATLETA CON PULSANTI
        // (già visibile, i pulsanti Segna Assente/Presente sono già nel calendario)

        console.log('[PRESENZA MODE] ✅ Modalità presenza applicata con successo!');
    }

    // ===== FUNZIONI DI SUPPORTO =====

    function hideCoachControls() {
        // Nascondi tutti i pulsanti coach
        const buttons = document.querySelectorAll(
            '#add-btn, #generate-btn, #import-btn, #responses-btn, #delete-btn'
        );
        
        buttons.forEach(btn => {
            if (btn) {
                btn.style.display = 'none';
                // Nascondi anche il contenitore
                const parent = btn.closest('.col-md-2');
                if (parent) parent.style.display = 'none';
            }
        });

        // Nascondi l'intera riga dei pulsanti
        const rows = document.querySelectorAll('.row');
        rows.forEach(row => {
            if (row.querySelector('#add-btn, #generate-btn')) {
                row.style.display = 'none';
            }
        });

        // Nascondi link Dashboard
        const dashLink = document.querySelector('a[href="/"]');
        if (dashLink) dashLink.style.display = 'none';

        console.log('[PRESENZA MODE] 🔴 Controlli coach nascosti');
    }

    function updateTitle() {
        const title = document.querySelector('.main-title, h1');
        if (title) {
            title.innerHTML = '<i class="bi bi-calendar-check-fill"></i> Conferma Presenze';
            title.style.textAlign = 'center';
            console.log('[PRESENZA MODE] ✏️ Titolo aggiornato');
        }
    }

    function findAthleteRow(table, athleteId) {
        const rows = table.querySelectorAll('tbody tr');
        let athleteRow = null;
        let athleteName = '';

        console.log('[PRESENZA MODE] 🔍 Cerco atleta ID:', athleteId, 'in', rows.length, 'righe');

        rows.forEach((row, idx) => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            // METODO 1: Cerca tramite data-athlete-id se esiste
            const rowAthleteId = row.getAttribute('data-athlete-id');
            if (rowAthleteId && String(rowAthleteId) === String(athleteId)) {
                athleteRow = row;
                athleteName = cells[1].textContent.trim();
                console.log('[PRESENZA MODE] ✅ Trovato via data-athlete-id:', athleteName);
                return;
            }

            // METODO 2: Cerca in TUTTE le celle per l'ID atleta
            // (calendario-standalone potrebbe mettere l'ID in posti diversi)
            cells.forEach((cell, cellIdx) => {
                const cellText = cell.textContent.trim();
                const cellId = cell.getAttribute('data-id') || cell.getAttribute('id');
                
                // Controlla se questa cella contiene l'ID atleta
                if (String(cellText) === String(athleteId) || String(cellId) === String(athleteId)) {
                    athleteRow = row;
                    athleteName = cells[1] ? cells[1].textContent.trim() : 'Atleta';
                    console.log('[PRESENZA MODE] ✅ Trovato via cella:', athleteName);
                }
            });

            // METODO 3: Confronta con la prima cella (potrebbe essere il numero di riga)
            // ma poi verifica che la seconda cella abbia un nome
            if (!athleteRow && cells[1]) {
                const nameCell = cells[1];
                const name = nameCell.textContent.trim();
                
                // Se questo è l'unico atleta visibile (1 sola riga), è probabilmente lui
                if (rows.length === 1 && name) {
                    athleteRow = row;
                    athleteName = name;
                    console.log('[PRESENZA MODE] ✅ Unica riga disponibile, uso questa:', athleteName);
                }
            }
        });

        return { athleteRow, athleteName };
    }

    function hideOtherRows(table, athleteRow) {
        const rows = table.querySelectorAll('tbody tr');
        let hiddenCount = 0;
        
        rows.forEach(row => {
            if (row !== athleteRow) {
                row.style.display = 'none';
                hiddenCount++;
            }
        });

        console.log('[PRESENZA MODE] 👻 Nascoste', hiddenCount, 'righe');
    }

    function hideActionsColumn(table, athleteRow) {
        const headerRows = table.querySelectorAll('thead tr');
        let actionColumnIndex = -1;
        
        if (headerRows.length > 0) {
            const headers = headerRows[0].querySelectorAll('th');
            
            headers.forEach((th, index) => {
                if (th.textContent.includes('Azioni')) {
                    th.style.display = 'none';
                    actionColumnIndex = index;
                }
            });
        }

        // Nascondi la cella azioni nella riga atleta
        if (actionColumnIndex >= 0 && athleteRow) {
            const actionCell = athleteRow.querySelectorAll('td')[actionColumnIndex];
            if (actionCell) actionCell.style.display = 'none';
        }

        console.log('[PRESENZA MODE] 🚫 Colonna Azioni nascosta');
    }

    function addPersonalizedHeader(athleteName) {
        const calendarContainer = document.querySelector('.card-body');
        if (!calendarContainer) return;

        const note = document.createElement('div');
        note.style.cssText = `
            background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 2px solid #38bdf8;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        note.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #0369a1; font-size: 1.5rem; text-align: center;">
                <i class="bi bi-person-circle"></i> ${athleteName}
            </h4>
            <p style="margin: 0 0 10px 0; color: #0c4a6e; text-align: center; font-size: 1rem;">
                👇 Usa i pulsanti per confermare la tua presenza o assenza
            </p>
            <p style="margin: 0; color: #075985; text-align: center; font-size: 0.9rem;">
                ⚠️ Una volta confermato non potrai più modificare
            </p>
        `;
        
        calendarContainer.insertBefore(note, calendarContainer.firstChild);
        console.log('[PRESENZA MODE] 📋 Intestazione personalizzata aggiunta');
    }

    function showError(title, message, note = '') {
        const calendar = document.getElementById('calendar');
        if (!calendar) return;

        calendar.innerHTML = `
            <div class="alert alert-danger" style="max-width: 600px; margin: 40px auto;">
                <h5 style="margin-bottom: 15px;">
                    <i class="bi bi-exclamation-triangle-fill"></i> ${title}
                </h5>
                <p style="margin-bottom: ${note ? '10px' : '0'};">${message}</p>
                ${note ? `<p style="margin: 0; font-size: 0.9rem; color: #721c24;">${note}</p>` : ''}
            </div>
        `;
    }

    // ===== AVVIA IL PROCESSO =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForCalendar);
    } else {
        waitForCalendar();
    }

    console.log('[PRESENZA MODE] 🎬 Inizializzazione completata');

})();
