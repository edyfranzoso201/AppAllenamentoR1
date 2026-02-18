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
        
        console.log('✅ Sistema Pagelle inizializzato!');
    }
    
    // Carica le pagelle dal database
    function loadRatingSheets() {
        const savedData = localStorage.getItem('coachDashboardData');
        if (savedData) {
            try {
                const allData = JSON.parse(savedData);
                ratingSheets = allData.ratingSheets || {};
                console.log('📊 Pagelle caricate:', Object.keys(ratingSheets).length, 'atleti');
            } catch (e) {
                console.error('Errore caricamento pagelle:', e);
                ratingSheets = {};
            }
        }
    }
    
    // Salva le pagelle nel database
    function saveRatingSheets() {
        const savedData = localStorage.getItem('coachDashboardData');
        if (savedData) {
            try {
                const allData = JSON.parse(savedData);
                allData.ratingSheets = ratingSheets;
                localStorage.setItem('coachDashboardData', JSON.stringify(allData));
                console.log('💾 Pagelle salvate!');
                
                // Trigger update UI se la funzione esiste
                if (typeof window.saveData === 'function') {
                    window.saveData();
                }
            } catch (e) {
                console.error('Errore salvataggio pagelle:', e);
            }
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
    
})();
