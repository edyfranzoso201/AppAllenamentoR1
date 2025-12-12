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
    modalsContainer.innerHTML = `<div class="modal fade" id="evaluationModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Valutazione di <span id="modal-athlete-name-eval"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="evaluation-form"><input type="hidden" id="modal-athlete-id-eval"><p>Data: <strong id="modal-evaluation-date"></strong></p><div class="mb-2"><label class="form-label">Presenza Allenamento</label><select id="presenza-allenamento" class="form-select"><option value="-1">Assenza Giustificata</option><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Serietà Allenamento</label><select id="serieta-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Allenamento</label><select id="abbigliamento-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Partita</label><select id="abbigliamento-partita" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Serietà Comunicazioni</label><select id="comunicazioni" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Doccia (Opzionale)</label><select id="doccia" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="award-checkbox"><label class="form-check-label" for="award-checkbox">Assegna Premio</label></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-single-athlete-day-btn">Elimina Dati del Giorno</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="evaluation-form">Salva Valutazione</button></div></div></div></div></div> <div class="modal fade" id="athleteModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="athleteModalLabel">Gestisci Atleta</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="athlete-form"><input type="hidden" id="modal-athlete-id"><div class="mb-3"><label class="form-label">Nome Cognome</label><input type="text" class="form-control" id="athlete-name" required></div><div class="mb-3"><label for="athlete-avatar-input" class="form-label">Foto Profilo</label><input type="file" class="form-control" id="athlete-avatar-input" accept="image/*"><input type="hidden" id="athlete-avatar-base64"><img id="avatar-preview" src="" alt="Anteprima" class="mt-2" style="max-width: 70px; max-height: 70px; display: none; border-radius: 50%;"></div><div class="mb-3"><label class="form-label">Ruolo</label><input type="text" class="form-control" id="athlete-role" required></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Numero Maglia</label><input type="number" class="form-control" id="athlete-number" required min="1"></div><div class="col-md-6 mb-3"><label class="form-label">Scadenza Visita Medica</label><input type="date" class="form-control" id="scadenza-visita"></div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Data Prenotazione Visita</label><input type="date" class="form-control" id="prenotazione-visita"></div></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-captain"><label class="form-label" for="athlete-captain">Capitano</label></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-vice-captain"><label class="form-label" for="athlete-vice-captain">Vice Capitano</label></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-guest"><label class="form-label" for="athlete-guest">Atleta Ospite (non in rosa)</label></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="athlete-form">Salva Atleta</button></div></div></div></div> <div class="modal fade" id="gpsModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="gpsModalLabel">Dati Performance di <span id="modal-athlete-name-gps"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="gps-form"><input type="hidden" id="modal-athlete-id-gps"><input type="hidden" id="gps-session-id"> <div class="row mb-3"><div class="col-md-8"><label for="gps-session-selector" class="form-label">Seleziona Sessione Esistente per Modificare</label><select id="gps-session-selector" class="form-select"><option value="">--- Inserisci Nuova Sessione ---</option></select></div><div class="col-md-4 d-flex align-items-end"><button type="button" id="delete-gps-session-btn" class="btn btn-outline-danger w-100" disabled>Elimina Sessione</button></div></div><hr> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Registrazione</label><input type="date" class="form-control" id="gps-data_di_registrazione" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Registrazione</label><input type="time" class="form-control" id="gps-ora_registrazione"></div><div class="col-md-4 mb-3"><label class="form-label">Tipo Sessione</label><select class="form-select" id="gps-tipo_sessione"><option value="Allenamento">Allenamento</option><option value="Partita">Partita</option><option value="Individual">Individual</option></select></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Distanza Totale (m)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_totale" placeholder="es. 10500"></div><div class="col-md-4 mb-3"><label class="form-label">Tempo Totale (min)</label><input type="number" step="0.1" class="form-control" id="gps-tempo_totale" placeholder="es. 92"></div><div class="col-md-4 mb-3"><label class="form-label">Distanza per Minuto (m/min)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_per_minuto" readonly></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Distanza Sprint (m)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_sprint"></div><div class="col-md-4 mb-3"><label class="form-label">Velocità Massima (km/h)</label><input type="number" step="0.1" class="form-control" id="gps-velocita_massima"></div><div class="col-md-4 mb-3"><label class="form-label">Numero di Sprint</label><input type="number" class="form-control" id="gps-numero_di_sprint"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Max Acc (g)o(n°)</label><input type="number" step="0.1" class="form-control" id="gps-max_acc"></div><div class="col-md-4 mb-3"><label class="form-label">Max Dec (g)o(n°)</label><input type="number" step="0.1" class="form-control" id="gps-max_dec"></div><div class="col-md-4 mb-3"><label class="form-label">Passaggi Piede Sinistro</label><input type="number" class="form-control" id="gps-passaggi_piede_sinistro"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Passaggi Piede Destro</label><input type="number" class="form-control" id="gps-passaggi_piede_destro"></div><div class="col-md-4 mb-3"><label class="form-label">Cross Piede Sinistro</label><input type="number" step="0.1" class="form-control" id="gps-cross_piede_sinistro"></div><div class="col-md-4 mb-3"><label class="form-label">Cross Piede Destro</label><input type="number" step="0.1" class="form-control" id="gps-cross_piede_destro"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Potenza Massima di Tiro (km/h)</label><input type="number" step="0.1" class="form-control" id="gps-potenza_massima_di_tiro"></div><div class="col-md-4 mb-3"><label class="form-label">Tiri Piede SX</label><input type="number" class="form-control" id="gps-tiri_piede_sx"></div><div class="col-md-4 mb-3"><label class="form-label">Tiri Piede DX</label><input type="number" class="form-control" id="gps-tiri_piede_dx"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">% Passaggi Brevi</label><input type="number" step="0.1" class="form-control" id="gps-perc_passaggi_brevi"></div><div class="col-md-4 mb-3"><label class="form-label">% Lanci</label><input type="number" step="0.1" class="form-control" id="gps-perc_lanci"></div><div class="col-md-4 mb-3"><label class="form-label">Distanza Circuito (m)</label><input type="number" step="1" class="form-control" id="gps-distanza_circuito" placeholder="es. 400"></div></div> <div class="row align-items-end"><div class="col-md-5 mb-3"><label class="form-label">Tempo Circuito</label><div class="input-group"><input type="number" class="form-control" id="gps-tempo_circuito_min" placeholder="Min" min="0"><span class="input-group-text">:</span><input type="number" class="form-control" id="gps-tempo_circuito_sec" placeholder="Sec" min="0" max="59"><span class="input-group-text">.</span><input type="number" class="form-control" id="gps-tempo_circuito_cen" placeholder="Cen" min="0" max="99"></div></div><div class="col-md-4 mb-3"><label class="form-label">Velocità (km/h)</label><input type="text" class="form-control" id="gps-velocita_circuito" readonly></div></div> <div id="match-stats-fields" style="display: none;"><hr><h5 class="mb-3">Statistiche Partita</h5><div class="row"><div class="col-md-3 mb-3"><label class="form-label">Minuti Giocati</label><input type="number" class="form-control" id="gps-minuti_giocati"></div><div class="col-md-3 mb-3"><label class="form-label">Gol</label><input type="number" class="form-control" id="gps-gol"></div><div class="col-md-3 mb-3"><label class="form-label">Assist</label><input type="number" class="form-control" id="gps-assist"></div><div class="col-md-3 mb-3"><label class="form-label">Ammonizioni</label><input type="number" class="form-control" id="gps-ammonizioni"></div></div><div class="row"><div class="col-md-3 mb-3"><label class="form-label">Espulsioni</label><input type="number" class="form-control" id="gps-espulsioni"></div><div class="col-md-3 mb-3"><label class="form-label">Palle Recuperate</label><input type="number" class="form-control" id="gps-palle_recuperate"></div><div class="col-md-3 mb-3"><label class="form-label">Palle Perse</label><input type="number" class="form-control" id="gps-palle_perse"></div></div></div> <div class="row"><div class="col-12 mb-3"><label class="form-label">Note (opzionale)</label><textarea class="form-control" id="gps-note" rows="2" placeholder="Es. Allenamento intenso, recupero infortunio, ecc."></textarea></div></div> </form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="gps-form">Salva Dati GPS</button></div></div></div></div> <div class="modal fade" id="sessionModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="sessionModalLabel">Pianifica Sessione</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="session-form"><input type="hidden" id="session-id"><div class="mb-3"><label class="form-label">Data</label><input type="date" class="form-control" id="session-date" required></div><div class="mb-3"><label class="form-label">Titolo/Tipo</label><input type="text" class="form-control" id="session-title" required placeholder="Es. Allenamento tecnico"></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Ora Inizio</label><input type="time" class="form-control" id="session-time"></div><div class="col-md-6 mb-3"><label class="form-label">Luogo</label><input type="text" class="form-control" id="session-location" placeholder="Es. Campo 1"></div></div><div class="mb-3"><label class="form-label">Obiettivi</label><input type="text" class="form-control" id="session-goals" placeholder="Es. Possesso palla, tiri in porta"></div><div class="mb-3"><label class="form-label">Descrizione Allenamento (un punto per riga)</label><textarea class="form-control" id="session-description" rows="5"></textarea></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-session-btn" style="display:none;">Elimina</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="session-form">Salva Sessione</button></div></div></div></div></div> <div class="modal fade" id="matchResultModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="matchResultModalLabel">Inserisci Risultato Partita</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="match-result-form"><input type="hidden" id="match-id"><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Partita</label><input type="date" class="form-control" id="match-date" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Partita</label><input type="time" class="form-control" id="match-time"></div><div class="col-md-4 mb-3"><label class="form-label">Luogo Fisico</label><input type="text" class="form-control" id="match-venue" placeholder="Es. Stadio Comunale"></div></div><div class="row"><div class="col-md-5 mb-3"><label class="form-label">Squadra Avversaria</label><input type="text" class="form-control" id="match-opponent-name" required></div><div class="col-md-3 mb-3"><label class="form-label">Luogo</label><select class="form-select" id="match-location"><option value="home">Casa</option><option value="away">Trasferta</option></select></div></div><div class="row align-items-center text-center"><div class="col-5"><label class="form-label">GO Sport</label><input type="number" class="form-control text-center" id="match-my-team-score" min="0" placeholder="Gol"></div><div class="col-2">-</div><div class="col-5"><label class="form-label">AVVERSARI</label><input type="number" class="form-control text-center" id="match-opponent-score" min="0" placeholder="Gol"></div></div><hr><div class="row mt-3"><div class="col-md-4"><h5><i class="bi bi-futbol"></i> Marcatori (GO Sport)</h5><div id="scorers-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-scorer-btn"><i class="bi bi-plus"></i> Aggiungi Marcatore</button></div><div class="col-md-4"><h5><i class="bi bi-person-raised-hand"></i> Assists (GO Sport)</h5><div id="assists-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-assist-btn"><i class="bi bi-plus"></i> Aggiungi Assist</button></div><div class="col-md-4"><h5><i class="bi bi-file-earmark-person"></i> Cartellini (GO Sport)</h5><div id="cards-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-card-btn"><i class="bi bi-plus"></i> Aggiungi Cartellino</button></div></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-match-btn" style="display:none;">Elimina Partita</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="match-result-form">Salva Partita</button></div></div></div></div></div> <div class="modal fade" id="passwordModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Accesso Richiesto</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><p>Per visualizzare questi dati è richiesta una password.</p><form id="password-form"><div class="mb-3"><label for="password-input" class="form-label">Password</label><input type="password" class="form-control" id="password-input" required><div id="password-error" class="text-danger mt-2" style="display: none;">Password non corretta.</div></div><button type="submit" class="btn btn-primary-custom w-100">Accedi</button></form></div></div></div></div>`;
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
    let comparisonChartPeriod = 'annual';
    let attendanceChartPeriod = 'annual';
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
                // Migrazione dalla vecchia proprietà "guest" alla nuova "isGuest"
                if (athlete.guest !== undefined && athlete.isGuest === undefined) {
                    athlete.isGuest = athlete.guest;
                    delete athlete.guest;
                }
                if (athlete.isGuest === undefined) athlete.isGuest = false;
            });
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
    const calculateAthleteScore = (evaluation) => !evaluation ? 0 : Object.keys(evaluation).filter(k => k !== 'doccia').reduce((sum, key) => sum + parseInt(evaluation[key] || 0, 10), 0);
    const updateLogoutButtonVisibility = () => { elements.logoutBtn.style.display = isAuthenticated() ? 'block' : 'none'; };
    const updateUnlockButtonsVisibility = () => {
        const unlockBtns = document.querySelectorAll('.unlock-btn');
        const displayStyle = isAuthenticated() ? 'none' : 'inline-block';
        unlockBtns.forEach(btn => btn.style.display = displayStyle);
    };
    const updateTeamSeasonStats = () => {
        let pg = 0, v = 0, p = 0, s = 0, gf = 0, gs = 0;
        
        // Filtro solo le partite con risultato effettivo (esclude partite future senza risultato)
        Object.values(matchResults)
            .filter(match => {
                const myScore = match.location === 'home' ? match.homeScore : match.awayScore;
                const oppScore = match.location === 'home' ? match.awayScore : match.homeScore;
                // La partita è valida se almeno un punteggio è un numero (anche 0)
                return (typeof myScore === 'number' && !isNaN(myScore)) || (typeof oppScore === 'number' && !isNaN(oppScore));
            })
            .forEach(match => {
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
        jersey.dataset.athleteId = athlete.id;
        jersey.dataset.role = athlete.role;
        const jerseyColor = athlete.role.toLowerCase().includes('portiere') ? 'var(--gk-color)' : 'var(--secondary-blue)';
        jersey.innerHTML = `<div class="jersey-body" style="background-color: ${jerseyColor};"><span class="jersey-number">${athlete.number}</span></div><span class="player-name">${athlete.name}</span>`;
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
                if (isExpired) { availablePlayer.classList.add('disabled'); availablePlayer.title = 'Visita medica scaduta. Atleta non schierabile.'; availablePlayer.innerHTML = `<span><strong>${athlete.number}.</strong> ${athlete.name}</span><span class="badge bg-danger"><i class="bi bi-lock-fill"></i></span>`; }
                else { availablePlayer.innerHTML = `<span><strong>${athlete.number}.</strong> ${athlete.name}</span><span class="badge bg-secondary">${athlete.role.substring(0,3)}</span>`; }
                elements.availableList.appendChild(availablePlayer);
            }
        });
        formationData.tokens.forEach(tokenData => { const tokenEl = createTokenElement(tokenData.type, tokenData.id); tokenEl.style.left = `${tokenData.left}%`; tokenEl.style.top = `${tokenData.top}%`; field.appendChild(tokenEl); });
    };
    const updateHomePage = () => {
        // ✅ Conta solo atleti NON ospiti nel conteggio principale
        const officialAthletes = athletes.filter(a => !a.isGuest);
        elements.homeTotalAthletes.textContent = officialAthletes.length;
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
            // ✅ Classe condizionale per atleti ospiti
            const cardClass = athlete.isGuest ? 'athlete-card guest-athlete' : 'athlete-card';
            const vcIcon = athlete.isViceCaptain ? '<i class="bi bi-star-half text-warning is-vice-captain"></i>' : '';
            card.innerHTML = `<div class="card ${cardClass}"><div class="card-body athlete-card-clickable" data-athlete-id="${athlete.id}"><img src="${athlete.avatar || defaultAvatar}" onerror="this.src='${defaultAvatar}'" alt="${athlete.name}" class="athlete-avatar me-3"><div><h5 class="card-title">${athlete.name} ${athlete.isCaptain ? '<i class="bi bi-star-fill is-captain"></i>' : ''} ${vcIcon}</h5><p class="card-text text-muted">${athlete.role}</p></div><div class="shirt-number">${athlete.number}</div>${statusIcon}</div><div class="card-actions no-print"><button class="btn btn-sm btn-outline-light gps-btn" title="Dati Performance" data-athlete-id="${athlete.id}"><i class="bi bi-person-fill-gear"></i></button><button class="btn btn-sm btn-outline-light edit-btn" title="Modifica Atleta" data-athlete-id="${athlete.id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-light delete-btn" title="Elimina Atleta" data-athlete-id="${athlete.id}"><i class="bi bi-trash-fill"></i></button></div></div>`;
            elements.athleteGrid.appendChild(card);
        });
    };
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
                        const hasScore = (myScore !== null && myScore !== undefined && myScore !== '') ||
                                        (oppScore !== null && oppScore !== undefined && oppScore !== '');
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
            const myTeamScorers = match.scorers.map(s => {
                const athlete = athletes.find(a => String(a.id) === String(s.athleteId));
                return athlete ? athlete.name.split(' ').pop() : '';
            }).filter(name => name).join(', ');
            const myTeamAssists = match.assists.map(s => {
                const athlete = athletes.find(a => String(a.id) === String(s.athleteId));
                return athlete ? athlete.name.split(' ').pop() : '';
            }).filter(name => name).join(', ');
            const today = toLocalDateISO(new Date());
            const matchDate = toLocalDateISO(match.date);
            const isFuture = matchDate > today;
            const myScore = match.location === 'home' ? match.homeScore : match.awayScore;
            const oppScore = match.location === 'home' ? match.awayScore : match.homeScore;
            const hasScore = (myScore !== null && myScore !== undefined && myScore !== '') ||
                            (oppScore !== null && oppScore !== undefined && oppScore !== '');
            let cardClass = 'match-future';
            if (!isFuture || hasScore) {
                cardClass = match.location === 'home' ? 'match-home' : 'match-away';
            }
            const colDiv = document.createElement('div');
            colDiv.className = 'col-lg-4 col-md-6 mb-3';
            const cardContent = `
                <div class="card h-100 match-result-item ${cardClass}" data-match-id="${match.id}" style="cursor: pointer;">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between">
                            <small class="text-muted">${new Date(match.date).toLocaleDateString('it-IT', {day: '2-digit', month: 'short', year: 'numeric'})}</small>
                            <a href="#" class="no-print edit-match-btn" data-match-id="${match.id}"><i class="bi bi-pencil-fill"></i></a>
                        </div>
                        <div> ${homeTeamName} vs ${awayTeamName} <strong class="match-score ms-2">${match.homeScore ?? ''} - ${match.awayScore ?? ''}</strong></div>
                        ${myTeamScorers ? `<div class="scorers-list"><i class="bi bi-futbol"></i> Marcatori: <strong style="color: var(--primary-red);">${myTeamScorers}</strong></div>` : ''}
                        ${myTeamAssists ? `<div class="assists-list"><i class="bi bi-person-raised-hand"></i> Assists: <strong style="color: var(--primary-red);">${myTeamAssists}</strong></div>` : ''}
                    </div>
                </div>`;
            colDiv.innerHTML = cardContent;
            elements.matchResultsContainer.appendChild(colDiv);
            colDiv.querySelector('.match-result-item').addEventListener('click', (e) => {
                e.preventDefault();
                if (!e.target.closest('.edit-match-btn')) {
                    openMatchResultModal(match.id);
                }
            });
        });
    };
    const renderCardsSummary = () => {
        elements.cardsSummaryTbody.innerHTML = '';
        const allCards = Object.values(matchResults).flatMap((match) => match.cards.map((card, cardIndex) => ({ ...card, date: match.date, uniqueId: `${match.id}-${cardIndex}` }))).sort((a, b) => new Date(b.date) - new Date(a.date));
        let renderedRows = 0;
        allCards.forEach(card => {
            if (visuallyDeletedCards.includes(card.uniqueId)) { return; }
            const athlete = athletes.find(a => String(a.id) === String(card.athleteId));
            const row = document.createElement('tr');
            row.innerHTML = `<td>${athlete ? athlete.name : 'N/D'}</td><td>${card.type === 'yellow' ? '1' : '0'}</td><td>${card.type === 'red' ? '1' : '0'}</td><td>${new Date(card.date).toLocaleDateString('it-IT', {day: '2-digit', month: 'short'})}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger py-0 px-1 remove-card-summary-row-btn" data-card-id="${card.uniqueId}"><i class="bi bi-x-lg"></i></button></td>`;
            elements.cardsSummaryTbody.appendChild(row);
            renderedRows++;
        });
        if (renderedRows === 0) {
            elements.cardsSummaryTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nessun cartellino da mostrare.</td></tr>';
        }
    };
    const renderTopScorers = () => {
        const goalCounts = {};
        Object.values(matchResults).forEach(match => {
            match.scorers.forEach(scorer => {
                goalCounts[scorer.athleteId] = (goalCounts[scorer.athleteId] || 0) + 1;
            });
        });
        const sortedScorers = Object.entries(goalCounts).map(([athleteId, goals]) => {
            const athlete = athletes.find(a => String(a.id) === athleteId);
            return { name: athlete ? athlete.name : 'Sconosciuto', goals };
        }).sort((a, b) => b.goals - a.goals);
        if (sortedScorers.length === 0) {
            elements.topScorersContainer.innerHTML = '<p class="text-muted">Nessun marcatore registrato.</p>';
            return;
        }
        let ol = '<ol class="list-group list-group-numbered">';
        sortedScorers.forEach(scorer => {
            ol += `<li class="list-group-item d-flex justify-content-between align-items-center" style="background: transparent; border-color: var(--border-color);">${scorer.name}<span class="badge bg-danger rounded-pill">${scorer.goals}</span></li>`;
        });
        ol += '</ol>';
        elements.topScorersContainer.innerHTML = ol;
    };
    const renderTopAssists = () => {
        const assistCounts = {};
        Object.values(matchResults).forEach(match => {
            match.assists.forEach(assist => {
                assistCounts[assist.athleteId] = (assistCounts[assist.athleteId] || 0) + 1;
            });
        });
        const sortedAssists = Object.entries(assistCounts).map(([athleteId, assists]) => {
            const athlete = athletes.find(a => String(a.id) === athleteId);
            return { name: athlete ? athlete.name : 'Sconosciuto', assists };
        }).sort((a, b) => b.assists - a.assists);
        if (sortedAssists.length === 0) {
            elements.topAssistsContainer.innerHTML = '<p class="text-muted">Nessun assist registrato.</p>';
            return;
        }
        let ol = '<ol class="list-group list-group-numbered">';
        sortedAssists.forEach(assist => {
            ol += `<li class="list-group-item d-flex justify-content-between align-items-center" style="background: transparent; border-color: var(--border-color);">${assist.name}<span class="badge bg-primary rounded-pill">${assist.assists}</span></li>`;
        });
        ol += '</ol>';
        elements.topAssistsContainer.innerHTML = ol;
    };
    const updateMatchAnalysisChart = () => {
        const opponentFilter = elements.matchOpponentFilter.value;
        const period = elements.matchPeriodToggle.querySelector('.active').dataset.period;
        
        // Filtro solo le partite con risultato effettivo (esclude partite future senza risultato)
        let filteredMatches = Object.values(matchResults)
            .filter(m => {
                // Considero una partita come "giocata" solo se almeno uno dei punteggi è definito e diverso da null
                const myScore = m.location === 'home' ? m.homeScore : m.awayScore;
                const oppScore = m.location === 'home' ? m.awayScore : m.homeScore;
                // La partita è valida se almeno un punteggio è un numero (anche 0)
                return (typeof myScore === 'number' && !isNaN(myScore)) || (typeof oppScore === 'number' && !isNaN(oppScore));
            })
            .sort((a,b) => new Date(a.date) - new Date(b.date));
            
        let labels, datasets;
        if (opponentFilter !== 'all') {
            elements.matchPeriodToggle.style.display = 'none';
            filteredMatches = filteredMatches.filter(m => m.opponentName === opponentFilter);
            labels = filteredMatches.map(m => new Date(m.date).toLocaleDateString('it-IT', {day:'2-digit', month:'short'}));
            datasets = [
                { label: 'Vittorie', data: [], backgroundColor: '#d90429' },
                { label: 'Pareggi', data: [], backgroundColor: '#1e5095' },
                { label: 'Sconfitte', data: [], backgroundColor: '#6c757d' },
            ];
            filteredMatches.forEach(match => {
                const myScore = match.location === 'home' ? match.homeScore : match.awayScore;
                const oppScore = match.location === 'home' ? match.awayScore : match.homeScore;
                datasets[0].data.push(myScore > oppScore ? 1 : 0);
                datasets[1].data.push(myScore == oppScore ? 1 : 0);
                datasets[2].data.push(myScore < oppScore ? 1 : 0);
            });
        } else {
            elements.matchPeriodToggle.style.display = 'flex';
            const getPeriodKey = (date, period) => {
                const d = new Date(date);
                const year = d.getFullYear();
                const month = d.getMonth();
                if (period === 'annual') return `${year}`;
                if (period === 'semester') return `${year}-S${Math.floor(month / 6) + 1}`;
                if (period === 'trimester') return `${year}-T${Math.floor(month / 3) + 1}`;
                if (period === 'bimonthly') return `${year}-B${Math.floor(month / 2) + 1}`;
                return `${year}-${String(month + 1).padStart(2, '0')}`;
            };
            const resultsByPeriod = {};
            filteredMatches.forEach(match => {
                const key = getPeriodKey(match.date, period);
                if (!resultsByPeriod[key]) { resultsByPeriod[key] = { W: 0, D: 0, L: 0 }; }
                const myScore = match.location === 'home' ? match.homeScore : match.awayScore;
                const oppScore = match.location === 'home' ? match.awayScore : match.homeScore;
                if (myScore > oppScore) resultsByPeriod[key].W++;
                else if (myScore < oppScore) resultsByPeriod[key].L++;
                else resultsByPeriod[key].D++;
            });
            labels = Object.keys(resultsByPeriod).sort();
            datasets = [
                { label: 'Vittorie', data: labels.map(l => resultsByPeriod[l].W), backgroundColor: '#d90429' },
                { label: 'Pareggi', data: labels.map(l => resultsByPeriod[l].D), backgroundColor: '#1e5095' },
                { label: 'Sconfitte', data: labels.map(l => resultsByPeriod[l].L), backgroundColor: '#6c757d' },
            ];
        }
        const data = { labels, datasets };
        if (chartInstances.matchResults) chartInstances.matchResults.destroy();
        chartInstances.matchResults = new Chart(document.getElementById('matchResultsChart').getContext('2d'), {
            type: 'bar',
            data: data,
            options: {
                scales: {
                    x: { stacked: true, ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } },
                    y: { stacked: true, ticks: { color: '#ffffff', stepSize: 1 }, grid: { color: 'rgba(241, 241, 241, 0.2)' } }
                },
                plugins: { legend: { labels: { color: '#ffffff' } } }
            }
        });
        const opponents = [...new Set(Object.values(matchResults).map(m => m.opponentName))];
        elements.matchOpponentFilter.innerHTML = `<option value="all">Tutti gli avversari</option>`;
        opponents.sort().forEach(opp => {
            const selected = opp === opponentFilter ? 'selected' : '';
            elements.matchOpponentFilter.innerHTML += `<option value="${opp}" ${selected}>${opp}</option>`;
        });
    };
    const updateEvaluationCharts = () => {
        const date = elements.evaluationDatePicker.value;
        if (!date) return;
        const last7Days = Array.from({length: 7}, (_, i) => toLocalDateISO(new Date(Date.now() - i * 864e5))).reverse();
        const teamDailyAvgScores = last7Days.map(d => {
            let total = 0, count = 0;
            if (evaluations[d]) {
                Object.values(evaluations[d]).forEach(ev => {
                    total += calculateAthleteScore(ev);
                    count++;
                });
            }
            return count > 0 ? (total / count).toFixed(2) : 0;
        });
        if(chartInstances.dailyTeam) chartInstances.dailyTeam.destroy();
        chartInstances.dailyTeam = new Chart(document.getElementById('dailyTeamChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: last7Days.map(d => new Date(d).toLocaleDateString('it-IT', {day:'2-digit', month:'short'})),
                datasets: [{
                    label: 'Punteggio Medio',
                    data: teamDailyAvgScores,
                    borderColor: 'rgba(217, 4, 41, 1)',
                    backgroundColor: 'rgba(217, 4, 41, 0.2)',
                    tension: 0.3
                }]
            },
            options: {
                scales: {
                    y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } },
                    x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } }
                },
                plugins: { legend: { labels: { color: '#ffffff' } } }
            }
        });
        const scores = {};
        athletes.forEach(a => scores[String(a.id)] = { name: a.name, score: 0 });
        if (comparisonChartPeriod === 'daily') {
            if(evaluations[date]) {
                Object.entries(evaluations[date]).forEach(([id, ev]) => {
                    if(scores[id]) scores[id].score += calculateAthleteScore(ev);
                });
            }
        } else if (comparisonChartPeriod === 'monthly') {
            const month = date.substring(0, 7);
            Object.keys(evaluations).filter(d => d.startsWith(month)).forEach(d => {
                Object.entries(evaluations[d]).forEach(([id, ev]) => {
                    if(scores[id]) scores[id].score += calculateAthleteScore(ev);
                });
            });
        } else if (comparisonChartPeriod === 'semester') {
            const year = date.substring(0, 4);
            const month = parseInt(date.substring(5, 7), 10);
            const semesterStartMonth = month <= 6 ? '01' : '07';
            const semesterEndMonth = month <= 6 ? '12' : '12';
            const startDate = `${year}-${semesterStartMonth}-01`;
            const endDate = `${year}-${semesterEndMonth}-31`;
            Object.keys(evaluations).filter(d => d >= startDate && d <= endDate).forEach(d => {
                Object.entries(evaluations[d]).forEach(([id, ev]) => {
                    if(scores[id]) scores[id].score += calculateAthleteScore(ev);
                });
            });
        } else if (comparisonChartPeriod === 'annual') {
            const year = date.substring(0, 4);
            Object.keys(evaluations).filter(d => d.startsWith(year)).forEach(d => {
                Object.entries(evaluations[d]).forEach(([id, ev]) => {
                    if(scores[id]) scores[id].score += calculateAthleteScore(ev);
                });
            });
        } else {
            const week = getWeekRange(date);
            Object.keys(evaluations).filter(d => d >= week.start && d <= week.end).forEach(d => {
                Object.entries(evaluations[d]).forEach(([id, ev]) => {
                    if(scores[id]) scores[id].score += calculateAthleteScore(ev);
                });
            });
        }
        const allSortedScores = Object.values(scores).filter(a => a.score > 0).sort((a, b) => b.score - a.score);
        let scoresToShow = allSortedScores;
        if (allSortedScores.length > 20) {
            const cutoffScore = allSortedScores[19].score;
            scoresToShow = allSortedScores.filter(a => a.score >= cutoffScore);
        }
        if(chartInstances.monthlyComparison) chartInstances.monthlyComparison.destroy();
        chartInstances.monthlyComparison = new Chart(document.getElementById('monthlyComparisonChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: scoresToShow.map(a=>a.name),
                datasets: [{
                    label: 'Punteggio Totale',
                    data: scoresToShow.map(a=>a.score),
                    backgroundColor: 'rgba(217, 4, 41, 0.8)'
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    y: { ticks: { color: '#ffffff', font: { size: 9 }, autoSkip: false }, grid: { color: 'rgba(241, 241, 241, 0.2)' } },
                    x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } }
                },
                plugins: { legend: { labels: { color: '#ffffff' } } }
            }
        });
    };
    const updateAttendanceChart = () => {
        const date = elements.evaluationDatePicker.value;
        if (!date) return;
        
        const attendanceData = {};
        const justifiedAbsenceData = {};
        
        // Escludo gli atleti ospiti dal conteggio presenze
        athletes.filter(a => !a.isGuest).forEach(a => {
            attendanceData[String(a.id)] = { name: a.name, count: 0 };
            justifiedAbsenceData[String(a.id)] = { name: a.name, count: 0 };
        });
        
        // Funzione helper per verificare se un atleta è ospite
        const isGuestAthlete = (athleteId) => {
            const athlete = athletes.find(a => String(a.id) === String(athleteId));
            return athlete && athlete.isGuest;
        };
        
        if (attendanceChartPeriod === 'daily') {
            if (evaluations[date]) {
                Object.entries(evaluations[date]).forEach(([id, ev]) => {
                    // Salta gli atleti ospiti
                    if (isGuestAthlete(id)) return;
                    
                    const presenzaValue = parseInt(ev['presenza-allenamento'], 10);
                    if (attendanceData[id]) {
                        if (presenzaValue > 0) {
                            attendanceData[id].count = 1;
                        } else if (presenzaValue === -1) {
                            justifiedAbsenceData[id].count = 1;
                        }
                    }
                });
            }
        } else if (attendanceChartPeriod === 'monthly') {
            const month = date.substring(0, 7);
            Object.keys(evaluations).filter(d => d.startsWith(month)).forEach(d => {
                Object.entries(evaluations[d]).forEach(([id, ev]) => {
                    // Salta gli atleti ospiti
                    if (isGuestAthlete(id)) return;
                    
                    const presenzaValue = parseInt(ev['presenza-allenamento'], 10);
                    if (attendanceData[id]) {
                        if (presenzaValue > 0) {
                            attendanceData[id].count++;
                        } else if (presenzaValue === -1) {
                            justifiedAbsenceData[id].count++;
                        }
                    }
                });
            });
        } else if (attendanceChartPeriod === 'semester') {
            const year = date.substring(0, 4);
            const month = parseInt(date.substring(5, 7), 10);
            const semesterStartMonth = month <= 6 ? '01' : '07';
            const semesterEndMonth = month <= 6 ? '12' : '12';
            const startDate = `${year}-${semesterStartMonth}-01`;
            const endDate = `${year}-${semesterEndMonth}-31`;
            Object.keys(evaluations).filter(d => d >= startDate && d <= endDate).forEach(d => {
                Object.entries(evaluations[d]).forEach(([id, ev]) => {
                    // Salta gli atleti ospiti
                    if (isGuestAthlete(id)) return;
                    
                    const presenzaValue = parseInt(ev['presenza-allenamento'], 10);
                    if (attendanceData[id]) {
                        if (presenzaValue > 0) {
                            attendanceData[id].count++;
                        } else if (presenzaValue === -1) {
                            justifiedAbsenceData[id].count++;
                        }
                    }
                });
            });
        } else if (attendanceChartPeriod === 'annual') {
            const year = date.substring(0, 4);
            Object.keys(evaluations).filter(d => d.startsWith(year)).forEach(d => {
                Object.entries(evaluations[d]).forEach(([id, ev]) => {
                    // Salta gli atleti ospiti
                    if (isGuestAthlete(id)) return;
                    
                    const presenzaValue = parseInt(ev['presenza-allenamento'], 10);
                    if (attendanceData[id]) {
                        if (presenzaValue > 0) {
                            attendanceData[id].count++;
                        } else if (presenzaValue === -1) {
                            justifiedAbsenceData[id].count++;
                        }
                    }
                });
            });
        } else {
            const week = getWeekRange(date);
            Object.keys(evaluations).filter(d => d >= week.start && d <= week.end).forEach(d => {
                Object.entries(evaluations[d]).forEach(([id, ev]) => {
                    // Salta gli atleti ospiti
                    if (isGuestAthlete(id)) return;
                    
                    const presenzaValue = parseInt(ev['presenza-allenamento'], 10);
                    if (attendanceData[id]) {
                        if (presenzaValue > 0) {
                            attendanceData[id].count++;
                        } else if (presenzaValue === -1) {
                            justifiedAbsenceData[id].count++;
                        }
                    }
                });
            });
        }
        
        // Crea un array combinato per ordinare gli atleti per presenze totali
        const combinedData = Object.keys(attendanceData).map(id => ({
            id,
            name: attendanceData[id].name,
            presenze: attendanceData[id].count,
            assenzeGiustificate: justifiedAbsenceData[id].count,
            totale: attendanceData[id].count + justifiedAbsenceData[id].count
        }));
        
        combinedData.sort((a, b) => b.totale - a.totale);
        
        const labels = combinedData.map(d => d.name);
        const presenzeData = combinedData.map(d => d.presenze);
        const assenzeGiustificateData = combinedData.map(d => d.assenzeGiustificate);
        
        if(chartInstances.attendance) chartInstances.attendance.destroy();
        chartInstances.attendance = new Chart(document.getElementById('attendanceChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Presenze',
                        data: presenzeData,
                        backgroundColor: 'rgba(217, 4, 41, 0.8)'
                    },
                    {
                        label: 'Assenze Giustificate',
                        data: assenzeGiustificateData,
                        backgroundColor: 'rgba(0, 128, 0, 0.8)'
                    }
                ]
            },
            options: {
                scales: {
                    y: { 
                        stacked: true,
                        ticks: { color: '#ffffff' }, 
                        grid: { color: 'rgba(241, 241, 241, 0.2)' } 
                    },
                    x: { 
                        stacked: true,
                        ticks: { color: '#ffffff' }, 
                        grid: { color: 'rgba(241, 241, 241, 0.2)' } 
                    }
                },
                plugins: { 
                    legend: { 
                        labels: { color: '#ffffff' } 
                    } 
                }
            }
        });
    };
    const updateHallOfFame = () => {
        elements.hallOfFameContainer.innerHTML = '';
        const allAwards = Object.values(awards).flat();
        if (allAwards.length === 0) {
            elements.hallOfFameContainer.innerHTML = '<p class="text-muted">Nessun premio assegnato per questa stagione.</p>';
            return;
        }
        allAwards.forEach(award => {
            const athlete = athletes.find(a => a.id.toString() === award.athleteId.toString());
            if (athlete) {
                const awardCard = document.createElement('div');
                awardCard.className = 'card award-card text-center';
                const dateObj = new Date(award.date);
                const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('it-IT') : 'Data non disponibile';
                awardCard.innerHTML = `<div class="card-body p-2"><img src="${athlete.avatar || defaultAvatar}" onerror="this.src='${defaultAvatar}'" alt="${athlete.name}" class="award-avatar mx-auto mb-2 rounded-circle"><h6 class="mb-1" style="font-size: 0.9rem;">${athlete.name}</h6><p class="mb-0" style="font-size: 0.8rem; color: #000;">${formattedDate}</p><small>${award.reason}</small><i class="bi bi-award-fill mt-2" style="font-size: 1.5rem;"></i></div>`;
                elements.hallOfFameContainer.appendChild(awardCard);
            }
        });
    };
    const getFilteredGpsData = () => {
        if (isAuthenticated()) { return gpsData; }
        const filteredData = JSON.parse(JSON.stringify(gpsData));
        for (const athleteId in filteredData) {
            for (const date in filteredData[athleteId]) {
                filteredData[athleteId][date] = filteredData[athleteId][date].filter(session => session.tipo_sessione !== 'Individual');
                if (filteredData[athleteId][date].length === 0) {
                    delete filteredData[athleteId][date];
                }
            }
        }
        return filteredData;
    };
    const findSessionById = (sessionId) => {
        if (!sessionId) return null;
        for (const athleteId in gpsData) {
            for (const date in gpsData[athleteId]) {
                const session = gpsData[athleteId][date].find(s => String(s.id) === String(sessionId));
                if (session) return { ...session, date: date };
            }
        }
        return null;
    };
    const populatePerformanceSelectors = () => {
        elements.performanceSelectorsContainer.innerHTML = '';
        const dataToUse = gpsData;
        const keysToExclude = ['tipo_sessione', 'data_di_registrazione', 'ora_registrazione'];
        const optionsHtml = Object.entries(gpsFieldsForDisplay).filter(([key]) => !keysToExclude.includes(key)).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
        elements.metricSelector.innerHTML = optionsHtml;
        elements.multiAthleteMetricSelector.innerHTML = optionsHtml;
        elements.metricSelector.value = 'velocita_massima';
        elements.multiAthleteMetricSelector.value = 'velocita_massima';
        performanceSelections.forEach((selection, index) => {
            const selectorRow = document.createElement('div');
            selectorRow.className = 'row g-2 align-items-end mb-2';
            selectorRow.innerHTML = `<div class="col-md-6"><label class="form-label">Atleta ${index + 1}:</label><select class="form-select athlete-selector" data-index="${index}"><option value="">Seleziona atleta...</option>${athletes.map(a => `<option value="${a.id}" ${selection.athleteId == a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select></div><div class="col-md-5"><label class="form-label">Sessione:</label><select class="form-select date-selector" data-index="${index}"><option value="">Seleziona sessione...</option></select></div><div class="col-md-1"><button class="btn btn-outline-danger btn-sm remove-selector" data-index="${index}" ${performanceSelections.length <= 2 ? 'disabled' : ''}><i class="bi bi-trash"></i></button></div>`;
            elements.performanceSelectorsContainer.appendChild(selectorRow);
            const athleteId = selection.athleteId;
            const dateSelector = selectorRow.querySelector('.date-selector');
            if (athleteId && dataToUse[athleteId]) {
                const allSessions = [];
                Object.entries(dataToUse[athleteId]).forEach(([date, sessions]) => {
                    sessions.forEach(session => allSessions.push({ date, ...session }));
                });
                const filteredSessions = (performanceFilterType === 'all') ? allSessions : allSessions.filter(session => session.tipo_sessione === performanceFilterType);
                filteredSessions.sort((a,b) => new Date(b.date) - new Date(a.date) || (b.ora_registrazione || "").localeCompare(a.ora_registrazione || "")).forEach(session => {
                    const option = document.createElement('option');
                    option.value = session.id;
                    let text = `${new Date(session.date).toLocaleDateString('it-IT')} ${session.ora_registrazione || ''} - ${session.tipo_sessione || 'N/A'}`;
                    if (session.tipo_sessione === 'Individual' && !isAuthenticated()) {
                        text += ' (Protetta)';
                        option.dataset.protected = 'true';
                    }
                    option.textContent = text;
                    if (selection.sessionId == session.id) option.selected = true;
                    dateSelector.appendChild(option);
                });
            }
        });
    };
    const updatePerformanceChart = () => {
        const selectedMetric = elements.metricSelector.value;
        if (!selectedMetric) return;
        const validSelections = performanceSelections.filter(s => s.athleteId && s.sessionId);
        if (validSelections.length === 0) {
            if (chartInstances.performance) chartInstances.performance.destroy();
            updatePerformanceTable();
            return;
        }
        const chartData = {
            labels: validSelections.map((selection) => {
                const session = findSessionById(selection.sessionId);
                const athlete = athletes.find(a => a.id.toString() === selection.athleteId.toString());
                return `${athlete?.name || 'N/A'} (${new Date(session.date).toLocaleDateString('it-IT')})`;
            }),
            datasets: [{
                label: gpsFieldsForDisplay[selectedMetric] || selectedMetric,
                data: validSelections.map(selection => {
                    const session = findSessionById(selection.sessionId);
                    return session ? (session[selectedMetric] || 0) : 0;
                }),
                backgroundColor: 'rgba(217, 4, 41, 0.8)'
            }]
        };
        if (chartInstances.performance) chartInstances.performance.destroy();
        chartInstances.performance = new Chart(document.getElementById('performanceChart').getContext('2d'), {
            type: 'bar',
            data: chartData,
            options: {
                scales: {
                    y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } },
                    x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } }
                },
                plugins: { legend: { labels: { color: '#ffffff' } } }
            }
        });
        updatePerformanceTable();
    };
    const updatePerformanceTable = () => {
        const validSelections = performanceSelections.filter(s => s.athleteId && s.sessionId);
        if (validSelections.length === 0) {
            elements.tableContainer.innerHTML = '<p class="text-muted">Nessun dato da visualizzare</p>';
            elements.exportButtonsContainer.innerHTML = '';
            return;
        }
        const tableBody = validSelections.map(selection => {
            const athlete = athletes.find(a => a.id.toString() === selection.athleteId.toString());
            const data = findSessionById(selection.sessionId) || {};
            const cells = Object.keys(gpsFieldsForDisplay).filter(key => !['data_di_registrazione', 'ora_registrazione', 'tipo_sessione'].includes(key)).map(key => `<td>${data[key] ?? 'N/A'}</td>`).join('');
            return `<tr><td>${athlete?.name || 'N/A'}</td><td>${new Date(data.date).toLocaleDateString('it-IT')}</td><td>${data.ora_registrazione || 'N/A'}</td><td>${data.tipo_sessione || 'N/A'}</td>${cells}</tr>`;
        }).join('');
        elements.tableContainer.innerHTML = `<table class="table table-dark table-striped table-hover"><thead><tr><th>Atleta</th><th>Data</th><th>Ora</th><th>Tipo</th>${Object.values(gpsFieldsForDisplay).filter(label => !['Data', 'Ora', 'Tipo'].includes(label)).map(label => `<th>${label}</th>`).join('')}</tr></thead><tbody>${tableBody}</tbody></table>`;
        elements.exportButtonsContainer.innerHTML = `<button class="btn btn-success btn-sm" id="export-excel"><i class="bi bi-file-excel"></i> Excel</button><button class="btn btn-danger btn-sm" id="export-pdf"><i class="bi bi-file-pdf"></i> PDF</button>`;
    };
    const populateAnalysisSelectors = () => {
        const athleteOptions = athletes.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        elements.trendAthleteSelector.innerHTML = `<option value="">Seleziona atleta...</option>${athleteOptions}`;
        elements.radarAthleteSelector1.innerHTML = `<option value="">Seleziona atleta...</option>${athleteOptions}`;
        elements.radarAthleteSelector2.innerHTML = `<option value="">Nessun confronto</option>${athleteOptions}`;
        const keysToExclude = ['tipo_sessione', 'data_di_registrazione', 'ora_registrazione'];
        const optionsHtml = Object.entries(gpsFieldsForDisplay).filter(([key]) => !keysToExclude.includes(key)).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
        elements.trendMetricSelector.innerHTML = optionsHtml;
        elements.trendMetricSelector.value = 'velocita_massima';
    };
    const updateAthleteTrendChart = () => {
        const athleteId = elements.trendAthleteSelector.value;
        const metric = elements.trendMetricSelector.value;
        if (chartInstances.athleteTrend) chartInstances.athleteTrend.destroy();
        if (!athleteId || !metric) return;
        const dataToUse = getFilteredGpsData();
        const athlete = athletes.find(a => a.id.toString() === athleteId);
        const athleteData = dataToUse[athleteId] || {};
        const sessionPoints = [];
        Object.entries(athleteData).forEach(([date, sessions]) => {
            sessions.forEach(session => {
                if(session[metric] !== undefined && session[metric] !== null){
                    sessionPoints.push({ date: new Date(`${date}T${session.ora_registrazione || '00:00:00'}`), value: session[metric] });
                }
            });
        });
        sessionPoints.sort((a, b) => a.date - b.date);
        const labels = sessionPoints.map(p => p.date.toLocaleString('it-IT', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}));
        const athleteValues = sessionPoints.map(p => p.value);
        const teamAvgValues = [];
        const teamMaxValues = [];
        sessionPoints.forEach(point => {
            const pointDate = toLocalDateISO(point.date);
            let dailyValues = [];
            Object.keys(dataToUse).forEach(athId => {
                if (dataToUse[athId][pointDate]) {
                    dataToUse[athId][pointDate].forEach(sess => {
                        if (sess[metric] !== undefined && sess[metric] !== null) {
                            dailyValues.push(sess[metric]);
                        }
                    });
                }
            });
            if (dailyValues.length > 0) {
                const sum = dailyValues.reduce((a, b) => a + b, 0);
                teamAvgValues.push(sum / dailyValues.length);
                teamMaxValues.push(Math.max(...dailyValues));
            } else {
                teamAvgValues.push(null);
                teamMaxValues.push(null);
            }
        });
        const datasets = [
            { label: gpsFieldsForDisplay[metric] || metric, data: athleteValues, borderColor: 'rgba(217, 4, 41, 1)', backgroundColor: 'rgba(217, 4, 41, 0.2)', tension: 0.3, fill: true },
            { label: 'Media Squadra', data: teamAvgValues, borderColor: 'rgba(54, 162, 235, 1)', borderDash: [5, 5], fill: false, tension: 0.3 },
            { label: 'Max Squadra', data: teamMaxValues, borderColor: 'rgba(255, 206, 86, 1)', borderDash: [5, 5], fill: false, tension: 0.3 }
        ];
        chartInstances.athleteTrend = new Chart(document.getElementById('athleteTrendChart').getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                scales: {
                    y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } },
                    x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } }
                },
                plugins: {
                    legend: { labels: { color: '#ffffff' } },
                    title: { display: true, text: `Andamento: ${athlete?.name || 'N/A'}`, color: '#ffffff' }
                }
            }
        });
    };
    const updateAthleteRadarChart = () => {
        const athleteId1 = elements.radarAthleteSelector1.value;
        const athleteId2 = elements.radarAthleteSelector2.value;
        const selectedAthleteIds = [athleteId1, athleteId2].filter(id => id);
        if (chartInstances.athleteRadar) chartInstances.athleteRadar.destroy();
        if (selectedAthleteIds.length === 0) return;
        const dataToUse = getFilteredGpsData();
        const radarColors = [ 'rgba(217, 4, 41, 1)', 'rgba(255, 215, 0, 1)' ];
        const teamMaxs = {};
        Object.keys(radarMetrics).forEach(metric => {
            let maxValue = 0;
            Object.values(dataToUse).forEach(playerData => {
                Object.values(playerData).forEach(sessions => {
                    sessions.forEach(session => {
                        const value = parseFloat(session[metric] || 0);
                        if (value > maxValue) maxValue = value;
                    });
                });
            });
            teamMaxs[metric] = maxValue;
        });
        const datasets = selectedAthleteIds.map((athleteId, index) => {
            const athlete = athletes.find(a => a.id.toString() === athleteId);
            const athleteData = dataToUse[athleteId] || {};
            const athleteAvgs = {};
            Object.keys(radarMetrics).forEach(metric => {
                let athleteSum = 0, athleteCount = 0;
                Object.values(athleteData).forEach(sessions => {
                    sessions.forEach(session => {
                        if(session[metric] !== undefined){
                            const value = parseFloat(session[metric] || 0);
                            athleteSum += value;
                            athleteCount++;
                        }
                    });
                });
                athleteAvgs[metric] = athleteCount > 0 ? athleteSum / athleteCount : 0;
            });
            const normalizedData = Object.keys(radarMetrics).map(metric => teamMaxs[metric] > 0 ? (athleteAvgs[metric] / teamMaxs[metric]) * 100 : 0);
            const color = radarColors[index % radarColors.length];
            return {
                label: athlete?.name || 'N/A',
                data: normalizedData,
                borderColor: color,
                backgroundColor: color.replace('1)', '0.2)'),
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: color
            };
        });
        chartInstances.athleteRadar = new Chart(document.getElementById('athleteRadarChart').getContext('2d'), {
            type: 'radar',
            data: { labels: Object.values(radarMetrics), datasets: datasets },
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 20, color: '#ffffff', backdropColor: 'rgba(0,0,0,0.5)' },
                        pointLabels: { color: '#ffffff', font: {size: 10} },
                        grid: { color: 'rgba(241, 241, 241, 0.2)' },
                        angleLines: { color: 'rgba(241, 241, 241, 0.2)' }
                    }
                },
                plugins: { legend: { labels: { color: '#ffffff' } } }
            }
        });
    };
    const updateMultiAthleteChart = () => {
        const metric = elements.multiAthleteMetricSelector.value;
        const periodBtn = document.querySelector('#multi-athlete-chart-container .btn-group[role="group"] .btn.active');
        if (!metric || !periodBtn) return;
        const period = periodBtn.dataset.period;
        let startDate, endDate = new Date();
        if (period === 'day') {
            if (!elements.multiAthleteDatepicker.value) return;
            startDate = new Date(elements.multiAthleteDatepicker.value);
            endDate = new Date(elements.multiAthleteDatepicker.value);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const monthsToSubtract = { month: 1, bimonth: 2, trimester: 3, semester: 6, annual: 12 };
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - monthsToSubtract[period]);
        }
        startDate.setHours(0, 0, 0, 0);
        const dataToUse = getFilteredGpsData();
        const chartData = [];
        athletes.forEach(athlete => {
            const athleteGpsData = dataToUse[athlete.id] || {};
            const relevantSessions = Object.entries(athleteGpsData).flatMap(([, sessions]) => sessions)
                .filter(session => {
                    const sessionDate = new Date(session.data_di_registrazione);
                    return sessionDate >= startDate && sessionDate <= endDate;
                })
                .filter(session => {
                    if (multiAthleteFilterType === 'all') return true;
                    return session.tipo_sessione === multiAthleteFilterType;
                })
                .filter(session => session[metric] !== undefined && session[metric] !== null && String(session[metric]).trim() !== '')
                .map(session => parseFloat(session[metric]));
            if (relevantSessions.length > 0) {
                const maxValue = Math.max(...relevantSessions);
                chartData.push({ name: athlete.name, value: maxValue });
            }
        });
        chartData.sort((a, b) => b.value - a.value);
        if(chartInstances.multiAthlete) chartInstances.multiAthlete.destroy();
        chartInstances.multiAthlete = new Chart(document.getElementById('multiAthleteChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.name),
                datasets: [{
                    label: gpsFieldsForDisplay[metric],
                    data: chartData.map(d => d.value.toFixed(2)),
                    backgroundColor: 'rgba(217, 4, 41, 0.8)'
                }]
            },
            options: {
                scales: {
                    y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } },
                    x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.1)' } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y}`
                        }
                    }
                }
            }
        });
    };
    const checkDeadlinesAndAlert = () => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const threeMonths = new Date();
        threeMonths.setMonth(today.getMonth() + 3);
        const expired = [];
        const warning = [];
        athletes.forEach(athlete => {
            if (athlete.scadenzaVisita) {
                const deadline = new Date(athlete.scadenzaVisita);
                if (deadline < today) {
                    expired.push(athlete.name);
                } else if (deadline <= threeMonths) {
                    warning.push(`${athlete.name} (${deadline.toLocaleDateString('it-IT')})`);
                }
            }
        });
        elements.alertsContainer.innerHTML = '';
        let alertHTML = '';
        if (expired.length > 0) {
            alertHTML += `<div class="alert alert-danger alert-dismissible fade show" role="alert"><strong>VISITE MEDICHE SCADUTE!</strong> Atleti non idonei: ${expired.join(', ')}.<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        }
        if (warning.length > 0) {
            alertHTML += `<div class="alert alert-warning alert-dismissible fade show" role="alert"><strong>SCADENZE IN AVVICINAMENTO (meno di 3 mesi):</strong> ${warning.join(', ')}.<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        }
        if(alertHTML) {
            elements.alertsContainer.innerHTML = alertHTML;
        }
    };
    const logout = () => { sessionStorage.removeItem('isAuthenticated'); updateAllUI(); };
    const syncAndUpdateEvaluationDate = (newDate) => {
        elements.evaluationDatePicker.value = newDate;
        elements.evaluationDatePicker2.value = newDate;
        updateEvaluationCharts();
        updateAttendanceChart();
        updateHallOfFame();
    };
    elements.evaluationDatePicker.addEventListener('change', (e) => syncAndUpdateEvaluationDate(e.target.value));
    elements.evaluationDatePicker2.addEventListener('change', (e) => syncAndUpdateEvaluationDate(e.target.value));
    elements.logoutBtn.addEventListener('click', logout);
    elements.cardsSummaryTbody.addEventListener('click', e => {
        const removeBtn = e.target.closest('.remove-card-summary-row-btn');
        if (removeBtn) {
            const cardId = removeBtn.dataset.cardId;
            const [matchId, cardIndexStr] = cardId.split('-');
            const cardIndex = parseInt(cardIndexStr, 10);
            if (matchResults[matchId] && matchResults[matchId].cards[cardIndex]) {
                matchResults[matchId].cards.splice(cardIndex, 1);
                saveData();
            }
            removeBtn.closest('tr').remove();
            if (elements.cardsSummaryTbody.children.length === 0 || elements.cardsSummaryTbody.querySelector('tr td[colspan]')) {
                elements.cardsSummaryTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nessun cartellino da mostrare.</td></tr>';
            }
        }
    });
    document.querySelector('main').addEventListener('click', e => {
        if (e.target.closest('.unlock-btn')) {
            requestAuthentication(updateAllUI);
        }
    });
    elements.prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    elements.nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
    elements.addSessionBtn.addEventListener('click', () => openSessionModal());
    elements.quickAddAthleteBtn.addEventListener('click', () => elements.addAthleteBtn.click());
    elements.quickPlanSessionBtn.addEventListener('click', () => elements.addSessionBtn.click());
    elements.calendarGrid.addEventListener('click', e => {
        if (e.target.classList.contains('calendar-session')) {
            const sessionId = e.target.dataset.sessionId;
            const matchId = e.target.dataset.matchId;
            const date = e.target.dataset.date;
            if (sessionId) {
                const session = trainingSessions[date]?.find(s => s.id == sessionId);
                if (session) {
                    openSessionModal({ ...session, date });
                }
            } else if (matchId) {
                openMatchResultModal(matchId);
            }
        }
    });
    elements.sessionForm.addEventListener('submit', e => {
        e.preventDefault();
        const date = document.getElementById('session-date').value;
        const id = document.getElementById('session-id').value || Date.now();
        const sessionData = {
            id,
            title: document.getElementById('session-title').value,
            time: document.getElementById('session-time').value,
            location: document.getElementById('session-location').value,
            goals: document.getElementById('session-goals').value,
            description: document.getElementById('session-description').value,
        };
        if (!trainingSessions[date]) {
            trainingSessions[date] = [];
        }
        const existingIndex = trainingSessions[date].findIndex(s => s.id == id);
        if (existingIndex > -1) {
            trainingSessions[date][existingIndex] = sessionData;
        } else {
            trainingSessions[date].push(sessionData);
        }
        saveData();
        renderCalendar();
        updateHomePage();
        sessionModal.hide();
    });
    elements.deleteSessionBtn.addEventListener('click', () => {
        const date = document.getElementById('session-date').value;
        const id = document.getElementById('session-id').value;
        if (date && id && confirm("Sei sicuro di voler eliminare questa sessione?")) {
            if(trainingSessions[date]) {
                trainingSessions[date] = trainingSessions[date].filter(s => s.id != id);
                if(trainingSessions[date].length === 0) {
                    delete trainingSessions[date];
                }
            }
            saveData();
            renderCalendar();
            updateHomePage();
            sessionModal.hide();
        }
    });
    document.getElementById('gps-tipo_sessione').addEventListener('change', (e) => {
        document.getElementById('match-stats-fields').style.display = (e.target.value === 'Partita') ? 'block' : 'none';
    });
    elements.comparisonPeriodToggle.addEventListener('click', (e) => {
        if (e.target.dataset.period) {
            elements.comparisonPeriodToggle.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            comparisonChartPeriod = e.target.dataset.period;
            updateEvaluationCharts();
        }
    });
    elements.attendancePeriodToggle.addEventListener('click', (e) => {
        if (e.target.dataset.period) {
            elements.attendancePeriodToggle.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            attendanceChartPeriod = e.target.dataset.period;
            updateAttendanceChart();
        }
    });
    elements.addAthleteBtn.addEventListener('click', () => {
        document.getElementById('athleteModalLabel').textContent = 'Aggiungi Atleta';
        document.getElementById('athlete-form').reset();
        document.getElementById('modal-athlete-id').value = '';
        document.getElementById('avatar-preview').style.display = 'none';
        document.getElementById('avatar-preview').src = '';
        document.getElementById('athlete-avatar-input').value = '';
        document.getElementById('athlete-avatar-base64').value = '';
        document.getElementById('athlete-captain').checked = false;
        document.getElementById('athlete-vice-captain').checked = false;
        document.getElementById('athlete-guest').checked = false;
        athleteModal.show();
    });
    elements.athleteGrid.addEventListener('click', (e) => {
        const card = e.target.closest('[data-athlete-id]');
        if (!card) return;
        const athleteId = card.dataset.athleteId;
        const athlete = athletes.find(a => a.id.toString() === athleteId);
        if (!athlete) return;
        if (e.target.closest('.edit-btn')) {
            document.getElementById('athleteModalLabel').textContent = 'Modifica Atleta';
            document.getElementById('modal-athlete-id').value = athlete.id;
            document.getElementById('athlete-name').value = athlete.name;
            document.getElementById('athlete-role').value = athlete.role;
            document.getElementById('athlete-number').value = athlete.number;
            document.getElementById('scadenza-visita').value = athlete.scadenzaVisita || '';
            document.getElementById('prenotazione-visita').value = athlete.dataPrenotazioneVisita || '';
            document.getElementById('athlete-captain').checked = athlete.isCaptain;
            document.getElementById('athlete-vice-captain').checked = athlete.isViceCaptain;
            document.getElementById('athlete-guest').checked = athlete.isGuest;
            const preview = document.getElementById('avatar-preview');
            document.getElementById('athlete-avatar-input').value = '';
            document.getElementById('athlete-avatar-base64').value = '';
            if (athlete.avatar) {
                preview.src = athlete.avatar;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
            athleteModal.show();
        }
        else if (e.target.closest('.delete-btn')) {
            if (confirm(`Sei sicuro di voler eliminare ${athlete.name}? Tutti i suoi dati storici verranno rimossi.`)) {
                athletes = athletes.filter(a => a.id.toString() !== athleteId);
                for (const date in evaluations) {
                    delete evaluations[date][athleteId];
                }
                delete gpsData[athleteId];
                for (const date in awards) {
                    awards[date] = awards[date].filter(a => a.athleteId.toString() !== athleteId);
                }
                Object.keys(matchResults).forEach(matchId => {
                    matchResults[matchId].scorers = matchResults[matchId].scorers.filter(s => String(s.athleteId) !== athleteId);
                    matchResults[matchId].cards = matchResults[matchId].cards.filter(c => String(c.athleteId) !== athleteId);
                    matchResults[matchId].assists = matchResults[matchId].assists.filter(a => String(a.athleteId) !== athleteId);
                });
                saveData();
                updateAllUI();
            }
        }
        else if (e.target.closest('.gps-btn')) {
            document.getElementById('modal-athlete-name-gps').textContent = athlete.name;
            const gpsForm = document.getElementById('gps-form');
            gpsForm.reset();
            document.getElementById('match-stats-fields').style.display = 'none';
            gpsForm.querySelector('#modal-athlete-id-gps').value = athlete.id;
            gpsForm.querySelector('#gps-data_di_registrazione').valueAsDate = new Date();
            const sessionSelector = document.getElementById('gps-session-selector');
            sessionSelector.innerHTML = '<option value="">--- Inserisci Nuova Sessione ---</option>';
            const athleteGpsData = gpsData[athlete.id] || {};
            const allSessions = [];
            Object.entries(athleteGpsData).forEach(([date, sessions]) => {
                sessions.forEach(session => allSessions.push({ date, ...session }));
            });
            allSessions.sort((a,b)=> new Date(b.date) - new Date(a.date) || (b.ora_registrazione || "").localeCompare(a.ora_registrazione || "")).forEach(session => {
                const option = document.createElement('option');
                option.value = session.id;
                let text = `${new Date(session.date).toLocaleDateString('it-IT')} ${session.ora_registrazione || ''} - ${session.tipo_sessione || 'N/A'}`;
                if (session.tipo_sessione === 'Individual' && !isAuthenticated()) {
                    text += ' (Protetta)';
                }
                option.textContent = text;
                sessionSelector.appendChild(option);
            });
            document.getElementById('delete-gps-session-btn').disabled = true;
            gpsModal.show();
        }
        else if (e.target.closest('.athlete-card-clickable')) {
            const date = elements.evaluationDatePicker.value;
            if (date) {
                document.getElementById('modal-athlete-name-eval').textContent = athlete.name;
                document.getElementById('modal-athlete-id-eval').value = athlete.id;
                document.getElementById('modal-evaluation-date').textContent = new Date(date).toLocaleDateString('it-IT');
                const existingEvaluation = evaluations[date]?.[athleteId] || {};
                evaluationCategories.forEach(category => {
                    document.getElementById(category).value = existingEvaluation[category] || '0';
                });
                document.getElementById('award-checkbox').checked = !!(awards[date]?.find(a => a.athleteId.toString() === athleteId));
                evaluationModal.show();
            }
        }
    });
    modalsContainer.addEventListener('change', (e) => {
        if (e.target.id === 'athlete-avatar-input') {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('athlete-avatar-base64').value = event.target.result;
                    const preview = document.getElementById('avatar-preview');
                    preview.src = event.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        }
    });
    elements.athleteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const athleteId = document.getElementById('modal-athlete-id').value;
        const avatarBase64 = document.getElementById('athlete-avatar-base64').value;
        const existingAthlete = athleteId ? athletes.find(a => a.id.toString() === athleteId) : null;
        const athleteData = {
            name: document.getElementById('athlete-name').value.trim(),
            role: document.getElementById('athlete-role').value.trim(),
            number: parseInt(document.getElementById('athlete-number').value),
            isCaptain: document.getElementById('athlete-captain').checked,
            isViceCaptain: document.getElementById('athlete-vice-captain').checked,
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
            athleteData.isViceCaptain = athleteData.isViceCaptain || false;
            athleteData.isGuest = athleteData.isGuest || false;
            athletes.push(athleteData);
        }
        saveData();
        updateAllUI();
        athleteModal.hide();
    });
    elements.evaluationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const athleteId = document.getElementById('modal-athlete-id-eval').value;
        const date = elements.evaluationDatePicker.value;
        if (!date) {
            alert('Per favore, seleziona una data valida prima di salvare.');
            return;
        }
        if (!evaluations[date]) evaluations[date] = {};
        evaluations[date][athleteId] = evaluationCategories.reduce((obj, cat) => ({ ...obj, [cat]: document.getElementById(cat).value }), {});
        if (document.getElementById('award-checkbox').checked) {
            const reason = prompt('Motivo del premio:');
            if (reason) {
                if (!awards[date]) awards[date] = [];
                awards[date] = awards[date].filter(a => a.athleteId !== athleteId);
                awards[date].push({ athleteId, reason, date });
            }
        } else {
            if (awards[date]) awards[date] = awards[date].filter(a => a.athleteId !== athleteId);
        }
        saveData();
        updateAllUI();
        evaluationModal.hide();
    });
    elements.gpsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const athleteId = document.getElementById('modal-athlete-id-gps').value;
        const date = document.getElementById('gps-data_di_registrazione').value;
        const time = document.getElementById('gps-ora_registrazione').value;
        let sessionId = document.getElementById('gps-session-id').value;
        const originalSession = findSessionById(sessionId);
        if (!date) {
            alert("Per favore, inserisci una data di registrazione valida.");
            return;
        }
        const gpsFormData = {};
        allGpsFields.forEach(field => {
            const el = document.getElementById(`gps-${field}`);
            if(el) {
                const value = el.value.trim();
                if(value !== '') gpsFormData[field] = el.type === 'number' ? parseFloat(value) : value;
            }
        });
        if (!sessionId) {
            sessionId = Date.now().toString();
        }
        gpsFormData.id = sessionId;
        if(originalSession && originalSession.date !== date) {
            const oldDate = originalSession.date;
            if(gpsData[athleteId] && gpsData[athleteId][oldDate]) {
                gpsData[athleteId][oldDate] = gpsData[athleteId][oldDate].filter(s => String(s.id) !== String(originalSession.id));
                if(gpsData[athleteId][oldDate].length === 0) {
                    delete gpsData[athleteId][oldDate];
                }
            }
        }
        const dist = parseFloat(gpsFormData.distanza_totale) || 0;
        const t = parseFloat(gpsFormData.tempo_totale) || 0;
        if (dist > 0 && t > 0) gpsFormData.distanza_per_minuto = parseFloat((dist / t).toFixed(2));
        const distC = parseFloat(gpsFormData.distanza_circuito) || 0;
        const minC = parseInt(document.getElementById('gps-tempo_circuito_min').value) || 0;
        const secC = parseInt(document.getElementById('gps-tempo_circuito_sec').value) || 0;
        const cenC = parseInt(document.getElementById('gps-tempo_circuito_cen').value) || 0;
        const totalTimeSecC = minC * 60 + secC + cenC / 100;
        if (totalTimeSecC > 0) {
            gpsFormData.tempo_circuito_totale_s = totalTimeSecC;
            if (distC > 0) gpsFormData.velocita_circuito = parseFloat(((distC / totalTimeSecC) * 3.6).toFixed(2));
        }
        if (!gpsData[athleteId]) gpsData[athleteId] = {};
        if (!gpsData[athleteId][date]) gpsData[athleteId][date] = [];
        const sessionIndex = gpsData[athleteId][date].findIndex(s => String(s.id) === String(sessionId));
        if (sessionIndex > -1) {
            gpsData[athleteId][date][sessionIndex] = gpsFormData;
        } else {
            gpsData[athleteId][date].push(gpsFormData);
        }
        saveData();
        updateAllUI();
        gpsModal.hide();
    });
    document.getElementById('gps-data_di_registrazione').addEventListener('input', () => {
        document.getElementById('gps-session-id').value = '';
    });
    document.getElementById('gps-ora_registrazione').addEventListener('input', () => {
        document.getElementById('gps-session-id').value = '';
    });
    ['gps-distanza_totale', 'gps-tempo_totale'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            const dist = parseFloat(document.getElementById('gps-distanza_totale').value) || 0;
            const time = parseFloat(document.getElementById('gps-tempo_totale').value) || 0;
            document.getElementById('gps-distanza_per_minuto').value = (time > 0) ? (dist / time).toFixed(2) : '';
        });
    });
    ['gps-distanza_circuito', 'gps-tempo_circuito_min', 'gps-tempo_circuito_sec', 'gps-tempo_circuito_cen'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            const dist = parseFloat(document.getElementById('gps-distanza_circuito').value) || 0;
            const min = parseInt(document.getElementById('gps-tempo_circuito_min').value) || 0;
            const sec = parseInt(document.getElementById('gps-tempo_circuito_sec').value) || 0;
            const cen = parseInt(document.getElementById('gps-tempo_circuito_cen').value) || 0;
            const totalTimeSec = min * 60 + sec + cen / 100;
            document.getElementById('gps-velocita_circuito').value = (dist > 0 && totalTimeSec > 0) ? ((dist / totalTimeSec) * 3.6).toFixed(2) : '';
        });
    });
    elements.performanceSelectorsContainer.addEventListener('change', (e) => {
        if (!e.target.matches('.athlete-selector, .date-selector')) return;
        const index = parseInt(e.target.dataset.index);
        const row = e.target.closest('.row');
        const isAthleteChange = e.target.matches('.athlete-selector');
        performanceSelections[index].athleteId = row.querySelector('.athlete-selector').value;
        performanceSelections[index].sessionId = row.querySelector('.date-selector').value;
        if (isAthleteChange) {
            performanceSelections[index].sessionId = null; 
        }
        const selectedOption = e.target.selectedOptions ? e.target.selectedOptions[0] : null;
        if (e.target.matches('.date-selector') && selectedOption && selectedOption.dataset.protected === 'true') {
            requestAuthentication(
                () => {
                    populatePerformanceSelectors(); 
                    updatePerformanceChart();
                },
                () => {
                    performanceSelections[index].sessionId = null;
                    populatePerformanceSelectors(); 
                    updatePerformanceChart();
                }
            );
            return;
        }
        populatePerformanceSelectors();
        updatePerformanceChart();
    });
    elements.performanceSelectorsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-selector');
        if (removeBtn) {
            performanceSelections.splice(parseInt(removeBtn.dataset.index), 1);
            populatePerformanceSelectors();
            updatePerformanceChart();
        }
    });
    elements.addComparisonBtn.addEventListener('click', () => {
        performanceSelections.push({ athleteId: null, sessionId: null });
        populatePerformanceSelectors();
    });
    elements.metricSelector.addEventListener('change', updatePerformanceChart);
    elements.trendAthleteSelector.addEventListener('change', updateAthleteTrendChart);
    elements.trendMetricSelector.addEventListener('change', updateAthleteTrendChart);
    elements.radarAthleteSelector1.addEventListener('change', updateAthleteRadarChart);
    elements.radarAthleteSelector2.addEventListener('change', updateAthleteRadarChart);
    elements.multiAthleteTimeFilter.addEventListener('click', e => {
        if(e.target.tagName === 'BUTTON'){
            elements.multiAthleteTimeFilter.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            elements.multiAthleteDatepickerContainer.style.display = (e.target.dataset.period === 'day') ? 'block' : 'none';
            if(e.target.dataset.period === 'day'){
                elements.multiAthleteDatepicker.closest('.col-md-3').classList.remove('d-none');
            } else {
                elements.multiAthleteDatepicker.closest('.col-md-3').classList.add('d-none');
            }
            updateMultiAthleteChart();
        }
    });
    elements.multiAthleteMetricSelector.addEventListener('change', updateMultiAthleteChart);
    elements.multiAthleteDatepicker.addEventListener('change', updateMultiAthleteChart);
    elements.multiAthleteResetBtn.addEventListener('click', () => {
        elements.multiAthleteTimeFilter.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        elements.multiAthleteTimeFilter.querySelector('.btn[data-period="annual"]').classList.add('active');
        elements.multiAthleteDatepicker.value = '';
        elements.multiAthleteDatepickerContainer.style.display = 'none';
        elements.multiAthleteMetricSelector.selectedIndex = 0;
        elements.multiAthleteTypeSelector.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        elements.multiAthleteTypeSelector.querySelector('.btn[data-type="all"]').classList.add('active');
        multiAthleteFilterType = 'all';
        updateMultiAthleteChart();
    });
    elements.exportAllDataBtn.addEventListener('click', () => {
        const performDownload = (includeIndividual) => {
            let dataToExport = { athletes, evaluations, gpsData, awards, trainingSessions, formationData, matchResults };
            if (!includeIndividual) {
                dataToExport = JSON.parse(JSON.stringify(dataToExport));
                for (const athleteId in dataToExport.gpsData) {
                    for (const date in dataToExport.gpsData[athleteId]) {
                        dataToExport.gpsData[athleteId][date] = dataToExport.gpsData[athleteId][date].filter(session => session.tipo_sessione !== 'Individual');
                        if (dataToExport.gpsData[athleteId][date].length === 0) {
                            delete dataToExport.gpsData[athleteId][date];
                        }
                    }
                }
            }
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `coach_dashboard_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (!includeIndividual) {
                alert("Download completato. I dati delle sessioni 'Individual' sono stati esclusi.");
            }
        };
        const hasIndividualData = () => Object.values(gpsData).some(ath => Object.values(ath).some(sessions => sessions.some(sess => sess.tipo_sessione === 'Individual')));
        if (hasIndividualData() && !isAuthenticated()) {
            requestAuthentication( () => {
                performDownload(true);
            }, () => {
                if (confirm("Accesso annullato o password errata. Desideri scaricare i dati escludendo le sessioni 'Individual' protette?")) {
                    performDownload(false);
                }
            } );
        } else {
            performDownload(true);
        }
    });
    elements.deleteDayDataBtn.addEventListener('click', () => {
        const date = elements.evaluationDatePicker.value;
        if (!date) {
            alert('Per favore, seleziona una data per poter eliminare i relativi dati.');
            return;
        }
        const formattedDate = new Date(date).toLocaleDateString('it-IT');
        if (confirm(`Sei sicuro di voler eliminare TUTTI i dati (valutazioni, GPS e premi) del giorno ${formattedDate}? L'azione è irreversibile.`)) {
            if (evaluations[date]) {
                delete evaluations[date];
            }
            if (awards[date]) {
                delete awards[date];
            }
            Object.keys(gpsData).forEach(athleteId => {
                if (gpsData[athleteId] && gpsData[athleteId][date]) {
                    delete gpsData[athleteId][date];
                }
            });
            saveData();
            updateAllUI();
            alert(`Tutti i dati del giorno ${formattedDate} sono stati eliminati.`);
        }
    });
    modalsContainer.addEventListener('click', (e) => {
        if (e.target.id === 'delete-single-athlete-day-btn') {
            const athleteId = document.getElementById('modal-athlete-id-eval').value;
            const date = elements.evaluationDatePicker.value;
            const athlete = athletes.find(a => a.id.toString() === athleteId);
            if (!athleteId || !date || !athlete) {
                alert("Errore: Impossibile trovare i dati necessari per l'eliminazione.");
                return;
            }
            const formattedDate = new Date(date).toLocaleDateString('it-IT');
            if (confirm(`Sei sicuro di voler eliminare tutti i dati di ${athlete.name} per il giorno ${formattedDate}?`)) {
                if (evaluations[date] && evaluations[date][athleteId]) {
                    delete evaluations[date][athleteId];
                }
                if (gpsData[athleteId] && gpsData[athleteId][date]) {
                    delete gpsData[athleteId][date];
                }
                if (awards[date]) {
                    awards[date] = awards[date].filter(a => a.athleteId.toString() !== athleteId.toString());
                    if (awards[date].length === 0) {
                        delete awards[date];
                    }
                }
                saveData().then(() => {
                    evaluationModal.hide();
                    updateAllUI();
                    alert(`Dati di ${athlete.name} per il giorno ${formattedDate} eliminati.`);
                });
            }
        }
    });
    modalsContainer.addEventListener('change', (e) => {
        if (e.target.id === 'gps-session-selector') {
            const athleteId = document.getElementById('modal-athlete-id-gps').value;
            const sessionId = e.target.value;
            const form = document.getElementById('gps-form');
            const populateGpsForm = (data) => {
                form.reset();
                document.getElementById('gps-session-id').value = data ? data.id : '';
                document.getElementById('match-stats-fields').style.display = 'none';
                document.getElementById('gps-data_di_registrazione').value = data ? data.data_di_registrazione : new Date().toISOString().split('T')[0];
                if(data){
                    allGpsFields.forEach(field => {
                        if (field === 'id') return;
                        const el = form.querySelector(`#gps-${field}`);
                        if (el && data[field] !== undefined) {
                            el.value = data[field];
                        }
                    });
                    if (data.tipo_sessione === 'Partita') {
                        document.getElementById('match-stats-fields').style.display = 'block';
                    }
                    const totalSec = data.tempo_circuito_totale_s || 0;
                    form.querySelector('#gps-tempo_circuito_min').value = totalSec > 0 ? Math.floor(totalSec / 60) : '';
                    form.querySelector('#gps-tempo_circuito_sec').value = totalSec > 0 ? Math.floor(totalSec % 60) : '';
                    form.querySelector('#gps-tempo_circuito_cen').value = totalSec > 0 ? Math.round((totalSec - Math.floor(totalSec)) * 100) : '';
                } else {
                    form.querySelector('#gps-data_di_registrazione').valueAsDate = new Date();
                }
            };
            const session = findSessionById(sessionId);
            if (session) {
                const processAndPopulate = () => {
                    let deleteBtn = document.getElementById('delete-gps-session-btn');
                    deleteBtn.disabled = false;
                    const newDeleteBtn = deleteBtn.cloneNode(true);
                    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                    populateGpsForm(session);
                    newDeleteBtn.addEventListener('click', () => {
                        if (confirm(`Sei sicuro di voler eliminare questa sessione?`)) {
                            if(gpsData[athleteId][session.date]){
                                gpsData[athleteId][session.date] = gpsData[athleteId][session.date].filter(s => String(s.id) !== String(sessionId));
                                if(gpsData[athleteId][session.date].length === 0){
                                    delete gpsData[athleteId][session.date];
                                }
                            }
                            saveData().then(() => {
                                gpsModal.hide();
                                updateAllUI();
                            });
                        }
                    });
                };
                if (session.tipo_sessione === 'Individual' && !isAuthenticated()) {
                    requestAuthentication(processAndPopulate, () => e.target.value = '');
                } else {
                    processAndPopulate();
                }
            } else {
                populateGpsForm(null);
                document.getElementById('delete-gps-session-btn').disabled = true;
            }
        }
    });
    elements.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) { return; }
        const reader = new FileReader();
        reader.onload = (event) => {
            if (confirm("ATTENZIONE: L'importazione sovrascriverà tutti i dati attuali. Vuoi continuare?")) {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (importedData && typeof importedData === 'object' && 'athletes' in importedData) {
                        athletes = importedData.athletes || [];
                        evaluations = importedData.evaluations || {};
                        gpsData = importedData.gpsData || {};
                        awards = importedData.awards || {};
                        trainingSessions = importedData.trainingSessions || {};
                        formationData = importedData.formationData || { starters: [], bench: [], tokens: [] };
                        matchResults = importedData.matchResults || {};
                        athletes.forEach(athlete => {
                            if (athlete.isViceCaptain === undefined) athlete.isViceCaptain = false;
                            if (athlete.isGuest === undefined) athlete.isGuest = false;
                        });
                        migrateGpsData();
                        saveData().then(() => {
                            updateAllUI();
                            alert('Dati importati con successo!');
                        });
                    } else {
                        alert('Errore: Il file non sembra avere il formato corretto.');
                    }
                } catch (error) {
                    alert(`Errore durante la lettura del file JSON: ${error.message}`);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    });
    elements.performanceFilterToggle.addEventListener('click', (e) => {
        if (e.target.matches('.btn')) {
            elements.performanceFilterToggle.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            performanceFilterType = e.target.dataset.type;
            populatePerformanceSelectors();
        }
    });
    elements.multiAthleteTypeSelector.addEventListener('click', (e) => {
        if (e.target.matches('.btn')) {
            elements.multiAthleteTypeSelector.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            multiAthleteFilterType = e.target.dataset.type;
            updateMultiAthleteChart();
        }
    });
    document.addEventListener('click', (e) => {
        const exportExcelBtn = e.target.closest('#export-excel');
        const exportPdfBtn = e.target.closest('#export-pdf');
        if (exportExcelBtn) {
            const validSelections = performanceSelections.filter(s => s.athleteId && s.sessionId);
            if (validSelections.length === 0) return;
            const data = validSelections.map(selection => {
                const athlete = athletes.find(a => a.id.toString() === selection.athleteId.toString());
                const gpsRecord = findSessionById(selection.sessionId) || {};
                const row = {
                    Atleta: athlete?.name || 'N/A',
                    Data: new Date(gpsRecord.date).toLocaleDateString('it-IT'),
                    Ora: gpsRecord.ora_registrazione || 'N/A',
                    Tipo: gpsRecord.tipo_sessione || 'N/A'
                };
                Object.entries(gpsFieldsForDisplay).forEach(([key, label]) => {
                    if (!['Data', 'Ora', 'Tipo'].includes(label)) row[label] = gpsRecord[key] ?? 'N/A';
                });
                return row;
            });
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Performance");
            XLSX.writeFile(wb, `performance_${new Date().toISOString().split('T')[0]}.xlsx`);
        }
        else if (exportPdfBtn) {
            const validSelections = performanceSelections.filter(s => s.athleteId && s.sessionId);
            if (validSelections.length === 0) return;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({orientation: 'landscape'});
            const head = ['Atleta', 'Data', 'Ora', 'Tipo', ...Object.values(gpsFieldsForDisplay).filter(label => !['Data', 'Ora', 'Tipo'].includes(label))];
            const body = validSelections.map(selection => {
                const athlete = athletes.find(a => a.id.toString() === selection.athleteId.toString());
                const gpsRecord = findSessionById(selection.sessionId) || {};
                return [
                    athlete?.name || 'N/A',
                    new Date(gpsRecord.date).toLocaleDateString('it-IT'),
                    gpsRecord.ora_registrazione || 'N/A',
                    gpsRecord.tipo_sessione || 'N/A',
                    ...Object.keys(gpsFieldsForDisplay).filter(key => !['data_di_registrazione', 'ora_registrazione', 'tipo_sessione'].includes(key)).map(key => gpsRecord[key] ?? 'N/A')
                ];
            });
            doc.autoTable({
                head: [head],
                body,
                styles: { fontSize: 6 },
                headStyles: { fillColor: [10, 36, 99] },
                columnStyles: { 0: {cellWidth: 20}, 1: {cellWidth: 18}, 2: {cellWidth: 15}, 3: {cellWidth: 20} }
            });
            doc.save(`performance_${new Date().toISOString().split('T')[0]}.pdf`);
        }
    });
    let draggedEl = null;
    let dragGhost = null;
    let offsetX, offsetY;
    function onDragStart(e) {
        const target = e.target.closest('.player-jersey, .available-player, .tool-item, .token');
        if (!target || target.classList.contains('disabled') || e.button !== 0) return;
        e.preventDefault();
        draggedEl = target;
        if (draggedEl.classList.contains('available-player')) {
            const athleteId = draggedEl.dataset.athleteId;
            const athlete = athletes.find(a => String(a.id) === athleteId);
            if (!athlete) return;
            dragGhost = createJerseyElement(athlete);
        } else {
            dragGhost = draggedEl.cloneNode(true);
        }
        dragGhost.classList.add('dragging');
        document.body.appendChild(dragGhost);
        const rect = draggedEl.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        dragGhost.style.left = `${e.clientX - offsetX}px`;
        dragGhost.style.top = `${e.clientY - offsetY}px`;
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd, { once: true });
    }
    function onDragMove(e) {
        if (!dragGhost) return;
        dragGhost.style.left = `${e.clientX - offsetX}px`;
        dragGhost.style.top = `${e.clientY - offsetY}px`;
    }
    function onDragEnd(e) {
        if (!draggedEl || !dragGhost) {
            cleanUpDrag();
            return;
        }
        dragGhost.style.display = 'none';
        const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
        dragGhost.style.display = '';
        const dropZone = dropTarget ? dropTarget.closest('.drop-zone') : null;
        if (dropZone) {
            const athleteId = draggedEl.dataset.athleteId;
            const itemType = draggedEl.dataset.itemType;
            const tokenId = draggedEl.dataset.tokenId;
            if (athleteId) {
                formationData.starters = formationData.starters.filter(p => p.athleteId != athleteId);
                formationData.bench = formationData.bench.filter(p => p.athleteId != athleteId);
            } else if (tokenId) {
                formationData.tokens = formationData.tokens.filter(t => t.id != tokenId);
            }
            const rect = dropZone.getBoundingClientRect();
            const left = ((e.clientX - rect.left) / rect.width) * 100;
            const top = ((e.clientY - rect.top) / rect.height) * 100;
            if (athleteId) {
                if (dropZone.id === 'field-container' || dropZone.id === 'field-bench-area') {
                    const targetArray = dropZone.id === 'field-container' ? formationData.starters : formationData.bench;
                    targetArray.push({ athleteId, top, left });
                }
            } else if (itemType) {
                if (dropZone.id === 'field-container' || dropZone.id === 'field-bench-area') {
                    const newId = tokenId || Date.now().toString();
                    if (itemType === 'opponent' && (draggedEl.classList.contains('tool-item') || !tokenId)) {
                        formationData.tokens.push({ id: newId, type: itemType, top, left });
                    } else {
                        formationData.tokens = formationData.tokens.filter(t => t.type !== itemType);
                        formationData.tokens.push({ id: newId, type: itemType, top, left });
                    }
                }
            }
            saveData();
            renderFormation();
        }
        cleanUpDrag();
    }
    function cleanUpDrag() {
        if (dragGhost) {
            dragGhost.remove();
        }
        draggedEl = null;
        dragGhost = null;
        document.removeEventListener('mousemove', onDragMove);
    };
    document.getElementById('formazione-section').addEventListener('mousedown', onDragStart);
    document.body.addEventListener('click', (e) => {
        const printBtn = e.target.closest('.print-section-btn');
        if (printBtn) {
            const sectionToPrint = printBtn.closest('.printable-area');
            if (sectionToPrint) {
                sectionToPrint.classList.add('printing-now');
                window.print();
            }
        }
    });
    window.addEventListener('beforeprint', () => {
        for (const key in chartInstances) {
            const chart = chartInstances[key];
            if (chart.options.scales) {
                Object.values(chart.options.scales).forEach(scale => {
                    if (scale.ticks) scale.ticks.color = '#000';
                    if (scale.pointLabels) scale.pointLabels.color = '#000';
                    if (scale.grid) scale.grid.color = '#ccc';
                    if (scale.angleLines) scale.angleLines.color = '#ccc';
                });
            }
            if (chart.options.plugins?.legend) {
                chart.options.plugins.legend.labels.color = '#000';
            }
            if (chart.options.plugins?.title) {
                chart.options.plugins.title.color = '#000';
            }
            chart.update('none');
        }
    });
    window.addEventListener('afterprint', () => {
        const printedSection = document.querySelector('.printing-now');
        if (printedSection) {
            printedSection.classList.remove('printing-now');
        }
        for (const key in chartInstances) {
            const chart = chartInstances[key];
            if (chart.options.scales) {
                Object.values(chart.options.scales).forEach(scale => {
                    if (scale.ticks) scale.ticks.color = '#fff';
                    if (scale.pointLabels) scale.pointLabels.color = '#fff';
                    if (scale.grid) scale.grid.color = 'rgba(241, 241, 241, 0.2)';
                    if (scale.angleLines) scale.angleLines.color = 'rgba(241, 241, 241, 0.2)';
                });
            }
            if (chart.options.plugins?.legend) {
                chart.options.plugins.legend.labels.color = '#fff';
            }
            if (chart.options.plugins?.title) {
                chart.options.plugins.title.color = '#fff';
            }
            chart.update('none');
        }
    });
    const openMatchResultModal = (matchId = null) => {
        elements.matchResultForm.reset();
        document.getElementById('scorers-container').innerHTML = '';
        document.getElementById('assists-container').innerHTML = '';
        document.getElementById('cards-container').innerHTML = '';
        if (matchId && matchResults[matchId]) {
            const match = matchResults[matchId];
            document.getElementById('matchResultModalLabel').textContent = "Modifica Risultato Partita";
            document.getElementById('match-id').value = match.id;
            document.getElementById('match-date').value = match.date;
            document.getElementById('match-time').value = match.time || '';
            document.getElementById('match-venue').value = match.venue || '';
            document.getElementById('match-opponent-name').value = match.opponentName;
            document.getElementById('match-location').value = match.location;
            document.getElementById('match-my-team-score').value = match.location === 'home' ? match.homeScore : match.awayScore;
            document.getElementById('match-opponent-score').value = match.location === 'home' ? match.awayScore : match.homeScore;
            elements.deleteMatchBtn.style.display = 'block';
            match.scorers.forEach(addScorerInput);
            match.assists.forEach(addAssistInput);
            match.cards.forEach(addCardInput);
        } else {
            document.getElementById('matchResultModalLabel').textContent = "Inserisci Risultato Partita";
            document.getElementById('match-id').value = '';
            document.getElementById('match-date').valueAsDate = new Date();
            document.getElementById('match-time').value = '';
            document.getElementById('match-venue').value = '';
            elements.deleteMatchBtn.style.display = 'none';
        }
        matchResultModal.show();
    };
    const addScorerInput = (scorer = {}) => {
        const container = document.getElementById('scorers-container');
        const div = document.createElement('div');
        div.className = 'd-flex gap-2 align-items-center';
        div.innerHTML = `<select class="form-select form-select-sm scorer-athlete" required><option value="">Seleziona atleta...</option>${athletes.map(a => `<option value="${a.id}" ${scorer.athleteId == a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select><input type="number" class="form-control form-control-sm scorer-minute" placeholder="Min" min="1" style="width: 80px;" value="${scorer.minute || ''}" required><button type="button" class="btn btn-sm btn-outline-danger remove-row-btn"><i class="bi bi-trash"></i></button>`;
        container.appendChild(div);
    };
    const addAssistInput = (assist = {}) => {
        const container = document.getElementById('assists-container');
        const div = document.createElement('div');
        div.className = 'd-flex gap-2 align-items-center';
        div.innerHTML = `<select class="form-select form-select-sm assist-athlete" required><option value="">Seleziona atleta...</option>${athletes.map(a => `<option value="${a.id}" ${assist.athleteId == a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select><input type="number" class="form-control form-control-sm assist-minute" placeholder="Min" min="1" style="width: 80px;" value="${assist.minute || ''}" required><button type="button" class="btn btn-sm btn-outline-danger remove-row-btn"><i class="bi bi-trash"></i></button>`;
        container.appendChild(div);
    };
    const addCardInput = (card = {}) => {
        const container = document.getElementById('cards-container');
        const div = document.createElement('div');
        div.className = 'd-flex gap-2 align-items-center';
        div.innerHTML = `<select class="form-select form-select-sm card-athlete" required><option value="">Seleziona atleta...</option>${athletes.map(a => `<option value="${a.id}" ${card.athleteId == a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select><select class="form-select form-select-sm card-type" style="width: 120px;" required><option value="yellow" ${card.type === 'yellow' ? 'selected' : ''}>Giallo</option><option value="red" ${card.type === 'red' ? 'selected' : ''}>Rosso</option></select><input type="number" class="form-control form-control-sm card-minute" placeholder="Min" min="1" style="width: 80px;" value="${card.minute || ''}" required><button type="button" class="btn btn-sm btn-outline-danger remove-row-btn"><i class="bi bi-trash"></i></button>`;
        container.appendChild(div);
    };
    elements.addMatchBtn.addEventListener('click', () => openMatchResultModal());
    document.getElementById('add-scorer-btn').addEventListener('click', () => addScorerInput());
    document.getElementById('add-assist-btn').addEventListener('click', () => addAssistInput());
    document.getElementById('add-card-btn').addEventListener('click', () => addCardInput());
    modalsContainer.addEventListener('click', e => {
        if (e.target.closest('.remove-row-btn')) {
            e.target.closest('.d-flex').remove();
        }
    });
    elements.matchResultForm.addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('match-id').value || Date.now();
        const location = document.getElementById('match-location').value;
        const myTeamScoreInput = document.getElementById('match-my-team-score').value;
        const opponentScoreInput = document.getElementById('match-opponent-score').value;
        const myTeamScore = myTeamScoreInput === '' ? null : parseInt(myTeamScoreInput);
        const opponentScore = opponentScoreInput === '' ? null : parseInt(opponentScoreInput);
        const matchData = {
            id: id,
            date: document.getElementById('match-date').value,
            time: document.getElementById('match-time').value,
            venue: document.getElementById('match-venue').value,
            opponentName: document.getElementById('match-opponent-name').value.trim(),
            location: location,
            homeScore: location === 'home' ? myTeamScore : opponentScore,
            awayScore: location === 'away' ? myTeamScore : opponentScore,
            scorers: [],
            assists: [],
            cards: []
        };
        document.querySelectorAll('#scorers-container .d-flex').forEach(row => {
            matchData.scorers.push({
                athleteId: row.querySelector('.scorer-athlete').value,
                minute: row.querySelector('.scorer-minute').value
            });
        });
        document.querySelectorAll('#assists-container .d-flex').forEach(row => {
            matchData.assists.push({
                athleteId: row.querySelector('.assist-athlete').value,
                minute: row.querySelector('.assist-minute').value
            });
        });
        document.querySelectorAll('#cards-container .d-flex').forEach(row => {
            matchData.cards.push({
                athleteId: row.querySelector('.card-athlete').value,
                type: row.querySelector('.card-type').value,
                minute: row.querySelector('.card-minute').value
            });
        });
        matchResults[id] = matchData;
        saveData();
        updateAllUI();
        matchResultModal.hide();
    });
    elements.deleteMatchBtn.addEventListener('click', () => {
        const id = document.getElementById('match-id').value;
        if (id && confirm('Sei sicuro di voler eliminare questa partita?')) {
            delete matchResults[id];
            saveData();
            updateAllUI();
            matchResultModal.hide();
        }
    });
    elements.matchOpponentFilter.addEventListener('change', updateMatchAnalysisChart);
    elements.matchPeriodToggle.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            elements.matchPeriodToggle.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateMatchAnalysisChart();
        }
    });
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
    async function initializeApp() {
        await loadData();
        const today = new Date();
        elements.evaluationDatePicker.valueAsDate = today;
        elements.evaluationDatePicker2.valueAsDate = today;
        elements.multiAthleteDatepicker.valueAsDate = today;
        updateAllUI();
        startPolling();
    }
    initializeApp();
});