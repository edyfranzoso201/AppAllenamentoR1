// presenza-calendar-mode.js - Modalità presenza nel calendario (FIXED)
(function() {
    'use strict';

    // Funzione per ottenere headers con X-Annata-Id
    function getAnnataHeaders() {
        const annataId = window.currentAnnata || localStorage.getItem('currentAnnata');
        return {
            'Content-Type': 'application/json',
            'X-Annata-Id': annataId
        };
    }

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

    console.log('[PRESENZA MODE] Path:', path);

    // Estrai token
    const parts = path.split('/presenza/');
    const token = parts[1] ? parts[1].replace(/[/.html]/g, '') : null;
    
    if (!token) {
        console.error('[PRESENZA MODE] Token mancante');
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
            console.error('[PRESENZA MODE] Tabella non trovata');
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
            console.error('[PRESENZA MODE] Riga atleta non trovata per ID:', athleteId);
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
        let actionColumnIndex = -1;
        
        actionHeaders.forEach((th, index) => {
            if (th.textContent.includes('Azioni')) {
                th.style.display = 'none';
                actionColumnIndex = index;
            }
        });

        // Nascondi la cella azioni nella riga atleta
        if (actionColumnIndex >= 0) {
            const actionCell = athleteRow.querySelectorAll('td')[actionColumnIndex];
            if (actionCell) actionCell.style.display = 'none';
        }

        // Aggiungi nota in alto
        const calendarContainer = document.querySelector('.card-body');
        if (calendarContainer) {
            const note = document.createElement('div');
            note.style.cssText = 'background:#e0f2fe;padding:20px;border-radius:10px;margin-bottom:20px;';
            note.innerHTML = `
                <h4 style="margin:0 0 10px 0;color:#0369a1;">👤 ${athleteName}</h4>
                <p style="margin:0;color:#0c4a6e;">Visualizzazione personale - Clicca sui pulsanti per confermare presenza/assenza</p>
            `;
            calendarContainer.insertBefore(note, calendarContainer.firstChild);
        }

        // Ottieni le date dalle colonne della tabella
        const dateHeaders = [];
        const headerRows = table.querySelectorAll('thead tr');
        
        if (headerRows.length >= 1) {
            const firstHeaderRow = headerRows[0];
            const headers = firstHeaderRow.querySelectorAll('th');
            
            // Salta le prime 3 colonne (#, Nome, Azioni)
            for (let i = 3; i < headers.length; i++) {
                const headerText = headers[i].textContent.trim();
                // Estrai la data dal testo (formato: "gio\n25/01")
                const dateMatch = headerText.match(/(\d{2})\/(\d{2})/);
                if (dateMatch) {
                    const day = dateMatch[1];
                    const month = dateMatch[2];
                    const year = new Date().getFullYear();
                    // Crea la data in formato YYYY-MM-DD
                    const date = `${year}-${month}-${day}`;
                    dateHeaders.push(date);
                } else {
                    dateHeaders.push(null);
                }
            }
        }

        console.log('[PRESENZA MODE] Date trovate:', dateHeaders);

        // Trasforma le celle "-" in pulsanti
        const dateCells = athleteRow.querySelectorAll('td');
        dateCells.forEach((cell, index) => {
            // Salta #, Nome, Azioni
            if (index <= 2) return;
            
            // Calcola l'indice della data (sottrai 3 per le colonne iniziali)
            const dateIndex = index - 3;
            const date = dateHeaders[dateIndex];
            
            if (!date) {
                console.warn('[PRESENZA MODE] Data non trovata per colonna', index);
                return;
            }

            const cellContent = cell.textContent.trim();
            
            // Se la cella è vuota (contiene solo "-" o è vuota)
            if (cellContent === '-' || cellContent === '') {
                cell.innerHTML = `
                    <button class="btn btn-sm btn-success" onclick="window.confirmPresenza(${athleteId}, '${date}', 'Si')" style="width:100%;margin-bottom:5px;">✅ Presente</button>
                    <button class="btn btn-sm btn-danger" onclick="window.confirmPresenza(${athleteId}, '${date}', 'No')" style="width:100%;">❌ Assente</button>
                `;
            }
            // Altrimenti lascia il contenuto esistente (già confermato)
        });

        console.log('[PRESENZA MODE] ✅ Modalità presenza applicata con successo');
    }

    // Aspetta che la pagina sia carica
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForCalendar);
    } else {
        waitForCalendar();
    }

    // Funzione globale per confermare presenza (FIXED con header)
    window.confirmPresenza = async function(athleteId, date, presenza) {
        console.log('[PRESENZA MODE] Conferma:', athleteId, date, presenza);
        
        let motivazione = '';
        if (presenza === 'No') {
            motivazione = prompt('Motivo assenza (opzionale):') || '';
        }

        if (!confirm(`Confermare ${presenza === 'Si' ? 'PRESENZA' : 'ASSENZA'}?\n\nData: ${date}\n\nNon potrai più modificare!`)) {
            return;
        }

        try {
            // FIXED: Aggiunto header X-Annata-Id
            const headers = getAnnataHeaders();
            console.log('[PRESENZA MODE] Headers fetch:', headers);
            
            const r = await fetch('/api/data', {
                cache: 'no-store',
                headers: headers
            });
            
            if (!r.ok) {
                const error = await r.json();
                throw new Error(error.message || `HTTP ${r.status}`);
            }
            
            const data = await r.json();
            
            data.calendarResponses = data.calendarResponses || {};
            data.calendarResponses[date] = data.calendarResponses[date] || {};
            data.calendarResponses[date][athleteId] = {
                presenza: presenza,
                motivazione: motivazione,
                timestamp: new Date().toISOString(),
                locked: true
            };

            // FIXED: Aggiunto header X-Annata-Id
            const saveResponse = await fetch('/api/data', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });

            if (!saveResponse.ok) {
                const error = await saveResponse.json();
                throw new Error(error.message || `HTTP ${saveResponse.status}`);
            }

            alert('✅ Confermato!');
            location.reload();
        } catch (e) {
            console.error('[PRESENZA MODE] Errore:', e);
            alert('❌ Errore: ' + e.message);
        }
    };

})();
