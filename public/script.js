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
    // ✅ MODIFICA 1: Aggiunta opzione "4-Assenza Giustificata" nel modale di valutazione
    modalsContainer.innerHTML = `<div class="modal fade" id="evaluationModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Valutazione di <span id="modal-athlete-name-eval"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="evaluation-form"><input type="hidden" id="modal-athlete-id-eval"><p>Data: <strong id="modal-evaluation-date"></strong></p><div class="mb-2"><label class="form-label">Presenza Allenamento</label><select id="presenza-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option><option value="4">4-Assenza Giustificata</option></select></div><div class="mb-2"><label class="form-label">Serietà Allenamento</label><select id="serieta-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Allenamento</label><select id="abbigliamento-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Partita</label><select id="abbigliamento-partita" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Serietà Comunicazioni</label><select id="comunicazioni" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Doccia (Opzionale)</label><select id="doccia" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="award-checkbox"><label class="form-check-label" for="award-checkbox">Assegna Premio</label></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-single-athlete-day-btn">Elimina Dati del Giorno</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="evaluation-form">Salva Valutazione</button></div></div></div></div></div> <div class="modal fade" id="athleteModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="athleteModalLabel">Gestisci Atleta</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="athlete-form"><input type="hidden" id="modal-athlete-id"><div class="mb-3"><label class="form-label">Nome Cognome</label><input type="text" class="form-control" id="athlete-name" required></div><div class="mb-3"><label for="athlete-avatar-input" class="form-label">Foto Profilo</label><input type="file" class="form-control" id="athlete-avatar-input" accept="image/*"><input type="hidden" id="athlete-avatar-base64"><img id="avatar-preview" src="" alt="Anteprima" class="mt-2" style="max-width: 70px; max-height: 70px; display: none; border-radius: 50%;"></div><div class="mb-3"><label class="form-label">Ruolo</label><input type="text" class="form-control" id="athlete-role" required></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Numero Maglia</label><input type="number" class="form-control" id="athlete-number" required min="1"></div><div class="col-md-6 mb-3"><label class="form-label">Scadenza Visita Medica</label><input type="date" class="form-control" id="scadenza-visita"></div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Data Prenotazione Visita</label><input type="date" class="form-control" id="prenotazione-visita"></div></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-captain"><label class="form-label" for="athlete-captain">Capitano</label></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-vice-captain"><label class="form-label" for="athlete-vice-captain">Vice Capitano</label></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-guest"><label class="form-label" for="athlete-guest">Atleta Ospite (non in rosa)</label></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="athlete-form">Salva Atleta</button></div></div></div></div> <div class="modal fade" id="gpsModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="gpsModalLabel">Dati Performance di <span id="modal-athlete-name-gps"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="gps-form"><input type="hidden" id="modal-athlete-id-gps"><input type="hidden" id="gps-session-id"> <div class="row mb-3"><div class="col-md-8"><label for="gps-session-selector" class="form-label">Seleziona Sessione Esistente per Modificare</label><select id="gps-session-selector" class="form-select"><option value="">--- Inserisci Nuova Sessione ---</option></select></div><div class="col-md-4 d-flex align-items-end"><button type="button" id="delete-gps-session-btn" class="btn btn-outline-danger w-100" disabled>Elimina Sessione</button></div></div><hr> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Registrazione</label><input type="date" class="form-control" id="gps-data_di_registrazione" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Registrazione</label><input type="time" class="form-control" id="gps-ora_registrazione"></div><div class="col-md-4 mb-3"><label class="form-label">Tipo Sessione</label><select class="form-select" id="gps-tipo_sessione"><option value="Allenamento">Allenamento</option><option value="Partita">Partita</option><option value="Individual">Individual</option></select></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Distanza Totale (m)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_totale" placeholder="es. 10500"></div><div class="col-md-4 mb-3"><label class="form-label">Tempo Totale (min)</label><input type="number" step="0.1" class="form-control" id="gps-tempo_totale" placeholder="es. 92"></div><div class="col-md-4 mb-3"><label class="form-label">Distanza per Minuto (m/min)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_per_minuto" readonly></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Distanza Sprint (m)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_sprint"></div><div class="col-md-4 mb-3"><label class="form-label">Velocità Massima (km/h)</label><input type="number" step="0.1" class="form-control" id="gps-velocita_massima"></div><div class="col-md-4 mb-3"><label class="form-label">Numero di Sprint</label><input type="number" class="form-control" id="gps-numero_di_sprint"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Max Acc (g)o(n°)</label><input type="number" step="0.1" class="form-control" id="gps-max_acc"></div><div class="col-md-4 mb-3"><label class="form-label">Max Dec (g)o(n°)</label><input type="number" step="0.1" class="form-control" id="gps-max_dec"></div><div class="col-md-4 mb-3"><label class="form-label">Passaggi Piede Sinistro</label><input type="number" class="form-control" id="gps-passaggi_piede_sinistro"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Passaggi Piede Destro</label><input type="number" class="form-control" id="gps-passaggi_piede_destro"></div><div class="col-md-4 mb-3"><label class="form-label">Cross Piede Sinistro</label><input type="number" step="0.1" class="form-control" id="gps-cross_piede_sinistro"></div><div class="col-md-4 mb-3"><label class="form-label">Cross Piede Destro</label><input type="number" step="0.1" class="form-control" id="gps-cross_piede_destro"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Potenza Massima di Tiro (km/h)</label><input type="number" step="0.1" class="form-control" id="gps-potenza_massima_di_tiro"></div><div class="col-md-4 mb-3"><label class="form-label">Tiri Piede SX</label><input type="number" class="form-control" id="gps-tiri_piede_sx"></div><div class="col-md-4 mb-3"><label class="form-label">Tiri Piede DX</label><input type="number" class="form-control" id="gps-tiri_piede_dx"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">% Passaggi Brevi</label><input type="number" step="0.1" class="form-control" id="gps-perc_passaggi_brevi"></div><div class="col-md-4 mb-3"><label class="form-label">% Lanci</label><input type="number" step="0.1" class="form-control" id="gps-perc_lanci"></div><div class="col-md-4 mb-3"><label class="form-label">Distanza Circuito (m)</label><input type="number" step="1" class="form-control" id="gps-distanza_circuito" placeholder="es. 400"></div></div> <div class="row align-items-end"><div class="col-md-5 mb-3"><label class="form-label">Tempo Circuito</label><div class="input-group"><input type="number" class="form-control" id="gps-tempo_circuito_min" placeholder="Min" min="0"><span class="input-group-text">:</span><input type="number" class="form-control" id="gps-tempo_circuito_sec" placeholder="Sec" min="0" max="59"><span class="input-group-text">.</span><input type="number" class="form-control" id="gps-tempo_circuito_cen" placeholder="Cen" min="0" max="99"></div></div><div class="col-md-4 mb-3"><label class="form-label">Velocità (km/h)</label><input type="text" class="form-control" id="gps-velocita_circuito" readonly></div></div> <div id="match-stats-fields" style="display: none;"><hr><h5 class="mb-3">Statistiche Partita</h5><div class="row"><div class="col-md-3 mb-3"><label class="form-label">Minuti Giocati</label><input type="number" class="form-control" id="gps-minuti_giocati"></div><div class="col-md-3 mb-3"><label class="form-label">Gol</label><input type="number" class="form-control" id="gps-gol"></div><div class="col-md-3 mb-3"><label class="form-label">Assist</label><input type="number" class="form-control" id="gps-assist"></div><div class="col-md-3 mb-3"><label class="form-label">Ammonizioni</label><input type="number" class="form-control" id="gps-ammonizioni"></div></div><div class="row"><div class="col-md-3 mb-3"><label class="form-label">Espulsioni</label><input type="number" class="form-control" id="gps-espulsioni"></div><div class="col-md-3 mb-3"><label class="form-label">Palle Recuperate</label><input type="number" class="form-control" id="gps-palle_recuperate"></div><div class="col-md-3 mb-3"><label class="form-label">Palle Perse</label><input type="number" class="form-control" id="gps-palle_perse"></div></div></div> <div class="row"><div class="col-12 mb-3"><label class="form-label">Note (opzionale)</label><textarea class="form-control" id="gps-note" rows="2" placeholder="Es. Allenamento intenso, recupero infortunio, ecc."></textarea></div></div> </form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="gps-form">Salva Dati GPS</button></div></div></div></div> <div class="modal fade" id="sessionModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="sessionModalLabel">Pianifica Sessione</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="session-form"><input type="hidden" id="session-id"><div class="mb-3"><label class="form-label">Data</label><input type="date" class="form-control" id="session-date" required></div><div class="mb-3"><label class="form-label">Titolo/Tipo</label><input type="text" class="form-control" id="session-title" required placeholder="Es. Allenamento tecnico"></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Ora Inizio</label><input type="time" class="form-control" id="session-time"></div><div class="col-md-6 mb-3"><label class="form-label">Luogo</label><input type="text" class="form-control" id="session-location" placeholder="Es. Campo 1"></div></div><div class="mb-3"><label class="form-label">Obiettivi</label><input type="text" class="form-control" id="session-goals" placeholder="Es. Possesso palla, tiri in porta"></div><div class="mb-3"><label class="form-label">Descrizione Allenamento (un punto per riga)</label><textarea class="form-control" id="session-description" rows="5"></textarea></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-session-btn" style="display:none;">Elimina</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="session-form">Salva Sessione</button></div></div></div></div></div> <div class="modal fade" id="matchResultModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="matchResultModalLabel">Inserisci Risultato Partita</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="match-result-form"><input type="hidden" id="match-id"><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Partita</label><input type="date" class="form-control" id="match-date" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Partita</label><input type="time" class="form-control" id="match-time"></div><div class="col-md-4 mb-3"><label class="form-label">Luogo Fisico</label><input type="text" class="form-control" id="match-venue" placeholder="Es. Stadio Comunale"></div></div><div class="row"><div class="col-md-5 mb-3"><label class="form-label">Squadra Avversaria</label><input type="text" class="form-control" id="match-opponent-name" required></div><div class="col-md-3 mb-3"><label class="form-label">Luogo</label><select class="form-select" id="match-location"><option value="home">Casa</option><option value="away">Trasferta</option></select></div></div><div class="row align-items-center text-center"><div class="col-5"><label class="form-label">GO Sport</label><input type="number" class="form-control text-center" id="match-my-team-score" min="0" placeholder="Gol"></div><div class="col-2">-</div><div class="col-5"><label class="form-label">AVVERSARI</label><input type="number" class="form-control text-center" id="match-opponent-score" min="0" placeholder="Gol"></div></div><hr><div class="row mt-3"><div class="col-md-4"><h5><i class="bi bi-futbol"></i> Marcatori (GO Sport)</h5><div id="scorers-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-scorer-btn"><i class="bi bi-plus"></i> Aggiungi Marcatore</button></div><div class="col-md-4"><h5><i class="bi bi-person-raised-hand"></i> Assists (GO Sport)</h5><div id="assists-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-assist-btn"><i class="bi bi-plus"></i> Aggiungi Assist</button></div><div class="col-md-4"><h5><i class="bi bi-file-earmark-person"></i> Cartellini (GO Sport)</h5><div id="cards-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-card-btn"><i class="bi bi-plus"></i> Aggiungi Cartellino</button></div></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-match-btn" style="display:none;">Elimina Partita</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="match-result-form">Salva Partita</button></div></div></div></div></div> <div class="modal fade" id="passwordModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Accesso Richiesto</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><p>Per visualizzare questi dati è richiesta una password.</p><form id="password-form"><div class="mb-3"><label for="password-input" class="form-label">Password</label><input type="password" class="form-control" id="password-input" required><div id="password-error" class="text-danger mt-2" style="display: none;">Password non corretta.</div></div><button type="submit" class="btn btn-primary-custom w-100">Accedi</button></form></div></div></div></div>`;

    // ... [IL RESTO DEL CODICE DI INIZIALIZZAZIONE E DEFINIZIONE DELLE VARIABILI È IDENTICO] ...

    const evaluationModal = new bootstrap.Modal(document.getElementById('evaluationModal'));
    // ... [inizializzazione altri modali] ...

    const elements = { /* ... */ };

    // ... [definizione costanti, funzioni di autenticazione, ecc.] ...

    // ✅ MODIFICA 2: Funzione di calcolo punteggio (esclude "Assenza Giustificata" dal calcolo e dagli atleti ospiti)
    const calculateAthleteScore = (evaluation) => {
        if (!evaluation) return 0;
        let total = 0;
        for (const [key, value] of Object.entries(evaluation)) {
            if (key === 'doccia') continue;
            const numValue = parseInt(value, 10);
            // Escludi "Assenza Giustificata" (valore 4) dalla somma
            if (key === 'presenza-allenamento' && numValue === 4) {
                continue;
            }
            total += numValue || 0;
        }
        return total;
    };

    // ✅ MODIFICA 3: Aggiornamento grafico "Report Presenze" con barre separate
    const updateAttendanceChart = () => {
        const date = elements.evaluationDatePicker.value;
        if (!date) return;

        // ✅ Filtra SOLO gli atleti NON ospiti per il grafico delle presenze
        const officialAthletes = athletes.filter(a => !a.isGuest);
        const attendanceData = {};
        officialAthletes.forEach(a => attendanceData[String(a.id)] = { name: a.name, presence: 0, justifiedAbsence: 0 });

        const processEvaluations = (evals) => {
            Object.entries(evals).forEach(([id, ev]) => {
                if (attendanceData[id]) {
                    const value = parseInt(ev['presenza-allenamento'], 10) || 0;
                    if (value > 0 && value < 4) {
                        attendanceData[id].presence++;
                    } else if (value === 4) {
                        attendanceData[id].justifiedAbsence++;
                    }
                }
            });
        };

        if (attendanceChartPeriod === 'daily') {
            if (evaluations[date]) {
                processEvaluations({ [date]: evaluations[date] });
                // Per la vista giornaliera, il valore è binario (0 o 1)
                Object.values(attendanceData).forEach(a => {
                    a.presence = a.presence > 0 ? 1 : 0;
                    a.justifiedAbsence = a.justifiedAbsence > 0 ? 1 : 0;
                });
            }
        } else {
            let dateRange = [];
            if (attendanceChartPeriod === 'weekly') {
                const week = getWeekRange(date);
                dateRange = [week.start, week.end];
            } else if (attendanceChartPeriod === 'monthly') {
                const month = date.substring(0, 7);
                dateRange = Object.keys(evaluations).filter(d => d.startsWith(month));
            } else if (attendanceChartPeriod === 'semester') {
                const year = date.substring(0, 4);
                const month = parseInt(date.substring(5, 7), 10);
                const semesterStartMonth = month <= 6 ? '01' : '07';
                const startDate = `${year}-${semesterStartMonth}-01`;
                const endDate = `${year}-12-31`;
                dateRange = Object.keys(evaluations).filter(d => d >= startDate && d <= endDate);
            } else if (attendanceChartPeriod === 'annual') {
                const year = date.substring(0, 4);
                dateRange = Object.keys(evaluations).filter(d => d.startsWith(year));
            }

            dateRange.forEach(d => {
                if (evaluations[d]) {
                    processEvaluations({ [d]: evaluations[d] });
                }
            });
        }

        const sortedAttendance = Object.values(attendanceData).sort((a, b) => b.presence - a.presence);
        if(chartInstances.attendance) chartInstances.attendance.destroy();
        chartInstances.attendance = new Chart(document.getElementById('attendanceChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedAttendance.map(a => a.name),
                datasets: [
                    {
                        label: 'Presenze',
                        data: sortedAttendance.map(a => a.presence),
                        backgroundColor: 'rgba(217, 4, 41, 0.8)' // Rosso
                    },
                    {
                        label: 'Assenze Giustificate',
                        data: sortedAttendance.map(a => a.justifiedAbsence),
                        backgroundColor: 'rgba(0, 100, 0, 0.8)' // Verde scuro
                    }
                ]
            },
            options: {
                scales: {
                    y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } },
                    x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(241, 241, 241, 0.2)' } }
                },
                plugins: { legend: { labels: { color: '#ffffff' } } }
            }
        });
    };

    // ... [RESTO DEL CODICE DI CARICAMENTO DATI, GESTIONE UI, EVENTI, ECC.] ...

    // Assicurati che `updateHomePage` filtri già gli atleti ospiti (come da tuo codice originale)
    const updateHomePage = () => {
        // ✅ Conta solo atleti NON ospiti nel conteggio principale
        const officialAthletes = athletes.filter(a => !a.isGuest);
        elements.homeTotalAthletes.textContent = officialAthletes.length;
        // ... resto della funzione ...
    };

    // ... [inizializzazione finale dell'app] ...
    const initializeApp = async () => {
        await loadData();
        const today = new Date();
        elements.evaluationDatePicker.valueAsDate = today;
        updateAllUI();
        // startPolling(); // Opzionale
    };

    initializeApp();
});