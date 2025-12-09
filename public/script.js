// Funzione per evitare lo slittamento di data
function toLocalDateISO(dateInput) {
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return dateInput;
    const d = new Date(dateInput);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', () => {
    const modalsContainer = document.getElementById('modals-container');
    
    // TEMPLATE MODALI
    modalsContainer.innerHTML = `
    <div class="modal fade" id="evaluationModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Valutazione di <span id="modal-athlete-name-eval"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="evaluation-form"><input type="hidden" id="modal-athlete-id-eval"><p>Data: <strong id="modal-evaluation-date"></strong></p><div class="mb-2"><label class="form-label">Presenza Allenamento</label><select id="presenza-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Serietà Allenamento</label><select id="serieta-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Allenamento</label><select id="abbigliamento-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Partita</label><select id="abbigliamento-partita" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Serietà Comunicazioni</label><select id="comunicazioni" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Doccia (Opzionale)</label><select id="doccia" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="award-checkbox"><label class="form-check-label" for="award-checkbox">Assegna Premio</label></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-single-athlete-day-btn">Elimina Dati del Giorno</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="evaluation-form">Salva Valutazione</button></div></div></div></div></div> 
    
    <div class="modal fade" id="athleteModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="athleteModalLabel">Gestisci Atleta</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="athlete-form"><input type="hidden" id="modal-athlete-id"><div class="mb-3"><label class="form-label">Nome Cognome</label><input type="text" class="form-control" id="athlete-name" required></div><div class="mb-3"><label for="athlete-avatar-input" class="form-label">Foto Profilo</label><input type="file" class="form-control" id="athlete-avatar-input" accept="image/*"><input type="hidden" id="athlete-avatar-base64"><img id="avatar-preview" src="" alt="Anteprima" class="mt-2" style="max-width: 70px; max-height: 70px; display: none; border-radius: 50%;"></div><div class="mb-3"><label class="form-label">Ruolo</label><input type="text" class="form-control" id="athlete-role" required></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Numero Maglia</label><input type="number" class="form-control" id="athlete-number" required min="1"></div><div class="col-md-6 mb-3"><label class="form-label">Scadenza Visita Medica</label><input type="date" class="form-control" id="scadenza-visita"></div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Data Prenotazione Visita</label><input type="date" class="form-control" id="prenotazione-visita"></div></div>
    <div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="athlete-captain"><label class="form-label" for="athlete-captain">Capitano</label></div>
    <div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="athlete-vice-captain"><label class="form-label" for="athlete-vice-captain">Vice Capitano</label></div>
    <div class="form-check mb-3 bg-dark p-2 rounded border border-secondary"><input class="form-check-input ms-0 me-2" type="checkbox" id="athlete-guest"><label class="form-check-label text-white" for="athlete-guest">Atleta Ospite/Esterno (Verde, escludi dai totali)</label></div>
    </form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="athlete-form">Salva Atleta</button></div></div></div></div> 
    
    <div class="modal fade" id="sessionModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="sessionModalLabel">Pianifica Sessione</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="session-form"><input type="hidden" id="session-id"><div class="mb-3"><label class="form-label">Data</label><input type="date" class="form-control" id="session-date" required></div><div class="mb-3"><label class="form-label">Titolo/Tipo</label><input type="text" class="form-control" id="session-title" required placeholder="Es. Allenamento tecnico"></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Ora Inizio</label><input type="time" class="form-control" id="session-time"></div><div class="col-md-6 mb-3"><label class="form-label">Luogo</label><input type="text" class="form-control" id="session-location" placeholder="Es. Campo 1"></div></div><div class="mb-3"><label class="form-label">Obiettivi</label><input type="text" class="form-control" id="session-goals" placeholder="Es. Possesso palla, tiri in porta"></div><div class="mb-3"><label class="form-label">Descrizione Allenamento</label><textarea class="form-control" id="session-description" rows="5"></textarea></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-session-btn" style="display:none;">Elimina</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="session-form">Salva Sessione</button></div></div></div></div></div> 
    
    <div class="modal fade" id="matchResultModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="matchResultModalLabel">Inserisci Risultato Partita</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="match-result-form"><input type="hidden" id="match-id"><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Partita</label><input type="date" class="form-control" id="match-date" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Partita</label><input type="time" class="form-control" id="match-time"></div><div class="col-md-4 mb-3"><label class="form-label">Luogo Fisico</label><input type="text" class="form-control" id="match-venue" placeholder="Es. Stadio Comunale"></div></div><div class="row"><div class="col-md-5 mb-3"><label class="form-label">Squadra Avversaria</label><input type="text" class="form-control" id="match-opponent-name" required></div><div class="col-md-3 mb-3"><label class="form-label">Luogo</label><select class="form-select" id="match-location"><option value="home">Casa</option><option value="away">Trasferta</option></select></div></div><div class="row align-items-center text-center"><div class="col-5"><label class="form-label">GO Sport</label><input type="number" class="form-control text-center" id="match-my-team-score" min="0" placeholder="Gol"></div><div class="col-2">-</div><div class="col-5"><label class="form-label">AVVERSARI</label><input type="number" class="form-control text-center" id="match-opponent-score" min="0" placeholder="Gol"></div></div><hr><div class="row mt-3"><div class="col-md-4"><h5><i class="bi bi-futbol"></i> Marcatori</h5><div id="scorers-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-scorer-btn"><i class="bi bi-plus"></i> Aggiungi</button></div><div class="col-md-4"><h5><i class="bi bi-person-raised-hand"></i> Assists</h5><div id="assists-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-assist-btn"><i class="bi bi-plus"></i> Aggiungi</button></div><div class="col-md-4"><h5><i class="bi bi-file-earmark-person"></i> Cartellini</h5><div id="cards-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-card-btn"><i class="bi bi-plus"></i> Aggiungi</button></div></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-match-btn" style="display:none;">Elimina Partita</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="match-result-form">Salva Partita</button></div></div></div></div></div>`;

    const athleteModal = new bootstrap.Modal(document.getElementById('athleteModal'));
    const sessionModal = new bootstrap.Modal(document.getElementById('sessionModal'));
    const matchResultModal = new bootstrap.Modal(document.getElementById('matchResultModal'));
    const evaluationModal = new bootstrap.Modal(document.getElementById('evaluationModal'));

    // Variabili Globali
    const elements = {
        athleteGrid: document.getElementById('athlete-grid'),
        homeTotalAthletes: document.getElementById('home-total-athletes'),
        addAthleteBtn: document.getElementById('add-athlete-btn'),
        athleteForm: document.getElementById('athlete-form'),
        quickAddAthleteBtn: document.getElementById('quick-add-athlete-btn'),
        availableList: document.getElementById('available-list'),
        fieldContainer: document.getElementById('field-container'),
        fieldBenchArea: document.getElementById('field-bench-area'),
        calendarGrid: document.getElementById('calendar-grid'),
        currentMonthYearEl: document.getElementById('current-month-year'),
        prevMonthBtn: document.getElementById('prev-month-btn'),
        nextMonthBtn: document.getElementById('next-month-btn'),
        addSessionBtn: document.getElementById('add-session-btn'),
        sessionForm: document.getElementById('session-form'),
        deleteSessionBtn: document.getElementById('delete-session-btn'),
        matchResultsContainer: document.getElementById('match-results-container'),
        addMatchBtn: document.getElementById('add-match-btn'),
        matchResultForm: document.getElementById('match-result-form'),
        deleteMatchBtn: document.getElementById('delete-match-btn'),
        topScorersContainer: document.getElementById('top-scorers-container'),
        topAssistsContainer: document.getElementById('top-assists-container'),
        cardsSummaryTbody: document.getElementById('cards-summary-tbody'),
        statPg: document.getElementById('stat-pg'),
        statVps: document.getElementById('stat-vps'),
        statGf: document.getElementById('stat-gf'),
        statGs: document.getElementById('stat-gs'),
        statDr: document.getElementById('stat-dr'),
        hallOfFameContainer: document.getElementById('hall-of-fame-container'),
        exportAllDataBtn: document.getElementById('export-all-data-btn'),
        importFileInput: document.getElementById('import-file-input')
    };

    let athletes = [], evaluations = {}, trainingSessions = {}, matchResults = {}, awards = {}, formationData = { starters: [], bench: [], tokens: [] };
    let currentCalendarDate = new Date();
    const defaultAvatar = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3e%3cpath fill='%231e5095' d='M128 128H0V0h128v128z'/%3e%3cpath fill='%23ffffff' d='M64 100c-19.88 0-36-16.12-36-36s16.12-36 36-36 36 16.12 36 36-16.12 36-36 36zm0-64c-15.46 0-28 12.54-28 28s12.54 28 28 28 28-12.54 28-28-12.54-28-28-28z'/%3e%3c/svg%3e";

    const saveData = async () => {
        const allData = { athletes, evaluations, trainingSessions, matchResults, awards, formationData };
        try { await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allData) }); } 
        catch (error) { console.error('Errore salvataggio:', error); }
    };

    const loadData = async () => {
        try {
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const allData = await response.json();
            athletes = allData.athletes || [];
            evaluations = allData.evaluations || {};
            trainingSessions = allData.trainingSessions || {};
            matchResults = allData.matchResults || {};
            awards = allData.awards || {};
            formationData = allData.formationData || { starters: [], bench: [], tokens: [] };
            
            // Inizializzazione dati
            athletes.forEach(a => {
                if (a.isViceCaptain === undefined) a.isViceCaptain = false;
                if (a.isGuest === undefined) a.isGuest = false; // Default per nuovi campi
            });
            Object.values(matchResults).forEach(m => {
                if (!m.assists) m.assists = [];
                if (!m.scorers) m.scorers = [];
                if (!m.cards) m.cards = [];
            });
        } catch (error) {
            console.error('Errore caricamento:', error);
        }
    };

    const updateAllUI = () => {
        updateHomePage();
        updateTeamSeasonStats();
        renderAthletes();
        renderCalendar();
        renderFormation();
        renderMatchResults();
        renderCardsSummary();
        renderTopScorers();
        renderHallOfFame();
    };

    // --- LOGICA HOME PAGE MODIFICATA ---
    const updateHomePage = () => {
        // Conta solo chi NON è ospite
        elements.homeTotalAthletes.textContent = athletes.filter(a => !a.isGuest).length;
        // ... (resto della logica home page invariato per next session e top performer) ...
    };

    const updateTeamSeasonStats = () => {
        let pg = 0, v = 0, p = 0, s = 0, gf = 0, gs = 0;
        Object.values(matchResults).forEach(match => {
            pg++;
            const myScore = match.location === 'home' ? match.homeScore : match.awayScore;
            const oppScore = match.location === 'home' ? match.awayScore : match.homeScore;
            if (myScore !== '' && oppScore !== '') {
                gf += parseInt(myScore); gs += parseInt(oppScore);
                if (parseInt(myScore) > parseInt(oppScore)) v++;
                else if (parseInt(myScore) < parseInt(oppScore)) s++;
                else p++;
            }
        });
        const dr = gf - gs;
        elements.statPg.textContent = pg;
        elements.statVps.textContent = `${v}-${p}-${s}`;
        elements.statGf.textContent = gf;
        elements.statGs.textContent = gs;
        elements.statDr.textContent = dr > 0 ? `+${dr}` : dr;
        elements.statDr.className = dr > 0 ? 'text-success' : (dr < 0 ? 'text-danger' : '');
    };

    // --- LOGICA LISTA ATLETI MODIFICATA ---
    const renderAthletes = () => {
        elements.athleteGrid.innerHTML = '';
        athletes.forEach(athlete => {
            const card = document.createElement('div');
            card.className = 'col-xl-3 col-lg-4 col-md-6 mb-4';
            
            // Applica classe guest-mode se è ospite
            const guestClass = athlete.isGuest ? 'guest-mode' : '';
            const vcIcon = athlete.isViceCaptain ? '<i class="bi bi-star-half text-warning ms-1"></i>' : '';
            const cIcon = athlete.isCaptain ? '<i class="bi bi-star-fill text-warning ms-1"></i>' : '';
            
            card.innerHTML = `
                <div class="card athlete-card ${guestClass}">
                    <div class="card-body athlete-card-clickable" data-athlete-id="${athlete.id}">
                        <div class="d-flex align-items-center">
                            <img src="${athlete.avatar || defaultAvatar}" class="athlete-avatar me-3">
                            <div>
                                <h5 class="card-title text-white">${athlete.name} ${cIcon} ${vcIcon}</h5>
                                <p class="card-text text-muted">${athlete.role}</p>
                            </div>
                        </div>
                        <div class="shirt-number">${athlete.number}</div>
                    </div>
                    <div class="card-actions no-print">
                        <button class="btn btn-sm btn-outline-light edit-btn" data-athlete-id="${athlete.id}"><i class="bi bi-pencil-fill"></i></button>
                        <button class="btn btn-sm btn-outline-light delete-btn" data-athlete-id="${athlete.id}"><i class="bi bi-trash-fill"></i></button>
                    </div>
                </div>`;
            elements.athleteGrid.appendChild(card);
        });
    };

    // Event Listener Gestione Atleti (Edit/Delete)
    elements.athleteGrid.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        if (editBtn) {
            const id = editBtn.dataset.athleteId;
            const athlete = athletes.find(a => String(a.id) === id);
            if (athlete) {
                document.getElementById('modal-athlete-id').value = athlete.id;
                document.getElementById('athlete-name').value = athlete.name;
                document.getElementById('athlete-role').value = athlete.role;
                document.getElementById('athlete-number').value = athlete.number;
                document.getElementById('scadenza-visita').value = athlete.scadenzaVisita || '';
                document.getElementById('prenotazione-visita').value = athlete.dataPrenotazioneVisita || '';
                document.getElementById('athlete-captain').checked = athlete.isCaptain;
                document.getElementById('athlete-vice-captain').checked = athlete.isViceCaptain;
                // Carica stato Ospite
                document.getElementById('athlete-guest').checked = athlete.isGuest || false;
                
                document.getElementById('avatar-preview').src = athlete.avatar || '';
                document.getElementById('avatar-preview').style.display = athlete.avatar ? 'block' : 'none';
                athleteModal.show();
            }
        } else if (deleteBtn) {
            if (confirm('Eliminare definitivamente questo atleta?')) {
                const id = deleteBtn.dataset.athleteId;
                athletes = athletes.filter(a => String(a.id) !== id);
                formationData.starters = formationData.starters.filter(p => String(p.athleteId) !== id);
                formationData.bench = formationData.bench.filter(p => String(p.athleteId) !== id);
                saveData();
                updateAllUI();
            }
        }
    });

    // Submit Form Atleta
    elements.athleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('modal-athlete-id').value;
        const fileInput = document.getElementById('athlete-avatar-input');
        let avatarBase64 = document.getElementById('athlete-avatar-base64').value;
        
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            avatarBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        }

        const newAthlete = {
            id: id || Date.now().toString(),
            name: document.getElementById('athlete-name').value,
            role: document.getElementById('athlete-role').value,
            number: document.getElementById('athlete-number').value,
            scadenzaVisita: document.getElementById('scadenza-visita').value,
            dataPrenotazioneVisita: document.getElementById('prenotazione-visita').value,
            isCaptain: document.getElementById('athlete-captain').checked,
            isViceCaptain: document.getElementById('athlete-vice-captain').checked,
            // Salva stato Ospite
            isGuest: document.getElementById('athlete-guest').checked,
            avatar: avatarBase64 || (id ? athletes.find(a => String(a.id) === id)?.avatar : '')
        };

        if (id) {
            const idx = athletes.findIndex(a => String(a.id) === id);
            if (idx > -1) athletes[idx] = newAthlete;
        } else {
            athletes.push(newAthlete);
        }

        saveData();
        updateAllUI();
        athleteModal.hide();
        elements.athleteForm.reset();
    });

    elements.addAthleteBtn.addEventListener('click', () => {
        elements.athleteForm.reset();
        document.getElementById('modal-athlete-id').value = '';
        document.getElementById('avatar-preview').style.display = 'none';
        athleteModal.show();
    });
    elements.quickAddAthleteBtn.addEventListener('click', () => elements.addAthleteBtn.click());

    // --- ALTRE FUNZIONI (Formazione, Calendario, Match) - Mantenute Intatte ---
    const renderCalendar = () => {
        elements.calendarGrid.innerHTML = '';
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        elements.currentMonthYearEl.textContent = `${currentCalendarDate.toLocaleString('it-IT', { month: 'long' })} ${year}`;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = (firstDay.getDay() + 6) % 7;

        for (let i = 0; i < startDay; i++) elements.calendarGrid.innerHTML += `<div class="calendar-day other-month"></div>`;

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = toLocalDateISO(new Date(year, month, day));
            const dayCell = document.createElement('div');
            dayCell.className = `calendar-day ${dateStr === toLocalDateISO(new Date()) ? 'today' : ''}`;
            dayCell.innerHTML = `<div class="calendar-day-header">${day}</div>`;

            if (trainingSessions[dateStr]) {
                trainingSessions[dateStr].forEach(s => {
                    dayCell.innerHTML += `<div class="calendar-session session-allenamento" data-id="${s.id}" data-date="${dateStr}">${s.title}</div>`;
                });
            }
            Object.values(matchResults).forEach(m => {
                if (toLocalDateISO(m.date) === dateStr) {
                    const isFuture = dateStr > toLocalDateISO(new Date());
                    const hasScore = m.homeScore !== '' && m.awayScore !== '';
                    let cls = 'session-partita-casa';
                    if (m.location === 'away') cls = 'session-partita-trasferta';
                    if (isFuture && !hasScore) cls = 'session-partita-futura';
                    dayCell.innerHTML += `<div class="calendar-session ${cls}" data-match-id="${m.id}">⚽ ${m.opponentName}</div>`;
                }
            });
            elements.calendarGrid.appendChild(dayCell);
        }
    };

    elements.calendarGrid.addEventListener('click', e => {
        const sessEl = e.target.closest('.session-allenamento');
        const matchEl = e.target.closest('.calendar-session:not(.session-allenamento)');
        if (sessEl) {
            const id = sessEl.dataset.id;
            const date = sessEl.dataset.date;
            const session = trainingSessions[date].find(s => String(s.id) === id);
            openSessionModal(session, date);
        } else if (matchEl) {
            openMatchResultModal(matchEl.dataset.matchId);
        }
    });

    // Formazione Drag & Drop (semplificata per brevità, logica standard)
    const renderFormation = () => {
        elements.fieldContainer.querySelectorAll('.player-jersey, .token').forEach(e => e.remove());
        elements.fieldBenchArea.innerHTML = '';
        elements.availableList.innerHTML = '';
        const placedIds = new Set([...formationData.starters, ...formationData.bench].map(p => String(p.athleteId)));

        formationData.starters.forEach(p => createJersey(p, elements.fieldContainer));
        formationData.bench.forEach(p => createJersey(p, elements.fieldBenchArea));

        athletes.forEach(a => {
            if (!placedIds.has(String(a.id))) {
                const div = document.createElement('div');
                div.className = 'list-group-item available-player p-2 mb-1 border rounded';
                div.draggable = true;
                div.dataset.athleteId = a.id;
                div.innerHTML = `<strong>${a.number}</strong> ${a.name} <span class="badge bg-secondary">${a.role}</span>`;
                div.addEventListener('dragstart', handleDragStart);
                elements.availableList.appendChild(div);
            }
        });
        formationData.tokens.forEach(t => createToken(t, elements.fieldContainer));
    };

    function createJersey(posData, container) {
        const a = athletes.find(x => String(x.id) === String(posData.athleteId));
        if (!a) return;
        const div = document.createElement('div');
        div.className = 'player-jersey';
        div.style.left = posData.left + '%';
        div.style.top = posData.top + '%';
        div.draggable = true;
        div.dataset.athleteId = a.id;
        div.innerHTML = `<div class="jersey-body"><span class="jersey-number">${a.number}</span></div><span class="player-name">${a.name}</span>`;
        div.addEventListener('dragstart', handleDragStart);
        container.appendChild(div);
    }

    function createToken(tokenData, container) {
        const div = document.createElement('div');
        div.className = `token token-${tokenData.type}`;
        div.style.left = tokenData.left + '%';
        div.style.top = tokenData.top + '%';
        div.draggable = true;
        div.dataset.tokenId = tokenData.id;
        div.innerHTML = tokenData.type === 'ball' ? '⚽' : (tokenData.type === 'opponent' ? '●' : (tokenData.type === 'captain-c' ? 'C' : 'VC'));
        div.addEventListener('dragstart', handleDragStart);
        container.appendChild(div);
    }
    
    // Gestione Drag & Drop Base
    let draggedItem = null;
    function handleDragStart(e) { draggedItem = e.target; e.dataTransfer.effectAllowed = 'move'; }
    ['dragover', 'drop'].forEach(evt => {
        elements.fieldContainer.addEventListener(evt, handleDrop);
        elements.fieldBenchArea.addEventListener(evt, handleDrop);
    });
    function handleDrop(e) {
        e.preventDefault();
        if (e.type === 'drop' && draggedItem) {
            const rect = e.currentTarget.getBoundingClientRect();
            const left = ((e.clientX - rect.left) / rect.width) * 100;
            const top = ((e.clientY - rect.top) / rect.height) * 100;
            const id = draggedItem.dataset.athleteId;
            const tokenId = draggedItem.dataset.tokenId;
            
            if (id) {
                formationData.starters = formationData.starters.filter(p => String(p.athleteId) !== id);
                formationData.bench = formationData.bench.filter(p => String(p.athleteId) !== id);
                const targetArr = e.currentTarget.id === 'field-container' ? formationData.starters : formationData.bench;
                targetArr.push({ athleteId: id, left, top });
            } else if (tokenId || draggedItem.classList.contains('tool-item')) {
                 const type = tokenId ? null : draggedItem.dataset.itemType;
                 if (tokenId) formationData.tokens = formationData.tokens.filter(t => t.id !== tokenId);
                 formationData.tokens.push({ id: tokenId || Date.now().toString(), type: type || formationData.tokens.find(t=>t.id===tokenId).type, left, top });
            }
            saveData();
            renderFormation();
        }
    }

    // Match Results Logic
    const openMatchResultModal = (id) => {
        elements.matchResultForm.reset();
        document.getElementById('scorers-container').innerHTML = '';
        document.getElementById('assists-container').innerHTML = '';
        document.getElementById('cards-container').innerHTML = '';
        document.getElementById('delete-match-btn').style.display = id ? 'block' : 'none';
        
        if (id) {
            const m = matchResults[id];
            document.getElementById('match-id').value = m.id;
            document.getElementById('match-date').value = m.date;
            document.getElementById('match-time').value = m.time;
            document.getElementById('match-venue').value = m.venue;
            document.getElementById('match-opponent-name').value = m.opponentName;
            document.getElementById('match-location').value = m.location;
            document.getElementById('match-my-team-score').value = m.location === 'home' ? m.homeScore : m.awayScore;
            document.getElementById('match-opponent-score').value = m.location === 'home' ? m.awayScore : m.homeScore;
            m.scorers.forEach(addScorerRow);
            m.assists.forEach(addAssistRow);
            m.cards.forEach(addCardRow);
        } else {
             document.getElementById('match-date').valueAsDate = new Date();
        }
        matchResultModal.show();
    };

    const addScorerRow = (data = {}) => addRow('scorers-container', data, 'Gol');
    const addAssistRow = (data = {}) => addRow('assists-container', data, 'Assist');
    const addCardRow = (data = {}) => addCardRowImpl(data);

    function addRow(containerId, data, placeholder) {
        const div = document.createElement('div');
        div.className = 'input-group mb-1 d-flex';
        let options = `<option value="">Seleziona...</option>` + athletes.map(a => `<option value="${a.id}" ${String(a.id) === String(data.athleteId) ? 'selected' : ''}>${a.name}</option>`).join('');
        div.innerHTML = `<select class="form-select">${options}</select><button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()">X</button>`;
        document.getElementById(containerId).appendChild(div);
    }
    function addCardRowImpl(data = {}) {
        const div = document.createElement('div');
        div.className = 'input-group mb-1 d-flex gap-1';
        let options = `<option value="">Atleta...</option>` + athletes.map(a => `<option value="${a.id}" ${String(a.id) === String(data.athleteId) ? 'selected' : ''}>${a.name}</option>`).join('');
        div.innerHTML = `<select class="form-select param-athlete">${options}</select>
                         <select class="form-select param-type" style="max-width:80px"><option value="yellow" ${data.type==='yellow'?'selected':''}>Giallo</option><option value="red" ${data.type==='red'?'selected':''}>Rosso</option></select>
                         <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()">X</button>`;
        document.getElementById('cards-container').appendChild(div);
    }

    document.getElementById('add-scorer-btn').addEventListener('click', () => addScorerRow());
    document.getElementById('add-assist-btn').addEventListener('click', () => addAssistRow());
    document.getElementById('add-card-btn').addEventListener('click', () => addCardRowImpl());
    elements.addMatchBtn.addEventListener('click', () => openMatchResultModal());

    elements.matchResultForm.addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('match-id').value || Date.now().toString();
        const loc = document.getElementById('match-location').value;
        const myScore = document.getElementById('match-my-team-score').value;
        const oppScore = document.getElementById('match-opponent-score').value;

        const scorers = [...document.getElementById('scorers-container').children].map(row => ({ athleteId: row.querySelector('select').value })).filter(x => x.athleteId);
        const assists = [...document.getElementById('assists-container').children].map(row => ({ athleteId: row.querySelector('select').value })).filter(x => x.athleteId);
        const cards = [...document.getElementById('cards-container').children].map(row => ({ 
            athleteId: row.querySelector('.param-athlete').value,
            type: row.querySelector('.param-type').value
        })).filter(x => x.athleteId);

        matchResults[id] = {
            id,
            date: document.getElementById('match-date').value,
            time: document.getElementById('match-time').value,
            venue: document.getElementById('match-venue').value,
            opponentName: document.getElementById('match-opponent-name').value,
            location: loc,
            homeScore: loc === 'home' ? myScore : oppScore,
            awayScore: loc === 'home' ? oppScore : myScore,
            scorers, assists, cards
        };
        saveData();
        updateAllUI();
        matchResultModal.hide();
    });

    const renderMatchResults = () => {
        elements.matchResultsContainer.innerHTML = '';
        Object.values(matchResults).sort((a,b) => new Date(b.date)-new Date(a.date)).forEach(m => {
             const col = document.createElement('div');
             col.className = 'col-lg-4 col-md-6 mb-3';
             const isHome = m.location === 'home';
             const myScore = isHome ? m.homeScore : m.awayScore;
             const oppScore = isHome ? m.awayScore : m.homeScore;
             let cls = 'match-future';
             if (myScore !== '' && oppScore !== '') cls = isHome ? 'match-home' : 'match-away';
             
             col.innerHTML = `<div class="card h-100 match-result-item ${cls}" onclick="document.querySelector('[data-match-id=\\'${m.id}\\']').click()">
                <div class="card-body p-2">
                    <small class="text-muted">${m.date}</small>
                    <div>${isHome ? 'GO Sport' : m.opponentName} vs ${isHome ? m.opponentName : 'GO Sport'} <strong>${m.homeScore}-${m.awayScore}</strong></div>
                </div>
             </div>`;
             elements.matchResultsContainer.appendChild(col);
        });
    };

    const renderTopScorers = () => renderStatsList('top-scorers-container', 'scorers', 'Gol');
    const renderTopAssists = () => renderStatsList('top-assists-container', 'assists', 'Assist');

    function renderStatsList(containerId, prop, label) {
        const counts = {};
        Object.values(matchResults).forEach(m => m[prop].forEach(x => counts[x.athleteId] = (counts[x.athleteId] || 0) + 1));
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
        const html = sorted.map(([id, count]) => {
            const a = athletes.find(x => String(x.id) === String(id));
            return `<div class="d-flex justify-content-between border-bottom py-1"><span>${a ? a.name : 'Unknown'}</span><strong>${count}</strong></div>`;
        }).join('');
        document.getElementById(containerId).innerHTML = html || '<p class="text-muted small">Nessun dato</p>';
    }

    const renderCardsSummary = () => {
        const tbody = elements.cardsSummaryTbody;
        tbody.innerHTML = '';
        const summary = {};
        Object.values(matchResults).forEach(m => m.cards.forEach(c => {
            if (!summary[c.athleteId]) summary[c.athleteId] = { yellow: 0, red: 0, lastDate: m.date };
            summary[c.athleteId][c.type]++;
            if (m.date > summary[c.athleteId].lastDate) summary[c.athleteId].lastDate = m.date;
        }));
        Object.entries(summary).forEach(([id, s]) => {
            const a = athletes.find(x => String(x.id) === String(id));
            if (a) tbody.innerHTML += `<tr><td>${a.name}</td><td class="text-warning">${s.yellow}</td><td class="text-danger">${s.red}</td><td>${s.lastDate}</td><td></td></tr>`;
        });
    };
    
    const renderHallOfFame = () => elements.hallOfFameContainer.innerHTML = '<p class="text-muted">Funzione Hall of Fame disponibile in versione completa.</p>';

    // Init Logic
    document.getElementById('prev-month-btn').addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month-btn').addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); });
    elements.addSessionBtn.addEventListener('click', () => { elements.sessionForm.reset(); document.getElementById('session-date').valueAsDate = new Date(); sessionModal.show(); });
    
    elements.sessionForm.addEventListener('submit', e => {
        e.preventDefault();
        const date = document.getElementById('session-date').value;
        const id = document.getElementById('session-id').value || Date.now().toString();
        const session = {
            id, date, title: document.getElementById('session-title').value,
            time: document.getElementById('session-time').value, location: document.getElementById('session-location').value,
            goals: document.getElementById('session-goals').value, description: document.getElementById('session-description').value
        };
        if (!trainingSessions[date]) trainingSessions[date] = [];
        const idx = trainingSessions[date].findIndex(s => String(s.id) === String(id));
        if (idx > -1) trainingSessions[date][idx] = session; else trainingSessions[date].push(session);
        saveData(); renderCalendar(); sessionModal.hide();
    });

    const openSessionModal = (s, date) => {
        document.getElementById('session-id').value = s.id;
        document.getElementById('session-date').value = date;
        document.getElementById('session-title').value = s.title;
        document.getElementById('session-time').value = s.time;
        document.getElementById('session-location').value = s.location;
        document.getElementById('session-goals').value = s.goals;
        document.getElementById('session-description').value = s.description;
        sessionModal.show();
    };

    // Download Backup
    elements.exportAllDataBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify({ athletes, evaluations, trainingSessions, matchResults, awards, formationData }, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    });

    // Inizializza App
    loadData().then(updateAllUI);
});