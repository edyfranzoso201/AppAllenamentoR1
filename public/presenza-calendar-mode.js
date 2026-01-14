// presenza-calendar-mode.js - Modalità presenza nel calendario
(function() {
    'use strict';

    // Funzione decodifica token
    function decodeToken(token) {
        try {
            const match = token.match(/[0-9]+$/);
            return match ? match[0].split('').reverse().join('') : null;
        } catch (e) {
            return null;
        }
    }

    // Controlla se siamo in modalità presenza
    const path = window.location.pathname;
    if (!path.includes('/presenza/')) {
        return; // Modalità normale
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
        alert('Link non valido');
        return;
    }

    console.log('[PRESENZA MODE] Attivo per atleta ID:', athleteId);

    // Aspetta che il calendario sia renderizzato
    function waitForCalendar() {
        const interval = setInterval(() => {
            const table = document.querySelector('.calendar-table');
            if (table) {
                clearInterval(interval);
                applyPresenzaMode(athleteId);
            }
        }, 100);

        // Timeout dopo 10 secondi
        setTimeout(() => clearInterval(interval), 10000);
    }

    function applyPresenzaMode(athleteId) {
        console.log('[PRESENZA MODE] Applicazione filtro atleta...');

        // Nascondi pulsanti azioni del coach
        const buttons = document.querySelectorAll('#generate-btn, #import-btn, #add-btn, #delete-btn, #responses-btn');
        buttons.forEach(btn => btn.style.display = 'none');

        // Nascondi link "Dashboard"
        const dashLink = document.querySelector('a[href="/"]');
        if (dashLink) dashLink.style.display = 'none';

        // Cambia titolo
        const title = document.querySelector('.main-title, h1');
        if (title) {
            title.innerHTML = '<i class="bi bi-calendar-check-fill"></i> Conferma Presenze GO SPORT';
        }

        // Trova la tabella
        const table = document.querySelector('.calendar-table');
        if (!table) {
            console.error('Tabella non trovata');
            return;
        }

        // Trova tutte le righe atleti (tbody tr)
        const rows = table.querySelectorAll('tbody tr');
        let athleteRow = null;
        let athleteName = '';

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            // Seconda cella = nome atleta
            const nameCell = cells[1];
            const rowAthleteId = cells[0].textContent.trim(); // Numero riga potrebbe non corrispondere

            // Cerca nella riga i dati dell'atleta tramite bottone Link se esiste
            const linkBtn = row.querySelector('button[onclick*="generatePresenceLink"]');
            if (linkBtn) {
                const onclick = linkBtn.getAttribute('onclick');
                const match = onclick.match(/generatePresenceLink\((\d+)/);
                if (match && match[1] == athleteId) {
                    athleteRow = row;
                    athleteName = nameCell.textContent.trim();
                }
            }
        });

        if (!athleteRow) {
            console.error('Riga atleta non trovata per ID:', athleteId);
            alert('Atleta non trovato nel calendario');
            return;
        }

        console.log('[PRESENZA MODE] Atleta trovato:', athleteName);

        // Nascondi tutte le righe tranne questa
        rows.forEach(row => {
            if (row !== athleteRow) {
                row.style.display = 'none';
            }
        });

        // Nascondi colonna "Azioni"
        const actionHeaders = table.querySelectorAll('th');
        actionHeaders.forEach((th, index) => {
            if (th.textContent.includes('Azioni')) {
                th.style.display = 'none';
                // Nascondi anche la cella corrispondente nella riga
                const actionCell = athleteRow.querySelectorAll('td')[index];
                if (actionCell) actionCell.style.display = 'none';
            }
        });

        // Aggiungi nota in alto
        const calendarContainer = document.querySelector('.card-body');
        if (calendarContainer) {
            const note = document.createElement('div');
            note.style.cssText = 'background:#e0f2fe;padding:20px;border-radius:10px;margin-bottom:20px;';
            note.innerHTML = `
                <h4 style="margin:0 0 10px 0;color:#0369a1;">👤 ${athleteName}</h4>
                <p style="margin:0;color:#0c4a6e;">Visualizzazione personale - Clicca sulle celle per confermare presenza/assenza</p>
            `;
            calendarContainer.insertBefore(note, calendarContainer.firstChild);
        }

        // Trasforma le celle "-" in pulsanti
        const dateCells = athleteRow.querySelectorAll('td');
        dateCells.forEach((cell, index) => {
            if (index <= 2) return; // Salta #, Nome, Azioni

            if (cell.textContent.trim() === '-') {
                // Questa cella è vuota, aggiungi pulsanti
                cell.innerHTML = `
                    <button class="btn btn-sm btn-success" onclick="confirmPresenza(${athleteId}, 'PLACEHOLDER_DATE', 'Si')" style="width:100%;margin-bottom:5px;">✅ Presente</button>
                    <button class="btn btn-sm btn-danger" onclick="confirmPresenza(${athleteId}, 'PLACEHOLDER_DATE', 'No')" style="width:100%;">❌ Assente</button>
                `;
                // TODO: Sostituire PLACEHOLDER_DATE con la data vera della colonna
            }
        });

        console.log('[PRESENZA MODE] Modalità presenza applicata con successo');
    }

    // Aspetta che la pagina sia carica
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForCalendar);
    } else {
        waitForCalendar();
    }

    // Funzione globale per confermare presenza
    window.confirmPresenza = async function(athleteId, date, presenza) {
        let motivazione = '';
        if (presenza === 'No') {
            motivazione = prompt('Motivo assenza (opzionale):') || '';
        }

        if (!confirm(`Confermare ${presenza === 'Si' ? 'PRESENZA' : 'ASSENZA'}?\n\nNon potrai più modificare!`)) {
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
                locked: true
            };

            await fetch('/api/data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });

            alert('✅ Confermato!');
            location.reload();
        } catch (e) {
            alert('❌ Errore: ' + e.message);
        }
    };

})();
