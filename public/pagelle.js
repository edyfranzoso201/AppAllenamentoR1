// ============================================
// SISTEMA PAGELLE VALUTAZIONE - STANDALONE
// ============================================

(function() {
    'use strict';
    
    // Variabili globali per le pagelle
    let ratingSheets = {};
    let ratingSheetModal;
    let ratingListModal;
    
    // Inizializzazione quando il DOM è pronto
    document.addEventListener('DOMContentLoaded', function() {
        // Aspetta che Bootstrap sia caricato
        setTimeout(initializeRatingSystem, 1000);
    });
    
    function initializeRatingSystem() {
        // ✅ Esce silenziosamente se non siamo nel dashboard principale
        const ratingSheetModalEl = document.getElementById('ratingSheetModal');
        const ratingListModalEl = document.getElementById('ratingListModal');
        if (!ratingSheetModalEl || !ratingListModalEl) return;

        console.log('🎯 Inizializzazione Sistema Pagelle...');
        
        ratingSheetModal = new bootstrap.Modal(ratingSheetModalEl);
        ratingListModal = new bootstrap.Modal(ratingListModalEl);
        
        // Carica i dati delle pagelle
        loadRatingSheets();
        
        // Setup event listeners
        setupRatingListeners();

        // Espone loadRatingSheets globalmente — verrà richiamata da script.js
        // dopo che _appData è popolato con i dati Redis
        window.reloadRatingSheets = loadRatingSheets;
        
        console.log('✅ Sistema Pagelle inizializzato!');
    }
    
    // Carica le pagelle da window._appData (già caricato da Redis via script.js)
    function loadRatingSheets() {
        try {
            if (window._appData && window._appData.ratingSheets) {
                ratingSheets = window._appData.ratingSheets || {};
            } else {
                // Fallback: prova localStorage per retrocompatibilità
                const savedData = localStorage.getItem('coachDashboardData');
                if (savedData) {
                    const allData = JSON.parse(savedData);
                    ratingSheets = allData.ratingSheets || {};
                } else {
                    ratingSheets = {};
                }
            }
            console.log('📊 Pagelle caricate:', Object.keys(ratingSheets).length, 'atleti');
        } catch (e) {
            console.error('Errore caricamento pagelle:', e);
            ratingSheets = {};
        }
    }
    
    // Salva le pagelle su Redis via /api/data
    function saveRatingSheets() {
        try {
            // Aggiorna cache locale
            if (window._appData) window._appData.ratingSheets = ratingSheets;

            const annataId = sessionStorage.getItem('gosport_current_annata');
            if (!annataId) {
                console.warn('⚠️ Nessuna annata selezionata, pagelle non salvate su Redis');
                return;
            }

            fetch('/api/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Annata-Id': annataId
                },
                body: JSON.stringify({ ratingSheets })
            })
            .then(r => r.json())
            .then(d => {
                if (d.success) console.log('💾 Pagelle salvate su Redis!');
                else console.error('❌ Errore salvataggio pagelle:', d);
            })
            .catch(e => console.error('❌ Errore rete pagelle:', e));
        } catch (e) {
            console.error('Errore salvataggio pagelle:', e);
        }
    }
    
    // Setup event listeners
    function setupRatingListeners() {
        // Click sui pulsanti pagella
        document.addEventListener('click', function(e) {
            const ratingBtn = e.target.closest('.rating-btn');
            if (ratingBtn) {
                const athleteId = ratingBtn.dataset.athleteId;
                showRatingListModal(athleteId);
            }
            
            // Click sulle stelle
            const ratingStar = e.target.closest('.rating-star');
            if (ratingStar) {
                const category = ratingStar.dataset.category;
                const value = parseInt(ratingStar.dataset.value);
                setRating(category, value);
            }
        });
        
        // Hover sulle stelle
        document.addEventListener('mouseover', function(e) {
            const ratingStar = e.target.closest('.rating-star');
            if (ratingStar) {
                const category = ratingStar.dataset.category;
                const value = parseInt(ratingStar.dataset.value);
                highlightStarsHover(category, value, true);
            }
        });
        
        document.addEventListener('mouseout', function(e) {
            const ratingStar = e.target.closest('.rating-star');
            if (ratingStar) {
                const category = ratingStar.dataset.category;
                const currentValue = parseInt(document.getElementById(`rating-${category}`).value) || 0;
                highlightStars(category, currentValue);
            }
        });
        
        // Pulsante salva
        const saveBtn = document.getElementById('save-rating-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveRatingSheet);
        }
        
        // Pulsante elimina
        const deleteBtn = document.getElementById('delete-rating-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', deleteRatingSheet);
        }
    }
    
    // Mostra modal lista pagelle
    function showRatingListModal(athleteId) {
        const athlete = getAthleteById(athleteId);
        if (!athlete) {
            alert('Atleta non trovato!');
            return;
        }
        
        const container = document.getElementById('rating-list-container');
        const sheets = ratingSheets[athleteId] || [];
        
        // Ordina per data (più recente prima)
        sheets.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (sheets.length === 0) {
            // Empty state
            container.innerHTML = `
                <div class="col-12">
                    <div class="rating-empty-state">
                        <i class="bi bi-clipboard-x"></i>
                        <h5>Nessuna pagella disponibile</h5>
                        <p class="text-muted">Non ci sono ancora pagelle per ${athlete.name}</p>
                        <button class="btn btn-primary mt-3" onclick="window.openNewRatingSheet('${athleteId}')">
                            <i class="bi bi-plus-circle"></i> Crea Prima Pagella
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Mostra le pagelle
            let html = `
                <div class="col-12 mb-3">
                    <h5>${athlete.name} - Storico Pagelle</h5>
                    <button class="btn btn-sm btn-primary" onclick="window.openNewRatingSheet('${athleteId}')">
                        <i class="bi bi-plus-circle"></i> Nuova Pagella
                    </button>
                </div>
            `;
            
            sheets.forEach(sheet => {
                const avg = calculateAverageRating(sheet.ratings);
                html += `
                    <div class="col-md-6 col-lg-4 mb-3">
                        <div class="rating-card-mini" onclick="window.openRatingSheet('${athleteId}', '${sheet.id}')">
                            <div class="rating-date">${formatDate(sheet.date)}</div>
                            <div class="rating-coach">Coach: ${sheet.coachName}</div>
                            <div class="rating-scores">
                                <div class="rating-score-item">
                                    <span>⚙️ Tecnica:</span>
                                    <span class="score-stars">${generateStarsHtml(sheet.ratings.tecnica)}</span>
                                </div>
                                <div class="rating-score-item">
                                    <span>🎯 Tattica:</span>
                                    <span class="score-stars">${generateStarsHtml(sheet.ratings.tattica)}</span>
                                </div>
                                <div class="rating-score-item">
                                    <span>💪 Fisico:</span>
                                    <span class="score-stars">${generateStarsHtml(sheet.ratings.fisico)}</span>
                                </div>
                                <div class="rating-score-item">
                                    <span>🤝 Comportamento:</span>
                                    <span class="score-stars">${generateStarsHtml(sheet.ratings.comportamentale)}</span>
                                </div>
                            </div>
                            <div class="rating-average-badge">
                                <i class="bi bi-star-fill"></i>
                                Media: ${avg.toFixed(1)}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }
        
        ratingListModal.show();
    }
    
    // Apri nuova pagella
    window.openNewRatingSheet = function(athleteId) {
        ratingListModal.hide();
        
        setTimeout(() => {
            const athlete = getAthleteById(athleteId);
            if (!athlete) return;
            
            // Reset form
            document.getElementById('rating-sheet-form').reset();
            document.getElementById('rating-athlete-id').value = athleteId;
            document.getElementById('rating-sheet-id').value = '';
            document.getElementById('rating-athlete-name').value = athlete.name;
            document.getElementById('rating-date').valueAsDate = new Date();
            
            // Reset stelle
            ['tecnica', 'tattica', 'fisico', 'comportamentale'].forEach(cat => {
                document.getElementById(`rating-${cat}`).value = '0';
                highlightStars(cat, 0);
            });
            
            // Nascondi pulsante elimina
            document.getElementById('delete-rating-btn').style.display = 'none';
            
            ratingSheetModal.show();
        }, 300);
    };
    
    // Apri pagella esistente
    window.openRatingSheet = function(athleteId, sheetId) {
        ratingListModal.hide();
        
        setTimeout(() => {
            const athlete = getAthleteById(athleteId);
            const sheets = ratingSheets[athleteId] || [];
            const sheet = sheets.find(s => s.id === sheetId);
            
            if (!athlete || !sheet) return;
            
            // Popola form
            document.getElementById('rating-athlete-id').value = athleteId;
            document.getElementById('rating-sheet-id').value = sheetId;
            document.getElementById('rating-athlete-name').value = athlete.name;
            document.getElementById('rating-coach-name').value = sheet.coachName;
            document.getElementById('rating-date').value = sheet.date;
            document.getElementById('rating-notes').value = sheet.notes || '';
            
            // Imposta stelle
            ['tecnica', 'tattica', 'fisico', 'comportamentale'].forEach(cat => {
                const value = sheet.ratings[cat] || 0;
                document.getElementById(`rating-${cat}`).value = value;
                highlightStars(cat, value);
            });
            
            // Mostra pulsante elimina
            document.getElementById('delete-rating-btn').style.display = 'inline-block';
            
            ratingSheetModal.show();
        }, 300);
    };
    
    // Imposta rating
    function setRating(category, value) {
        document.getElementById(`rating-${category}`).value = value;
        highlightStars(category, value);
    }
    
    // Evidenzia stelle (stato permanente)
    function highlightStars(category, value) {
        const stars = document.querySelectorAll(`.rating-star[data-category="${category}"]`);
        stars.forEach((star, index) => {
            if (index < value) {
                star.classList.remove('bi-star');
                star.classList.add('bi-star-fill', 'active');
            } else {
                star.classList.remove('bi-star-fill', 'active');
                star.classList.add('bi-star');
            }
        });
    }
    
    // Evidenzia stelle (hover temporaneo)
    function highlightStarsHover(category, value, isHover) {
        const stars = document.querySelectorAll(`.rating-star[data-category="${category}"]`);
        if (isHover) {
            stars.forEach((star, index) => {
                if (index < value) {
                    star.style.color = '#ffc107';
                } else {
                    star.style.color = '#495057';
                }
            });
        }
    }
    
    // Salva pagella
    function saveRatingSheet() {
        const athleteId = document.getElementById('rating-athlete-id').value;
        const sheetId = document.getElementById('rating-sheet-id').value;
        const coachName = document.getElementById('rating-coach-name').value.trim();
        const date = document.getElementById('rating-date').value;
        const notes = document.getElementById('rating-notes').value.trim();
        
        // Validazione
        if (!coachName) {
            alert('Inserisci il nome del coach!');
            return;
        }
        
        if (!date) {
            alert('Seleziona una data!');
            return;
        }
        
        const ratings = {
            tecnica: parseInt(document.getElementById('rating-tecnica').value) || 0,
            tattica: parseInt(document.getElementById('rating-tattica').value) || 0,
            fisico: parseInt(document.getElementById('rating-fisico').value) || 0,
            comportamentale: parseInt(document.getElementById('rating-comportamentale').value) || 0
        };
        
        // Verifica che almeno una valutazione sia > 0
        const hasRating = Object.values(ratings).some(v => v > 0);
        if (!hasRating) {
            alert('Inserisci almeno una valutazione!');
            return;
        }
        
        // Crea/aggiorna pagella
        const sheet = {
            id: sheetId || Date.now().toString(),
            coachName: coachName,
            date: date,
            ratings: ratings,
            notes: notes
        };
        
        // Salva
        if (!ratingSheets[athleteId]) {
            ratingSheets[athleteId] = [];
        }
        
        if (sheetId) {
            // Modifica esistente
            const index = ratingSheets[athleteId].findIndex(s => s.id === sheetId);
            if (index !== -1) {
                ratingSheets[athleteId][index] = sheet;
            }
        } else {
            // Nuova pagella
            ratingSheets[athleteId].push(sheet);
        }
        
        saveRatingSheets();
        ratingSheetModal.hide();
        alert('Pagella salvata con successo! ✅');
    }
    
    // Elimina pagella
    function deleteRatingSheet() {
        if (!confirm('⚠️ Sei sicuro di voler eliminare questa pagella?')) {
            return;
        }
        
        const athleteId = document.getElementById('rating-athlete-id').value;
        const sheetId = document.getElementById('rating-sheet-id').value;
        
        if (!ratingSheets[athleteId]) return;
        
        ratingSheets[athleteId] = ratingSheets[athleteId].filter(s => s.id !== sheetId);
        
        // Rimuovi array vuoto
        if (ratingSheets[athleteId].length === 0) {
            delete ratingSheets[athleteId];
        }
        
        saveRatingSheets();
        ratingSheetModal.hide();
        alert('Pagella eliminata! 🗑️');
    }
    
    // Calcola media voti
    function calculateAverageRating(ratings) {
        const values = Object.values(ratings).filter(v => v > 0);
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
    
    // Genera HTML stelle
    function generateStarsHtml(rating) {
        let html = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        for (let i = 0; i < fullStars; i++) {
            html += '<i class="bi bi-star-fill"></i>';
        }
        
        if (hasHalfStar) {
            html += '<i class="bi bi-star-half"></i>';
        }
        
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        for (let i = 0; i < emptyStars; i++) {
            html += '<i class="bi bi-star"></i>';
        }
        
        return html;
    }
    
    // Formatta data
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
    
    // Get atleta by ID
    function getAthleteById(id) {
        // Cerca negli athletes globali
        if (typeof window.athletes !== 'undefined') {
            return window.athletes.find(a => String(a.id) === String(id));
        }
        return null;
    }

    // ============================================
    // STAMPA PAGELLA (v1.5.4)
    // Apre una finestra dedicata con la pagella formattata
    // e lancia automaticamente la stampa.
    // ============================================
    window.printRatingSheet = function() {
        var athleteId = document.getElementById('rating-athlete-id').value;
        var sheetId   = document.getElementById('rating-sheet-id').value;
        var athlete   = getAthleteById(athleteId);
        if (!athlete) { alert('Atleta non trovato!'); return; }

        // Cerca la pagella corrente (dal form o, se nuova, costruisci on-the-fly)
        var sheets = ratingSheets[athleteId] || [];
        var sheet = sheets.find(function(s) { return s.id === sheetId; });
        // Se la pagella non e' ancora salvata, ricostruiscila dal form
        if (!sheet) {
            sheet = {
                date: document.getElementById('rating-date').value || new Date().toISOString().slice(0,10),
                coachName: document.getElementById('rating-coach-name').value || '',
                ratings: {
                    tecnica:        parseInt(document.getElementById('rating-tecnica').value)        || 0,
                    tattica:        parseInt(document.getElementById('rating-tattica').value)        || 0,
                    fisico:         parseInt(document.getElementById('rating-fisico').value)         || 0,
                    comportamentale: parseInt(document.getElementById('rating-comportamentale').value) || 0
                },
                notes: document.getElementById('rating-notes').value || ''
            };
        }

        var avg = calculateAverageRating(sheet.ratings);
        var teamName = (window._appData && window._appData.teamName) || 'GO SPORT';

        // Genera HTML stelle in formato unicode (★ piene + ☆ vuote)
        function starsText(n) {
            n = Math.max(0, Math.min(5, parseInt(n) || 0));
            return '★'.repeat(n) + '☆'.repeat(5 - n);
        }

        var html = ''
            + '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">'
            + '<title>Pagella - ' + athlete.name + ' - ' + formatDate(sheet.date) + '</title>'
            + '<style>'
            + '@page { size: A4 portrait; margin: 15mm; }'
            + 'body { font-family: "Segoe UI", system-ui, sans-serif; color:#000; margin:0; padding:0; }'
            + 'h1 { font-size: 22pt; margin: 0 0 4mm 0; color:#1e3a5f; border-bottom: 3px solid #d90429; padding-bottom: 4mm; }'
            + 'h2 { font-size: 14pt; margin: 8mm 0 3mm 0; color:#1e3a5f; }'
            + '.header-info { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 6mm; }'
            + '.team-name { font-size: 10pt; color:#666; }'
            + '.info-table { width:100%; border-collapse:collapse; margin-bottom: 6mm; font-size: 11pt; }'
            + '.info-table td { padding: 4px 8px; border:1px solid #ccc; }'
            + '.info-table td:first-child { font-weight: 700; background:#f0f1f2; width: 30%; }'
            + '.ratings-table { width:100%; border-collapse:collapse; margin-bottom: 6mm; }'
            + '.ratings-table th { background:#1e3a5f; color:#fff; padding: 8px 10px; text-align:left; font-size: 11pt; }'
            + '.ratings-table td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 12pt; }'
            + '.ratings-table tr:nth-child(even) td { background:#fafafa; }'
            + '.stars { font-size: 16pt; color:#ffc107; letter-spacing: 2px; }'
            + '.value-num { font-weight: 700; color:#1e3a5f; }'
            + '.average-box { background: linear-gradient(135deg,#1e3a5f,#0f172a); color:#fff; padding: 8mm; border-radius: 6px; text-align:center; margin: 6mm 0; }'
            + '.average-box .label { font-size: 11pt; opacity:0.8; }'
            + '.average-box .value { font-size: 28pt; font-weight: 700; margin-top: 2mm; }'
            + '.notes-box { border:1px solid #ccc; border-radius: 4px; padding: 4mm; min-height: 25mm; background:#fafafa; font-size: 11pt; line-height: 1.5; }'
            + '.signature { margin-top: 12mm; display:flex; justify-content:space-between; font-size: 10pt; color:#444; }'
            + '.signature-line { border-top:1px solid #999; padding-top: 1mm; min-width: 60mm; text-align:center; }'
            + '@media print { .no-print { display:none !important; } }'
            + '.print-bar { position:fixed; top:10px; right:10px; }'
            + '.print-bar button { padding:8px 16px; font-size:14px; cursor:pointer; }'
            + '</style></head><body>'
            + '<div class="print-bar no-print">'
            + '<button onclick="window.print()">🖨 Stampa</button> '
            + '<button onclick="window.close()">✖ Chiudi</button>'
            + '</div>'
            + '<h1>📋 Pagella Valutazione</h1>'
            + '<div class="header-info"><div class="team-name">' + teamName + '</div>'
            + '<div class="team-name">Stampata il: ' + new Date().toLocaleDateString('it-IT') + '</div></div>'
            + '<table class="info-table">'
            + '<tr><td>Atleta</td><td>' + athlete.name + '</td></tr>'
            + (athlete.numero ? '<tr><td>Numero</td><td>' + athlete.numero + '</td></tr>' : '')
            + (athlete.ruolo ? '<tr><td>Ruolo</td><td>' + athlete.ruolo + '</td></tr>' : '')
            + '<tr><td>Coach</td><td>' + (sheet.coachName || '—') + '</td></tr>'
            + '<tr><td>Data Valutazione</td><td>' + formatDate(sheet.date) + '</td></tr>'
            + '</table>'
            + '<h2>Valutazioni</h2>'
            + '<table class="ratings-table">'
            + '<thead><tr><th>Categoria</th><th style="width:30%">Punteggio</th><th style="width:18%;text-align:center;">Voto</th></tr></thead>'
            + '<tbody>'
            + '<tr><td>⚙️ Tecnica</td><td><span class="stars">' + starsText(sheet.ratings.tecnica) + '</span></td><td style="text-align:center;"><span class="value-num">' + (sheet.ratings.tecnica||0) + ' / 5</span></td></tr>'
            + '<tr><td>🎯 Tattica</td><td><span class="stars">' + starsText(sheet.ratings.tattica) + '</span></td><td style="text-align:center;"><span class="value-num">' + (sheet.ratings.tattica||0) + ' / 5</span></td></tr>'
            + '<tr><td>💪 Fisico</td><td><span class="stars">' + starsText(sheet.ratings.fisico) + '</span></td><td style="text-align:center;"><span class="value-num">' + (sheet.ratings.fisico||0) + ' / 5</span></td></tr>'
            + '<tr><td>🤝 Comportamento</td><td><span class="stars">' + starsText(sheet.ratings.comportamentale) + '</span></td><td style="text-align:center;"><span class="value-num">' + (sheet.ratings.comportamentale||0) + ' / 5</span></td></tr>'
            + '</tbody></table>'
            + '<div class="average-box">'
            + '<div class="label">⭐ Valutazione Media</div>'
            + '<div class="value">' + avg.toFixed(2) + ' / 5</div>'
            + '</div>'
            + '<h2>Note del Coach</h2>'
            + '<div class="notes-box">' + ((sheet.notes||'').replace(/</g,'&lt;').replace(/\n/g,'<br>') || '<em style="color:#999;">— Nessuna nota —</em>') + '</div>'
            + '<div class="signature">'
            + '<div class="signature-line">Firma Coach</div>'
            + '<div class="signature-line">Firma Atleta / Genitore</div>'
            + '</div>'
            + '<\/body><\/html>';

        // Apri finestra dedicata e lancia stampa dopo caricamento
        var w = window.open('', '_blank', 'width=900,height=1100');
        if (!w) { alert('Sblocca i popup per stampare la pagella.'); return; }
        w.document.open(); w.document.write(html); w.document.close();
        // Lascia tempo al rendering, poi apri dialog stampa
        w.onload = function() { setTimeout(function(){ try { w.focus(); w.print(); } catch(e){} }, 250); };
    };

})();
