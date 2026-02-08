// presenza-calendar-mode.js - Modalità presenza nel calendario (AGGIORNATO per ?athleteId=)
(function() {
    'use strict';

    console.log('[PRESENZA MODE] Script caricato');

    // Controlla se siamo in modalità presenza tramite URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const athleteId = urlParams.get('athleteId');
    
    if (!athleteId) {
        console.log('[PRESENZA MODE] Nessun athleteId trovato, modalità normale');
        return; // Modalità normale
    }

    console.log('[PRESENZA MODE] ⚡ Rilevato athleteId:', athleteId);

    // Aspetta che il calendario sia renderizzato
    function waitForCalendar() {
        let attempts = 0;
        const maxAttempts = 100; // 10 secondi
        
        const interval = setInterval(() => {
            attempts++;
            const table = document.querySelector('.calendar-table');
            
            if (table) {
                clearInterval(interval);
                console.log('[PRESENZA MODE] ✅ Tabella trovata dopo', attempts * 100, 'ms');
                applyPresenzaMode(athleteId);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.error('[PRESENZA MODE] ❌ Timeout: tabella non trovata dopo 10 secondi');
            }
        }, 100);
    }

    function applyPresenzaMode(athleteId) {
        console.log('[PRESENZA MODE] 🔧 Applicazione modalità presenza...');

        // 1. NASCONDI pulsanti azioni del coach
        const buttons = document.querySelectorAll('#generate-btn, #import-btn, #add-btn, #delete-btn, #responses-btn');
        console.log('[PRESENZA MODE] 🔴 Nascondo', buttons.length, 'pulsanti coach');
        buttons.forEach(btn => {
            if (btn) btn.style.display = 'none';
            if (btn && btn.parentElement) btn.parentElement.style.display = 'none';
        });

        // 2. NASCONDI intera row dei pulsanti
        const buttonRow = document.querySelector('.row[style*="margin-bottom: 3px"]');
        if (buttonRow && buttonRow.querySelector('#add-btn, #generate-btn')) {
            console.log('[PRESENZA MODE] 🔴 Nascondo row pulsanti');
            buttonRow.style.display = 'none';
        }

        // 3. NASCONDI link "Dashboard"
        const dashLink = document.querySelector('a[href="/"]');
        if (dashLink) {
            console.log('[PRESENZA MODE] 🔴 Nascondo link Dashboard');
            dashLink.style.display = 'none';
        }

        // 4. CAMBIA titolo
        const title = document.querySelector('.main-title, h1');
        if (title) {
            console.log('[PRESENZA MODE] ✏️ Cambio titolo');
            title.innerHTML = '<i class="bi bi-calendar-check-fill"></i> Conferma Presenze';
        }

        // 5. Trova la tabella
        const table = document.querySelector('.calendar-table');
        if (!table) {
            console.error('[PRESENZA MODE] ❌ Tabella non trovata');
            return;
        }

        // 6. Trova tutte le righe atleti (tbody tr)
        const rows = table.querySelectorAll('tbody tr');
        let athleteRow = null;
        let athleteName = '';

        console.log('[PRESENZA MODE] 🔍 Cerco atleta ID:', athleteId, 'in', rows.length, 'righe');

        rows.forEach((row, idx) => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            const nameCell = cells[1];
            
            // Cerca tramite data-attribute se esiste
            const rowAthleteId = row.getAttribute('data-athlete-id');
            
            if (String(rowAthleteId) === String(athleteId)) {
                athleteRow = row;
                athleteName = nameCell.textContent.trim();
                console.log('[PRESENZA MODE] ✅ Trovato via data-attribute:', athleteName);
                return;
            }

            // Fallback: cerca tramite bottone Link Presenze
            const linkBtn = row.querySelector('button[onclick*="generatePresenceLink"]');
            if (linkBtn) {
                const onclick = linkBtn.getAttribute('onclick');
                const match = onclick.match(/generatePresenceLink\('?(\d+)/);
                if (match && String(match[1]) === String(athleteId)) {
                    athleteRow = row;
                    athleteName = nameCell.textContent.trim();
                    console.log('[PRESENZA MODE] ✅ Trovato via onclick:', athleteName);
                }
            }
        });

        if (!athleteRow) {
            console.error('[PRESENZA MODE] ❌ Riga atleta NON trovata per ID:', athleteId);
            document.getElementById('calendar').innerHTML = `
                <div class="alert alert-danger">
                    <h5>❌ Atleta Non Trovato</h5>
                    <p>L'atleta con ID ${athleteId} non è presente nel calendario.</p>
                    <p>Contatta l'allenatore per un nuovo link.</p>
                </div>
            `;
            return;
        }

        console.log('[PRESENZA MODE] 👤 Atleta trovato:', athleteName);

        // 7. NASCONDI tutte le righe tranne questa
        rows.forEach(row => {
            if (row !== athleteRow) {
                row.style.display = 'none';
            }
        });

        // 8. NASCONDI colonna "Azioni"
        const actionHeaders = table.querySelectorAll('th');
        actionHeaders.forEach((th, index) => {
            if (th.textContent.includes('Azioni')) {
                th.style.display = 'none';
                const actionCell = athleteRow.querySelectorAll('td')[index];
                if (actionCell) actionCell.style.display = 'none';
            }
        });

        // 9. AGGIUNGI nota in alto
        const calendarContainer = document.querySelector('.card-body');
        if (calendarContainer) {
            const note = document.createElement('div');
            note.style.cssText = 'background:#e0f2fe;padding:20px;border-radius:10px;margin-bottom:20px;border:2px solid #0284c7;';
            note.innerHTML = `
                <h4 style="margin:0 0 10px 0;color:#0369a1;">👤 ${athleteName}</h4>
                <p style="margin:0;color:#0c4a6e;"><strong>📋 Istruzioni:</strong> Usa i pulsanti per confermare presenza o assenza agli allenamenti/partite.</p>
            `;
            calendarContainer.insertBefore(note, calendarContainer.firstChild);
        }

        console.log('[PRESENZA MODE] ✅ Modalità presenza applicata con successo!');
    }

    // Aspetta che la pagina sia carica
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForCalendar);
    } else {
        waitForCalendar();
    }

})();
