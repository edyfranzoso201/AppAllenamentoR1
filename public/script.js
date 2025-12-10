// ✅ Funzione per evitare lo slittamento di data
function toLocalDateISO(dateInput) {
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
    }
    const d = new Date(dateInput);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', () => {
    const modalsContainer = document.getElementById('modals-container');

    // ✅ MODIFICA: Aggiunto campo "Assenza Giustificata" nel select di "Presenza Allenamento"
    modalsContainer.innerHTML = `
        <div class="modal fade" id="evaluationModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Valutazione di <span id="modal-athlete-name-eval"></span></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="evaluation-form">
                            <input type="hidden" id="modal-athlete-id-eval">
                            <p>Data: <strong id="modal-evaluation-date"></strong></p>
                            <div class="mb-2">
                                <label class="form-label">Presenza Allenamento</label>
                                <select id="presenza-allenamento" class="form-select">
                                    <option value="0">0-NV</option>
                                    <option value="1">1-B</option>
                                    <option value="2">2-M</option>
                                    <option value="3">3-A</option>
                                    <option value="4">4-Assenza Giustificata</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Serietà Allenamento</label>
                                <select id="serieta-allenamento" class="form-select">
                                    <option value="0">0-NV</option>
                                    <option value="1">1-B</option>
                                    <option value="2">2-M</option>
                                    <option value="3">3-A</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Abbigliamento Allenamento</label>
                                <select id="abbigliamento-allenamento" class="form-select">
                                    <option value="0">0-NV</option>
                                    <option value="1">1-B</option>
                                    <option value="2">2-M</option>
                                    <option value="3">3-A</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Abbigliamento Partita</label>
                                <select id="abbigliamento-partita" class="form-select">
                                    <option value="0">0-NV</option>
                                    <option value="1">1-B</option>
                                    <option value="2">2-M</option>
                                    <option value="3">3-A</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Serietà Comunicazioni</label>
                                <select id="comunicazioni" class="form-select">
                                    <option value="0">0-NV</option>
                                    <option value="1">1-B</option>
                                    <option value="2">2-M</option>
                                    <option value="3">3-A</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Doccia (Opzionale)</label>
                                <select id="doccia" class="form-select">
                                    <option value="0">0-NV</option>
                                    <option value="1">1-B</option>
                                    <option value="2">2-M</option>
                                    <option value="3">3-A</option>
                                </select>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="award-checkbox">
                                <label class="form-check-label" for="award-checkbox">Assegna Premio</label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer justify-content-between">
                        <button type="button" class="btn btn-outline-danger" id="delete-single-athlete-day-btn">Elimina Dati del Giorno</button>
                        <div>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
                            <button type="submit" class="btn btn-primary-custom" form="evaluation-form">Salva Valutazione</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="athleteModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="athleteModalLabel">Gestisci Atleta</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="athlete-form">
                            <input type="hidden" id="modal-athlete-id">
                            <div class="mb-3">
                                <label class="form-label">Nome Cognome</label>
                                <input type="text" class="form-control" id="athlete-name" required>
                            </div>
                            <div class="mb-3">
                                <label for="athlete-avatar-input" class="form-label">Foto Profilo</label>
                                <input type="file" class="form-control" id="athlete-avatar-input" accept="image/*">
                                <input type="hidden" id="athlete-avatar-base64">
                                <img id="avatar-preview" src="" alt="Anteprima" class="mt-2" style="max-width: 70px; max-height: 70px; display: none; border-radius: 50%;">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Ruolo</label>
                                <input type="text" class="form-control" id="athlete-role" required>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Numero Maglia</label>
                                    <input type="number" class="form-control" id="athlete-number" required min="1">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Scadenza Visita Medica</label>
                                    <input type="date" class="form-control" id="scadenza-visita">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Data Prenotazione Visita</label>
                                    <input type="date" class="form-control" id="prenotazione-visita">
                                </div>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="athlete-captain">
                                <label class="form-label" for="athlete-captain">Capitano</label>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="athlete-vice-captain">
                                <label class="form-label" for="athlete-vice-captain">Vice Capitano</label>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="athlete-guest">
                                <label class="form-label" for="athlete-guest">Atleta Ospite (non in rosa)</label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                        <button type="submit" class="btn btn-primary-custom" form="athlete-form">Salva Atleta</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Resto dei modali (gpsModal, sessionModal, matchResultModal, passwordModal) rimangono invariati -->
    `;

    // Inizializza le variabili globali
    const evaluationModal = new bootstrap.Modal(document.getElementById('evaluationModal'));
    const athleteModal = new bootstrap.Modal(document.getElementById('athleteModal'));
    const gpsModal = new bootstrap.Modal(document.getElementById('gpsModal'));
    const sessionModal = new bootstrap.Modal(document.getElementById('sessionModal'));
    const matchResultModal = new bootstrap.Modal(document.getElementById('matchResultModal'));
    const passwordModal = new bootstrap.Modal(document.getElementById('passwordModal'));

    // Elementi DOM
    const elements = {
        athleteGrid: document.getElementById('athlete-grid'),
        evaluationDatePicker: document.getElementById('evaluation-date-picker'),
        evaluationDatePicker2: document.getElementById('evaluation-date-picker-2'),
        performanceSelectorsContainer: document.getElementById('performance-selectors-container'),
        addComparisonBtn: document.getElementById('add-comparison-btn'),
        evaluationForm: document.getElementById('evaluation-form'),
        athleteForm: document.getElementById('athlete-form'),
        gpsForm: document.getElementById('gps-form'),
        addAthleteBtn: document.getElementById('add-athlete-btn'),
        comparisonPeriodToggle: document.getElementById('comparison-period-toggle'),
        attendancePeriodToggle: document.getElementById('attendance-period-toggle'),
        metricSelector: document.getElementById('performance-metric-selector'),
        tableContainer: document.getElementById('performance-table-container'),
        exportButtonsContainer: document.getElementById('export-buttons-container'),
        trendAthleteSelector: document.getElementById('trend-athlete-selector'),
        trendMetricSelector: document.getElementById('trend-metric-selector'),
        hallOfFameContainer: document.getElementById('hall-of-fame-container'),
        radarAthleteSelector1: document.getElementById('radar-athlete-selector-1'),
        radarAthleteSelector2: document.getElementById('radar-athlete-selector-2'),
        multiAthleteMetricSelector: document.getElementById('multi-athlete-metric-selector'),
        multiAthleteTimeFilter: document.querySelector('#multi-athlete-chart-container .btn-group[role="group"]'),
        multiAthleteDatepicker: document.getElementById('multi-athlete-datepicker'),
        multiAthleteDatepickerContainer: document.getElementById('multi-athlete-datepicker-container'),
        multiAthleteResetBtn: document.getElementById('multi-athlete-reset-btn'),
        deleteDayDataBtn: document.getElementById('delete-day-data-btn'),
        exportAllDataBtn: document.getElementById('export-all-data-btn'),
        importFileInput: document.getElementById('import-file-input'),
        performanceFilterToggle: document.getElementById('performance-filter-toggle'),
        multiAthleteTypeSelector: document.getElementById('multi-athlete-type-selector'),
        addSessionBtn: document.getElementById('add-session-btn'),
        calendarGrid: document.getElementById('calendar-grid'),
        currentMonthYearEl: document.getElementById('current-month-year'),
        prevMonthBtn: document.getElementById('prev-month-btn'),
        nextMonthBtn: document.getElementById('next-month-btn'),
        sessionForm: document.getElementById('session-form'),
        deleteSessionBtn: document.getElementById('delete-session-btn'),
        homeTotalAthletes: document.getElementById('home-total-athletes'),
        homeNextSession: document.getElementById('home-next-session'),
        homeTopPerformer: document.getElementById('home-top-performer'),
        quickAddAthleteBtn: document.getElementById('quick-add-athlete-btn'),
        quickPlanSessionBtn: document.getElementById('quick-plan-session-btn'),
        fieldContainer: document.getElementById('field-container'),
        fieldBenchArea: document.getElementById('field-bench-area'),
        availableList: document.getElementById('available-list'),
        addMatchBtn: document.getElementById('add-match-btn'),
        matchResultForm: document.getElementById('match-result-form'),
        deleteMatchBtn: document.getElementById('delete-match-btn'),
        matchResultsContainer: document.getElementById('match-results-container'),
        cardsSummaryTbody: document.getElementById('cards-summary-tbody'),
        matchOpponentFilter: document.getElementById('match-opponent-filter'),
        matchPeriodToggle: document.getElementById('match-period-toggle'),
        topScorersContainer: document.getElementById('top-scorers-container'),
        topAssistsContainer: document.getElementById('top-assists-container'),
        passwordForm: document.getElementById('password-form'),
        passwordError: document.getElementById('password-error'),
        alertsContainer: document.getElementById('alerts-container'),
        logoutBtn: document.getElementById('logout-btn'),
        statPg: document.getElementById('stat-pg'),
        statVps: document.getElementById('stat-vps'),
        statGf: document.getElementById('stat-gf'),
        statGs: document.getElementById('stat-gs'),
        statDr: document.getElementById('stat-dr')
    };

    const ACCESS_PASSWORD = "2025Edy201";
    let authSuccessCallback = null;
    let authCancelCallback = null;
    const isAuthenticated = () => sessionStorage.getItem('isAuthenticated') === 'true';
    const requestAuthentication = (onSuccess, onCancel = () => {}) => {
        if (isAuthenticated()) {
            onSuccess();
            return;
        }
        authSuccessCallback = onSuccess;
        authCancelCallback = onCancel;
        elements.passwordError.style.display = 'none';
        elements.passwordForm.reset();
        passwordModal.show();
    };

    elements.passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('password-input').value;
        if (password === ACCESS_PASSWORD) {
            sessionStorage.setItem('isAuthenticated', 'true');
            elements.passwordError.style.display = 'none';
            passwordModal.hide();
            if (authSuccessCallback) authSuccessCallback();
            updateAllUI();
        } else {
            elements.passwordError.style.display = 'block';
        }
    });

    document.getElementById('passwordModal').addEventListener('hidden.bs.modal', () => {
        if (!isAuthenticated() && authCancelCallback) {
            authCancelCallback();
        }
    });

    const matchStatsFields = ['minuti_giocati', 'gol', 'assist', 'ammonizioni', 'espulsioni', 'palle_recuperate', 'palle_perse'];
    const allGpsFields = ['data_di_registrazione', 'ora_registrazione', 'tipo_sessione', 'distanza_totale', 'tempo_totale', 'distanza_sprint', 'velocita_massima', 'numero_di_sprint', 'max_acc', 'max_dec', 'passaggi_piede_sinistro', 'passaggi_piede_destro', 'cross_piede_sinistro', 'cross_piede_destro', 'potenza_massima_di_tiro', 'distanza_per_minuto', 'tiri_piede_sx', 'tiri_piede_dx', 'perc_passaggi_brevi', 'perc_lanci', 'distanza_circuito', 'tempo_circuito_totale_s', 'velocita_circuito', 'note', ...matchStatsFields];
    const gpsFieldsForDisplay = { 
        'tipo_sessione':'Tipo', 
        'data_di_registrazione': 'Data', 
        'ora_registrazione': 'Ora', 
        'distanza_totale': 'Dist. Totale (m)', 
        'tempo_totale': 'Tempo (min)', 
        'distanza_per_minuto':'Dist/min (m)', 
        'distanza_sprint': 'Distanza Sprint (m)', 
        'velocita_massima': 'Vel. Max (km/h)', 
        'numero_di_sprint': 'Num. Sprint', 
        'max_acc': 'Max Acc (g)o(n°)', 
        'max_dec': 'Max Dec (g)o(n°)', 
        'passaggi_piede_sinistro':'Passaggi SX', 
        'passaggi_piede_destro':'Passaggi DX', 
        'cross_piede_sinistro':'Cross SX', 
        'cross_piede_destro':'Cross DX', 
        'potenza_massima_di_tiro':'Pot. Tiro (km/h)', 
        'tiri_piede_sx': 'Tiri Piede SX', 
        'tiri_piede_dx': 'Tiri Piede DX', 
        'perc_passaggi_brevi': '% Passaggi Brevi', 
        'perc_lanci': '% Lanci', 
        'distanza_circuito': 'Dist. Circuito (m)', 
        'tempo_circuito_totale_s': 'Tempo Circuito (s)', 
        'velocita_circuito': 'Vel. Circuito (km/h)', 
        'minuti_giocati': 'Minuti Giocati', 
        'gol': 'Gol', 
        'assist': 'Assist', 
        'ammonizioni': 'Gialli', 
        'espulsioni': 'Rossi', 
        'palle_recuperate': 'Palle Recuperate', 
        'palle_perse': 'Palle Perse', 
        'note': 'Note' 
    };
    const radarMetrics = { 
        'distanza_sprint': 'Distanza Sprint', 
        'velocita_massima': 'Vel. Max', 
        'max_acc': 'Max Acc', 
        'max_dec': 'Max Dec', 
        'passaggi_piede_sinistro': 'Pass. SX', 
        'passaggi_piede_destro': 'Pass. DX', 
        'cross_piede_sinistro': 'Cross SX', 
        'cross_piede_destro': 'Cross DX', 
        'potenza_massima_di_tiro': 'Pot. Tiro', 
        'distanza_per_minuto': 'Dist/min', 
        'tiri_piede_sx': 'Tiri SX', 
        'tiri_piede_dx': 'Tiri DX', 
        'perc_passaggi_brevi': '% Pass. Brevi', 
        'perc_lanci': '% Lanci', 
        'velocita_circuito': 'Vel. Circuito' 
    };
    const evaluationCategories = ['presenza-allenamento', 'serieta-allenamento', 'abbigliamento-allenamento', 'abbigliamento-partita', 'comunicazioni', 'doccia']; // 'assenza-giustificata' è gestita nel select sopra
    const defaultAvatar = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3e%3cpath fill='%231e5095' d='M128 128H0V0h128v128z'/%3e%3cpath fill='%23ffffff' d='M64 100c-19.88 0-36-16.12-36-36s16.12-36 36-36 36 16.12 36 36-16.12 36-36 36zm0-64c-15.46 0-28 12.54-28 28s12.54 28 28 28 28-12.54 28-28-12.54-28-28-28z'/%3e%3cpath fill='%23ffffff' d='M64 24a40.01 40.01 0 00-28.28 11.72C35.8 35.8 28 45.45 28 56h8c0-8.27 5.61-15.64 13.53-18.89A31.93 31.93 0 0164 32a32.09 32.09 0 0124.47 11.11C96.39 40.36 102 47.73 102 56h8c0-10.55-7.8-20.2-17.72-24.28A39.99 39.99 0 0064 24z'/%3e%3c/svg%3e";

    let athletes = [], evaluations = {}, gpsData = {}, awards = {}, trainingSessions = {}, matchResults = {};
    let formationData = { starters: [], bench: [], tokens: [] };
    let chartInstances = {};
    let comparisonChartPeriod = 'daily';
    let attendanceChartPeriod = 'daily';
    let performanceSelections = [ { athleteId: null, sessionId: null }, { athleteId: null, sessionId: null } ];
    let performanceFilterType = 'all';
    let multiAthleteFilterType = 'all';
    let currentCalendarDate = new Date();
    let pollingInterval = null;
    let visuallyDeletedCards = [];

    const saveData = async () => {
        const allData = { athletes, evaluations, gpsData, awards, trainingSessions, formationData, matchResults };
        try {
            await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allData) });
        } catch (error) { console.error('Errore nel salvataggio dei dati sul server:', error); }
    };

    const migrateGpsData = () => {
        for (const athleteId in gpsData) {
            for (const date in gpsData[athleteId]) {
                if (gpsData[athleteId][date] && !Array.isArray(gpsData[athleteId][date])) {
                    const oldSessionObject = gpsData[athleteId][date];
                    if (!oldSessionObject.id) { oldSessionObject.id = new Date(`${date}T${oldSessionObject.ora_registrazione || '00:00:00'}`).getTime().toString(); }
                    gpsData[athleteId][date] = [oldSessionObject];
                }
            }
        }
    };

    const loadData = async () => {
        try {
            const response = await fetch('/api/data', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
            const allData = await response.json();
            athletes = allData.athletes || [];
            evaluations = allData.evaluations || {};
            gpsData = allData.gpsData || {};
            migrateGpsData();
            awards = allData.awards || {};
            trainingSessions = allData.trainingSessions || {};
            formationData = allData.formationData || { starters: [], bench: [], tokens: [] };
            matchResults = allData.matchResults || {};

            // ✅ Retrocompatibilità: Assicura che tutti gli atleti abbiano la proprietà `isGuest`
            athletes.forEach(athlete => {
                if (athlete.isGuest === undefined) {
                    athlete.isGuest = false;
                }
            });

            // ✅ Assicurarsi che tutte le partite abbiano la proprietà `assists`
            for (const matchId in matchResults) {
                if (!matchResults[matchId].assists) {
                    matchResults[matchId].assists = [];
                }
            }
        } catch (error) {
            console.error('Errore nel caricamento dei dati dal server:', error);
            athletes = []; 
            evaluations = {}; 
            gpsData = {}; 
            awards = {}; 
            trainingSessions = {}; 
            formationData = { starters: [], bench: [], tokens: [] }; 
            matchResults = {};
        }
    };

    const getWeekRange = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
        return { start: monday.toISOString().split('T')[0], end: sunday.toISOString().split('T')[0] };
    };

    // ✅ Calcola punteggio escludendo presenza allenamento (perché ora contiene anche assenza giustificata)
    const calculateAthleteScore = (evaluation) => !evaluation ? 0 : Object.keys(evaluation).filter(k => !['doccia', 'presenza-allenamento'].includes(k)).reduce((sum, key) => sum + parseInt(evaluation[key] || 0, 10), 0);

    const updateLogoutButtonVisibility = () => { elements.logoutBtn.style.display = isAuthenticated() ? 'block' : 'none'; };
    const updateUnlockButtonsVisibility = () => {
        const unlockBtns = document.querySelectorAll('.unlock-btn');
        const displayStyle = isAuthenticated() ? 'none' : 'inline-block';
        unlockBtns.forEach(btn => btn.style.display = displayStyle);
    };

    const updateTeamSeasonStats = () => {
        let pg = 0, v = 0, p = 0, s = 0, gf = 0, gs = 0;
        Object.values(matchResults).forEach(match => {
            pg++;
            const myScore = match.location === 'home' ? match.homeScore : match.awayScore;
            const oppScore = match.location === 'home' ? match.awayScore : match.homeScore;
            gf += myScore;
            gs += oppScore;
            if (myScore > oppScore) v++;
            else if (myScore < oppScore) s++;
            else p++;
        });
        const dr = gf - gs;
        elements.statPg.textContent = pg;
        elements.statVps.textContent = `${v}-${p}-${s}`;
        elements.statGf.textContent = gf;
        elements.statGs.textContent = gs;
        elements.statDr.textContent = dr > 0 ? `+${dr}` : dr;
        elements.statDr.className = dr > 0 ? 'diff-pos' : (dr < 0 ? 'diff-neg' : '');
    };

    const updateAllUI = () => {
        updateLogoutButtonVisibility();
        updateUnlockButtonsVisibility();
        checkDeadlinesAndAlert();
        updateHomePage();
        updateTeamSeasonStats();
        renderAthletes();
        renderCalendar();
        renderFormation();
        renderMatchResults();
        renderCardsSummary();
        renderTopScorers();
        renderTopAssists();
        updateMatchAnalysisChart();
        updateEvaluationCharts();
        updateAttendanceChart();
        updateHallOfFame();
        populatePerformanceSelectors();
        populateAnalysisSelectors();
        updatePerformanceChart();
        updateAthleteTrendChart();
        updateAthleteRadarChart();
        updateMultiAthleteChart();
    };

    const createJerseyElement = (athlete) => {
        const jersey = document.createElement('div');
        jersey.className = 'player-jersey';