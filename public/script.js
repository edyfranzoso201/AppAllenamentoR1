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
    
    // --- MODIFICA QUI: Template Modale Atleta aggiornato con Checkbox ---
    modalsContainer.innerHTML = `
    <div class="modal fade" id="evaluationModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Valutazione di <span id="modal-athlete-name-eval"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="evaluation-form"><input type="hidden" id="modal-athlete-id-eval"><p>Data: <strong id="modal-evaluation-date"></strong></p><div class="mb-2"><label class="form-label">Presenza Allenamento</label><select id="presenza-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Serietà Allenamento</label><select id="serieta-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Allenamento</label><select id="abbigliamento-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Partita</label><select id="abbigliamento-partita" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Serietà Comunicazioni</label><select id="comunicazioni" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Doccia (Opzionale)</label><select id="doccia" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="award-checkbox"><label class="form-check-label" for="award-checkbox">Assegna Premio</label></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-single-athlete-day-btn">Elimina Dati del Giorno</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="evaluation-form">Salva Valutazione</button></div></div></div></div></div> 
    
    <div class="modal fade" id="athleteModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="athleteModalLabel">Gestisci Atleta</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="athlete-form"><input type="hidden" id="modal-athlete-id"><div class="mb-3"><label class="form-label">Nome Cognome</label><input type="text" class="form-control" id="athlete-name" required></div><div class="mb-3"><label for="athlete-avatar-input" class="form-label">Foto Profilo</label><input type="file" class="form-control" id="athlete-avatar-input" accept="image/*"><input type="hidden" id="athlete-avatar-base64"><img id="avatar-preview" src="" alt="Anteprima" class="mt-2" style="max-width: 70px; max-height: 70px; display: none; border-radius: 50%;"></div><div class="mb-3"><label class="form-label">Ruolo</label><input type="text" class="form-control" id="athlete-role" required></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Numero Maglia</label><input type="number" class="form-control" id="athlete-number" required min="1"></div><div class="col-md-6 mb-3"><label class="form-label">Scadenza Visita Medica</label><input type="date" class="form-control" id="scadenza-visita"></div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Data Prenotazione Visita</label><input type="date" class="form-control" id="prenotazione-visita"></div></div>
    <div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="athlete-captain"><label class="form-label" for="athlete-captain">Capitano</label></div>
    <div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="athlete-vice-captain"><label class="form-label" for="athlete-vice-captain">Vice Capitano</label></div>
    <div class="form-check mb-3 bg-success bg-opacity-25 p-2 rounded"><input class="form-check-input" type="checkbox" id="athlete-guest"><label class="form-check-label ms-2" for="athlete-guest"><strong>Atleta Esterno/Ospite</strong> (Escludi da totale)</label></div>
    </form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="athlete-form">Salva Atleta</button></div></div></div></div> 
    
    <div class="modal fade" id="gpsModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="gpsModalLabel">Dati Performance di <span id="modal-athlete-name-gps"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="gps-form"><input type="hidden" id="modal-athlete-id-gps"><input type="hidden" id="gps-session-id"> <div class="row mb-3"><div class="col-md-8"><label for="gps-session-selector" class="form-label">Seleziona Sessione Esistente per Modificare</label><select id="gps-session-selector" class="form-select"><option value="">--- Inserisci Nuova Sessione ---</option></select></div><div class="col-md-4 d-flex align-items-end"><button type="button" id="delete-gps-session-btn" class="btn btn-outline-danger w-100" disabled>Elimina Sessione</button></div></div><hr> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Registrazione</label><input type="date" class="form-control" id="gps-data_di_registrazione" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Registrazione</label><input type="time" class="form-control" id="gps-ora_registrazione"></div><div class="col-md-4 mb-3"><label class="form-label">Tipo Sessione</label><select class="form-select" id="gps-tipo_sessione"><option value="Allenamento">Allenamento</option><option value="Partita">Partita</option><option value="Individual">Individual</option></select></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Distanza Totale (m)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_totale" placeholder="es. 10500"></div><div class="col-md-4 mb-3"><label class="form-label">Tempo Totale (min)</label><input type="number" step="0.1" class="form-control" id="gps-tempo_totale" placeholder="es. 92"></div><div class="col-md-4 mb-3"><label class="form-label">Distanza per Minuto (m/min)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_per_minuto" readonly></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Distanza Sprint (m)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_sprint"></div><div class="col-md-4 mb-3"><label class="form-label">Velocità Massima (km/h)</label><input type="number" step="0.1" class="form-control" id="gps-velocita_massima"></div><div class="col-md-4 mb-3"><label class="form-label">Numero di Sprint</label><input type="number" class="form-control" id="gps-numero_di_sprint"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Max Acc (g)o(n°)</label><input type="number" step="0.1" class="form-control" id="gps-max_acc"></div><div class="col-md-4 mb-3"><label class="form-label">Max Dec (g)o(n°)</label><input type="number" step="0.1" class="form-control" id="gps-max_dec"></div><div class="col-md-4 mb-3"><label class="form-label">Passaggi Piede Sinistro</label><input type="number" class="form-control" id="gps-passaggi_piede_sinistro"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Passaggi Piede Destro</label><input type="number" class="form-control" id="gps-passaggi_piede_destro"></div><div class="col-md-4 mb-3"><label class="form-label">Cross Piede Sinistro</label><input type="number" step="0.1" class="form-control" id="gps-cross_piede_sinistro"></div><div class="col-md-4 mb-3"><label class="form-label">Cross Piede Destro</label><input type="number" step="0.1" class="form-control" id="gps-cross_piede_destro"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Potenza Massima di Tiro (km/h)</label><input type="number" step="0.1" class="form-control" id="gps-potenza_massima_di_tiro"></div><div class="col-md-4 mb-3"><label class="form-label">Tiri Piede SX</label><input type="number" class="form-control" id="gps-tiri_piede_sx"></div><div class="col-md-4 mb-3"><label class="form-label">Tiri Piede DX</label><input type="number" class="form-control" id="gps-tiri_piede_dx"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">% Passaggi Brevi</label><input type="number" step="0.1" class="form-control" id="gps-perc_passaggi_brevi"></div><div class="col-md-4 mb-3"><label class="form-label">% Lanci</label><input type="number" step="0.1" class="form-control" id="gps-perc_lanci"></div><div class="col-md-4 mb-3"><label class="form-label">Distanza Circuito (m)</label><input type="number" step="1" class="form-control" id="gps-distanza_circuito" placeholder="es. 400"></div></div> <div class="row align-items-end"><div class="col-md-5 mb-3"><label class="form-label">Tempo Circuito</label><div class="input-group"><input type="number" class="form-control" id="gps-tempo_circuito_min" placeholder="Min" min="0"><span class="input-group-text">:</span><input type="number" class="form-control" id="gps-tempo_circuito_sec" placeholder="Sec" min="0" max="59"><span class="input-group-text">.</span><input type="number" class="form-control" id="gps-tempo_circuito_cen" placeholder="Cen" min="0" max="99"></div></div><div class="col-md-4 mb-3"><label class="form-label">Velocità (km/h)</label><input type="text" class="form-control" id="gps-velocita_circuito" readonly></div></div> <div id="match-stats-fields" style="display: none;"><hr><h5 class="mb-3">Statistiche Partita</h5><div class="row"><div class="col-md-3 mb-3"><label class="form-label">Minuti Giocati</label><input type="number" class="form-control" id="gps-minuti_giocati"></div><div class="col-md-3 mb-3"><label class="form-label">Gol</label><input type="number" class="form-control" id="gps-gol"></div><div class="col-md-3 mb-3"><label class="form-label">Assist</label><input type="number" class="form-control" id="gps-assist"></div><div class="col-md-3 mb-3"><label class="form-label">Ammonizioni</label><input type="number" class="form-control" id="gps-ammonizioni"></div></div><div class="row"><div class="col-md-3 mb-3"><label class="form-label">Espulsioni</label><input type="number" class="form-control" id="gps-espulsioni"></div><div class="col-md-3 mb-3"><label class="form-label">Palle Recuperate</label><input type="number" class="form-control" id="gps-palle_recuperate"></div><div class="col-md-3 mb-3"><label class="form-label">Palle Perse</label><input type="number" class="form-control" id="gps-palle_perse"></div></div></div> <div class="row"><div class="col-12 mb-3"><label class="form-label">Note (opzionale)</label><textarea class="form-control" id="gps-note" rows="2" placeholder="Es. Allenamento intenso, recupero infortunio, ecc."></textarea></div></div> </form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="gps-form">Salva Dati GPS</button></div></div></div></div> <div class="modal fade" id="sessionModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="sessionModalLabel">Pianifica Sessione</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="session-form"><input type="hidden" id="session-id"><div class="mb-3"><label class="form-label">Data</label><input type="date" class="form-control" id="session-date" required></div><div class="mb-3"><label class="form-label">Titolo/Tipo</label><input type="text" class="form-control" id="session-title" required placeholder="Es. Allenamento tecnico"></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Ora Inizio</label><input type="time" class="form-control" id="session-time"></div><div class="col-md-6 mb-3"><label class="form-label">Luogo</label><input type="text" class="form-control" id="session-location" placeholder="Es. Campo 1"></div></div><div class="mb-3"><label class="form-label">Obiettivi</label><input type="text" class="form-control" id="session-goals" placeholder="Es. Possesso palla, tiri in porta"></div><div class="mb-3"><label class="form-label">Descrizione Allenamento (un punto per riga)</label><textarea class="form-control" id="session-description" rows="5"></textarea></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-session-btn" style="display:none;">Elimina</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="session-form">Salva Sessione</button></div></div></div></div></div> <div class="modal fade" id="matchResultModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="matchResultModalLabel">Inserisci Risultato Partita</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="match-result-form"><input type="hidden" id="match-id"><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Partita</label><input type="date" class="form-control" id="match-date" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Partita</label><input type="time" class="form-control" id="match-time"></div><div class="col-md-4 mb-3"><label class="form-label">Luogo Fisico</label><input type="text" class="form-control" id="match-venue" placeholder="Es. Stadio Comunale"></div></div><div class="row"><div class="col-md-5 mb-3"><label class="form-label">Squadra Avversaria</label><input type="text" class="form-control" id="match-opponent-name" required></div><div class="col-md-3 mb-3"><label class="form-label">Luogo</label><select class="form-select" id="match-location"><option value="home">Casa</option><option value="away">Trasferta</option></select></div></div><div class="row align-items-center text-center">
                <div class="col-5"><label class="form-label">GO Sport</label><input type="number" class="form-control text-center" id="match-my-team-score" min="0" placeholder="Gol"></div>
                <div class="col-2">-</div>
                <div class="col-5"><label class="form-label">AVVERSARI</label><input type="number" class="form-control text-center" id="match-opponent-score" min="0" placeholder="Gol"></div>
                </div><hr><div class="row mt-3"><div class="col-md-4"><h5><i class="bi bi-futbol"></i> Marcatori (GO Sport)</h5><div id="scorers-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-scorer-btn"><i class="bi bi-plus"></i> Aggiungi Marcatore</button></div><div class="col-md-4"><h5><i class="bi bi-person-raised-hand"></i> Assists (GO Sport)</h5><div id="assists-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-assist-btn"><i class="bi bi-plus"></i> Aggiungi Assist</button></div><div class="col-md-4"><h5><i class="bi bi-file-earmark-person"></i> Cartellini (GO Sport)</h5><div id="cards-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-card-btn"><i class="bi bi-plus"></i> Aggiungi Cartellino</button></div></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-match-btn" style="display:none;">Elimina Partita</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="match-result-form">Salva Partita</button></div></div></div></div></div> <div class="modal fade" id="passwordModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Accesso Richiesto</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><p>Per visualizzare questi dati è richiesta una password.</p><form id="password-form"><div class="mb-3"><label for="password-input" class="form-label">Password</label><input type="password" class="form-control" id="password-input" required><div id="password-error" class="text-danger mt-2" style="display: none;">Password non corretta.</div></div><button type="submit" class="btn btn-primary-custom w-100">Accedi</button></form></div></div></div></div>`;
    
    // ... resto variabili ...
    const evaluationModal = new bootstrap.Modal(document.getElementById('evaluationModal'));
    const athleteModal = new bootstrap.Modal(document.getElementById('athleteModal'));
    const gpsModal = new bootstrap.Modal(document.getElementById('gpsModal'));
    const sessionModal = new bootstrap.Modal(document.getElementById('sessionModal'));
    const matchResultModal = new bootstrap.Modal(document.getElementById('matchResultModal'));
    const passwordModal = new bootstrap.Modal(document.getElementById('passwordModal'));
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
    const gpsFieldsForDisplay = { 'tipo_sessione':'Tipo', 'data_di_registrazione': 'Data', 'ora_registrazione': 'Ora', 'distanza_totale': 'Dist. Totale (m)', 'tempo_totale': 'Tempo (min)', 'distanza_per_minuto':'Dist/min (m)', 'distanza_sprint': 'Distanza Sprint (m)', 'velocita_massima': 'Vel. Max (km/h)', 'numero_di_sprint': 'Num. Sprint', 'max_acc': 'Max Acc (g)o(n°)', 'max_dec': 'Max Dec (g)o(n°)', 'passaggi_piede_sinistro':'Passaggi SX', 'passaggi_piede_destro':'Passaggi DX', 'cross_piede_sinistro':'Cross SX', 'cross_piede_destro':'Cross DX', 'potenza_massima_di_tiro':'Pot. Tiro (km/h)', 'tiri_piede_sx': 'Tiri Piede SX', 'tiri_piede_dx': 'Tiri Piede DX', 'perc_passaggi_brevi': '% Passaggi Brevi', 'perc_lanci': '% Lanci', 'distanza_circuito': 'Dist. Circuito (m)', 'tempo_circuito_totale_s': 'Tempo Circuito (s)', 'velocita_circuito': 'Vel. Circuito (km/h)', 'minuti_giocati': 'Minuti Giocati', 'gol': 'Gol', 'assist': 'Assist', 'ammonizioni': 'Gialli', 'espulsioni': 'Rossi', 'palle_recuperate': 'Palle Recuperate', 'palle_perse': 'Palle Perse', 'note': 'Note' };
    const radarMetrics = { 'distanza_sprint': 'Distanza Sprint', 'velocita_massima': 'Vel. Max', 'max_acc': 'Max Acc', 'max_dec': 'Max Dec', 'passaggi_piede_sinistro': 'Pass. SX', 'passaggi_piede_destro': 'Pass. DX', 'cross_piede_sinistro': 'Cross SX', 'cross_piede_destro': 'Cross DX', 'potenza_massima_di_tiro': 'Pot. Tiro', 'distanza_per_minuto': 'Dist/min', 'tiri_piede_sx': 'Tiri SX', 'tiri_piede_dx': 'Tiri DX', 'perc_passaggi_brevi': '% Pass. Brevi', 'perc_lanci': '% Lanci', 'velocita_circuito': 'Vel. Circuito' };
    const evaluationCategories = ['presenza-allenamento', 'serieta-allenamento', 'abbigliamento-allenamento', 'abbigliamento-partita', 'comunicazioni', 'doccia'];
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
            
            athletes.forEach(athlete => {
                if (athlete.isViceCaptain === undefined) athlete.isViceCaptain = false;
                if (athlete.isGuest === undefined) athlete.isGuest = false; // Default
            });
            for (const matchId in matchResults) {
                if (!matchResults[matchId].assists) matchResults[matchId].assists = [];
            }
        } catch (error) {
            console.error('Errore nel caricamento dei dati dal server:', error);
            athletes = []; evaluations = {}; gpsData = {}; awards = {}; trainingSessions = {}; formationData = { starters: [], bench: [], tokens: [] }; matchResults = {};
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
    const calculateAthleteScore = (evaluation) => !evaluation ? 0 : Object.keys(evaluation).filter(k => k !== 'doccia').reduce((sum, key) => sum + parseInt(evaluation[key] || 0, 10), 0);
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
    // --- MODIFICA: createJerseyElement gestisce isGuest ---
    const createJerseyElement = (athlete) => {
        const jersey = document.createElement('div');
        jersey.className = 'player-jersey';
        jersey.dataset.athleteId = athlete.id;
        jersey.dataset.role = athlete.role;
        const jerseyColor = athlete.role.toLowerCase().includes('portiere') ? 'var(--gk-color)' : 'var(--secondary-blue)';
        // Se è ospite, aggiungi classe guest-mode al body
        const guestClass = athlete.isGuest ? 'guest-mode' : '';
        
        jersey.innerHTML = `<div class="jersey-body ${guestClass}" style="background-color: ${athlete.isGuest ? '' : jerseyColor};"><span class="jersey-number">${athlete.number}</span></div><span class="player-name">${athlete.name}</span>`;
        return jersey;
    };
    
    const createTokenElement = (type, id) => {
        const token = document.createElement('div');
        token.className = 'token';
        token.dataset.itemType = type;
        if (id) token.dataset.tokenId = id;
        switch(type) {
            case 'captain-c': token.innerHTML = '(C)'; token.classList.add('token-captain'); break;
            case 'captain-vc': token.innerHTML = '(VC)'; token.classList.add('token-captain'); break;
            case 'ball': token.innerHTML = '⚽'; token.classList.add('token-ball'); break;
            case 'opponent': token.innerHTML = '●'; token.classList.add('token-opponent'); break;
        }
        return token;
    };
    const renderFormation = () => {
        const field = elements.fieldContainer;
        const bench = elements.fieldBenchArea;
        document.querySelectorAll('.player-jersey, .token').forEach(el => el.remove());
        elements.availableList.innerHTML = '';
        const placedAthleteIds = new Set([...formationData.starters.map(p => String(p.athleteId)), ...formationData.bench.map(p => String(p.athleteId))]);
        const addExpiredIconIfNeeded = (athlete, jerseyElement) => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const isExpired = athlete.scadenzaVisita && new Date(athlete.scadenzaVisita) < today;
            if (isExpired) {
                const lockIcon = document.createElement('span'); lockIcon.innerHTML = '<i class="bi bi-lock-fill"></i>';
                lockIcon.style.cssText = 'position: absolute; top: 0; left: 0; color: white; background-color: var(--primary-red); padding: 0.2em 0.4em; border-radius: 50%; font-size: 1.5em;';
                lockIcon.title = 'Visita medica scaduta'; jerseyElement.appendChild(lockIcon);
            }
        };
        formationData.starters.forEach(playerData => {
            const athlete = athletes.find(a => String(a.id) === String(playerData.athleteId));
            if (athlete) { const jersey = createJerseyElement(athlete); addExpiredIconIfNeeded(athlete, jersey); jersey.style.left = `${playerData.left}%`; jersey.style.top = `${playerData.top}%`; field.appendChild(jersey); }
        });
        formationData.bench.forEach(playerData => {
            const athlete = athletes.find(a => String(a.id) === String(playerData.athleteId));
            if (athlete) { const jersey = createJerseyElement(athlete); addExpiredIconIfNeeded(athlete, jersey); jersey.style.left = `${playerData.left}%`; jersey.style.top = `${playerData.top}%`; bench.appendChild(jersey); }
        });
        athletes.forEach(athlete => {
            if (!placedAthleteIds.has(String(athlete.id))) {
                const today = new Date(); today.setHours(0, 0, 0, 0); const isExpired = athlete.scadenzaVisita && new Date(athlete.scadenzaVisita) < today;
                const availablePlayer = document.createElement('div'); availablePlayer.className = 'list-group-item d-flex justify-content-between align-items-center available-player p-2'; availablePlayer.dataset.athleteId = athlete.id;
                
                // Colore diverso se ospite
                if (athlete.isGuest) {
                     availablePlayer.style.backgroundColor = 'var(--guest-green)';
                }

                if (isExpired) { availablePlayer.classList.add('disabled'); availablePlayer.title = 'Visita medica scaduta. Atleta non schierabile.'; availablePlayer.innerHTML = `<span><strong>${athlete.number}.</strong> ${athlete.name}</span><span class="badge bg-danger"><i class="bi bi-lock-fill"></i></span>`; }
                else { availablePlayer.innerHTML = `<span><strong>${athlete.number}.</strong> ${athlete.name}</span><span class="badge bg-secondary">${athlete.role.substring(0,3)}</span>`; }
                elements.availableList.appendChild(availablePlayer);
            }
        });
        formationData.tokens.forEach(tokenData => { const tokenEl = createTokenElement(tokenData.type, tokenData.id); tokenEl.style.left = `${tokenData.left}%`; tokenEl.style.top = `${tokenData.top}%`; field.appendChild(tokenEl); });
    };
    const updateHomePage = () => {
        // --- MODIFICA: Filtra ospiti dal conteggio ---
        elements.homeTotalAthletes.textContent = athletes.filter(a => !a.isGuest).length;
        
        const today = toLocalDateISO(new Date());
        const futureSessions = Object.entries(trainingSessions).filter(([date]) => date >= today).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB)).flatMap(([date, sessions]) => sessions.map(s => ({...s, date})));
        if (futureSessions.length > 0) {
            const nextSession = futureSessions[0];
            const sessionDate = new Date(nextSession.date);
            elements.homeNextSession.innerHTML = `<h5 class="card-title text-muted">PROSSIMA SESSIONE</h5><h6 class="mb-1">${nextSession.title}</h6><p class="mb-0">${sessionDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p><p class="mb-0 text-muted">${nextSession.time ? `Ore: ${nextSession.time}` : ''} ${nextSession.location ? `@ ${nextSession.location}` : ''}</p>`;
        } else {
            elements.homeNextSession.innerHTML = `<h5 class="card-title text-muted">PROSSIMA SESSIONE</h5><p class="text-muted">Nessuna sessione pianificata</p>`;
        }
        const now = new Date(); const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; const monthlyScores = {}; athletes.forEach(a => monthlyScores[a.id] = { name: a.name, score: 0 }); Object.entries(evaluations).forEach(([dateStr, dailyEvals]) => { if (dateStr.startsWith(currentMonthStr)) { Object.entries(dailyEvals).forEach(([athleteId, evaluation]) => { if (monthlyScores[athleteId]) { monthlyScores[athleteId].score += calculateAthleteScore(evaluation); } }); } }); const sortedAthletes = Object.values(monthlyScores).sort((a, b) => b.score - a.score); if (sortedAthletes.length > 0 && sortedAthletes[0].score > 0) { const maxScore = sortedAthletes[0].score; const topPerformers = sortedAthletes.filter(athlete => athlete.score === maxScore); const names = topPerformers.map(p => p.name).join('<br>'); elements.homeTopPerformer.innerHTML = `<h5 class="card-title text-muted">TOP PERFORMER MENSILE</h5><h6 class="mb-1">${names}</h6><p class="mb-0 text-muted">Punteggio: ${maxScore}</p><i class="bi bi-trophy-fill mt-2" style="font-size: 1.5rem; color: var(--gold-star);"></i>`; }
        else { elements.homeTopPerformer.innerHTML = `<h5 class="card-title text-muted">TOP PERFORMER MENSILE</h5><p class="text-muted">Nessuna valutazione</p>`; }
    };
    const renderAthletes = () => {
        elements.athleteGrid.innerHTML = '';
        const today = new Date(); today.setHours(0,0,0,0);
        const threeMonths = new Date(today); threeMonths.setMonth(today.getMonth() + 3);
        athletes.forEach(athlete => {
            let statusIcon = '';
            if (athlete.scadenzaVisita) {
                const deadline = new Date(athlete.scadenzaVisita);
                const bookingDate = athlete.dataPrenotazioneVisita ? new Date(athlete.dataPrenotazioneVisita) : null;
                if (deadline < today) {
                    statusIcon = `<i class="bi bi-circle-fill text-danger deadline-status" title="Scaduta il ${deadline.toLocaleDateString('it-IT')}"></i>`;
                } else if (bookingDate) {
                    statusIcon = `<i class="bi bi-circle-fill text-purple deadline-status" title="Prenotata per il ${bookingDate.toLocaleDateString('it-IT')}"></i>`;
                } else if (deadline <= threeMonths) {
                    statusIcon = `<i class="bi bi-circle-fill text-warning deadline-status" title="Scade il ${deadline.toLocaleDateString('it-IT')}"></i>`;
                } else {
                    statusIcon = `<i class="bi bi-circle-fill text-success deadline-status" title="Scade il ${deadline.toLocaleDateString('it-IT')}"></i>`;
                }
            }
            const card = document.createElement('div');
            card.className = 'col-xl-3 col-lg-4 col-md-6 mb-4';
            const vcIcon = athlete.isViceCaptain ? '<i class="bi bi-star-half text-warning is-vice-captain"></i>' : '';
            
            // --- MODIFICA: Applica classe guest-mode ---
            const guestClass = athlete.isGuest ? 'guest-mode' : '';
            
            card.innerHTML = `<div class="card athlete-card ${guestClass}"><div class="card-body athlete-card-clickable" data-athlete-id="${athlete.id}"><img src="${athlete.avatar || defaultAvatar}" onerror="this.src='${defaultAvatar}'" alt="${athlete.name}" class="athlete-avatar me-3"><div><h5 class="card-title">${athlete.name} ${athlete.isCaptain ? '<i class="bi bi-star-fill is-captain"></i>' : ''} ${vcIcon}</h5><p class="card-text text-muted">${athlete.role}</p></div><div class="shirt-number">${athlete.number}</div>${statusIcon}</div><div class="card-actions no-print"><button class="btn btn-sm btn-outline-light gps-btn" title="Dati Performance" data-athlete-id="${athlete.id}"><i class="bi bi-person-fill-gear"></i></button><button class="btn btn-sm btn-outline-light edit-btn" title="Modifica Atleta" data-athlete-id="${athlete.id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-light delete-btn" title="Elimina Atleta" data-athlete-id="${athlete.id}"><i class="bi bi-trash-fill"></i></button></div></div>`;
            elements.athleteGrid.appendChild(card);
        });
    };
    // ... resto funzioni ...
    const renderCalendar = () => {
        elements.calendarGrid.innerHTML = '';
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        elements.currentMonthYearEl.textContent = `${currentCalendarDate.toLocaleString('it-IT', { month: 'long' })} ${year}`;
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
        for (let i = 0; i < startDayOfWeek; i++) {
            elements.calendarGrid.innerHTML += `<div class="calendar-day other-month"></div>`;
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = toLocalDateISO(date);
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            if (dateString === toLocalDateISO(new Date())) {
                dayCell.classList.add('today');
            }
            dayCell.innerHTML = `<div class="calendar-day-header">${day}</div>`;
            if (trainingSessions[dateString]) {
                trainingSessions[dateString].forEach(session => {
                    const sessionEl = document.createElement('div');
                    sessionEl.className = 'calendar-session session-allenamento';
                    sessionEl.textContent = session.title;
                    sessionEl.dataset.sessionId = session.id;
                    sessionEl.dataset.date = dateString;
                    dayCell.appendChild(sessionEl);
                });
            }
            if (matchResults) {
                Object.values(matchResults).forEach(match => {
                    const matchDateNormalized = toLocalDateISO(match.date);
                    if (matchDateNormalized === dateString) {
                        const myTeamName = "GO Sport";
                        const opponentName = match.opponentName;
                        const location = match.location;
                        const time = match.time || '';
                        const venue = match.venue || '';
                        let label = `${location === 'home' ? '⚽' : '✈️'} ${opponentName}`;
                        if (time || venue) {
                            label += ` (${time || ''}${venue ? (time ? ' - ' : '') + venue : ''})`;
                        }
                        const matchEl = document.createElement('div');
                        matchEl.dataset.matchId = match.id;
                        const today = toLocalDateISO(new Date());
                        const isFuture = dateString > today;
                        const myScore = location === 'home' ? match.homeScore : match.awayScore;
                        const oppScore = location === 'home' ? match.awayScore : match.homeScore;
                        const hasScore = (myScore !== null && myScore !== undefined && myScore !== '') || (oppScore !== null && oppScore !== undefined && oppScore !== '');
                        if (isFuture && !hasScore) {
                            matchEl.className = 'calendar-session session-partita-futura';
                        } else {
                            matchEl.className = location === 'home' ? 'calendar-session session-partita-casa' : 'calendar-session session-partita-trasferta';
                        }
                        matchEl.textContent = label;
                        dayCell.appendChild(matchEl);
                    }
                });
            }
            elements.calendarGrid.appendChild(dayCell);
        }
    };
    const openSessionModal = (sessionData = null) => {
        elements.sessionForm.reset(); if(sessionData) { document.getElementById('sessionModalLabel').textContent = "Modifica Sessione"; document.getElementById('session-id').value = sessionData.id; document.getElementById('session-date').value = sessionData.date; document.getElementById('session-title').value = sessionData.title; document.getElementById('session-time').value = sessionData.time; document.getElementById('session-location').value = sessionData.location; document.getElementById('session-goals').value = sessionData.goals; document.getElementById('session-description').value = sessionData.description; elements.deleteSessionBtn.style.display = 'block'; } else { document.getElementById('sessionModalLabel').textContent = "Pianifica Sessione"; document.getElementById('session-id').value = ''; document.getElementById('session-date').valueAsDate = new Date(); elements.deleteSessionBtn.style.display = 'none'; } sessionModal.show();
    };
    const renderMatchResults = () => {
        elements.matchResultsContainer.innerHTML = '';
        const sortedMatches = Object.values(matchResults).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (sortedMatches.length === 0) {
            elements.matchResultsContainer.innerHTML = '<p class="text-muted">Nessun risultato inserito.</p>';
            return;
        }
        sortedMatches.forEach(match => {
            const myTeamName = "GO Sport";
            const homeTeamName = match.location === 'home' ? myTeamName : match.opponentName;
            const awayTeamName = match.location === 'away' ? myTeamName : match.opponentName;
            const myTeamScorers = match.scorers.map(s => { const athlete = athletes.find(a => String(a.id) === String(s.athleteId)); return athlete ? athlete.name.split(' ').pop() : ''; }).filter(name => name).join(', ');
            const myTeamAssists = match.assists.map(s => { const athlete = athletes.find(a => String(a.id) === String(s.athleteId)); return athlete ? athlete.name.split(' ').pop() : ''; }).filter(name => name).join(', ');
            const today = toLocalDateISO(new Date());
            const matchDate = toLocalDateISO(match.date);
            const isFuture = matchDate > today;
            const myScore = match.location === 'home' ? match.homeScore : match.awayScore;
            const oppScore = match.location === 'home' ? match.awayScore : match.homeScore;
            const hasScore = (myScore !== null && myScore !== undefined && myScore !== '') || (oppScore !== null && oppScore !== undefined && oppScore !== '');
            let cardClass = 'match-future';
            if (!isFuture || hasScore) {
                cardClass = match.location === 'home' ? 'match-home' : 'match-away';
            }
            const colDiv = document.createElement('div');
            colDiv.className = 'col-lg-4 col-md-6 mb-3';
            const cardContent = `<div class="card h-100 match-result-item ${cardClass}" data-match-id="${match.id}" style="cursor: pointer;"><div class="card-body p-2"><div class="d-flex justify-content-between"><small class="text-muted">${new Date(match.date).toLocaleDateString('it-IT', {day: '2-digit', month: 'short', year: 'numeric'})}</small><a href="#" class="no-print edit-match-btn" data-match-id="${match.id}"><i class="bi bi-pencil-fill"></i></a></div><div> ${homeTeamName} vs ${awayTeamName} <strong class="match-score ms-2">${match.homeScore ?? ''} - ${match.awayScore ?? ''}</strong></div>${myTeamScorers ? `<div class="scorers-list"><i class="bi bi-futbol"></i> Marcatori: <strong style="color: var(--primary-red);">${myTeamScorers}</strong></div>` : ''}${myTeamAssists ? `<div class="assists-list"><i class="bi bi-person-raised-hand"></i> Assists: <strong style="color: var(--primary-red);">${myTeamAssists}</strong></div>` : ''}</div></div>`;
            colDiv.innerHTML = cardContent;
            elements.matchResultsContainer.appendChild(colDiv);
            colDiv.querySelector('.match-result-item').addEventListener('click', (e) => { e.preventDefault(); if (!e.target.closest('.edit-match-btn')) { openMatchResultModal(match.id); } });
        });
    };
    // ... resto codice ...
    // --- GESTIONE ATLETA (Edit/Save) ---
    elements.athleteGrid.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            const athleteId = editBtn.dataset.athleteId;
            const athlete = athletes.find(a => a.id.toString() === athleteId);
            if (athlete) {
                document.getElementById('modal-athlete-id').value = athlete.id;
                document.getElementById('athlete-name').value = athlete.name;
                document.getElementById('athlete-role').value = athlete.role;
                document.getElementById('athlete-number').value = athlete.number;
                document.getElementById('scadenza-visita').value = athlete.scadenzaVisita || '';
                document.getElementById('prenotazione-visita').value = athlete.dataPrenotazioneVisita || '';
                document.getElementById('athlete-captain').checked = athlete.isCaptain || false;
                document.getElementById('athlete-vice-captain').checked = athlete.isViceCaptain || false;
                // --- MODIFICA: Carica stato Guest ---
                document.getElementById('athlete-guest').checked = athlete.isGuest || false;
                
                const preview = document.getElementById('avatar-preview');
                if (athlete.avatar) { preview.src = athlete.avatar; preview.style.display = 'block'; } else { preview.style.display = 'none'; }
                athleteModal.show();
            }
        }
        // ... (delete logic) ...
        else if (e.target.closest('.delete-btn')) { if (confirm(`Sei sicuro di voler eliminare?`)) { const id = e.target.closest('.delete-btn').dataset.athleteId; athletes = athletes.filter(a => a.id.toString() !== id); saveData(); updateAllUI(); } }
        else if (e.target.closest('.gps-btn')) { /* ...gps logic... */ }
    });

    elements.athleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const athleteId = document.getElementById('modal-athlete-id').value;
        const fileInput = document.getElementById('athlete-avatar-input');
        let avatarBase64 = document.getElementById('athlete-avatar-base64').value;
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            avatarBase64 = await new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(file); });
        }
        const existingAthlete = athleteId ? athletes.find(a => a.id.toString() === athleteId) : null;
        const athleteData = {
            id: athleteId || Date.now(),
            name: document.getElementById('athlete-name').value,
            role: document.getElementById('athlete-role').value,
            number: document.getElementById('athlete-number').value,
            isCaptain: document.getElementById('athlete-captain').checked,
            isViceCaptain: document.getElementById('athlete-vice-captain').checked,
            // --- MODIFICA: Salva Guest ---
            isGuest: document.getElementById('athlete-guest').checked,
            
            scadenzaVisita: document.getElementById('scadenza-visita').value,
            dataPrenotazioneVisita: document.getElementById('prenotazione-visita').value,
            avatar: avatarBase64 || (existingAthlete ? existingAthlete.avatar : '')
        };
        if (athleteId) {
            const index = athletes.findIndex(a => a.id.toString() === athleteId);
            if (index !== -1) athletes[index] = { ...athletes[index], ...athleteData };
        } else {
            athleteData.id = Date.now();
            athletes.push(athleteData);
        }
        saveData();
        updateAllUI();
        athleteModal.hide();
    });

    // ... Inizializzazione e Polling ...
    document.getElementById('prev-month-btn').addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month-btn').addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); });
    elements.addSessionBtn.addEventListener('click', () => openSessionModal());
    elements.quickAddAthleteBtn.addEventListener('click', () => elements.addAthleteBtn.click());
    elements.quickPlanSessionBtn.addEventListener('click', () => elements.addSessionBtn.click());
    elements.addAthleteBtn.addEventListener('click', () => {
        elements.athleteForm.reset();
        document.getElementById('modal-athlete-id').value = '';
        document.getElementById('avatar-preview').style.display = 'none';
        athleteModal.show();
    });
    
    // Polling per aggiornare i dati se modificati altrove
    function startPolling() {
        pollingInterval = setInterval(async () => {
            const currentDataSnapshot = JSON.stringify({ athletes, evaluations, gpsData, awards, trainingSessions, formationData, matchResults });
            await loadData();
            const newDataSnapshot = JSON.stringify({ athletes, evaluations, gpsData, awards, trainingSessions, formationData, matchResults });
            if (currentDataSnapshot !== newDataSnapshot) {
                console.log("Dati aggiornati dal server. Ricarico l'interfaccia.");
                updateAllUI();
            }
        }, 5000);
    }
    
    // Init
    loadData().then(() => {
        updateAllUI();
        startPolling();
    });

    // ... (Mantieni le funzioni Drag & Drop, Gps Chart, etc presenti nel tuo file originale)
    // Per brevità ho omesso le parti non toccate ma nel file script.js finale DEVONO ESSERCI.
    // Assicurati di copiare il resto delle funzioni (Drag&Drop, Charts) dal tuo file script.js originale se non le hai modificate.
});