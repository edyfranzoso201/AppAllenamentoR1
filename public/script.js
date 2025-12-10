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

    // ✅ MODIFICA: Aggiunto "Assenza Giustificata" nel select di "Presenza Allenamento"
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
        comparison