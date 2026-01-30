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

    // ===== IMPOSTA SUBITO L'ANNATA CORRENTE =====
    // IMPORTANTE: Deve essere fatto PRIMA che calendario-standalone.js carichi i dati!
    const urlParams = new URLSearchParams(window.location.search);
    const annataFromUrl = urlParams.get('annata');
    const defaultAnnata = 'mko5iuzhw2xrxxiuo1'; // ← Annata corretta con 25 atleti
    
    const annataId = annataFromUrl || defaultAnnata;
    
    // Imposta nel localStorage E come variabile globale
    localStorage.setItem('currentAnnata', annataId);
    window.currentAnnata = annataId;
    
    console.log('[PRESENZA MODE] ⚡ Annata impostata SUBITO:', annataId);
    
    // NUOVO: Dispatch evento per notificare il cambio annata
    window.dispatchEvent(new CustomEvent('annataChanged', { detail: { annataId } }));

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

    // Aspetta che il calendario sia renderizzato E che i dati siano caricati
    function waitForCalendar() {
        console.log('[PRESENZA MODE] Attesa rendering calendario...');
        
        let attempts = 0;
        const maxAttempts = 100; // 10 secondi
        
        const interval = setInterval(() => {
            attempts++;
            
            const calendar = document.getElementById('calendar');
            const table = document.querySelector('.calendar-table');
            const rows = table ? table.querySelectorAll('tbody tr') : [];
            
            // Caso 1: Tabella trovata con righe → SUCCESSO
            if (table && rows.length > 0) {
                console.log('[PRESENZA MODE] Tabella trovata con', rows.length, 'righe');
                clearInterval(interval);
                applyPresenzaMode(athleteId);
                return;
            }
            
            // Caso 2: Messaggio "Nessun evento" → Genera automaticamente
            if (calendar && calendar.innerHTML.includes('Nessun Evento')) {
                console.log('[PRESENZA MODE] Nessun evento trovato, generazione automatica...');
                clearInterval(interval);
                
                // Clicca automaticamente sul pulsante "Genera"
                const generateBtn = document.getElementById('generate-btn');
                if (generateBtn) {
                    console.log('[PRESENZA MODE] Click su Genera...');
                    generateBtn.click();
                    
                    // Riavvia l'attesa dopo 2 secondi (tempo per generare)
                    setTimeout(() => {
                        console.log('[PRESENZA MODE] Riavvio attesa dopo generazione...');
                        waitForCalendar();
                    }, 2000);
                } else {
                    console.error('[PRESENZA MODE] Pulsante Genera non trovato');
                    showError('Impossibile generare il calendario automaticamente.');
                }
                return;
            }
            
            // Caso 3: Timeout → ERRORE
            if (attempts >= maxAttempts) {
                console.error('[PRESENZA MODE] Timeout: calendario non caricato dopo 10 secondi');
                clearInterval(interval);
                showError('Impossibile caricare il calendario. Riprova più tardi.');
            }
        }, 100);
    }
    
    function showError(message) {
        const calendar = document.getElementById('calendar');
        if (calendar) {
            calendar.innerHTML = `
                <div class="alert alert-danger" style="margin:20px;">
                    <h5><i class="bi bi-exclamation-triangle"></i> Errore Caricamento</h5>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise"></i> Ricarica Pagina
                    </button>
                </div>
            `;
        }
    }

    function applyPresenzaMode(athleteId) {
        console.log('[PRESENZA MODE] Applicazione filtro atleta...');

        // ===== 1. NASCONDI TUTTI I CONTROLLI DEL COACH =====
        
        // Nascondi TUTTI i pulsanti (incluso il bottone rosso "Nuovo" etc)
        const allButtons = document.querySelectorAll('#generate-btn, #import-btn, #add-btn, #delete-btn, #responses-btn');
        allButtons.forEach(btn => {
            if (btn) btn.style.display = 'none';
            // Nascondi anche il parent (la colonna)
            const parent = btn.closest('.col-md-2');
            if (parent) parent.style.display = 'none';
        });

        // Nascondi l'intera riga dei bottoni
        const buttonRow = document.querySelector('.row');
        if (buttonRow && buttonRow.querySelector('#add-btn')) {
            buttonRow.style.display = 'none';
        }

        // Nascondi link "Dashboard"
        const dashLink = document.querySelector('a[href="/"]');
        if (dashLink) dashLink.style.display = 'none';

        // Cambia titolo
        const title = document.querySelector('.main-title, h1');
        if (title) {
            title.innerHTML = '<i class="bi bi-calendar-check-fill"></i> Conferma Presenze GO SPORT';
            title.style.textAlign = 'center';
        }

        // ===== 2. TROVA LA TABELLA E L'ATLETA =====
        
        const table = document.querySelector('.calendar-table');
        if (!table) {
            console.error('[PRESENZA MODE] Tabella non trovata');
            return;
        }

        const rows = table.querySelectorAll('tbody tr');
        let athleteRow = null;
        let athleteName = '';

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            // Cerca il bottone Link per trovare l'ID atleta
            const linkBtn = row.querySelector('button[onclick*="generatePresenceLink"]');
            if (linkBtn) {
                const onclick = linkBtn.getAttribute('onclick');
                const match = onclick.match(/generatePresenceLink\((\d+)/);
                if (match && match[1] == athleteId) {
                    athleteRow = row;
                    athleteName = cells[1].textContent.trim(); // Nome dalla seconda colonna
                }
            }
        });

        if (!athleteRow) {
            console.error('[PRESENZA MODE] Riga atleta non trovata per ID:', athleteId);
            
            const calendar = document.getElementById('calendar');
            if (calendar) {
                calendar.innerHTML = `
                    <div class="alert alert-danger">
                        <h5>❌ Atleta Non Trovato</h5>
                        <p>L'atleta con ID ${athleteId} non è presente nel calendario.</p>
                        <p class="mb-0">Contatta l'allenatore per un nuovo link.</p>
                    </div>
                `;
            }
            return;
        }

        console.log('[PRESENZA MODE] Atleta trovato:', athleteName);

        // ===== 3. NASCONDI TUTTE LE ALTRE RIGHE =====
        
        rows.forEach(row => {
            if (row !== athleteRow) {
                row.style.display = 'none';
            }
        });

        // ===== 4. NASCONDI COLONNA "AZIONI" =====
        
        const headerRows = table.querySelectorAll('thead tr');
        let actionColumnIndex = -1;
        
        // Trova l'indice della colonna Azioni
        if (headerRows.length > 0) {
            const firstHeaderRow = headerRows[0];
            const headers = firstHeaderRow.querySelectorAll('th');
            
            headers.forEach((th, index) => {
                if (th.textContent.includes('Azioni')) {
                    th.style.display = 'none';
                    actionColumnIndex = index;
                }
            });
        }

        // Nascondi la cella azioni nella riga atleta
        if (actionColumnIndex >= 0) {
            const actionCell = athleteRow.querySelectorAll('td')[actionColumnIndex];
            if (actionCell) actionCell.style.display = 'none';
        }

        // ===== 5. AGGIUNGI NOTA PERSONALIZZATA IN ALTO =====
        
        const calendarContainer = document.querySelector('.card-body');
        if (calendarContainer) {
            const note = document.createElement('div');
            note.style.cssText = 'background:linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%);padding:25px;border-radius:12px;margin-bottom:20px;border:2px solid #38bdf8;';
            note.innerHTML = `
                <h4 style="margin:0 0 15px 0;color:#0369a1;font-size:1.5rem;text-align:center;">
                    <i class="bi bi-person-circle"></i> ${athleteName}
                </h4>
                <p style="margin:0;color:#0c4a6e;text-align:center;font-size:1rem;">
                    👇 Clicca sui pulsanti per confermare la tua presenza o assenza agli eventi
                </p>
                <p style="margin:10px 0 0 0;color:#075985;text-align:center;font-size:0.9rem;">
                    ⚠️ Una volta confermato non potrai più modificare
                </p>
            `;
            calendarContainer.insertBefore(note, calendarContainer.firstChild);
        }

        // ===== 6. OTTIENI LE DATE DALLE COLONNE =====
        
        const dateHeaders = [];
        
        if (headerRows.length >= 1) {
            const firstHeaderRow = headerRows[0];
            const headers = firstHeaderRow.querySelectorAll('th');
            
            // Salta le prime 3 colonne (#, Nome, Azioni)
            for (let i = 3; i < headers.length; i++) {
                const headerText = headers[i].textContent.trim();
                // Estrai la data (formato: "gio\n25/01")
                const dateMatch = headerText.match(/(\d{2})\/(\d{2})/);
                if (dateMatch) {
                    const day = dateMatch[1];
                    const month = dateMatch[2];
                    const year = new Date().getFullYear();
                    const date = `${year}-${month}-${day}`;
                    dateHeaders.push(date);
                } else {
                    dateHeaders.push(null);
                }
            }
        }

        console.log('[PRESENZA MODE] Date trovate:', dateHeaders);

        // ===== 7. TRASFORMA LE CELLE VUOTE IN PULSANTI =====
        
        const dateCells = athleteRow.querySelectorAll('td');
        dateCells.forEach((cell, index) => {
            // Salta #, Nome, Azioni
            if (index <= 2) return;
            
            const dateIndex = index - 3;
            const date = dateHeaders[dateIndex];
            
            if (!date) {
                console.warn('[PRESENZA MODE] Data non trovata per colonna', index);
                return;
            }

            const cellContent = cell.textContent.trim();
            
            // Se la cella è vuota (contiene "-" o è vuota)
            if (cellContent === '-' || cellContent === '') {
                cell.innerHTML = `
                    <button class="btn btn-sm btn-success" onclick="window.confirmPresenza(${athleteId}, '${date}', 'Si')" style="width:100%;margin-bottom:5px;font-weight:600;">
                        ✅ Presente
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.confirmPresenza(${athleteId}, '${date}', 'No')" style="width:100%;font-weight:600;">
                        ❌ Assente
                    </button>
                `;
            }
            // Se contiene già una risposta, mostrala in modo carino
            else if (cellContent !== '-') {
                const isPresent = cellContent.toLowerCase().includes('presente') || cellContent === '✅';
                const icon = isPresent ? '✅' : '❌';
                const color = isPresent ? '#10b981' : '#ef4444';
                const bgColor = isPresent ? '#d1fae5' : '#fee2e2';
                
                cell.innerHTML = `
                    <div style="background:${bgColor};color:${color};padding:8px;border-radius:6px;font-weight:600;text-align:center;">
                        ${icon} ${isPresent ? 'PRESENTE' : 'ASSENTE'}
                    </div>
                `;
            }
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
