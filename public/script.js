
function _chartParityColor() {
    // Pareggi in GRIGIO (verde riservato alle vittorie, rosso alle sconfitte)
    return '#94a3b8';
}

// ── Colori grafici tema-aware (v1.5.0: tema chiaro reso più visibile) ─────────────────────────────────────
function _chartTickColor() { return document.documentElement.classList.contains('theme-light') ? '#000000' : '#e2e8f0'; }
function _chartGridColor() { return document.documentElement.classList.contains('theme-light') ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.1)'; }

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
function generateId() {
    return crypto.randomUUID();
}
// ── Escape HTML (anti-XSS) ────────────────────────────────────────────────
// Neutralizza i caratteri speciali nei dati inseriti dagli utenti (nomi atleti,
// ruoli, motivazioni premi, avversari, link...) prima di concatenarli in
// innerHTML. Senza questo, un nome tipo "<img src=x onerror=alert(1)>" o un
// link tipo "');evil()//" eseguirebbe codice nella sessione di altri coach.
// Copre sia contenuto testuale sia valori dentro attributi src/onclick (apici).
function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Avatar con INIZIALI quando manca la foto: ricava 1-2 iniziali dal nome e uno
// sfondo colorato stabile (hash del nome) → card distinguibili anche senza foto,
// più professionale del cerchio vuoto uguale per tutti.
function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarColor(name) {
    const palette = ['#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#dc2626','#4f46e5','#0d9488','#ca8a04'];
    let h = 0; const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
}
function initialsAvatarHtml(name, cssClass) {
    return `<div class="${cssClass || 'athlete-avatar'} avatar-initials me-3" style="background:${avatarColor(name)};" aria-label="${escapeHtml(name)}">${escapeHtml(getInitials(name))}</div>`;
}
// Fallback robusto: se la foto avatar non carica, sostituisce l'<img> con il
// cerchio iniziali (niente HTML annidato fragile dentro onerror).
window.avatarFallback = function(img, name) {
    const div = document.createElement('div');
    div.className = (img.className || 'athlete-avatar') + ' avatar-initials';
    div.style.background = avatarColor(name);
    div.setAttribute('aria-label', name || '');
    div.textContent = getInitials(name);
    if (img.parentNode) img.parentNode.replaceChild(div, img);
};

// Nome della PROPRIA squadra/società da mostrare (es. risultati partita).
// Catena di fallback: dati app (teamName) → nome società in sessione →
// generico "La mia squadra". NON usare il brand app ("Sport Monitoring"):
// qui serve il nome della SQUADRA, non quello della piattaforma.
function getMyTeamName() {
    try {
        if (window._appData && window._appData.teamName) return window._appData.teamName;
        if (window._appData && window._appData.societyName) return window._appData.societyName;
        var s = sessionStorage.getItem('gosport_society_name');
        if (s) return s;
    } catch (e) { /* sessionStorage non disponibile */ }
    return 'La mia squadra';
}
// ==========================================
// GUARD: Verifica annata selezionata
// ==========================================
(function checkAnnataBeforeInit() {
    'use strict';
    
    // Skip check per modalità genitore
    const isParentMode = window.location.search.includes('athleteId=') || 
                         window.location.pathname.includes('/presenza/') ||
                         window.location.pathname.includes('/calendario');
    
    if (isParentMode) {
        console.log('👪 Modalità Genitore: skip controllo annata');
        return;
    }
    
    // Verifica autenticazione
    const isAuthenticated = sessionStorage.getItem('gosport_auth_session') === 'true';
    const currentAnnata = sessionStorage.getItem('gosport_current_annata');
    
    // Se autenticato MA senza annata = siamo sulla pagina di selezione
    // Non bloccare, lascia che auth-multi-annata.js gestisca la selezione
    if (isAuthenticated && !currentAnnata) {
        console.log('📅 Utente autenticato senza annata: pagina di selezione');
        return;
    }
    
    // Se non autenticato, blocca
    if (!isAuthenticated) {
        console.log('🔒 Utente non autenticato, blocco inizializzazione dashboard');
        return;
    }
    
    // Se autenticato CON annata, procedi
    console.log(`✅ Annata selezionata: ${currentAnnata}. Inizializzazione dashboard...`);
})();

document.addEventListener('DOMContentLoaded', () => {
    // ✅ Esce subito se non siamo nel dashboard principale
    const modalsContainer = document.getElementById('modals-container');
    if (!modalsContainer) return;

    // ==========================================
    // SISTEMA PERMESSI
    // ==========================================
    function getPermissions() {
        try {
            const stored = sessionStorage.getItem('gosport_permissions');
            if (stored) return JSON.parse(stored);
        } catch(e) {}
        // Fallback: deriva dai ruoli legacy
        const role = sessionStorage.getItem('gosport_user_role') || '';
        if (role === 'admin') return { canEditGeneral: true, canViewGPS: true, canEditGPS: true, isAdmin: true };
        if (role === 'coach_l0') return { canEditGeneral: true, canViewGPS: true, canEditGPS: true, isAdmin: false, isDashboard: true };
        if (role === 'coach_l1') return { canEditGeneral: true, canViewGPS: true, canEditGPS: true, isAdmin: false };
        if (role === 'coach_l2') return { canEditGeneral: true, canViewGPS: true, canEditGPS: false, isAdmin: false };
        if (role === 'coach_l3') return { canEditGeneral: false, canViewGPS: true, canEditGPS: false, isAdmin: false };
        if (role === 'coach_readonly') return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false };
        if (role === 'societa_l1')   return { canEditGeneral: true,  canViewGPS: true,  canEditGPS: false, isAdmin: false, isDashboard: true };
        if (role === 'dirigente_l1') return { canEditGeneral: true,  canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
        if (role === 'dirigente_l2') return { canEditGeneral: true,  canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
        if (role === 'dirigente_l3') return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
        if (role === 'dirigente_l4') return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
        if (role === 'societa_l3')   return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false, isDashboard: true };
        return { canEditGeneral: false, canViewGPS: false, canEditGPS: false, isAdmin: false };
    }

    function applyPermissions() {
        const perms = getPermissions();

        // --- GPS SECTIONS ---
        const gpsSections = [
            document.getElementById('confronto-squadra-section'),
            document.getElementById('monitoraggio-gps-section'),
            document.getElementById('analisi-singolo-section')
        ];
        gpsSections.forEach(el => {
            if (el) el.style.display = perms.canViewGPS ? '' : 'none';
        });

        // Nascondi anche i link/pulsanti di navigazione verso le sezioni GPS
        // (i tab della barra di navigazione sono <button data-tab="...">, non <a href>)
        document.querySelectorAll(
            'a[href="#monitoraggio-gps-section"], a[href="#analisi-singolo-section"], a[href="#confronto-squadra-section"], ' +
            '.tab-nav-btn[data-tab="monitoraggio-gps-section"], .tab-nav-btn[data-tab="analisi-singolo-section"]'
        ).forEach(el => {
            el.style.display = perms.canViewGPS ? '' : 'none';
        });

        // --- GPS EDIT: nasconde pulsante "Salva Dati GPS" e bottone GPS per atleta ---
        if (!perms.canEditGPS) {
            // Pulsante salva nel modal GPS
            const saveGpsBtn = document.querySelector('[form="gps-form"]');
            if (saveGpsBtn) saveGpsBtn.style.display = 'none';
            // Bottoni apertura modal GPS sugli atleti
            document.querySelectorAll('.gps-btn, [data-action="gps"], .open-gps-btn').forEach(el => {
                el.style.display = 'none';
            });
            const importBtn = document.getElementById('gps-import-btn');
            if (importBtn) importBtn.style.display = 'none';
            const importFormat = document.getElementById('gps-import-format');
            if (importFormat) importFormat.style.display = 'none';
        }

        // --- EDIT GENERALE: nasconde tutti i pulsanti di modifica/salvataggio/eliminazione ---
        if (!perms.canEditGeneral) {
            // Pulsanti salvataggio nei modal (statici)
            const editBtns = [
                document.querySelector('[form="evaluation-form"]'),   // Salva Valutazione
                document.querySelector('[form="athlete-form"]'),       // Salva Atleta
                document.querySelector('[form="session-form"]'),       // Salva Sessione
                document.querySelector('[form="match-result-form"]'),  // Salva Partita
                document.getElementById('add-athlete-btn'),
                document.getElementById('delete-single-athlete-day-btn'),
                document.getElementById('delete-session-btn'),
                document.getElementById('delete-match-btn'),
                document.getElementById('delete-gps-session-btn'),    // Elimina sessione GPS
                document.getElementById('add-scorer-btn'),             // Aggiungi marcatore
                document.getElementById('add-assist-btn'),             // Aggiungi assist
                document.getElementById('add-card-btn'),               // Aggiungi cartellino
            ];
            editBtns.forEach(el => { if (el) el.style.display = 'none'; });

            // Bottoni dinamici sulle card atleti (edit, delete)
            document.querySelectorAll('.edit-btn, .delete-btn, .remove-card-summary-row-btn, .remove-row-btn').forEach(el => {
                el.style.display = 'none';
            });

            // Bottone pagelle (rating-btn) - nasconde accesso alle pagelle
            document.querySelectorAll('.rating-btn').forEach(el => {
                el.style.display = 'none';
            });

            // Disabilita click su celle valutazione (calendario presenze)
            document.querySelectorAll('.eval-cell, .evaluation-cell, [data-eval], td[data-date]').forEach(el => {
                el.style.pointerEvents = 'none';
                el.style.cursor = 'default';
            });

            // Nascondi anche bottoni matita partite e aggiungi partita (statici)
            const addMatchBtn = document.getElementById('add-match-btn');
            if (addMatchBtn) addMatchBtn.style.display = 'none';
            const deleteMatchBtn = document.getElementById('delete-match-btn');
            if (deleteMatchBtn) deleteMatchBtn.style.display = 'none';

            // Osserva aggiunta dinamica di nuovi elementi
            const observer = new MutationObserver(() => {
                document.querySelectorAll(
                    '.edit-btn, .delete-btn, .remove-card-summary-row-btn, ' +
                    '.remove-row-btn, .rating-btn, .edit-match-btn'
                ).forEach(el => { el.style.display = 'none'; });
                document.querySelectorAll('td[data-date]').forEach(el => {
                    el.style.pointerEvents = 'none';
                    el.style.cursor = 'default';
                });
                // Nascondi Elimina Partita se appare nel modal
                const dmb = document.getElementById('delete-match-btn');
                if (dmb) dmb.style.display = 'none';
                // Nascondi Aggiungi Partita
                const amb = document.getElementById('add-match-btn');
                if (amb) amb.style.display = 'none';
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        console.log('🔒 Permessi applicati:', perms);
    }

    modalsContainer.innerHTML = `<div class="modal fade" id="evaluationModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Valutazione di <span id="modal-athlete-name-eval"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="evaluation-form"><input type="hidden" id="modal-athlete-id-eval"><p>Data: <strong id="modal-evaluation-date"></strong></p><div class="mb-2"><label class="form-label">Presenza &amp; Puntualità</label><select id="presenza-allenamento" class="form-select"><option value="3">Presente</option><option value="2">Ritardo lieve</option><option value="1">Ritardo forte</option><option value="0">Assente</option></select></div><div class="mb-2"><label class="form-label">Serietà Allenamento</label><select id="serieta-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Allenamento</label><select id="abbigliamento-allenamento" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Abbigliamento Partita</label><select id="abbigliamento-partita" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Serietà Comunicazioni</label><select id="comunicazioni" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><div class="mb-2"><label class="form-label">Doccia (Opzionale)</label><select id="doccia" class="form-select"><option value="0">0-NV</option><option value="1">1-B</option><option value="2">2-M</option><option value="3">3-A</option></select></div><hr class="my-2"><div class="mb-2"><label class="form-label fw-bold">🏋️ Presenza Individual</label><select id="presenza-individual" class="form-select"><option value="">— Non applicabile —</option><option value="0">0 — Assente</option><option value="1">1 — Presente</option><option value="s">Soc. — Non Fruita</option></select></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="award-checkbox"><label class="form-check-label" for="award-checkbox">Assegna Premio</label></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-single-athlete-day-btn">Elimina Dati del Giorno</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="evaluation-form">Salva Valutazione</button></div></div></div></div></div> <div class="modal fade" id="athleteModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="athleteModalLabel">Gestisci Atleta</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="athlete-form"><input type="hidden" id="modal-athlete-id"><input type="hidden" id="modal-tipo-persona" value="atleta"><div class="mb-3"><label class="form-label fw-bold">👤 Tipo Persona</label><div class="d-flex gap-2 mb-2"><button type="button" id="tipo-atleta-btn" onclick="window._setTipoPersona('atleta')" class="btn btn-sm flex-fill" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;">⚽ Atleta</button><button type="button" id="tipo-allenatore-btn" onclick="window._setTipoPersona('allenatore')" class="btn btn-sm flex-fill" style="background:#374151;color:#9ca3af;border:none;border-radius:6px;">👕 Allenatore</button><button type="button" id="tipo-dirigente-btn" onclick="window._setTipoPersona('dirigente')" class="btn btn-sm flex-fill" style="background:#374151;color:#9ca3af;border:none;border-radius:6px;">🎖️ Dirigente</button></div></div><div class="row"><div class="col-6 mb-3"><label class="form-label">Nome <span style="color:#ef4444">*</span></label><input type="text" class="form-control" id="athlete-nome" required placeholder="es. Mario" oninput="window.validateCF()"></div><div class="col-6 mb-3"><label class="form-label">Cognome <span style="color:#ef4444">*</span></label><input type="text" class="form-control" id="athlete-cognome" required placeholder="es. Rossi" oninput="window.validateCF()"></div></div><div class="mb-3"><label class="form-label">Foto Profilo — URL (Google Drive / link diretto)</label><div class="input-group"><input type="text" class="form-control" id="athlete-avatar-url" placeholder="https://drive.google.com/uc?id=... oppure https://img.esempio.com/foto.jpg"></div><img id="avatar-preview" src="" alt="" class="mt-2" style="max-width:70px;max-height:70px;display:none;border-radius:50%;"><input type="hidden" id="athlete-avatar-base64"><small class="text-muted">La foto resta su Google Drive. Condividi → Chiunque → copia link → sostituisci /view con /preview oppure usa uc?id=ID_FILE</small></div><div class="mb-3"><label class="form-label">Ruolo</label><input type="text" class="form-control" id="athlete-role" required></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Email <small class="text-muted">(opzionale)</small></label><input type="email" class="form-control" id="athlete-email" placeholder="es. mario@email.com"></div><div class="col-md-6 mb-3"><label class="form-label">Telefono <small class="text-muted">(opzionale)</small></label><input type="tel" class="form-control" id="athlete-phone" placeholder="es. 333 1234567"></div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Numero Maglia <small class="text-muted">(opzionale)</small></label><input type="text" class="form-control" id="athlete-number" maxlength="10" placeholder="es. 10, GK, 10-A"></div><div class="col-md-6 mb-3"><label class="form-label">Scadenza Visita Medica</label><input type="date" class="form-control" id="scadenza-visita"></div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Data Prenotazione Visita</label><input type="date" class="form-control" id="prenotazione-visita"></div><div class="col-md-6 mb-3"><label class="form-label">Scadenza Tessera</label><input type="date" class="form-control" id="scadenza-tessera"></div></div><hr class="my-2"><div class="mb-2"><small class="fw-bold" style="color:#60a5fa;"><i class="bi bi-shield-fill"></i> Dati Anagrafici FIGC <span class="text-muted fw-normal">(opzionale)</span></small></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Sesso</label><select class="form-select" id="athlete-sesso" onchange="window.validateCF()"><option value="">—</option><option value="M">Maschio</option><option value="F">Femmina</option></select></div><div class="col-md-6 mb-3"><label class="form-label">Data di Nascita</label><input type="date" class="form-control" id="athlete-data-nascita" oninput="window.validateCF()"></div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Comune di Nascita</label><input type="text" class="form-control" id="athlete-comune-nascita" placeholder="es. Roma"></div><div class="col-md-6 mb-3"><label class="form-label">Prov.</label><input type="text" class="form-control" id="athlete-provincia-nascita" placeholder="es. RM" maxlength="2" style="text-transform:uppercase;"></div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Codice Fiscale</label><input type="text" class="form-control" id="athlete-codice-fiscale" placeholder="es. RSSMRA80A01H501Z" maxlength="16" style="text-transform:uppercase;" oninput="window.validateCF()"><div id="cf-feedback" class="mt-1 small"></div></div><div class="col-md-3 mb-3"><label class="form-label">N° Tessera</label><input type="text" class="form-control" id="athlete-numero-tessera" placeholder="es. 12345678"></div><div class="col-md-3 mb-3"><label class="form-label">N° Matricola</label><input type="text" class="form-control" id="athlete-numero-matricola" placeholder="es. 12345678"></div></div><div class=\"mb-3\"><label class=\"form-label\"><i class=\"bi bi-file-earmark-medical-fill\" style=\"color:#16a34a;\"></i> Certificato Medico — Percorso / Link</label><div class=\"input-group\"><input type=\"text\" class=\"form-control\" id=\"athlete-cert-link\" placeholder=\"es. \\\\\\\\SERVER\\\\Certificati\\\\Rossi.pdf  o  https://drive.google.com/...\"><button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"var v=document.getElementById('athlete-cert-link').value;if(v)window.open(v,'_blank');\" title=\"Apri\"><i class=\"bi bi-box-arrow-up-right\"></i></button></div><small class=\"text-muted\">Percorso cartella di rete o link (Drive, OneDrive...). Il file rimane sul PC della società.</small></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-captain"><label class="form-label" for="athlete-captain">Capitano</label></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-vice-captain"><label class="form-label" for="athlete-vice-captain">Vice Capitano</label></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="athlete-guest"><label class="form-label" for="athlete-guest">Atleta Ospite (non in rosa)</label></div><div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="athlete-infortunato" onchange="document.getElementById('rientro-field').style.display=this.checked?'':'none';"><label class="form-label" for="athlete-infortunato">🤕 Infortunato</label></div><div class="mb-3" id="rientro-field" style="display:none;"><label class="form-label">Data Prevista Rientro</label><input type="date" class="form-control" id="data-rientro"></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="athlete-form">Salva Atleta</button></div></div></div></div> <div class="modal fade" id="individualModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">🏋️ Pacchetto Individual — <span id="individual-athlete-name"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="individual-form"><input type="hidden" id="ind-modal-athlete-id"><div class="mb-2"><label class="form-label fw-bold">Pacchetto Lezioni</label><select class="form-select" id="athlete-individual-pkg"><option value="">Nessuno</option><option value="5">5 Lezioni</option><option value="10+1">10 + 1 Recupero</option><option value="20+2">20 + 2 Recupero</option><option value="30+3">30 + 3 Recupero</option></select></div><div class="row"><div class="col-md-6 mb-2"><label class="form-label">Data Inizio Pacchetto</label><input type="date" class="form-control" id="athlete-individual-start" oninput="calcIndividualExpiry()"></div><div class="col-md-6 mb-2"><label class="form-label">Data Scadenza <small class="text-muted">(calcolata)</small></label><input type="date" class="form-control" id="athlete-individual-expiry"></div></div><div class="row"><div class="col-md-4 mb-2"><label class="form-label">Giorni/Sett. Individual</label><select class="form-select" id="athlete-ind-days-week"><option value="">—</option><option value="1">1 giorno</option><option value="2">2 giorni</option><option value="3">3 giorni</option><option value="4">4 giorni</option><option value="5">5 giorni</option><option value="6">6 giorni</option></select></div><div class="col-md-4 mb-2"><label class="form-label">Sessioni con Coach</label><select class="form-select" id="athlete-ind-coach-sessions"><option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option></select></div><div class="col-md-4 mb-2"><label class="form-label">Orario Preferito</label><input type="time" class="form-control" id="athlete-ind-time"></div></div><div class="mb-2"><label class="form-label">Giorni della Settimana</label><div class="d-flex flex-wrap gap-2" id="ind-days-selector"><div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="ind-day-1" value="1"><label class="form-check-label" for="ind-day-1">Lun</label></div><div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="ind-day-2" value="2"><label class="form-check-label" for="ind-day-2">Mar</label></div><div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="ind-day-3" value="3"><label class="form-check-label" for="ind-day-3">Mer</label></div><div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="ind-day-4" value="4"><label class="form-check-label" for="ind-day-4">Gio</label></div><div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="ind-day-5" value="5"><label class="form-check-label" for="ind-day-5">Ven</label></div><div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="ind-day-6" value="6"><label class="form-check-label" for="ind-day-6">Sab</label></div><div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="ind-day-0" value="0"><label class="form-check-label" for="ind-day-0">Dom</label></div></div></div><div class="mb-2"><label class="form-label">Nome Coach (opzionale)</label><input type="text" class="form-control" id="athlete-ind-coach" placeholder="es. Mario Rossi"></div><div class="mb-2"><label class="form-label">Colore Coach</label><input type="color" class="form-control form-control-color" id="athlete-ind-coach-color" value="#3b82f6" style="width:60px;height:38px;"></div><div class="mt-2 no-print"><button type="button" class="btn btn-outline-info btn-sm w-100" onclick="pianificaIndividualCalendario(document.getElementById('ind-modal-athlete-id').value)"><i class="bi bi-calendar-plus"></i> Pianifica sul Calendario Attività</button></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger btn-sm" onclick="window.resetIndividualPkg(document.getElementById('ind-modal-athlete-id').value)"><i class="bi bi-arrow-counterclockwise"></i> Azzera</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="individual-form">Salva Pacchetto</button></div></div></div></div></div> <div class="modal fade" id="gpsModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="gpsModalLabel">Dati Performance di <span id="modal-athlete-name-gps"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="gps-form"><input type="hidden" id="modal-athlete-id-gps"><input type="hidden" id="gps-session-id"> <div class="row mb-3"><div class="col-md-8"><label for="gps-session-selector" class="form-label">Seleziona Sessione Esistente per Modificare</label><select id="gps-session-selector" class="form-select"><option value="">--- Inserisci Nuova Sessione ---</option></select></div><div class="col-md-4 d-flex align-items-end"><button type="button" id="delete-gps-session-btn" class="btn btn-outline-danger w-100" disabled>Elimina Sessione</button></div></div><hr> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Registrazione</label><input type="date" class="form-control" id="gps-data_di_registrazione" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Registrazione</label><input type="time" class="form-control" id="gps-ora_registrazione"></div><div class="col-md-4 mb-3"><label class="form-label">Tipo Sessione</label><select class="form-select" id="gps-tipo_sessione"><option value="Allenamento">Allenamento</option><option value="Partita">Partita</option><option value="Individual">Individual</option></select></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Distanza Totale (m)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_totale" placeholder="es. 10500"></div><div class="col-md-4 mb-3"><label class="form-label">Tempo Totale (min)</label><input type="number" step="0.1" class="form-control" id="gps-tempo_totale" placeholder="es. 92"></div><div class="col-md-4 mb-3"><label class="form-label">Distanza per Minuto (m/min)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_per_minuto" readonly></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Distanza Sprint (m)</label><input type="number" step="0.1" class="form-control" id="gps-distanza_sprint"></div><div class="col-md-4 mb-3"><label class="form-label">Velocità Massima (km/h)</label><input type="number" step="0.1" class="form-control" id="gps-velocita_massima"></div><div class="col-md-4 mb-3"><label class="form-label">Numero di Sprint</label><input type="number" class="form-control" id="gps-numero_di_sprint"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Max Acc (g)o(n°)</label><input type="number" step="0.1" class="form-control" id="gps-max_acc"></div><div class="col-md-4 mb-3"><label class="form-label">Max Dec (g)o(n°)</label><input type="number" step="0.1" class="form-control" id="gps-max_dec"></div><div class="col-md-4 mb-3"><label class="form-label">Passaggi Piede Sinistro</label><input type="number" class="form-control" id="gps-passaggi_piede_sinistro"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Passaggi Piede Destro</label><input type="number" class="form-control" id="gps-passaggi_piede_destro"></div><div class="col-md-4 mb-3"><label class="form-label">Cross Piede Sinistro</label><input type="number" step="0.1" class="form-control" id="gps-cross_piede_sinistro"></div><div class="col-md-4 mb-3"><label class="form-label">Cross Piede Destro</label><input type="number" step="0.1" class="form-control" id="gps-cross_piede_destro"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">Potenza Massima di Tiro (km/h)</label><input type="number" step="0.1" class="form-control" id="gps-potenza_massima_di_tiro"></div><div class="col-md-4 mb-3"><label class="form-label">Tiri Piede SX</label><input type="number" class="form-control" id="gps-tiri_piede_sx"></div><div class="col-md-4 mb-3"><label class="form-label">Tiri Piede DX</label><input type="number" class="form-control" id="gps-tiri_piede_dx"></div></div> <div class="row"><div class="col-md-4 mb-3"><label class="form-label">% Passaggi Brevi</label><input type="number" step="0.1" class="form-control" id="gps-perc_passaggi_brevi"></div><div class="col-md-4 mb-3"><label class="form-label">% Lanci</label><input type="number" step="0.1" class="form-control" id="gps-perc_lanci"></div><div class="col-md-4 mb-3"><label class="form-label">Distanza Circuito (m)</label><input type="number" step="1" class="form-control" id="gps-distanza_circuito" placeholder="es. 400"></div></div> <div class="row align-items-end"><div class="col-md-5 mb-3"><label class="form-label">Tempo Circuito</label><div class="input-group"><input type="number" class="form-control" id="gps-tempo_circuito_min" placeholder="Min" min="0"><span class="input-group-text">:</span><input type="number" class="form-control" id="gps-tempo_circuito_sec" placeholder="Sec" min="0" max="59"><span class="input-group-text">.</span><input type="number" class="form-control" id="gps-tempo_circuito_cen" placeholder="Cen" min="0" max="99"></div></div><div class="col-md-4 mb-3"><label class="form-label">Velocità (km/h)</label><input type="text" class="form-control" id="gps-velocita_circuito" readonly></div></div> <div id="match-stats-fields" style="display: none;"><hr><h5 class="mb-3">Statistiche Partita</h5><div class="row"><div class="col-md-3 mb-3"><label class="form-label">Minuti Giocati</label><input type="number" class="form-control" id="gps-minuti_giocati"></div><div class="col-md-3 mb-3"><label class="form-label">Gol</label><input type="number" class="form-control" id="gps-gol"></div><div class="col-md-3 mb-3"><label class="form-label">Assist</label><input type="number" class="form-control" id="gps-assist"></div><div class="col-md-3 mb-3"><label class="form-label">Ammonizioni</label><input type="number" class="form-control" id="gps-ammonizioni"></div></div><div class="row"><div class="col-md-3 mb-3"><label class="form-label">Espulsioni</label><input type="number" class="form-control" id="gps-espulsioni"></div><div class="col-md-3 mb-3"><label class="form-label">Palle Recuperate</label><input type="number" class="form-control" id="gps-palle_recuperate"></div><div class="col-md-3 mb-3"><label class="form-label">Palle Perse</label><input type="number" class="form-control" id="gps-palle_perse"></div></div></div> <div class="row"><div class="col-12 mb-3"><label class="form-label">Note (opzionale)</label><textarea class="form-control" id="gps-note" rows="2" placeholder="Es. Allenamento intenso, recupero infortunio, ecc."></textarea></div></div> </form></div><div class="modal-footer"><div class="me-auto d-flex flex-wrap align-items-center gap-2"><select id="gps-import-format" class="form-select form-select-sm" style="width:auto;max-width:215px;"><option value="action_tracer_excel">Action Tracer Excel (.xlsx)</option></select><button type="button" id="gps-import-btn" class="btn btn-outline-info btn-sm"><i class="bi bi-download"></i> Importa</button><input type="file" id="gps-file-input" accept=".xlsx" style="display:none"><small id="gps-import-error" class="text-danger w-100" style="font-size:0.75rem;"></small></div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button><button type="submit" class="btn btn-primary-custom" form="gps-form">Salva Dati GPS</button></div></div></div></div> <div class="modal fade" id="sessionModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="sessionModalLabel">Pianifica Sessione</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="session-form"><input type="hidden" id="session-id"><div class="mb-3"><label class="form-label">Data</label><input type="date" class="form-control" id="session-date" required></div><div class="mb-3"><label class="form-label">Tipo Attività</label><select class="form-select" id="session-type" onchange="if(this.value)document.getElementById('session-title').value=this.value"><option value="">-- Seleziona tipo --</option><option value="Allenamento">Allenamento</option><option value="Partita">Partita</option><option value="Torneo">🏆 Torneo</option><option value="Campionato">🏅 Campionato</option><option value="Finale">🥇 Finale</option><option value="Semifinale">🥈 Semifinale</option><option value="Individual">🏋️ Individual</option><option value="Allenamento Portieri">Allenamento Portieri</option><option value="Preparazione Atletica">Preparazione Atletica</option><option value="Visita">🏥 Visita Medica</option><option value="Varie">🎉 Varie</option></select></div><div class="mb-3"><label class="form-label">Titolo/Tipo</label><input type="text" class="form-control" id="session-title" required placeholder="Es. Allenamento tecnico"></div><div class="mb-3"><label class="form-label">Nota breve <small class="text-muted">(opzionale, max 15 parole)</small></label><input type="text" class="form-control" id="session-note" placeholder="Es. Campo Paradiso" maxlength="120"></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Ora Inizio</label><input type="time" class="form-control" id="session-time"></div><div class="col-md-6 mb-3"><label class="form-label">Luogo</label><input type="text" class="form-control" id="session-location" placeholder="Es. Campo 1"></div></div><div class="mb-3"><label class="form-label">Obiettivi</label><input type="text" class="form-control" id="session-goals" placeholder="Es. Possesso palla, tiri in porta"></div><div class="mb-3"><label class="form-label">Descrizione Allenamento (un punto per riga)</label><textarea class="form-control" id="session-description" rows="5"></textarea></div><div class="form-check mt-3 pt-2" style="border-top:1px solid #334155;"><input class="form-check-input" type="checkbox" id="session-sync-cal"><label class="form-check-label" for="session-sync-cal" style="color:#60a5fa;font-size:0.85rem;">📅 Copia anche nel <strong>Calendario Squadra</strong> (visibile in Presenze)</label></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-session-btn" style="display:none;">Elimina</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="session-form">Salva Sessione</button></div></div></div></div></div> <div class="modal fade" id="matchResultModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="matchResultModalLabel">Inserisci Risultato Partita</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="match-result-form"><input type="hidden" id="match-id"><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Data Partita</label><input type="date" class="form-control" id="match-date" required></div><div class="col-md-4 mb-3"><label class="form-label">Ora Partita</label><input type="time" class="form-control" id="match-time"></div><div class="col-md-4 mb-3"><label class="form-label">Luogo Fisico</label><input type="text" class="form-control" id="match-venue" placeholder="Es. Stadio Comunale"></div></div><div class="row"><div class="col-md-5 mb-3"><label class="form-label">Squadra Avversaria</label><input type="text" class="form-control" id="match-opponent-name" required></div><div class="col-md-3 mb-3"><label class="form-label">Luogo</label><select class="form-select" id="match-location"><option value="home">Casa</option><option value="away">Trasferta</option></select></div></div><div class="row align-items-center text-center"><div class="col-5"><label class="form-label" id="match-myteam-label">GO Sport</label><input type="number" class="form-control text-center" id="match-my-team-score" min="0" placeholder="Gol"></div><div class="col-2">-</div><div class="col-5"><label class="form-label">AVVERSARI</label><input type="number" class="form-control text-center" id="match-opponent-score" min="0" placeholder="Gol"></div></div><hr><div class="row mt-3"><div class="col-md-4"><h5><i class="bi bi-futbol"></i> Marcatori (<span id="match-scorers-team">GO Sport</span>)</h5><div id="scorers-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-scorer-btn"><i class="bi bi-plus"></i> Aggiungi Marcatore</button></div><div class="col-md-4"><h5><i class="bi bi-person-raised-hand"></i> Assists (<span id="match-assists-team">GO Sport</span>)</h5><div id="assists-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-assist-btn"><i class="bi bi-plus"></i> Aggiungi Assist</button></div><div class="col-md-4"><h5><i class="bi bi-file-earmark-person"></i> Cartellini (<span id="match-cards-team">GO Sport</span>)</h5><div id="cards-container" class="d-grid gap-2"></div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="add-card-btn"><i class="bi bi-plus"></i> Aggiungi Cartellino</button></div></div></form></div><div class="modal-footer justify-content-between"><button type="button" class="btn btn-outline-danger" id="delete-match-btn" style="display:none;">Elimina Partita</button><div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="match-result-form">Salva Partita</button></div></div></div></div></div>  <div class="modal fade" id="parentModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="parentModalLabel">👨‍👩‍👧 Anagrafica Genitori — <span id="parent-athlete-name"></span></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="parent-form"><input type="hidden" id="parent-athlete-id"><p class="text-muted small mb-3">Dati facoltativi. Riservati e non visibili agli atleti.</p><h6 class="text-info mb-2">👤 Genitore / Tutore 1</h6><div class="row"><div class="col-md-6 mb-2"><label class="form-label">Nome</label><input type="text" class="form-control" id="parent1-nome" placeholder="es. Mario"></div><div class="col-md-6 mb-2"><label class="form-label">Cognome</label><input type="text" class="form-control" id="parent1-cognome" placeholder="es. Rossi"></div></div><div class="row"><div class="col-md-6 mb-2"><label class="form-label">Telefono</label><input type="tel" class="form-control" id="parent1-telefono" placeholder="es. 333 1234567"></div><div class="col-md-6 mb-2"><label class="form-label">Codice Fiscale</label><input type="text" class="form-control" id="parent1-cf" placeholder="es. RSSMRA..." maxlength="16" style="text-transform:uppercase;"></div></div><div class="mb-2"><label class="form-label">Email</label><input type="email" class="form-control" id="parent1-email" placeholder="es. mario@email.com"></div><div class="mb-2"><label class="form-label">Indirizzo</label><input type="text" class="form-control" id="parent1-indirizzo" placeholder="es. Via Roma 1, Milano"></div><div class="mb-3"><label class="form-label">Data di Nascita</label><input type="date" class="form-control" id="parent1-dataNascita"></div><hr class="my-2"><h6 class="text-warning mb-2">👤 Genitore / Tutore 2 (opzionale)</h6><div class="row"><div class="col-md-6 mb-2"><label class="form-label">Nome</label><input type="text" class="form-control" id="parent2-nome" placeholder="es. Giulia"></div><div class="col-md-6 mb-2"><label class="form-label">Cognome</label><input type="text" class="form-control" id="parent2-cognome" placeholder="es. Rossi"></div></div><div class="row"><div class="col-md-6 mb-2"><label class="form-label">Telefono</label><input type="tel" class="form-control" id="parent2-telefono" placeholder="es. 347 7654321"></div><div class="col-md-6 mb-2"><label class="form-label">Codice Fiscale</label><input type="text" class="form-control" id="parent2-cf" placeholder="es. RSSGLA..." maxlength="16" style="text-transform:uppercase;"></div></div><div class="mb-2"><label class="form-label">Email</label><input type="email" class="form-control" id="parent2-email" placeholder="es. giulia@email.com"></div><div class="mb-2"><label class="form-label">Indirizzo</label><input type="text" class="form-control" id="parent2-indirizzo" placeholder="es. Via Roma 1, Milano"></div><div class="mb-2"><label class="form-label">Data di Nascita</label><input type="date" class="form-control" id="parent2-dataNascita"></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button><button type="submit" class="btn btn-primary-custom" form="parent-form">💾 Salva</button></div></div></div></div> <div class="modal fade" id="passwordModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Accesso Richiesto</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><p>Per visualizzare questi dati è richiesta una password.</p><form id="password-form"><div class="mb-3"><label for="password-input" class="form-label">Password</label><input type="password" class="form-control" id="password-input" required><div id="password-error" class="text-danger mt-2" style="display: none;">Password non corretta.</div></div><button type="submit" class="btn btn-primary-custom w-100">Accedi</button></form></div></div></div></div>`;
    // Applica permessi dopo il caricamento iniziale
    document.addEventListener('dataLoaded', applyPermissions);
    // Applica subito per elementi già presenti
    setTimeout(applyPermissions, 500);

    // ── Banner iscrizioni in attesa (solo direttivo/dirigente/admin) ──
    async function checkIscrizioni() {
        const perms = getPermissions();
        if (!perms.isDashboard && !perms.isAdmin) return;
        const socId = sessionStorage.getItem('gosport_society_id') || '';
        if (!socId) return;
        try {
            // Nessun header esplicito: l'interceptor di auth-multi-annata aggiunge
            // automaticamente X-Auth-Session e X-Society-Id dal sessionStorage
            const r = await fetch('/api/registrations?action=list');
            if (!r.ok) return;
            const d = await r.json();
            const pending = d.pending || 0;
            const banner  = document.getElementById('iscr-alert-index');
            const countEl = document.getElementById('iscr-alert-count');
            if (banner && pending > 0) {
                if (countEl) countEl.textContent = pending;
                banner.style.display = 'flex';
            }
        } catch(_) {}
    }
    setTimeout(checkIscrizioni, 1200);

    const evaluationModal = new bootstrap.Modal(document.getElementById('evaluationModal'));
    const athleteModal = new bootstrap.Modal(document.getElementById('athleteModal'));
    const parentModal  = new bootstrap.Modal(document.getElementById('parentModal'));

    // ── Parent fields helpers ─────────────────────────────────────
    const PARENT_FIELDS = ['nome','cognome','telefono','cf','email','indirizzo','dataNascita'];
    const openParentModal = (athleteId) => {
        const athlete = athletes.find(a => String(a.id) === String(athleteId));
        if (!athlete) return;
        document.getElementById('parent-athlete-id').value = athlete.id;
        document.getElementById('parent-athlete-name').textContent = athlete.name;
        const p = athlete.parents || {};
        PARENT_FIELDS.forEach(f => {
            const el1 = document.getElementById('parent1-' + f);
            const el2 = document.getElementById('parent2-' + f);
            if (el1) el1.value = (p.parent1 || {})[f] || '';
            if (el2) el2.value = (p.parent2 || {})[f] || '';
        });
        parentModal.show();
    };

    // ── INFORTUNI: cartella per atleta (dato sensibile, solo staff) ──────────
    const _infHeaders = (json) => {
        const h = {
            'X-Society-Id': sessionStorage.getItem('gosport_society_id') || '',
            'X-Annata-Id': sessionStorage.getItem('gosport_current_annata') || '',
            'X-Auth-Session': sessionStorage.getItem('gosport_session_token') || '',
            'X-Auth-User': sessionStorage.getItem('gosport_auth_user') || '',
            'X-User-Role': sessionStorage.getItem('gosport_user_role') || ''
        };
        if (json) h['Content-Type'] = 'application/json';
        return h;
    };
    const _infTipoLabel = { muscolare:'💪 Muscolare', articolare:'🦴 Articolare', trauma:'🩹 Trauma', altro:'➕ Altro' };
    let _infCurrentAthlete = null;

    function _infModalEl() {
        let m = document.getElementById('infortuni-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'infortuni-modal';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:3000;padding:16px;';
        m.innerHTML = `<div style="background:var(--bg-card,#0d1b2a);border:1px solid #3b5a9d;border-radius:14px;max-width:640px;width:100%;max-height:90vh;overflow:auto;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h5 style="margin:0;color:var(--text-primary,#e2e8f0);">🩹 Infortuni — <span id="inf-ath-name"></span></h5>
                <button class="btn btn-sm btn-outline-light" onclick="document.getElementById('infortuni-modal').style.display='none'">✕</button>
            </div>
            <div id="inf-list" style="margin-bottom:14px;"></div>
            <div style="border-top:1px solid #2d4a8a;padding-top:12px;">
                <div style="font-weight:600;color:#60a5fa;margin-bottom:8px;font-size:0.9rem;">➕ Nuovo infortunio</div>
                <div class="row g-2">
                    <div class="col-6"><label class="form-label small mb-1">Data inizio</label><input type="date" id="inf-inizio" class="form-control form-control-sm"></div>
                    <div class="col-6"><label class="form-label small mb-1">Rientro previsto</label><input type="date" id="inf-rientro-prev" class="form-control form-control-sm"></div>
                    <div class="col-6"><label class="form-label small mb-1">Tipo</label>
                        <select id="inf-tipo" class="form-select form-select-sm">
                            <option value="muscolare">💪 Muscolare</option>
                            <option value="articolare">🦴 Articolare</option>
                            <option value="trauma">🩹 Trauma</option>
                            <option value="altro" selected>➕ Altro</option>
                        </select>
                    </div>
                    <div class="col-6"><label class="form-label small mb-1">Zona</label><input type="text" id="inf-zona" class="form-control form-control-sm" placeholder="es. caviglia dx" maxlength="60"></div>
                    <div class="col-12"><label class="form-label small mb-1">Note (riservate)</label><input type="text" id="inf-note" class="form-control form-control-sm" placeholder="opzionale" maxlength="300"></div>
                    <div class="col-12"><label class="form-label small mb-1">🔗 Link documentazione</label><input type="text" id="inf-link" class="form-control form-control-sm" placeholder="https://drive.google.com/...  oppure  \\\\SERVER\\Cartella\\referto.pdf" maxlength="500"><div class="small text-muted" style="font-size:0.7rem;">Link Google Drive/Docs o percorso di rete della società (apribile solo dal PC locale).</div></div>
                </div>
                <button class="btn btn-sm btn-primary-custom mt-2" onclick="window.salvaInfortunio()"><i class="bi bi-plus-lg"></i> Aggiungi infortunio</button>
            </div>
        </div>`;
        document.body.appendChild(m);
        m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
        return m;
    }

    window.openInfortuniModal = async function(athleteId) {
        const athlete = athletes.find(a => String(a.id) === String(athleteId));
        if (!athlete) return;
        _infCurrentAthlete = athleteId;
        const m = _infModalEl();
        m.querySelector('#inf-ath-name').textContent = athlete.name;
        m.querySelector('#inf-inizio').value = new Date().toISOString().split('T')[0];
        m.querySelector('#inf-rientro-prev').value = '';
        m.querySelector('#inf-tipo').value = 'altro';
        m.querySelector('#inf-zona').value = '';
        m.querySelector('#inf-note').value = '';
        m.querySelector('#inf-link').value = '';
        m.style.display = 'flex';
        await _infRenderList(athleteId);
    };

    async function _infRenderList(athleteId) {
        const box = document.getElementById('inf-list');
        if (!box) return;
        box.innerHTML = '<div class="text-muted small">Caricamento…</div>';
        try {
            const r = await fetch('/api/data?action=infortuni', { headers: _infHeaders(false) });
            const d = await r.json();
            const lista = (d.infortuni && d.infortuni[athleteId]) || [];
            if (!lista.length) { box.innerHTML = '<div class="text-muted small">Nessun infortunio registrato.</div>'; return; }
            // attivi in cima, poi per data inizio desc
            lista.sort((a,b) => (b.attivo?1:0)-(a.attivo?1:0) || String(b.dataInizio).localeCompare(String(a.dataInizio)));
            box.innerHTML = lista.map(inf => {
                const stato = inf.attivo
                    ? '<span style="background:#7f1d1d;color:#fecaca;border-radius:4px;padding:1px 7px;font-size:0.72rem;">🤕 In corso</span>'
                    : '<span style="background:#14532d;color:#bbf7d0;border-radius:4px;padding:1px 7px;font-size:0.72rem;">✓ Guarito</span>';
                const fmt = s => s ? new Date(s+'T00:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';
                return `<div style="border:1px solid #2d4a8a;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-weight:600;">${_infTipoLabel[inf.tipo]||inf.tipo}${inf.zona?' · '+escapeHtml(inf.zona):''}</span>
                        ${stato}
                    </div>
                    <div class="small text-muted" style="margin-top:3px;">Dal ${fmt(inf.dataInizio)} · rientro previsto ${fmt(inf.dataRientroPrevista)}${inf.dataRientroEffettiva?' · rientrato il '+fmt(inf.dataRientroEffettiva):''}</div>
                    ${inf.note?`<div class="small" style="margin-top:2px;color:#94a3b8;font-style:italic;">${escapeHtml(inf.note)}</div>`:''}
                    ${inf.linkDoc?(/^https?:\/\//i.test(inf.linkDoc)
                        ? `<div class="small" style="margin-top:4px;"><a href="${escapeHtml(inf.linkDoc)}" target="_blank" rel="noopener" style="color:#60a5fa;"><i class="bi bi-box-arrow-up-right"></i> Apri documentazione</a></div>`
                        : `<div class="small" style="margin-top:4px;"><span style="color:#94a3b8;"><i class="bi bi-folder-fill" style="color:#f59e0b;"></i> ${escapeHtml(inf.linkDoc)}</span> <button class="btn btn-sm btn-outline-light py-0 px-1" style="font-size:0.7rem;" onclick="navigator.clipboard.writeText('${escapeHtml(inf.linkDoc).replace(/'/g,"\\'")}');this.textContent='✓ copiato'">📋 copia</button></div>`
                    ):''}
                    <div style="display:flex;gap:6px;margin-top:6px;">
                        ${inf.attivo?`<button class="btn btn-sm btn-outline-success" onclick="window.chiudiInfortunio('${inf.id}')"><i class="bi bi-check2"></i> Segna rientro (oggi)</button>`:''}
                        <button class="btn btn-sm btn-outline-danger" onclick="window.eliminaInfortunio('${inf.id}')"><i class="bi bi-trash"></i></button>
                    </div>
                </div>`;
            }).join('');
        } catch(e) { box.innerHTML = '<div class="text-danger small">Errore caricamento.</div>'; }
    }

    async function _infSave(payload) {
        const r = await fetch('/api/data?action=infortuni', { method:'POST', headers:_infHeaders(true), body: JSON.stringify({ athleteId:_infCurrentAthlete, ...payload }) });
        const d = await r.json();
        if (!r.ok || !d.success) { alert('❌ ' + (d.message||'Errore')); return false; }
        // aggiorna lo stato locale dell'atleta (infortunato/dataRientro) per la UI
        try {
            if (typeof loadData === 'function') await loadData();
            if (window.updateAllUI) window.updateAllUI();
        } catch(_){}
        await _infRenderList(_infCurrentAthlete);
        return true;
    }

    window.salvaInfortunio = function() {
        const inizio = document.getElementById('inf-inizio').value;
        if (!inizio) { alert('Inserisci la data di inizio'); return; }
        _infSave({ infortunio: {
            dataInizio: inizio,
            dataRientroPrevista: document.getElementById('inf-rientro-prev').value,
            tipo: document.getElementById('inf-tipo').value,
            zona: document.getElementById('inf-zona').value.trim(),
            note: document.getElementById('inf-note').value.trim(),
            linkDoc: document.getElementById('inf-link').value.trim()
        }});
        // pulisci il form
        document.getElementById('inf-zona').value = '';
        document.getElementById('inf-note').value = '';
        document.getElementById('inf-link').value = '';
    };
    window.chiudiInfortunio = async function(id) {
        // ricarico la voce, imposto rientro effettivo = oggi (→ attivo:false lato server)
        const r = await fetch('/api/data?action=infortuni', { headers:_infHeaders(false) });
        const d = await r.json();
        const inf = ((d.infortuni && d.infortuni[_infCurrentAthlete]) || []).find(x => x.id === id);
        if (!inf) return;
        await _infSave({ infortunio: { ...inf, dataRientroEffettiva: new Date().toISOString().split('T')[0] } });
    };
    window.eliminaInfortunio = function(id) {
        if (!confirm('Eliminare questo infortunio dallo storico?')) return;
        _infSave({ deleteId: id });
    };

    window.resetIndividualPkg = function(athleteId) {
        if (!athleteId) {
            athleteId = document.getElementById('ind-modal-athlete-id')?.value ||
                        document.getElementById('modal-athlete-id')?.value;
        }
        if (!athleteId) return;
        if (!confirm('Azzerare il Pacchetto Individual per questo atleta?')) return;
        const idx = athletes.findIndex(a => String(a.id) === String(athleteId));
        if (idx === -1) return;
        athletes[idx] = { ...athletes[idx], individual: {
            type: '', startDate: '', expiryDate: '', lessonsUsed: 0,
            daysPerWeek: '', coachSessions: '', preferredTime: '',
            selectedDays: [], coachName: '', coachColor: '#3b82f6'
        }};
        saveData();
        renderAthletes();
        // Aggiorna il form se aperto
        const pkgEl = document.getElementById('athlete-individual-pkg');
        if (pkgEl) { pkgEl.value = ''; }
        ['athlete-individual-start','athlete-individual-expiry','athlete-ind-coach','athlete-ind-time'].forEach(function(id) {
            var el = document.getElementById(id); if (el) el.value = '';
        });
        ['athlete-ind-days-week','athlete-ind-coach-sessions'].forEach(function(id) {
            var el = document.getElementById(id); if (el) el.value = '';
        });
        alert('Pacchetto Individual azzerato.');
    };
    document.getElementById('parent-form').addEventListener('submit', e => {
        e.preventDefault();
        const athleteId = document.getElementById('parent-athlete-id').value;
        const athlete = athletes.find(a => String(a.id) === String(athleteId));
        if (!athlete) return;
        const buildParent = (n) => {
            const obj = {};
            PARENT_FIELDS.forEach(f => {
                const el = document.getElementById('parent' + n + '-' + f);
                if (el) obj[f] = el.value.trim();
            });
            return obj;
        };
        const idx = athletes.findIndex(a => String(a.id) === String(athleteId));
        athletes[idx] = { ...athlete, parents: { parent1: buildParent(1), parent2: buildParent(2) } };
        saveData();
        parentModal.hide();
    });
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
        addStaffBtn: document.getElementById('add-staff-btn'),
        quickAddStaffBtn: document.getElementById('quick-add-staff-btn'),
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
        homeTotalStaff: document.getElementById('home-total-staff'),
        homeStaffBreakdown: document.getElementById('home-staff-breakdown'),
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
        statDr: document.getElementById('stat-dr'),
        weeklyAthlete1Selector: document.getElementById('weekly-athlete-1-selector'),
        weeklyAthlete2Selector: document.getElementById('weekly-athlete-2-selector'),
        weeklyPeriodToggle: document.getElementById('weekly-period-toggle'),
        weeklyDatePicker: document.getElementById('weekly-date-picker'),
        weeklyStartDatePicker: document.getElementById('weekly-start-date-picker')
    };
    const ACCESS_PASSWORD = "Edy201";
    let _individualPassword = sessionStorage.getItem('gosport_individual_pwd') || '1234';
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
        if (password === ACCESS_PASSWORD || password === _individualPassword) {
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
    // Rendi athletes disponibile globalmente per il calendario
    window.athletes = athletes;
    let formationData = { starters: [], bench: [], tokens: [] };
    let chartInstances = {};
    window.chartInstances = chartInstances; // esposto per applyChartTheme
    let comparisonChartPeriod = 'annual';
    let attendanceChartPeriod = 'annual';
    let weeklyAttendancePeriod = 'year';
    let performanceSelections = [ { athleteId: null, sessionId: null }, { athleteId: null, sessionId: null } ];
    let performanceFilterType = 'all';
    let multiAthleteFilterType = 'all';
    let currentCalendarDate = new Date();
    let pollingInterval = null;
    let visuallyDeletedCards = [];
    const saveData = async () => {
        const annataId = sessionStorage.getItem('gosport_current_annata') ||
                         localStorage.getItem('currentAnnata');
        if (!annataId) {
            console.error('❌ saveData: nessuna annata selezionata!');
            return false;
        }
        const allData = { 
            athletes, 
            evaluations, 
            gpsData, 
            awards, 
            trainingSessions, 
            formationData, 
            matchResults,
            calendarEvents: window.calendarEvents || {},
            calendarResponses: window.calendarResponses || {}
        };
        try {
            const response = await fetch('/api/data', { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Annata-Id': annataId
                }, 
                body: JSON.stringify(allData) 
            });
            if (!response.ok) throw new Error('Errore salvataggio');
            return true;
        } catch (error) { 
            console.error('Errore nel salvataggio dei dati sul server:', error);
            return false;
        }
    };
    // Rendi saveData disponibile globalmente per calendario-admin.js e parent-view.js
    window.saveData = saveData;

    // ── PWA "Aggiungi a Home" (coach) ─────────────────────────────────────────
    // index.html ha già manifest + service worker (URL fisso, va bene). Qui solo
    // il pulsante: Android usa il prompt nativo, iPhone mostra le istruzioni.
    window.addEventListener('beforeinstallprompt', function(e) { e.preventDefault(); window._deferredInstallPrompt = e; });
    window.aggiungiAHome = async function() {
      if (window._deferredInstallPrompt) {
        window._deferredInstallPrompt.prompt();
        try { await window._deferredInstallPrompt.userChoice; } catch (e) {}
        window._deferredInstallPrompt = null;
        return;
      }
      var ua = navigator.userAgent || '';
      var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      alert(isIOS
        ? '📌 Per aggiungere l\'app alla Home (iPhone/iPad):\n\n1. Tocca CONDIVIDI ⬆️ (in basso in Safari)\n2. "Aggiungi a Home" / "Add to Home Screen"\n3. Conferma'
        : '📌 Per aggiungere l\'app alla Home:\n\n1. Menu del browser (⋮ in alto a destra)\n2. "Aggiungi a schermata Home" / "Installa app"\n3. Conferma');
    };

    // ── MODALITÀ CAMPO + APPELLO RAPIDO ───────────────────────────────────────
    // Definita qui dentro per avere accesso a evaluations/athletes/saveData in
    // scope. Esposta su window per il pulsante in Home. Vedi memoria modalita-campo.
    (function setupModalitaCampo() {
      // Mappa valore presenza → {label, colore} (logica utente: 3=presente,
      // 2/1=ritardi, 0=assente; il giustificato si salva come 3).
      const PRES_MAP = {
        '3': { label: 'Presente',      bg: '#16a34a', fg: '#fff' },
        '2': { label: 'Ritardo lieve', bg: '#ca8a04', fg: '#fff' },
        '1': { label: 'Ritardo forte', bg: '#ea580c', fg: '#fff' },
        '0': { label: 'Assente',       bg: '#dc2626', fg: '#fff' },
      };
      // Data di OGGI in formato locale (come tutto il resto dell'app, via
      // toLocalDateISO). NON usare toISOString() che dà la data UTC: di sera/notte
      // in Italia differisce di un giorno → l'appello salverebbe su una data e il
      // pannello valutazioni leggerebbe un'altra ("non risulta niente").
      const todayStr = () => toLocalDateISO(new Date());

      // Stato locale dell'appello: { athleteId: '3'|'2'|'1'|'0' }. Si salva solo
      // su Salva o backup (dirty flag), MAI a ogni tap → niente raffica chiamate.
      let appelloStato = {};
      let appelloDirty = false;
      let appelloIdleTimer = null;

      function rosaOrdinata() {
        return (window.athletes || athletes)
          .filter(a => !a.isGuest && !a.isStaff && !a.archived)
          .sort((a, b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));
      }

      // Cicla i valori al TAP: 3 → 0 → 3 (presente ⇄ assente)
      function cicloTap(val) { return val === '3' ? '0' : '3'; }

      function markDirty() {
        appelloDirty = true;
        if (appelloIdleTimer) clearTimeout(appelloIdleTimer);
        // Backup pigro: salva da solo dopo ~45s di inattività SE ci sono modifiche
        appelloIdleTimer = setTimeout(() => { if (appelloDirty) salvaAppello(true); }, 45000);
      }

      async function salvaAppello(silent) {
        // silent=true → backup automatico (idle/uscita): salva solo se ci sono
        //   modifiche, per non fare scritture inutili.
        // silent=false → pulsante "Salva" esplicito: scrive SEMPRE lo stato
        //   corrente (anche se non hai toccato nessuno: "tutti presenti"
        //   confermati è una scelta valida). Senza questo, premendo Salva senza
        //   toccare nulla non si salvava niente.
        if (silent && !appelloDirty) return;
        // Niente atleti in lista (es. rosa vuota) → niente da salvare.
        if (!appelloStato || Object.keys(appelloStato).length === 0) {
          if (!silent) chiudiModalitaCampo();
          return;
        }
        const date = todayStr();
        if (!evaluations[date]) evaluations[date] = {};
        // Scrive SOLO presenza-allenamento, preservando gli altri campi esistenti.
        Object.keys(appelloStato).forEach(aid => {
          const prev = evaluations[date][aid] || {};
          evaluations[date][aid] = { ...prev, 'presenza-allenamento': appelloStato[aid] };
        });
        try {
          // saveData ritorna true/false (non lancia): controllo l'esito reale.
          const ok = await saveData();
          if (ok === false) {
            if (!silent) alert('❌ Salvataggio non riuscito. Controlla la connessione e che l\'annata sia selezionata.');
            return;
          }
          appelloDirty = false;
          if (!silent) {
            if (typeof updateAllUI === 'function') updateAllUI();
            alert('✅ Presenze salvate.');
            chiudiModalitaCampo();
          }
        } catch (e) {
          if (!silent) alert('❌ Errore nel salvataggio: ' + (e.message || e));
        }
      }

      // Azzera SOLO il campo presenza-allenamento di oggi per tutti gli atleti
      // (caso: appello aperto/salvato per sbaglio in un giorno senza allenamento).
      // Preserva gli altri campi della valutazione; se il record resta vuoto lo
      // rimuove. Distruttivo → con conferma.
      async function azzeraPresenzeOggi(container) {
        const date = todayStr();
        const dataIt = new Date(date + 'T00:00:00').toLocaleDateString('it-IT');
        if (!confirm('🗑️ Azzerare le PRESENZE di oggi (' + dataIt + ') per tutti gli atleti?\n\nSi usa se hai aperto l\'appello per sbaglio in un giorno senza allenamento.\nGli altri dati di valutazione restano. Operazione irreversibile.')) return;
        const giorno = evaluations[date];
        if (giorno) {
          Object.keys(giorno).forEach(aid => {
            const ev = giorno[aid];
            if (ev && typeof ev === 'object' && ev['presenza-allenamento'] != null) {
              delete ev['presenza-allenamento'];
              // Se non resta nessun altro campo significativo, rimuovi il record.
              if (Object.keys(ev).length === 0) delete giorno[aid];
            }
          });
          if (Object.keys(giorno).length === 0) delete evaluations[date];
        }
        try {
          await saveData();
          appelloDirty = false;
          if (typeof updateAllUI === 'function') updateAllUI();
          if (container) renderAppello(container); // ridisegna: tutti tornano "Presente" preset
          alert('✅ Presenze di oggi azzerate.');
        } catch (e) {
          alert('❌ Errore: ' + (e.message || e));
        }
      }

      function renderAppello(container) {
        const date = todayStr();
        const oggiEval = (evaluations[date]) || {};
        const rosa = rosaOrdinata();
        // Inizializza lo stato: valore già salvato di oggi, altrimenti 3 (preset presenti)
        appelloStato = {};
        rosa.forEach(a => {
          const ev = oggiEval[String(a.id)];
          const v = ev && ev['presenza-allenamento'] != null ? String(ev['presenza-allenamento']) : '3';
          appelloStato[String(a.id)] = (PRES_MAP[v] ? v : '3');
        });

        let h = `<div style="padding:10px 0;">
          <div style="text-align:center;color:#475569;font-size:0.9rem;margin-bottom:10px;">
            Tutti <b>Presenti</b> di default. Tocca per <b>Assente</b>, tieni premuto per ritardi/giustificato.
          </div>`;
        rosa.forEach(a => {
          const v = appelloStato[String(a.id)];
          const m = PRES_MAP[v];
          const num = (a.number != null && a.number !== '' && a.number !== 0) ? a.number : '—';
          h += `<div class="appello-row" data-aid="${a.id}"
                  style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin-bottom:6px;border-radius:10px;background:#fff;border:1px solid #e2e8f0;cursor:pointer;user-select:none;">
                  <span style="min-width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:#1e293b;color:#fff;border-radius:8px;font-weight:700;">${num}</span>
                  <span style="flex:1;color:#0f172a;font-weight:600;font-size:1.05rem;">${escapeHtml(a.name)}</span>
                  <span class="appello-badge" style="min-width:120px;text-align:center;padding:8px 10px;border-radius:8px;font-weight:700;background:${m.bg};color:${m.fg};">${m.label}</span>
                </div>`;
        });
        h += `</div>`;
        container.innerHTML = h;
        attachAppelloHandlers(container);
      }

      function aggiornaRiga(row) {
        const aid = row.getAttribute('data-aid');
        const v = appelloStato[aid];
        const m = PRES_MAP[v];
        const badge = row.querySelector('.appello-badge');
        if (badge) { badge.textContent = m.label; badge.style.background = m.bg; badge.style.color = m.fg; }
      }

      function attachAppelloHandlers(container) {
        container.querySelectorAll('.appello-row').forEach(row => {
          const aid = row.getAttribute('data-aid');
          let pressTimer = null, longFired = false;

          const openMenu = () => {
            longFired = true;
            // Menu a BOTTONI tappabili (no prompt): overlay centrato con le 4
            // scelte colorate + giustificato. Un tap sceglie e chiude.
            const nome = (row.querySelector('span:nth-child(2)')||{}).textContent || '';
            const scelte = [
              ['3','🟢 Presente',        '#16a34a'],
              ['3','🔵 Giustificato',    '#2563eb'],
              ['2','🟡 Ritardo lieve',   '#ca8a04'],
              ['1','🟠 Ritardo forte',   '#ea580c'],
              ['0','🔴 Assente',         '#dc2626'],
            ];
            const back = document.createElement('div');
            back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:21000;display:flex;align-items:center;justify-content:center;padding:20px;';
            let inner = `<div style="background:#fff;border-radius:14px;padding:16px;max-width:340px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.3);">
              <div style="font-weight:800;color:#0f172a;margin-bottom:12px;text-align:center;">${escapeHtml(nome)}</div>`;
            scelte.forEach((s,i) => {
              inner += `<button data-val="${s[0]}" style="display:block;width:100%;margin-bottom:8px;padding:14px;border:none;border-radius:10px;background:${s[2]};color:#fff;font-weight:700;font-size:1.05rem;cursor:pointer;">${s[1]}</button>`;
            });
            inner += `<button data-cancel="1" style="display:block;width:100%;margin-top:4px;padding:12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#475569;font-weight:700;cursor:pointer;">Annulla</button></div>`;
            back.innerHTML = inner;
            document.body.appendChild(back);
            back.addEventListener('click', (e) => {
              const b = e.target.closest('button');
              if (!b) { if (e.target === back) back.remove(); return; }
              if (b.getAttribute('data-cancel')) { back.remove(); return; }
              appelloStato[aid] = b.getAttribute('data-val');
              aggiornaRiga(row); markDirty();
              back.remove();
            });
          };

          // Tap singolo (mouse)
          row.addEventListener('click', (e) => {
            if (longFired) { longFired = false; return; }
            appelloStato[aid] = cicloTap(appelloStato[aid]);
            aggiornaRiga(row); markDirty();
          });
          // Long-press (touch + mouse)
          const startPress = () => { longFired = false; pressTimer = setTimeout(openMenu, 550); };
          const cancelPress = () => { if (pressTimer) clearTimeout(pressTimer); };
          row.addEventListener('touchstart', startPress, { passive: true });
          row.addEventListener('touchend', cancelPress);
          row.addEventListener('touchmove', cancelPress);
          row.addEventListener('mousedown', startPress);
          row.addEventListener('mouseup', cancelPress);
          row.addEventListener('mouseleave', cancelPress);
        });
      }

      // Chiude solo l'overlay (la "sessione campo" resta attiva → il ⚡ permane,
      // così tornando da Squadra/Presenze/Calendario puoi riaprire la Modalità).
      function chiudiModalitaCampo() {
        const ov = document.getElementById('modalita-campo-overlay');
        if (ov) ov.remove();
      }

      // "Esci" vero: termina la sessione campo → il ⚡ sparisce.
      function uscireModalitaCampo() {
        try { sessionStorage.removeItem('gosport_campo_mode'); } catch (e) {}
        chiudiModalitaCampo();
        const fab = document.getElementById('mc-fab');
        if (fab) fab.remove();
      }

      // Apre la schermata Modalità Campo (riquadri + accesso appello).
      // Attiva la "sessione campo": da qui in poi il ⚡ appare ovunque
      // (anche in calendario.html, via flag in sessionStorage) finché non esci.
      window.openModalitaCampo = function() {
        try { sessionStorage.setItem('gosport_campo_mode', '1'); } catch (e) {}
        ensureFab();
        chiudiModalitaCampo();
        const ov = document.createElement('div');
        ov.id = 'modalita-campo-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:#f1f5f9;z-index:20000;overflow-y:auto;-webkit-overflow-scrolling:touch;';
        ov.innerHTML = `
          <div style="max-width:680px;margin:0 auto;padding:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
              <h3 style="margin:0;color:#0f172a;font-weight:800;">⚡ Modalità Campo</h3>
              <button id="mc-close" style="background:#e2e8f0;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;color:#0f172a;">✕ Esci</button>
            </div>
            <div id="mc-home">
              <button class="mc-tile" data-act="appello" style="width:100%;text-align:left;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:14px;padding:22px;margin-bottom:12px;font-size:1.3rem;font-weight:800;cursor:pointer;">📋 Appello Rapido<div style="font-size:0.85rem;font-weight:500;opacity:0.9;margin-top:4px;">Presenze di oggi in un tap</div></button>
              <button class="mc-tile" data-act="squadra" style="width:100%;text-align:left;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;padding:22px;margin-bottom:12px;font-size:1.3rem;font-weight:800;cursor:pointer;">👥 Squadra<div style="font-size:0.85rem;font-weight:500;color:#64748b;margin-top:4px;">Schede e valutazioni atleti</div></button>
              <button class="mc-tile" data-act="risultati" style="width:100%;text-align:left;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;padding:22px;margin-bottom:12px;font-size:1.3rem;font-weight:800;cursor:pointer;">🏆 Risultati<div style="font-size:0.85rem;font-weight:500;color:#64748b;margin-top:4px;">Inserisci risultati partite</div></button>
              <button class="mc-tile" data-act="presenze" style="width:100%;text-align:left;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;padding:22px;margin-bottom:12px;font-size:1.3rem;font-weight:800;cursor:pointer;">📊 Presenze<div style="font-size:0.85rem;font-weight:500;color:#64748b;margin-top:4px;">Grafici e report presenze</div></button>
              <button class="mc-tile" data-act="calendario" style="width:100%;text-align:left;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;padding:22px;margin-bottom:12px;font-size:1.3rem;font-weight:800;cursor:pointer;">📅 Calendario Squadra<div style="font-size:0.85rem;font-weight:500;color:#64748b;margin-top:4px;">Presenze segnalate dai genitori</div></button>
            </div>
            <div id="mc-appello" style="display:none;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <button id="mc-appello-back" title="Torna ai riquadri" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:2px solid #fff;border-radius:50%;width:44px;height:44px;font-size:1.3rem;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);">⚡</button>
                <button id="mc-appello-save" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-weight:800;cursor:pointer;">💾 Salva</button>
              </div>
              <button id="mc-appello-reset" style="width:100%;background:#fff;color:#dc2626;border:1px solid #fecaca;border-radius:8px;padding:8px;font-weight:600;font-size:0.85rem;cursor:pointer;margin-bottom:10px;">🗑️ Azzera presenze di oggi (aperto per sbaglio?)</button>
              <div id="mc-appello-list"></div>
            </div>
          </div>`;
        document.body.appendChild(ov);

        ov.querySelector('#mc-close').onclick = () => { salvaAppello(true); uscireModalitaCampo(); };
        ov.querySelectorAll('.mc-tile').forEach(t => {
          t.onclick = () => {
            const act = t.getAttribute('data-act');
            if (act === 'appello') {
              ov.querySelector('#mc-home').style.display = 'none';
              ov.querySelector('#mc-appello').style.display = 'block';
              renderAppello(ov.querySelector('#mc-appello-list'));
            } else if (act === 'calendario') {
              // Calendario Squadra = pagina separata (calendario.html) con le
              // presenze dai genitori. Apro nella STESSA scheda: col tasto
              // Indietro del browser si torna all'app (dove c'è il ⚡).
              // Salvo prima l'appello, poi navigo (await per non perdere dati).
              (async () => {
                await salvaAppello(true);
                window.location.href = '/calendario.html';
              })();
            } else {
              // Apri la tab interna corrispondente e chiudi la modalità campo
              salvaAppello(true);
              chiudiModalitaCampo();
              const tab = act === 'squadra' ? 'squadra-section'
                        : act === 'risultati' ? 'match-results-section'
                        : act === 'presenze' ? 'report-presenze-section'
                        : 'squadra-section';
              if (typeof switchTab === 'function') switchTab(tab);
              else if (typeof window.switchTab === 'function') window.switchTab(tab);
            }
          };
        });
        ov.querySelector('#mc-appello-back').onclick = () => {
          ov.querySelector('#mc-appello').style.display = 'none';
          ov.querySelector('#mc-home').style.display = 'block';
        };
        ov.querySelector('#mc-appello-save').onclick = () => salvaAppello(false);
        ov.querySelector('#mc-appello-reset').onclick = () => azzeraPresenzeOggi(ov.querySelector('#mc-appello-list'));
      };

      // Pulsante flottante "⚡ Campo" sempre disponibile: riapre la Modalità
      // Campo da qualsiasi tab con un tap (così non devi tornare in Home).
      function ensureFab() {
        if (document.getElementById('mc-fab')) return;
        const fab = document.createElement('button');
        fab.id = 'mc-fab';
        fab.type = 'button';
        fab.title = 'Modalità Campo';
        fab.textContent = '⚡';
        fab.className = 'no-print';
        fab.style.cssText = 'position:fixed;right:16px;bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:18000;width:58px;height:58px;border-radius:50%;border:2px solid #fff;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-size:1.7rem;box-shadow:0 6px 20px rgba(0,0,0,0.4);cursor:pointer;';
        fab.onclick = () => window.openModalitaCampo();
        document.body.appendChild(fab);
      }

      // Barra fissa "⚡ Modalità Campo" in alto, SOLO su smartphone: raggiungibile
      // senza scrollare (su mobile le Azioni Rapide finiscono in fondo alla Home).
      // Su desktop NON appare (lì c'è già il pulsante nelle Azioni Rapide).
      function ensureTopBar() {
        const isMobile = window.matchMedia('(max-width: 820px)').matches;
        let bar = document.getElementById('mc-topbar');
        if (!isMobile) {
          if (bar) { bar.style.display = 'none'; _restoreMainPadding(); }
          return;
        }
        // La navbar ha height:56px fisso nel CSS — usiamo sempre 56 (getBoundingClientRect
        // può restituire 0 se chiamato prima del primo paint).
        const NAVBAR_H = 56;
        const BAR_H = 46;
        if (!bar) {
          bar = document.createElement('button');
          bar.id = 'mc-topbar';
          bar.type = 'button';
          bar.className = 'no-print';
          bar.innerHTML = '⚡ Modalità Campo';
          bar.onclick = () => window.openModalitaCampo();
          document.body.appendChild(bar);
        }
        bar.style.cssText = `position:fixed;top:${NAVBAR_H}px;left:0;right:0;z-index:1040;border:none;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-weight:800;font-size:1.05rem;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;`;
        bar.style.display = 'block';
        // Su mobile il main ha margin-top:56px (CSS). Aggiunge BAR_H in modo idempotente.
        const main = document.querySelector('main.container-fluid');
        if (main && !main.dataset.mcBarApplied) {
          main.dataset.mcBarApplied = '1';
          const curMt = parseFloat(getComputedStyle(main).marginTop) || 0;
          main.dataset.mcOrigMt = String(curMt);
          main.style.marginTop = (curMt + BAR_H) + 'px';
        }
      }
      function _restoreMainPadding() {
        const main = document.querySelector('main.container-fluid');
        if (main && main.dataset.mcBarApplied) {
          main.style.marginTop = (main.dataset.mcOrigMt || '0') + 'px';
          delete main.dataset.mcBarApplied;
          delete main.dataset.mcOrigMt;
        }
      }
      function removeFab() {
        // Rimuove SOLO il FAB flottante contestuale. La barra mobile in alto
        // (mc-topbar) è la scorciatoia FISSA: resta sempre visibile su mobile
        // e viene gestita esclusivamente da ensureTopBar().
        const f = document.getElementById('mc-fab'); if (f) f.remove();
      }

      // Regola del ⚡: appare SOLO se (a) sessione campo attiva E (b) NON sei in
      // Home. In Home non serve (c'è il pulsante verde) e va tolto. Chiamata a
      // ogni cambio tab. Aperta in altre tab dalla Modalità Campo → ⚡ visibile.
      function refreshFab() {
        let attivo = false;
        try { attivo = sessionStorage.getItem('gosport_campo_mode') === '1'; } catch (e) {}
        const home = document.getElementById('home-section');
        const inHome = home && (home.classList.contains('tab-active') || home.classList.contains('active'));
        if (attivo && !inHome) ensureFab(); else removeFab();
      }
      // Espongo per richiamarla dal cambio tab (switchTab è in index.html).
      window.mcRefreshFab = refreshFab;

      function initFabIfCampo() {
        // Se torno da calendario.html col ⚡ (?campo=1), riapro la Modalità Campo.
        // Retry: openModalitaCampo potrebbe non essere ancora pronta all'avvio.
        try {
          if (new URLSearchParams(location.search).get('campo') === '1') {
            history.replaceState(null, '', location.pathname);
            try { sessionStorage.setItem('gosport_campo_mode', '1'); } catch (e) {}
            let tries = 0;
            const tryOpen = () => {
              if (typeof window.openModalitaCampo === 'function') { window.openModalitaCampo(); return; }
              if (tries++ < 30) setTimeout(tryOpen, 150);
            };
            tryOpen();
            return;
          }
        } catch (e) {}
        refreshFab();
      }
      function initCampoUI() {
        ensureTopBar();      // scorciatoia mobile sempre presente
        initFabIfCampo();    // FAB contestuale + eventuale ?campo=1
      }
      if (document.body) initCampoUI();
      else document.addEventListener('DOMContentLoaded', initCampoUI);
      // Se ruoti il telefono / cambi viewport, riadatta la barra mobile.
      window.addEventListener('resize', ensureTopBar);
    })();
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
            const annataId = sessionStorage.getItem('gosport_current_annata') ||
                             localStorage.getItem('currentAnnata');
            const headers = { cache: 'no-store' };
            if (annataId) headers['X-Annata-Id'] = annataId;
            const response = await fetch('/api/data', { 
                cache: 'no-store',
                headers: annataId ? { 'X-Annata-Id': annataId } : {}
            });
            if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
            const allData = await response.json();
            athletes = allData.athletes || [];
            window.athletes = athletes;
        // Aggiorna _appData solo se ratingSheets sono cambiate
        const _prevRS = window._appData && JSON.stringify(window._appData.ratingSheets);
        window._appData = allData;
        const _newRS = JSON.stringify(allData.ratingSheets);
        if (window.reloadRatingSheets && _prevRS !== _newRS) {
            window.reloadRatingSheets();
        }
            evaluations = allData.evaluations || {};
            gpsData = allData.gpsData || {};
            migrateGpsData();
            awards = allData.awards || {};
            trainingSessions = allData.trainingSessions || {};
            formationData = allData.formationData || { starters: [], bench: [], tokens: [] };
            matchResults = allData.matchResults || {};
            window.calendarEvents = allData.calendarEvents || {};
            window.calendarResponses = allData.calendarResponses || {};
            window.trainingSessions = trainingSessions;
            window.matchResults = matchResults;
            // Carica password Individual da Redis (default '1234')
            if (allData.individualPassword) {
                _individualPassword = allData.individualPassword;
                sessionStorage.setItem('gosport_individual_pwd', _individualPassword);
            }
            // ── BANNER SPONSOR (aggiunto v1.5.16) ───────────────────────────
            // bachecaConfig non è nel GET con annataId → fetch separata globale
            if (!window._bannerShown) {
                try {
                    var xhrBanner = new XMLHttpRequest();
                    xhrBanner.open('GET', '/api/data', true); // senza X-Annata-Id = risposta globale
                    xhrBanner.onload = function() {
                        try {
                            var bd = JSON.parse(xhrBanner.responseText);
                            var spCfg = (bd && bd.bachecaConfig) || {};
                            var saB = (bd && bd.superadminBanners) || {};
                            var allSlots = _buildBannerSlots(saB, spCfg);
                            if (allSlots.length > 0) _showSponsorBannerOverlay(allSlots);
                        } catch(e) { console.warn('[Banner] parse err:', e); }
                    };
                    xhrBanner.send();
                } catch(e) { console.warn('[Banner] fetch err:', e); }
            }
            // ── FINE BANNER SPONSOR ──────────────────────────────────────────

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
            window.athletes = [];
            evaluations = {}; 
            gpsData = {}; 
            awards = {}; 
            trainingSessions = {}; 
            formationData = { starters: [], bench: [], tokens: [] }; 
            matchResults = {};
            window.calendarEvents = {};
            window.calendarResponses = {};
            window.trainingSessions = {};
            window.matchResults = {};
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
        updateWeeklyAttendanceChart();
        if (window.renderCalendarTable) window.renderCalendarTable();
        populateIndividualSelectors();
    };
    const createJerseyElement = (athlete) => {
        const jersey = document.createElement('div');
        jersey.className = 'player-jersey';
        jersey.dataset.athleteId = athlete.id;
        jersey.dataset.role = athlete.role;
        const jerseyColor = athlete.role.toLowerCase().includes('portiere') ? '#E8C135' : '#1e5095';
        jersey.innerHTML = `<div class="jersey-body" style="--jersey-color: ${jerseyColor}; background-color: ${jerseyColor};position:relative;"><span class="jersey-number">${athlete.number}</span></div><span class="player-name">${escapeHtml(athlete.name)}</span>`;
        // Avviso infortunio (non blocca): badge 🤕 ben visibile in alto a destra,
        // distinto dal lucchetto visita scaduta (in alto a sinistra).
        if (athlete.infortunato) {
            const inj = document.createElement('span');
            inj.innerHTML = '🤕';
            inj.title = 'Infortunato' + (athlete.dataRientro ? ' — rientro previsto ' + new Date(athlete.dataRientro+'T00:00:00').toLocaleDateString('it-IT') : '');
            inj.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#fff;border:2px solid #d90429;border-radius:50%;width:1.6em;height:1.6em;display:flex;align-items:center;justify-content:center;font-size:0.95em;z-index:5;box-shadow:0 1px 4px rgba(0,0,0,0.4);';
            jersey.appendChild(inj);
        }
        return jersey;
    };
    const createTokenElement = (type, id) => {
        const token = document.createElement('div');
        token.className = 'token';
        token.dataset.itemType = type;
        if (id) token.dataset.tokenId = id;
        switch(type) {
            case 'captain-c': token.innerHTML = '<span style="color:#ffffff !important;">(C)</span>'; token.classList.add('token-captain'); break;
            case 'captain-vc': token.innerHTML = '<span style="color:#ffffff !important;">(VC)</span>'; token.classList.add('token-captain'); break;
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
                if (athlete.infortunato) { availablePlayer.classList.add('disabled'); availablePlayer.title = 'Infortunato' + (athlete.dataRientro ? ' — Rientro: ' + new Date(athlete.dataRientro + 'T00:00:00').toLocaleDateString('it-IT') : ''); availablePlayer.innerHTML = `<span><strong>${athlete.number}.</strong> ${escapeHtml(athlete.name)}</span><span class="badge bg-warning text-dark">🤕</span>`; }
                else if (isExpired) { availablePlayer.classList.add('disabled'); availablePlayer.title = 'Visita medica scaduta. Atleta non schierabile.'; availablePlayer.innerHTML = `<span><strong>${athlete.number}.</strong> ${escapeHtml(athlete.name)}</span><span class="badge bg-danger"><i class="bi bi-lock-fill"></i></span>`; }
                else { availablePlayer.innerHTML = `<span><strong>${athlete.number}.</strong> ${escapeHtml(athlete.name)}</span><span class="badge bg-secondary">${escapeHtml(athlete.role.substring(0,3))}</span>`; }
                elements.availableList.appendChild(availablePlayer);
            }
        });
        formationData.tokens.forEach(tokenData => { const tokenEl = createTokenElement(tokenData.type, tokenData.id); tokenEl.style.left = `${tokenData.left}%`; tokenEl.style.top = `${tokenData.top}%`; field.appendChild(tokenEl); });
    };
    const updateHomePage = () => {
        // ✅ Conta solo atleti NON ospiti nel conteggio principale
        const officialAthletes = athletes.filter(a => !a.isGuest && !a.isStaff && !a.archived);
        elements.homeTotalAthletes.textContent = officialAthletes.length;

        // Aggiorna box Staff Tecnico
        const staffMembers = athletes.filter(a => a.isStaff && !a.isGuest && !a.archived);
        if (elements.homeTotalStaff) {
            elements.homeTotalStaff.textContent = staffMembers.length;
        }
        if (elements.homeStaffBreakdown && staffMembers.length > 0) {
            // Raggruppa per ruolo
            const byRole = {};
            staffMembers.forEach(function(s) {
                var r = s.role || 'Staff';
                byRole[r] = (byRole[r] || 0) + 1;
            });
            var breakdown = Object.entries(byRole)
                .map(function(e) { return '<span>• ' + e[0] + ': <strong>' + e[1] + '</strong></span>'; })
                .join('<br>');
            elements.homeStaffBreakdown.innerHTML = breakdown;
        } else if (elements.homeStaffBreakdown) {
            elements.homeStaffBreakdown.innerHTML = '<span style="color:var(--bs-secondary)">Nessuno staff</span>';
        }
        const today = toLocalDateISO(new Date());
        const futureSessions = Object.entries(trainingSessions).filter(([date]) => date >= today).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB)).flatMap(([date, sessions]) => sessions.map(s => ({...s, date})));
        if (futureSessions.length > 0) {
            const nextSession = futureSessions[0];
            const sessionDate = new Date(nextSession.date);
            elements.homeNextSession.innerHTML = `<h5 class="card-title text-muted">PROSSIMA SESSIONE</h5><h6 class="mb-1">${escapeHtml(nextSession.title)}</h6><p class="mb-0">${sessionDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p><p class="mb-0 text-muted">${nextSession.time ? `Ore: ${escapeHtml(nextSession.time)}` : ''} ${nextSession.location ? `@ ${escapeHtml(nextSession.location)}` : ''}</p>`;
        } else {
            // Empty-state utile: invece di un grande vuoto, una CTA per pianificare.
            elements.homeNextSession.innerHTML = `<h5 class="card-title text-muted">PROSSIMA SESSIONE</h5>
                <div class="home-empty-state">
                    <div class="home-empty-icon">📅</div>
                    <p class="text-muted mb-2">Nessuna sessione pianificata</p>
                    <button class="btn btn-sm btn-outline-light btn-qa no-print" onclick="document.getElementById('quick-plan-session-btn').click()"><i class="bi bi-calendar-plus"></i> Pianifica la prima sessione</button>
                </div>`;
        }
        const now = new Date(); const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; const monthlyScores = {}; athletes.forEach(a => monthlyScores[a.id] = { name: a.name, score: 0 }); Object.entries(evaluations).forEach(([dateStr, dailyEvals]) => { if (dateStr.startsWith(currentMonthStr)) { Object.entries(dailyEvals).forEach(([athleteId, evaluation]) => { if (monthlyScores[athleteId]) { monthlyScores[athleteId].score += calculateAthleteScore(evaluation); } }); } }); const sortedAthletes = Object.values(monthlyScores).sort((a, b) => b.score - a.score); if (sortedAthletes.length > 0 && sortedAthletes[0].score > 0) { const maxScore = sortedAthletes[0].score; const topPerformers = sortedAthletes.filter(athlete => athlete.score === maxScore); const names = topPerformers.map(p => escapeHtml(p.name)).join('<br>'); elements.homeTopPerformer.innerHTML = `<h5 class="card-title text-muted">TOP PERFORMER MENSILE</h5><h6 class="mb-1">${names}</h6><p class="mb-0 text-muted">Punteggio: ${maxScore}</p><i class="bi bi-trophy-fill mt-2" style="font-size: 1.5rem; color: var(--gold-star);"></i>`; }
        else { elements.homeTopPerformer.innerHTML = `<h5 class="card-title text-muted">TOP PERFORMER MENSILE</h5>
                <div class="home-empty-state">
                    <div class="home-empty-icon">🏆</div>
                    <p class="text-muted mb-2">Nessuna valutazione questo mese</p>
                    <button class="btn btn-sm btn-outline-light btn-qa no-print" onclick="switchTab('squadra-section')"><i class="bi bi-card-checklist"></i> Valuta gli atleti</button>
                </div>`; }
    };
    // Pulsante "Password Individual" — solo admin, in Azioni Rapide Home
    (function() {
        var btn = document.getElementById('change-individual-pwd-btn');
        if (!btn) return;
        var role = sessionStorage.getItem('gosport_user_role') || '';
        if (role === 'admin') btn.style.display = '';
        btn.addEventListener('click', async function() {
            // 1) Password ATTUALE: serve a dimostrare di averne il diritto. Non
            //    viene mai mostrata (il server la verifica). Default storico: 1234.
            var oldPwd = prompt('🔐 Cambia Password Sessioni Individual\n\nInserisci la password ATTUALE\n(se non l\'hai mai cambiata è: 1234):');
            if (oldPwd === null) return; // Annulla
            // 2) Nuova password + conferma
            var newPwd = prompt('Inserisci la NUOVA password (min. 4 caratteri):');
            if (!newPwd || !newPwd.trim()) return;
            if (newPwd.trim().length < 4) { alert('❌ La nuova password deve avere almeno 4 caratteri.'); return; }
            var confirm2 = prompt('Conferma la NUOVA password:');
            if (newPwd.trim() !== (confirm2 || '').trim()) { alert('❌ Le password non corrispondono.'); return; }
            var annataId = sessionStorage.getItem('gosport_current_annata') || '';
            try {
                var resp = await fetch('/api/data?action=change-individual-pwd', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId },
                    body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd.trim() })
                });
                var data = await resp.json().catch(function(){ return {}; });
                if (!resp.ok || !data.success) {
                    alert('❌ ' + (data.message || 'Errore nel cambio password') + '.');
                    return;
                }
                // Allineo la copia locale usata per lo sblocco delle sessioni Individual
                _individualPassword = newPwd.trim();
                sessionStorage.setItem('gosport_individual_pwd', _individualPassword);
                alert('✅ Password Individual aggiornata!');
            } catch (e) {
                alert('❌ Errore di rete nel cambio password.');
            }
        });
    })();




    // ── Pianifica sessioni Individual sul Calendario Attività ───────────
    window.pianificaIndividualCalendario = async function(athleteId) {
        const athlete = athletes.find(a => String(a.id) === String(athleteId));
        if (!athlete || !athlete.individualPackage) {
            alert('Nessun pacchetto Individual configurato per questo atleta.');
            return;
        }
        const pkg = athlete.individualPackage;
        const startDate   = pkg.startDate;
        const expiryDate  = pkg.expiryDate;
        const weekDays    = (pkg.weekDays || []).map(Number);
        const time        = pkg.preferredTime || '';
        const coachName   = pkg.coachName || '';
        const coachColor  = pkg.coachColor || '#3b82f6';
        const pkgLessons  = { '5': 5, '10+1': 10, '20+2': 20, '30+3': 30 };
        const totalLessons = pkgLessons[pkg.type] || 0;

        if (!startDate || !expiryDate || weekDays.length === 0 || totalLessons === 0) {
            alert('⚠️ Configura: Pacchetto, Data Inizio, Data Scadenza e Giorni della Settimana.');
            return;
        }

        const start    = new Date(startDate + 'T00:00:00');
        const finalDt  = new Date(expiryDate + 'T00:00:00');

        // Genera tutte le date valide (usando date locali per evitare bug fuso orario)
        const sessions = [];
        const cur = new Date(start);
        while (cur <= finalDt) {
            // getDay() usa ora locale — corretto
            const localDay = cur.getDay();
            if (weekDays.includes(localDay)) {
                sessions.push(new Date(cur));
            }
            cur.setDate(cur.getDate() + 1);
        }

        if (sessions.length === 0) {
            alert('⚠️ Nessuna sessione trovata. Verifica i giorni della settimana e le date.');
            return;
        }

        const coachInfo = coachName ? ' con ' + coachName : '';
        if (!confirm('Pianificare ' + sessions.length + ' sessioni Individual per ' + athlete.name + coachInfo + '?\n\nDal ' + start.toLocaleDateString('it-IT') + ' al ' + finalDt.toLocaleDateString('it-IT') + '\n\nLe sessioni Individual esistenti per questo atleta verranno rimosse e riscritte.')) return;

        // Rimuovi sessioni individual esistenti per questo atleta (tutti i formati)
        for (const date in trainingSessions) {
            trainingSessions[date] = trainingSessions[date].filter(s => {
                // Vecchio formato (senza isIndividual) o nuovo formato
                const byId = s.isIndividual && String(s.athleteId) === String(athlete.id);
                const byTitle = s.title && s.title.includes('🏋️') && s.title.includes(athlete.name);
                return !(byId || byTitle);
            });
            if (trainingSessions[date].length === 0) delete trainingSessions[date];
        }

        // Aggiungi le nuove sessioni
        sessions.forEach((date, idx) => {
            // Usa data locale per evitare shift da UTC
            const dateStr = date.getFullYear() + '-' +
                String(date.getMonth()+1).padStart(2,'0') + '-' +
                String(date.getDate()).padStart(2,'0');
            if (!trainingSessions[dateStr]) trainingSessions[dateStr] = [];
            trainingSessions[dateStr].push({
                id: 'ind_' + athlete.id + '_' + dateStr,
                date: dateStr,
                title: '🏋️ ' + athlete.name + (coachName ? ' — ' + coachName : ''),
                time: time,
                location: '',
                goals: coachName ? 'Coach: ' + coachName : '',
                description: 'Individual — Pacchetto: ' + pkg.type + ' — Lez. ' + (idx+1) + '/' + totalLessons,
                coachColor: coachColor,
                isIndividual: true,
                athleteId: String(athlete.id)
            });
        });

        // Salva PRIMA, poi aggiorna UI
        const ok = await saveData();
        if (ok) {
            renderCalendar();
            updateHomePage();
            alert('✅ ' + sessions.length + ' sessioni pianificate!\n\nVai sul Calendario e naviga al mese ' + start.toLocaleDateString('it-IT', {month:'long', year:'numeric'}) + ' per vederle.');
        } else {
            alert('❌ Errore nel salvataggio. Riprova.');
        }
    };

        // ── Calcola data scadenza pacchetto Individual ──────────────────────
    window.previewAvatarUrl = function(url) {
        var prev = document.getElementById('avatar-preview');
        if (!prev) return;
        if (url && url.trim()) {
            prev.src = url.trim();
            prev.style.display = 'block';
            prev.onerror = function() { this.style.display = 'none'; };
        } else {
            prev.style.display = 'none';
            prev.src = '';
        }
    };
    window.calcIndividualExpiry = function() {
        const startVal  = document.getElementById('athlete-individual-start')?.value;
        const pkgType   = document.getElementById('athlete-individual-pkg')?.value;
        const daysWeek  = parseInt(document.getElementById('athlete-ind-days-week')?.value) || 0;
        const expiryEl  = document.getElementById('athlete-individual-expiry');

        if (!startVal || !pkgType || !daysWeek || !expiryEl) return;

        const pkgLessons = { '5': 5, '10+1': 10, '20+2': 20, '30+3': 30 };
        const totalLessons = pkgLessons[pkgType];
        if (!totalLessons) return;

        // Calcola settimane necessarie (arrotonda per eccesso)
        const weeksNeeded = Math.ceil(totalLessons / daysWeek);

        // Aggiungi le settimane alla data di inizio
        const start = new Date(startVal + 'T00:00:00');
        const endDate = new Date(start.getTime() + weeksNeeded * 7 * 24 * 3600 * 1000);

        // Trova il venerdì della settimana calcolata (day 5)
        const dayOfWeek = endDate.getDay(); // 0=Dom, 5=Ven
        const daysToFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
        const friday = new Date(endDate.getTime() + daysToFriday * 24 * 3600 * 1000);

        expiryEl.value = friday.toISOString().split('T')[0];
    };

    // ════ PACCHETTI LEZIONI INDIVIDUAL ════════════════════════════════
    const INDIVIDUAL_PACKAGES = {
        '': { label: 'Nessuno', lessons: 0, recovery: 0 },
        '5': { label: '5 Lezioni', lessons: 5, recovery: 0 },
        '10+1': { label: '10 + 1 Recupero', lessons: 10, recovery: 1 },
        '20+2': { label: '20 + 2 Recupero', lessons: 20, recovery: 2 },
        '30+3': { label: '30 + 3 Recupero', lessons: 30, recovery: 3 },
    };

    function getIndividualStatus(athlete) {
        const pkg = athlete.individualPackage;
        if (!pkg || !pkg.type) return null;
        const conf = INDIVIDUAL_PACKAGES[pkg.type];
        if (!conf || conf.lessons === 0) return null;

        // Conta lezioni usate dalle valutazioni
        let used = 0;
        Object.values(evaluations).forEach(dayEvals => {
            const ev = dayEvals[String(athlete.id)];
            if (ev && ev['presenza-individual'] === 1) used++;
        });

        const today = new Date(); today.setHours(0,0,0,0);
        const expiry = pkg.expiryDate ? new Date(pkg.expiryDate + 'T00:00:00') : null;
        const recoveryEnd = expiry ? new Date(expiry.getTime() + conf.recovery * 7 * 86400000) : null;

        const lessonsDone = used >= conf.lessons;
        const pastExpiry = expiry && today > expiry;
        const pastRecovery = recoveryEnd && today > recoveryEnd;

        let status, color, text;
        if (lessonsDone || pastRecovery) {
            status = 'red'; color = '#d90429';
            text = lessonsDone
                ? `${used}/${conf.lessons} ✓ Completato`
                : `Scaduto il ${recoveryEnd.toLocaleDateString('it-IT')}`;
        } else if (pastExpiry) {
            status = 'orange'; color = '#f59e0b';
            text = `${used}/${conf.lessons} ⏳ Recupero in corso`;
        } else {
            status = 'green'; color = '#16a34a';
            const rem = conf.lessons - used;
            text = `${used}/${conf.lessons} — ${rem} lezioni rimaste`;
        }
        return { status, color, text, used, total: conf.lessons, conf, expiry, recoveryEnd };
    }
    // ════════════════════════════════════════════════════════════════════

    // ── Collassa/Espandi grafici Presenze ────────────────────────────
    window.togglePresenzeChart = function(wrapperId, btnId) {
        const el = document.getElementById(wrapperId);
        const btn = document.getElementById(btnId);
        if (!el) return;
        const collapsed = el.style.display === 'none';
        el.style.display = collapsed ? '' : 'none';
        if (btn) btn.textContent = collapsed ? '▲' : '▼';
        // Salva stato in sessionStorage
        const state = JSON.parse(localStorage.getItem('gosport_presenze_charts') || '{}');
        state[wrapperId] = !collapsed;
        localStorage.setItem('gosport_presenze_charts', JSON.stringify(state));
    };

    // Ripristina stato grafici al cambio tab
    window.restorePresenzeChartsState = function restorePresenzeChartsState() {
        const state = JSON.parse(localStorage.getItem('gosport_presenze_charts') || '{}');
        Object.entries(state).forEach(([wrapperId, collapsed]) => {
            const el = document.getElementById(wrapperId);
            const btnId = wrapperId.replace('-outer','').replace('-wrapper','') + '-collapse-' +
                ({
                    'attendance-chart-wrapper-outer': '1',
                    'weekly-chart-wrapper-outer': '2',
                    'individual-chart-wrapper-outer': '3',
                    'individual-summary-outer': '4'
                }[wrapperId] || '');
            if (el && collapsed) {
                el.style.display = 'none';
                const btn = document.querySelector('[id$="' + {
                    'attendance-chart-wrapper-outer': 'collapse-1',
                    'weekly-chart-wrapper-outer': 'collapse-2',
                    'individual-chart-wrapper-outer': 'collapse-3',
                    'individual-summary-outer': 'collapse-4'
                }[wrapperId] + '"]');
                if (btn) btn.textContent = '▼';
            }
        });
    };

    // ── Popola selectors Individual nel foglio Presenze ─────────────
    function populateIndividualSelectors() {
        const withPkg = athletes.filter(a => a.individualPackage && a.individualPackage.type && !a.isGuest);
        ['ind-athlete-1-selector','ind-athlete-2-selector','ind-summary-athlete-selector'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const currentVal = sel.value;
            const firstOpt = id !== 'ind-athlete-1-selector' ? '<option value="">-- Nessun confronto --</option>' : '<option value="">-- Seleziona atleta --</option>';
            sel.innerHTML = firstOpt + withPkg.map(a =>
                `<option value="${a.id}">${escapeHtml(a.name)}</option>`
            ).join('');
            if (currentVal) sel.value = currentVal;
        });
    }

    // ── Grafico Confronto Presenze Individual ────────────────────────
    let _indChart = null;
    window.renderIndividualChart = function() {
        const a1id = document.getElementById('ind-athlete-1-selector')?.value;
        const a2id = document.getElementById('ind-athlete-2-selector')?.value;
        const period = document.querySelector('#ind-period-toggle .active')?.dataset.period || 'monthly';
        const canvas = document.getElementById('individualAttendanceChart');
        if (!canvas || !a1id) return;

        const a1 = athletes.find(a => String(a.id) === String(a1id));
        const a2 = a2id ? athletes.find(a => String(a.id) === String(a2id)) : null;

        // Raccoglie dati Individual per un atleta
        function getIndData(athlete) {
            const result = { present: {}, absent: {}, notFruita: {} };
            Object.entries(evaluations).forEach(([date, dayEvals]) => {
                const ev = dayEvals[String(athlete.id)];
                if (!ev || ev['presenza-individual'] === '' || ev['presenza-individual'] === undefined) return;
                let key;
                if (period === 'daily') key = date;
                else if (period === 'weekly') {
                    const d = new Date(date); const day = d.getDay();
                    const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
                    key = monday.toISOString().split('T')[0];
                } else {
                    key = date.substring(0, 7);
                }
                const val = ev['presenza-individual'];
                if (val === 1) result.present[key] = (result.present[key] || 0) + 1;
                else if (val === 0) result.absent[key] = (result.absent[key] || 0) + 1;
                else if (val === 's') result.notFruita[key] = (result.notFruita[key] || 0) + 1;
            });
            return result;
        }

        const d1 = getIndData(a1);
        const d2 = a2 ? getIndData(a2) : null;

        // Unione di tutte le chiavi ordinate
        const allKeys = [...new Set([
            ...Object.keys(d1.present), ...Object.keys(d1.absent), ...Object.keys(d1.notFruita),
            ...(d2 ? [...Object.keys(d2.present), ...Object.keys(d2.absent), ...Object.keys(d2.notFruita)] : [])
        ])].sort();

        if (allKeys.length === 0) {
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            if (_indChart) { _indChart.destroy(); _indChart = null; }
            return;
        }

        const datasets = [
            { label: `${a1.name} — Presenti`, data: allKeys.map(k => d1.present[k] || 0), backgroundColor: 'rgba(34,197,94,0.8)' },
            { label: `${a1.name} — Assenti`, data: allKeys.map(k => d1.absent[k] || 0), backgroundColor: 'rgba(239,68,68,0.8)' },
            { label: `${a1.name} — Non Fruita`, data: allKeys.map(k => d1.notFruita[k] || 0), backgroundColor: 'rgba(251,191,36,0.8)' },
        ];
        if (d2) {
            datasets.push(
                { label: `${a2.name} — Presenti`, data: allKeys.map(k => d2.present[k] || 0), backgroundColor: 'rgba(96,165,250,0.8)' },
                { label: `${a2.name} — Assenti`, data: allKeys.map(k => d2.absent[k] || 0), backgroundColor: 'rgba(244,114,182,0.8)' },
                { label: `${a2.name} — Non Fruita`, data: allKeys.map(k => d2.notFruita[k] || 0), backgroundColor: 'rgba(167,139,250,0.8)' },
            );
        }

        if (_indChart) _indChart.destroy();
        _indChart = new Chart(canvas, {
            type: 'bar',
            data: { labels: allKeys, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { stacked: false, ticks: { color: _chartTickColor(), maxRotation: 45 }, grid: { color: _chartGridColor() } },
                    y: { ticks: { color: _chartTickColor(), stepSize: 1 }, grid: { color: _chartGridColor() } }
                },
                plugins: { legend: { labels: { color: _chartTickColor(), font: { size: 11 } } } }
            }
        });
    };

    // Periodo toggle grafico Individual
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('#ind-period-toggle .btn');
        if (!btn) return;
        document.querySelectorAll('#ind-period-toggle .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderIndividualChart();
    });

    // ── Pannello Riepilogo Individual ────────────────────────────────
    let _summaryDonut = null;
    window.renderIndividualSummary = function() {
        const athleteId = document.getElementById('ind-summary-athlete-selector')?.value;
        const container = document.getElementById('individual-summary-content');
        if (!container) return;
        if (!athleteId) {
            container.innerHTML = '<p class="text-muted">Seleziona un atleta per visualizzare il riepilogo.</p>';
            return;
        }
        const athlete = athletes.find(a => String(a.id) === String(athleteId));
        if (!athlete || !athlete.individualPackage || !athlete.individualPackage.type) {
            container.innerHTML = '<p class="text-muted">Questo atleta non ha un pacchetto Individual configurato.</p>';
            return;
        }
        const pkg = athlete.individualPackage;
        const conf = INDIVIDUAL_PACKAGES[pkg.type];
        if (!conf || conf.lessons === 0) { container.innerHTML = '<p class="text-muted">Pacchetto non valido.</p>'; return; }

        // Conta presenze/assenze Individual
        let present = 0, absent = 0;
        Object.values(evaluations).forEach(dayEvals => {
            const ev = dayEvals[String(athlete.id)];
            if (!ev) return;
            if (ev['presenza-individual'] === 1) present++;
            else if (ev['presenza-individual'] === 0) absent++;
        });
        const total = conf.lessons;
        const remaining = Math.max(0, total - present);

        const startFmt = pkg.startDate ? new Date(pkg.startDate + 'T00:00:00').toLocaleDateString('it-IT') : '—';
        const endFmt   = pkg.expiryDate ? new Date(pkg.expiryDate + 'T00:00:00').toLocaleDateString('it-IT') : '—';
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;

        container.innerHTML = `
            <div class="row g-3 align-items-center">
                <div class="col-md-4">
                    <canvas id="individual-donut-chart" height="220"></canvas>
                </div>
                <div class="col-md-8">
                    <div class="row g-2">
                        <div class="col-6"><div style="background:var(--bg-primary);border-radius:8px;padding:12px 16px;">
                            <div style="color:#94a3b8;font-size:0.75rem;">PACCHETTO</div>
                            <div style="color:var(--text-primary);font-weight:600;">${conf.label}</div>
                        </div></div>
                        <div class="col-6"><div style="background:var(--bg-primary);border-radius:8px;padding:12px 16px;">
                            <div style="color:#94a3b8;font-size:0.75rem;">PERIODO</div>
                            <div style="color:var(--text-primary);font-weight:600;font-size:0.85rem;">${startFmt} → ${endFmt}</div>
                        </div></div>
                        <div class="col-4"><div style="background:var(--bg-primary);border-radius:8px;padding:12px 16px;text-align:center;">
                            <div style="color:#16a34a;font-size:1.8rem;font-weight:700;">${present}</div>
                            <div style="color:#94a3b8;font-size:0.72rem;">LEZIONI FATTE</div>
                        </div></div>
                        <div class="col-4"><div style="background:var(--bg-primary);border-radius:8px;padding:12px 16px;text-align:center;">
                            <div style="color:#d90429;font-size:1.8rem;font-weight:700;">${absent}</div>
                            <div style="color:#94a3b8;font-size:0.72rem;">CON ASSENZA</div>
                        </div></div>
                        <div class="col-4"><div style="background:var(--bg-primary);border-radius:8px;padding:12px 16px;text-align:center;">
                            <div style="color:#60a5fa;font-size:1.8rem;font-weight:700;">${remaining}</div>
                            <div style="color:#94a3b8;font-size:0.72rem;">RESIDUE</div>
                        </div></div>
                        <div class="col-12"><div style="background:var(--bg-primary);border-radius:8px;padding:10px 16px;">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                                <span style="color:#94a3b8;font-size:0.75rem;">AVANZAMENTO</span>
                                <span style="color:var(--text-primary);font-size:0.75rem;">${pct}%</span>
                            </div>
                            <div style="background:var(--bg-panel);border-radius:4px;height:8px;">
                                <div style="background:linear-gradient(90deg,#16a34a,#16a34a);width:${pct}%;height:8px;border-radius:4px;transition:width 0.4s;"></div>
                            </div>
                        </div></div>
                    </div>
                </div>
            </div>`;

        // Grafico ciambella
        if (_summaryDonut) _summaryDonut.destroy();
        const dc = document.getElementById('individual-donut-chart');
        if (dc) {
            _summaryDonut = new Chart(dc, {
                type: 'doughnut',
                data: {
                    labels: ['Lezioni fatte', 'Lezioni residue', 'Assenze'],
                    datasets: [{ data: [present, remaining, absent],
                        backgroundColor: ['#16a34a', '#60a5fa', '#d90429'],
                        borderColor: '#0f172a', borderWidth: 3 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: _chartTickColor(), font: { size: 11 }, padding: 10 } },
                        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} lezioni` } }
                    }
                }
            });
        }
    };

    // ── Vista Squadra: 'box' o 'list' ──────────────────────────
    let squadView = sessionStorage.getItem('gosport_squad_view') || 'box';
    let showArchived = false;
    window.toggleArchiveView = function() {
        showArchived = !showArchived;
        const btn = document.getElementById('toggle-archive-btn');
        if (btn) {
            btn.classList.toggle('btn-outline-warning', !showArchived);
            btn.classList.toggle('btn-warning', showArchived);
            btn.innerHTML = showArchived
                ? '<i class="bi bi-archive-fill"></i> Archivio attivo'
                : '<i class="bi bi-archive"></i> Archivio';
        }
        renderAthletes();
    };

    window.renderAthletes = () => renderAthletes();
    window.renderMatchResults = () => renderMatchResults();
    window.updateMatchResultsFilterDependents = () => {
        renderCardsSummary();
        renderTopScorers();
        renderTopAssists();
        updateMatchAnalysisChart();
    };

    // ── Alert settings ────────────────────────────────────────────────────
    const loadAlertSettings = async () => {
        try {
            const societyId = sessionStorage.getItem('gosport_society_id') || '';
            if (!societyId) return;
            const r = await fetch('/api/data?action=alert-settings', {
                headers: { 'X-Society-Id': societyId }
            });
            const d = await r.json();
            if (d.success) {
                const vEl = document.getElementById('alert-visita-days');
                const tEl = document.getElementById('alert-tessera-days');
                if (vEl) vEl.value = d.settings.visitaDays ?? 60;
                if (tEl) tEl.value = d.settings.tesseraDays ?? 15;
            }
        } catch(e) { /* silenzioso */ }
    };
    loadAlertSettings();

    window.saveAlertSettings = async () => {
        const fb = document.getElementById('alert-settings-feedback');
        const visitaDays = parseInt(document.getElementById('alert-visita-days')?.value) || 60;
        const tesseraDays = parseInt(document.getElementById('alert-tessera-days')?.value) || 15;
        const societyId = sessionStorage.getItem('gosport_society_id') || '';
        const annataId = sessionStorage.getItem('gosport_current_annata') || '';
        const authSession = sessionStorage.getItem('gosport_session_token') || '';
        const username = sessionStorage.getItem('gosport_auth_user') || '';
        const role = sessionStorage.getItem('gosport_user_role') || '';
        try {
            const r = await fetch('/api/data?action=alert-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Society-Id': societyId,
                    'X-Annata-Id': annataId,
                    'X-Auth-Session': authSession,
                    'X-Auth-User': username,
                    'X-User-Role': role
                },
                body: JSON.stringify({ visitaDays, tesseraDays })
            });
            const d = await r.json();
            if (fb) { fb.style.color = d.success ? '#22c55e' : '#ef4444'; fb.textContent = d.success ? '✓ Salvato' : '✗ Errore'; setTimeout(() => { if(fb) fb.textContent = ''; }, 3000); }
        } catch(e) {
            if (fb) { fb.style.color = '#ef4444'; fb.textContent = '✗ Errore di rete'; }
        }
    };

    // ── CAMBIO STAGIONE: archivio + reset + export/import ────────────────────
    // Headers auth completi (come saveAlertSettings) per gli endpoint protetti.
    const _seasonHeaders = (json) => {
        const h = {
            'X-Society-Id': sessionStorage.getItem('gosport_society_id') || '',
            'X-Annata-Id': sessionStorage.getItem('gosport_current_annata') || '',
            'X-Auth-Session': sessionStorage.getItem('gosport_session_token') || '',
            'X-Auth-User': sessionStorage.getItem('gosport_auth_user') || '',
            'X-User-Role': sessionStorage.getItem('gosport_user_role') || ''
        };
        if (json) h['Content-Type'] = 'application/json';
        return h;
    };
    const _seasonDate = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });
    };
    const _seasonAthName = (id) => {
        const a = (athletes || []).find(x => String(x.id) === String(id));
        return a ? (a.name || `${a.cognome||''} ${a.nome||''}`.trim() || String(id)) : String(id);
    };

    // Carica e renderizza l'elenco degli archivi disponibili
    window.loadSeasonArchives = async () => {
        const box = document.getElementById('season-archive-list');
        if (!box) return;
        box.innerHTML = '<p class="text-muted">Caricamento…</p>';
        try {
            const r = await fetch('/api/data?action=season-archive', { headers: _seasonHeaders(false) });
            const d = await r.json();
            if (!r.ok || !d.success) { box.innerHTML = '<p class="text-danger">Errore nel caricamento archivi.</p>'; return; }
            const archives = d.archives || [];
            if (!archives.length) {
                box.innerHTML = '<p class="text-muted">Nessuna stagione archiviata. Usa "Inizia nuova stagione" per crearne una.</p>';
                return;
            }
            box.innerHTML = archives.map(a => {
                const c = a.counts || {};
                return `<div class="border rounded p-2 mb-2 d-flex flex-wrap align-items-center gap-2">
                    <div class="flex-grow-1">
                        <strong><i class="bi bi-archive"></i> Stagione ${escapeHtml(a.label)}</strong>
                        <div class="small text-muted">Archiviata il ${_seasonDate(a.archivedAt)} · cancellazione automatica il <strong>${_seasonDate(a.expiresAt)}</strong></div>
                        <div class="small text-muted">⚽ ${c.matchResults||0} partite · 📅 ${c.calendarEvents||0} eventi · 🏃 ${c.trainingSessions||0} allenamenti · 📋 ${c.evaluations||0} giorni valutazioni · 🏆 ${c.awards||0} premi</div>
                    </div>
                    <div class="d-flex gap-1 flex-wrap">
                        <button class="btn btn-sm btn-outline-primary" onclick="window.viewSeasonArchive('${encodeURIComponent(a.label)}')"><i class="bi bi-eye"></i> Vedi</button>
                        <button class="btn btn-sm btn-outline-success" onclick="window.exportSeasonArchive('${encodeURIComponent(a.label)}')"><i class="bi bi-download"></i> Backup</button>
                    </div>
                </div>`;
            }).join('');
        } catch(e) {
            box.innerHTML = '<p class="text-danger">Errore di rete.</p>';
        }
    };

    // Recupera il dettaglio completo di un archivio dal server
    const _fetchSeasonArchive = async (label) => {
        const r = await fetch('/api/data?action=season-archive&label=' + encodeURIComponent(label), { headers: _seasonHeaders(false) });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.message || 'Archivio non trovato');
        return d.archive;
    };

    // Visualizza il dettaglio (sola lettura). Usato sia per gli archivi su server
    // sia per un file importato (oggetto passato direttamente).
    window.viewSeasonArchive = async (labelEnc) => {
        const label = decodeURIComponent(labelEnc);
        try {
            const entry = await _fetchSeasonArchive(label);
            _renderSeasonArchiveDetail(entry, false);
        } catch(e) {
            alert('❌ ' + e.message);
        }
    };

    function _renderSeasonArchiveDetail(entry, imported) {
        const wrap = document.getElementById('season-archive-detail');
        if (!wrap || !entry) return;
        const d = entry.data || {};
        const rows = [];
        // Partite
        const mr = d.matchResults || {};
        const partite = Object.keys(mr).length;
        // Premi
        const awardItems = [];
        for (const [key, aw] of Object.entries(d.awards || {})) {
            const list = Array.isArray(aw) ? aw : [aw];
            list.forEach(a => { if (a && typeof a === 'object') awardItems.push({ ath: _seasonAthName(a.athleteId || key), reason: a.reason || '', date: a.date || key }); });
        }
        // Eventi calendario
        const eventi = Object.keys(d.calendarEvents || {}).length;
        // Giorni con presenze a calendario (RSVP)
        const giorniPres = Object.keys(d.calendarResponses || {}).length;
        // Giorni con valutazioni (= presenze allenamento) e allenamenti programmati
        const giorniVal = Object.keys(d.evaluations || {}).length;
        const allenamenti = Object.keys(d.trainingSessions || {}).length;
        const inventoryCount = Array.isArray(d.inventory) ? d.inventory.length : 0;

        const awardHtml = awardItems.length
            ? '<ul class="mb-0 small">' + awardItems.map(a => `<li><strong>${escapeHtml(a.ath)}</strong>${a.reason ? ' — ' + escapeHtml(a.reason) : ''} <span class="text-muted">(${escapeHtml(a.date)})</span></li>`).join('') + '</ul>'
            : '<span class="text-muted small">Nessun premio.</span>';

        const canRestoreSeason = !imported && sessionStorage.getItem('gosport_user_role') === 'admin';
        const restorePanelHtml = canRestoreSeason ? `
                <div class="border rounded p-2 mt-3" id="season-restore-panel">
                    <h6 class="mb-2"><i class="bi bi-arrow-repeat"></i> Ripristina nella stagione corrente</h6>
                    <p class="small text-muted mb-2">Aggiunge i dati selezionati alla stagione attiva. Non sovrascrive mai: gli elementi già presenti vengono saltati.</p>
                    <div class="row g-2">
                        <div class="col-6 col-md-4">
                            <div class="form-check">
                                <input class="form-check-input season-restore-cat" type="checkbox" value="matchResults" id="restore-cat-matches" ${partite === 0 ? 'disabled' : ''}>
                                <label class="form-check-label small" for="restore-cat-matches">Risultati Partite (${partite})</label>
                            </div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="form-check">
                                <input class="form-check-input season-restore-cat" type="checkbox" value="trainingSessions" id="restore-cat-training" ${allenamenti === 0 ? 'disabled' : ''}>
                                <label class="form-check-label small" for="restore-cat-training">Allenamenti (${allenamenti})</label>
                            </div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="form-check">
                                <input class="form-check-input season-restore-cat" type="checkbox" value="evaluations" id="restore-cat-evaluations" ${giorniVal === 0 ? 'disabled' : ''}>
                                <label class="form-check-label small" for="restore-cat-evaluations">Presenze/Valutazioni (${giorniVal}g)</label>
                            </div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="form-check">
                                <input class="form-check-input season-restore-cat" type="checkbox" value="awards" id="restore-cat-awards" ${awardItems.length === 0 ? 'disabled' : ''}>
                                <label class="form-check-label small" for="restore-cat-awards">Hall of Fame (${awardItems.length})</label>
                            </div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="form-check">
                                <input class="form-check-input season-restore-cat" type="checkbox" value="calendarEvents" id="restore-cat-calevents" ${eventi === 0 ? 'disabled' : ''}>
                                <label class="form-check-label small" for="restore-cat-calevents">Calendario Eventi (${eventi})</label>
                            </div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="form-check">
                                <input class="form-check-input season-restore-cat" type="checkbox" value="calendarResponses" id="restore-cat-calresponses" ${giorniPres === 0 ? 'disabled' : ''}>
                                <label class="form-check-label small" for="restore-cat-calresponses">RSVP Calendario (${giorniPres}g)</label>
                            </div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="form-check">
                                <input class="form-check-input season-restore-cat" type="checkbox" value="inventory" id="restore-cat-inventory" ${inventoryCount === 0 ? 'disabled' : ''}>
                                <label class="form-check-label small" for="restore-cat-inventory">Materiale (${inventoryCount})</label>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-warning mt-2" id="season-restore-btn" onclick="window.restoreSeasonArchive('${escapeHtml(entry.label)}')"><i class="bi bi-arrow-repeat"></i> Ripristina selezionati</button>
                    <div id="season-restore-result" class="small mt-2"></div>
                </div>` : '';

        wrap.innerHTML = `<div class="card chart-card">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-eye"></i> Stagione ${escapeHtml(entry.label)}
                    ${imported ? '<span class="badge bg-info ms-2">importata (sola visualizzazione)</span>' : ''}
                </h5>
                <p class="small text-muted">Archiviata il ${_seasonDate(entry.archivedAt)}. Sola lettura.</p>
                <div class="row g-2 text-center mb-3">
                    <div class="col"><div class="border rounded p-2"><div class="h4 mb-0">${partite}</div><small class="text-muted">Partite</small></div></div>
                    <div class="col"><div class="border rounded p-2"><div class="h4 mb-0">${eventi}</div><small class="text-muted">Eventi</small></div></div>
                    <div class="col"><div class="border rounded p-2"><div class="h4 mb-0">${allenamenti}</div><small class="text-muted">Allenamenti</small></div></div>
                    <div class="col"><div class="border rounded p-2"><div class="h4 mb-0">${giorniVal}</div><small class="text-muted">Gg valutazioni</small></div></div>
                    <div class="col"><div class="border rounded p-2"><div class="h4 mb-0">${giorniPres}</div><small class="text-muted">Gg presenze</small></div></div>
                    <div class="col"><div class="border rounded p-2"><div class="h4 mb-0">${awardItems.length}</div><small class="text-muted">Premi</small></div></div>
                </div>
                <h6><i class="bi bi-award-fill" style="color:#ea580c;"></i> Hall of Fame</h6>
                ${awardHtml}
                ${restorePanelHtml}
                <div class="mt-3">
                    <button class="btn btn-sm btn-outline-success" onclick="window.exportSeasonArchiveObj()"><i class="bi bi-download"></i> Scarica questo archivio</button>
                </div>
            </div>
        </div>`;
        wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // tieni l'oggetto corrente per l'export del dettaglio visualizzato
        window._currentSeasonArchive = entry;
    }

    // Ripristina le categorie selezionate di un archivio nella stagione corrente
    // (merge additivo lato server, mai sovrascrive). Solo admin.
    window.restoreSeasonArchive = async (label) => {
        const checked = Array.from(document.querySelectorAll('.season-restore-cat:checked')).map(el => el.value);
        const resultBox = document.getElementById('season-restore-result');
        if (checked.length === 0) {
            alert('Seleziona almeno una categoria da ripristinare.');
            return;
        }
        if (!confirm(`Stai per aggiungere ${checked.length} categoria/e dalla stagione "${label}" alla stagione corrente.\n\nI dati già presenti non verranno toccati: verranno aggiunti solo quelli mancanti.\n\nContinuare?`)) {
            return;
        }
        const btn = document.getElementById('season-restore-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Ripristino in corso…'; }
        try {
            const r = await fetch('/api/data?action=season-restore', {
                method: 'POST',
                headers: _seasonHeaders(true),
                body: JSON.stringify({ label, categories: checked })
            });
            const d = await r.json();
            if (!r.ok || !d.success) {
                if (resultBox) { resultBox.className = 'small mt-2 text-danger'; resultBox.textContent = '❌ ' + (d.message || 'Errore nel ripristino'); }
                return;
            }
            const LABELS = {
                matchResults: 'Risultati Partite', trainingSessions: 'Allenamenti',
                evaluations: 'Presenze/Valutazioni', awards: 'Hall of Fame',
                calendarEvents: 'Calendario Eventi', calendarResponses: 'RSVP Calendario',
                inventory: 'Materiale'
            };
            const lines = Object.entries(d.summary || {}).map(([cat, s]) =>
                `${LABELS[cat] || cat}: ${s.added} aggiunte, ${s.skipped} già presenti`
            );
            if (resultBox) { resultBox.className = 'small mt-2 text-success'; resultBox.innerHTML = '✓ ' + lines.join('<br>'); }
            await loadData();
            updateAllUI();
            if (checked.includes('inventory') && window.INV && typeof window.INV.load === 'function') {
                window.INV.load(true);
            }
        } catch (e) {
            if (resultBox) { resultBox.className = 'small mt-2 text-danger'; resultBox.textContent = '❌ Errore di rete'; }
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Ripristina selezionati'; }
        }
    };

    // Costruisce un workbook Excel da un archivio di stagione
    function _seasonArchiveToWorkbook(entry) {
        const d = entry.data || {};
        const wb = XLSX.utils.book_new();
        // Premi
        const awardRows = [];
        for (const [key, aw] of Object.entries(d.awards || {})) {
            const list = Array.isArray(aw) ? aw : [aw];
            list.forEach(a => { if (a && typeof a === 'object') awardRows.push({ 'Atleta': _seasonAthName(a.athleteId || key), 'Motivazione': a.reason || '', 'Data': a.date || key }); });
        }
        if (awardRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(awardRows), 'Hall of Fame');
        // Eventi calendario
        const evRows = Object.entries(d.calendarEvents || {}).map(([date, ev]) => ({
            'Data': date, 'Tipo': (ev && ev.type) || '', 'Orario': (ev && ev.time) || '', 'Note': (ev && ev.note) || ''
        }));
        if (evRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evRows), 'Calendario');
        // Presenze
        const presRows = [];
        for (const [date, byAth] of Object.entries(d.calendarResponses || {})) {
            if (byAth && typeof byAth === 'object') {
                for (const [aid, rec] of Object.entries(byAth)) {
                    presRows.push({ 'Data': date, 'Atleta': _seasonAthName(aid), 'Stato': typeof rec === 'object' ? (rec.status||'') : rec });
                }
            }
        }
        if (presRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(presRows), 'Presenze');
        // Risultati partite (marcatori/cartellini/assist)
        const matchRows = [];
        for (const [mid, m] of Object.entries(d.matchResults || {})) {
            if (!m || typeof m !== 'object') continue;
            ['scorers','cards','assists'].forEach(list => {
                (m[list]||[]).forEach(x => matchRows.push({
                    'Partita': mid, 'Tipo': list === 'scorers' ? 'Gol' : list === 'cards' ? ('Cartellino '+(x.tipo||'')) : 'Assist',
                    'Atleta': _seasonAthName(x.athleteId), 'Min': x.min || ''
                }));
            });
        }
        if (matchRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchRows), 'Risultati');
        // Valutazioni {date:{athleteId:{campo:voto}}} → una riga per atleta/data
        const valRows = [];
        for (const [date, byAth] of Object.entries(d.evaluations || {})) {
            if (byAth && typeof byAth === 'object') {
                for (const [aid, ev] of Object.entries(byAth)) {
                    if (!ev || typeof ev !== 'object') continue;
                    valRows.push({ 'Data': date, 'Atleta': _seasonAthName(aid), ...ev });
                }
            }
        }
        if (valRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(valRows), 'Valutazioni');
        // Allenamenti programmati {date:[{...}]}
        const trainRows = [];
        for (const [date, sessions] of Object.entries(d.trainingSessions || {})) {
            (Array.isArray(sessions) ? sessions : [sessions]).forEach(s => {
                if (s && typeof s === 'object') trainRows.push({ 'Data': date, 'Titolo': s.title || '', 'Orario': s.time || '', 'Luogo': s.location || '' });
            });
        }
        if (trainRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trainRows), 'Allenamenti');
        return wb;
    }

    // Scarica un archivio (dal server) come JSON + Excel
    window.exportSeasonArchive = async (labelEnc) => {
        const label = decodeURIComponent(labelEnc);
        try {
            const entry = await _fetchSeasonArchive(label);
            _downloadSeasonArchive(entry);
        } catch(e) { alert('❌ ' + e.message); }
    };
    // Scarica l'archivio attualmente visualizzato (anche se importato)
    window.exportSeasonArchiveObj = () => {
        if (window._currentSeasonArchive) _downloadSeasonArchive(window._currentSeasonArchive);
    };
    function _downloadSeasonArchive(entry) {
        const safe = String(entry.label || 'stagione').replace(/[^\w.\-]/g, '_');
        // JSON
        const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `SportMonitoring_Stagione_${safe}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        // Excel
        try {
            const wb = _seasonArchiveToWorkbook(entry);
            if (wb.SheetNames.length) XLSX.writeFile(wb, `SportMonitoring_Stagione_${safe}.xlsx`);
        } catch(e) { console.error('[season export xlsx]', e); }
    }

    // Inizia nuova stagione: archivia + azzera (con conferma forte)
    window.startNewSeason = async () => {
        const fb = document.getElementById('season-reset-feedback');
        const input = document.getElementById('season-label-input');
        const label = (input?.value || '').trim();
        if (!label) { if (fb) { fb.style.color = '#ef4444'; fb.textContent = 'Inserisci l\'etichetta (es. 2025-26)'; } return; }
        if (!confirm(`Stai per ARCHIVIARE e AZZERARE la stagione "${label}".\n\nVerranno spostati in archivio e azzerati:\n• Risultati partite (marcatori, cartellini, assist)\n• Calendario eventi e allenamenti\n• Valutazioni e presenze agli allenamenti\n• Presenze a calendario\n• Hall of Fame (premi)\n\nLa rosa atleti, i pagamenti, i certificati e i dati GPS NON vengono toccati.\nL'archivio si conserva 1 anno, poi viene cancellato in automatico.\n\nProcedere?`)) return;
        if (fb) { fb.style.color = '#64748b'; fb.textContent = 'Archiviazione in corso…'; }
        try {
            const r = await fetch('/api/data?action=season-reset', {
                method: 'POST', headers: _seasonHeaders(true), body: JSON.stringify({ label })
            });
            const d = await r.json();
            if (!r.ok || !d.success) { if (fb) { fb.style.color = '#ef4444'; fb.textContent = '✗ ' + (d.message || 'Errore'); } return; }
            if (input) input.value = '';
            // L'azzeramento è già avvenuto lato server. Ricarico l'INTERA pagina:
            // le tab "di stagione" (Risultati, Calendario, Presenze, Hall of Fame)
            // sono renderizzate da funzioni dedicate non tutte coperte da updateAllUI,
            // quindi un reload completo è l'unico modo affidabile per mostrare lo
            // stato pulito senza lasciare dati "fantasma" in memoria.
            if (fb) { fb.style.color = '#22c55e'; fb.textContent = '✓ Stagione archiviata — ricarico…'; }
            alert(`✅ Stagione "${label}" archiviata e azzerata.\n\nLa pagina verrà ricaricata per mostrare la nuova stagione pulita.`);
            location.reload();
        } catch(e) {
            if (fb) { fb.style.color = '#ef4444'; fb.textContent = '✗ Errore di rete'; }
        }
    };

    // Importa un file di backup .json → visualizza in memoria (NON salva nel server)
    window.importSeasonArchive = (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const entry = JSON.parse(e.target.result);
                if (!entry || !entry.data || !entry.label) throw new Error('File non valido: non sembra un backup di stagione.');
                _renderSeasonArchiveDetail(entry, true);
            } catch(err) {
                alert('❌ ' + (err.message || 'File non leggibile'));
            }
            if (event.target) event.target.value = '';
        };
        reader.readAsText(file);
    };

    window.exportFIGCCSV = function() {
        const annataId = sessionStorage.getItem('gosport_current_annata') || '';
        const annataLabel = annataId.replace(/_/g, ' ') || 'squadra';

        // Tutti (atleti + staff), esclusi solo gli ospiti
        const lista = athletes.filter(a => !a.isGuest);
        if (lista.length === 0) {
            alert('Nessun atleta presente nella rosa.');
            return;
        }

        const fmtDate = (iso) => {
            if (!iso) return '';
            const d = new Date(iso + 'T00:00:00');
            return [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('/');
        };

        const esc = (v) => {
            const s = String(v || '').replace(/"/g, '""');
            return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
        };

        const headers = ['Cognome','Nome','Data di Nascita','Codice Fiscale','Comune di Nascita','Provincia','Sesso','Ruolo','N° Tessera FIGC'];
        const rows = lista.map(a => {
            const parts = (a.name || '').split(/\s+/);
            const cognome = a.cognome || (parts.length > 1 ? parts[parts.length - 1] : a.name) || '';
            const nome    = a.nome    || (parts.length > 1 ? parts.slice(0,-1).join(' ') : '') || '';
            return [
                esc(cognome),
                esc(nome),
                esc(fmtDate(a.dataNascita)),
                esc(a.codiceFiscale || ''),
                esc(a.comuneNascita || ''),
                esc(a.provinciaNascita || ''),
                esc(a.sesso || ''),
                esc(a.role || ''),
                esc(a.numeroTessera || '')
            ].join(';');
        });

        // Atleti con dati FIGC incompleti
        const incompleti = lista.filter(a => !a.dataNascita || !a.codiceFiscale);
        if (incompleti.length > 0) {
            const nomi = incompleti.map(a => a.name).join(', ');
            const ok = confirm(`⚠️ ${incompleti.length} atleta/i ha dati FIGC incompleti (mancano data nascita o CF):\n\n${nomi}\n\nVuoi esportare comunque il CSV (le righe incomplete avranno celle vuote)?`);
            if (!ok) return;
        }

        const csv = '﻿' + [headers.join(';'), ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `figc_${annataLabel.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.validateCF = function() {
        const cfEl = document.getElementById('athlete-codice-fiscale');
        const feedbackEl = document.getElementById('cf-feedback');
        if (!cfEl || !feedbackEl) return;
        const cf = cfEl.value.toUpperCase().replace(/\s/g, '');
        cfEl.value = cf;
        if (!cf) { feedbackEl.textContent = ''; return; }

        const CF_RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i;
        if (cf.length !== 16 || !CF_RE.test(cf)) {
            feedbackEl.innerHTML = '<span style="color:#ef4444;">✗ Formato non valido (16 caratteri alfanumerici richiesti)</span>';
            return;
        }

        // Checksum
        const ODD  = {0:1,1:0,2:5,3:7,4:9,5:13,6:15,7:17,8:19,9:21,A:1,B:0,C:5,D:7,E:9,F:13,G:15,H:17,I:19,J:21,K:2,L:4,M:18,N:20,O:11,P:3,Q:6,R:8,S:12,T:14,U:16,V:10,W:22,X:25,Y:24,Z:23};
        const EVEN = {0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14,P:15,Q:16,R:17,S:18,T:19,U:20,V:21,W:22,X:23,Y:24,Z:25};
        let sum = 0;
        for (let i = 0; i < 15; i++) sum += (i % 2 === 0) ? ODD[cf[i]] : EVEN[cf[i]];
        if (cf[15] !== String.fromCharCode(65 + (sum % 26))) {
            feedbackEl.innerHTML = '<span style="color:#ef4444;">✗ Carattere di controllo errato (probabile errore di battitura)</span>';
            return;
        }

        // Cross-check con dati del form
        const issues = [], notes = [];
        const MONTH_MAP = {'A':0,'B':1,'C':2,'D':3,'E':4,'H':5,'L':6,'M':7,'P':8,'R':9,'S':10,'T':11};
        const MONTH_CODE = ['A','B','C','D','E','H','L','M','P','R','S','T'];

        const dob = document.getElementById('athlete-data-nascita')?.value;
        if (dob) {
            const d = new Date(dob + 'T00:00:00');
            const yy = String(d.getFullYear()).slice(-2);
            const mm = MONTH_CODE[d.getMonth()];
            const dd = d.getDate();
            if (cf.slice(6,8) !== yy)  issues.push(`anno (CF:${cf.slice(6,8)} ≠ ${yy})`);
            if (cf[8] !== mm)           issues.push(`mese (CF:${cf[8]} ≠ ${mm})`);
            const cfDay = parseInt(cf.slice(9,11));
            if (cfDay !== dd && cfDay !== dd + 40) issues.push(`giorno (CF:${cfDay} ≠ ${dd} o ${dd+40})`);

            const sesso = document.getElementById('athlete-sesso')?.value;
            if (sesso) {
                const cfDay2 = parseInt(cf.slice(9,11));
                if (sesso === 'M' && cfDay2 > 40) issues.push('sesso (CF=F, inserito M)');
                if (sesso === 'F' && cfDay2 <= 40) issues.push('sesso (CF=M, inserito F)');
            }
        }

        const nome    = (document.getElementById('athlete-nome')?.value    || document.getElementById('f-nome')?.value    || '').trim();
        const cognome = (document.getElementById('athlete-cognome')?.value || document.getElementById('f-cognome')?.value || '').trim();
        if (nome && cognome) {
            const normalize = s => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z]/g,'');
            const extractSurname = s => { const n = normalize(s); const c = n.replace(/[AEIOU]/g,''), v = n.replace(/[^AEIOU]/g,''); return (c+v+'XXX').slice(0,3); };
            const extractName    = s => { const n = normalize(s); const c = n.replace(/[AEIOU]/g,''); if (c.length>=4) return c[0]+c[2]+c[3]; const v = n.replace(/[^AEIOU]/g,''); return (c+v+'XXX').slice(0,3); };
            const exp_cog = extractSurname(cognome);
            const exp_nom = extractName(nome);
            if (cf.slice(0,3) !== exp_cog) notes.push(`cognome (atteso:${exp_cog})`);
            if (cf.slice(3,6) !== exp_nom) notes.push(`nome (atteso:${exp_nom})`);
        }

        if (issues.length > 0) {
            feedbackEl.innerHTML = `<span style="color:#f59e0b;">⚠ CF valido ma discordante: ${issues.join(', ')}</span>`;
        } else if (notes.length > 0) {
            feedbackEl.innerHTML = `<span style="color:#f59e0b;">⚠ CF valido. Verifica nome/cognome: ${notes.join(', ')}</span>`;
        } else {
            feedbackEl.innerHTML = '<span style="color:#22c55e;">✓ Codice Fiscale valido e coerente con i dati inseriti</span>';
        }
    };

    window.setSquadView = function(view) {
        squadView = view;
        sessionStorage.setItem('gosport_squad_view', view);
        document.getElementById('view-box-btn').classList.toggle('active', view === 'box');
        document.getElementById('view-list-btn').classList.toggle('active', view === 'list');
        renderAthletes();
    };

    const renderAthletes = () => {
        elements.athleteGrid.innerHTML = '';
        // Imposta stile griglia in base alla vista
        elements.athleteGrid.style.display = '';
        if (squadView === 'list') {
            elements.athleteGrid.className = 'list-group mb-3';
        } else {
            elements.athleteGrid.className = 'row';
        }
        const today = new Date(); today.setHours(0,0,0,0);
        const threeMonths = new Date(today); threeMonths.setMonth(today.getMonth() + 3);
        const filterName   = (document.getElementById('squad-filter-name')?.value || '').trim().toLowerCase();
        const filterRole   = (document.getElementById('squad-filter-role')?.value || '').toLowerCase();
        const filterNumber = (document.getElementById('squad-filter-number')?.value || '').trim();
        const filteredAthletes = athletes.filter(a => {
            if (showArchived ? !a.archived : a.archived) return false;
            if (filterName   && !(a.name || '').toLowerCase().includes(filterName)) return false;
            if (filterRole   && (a.role || '').toLowerCase() !== filterRole) return false;
            if (filterNumber && String(a.number) !== filterNumber) return false;
            return true;
        });
        const sortBy = document.getElementById('squad-sort')?.value || 'none';
        filteredAthletes.sort((a, b) => {
            // Ospiti sempre in fondo
            if (!!a.isGuest !== !!b.isGuest) return a.isGuest ? 1 : -1;
            if (sortBy === 'name')   return (a.name || '').localeCompare(b.name || '', 'it');
            if (sortBy === 'number') return (parseInt(a.number) || 999) - (parseInt(b.number) || 999);
            if (sortBy === 'role')   return (a.role || '').localeCompare(b.role || '', 'it');
            return 0;
        });
        filteredAthletes.forEach(athlete => {
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
            const isDirigente = athlete.isStaff && athlete.role && athlete.role.toLowerCase().includes('dirigente');
            const cardClass = athlete.isStaff
                ? (isDirigente ? 'athlete-card staff-athlete dirigente-card' : 'athlete-card staff-athlete allenatore-card')
                : (athlete.isGuest ? 'athlete-card guest-athlete' : 'athlete-card');
            const vcIcon = athlete.isViceCaptain ? '<i class="bi bi-star-half text-warning is-vice-captain"></i>' : '';
            const indStatus = getIndividualStatus(athlete);
            const indBadge = indStatus ? `<div style="display:inline-flex;align-items:center;gap:4px;font-size:0.68rem;padding:2px 8px;border-radius:100px;background:${indStatus.color}22;color:${indStatus.color};border:1px solid ${indStatus.color};margin-top:4px;max-width:50%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${indStatus.text}">🏋️ ${indStatus.used}/${indStatus.total}${indStatus.status==='orange'?' ⏳':indStatus.status==='red'?' ✗':''}</div>` : '';
            const indBorder = indStatus ? `border-left: 4px solid ${indStatus.color} !important;` : '';
            if (squadView === 'list') {
                // ── Vista Lista ──────────────────────────────────────────
                card.className = 'list-group-item list-group-item-action p-0 mb-1';
                card.style.background = athlete.isStaff ? (isDirigente ? '#14532d' : '#1e293b') : '#0f172a';
                card.style.border = '1px solid rgba(96,165,250,0.15)';
                card.style.borderRadius = '8px';
                card.innerHTML = `
                <div style="display:flex;align-items:center;padding:8px 12px;gap:10px;">
                    <!-- Puntino alert — usa lo stesso statusIcon calcolato sopra -->
                    <div style="width:12px;height:12px;border-radius:50%;flex-shrink:0;background:${
                        statusIcon.includes('text-danger') ? '#d90429' :
                        statusIcon.includes('text-purple') ? '#a855f7' :
                        statusIcon.includes('text-warning') ? '#f59e0b' :
                        statusIcon.includes('text-success') ? '#16a34a' :
                        '#64748b'
                    };" title="${
                        statusIcon.includes('text-danger') ? 'Visita scaduta' :
                        statusIcon.includes('text-purple') ? 'Visita prenotata' :
                        statusIcon.includes('text-warning') ? 'Visita in scadenza' :
                        statusIcon.includes('text-success') ? 'Visita ok' :
                        'Nessuna scadenza'
                    }"></div>
                    <!-- Numero maglia -->
                    <div style="width:28px;text-align:center;font-size:0.85rem;font-weight:700;color:#60a5fa;flex-shrink:0;">${athlete.number || '—'}</div>
                    <!-- Nome + ruolo -->
                    <div style="flex:1;min-width:0;" class="athlete-card-clickable" data-athlete-id="${athlete.id}">
                        <div style="font-weight:600;color:var(--text-primary);font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${athlete.name}
                            ${athlete.isCaptain ? '<i class="bi bi-star-fill" style="color:#f59e0b;font-size:0.75rem;margin-left:4px;"></i>' : ''}
                            ${athlete.isViceCaptain ? '<i class="bi bi-star-half" style="color:#f59e0b;font-size:0.75rem;margin-left:2px;"></i>' : ''}
                            ${athlete.isStaff ? '<span style="font-size:0.7rem;background:#f59e0b;color:#000;border-radius:3px;padding:1px 5px;margin-left:4px;">Staff</span>' : ''}
                        </div>
                        <div style="font-size:0.75rem;color:#94a3b8;">${athlete.role || ''}</div>
                        ${athlete.uscitaAutonoma ? '<div style="font-size:0.65rem;background:#fed7aa;color:#92400e;border-radius:3px;padding:1px 5px;margin-top:2px;display:inline-block;">🚶 uscita autonoma ✅</div>' : ''}
                        ${athlete.infortunato ? `<div style="font-size:0.65rem;background:#fee2e2;color:#991b1b;border-radius:3px;padding:1px 5px;margin-top:2px;display:inline-block;">🤕 Infortunato${athlete.dataRientro ? ' • ' + new Date(athlete.dataRientro + 'T00:00:00').toLocaleDateString('it-IT', {day:'2-digit',month:'2-digit'}) : ''}</div>` : ''}
                    </div>
                    <!-- Pulsanti azione -->
                    <div class="card-actions no-print" style="display:flex;gap:4px;flex-shrink:0;">
                        <button class="btn btn-sm btn-outline-light rating-btn" title="Pagelle" data-athlete-id="${athlete.id}"><i class="bi bi-clipboard-check"></i></button>
                        <button class="btn btn-sm btn-outline-light gps-btn" title="Dati Performance" data-athlete-id="${athlete.id}"><i class="bi bi-person-fill-gear"></i></button>
                        <button class="btn btn-sm btn-outline-light parent-btn" title="Anagrafica Genitori" data-athlete-id="${athlete.id}"><i class="bi bi-people-fill"></i></button>
                        <button class="btn btn-sm btn-outline-light individual-btn" title="Pacchetto Individual" data-athlete-id="${athlete.id}" style="${athlete.individualPackage?.type ? 'color:#f59e0b;border-color:#f59e0b;' : ''}"><i class="bi bi-person-fill-up"></i></button>
                        ${athlete.certLink ? `<button class="btn btn-sm btn-outline-light cert-btn" title="Apri Certificato Medico" onclick="window.open('${athlete.certLink}','_blank')"><i class="bi bi-file-earmark-medical-fill" style="color:#16a34a;"></i></button>` : ''}
                        <button class="btn btn-sm btn-outline-light edit-btn" title="Modifica" data-athlete-id="${athlete.id}"><i class="bi bi-pencil-fill"></i></button>
                        ${athlete.archived
                            ? `<button class="btn btn-sm btn-outline-success restore-btn" title="Ripristina in rosa" data-athlete-id="${athlete.id}"><i class="bi bi-arrow-counterclockwise"></i></button>`
                            : `<button class="btn btn-sm btn-outline-warning archive-btn" title="Archivia" data-athlete-id="${athlete.id}"><i class="bi bi-archive-fill"></i></button>`}
                        <button class="btn btn-sm btn-outline-light delete-btn" title="Elimina definitivamente" data-athlete-id="${athlete.id}"><i class="bi bi-trash-fill"></i></button>
                        ${sessionStorage.getItem('gosport_user_role') === 'admin' ? `<button class="btn btn-sm btn-outline-info copy-annata-btn" title="Copia in altra annata" data-athlete-id="${athlete.id}"><i class="bi bi-clipboard-plus"></i></button>` : ''}
                    </div>
                </div>`;
            } else {
                // ── Vista Box (originale) ────────────────────────────────
                const isLight = document.documentElement.classList.contains('theme-light');
                const cardBg = athlete.isStaff
                    ? (isDirigente
                        ? (isLight ? 'background:#bbf7d0;border-left:4px solid #166534;' : 'background:#14532d;border-left:4px solid #166534;')
                        : (isLight ? 'background:#dcfce7;border-left:4px solid #16a34a;' : 'background:#1e293b;border-left:4px solid #16a34a;'))
                    : '';
                const uscitaBadge = athlete.uscitaAutonoma ? '<span style="font-size:0.62rem;background:#fed7aa;color:#92400e;border-radius:3px;padding:1px 5px;margin-left:4px;vertical-align:middle;">🚶✅</span>' : '';
                const infortunatoBadge = athlete.infortunato ? `<span style="font-size:0.62rem;background:#fee2e2;color:#991b1b;border-radius:3px;padding:1px 5px;margin-left:4px;vertical-align:middle;">🤕${athlete.dataRientro ? ' ' + new Date(athlete.dataRientro + 'T00:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'}) : ''}</span>` : '';
                card.innerHTML = `<div class="card ${cardClass}" style="${indBorder}${cardBg}"><div class="card-body athlete-card-clickable" data-athlete-id="${athlete.id}">${athlete.avatar ? `<img src="${escapeHtml(athlete.avatar)}" onerror="window.avatarFallback(this, ${JSON.stringify(athlete.name || '').replace(/"/g, '&quot;')})" alt="${escapeHtml(athlete.name)}" class="athlete-avatar me-3">` : initialsAvatarHtml(athlete.name)}<div><h5 class="card-title">${escapeHtml(athlete.name)} ${athlete.isCaptain ? '<i class="bi bi-star-fill is-captain"></i>' : ''} ${vcIcon}${uscitaBadge}${infortunatoBadge}</h5><p class="card-text text-muted">${escapeHtml(athlete.role)}</p>${indBadge}</div><div class="shirt-number">${athlete.number}</div>${statusIcon}</div><div class="card-actions no-print"><button class="btn btn-sm btn-outline-light rating-btn" title="Pagelle" data-athlete-id="${athlete.id}"><i class="bi bi-clipboard-check"></i></button><button class="btn btn-sm btn-outline-light gps-btn" title="Dati Performance" data-athlete-id="${athlete.id}"><i class="bi bi-person-fill-gear"></i></button><button class="btn btn-sm btn-outline-light individual-btn" title="Pacchetto Individual" data-athlete-id="${athlete.id}" style="${athlete.individualPackage?.type ? 'color:#f59e0b;border-color:#f59e0b;' : ''}"><i class="bi bi-person-fill-up"></i></button><div class="card-more-wrap"><button class="btn btn-sm btn-outline-light card-more-btn" title="Altre azioni" aria-label="Altre azioni"><i class="bi bi-three-dots"></i></button><div class="card-more-menu"><button class="btn btn-sm btn-outline-light parent-btn" data-athlete-id="${athlete.id}"><i class="bi bi-people-fill"></i> Genitori</button><button class="btn btn-sm btn-outline-light infortuni-btn" data-athlete-id="${athlete.id}"><i class="bi bi-bandaid-fill"></i> Infortuni</button>${athlete.certLink ? `<button class="btn btn-sm btn-outline-light cert-btn" onclick="window.open('${escapeHtml(athlete.certLink)}','_blank')"><i class="bi bi-file-earmark-medical-fill" style="color:#16a34a;"></i> Certificato</button>` : ""}<button class="btn btn-sm btn-outline-light edit-btn" data-athlete-id="${athlete.id}"><i class="bi bi-pencil-fill"></i> Modifica</button>${athlete.archived ? `<button class="btn btn-sm btn-outline-success restore-btn" data-athlete-id="${athlete.id}"><i class="bi bi-arrow-counterclockwise"></i> Ripristina</button>` : `<button class="btn btn-sm btn-outline-warning archive-btn" data-athlete-id="${athlete.id}"><i class="bi bi-archive-fill"></i> Archivia</button>`}<button class="btn btn-sm btn-outline-danger delete-btn" data-athlete-id="${athlete.id}"><i class="bi bi-trash-fill"></i> Elimina</button>${sessionStorage.getItem('gosport_user_role') === 'admin' ? `<button class="btn btn-sm btn-outline-info copy-annata-btn" data-athlete-id="${athlete.id}"><i class="bi bi-clipboard-plus"></i> Copia in annata</button>` : ''}</div></div></div></div>`;
            }
            elements.athleteGrid.appendChild(card);
            // FIX v1.5.21: applica colore background dopo appendChild (override Bootstrap vars)
            if (athlete.isStaff) {
                const isLight = document.documentElement.classList.contains('theme-light');
                const innerCard = card.querySelector('.card');
                if (innerCard) {
                    if (isDirigente) {
                        innerCard.style.setProperty('background', isLight ? '#d1fae5' : '#14532d', 'important');
                        innerCard.style.setProperty('border-left', '4px solid #166534', 'important');
                    } else {
                        innerCard.style.setProperty('background', isLight ? '#dbeafe' : '#1e293b', 'important');
                        innerCard.style.setProperty('border-left', '4px solid #16a34a', 'important');
                    }
                    // In tema chiaro forza testo scuro su tutti gli elementi della card
                    if (isLight) {
                        innerCard.querySelectorAll('h5, p, .card-title, .card-text, .text-muted, .shirt-number').forEach(function(el) {
                            el.style.setProperty('color', '#1a202c', 'important');
                        });
                        innerCard.querySelectorAll('.btn-outline-light').forEach(function(btn) {
                            btn.style.setProperty('color', '#374151', 'important');
                            btn.style.setProperty('border-color', '#374151', 'important');
                        });
                    }
                }
            }
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
                    if (session.isIndividual && session.coachColor) {
                        sessionEl.className = 'calendar-session';
                        sessionEl.style.cssText = `background:${session.coachColor};color:var(--text-white);border-left:3px solid ${session.coachColor}dd;`;
                    } else {
                        // Colore per TIPO evento: la classe .session-tipo-<Tipo> esiste in
                        // style.css per i tipi noti; "Allenamento" (e tipi sconosciuti)
                        // ricadono sul verde di .session-allenamento.
                        const tipo = (session.type || session.title || '').split(' ')[0];
                        const tipiNoti = ['Partita','Torneo','Campionato','Finale','Semifinale','Individual','Visita','Evento','Varie','Portieri','Atletica'];
                        sessionEl.className = 'calendar-session ' + (tipiNoti.includes(tipo) ? 'session-tipo-' + tipo : 'session-allenamento');
                    }
                    const timeLabel = session.time ? ' (' + session.time + ')' : '';
                    sessionEl.textContent = session.title + timeLabel;
                    // FIX v1.5.21: mostra nota breve sotto il titolo se presente
                    if (session.note) {
                        const noteEl = document.createElement('div');
                        noteEl.style.cssText = 'font-size:0.7rem;opacity:0.85;margin-top:1px;font-style:italic;';
                        noteEl.textContent = session.note;
                        sessionEl.appendChild(noteEl);
                    }
                    sessionEl.dataset.sessionId = session.id;
                    sessionEl.dataset.date = dateString;
                    dayCell.appendChild(sessionEl);
                });
            }
            if (matchResults) {
                Object.values(matchResults).forEach(match => {
                    const matchDateNormalized = toLocalDateISO(match.date);
                    if (matchDateNormalized === dateString) {
                        const myTeamName = getMyTeamName();
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
        elements.sessionForm.reset(); if(sessionData) { document.getElementById('sessionModalLabel').textContent = "Modifica Sessione"; document.getElementById('session-id').value = sessionData.id; document.getElementById('session-date').value = sessionData.date; document.getElementById('session-title').value = sessionData.title; document.getElementById('session-type').value = sessionData.type || ''; document.getElementById('session-time').value = sessionData.time; document.getElementById('session-location').value = sessionData.location; document.getElementById('session-goals').value = sessionData.goals; document.getElementById('session-description').value = sessionData.description; document.getElementById('session-note').value = sessionData.note || ''; elements.deleteSessionBtn.style.display = 'block'; } else { document.getElementById('sessionModalLabel').textContent = "Pianifica Sessione"; document.getElementById('session-id').value = ''; document.getElementById('session-date').valueAsDate = new Date(); elements.deleteSessionBtn.style.display = 'none'; } sessionModal.show();
    };
    // Fascia di date Da–A condivisa da lista partite, grafico andamento, marcatori/assist e cartellini
    const getMatchDateRangeFilter = () => {
        const start = document.getElementById('risultati-filter-start')?.value || '';
        const end = document.getElementById('risultati-filter-end')?.value || '';
        return { start, end };
    };
    const isMatchInDateRange = (match, range) => {
        if (!range.start && !range.end) return true;
        const d = toLocalDateISO(match.date);
        if (range.start && d < range.start) return false;
        if (range.end && d > range.end) return false;
        return true;
    };
    const renderMatchResults = () => {
        elements.matchResultsContainer.innerHTML = '';
        const allMatches = Object.values(matchResults).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (allMatches.length === 0) {
            elements.matchResultsContainer.innerHTML = '<p class="text-muted">Nessun risultato inserito.</p>';
            return;
        }
        const filterOpponent = (document.getElementById('risultati-filter-opponent')?.value || '').trim().toLowerCase();
        const filterLocation = document.getElementById('risultati-filter-location')?.value || '';
        const filterResult   = document.getElementById('risultati-filter-result')?.value || '';
        const dateRange = getMatchDateRangeFilter();
        const sortedMatches = allMatches.filter(match => {
            if (!isMatchInDateRange(match, dateRange)) return false;
            if (filterOpponent && !(match.opponentName || '').toLowerCase().includes(filterOpponent)) return false;
            if (filterLocation && match.location !== filterLocation) return false;
            if (filterResult) {
                const myScore  = match.location === 'home' ? match.homeScore : match.awayScore;
                const oppScore = match.location === 'home' ? match.awayScore : match.homeScore;
                const hasScore = myScore !== null && myScore !== undefined && myScore !== '' &&
                                 oppScore !== null && oppScore !== undefined && oppScore !== '';
                if (!hasScore) return false;
                const my = Number(myScore), opp = Number(oppScore);
                if (filterResult === 'win'  && !(my > opp))  return false;
                if (filterResult === 'draw' && !(my === opp)) return false;
                if (filterResult === 'loss' && !(my < opp))  return false;
            }
            return true;
        });
        if (sortedMatches.length === 0) {
            elements.matchResultsContainer.innerHTML = '<p class="text-muted">Nessuna partita trovata con i filtri selezionati.</p>';
            return;
        }
        sortedMatches.forEach(match => {
            const myTeamName = getMyTeamName();
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
        // v1.5.13: aggregazione per atleta - somma TOTALE cartellini fino a reset annata
        // Raccoglie tutti i cartellini con id univoco (per matching con visuallyDeletedCards)
        const dateRange = getMatchDateRangeFilter();
        const allCards = Object.values(matchResults)
            .filter(match => isMatchInDateRange(match, dateRange))
            .flatMap((match) =>
                match.cards.map((card, cardIndex) => ({
                    ...card,
                    date: match.date,
                    uniqueId: `${match.id}-${cardIndex}`
                }))
            );
        // Raggruppa per atleta, escludendo i cartellini "cancellati visivamente"
        const byAthlete = {};
        allCards.forEach(card => {
            if (visuallyDeletedCards.includes(card.uniqueId)) return;
            const aid = String(card.athleteId);
            if (!byAthlete[aid]) {
                byAthlete[aid] = { yellow: 0, red: 0, lastDate: card.date, athleteId: aid };
            }
            if (card.type === 'yellow') byAthlete[aid].yellow++;
            else if (card.type === 'red') byAthlete[aid].red++;
            // Tieni la data piu' recente
            if (new Date(card.date) > new Date(byAthlete[aid].lastDate)) {
                byAthlete[aid].lastDate = card.date;
            }
        });
        // Ordina per: rossi DESC, poi gialli DESC, poi data piu' recente DESC
        const aggregati = Object.values(byAthlete).sort((a, b) => {
            if (b.red !== a.red) return b.red - a.red;
            if (b.yellow !== a.yellow) return b.yellow - a.yellow;
            return new Date(b.lastDate) - new Date(a.lastDate);
        });
        let renderedRows = 0;
        aggregati.forEach(agg => {
            const athlete = athletes.find(a => String(a.id) === agg.athleteId);
            const row = document.createElement('tr');
            row.innerHTML = `<td>${athlete ? escapeHtml(athlete.name) : 'N/D'}</td>`
                + `<td><strong>${agg.yellow}</strong></td>`
                + `<td><strong>${agg.red}</strong></td>`
                + `<td>${new Date(agg.lastDate).toLocaleDateString('it-IT', {day: '2-digit', month: 'short'})}</td>`
                + `<td class="no-print"><button class="btn btn-sm btn-outline-danger py-0 px-1 remove-card-summary-row-btn" `
                +   `data-athlete-id="${agg.athleteId}" title="Cancella tutti i cartellini di ${athlete ? athlete.name : 'questo atleta'}">`
                +   `<i class="bi bi-x-lg"></i></button></td>`;
            elements.cardsSummaryTbody.appendChild(row);
            renderedRows++;
        });
        if (renderedRows === 0) {
            elements.cardsSummaryTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nessun cartellino da mostrare.</td></tr>';
        }
    };
    const renderTopScorers = () => {
        const goalCounts = {};
        const _dateRangeScorers = getMatchDateRangeFilter();
        Object.values(matchResults).filter(match => isMatchInDateRange(match, _dateRangeScorers)).forEach(match => {
            match.scorers.forEach(scorer => {
                goalCounts[scorer.athleteId] = (goalCounts[scorer.athleteId] || 0) + 1;
            });
        });
        const sortedScorers = Object.entries(goalCounts).map(([athleteId, goals]) => {
            const athlete = athletes.find(a => String(a.id) === athleteId);
            return { name: athlete ? athlete.name : 'Sconosciuto', goals };
        }).sort((a, b) => b.goals - a.goals);
        const emptyMsg = '<p class="text-muted">Nessun marcatore registrato.</p>';
        const homeEl = document.getElementById('home-top-scorers-container');
        if (sortedScorers.length === 0) {
            elements.topScorersContainer.innerHTML = emptyMsg;
            if (homeEl) homeEl.innerHTML = emptyMsg;
            return;
        }
        let ol = '<ol class="list-group list-group-numbered">';
        sortedScorers.forEach(scorer => {
            ol += `<li class="list-group-item d-flex justify-content-between align-items-center" style="background: transparent; border-color: var(--border-color);">${scorer.name}<span class="badge bg-danger rounded-pill" style="color:#ffffff !important;">${scorer.goals}</span></li>`;
        });
        ol += '</ol>';
        elements.topScorersContainer.innerHTML = ol;
        if (homeEl) {
            let olHome = '<ol class="list-group list-group-numbered">';
            sortedScorers.slice(0, 5).forEach(scorer => {
                olHome += `<li class="list-group-item d-flex justify-content-between align-items-center" style="background: transparent; border-color: var(--border-color);">${scorer.name}<span class="badge bg-danger rounded-pill" style="color:#ffffff !important;">${scorer.goals}</span></li>`;
            });
            olHome += '</ol>';
            homeEl.innerHTML = olHome;
        }
    };
    const renderTopAssists = () => {
        const assistCounts = {};
        const _dateRangeAssists = getMatchDateRangeFilter();
        Object.values(matchResults).filter(match => isMatchInDateRange(match, _dateRangeAssists)).forEach(match => {
            match.assists.forEach(assist => {
                assistCounts[assist.athleteId] = (assistCounts[assist.athleteId] || 0) + 1;
            });
        });
        const sortedAssists = Object.entries(assistCounts).map(([athleteId, assists]) => {
            const athlete = athletes.find(a => String(a.id) === athleteId);
            return { name: athlete ? athlete.name : 'Sconosciuto', assists };
        }).sort((a, b) => b.assists - a.assists);
        const emptyMsg = '<p class="text-muted">Nessun assist registrato.</p>';
        const homeEl = document.getElementById('home-top-assists-container');
        if (sortedAssists.length === 0) {
            elements.topAssistsContainer.innerHTML = emptyMsg;
            if (homeEl) homeEl.innerHTML = emptyMsg;
            return;
        }
        let ol = '<ol class="list-group list-group-numbered">';
        sortedAssists.forEach(assist => {
            ol += `<li class="list-group-item d-flex justify-content-between align-items-center" style="background: transparent; border-color: var(--border-color);">${assist.name}<span class="badge bg-primary rounded-pill" style="color:#ffffff !important;">${assist.assists}</span></li>`;
        });
        ol += '</ol>';
        elements.topAssistsContainer.innerHTML = ol;
        if (homeEl) {
            let olHome = '<ol class="list-group list-group-numbered">';
            sortedAssists.slice(0, 5).forEach(assist => {
                olHome += `<li class="list-group-item d-flex justify-content-between align-items-center" style="background: transparent; border-color: var(--border-color);">${assist.name}<span class="badge bg-primary rounded-pill" style="color:#ffffff !important;">${assist.assists}</span></li>`;
            });
            olHome += '</ol>';
            homeEl.innerHTML = olHome;
        }
    };
    const updateMatchAnalysisChart = () => {
        if (!document.getElementById('matchResultsChart')) return;
        const opponentFilter = elements.matchOpponentFilter ? elements.matchOpponentFilter.value : 'all';
        const period = elements.matchPeriodToggle.querySelector('.active').dataset.period;
        
        // Filtro solo le partite con risultato effettivo (esclude partite future senza risultato)
        const _dateRangeChart = getMatchDateRangeFilter();
        let filteredMatches = Object.values(matchResults)
            .filter(m => isMatchInDateRange(m, _dateRangeChart))
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
                { label: 'Vittorie', data: [], backgroundColor: '#16a34a' },
                { label: 'Pareggi', data: [], backgroundColor: _chartParityColor() },
                { label: 'Sconfitte', data: [], backgroundColor: '#dc2626' },
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
                { label: 'Vittorie', data: labels.map(l => resultsByPeriod[l].W), backgroundColor: '#16a34a' },
                { label: 'Pareggi', data: labels.map(l => resultsByPeriod[l].D), backgroundColor: _chartParityColor() },
                { label: 'Sconfitte', data: labels.map(l => resultsByPeriod[l].L), backgroundColor: '#dc2626' },
            ];
        }
        const data = { labels, datasets };
        if (chartInstances.matchResults) chartInstances.matchResults.destroy();
        const _matchResultsCanvas = document.getElementById('matchResultsChart');
        if (!_matchResultsCanvas) return;
        chartInstances.matchResults = new Chart(_matchResultsCanvas.getContext('2d'), {
            type: 'bar',
            data: data,
            options: {
                scales: {
                    x: { stacked: true, ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } },
                    y: { stacked: true, ticks: { color: _chartTickColor(), stepSize: 1 }, grid: { color: _chartGridColor() } }
                },
                plugins: { legend: { labels: { color: _chartTickColor() } } }
            }
        });
        const opponents = [...new Set(Object.values(matchResults).map(m => m.opponentName))];
        elements.matchOpponentFilter.innerHTML = `<option value="all">Tutti gli avversari</option>`;
        opponents.sort().forEach(opp => {
            const selected = opp === opponentFilter ? 'selected' : '';
            elements.matchOpponentFilter.innerHTML += `<option value="${escapeHtml(opp)}" ${selected}>${escapeHtml(opp)}</option>`;
        });
    };
    // Ri-espone chartInstances su window dopo ogni update (per applyChartTheme)
    const _syncChartInstances = () => { window.chartInstances = chartInstances; };
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
        const _dailyTeamCanvas = document.getElementById('dailyTeamChart');
        if (!_dailyTeamCanvas) return;
        chartInstances.dailyTeam = new Chart(_dailyTeamCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: last7Days.map(d => new Date(d).toLocaleDateString('it-IT', {day:'2-digit', month:'short'})),
                datasets: [{
                    label: 'Punteggio Medio',
                    data: teamDailyAvgScores,
                    borderColor: 'rgba(22, 163, 74, 1)',
                    backgroundColor: 'rgba(22, 163, 74, 0.2)',
                    tension: 0.3
                }]
            },
            options: {
                scales: {
                    y: { ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } },
                    x: { ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } }
                },
                plugins: { legend: { labels: { color: _chartTickColor() } } }
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
        const _monthlyCanvas = document.getElementById('monthlyComparisonChart');
        if (!_monthlyCanvas) return;
        chartInstances.monthlyComparison = new Chart(_monthlyCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: scoresToShow.map(a=>a.name),
                datasets: [{
                    label: 'Punteggio Totale',
                    data: scoresToShow.map(a=>a.score),
                    backgroundColor: 'rgba(22, 163, 74, 0.8)'
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    y: { ticks: { color: _chartTickColor(), font: { size: 9 }, autoSkip: false }, grid: { color: _chartGridColor() } },
                    x: { ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } }
                },
                plugins: { legend: { labels: { color: _chartTickColor() } } }
            }
        });
        _syncChartInstances();
    };
    window.updateEvaluationCharts = updateEvaluationCharts;
    const updateAttendanceChart = () => {
        // Usa il picker della sezione presenze se disponibile, altrimenti quello principale
        const presenzePicker = document.getElementById('presenze-date-picker');
        const date = (presenzePicker && presenzePicker.value)
                     ? presenzePicker.value
                     : elements.evaluationDatePicker.value;
        // Fascia personalizzata Da–A: usa i due picker dedicati, la data singola non serve
        const rangeStartEl = document.getElementById('attendance-range-start');
        const rangeEndEl = document.getElementById('attendance-range-end');
        const customRange = attendanceChartPeriod === 'custom';
        if (customRange) {
            if (!rangeStartEl || !rangeEndEl || !rangeStartEl.value || !rangeEndEl.value) return;
        } else if (!date) return;
        
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
        } else if (customRange) {
            const rs = rangeStartEl.value, re = rangeEndEl.value;
            Object.keys(evaluations).filter(d => d >= rs && d <= re).forEach(d => {
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

        // Calcola totalDays: giorni del periodo con almeno 1 presenza valida
        let _pctDates = [];
        if (attendanceChartPeriod === 'daily') {
            _pctDates = evaluations[date] ? [date] : [];
        } else if (attendanceChartPeriod === 'monthly') {
            const _m = date.substring(0, 7);
            _pctDates = Object.keys(evaluations).filter(d => d.startsWith(_m));
        } else if (attendanceChartPeriod === 'semester') {
            const _sy = date.substring(0, 4), _smo = parseInt(date.substring(5, 7), 10);
            const _s0 = `${_sy}-${_smo <= 6 ? '01' : '07'}-01`, _s1 = `${_sy}-12-31`;
            _pctDates = Object.keys(evaluations).filter(d => d >= _s0 && d <= _s1);
        } else if (attendanceChartPeriod === 'annual') {
            const _ay = date.substring(0, 4);
            _pctDates = Object.keys(evaluations).filter(d => d.startsWith(_ay));
        } else if (customRange) {
            const _rs = rangeStartEl.value, _re = rangeEndEl.value;
            _pctDates = Object.keys(evaluations).filter(d => d >= _rs && d <= _re);
        } else {
            const _w = getWeekRange(date);
            _pctDates = Object.keys(evaluations).filter(d => d >= _w.start && d <= _w.end);
        }
        const totalDays = _pctDates.filter(d =>
            Object.values(evaluations[d] || {}).some(ev => parseInt(ev['presenza-allenamento'], 10) > 0)
        ).length;

        const labels = combinedData.map(d => d.name);
        const presenzeData = combinedData.map(d => d.presenze);
        const assenzeGiustificateData = combinedData.map(d => d.assenzeGiustificate);
        
        if(chartInstances.attendance) chartInstances.attendance.destroy();
        const attendanceCanvas = document.getElementById('attendanceChart');
        if (!attendanceCanvas) return;
        const attWrapper = document.getElementById('attendance-chart-wrapper') || attendanceCanvas.parentElement;
        const isMobile = window.innerWidth < 768;
        // Larghezza disponibile reale del contenitore (clientWidth = senza scrollbar).
        const availW = attWrapper ? (attWrapper.clientWidth || attWrapper.offsetWidth) : 0;
        // Su desktop: riempi SEMPRE tutta la larghezza disponibile (niente spazio
        // bianco a destra). Su mobile: scroll orizzontale se gli atleti sono molti.
        const attW = isMobile
            ? Math.max(labels.length * 45, window.innerWidth - 40)
            : Math.max(availW || 600, labels.length * 48, 400);
        const attH = 340;
        attendanceCanvas.width = attW;
        attendanceCanvas.height = attH;
        attendanceCanvas.style.width = attW + 'px';
        attendanceCanvas.style.height = attH + 'px';
        if (attWrapper) { attWrapper.style.width = attW + 'px'; attWrapper.style.minWidth = attW + 'px'; attWrapper.style.height = attH + 'px'; }
        chartInstances.attendance = new Chart(attendanceCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Presenze',
                        data: presenzeData,
                        backgroundColor: 'rgba(22, 163, 74, 0.85)'
                    },
                    {
                        label: 'Assenze Giustificate',
                        data: assenzeGiustificateData,
                        backgroundColor: 'rgba(217, 119, 6, 0.85)'
                    }
                ]
            },
            plugins: [{
                afterDraw: function(chart) {
                    var ctx = chart.ctx;
                    var meta0 = chart.getDatasetMeta(0);
                    var meta1 = chart.getDatasetMeta(1);
                    combinedData.forEach(function(item, i) {
                        var bar0 = meta0.data[i];
                        if (!bar0) return;
                        var bar1 = meta1 && meta1.data[i];
                        var pct = totalDays > 0 ? Math.round(item.presenze / totalDays * 100) : 0;
                        var topY = (bar1 && (assenzeGiustificateData[i] || 0) > 0) ? bar1.y : bar0.y;
                        var totalH = bar0.base - topY;
                        ctx.save();
                        ctx.font = 'bold 11px Arial, sans-serif';
                        ctx.textAlign = 'center';
                        if (totalH >= 20) {
                            ctx.fillStyle = 'rgba(255,255,255,0.95)';
                            ctx.textBaseline = 'top';
                            ctx.fillText(pct + '%', bar0.x, topY + 4);
                        } else if (totalH > 0) {
                            ctx.fillStyle = '#94a3b8';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(pct + '%', bar0.x, topY - 2);
                        }
                        ctx.restore();
                    });
                }
            }],
            options: {
                maintainAspectRatio: false,
                responsive: false,
                scales: {
                    y: { 
                        stacked: true,
                        ticks: { color: _chartTickColor() }, 
                        grid: { color: _chartGridColor() } 
                    },
                    x: {
                        stacked: true,
                        ticks: { color: _chartTickColor(), minRotation: 90, maxRotation: 90, autoSkip: false },
                        grid: { color: _chartGridColor() }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: _chartTickColor() }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const item = combinedData[ctx.dataIndex];
                                if (!item) return '';
                                if (ctx.dataset.label === 'Presenze') {
                                    const pct = totalDays > 0 ? Math.round(item.presenze / totalDays * 100) : 0;
                                    return ` Presenze: ${item.presenze}/${totalDays} (${pct}%)`;
                                }
                                return ` ${ctx.dataset.label}: ${ctx.parsed.y}`;
                            }
                        }
                    }
                }
            }
        });
    };
    window.updateAttendanceChart = updateAttendanceChart;
    const updateWeeklyAttendanceChart = () => {
        const athlete1Id = elements.weeklyAthlete1Selector.value;
        const athlete2Id = elements.weeklyAthlete2Selector.value;
        
        if (!athlete1Id) return;
        
        let startDate, endDate;
        
        // Gestione periodo personalizzato vs predefinito
        if (weeklyAttendancePeriod === 'custom') {
            if (!elements.weeklyStartDatePicker || !elements.weeklyStartDatePicker.value || !elements.weeklyDatePicker.value) {
                return; // Attende che l'utente selezioni entrambe le date
            }
            startDate = new Date(elements.weeklyStartDatePicker.value + 'T00:00:00');
            endDate = new Date(elements.weeklyDatePicker.value + 'T23:59:59');
        } else {
            // Usa la data finale selezionata o oggi
            endDate = elements.weeklyDatePicker.value ? new Date(elements.weeklyDatePicker.value + 'T23:59:59') : new Date();
            startDate = new Date(endDate);
            
            // Calcola la data di inizio in base al periodo
            if (weeklyAttendancePeriod === 'month') {
                startDate.setMonth(endDate.getMonth() - 1);
            } else if (weeklyAttendancePeriod === 'trimester') {
                startDate.setMonth(endDate.getMonth() - 3);
            } else if (weeklyAttendancePeriod === 'semester') {
                startDate.setMonth(endDate.getMonth() - 6);
            } else { // year
                startDate.setFullYear(endDate.getFullYear() - 1);
            }
            
            // Aggiorna il campo data di inizio se esiste
            if (elements.weeklyStartDatePicker) {
                elements.weeklyStartDatePicker.value = startDate.toISOString().split('T')[0];
            }
        }
        
        // Funzione per ottenere l'inizio della settimana (lunedì) senza modificare l'oggetto originale
        const getWeekStart = (date) => {
            const d = new Date(date.getTime()); // Crea una copia
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            d.setDate(diff);
            d.setHours(0, 0, 0, 0);
            return d;
        };
        
        // Genera tutte le settimane nel periodo
        const weeks = [];
        let currentWeek = getWeekStart(startDate);
        const endWeek = getWeekStart(endDate);
        
        while (currentWeek <= endWeek) {
            weeks.push(new Date(currentWeek.getTime())); // Copia
            currentWeek.setDate(currentWeek.getDate() + 7);
        }
        
        // Funzione per contare le presenze in una settimana per un atleta
        const countWeeklyPresences = (athleteId, weekStart) => {
            let count = 0;
            const weekEnd = new Date(weekStart.getTime());
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            
            // Normalizza le date per confronto (solo anno-mese-giorno)
            const weekStartStr = weekStart.toISOString().split('T')[0];
            const weekEndStr = weekEnd.toISOString().split('T')[0];
            
            Object.keys(evaluations).forEach(dateStr => {
                // Confronta direttamente le stringhe YYYY-MM-DD
                if (dateStr >= weekStartStr && dateStr <= weekEndStr) {
                    const ev = evaluations[dateStr][athleteId];
                    if (ev) {
                        const presenzaValue = parseInt(ev['presenza-allenamento'], 10);
                        // Conta sia le presenze (>0) che le assenze giustificate (-1)
                        if (presenzaValue > 0 || presenzaValue === -1) {
                            count++;
                        }
                    }
                }
            });
            
            return count;
        };
        
        // Calcola i dati per l'atleta 1
        const athlete1 = athletes.find(a => String(a.id) === athlete1Id);
        const athlete1Data = weeks.map(week => countWeeklyPresences(athlete1Id, week));
        
        // Prepara i dataset
        const datasets = [{
            label: athlete1 ? athlete1.name : 'Atleta 1',
            data: athlete1Data,
            backgroundColor: 'rgba(22, 163, 74, 0.8)',
            borderColor: 'rgba(22, 163, 74, 1)',
            borderWidth: 2
        }];
        
        // Se c'è un secondo atleta, aggiungi i suoi dati
        if (athlete2Id) {
            const athlete2 = athletes.find(a => String(a.id) === athlete2Id);
            const athlete2Data = weeks.map(week => countWeeklyPresences(athlete2Id, week));
            datasets.push({
                label: athlete2 ? athlete2.name : 'Atleta 2',
                data: athlete2Data,
                backgroundColor: 'rgba(30, 80, 149, 0.8)',
                borderColor: 'rgba(30, 80, 149, 1)',
                borderWidth: 2
            });
        }
        
        // Crea le etichette delle settimane con anno
        const labels = weeks.map(week => {
            const weekEnd = new Date(week.getTime());
            weekEnd.setDate(weekEnd.getDate() + 6);
            const startYear = week.getFullYear();
            const endYear = weekEnd.getFullYear();
            
            // Se le settimane sono a cavallo dell'anno, mostra l'anno
            if (startYear !== endYear) {
                return `${week.getDate()}/${week.getMonth() + 1}/${startYear} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}/${endYear}`;
            } else {
                return `${week.getDate()}/${week.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
            }
        });
        
        if (chartInstances.weeklyAttendance) chartInstances.weeklyAttendance.destroy();
        const weeklyCanvas = document.getElementById('weeklyAttendanceChart');
        const weeklyWrapper = weeklyCanvas.parentElement;
        const isMobileW = window.innerWidth < 768;
        const weeklyW = isMobileW ? Math.max(labels.length * 50, window.innerWidth - 40) : (weeklyWrapper ? weeklyWrapper.offsetWidth : 600);
        const weeklyH = window.innerWidth < 768 ? 300 : 350;
        weeklyCanvas.width = weeklyW;
        weeklyCanvas.height = weeklyH;
        weeklyCanvas.style.width = weeklyW + 'px';
        weeklyCanvas.style.height = weeklyH + 'px';
        if (weeklyWrapper) { weeklyWrapper.style.width = weeklyW + 'px'; weeklyWrapper.style.minWidth = weeklyW + 'px'; weeklyWrapper.style.height = weeklyH + 'px'; }
        chartInstances.weeklyAttendance = new Chart(weeklyCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                maintainAspectRatio: false,
                responsive: false,
                scales: {
                    y: { 
                        beginAtZero: true,
                        max: 3,
                        ticks: { 
                            color: _chartTickColor(),
                            stepSize: 1
                        }, 
                        grid: { color: _chartGridColor() },
                        title: {
                            display: true,
                            text: 'Presenze Settimanali (max 3)',
                            color: _chartTickColor()
                        }
                    },
                    x: { 
                        ticks: { 
                            color: _chartTickColor(),
                            maxRotation: 45,
                            minRotation: 45
                        }, 
                        grid: { color: _chartGridColor() } 
                    }
                },
                plugins: { 
                    legend: { 
                        labels: { color: _chartTickColor() } 
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += value + '/3 presenze';
                                return label;
                            }
                        }
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
                if (document.documentElement.classList.contains('theme-light')) {
                    awardCard.style.background = '#ea580c';
                    awardCard.style.borderColor = '#c2410c';
                    awardCard.style.color = '#ffffff';
                }
                const dateObj = new Date(award.date);
                const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('it-IT') : 'Data non disponibile';
                awardCard.innerHTML = `<div class="card-body p-2"><img src="${escapeHtml(athlete.avatar || defaultAvatar)}" onerror="this.src='${defaultAvatar}'" alt="${escapeHtml(athlete.name)}" class="award-avatar mx-auto mb-2 rounded-circle"><h6 class="mb-1" style="font-size: 0.9rem;">${escapeHtml(athlete.name)}</h6><p class="mb-0" style="font-size: 0.8rem; color: #000;">${formattedDate}</p><small>${escapeHtml(award.reason)}</small><i class="bi bi-award-fill mt-2" style="font-size: 1.5rem;"></i></div>`;
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
        // Applica colore tema chiaro direttamente sull'elemento
        if (document.documentElement.classList.contains('theme-light')) {
            [elements.metricSelector, elements.multiAthleteMetricSelector].forEach(function(el) {
                if (el) { el.style.setProperty('background-color', '#ccd3db', 'important'); el.style.setProperty('color', '#000103', 'important'); }
            });
        }
        performanceSelections.forEach((selection, index) => {
            const selectorRow = document.createElement('div');
            selectorRow.className = 'row g-2 align-items-end mb-2';
            selectorRow.innerHTML = `<div class="col-12 col-md-6"><label class="form-label">Atleta ${index + 1}:</label><select class="form-select athlete-selector" data-index="${index}"><option value="">Seleziona atleta...</option>${athletes.map(a => `<option value="${a.id}" ${selection.athleteId == a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select></div><div class="col-10 col-md-5"><label class="form-label">Sessione:</label><select class="form-select date-selector" data-index="${index}"><option value="">Seleziona sessione...</option></select></div><div class="col-2 col-md-1 d-flex align-items-end"><button class="btn btn-outline-danger btn-sm remove-selector w-100" data-index="${index}" ${performanceSelections.length <= 2 ? 'disabled' : ''}><i class="bi bi-trash"></i></button></div>`;
            elements.performanceSelectorsContainer.appendChild(selectorRow);
            // Colore tema chiaro sui selects creati dinamicamente
            if (document.documentElement.classList.contains('theme-light')) {
                selectorRow.querySelectorAll('select').forEach(function(sel) {
                    sel.style.setProperty('background-color', '#ccd3db', 'important');
                    sel.style.setProperty('color', '#000103', 'important');
                });
            }
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
                const dateStr = session ? new Date(session.date).toLocaleDateString('it-IT') : '?';
                return `${athlete?.name || 'N/A'} (${dateStr})`;
            }),
            datasets: [{
                label: gpsFieldsForDisplay[selectedMetric] || selectedMetric,
                data: validSelections.map(selection => {
                    const session = findSessionById(selection.sessionId);
                    return session ? (session[selectedMetric] || 0) : 0;
                }),
                backgroundColor: 'rgba(22, 163, 74, 0.8)'
            }]
        };
        if (chartInstances.performance) chartInstances.performance.destroy();
        const perfCanvas = document.getElementById('performanceChart');
        const perfWrapper = document.getElementById('performance-chart-wrapper');
        const isMobilePerf = window.innerWidth < 768;
        const numCols = chartData.labels ? chartData.labels.length : 5;
        // Calcola larghezza: su mobile 80px per colonna, su desktop usa il contenitore
        const perfW = isMobilePerf ? Math.max(numCols * 80, 300) : (perfWrapper ? perfWrapper.parentElement.offsetWidth - 32 : 500);
        const perfH = window.innerWidth < 768 ? 300 : 400;
        // Imposta attributi HTML diretti sul canvas (unico modo affidabile con Chart.js)
        perfCanvas.width = perfW;
        perfCanvas.height = perfH;
        perfCanvas.style.width = perfW + 'px';
        perfCanvas.style.height = perfH + 'px';
        if (perfWrapper) {
            perfWrapper.style.width = perfW + 'px';
            perfWrapper.style.minWidth = perfW + 'px';
            perfWrapper.style.height = perfH + 'px';
        }
        chartInstances.performance = new Chart(perfCanvas.getContext('2d'), {
            type: 'bar',
            data: chartData,
            options: {
                maintainAspectRatio: false,
                responsive: false,
                scales: {
                    y: { ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } },
                    x: { ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } }
                },
                plugins: { legend: { labels: { color: _chartTickColor() } } }
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
        const athleteOptions = athletes.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
        elements.trendAthleteSelector.innerHTML = `<option value="">Seleziona atleta...</option>${athleteOptions}`;
        elements.radarAthleteSelector1.innerHTML = `<option value="">Seleziona atleta...</option>${athleteOptions}`;
        elements.radarAthleteSelector2.innerHTML = `<option value="">Nessun confronto</option>${athleteOptions}`;
        elements.weeklyAthlete1Selector.innerHTML = `<option value="">Seleziona atleta...</option>${athleteOptions}`;
        elements.weeklyAthlete2Selector.innerHTML = `<option value="">-- Nessun confronto --</option>${athleteOptions}`;
        const keysToExclude = ['tipo_sessione', 'data_di_registrazione', 'ora_registrazione'];
        const optionsHtml = Object.entries(gpsFieldsForDisplay).filter(([key]) => !keysToExclude.includes(key)).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
        elements.trendMetricSelector.innerHTML = optionsHtml;
        elements.trendMetricSelector.value = 'velocita_massima';
    };
    window.updateWeeklyAttendanceChart = updateWeeklyAttendanceChart;
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
            { label: gpsFieldsForDisplay[metric] || metric, data: athleteValues, borderColor: 'rgba(22, 163, 74, 1)', backgroundColor: 'rgba(22, 163, 74, 0.2)', tension: 0.3, fill: true },
            { label: 'Media Squadra', data: teamAvgValues, borderColor: 'rgba(54, 162, 235, 1)', borderDash: [5, 5], fill: false, tension: 0.3 },
            { label: 'Max Squadra', data: teamMaxValues, borderColor: 'rgba(255, 206, 86, 1)', borderDash: [5, 5], fill: false, tension: 0.3 }
        ];
        const trendCanvas = document.getElementById('athleteTrendChart');
        const trendWrapper = trendCanvas.parentElement;
        const isMobileT = window.innerWidth < 768;
        const trendW = isMobileT ? Math.max(window.innerWidth - 40, 300) : (trendWrapper ? trendWrapper.offsetWidth - 32 : 600);
        const trendH = window.innerWidth < 768 ? 300 : 600;
        trendCanvas.width = trendW; trendCanvas.height = trendH;
        trendCanvas.style.width = trendW + 'px'; trendCanvas.style.height = trendH + 'px';
        if (trendWrapper) { trendWrapper.style.width = trendW + 'px'; trendWrapper.style.height = trendH + 'px'; }
        chartInstances.athleteTrend = new Chart(trendCanvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                maintainAspectRatio: false,
                responsive: false,
                scales: {
                    y: { ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } },
                    x: { ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } }
                },
                plugins: {
                    legend: { labels: { color: _chartTickColor() } },
                    title: { display: true, text: `Andamento: ${athlete?.name || 'N/A'}`, color: _chartTickColor() }
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
        const radarCanvas = document.getElementById('athleteRadarChart');
        const radarWrapper = radarCanvas.parentElement;
        const isMobileR = window.innerWidth < 768;
        const radarSize = isMobileR ? Math.min(window.innerWidth - 40, 300) : (radarWrapper ? Math.min(radarWrapper.offsetWidth - 32, 600) : 600);
        radarCanvas.width = radarSize; radarCanvas.height = radarSize;
        radarCanvas.style.width = radarSize + 'px'; radarCanvas.style.height = radarSize + 'px';
        if (radarWrapper) { radarWrapper.style.width = radarSize + 'px'; radarWrapper.style.height = radarSize + 'px'; }
        chartInstances.athleteRadar = new Chart(radarCanvas.getContext('2d'), {
            type: 'radar',
            data: { labels: Object.values(radarMetrics), datasets: datasets },
            options: {
                maintainAspectRatio: false,
                responsive: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 20, color: _chartTickColor(), backdropColor: 'transparent' },
                        pointLabels: { color: _chartTickColor(), font: {size: 10} },
                        grid: { color: _chartGridColor() },
                        angleLines: { color: _chartGridColor() }
                    }
                },
                plugins: { legend: { labels: { color: _chartTickColor() } } }
            }
        });
    };
    window.updateAthleteRadarChart = updateAthleteRadarChart;
    window.updatePerformanceChart = updatePerformanceChart;
    window.updateAthleteTrendChart = updateAthleteTrendChart;
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
        // Dimensioni dinamiche per mobile
        const multiCanvas = document.getElementById('multiAthleteChart');
        const multiWrapper = document.getElementById('multi-athlete-chart-wrapper');
        const isMobileMulti = window.innerWidth < 768;
        const multiW = isMobileMulti ? Math.max(chartData.length * 55, window.innerWidth - 40) : (multiWrapper ? multiWrapper.parentElement.offsetWidth - 32 : 600);
        const multiH = 300;
        multiCanvas.width = multiW;
        multiCanvas.height = multiH;
        multiCanvas.style.width = multiW + 'px';
        multiCanvas.style.height = multiH + 'px';
        if (multiWrapper) {
            multiWrapper.style.width = multiW + 'px';
            multiWrapper.style.minWidth = multiW + 'px';
            multiWrapper.style.height = multiH + 'px';
        }
        chartInstances.multiAthlete = new Chart(multiCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.name),
                datasets: [{
                    label: gpsFieldsForDisplay[metric],
                    data: chartData.map(d => d.value.toFixed(2)),
                    backgroundColor: 'rgba(22, 163, 74, 0.8)'
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: false,
                scales: {
                    y: { ticks: { color: _chartTickColor() }, grid: { color: _chartGridColor() } },
                    x: { ticks: { color: _chartTickColor() }, grid: { color: 'rgba(241, 241, 241, 0.1)' } }
                },
                plugins: {
                    legend: { display: false, labels: { color: _chartTickColor() } },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y}`
                        }
                    }
                }
            }
        });
    };
    window.updateMultiAthleteChart = updateMultiAthleteChart;
    const checkDeadlinesAndAlert = () => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const threeMonths = new Date();
        threeMonths.setMonth(today.getMonth() + 3);
        const oneMonth = new Date();
        oneMonth.setMonth(today.getMonth() + 1);
        
        const expiredVisita = [];
        const warningVisita = [];
        const expiredTessera = [];
        const warningTessera = [];
        const expiredPagamenti = [];
        const warningPagamenti = [];

        // Finestra 2 settimane per pagamenti
        const twoWeeks = new Date();
        twoWeeks.setDate(today.getDate() + 14);

        athletes.forEach(athlete => {
            // Check visite mediche
            if (athlete.scadenzaVisita) {
                const deadline = new Date(athlete.scadenzaVisita);
                if (deadline < today) {
                    expiredVisita.push(athlete.name);
                } else if (deadline <= threeMonths) {
                    warningVisita.push(`${athlete.name} (${deadline.toLocaleDateString('it-IT')})`);
                }
            }
            
            // Check tessere GO
            if (athlete.scadenzaTessera) {
                const deadline = new Date(athlete.scadenzaTessera);
                if (deadline < today) {
                    expiredTessera.push(athlete.name);
                } else if (deadline <= oneMonth) {
                    warningTessera.push(`${athlete.name} (${deadline.toLocaleDateString('it-IT')})`);
                }
            }

            // Check pagamenti — usa i dati già caricati da Redis (non lazy)
            const _pagSource = (window._appData && window._appData.pagamenti) || window._pagData || {};
            const pagAtleta = _pagSource[String(athlete.id)];
            if (pagAtleta) {
                let hasExpired = false, hasWarning = false, warningDate = null, expiredDate = null;
                Object.values(pagAtleta).forEach(voce => {
                    (voce.installments || []).forEach(rata => {
                        if (rata.paid || !rata.dueDate) return;
                        const due = new Date(rata.dueDate + 'T00:00:00');
                        if (due < today) {
                            hasExpired = true;
                            if (!expiredDate || due < expiredDate) expiredDate = due;
                        } else if (due <= twoWeeks) {
                            hasWarning = true;
                            if (!warningDate || due < warningDate) warningDate = due;
                        }
                    });
                });
                if (hasExpired) {
                    expiredPagamenti.push(`${athlete.name} (scad. ${expiredDate.toLocaleDateString('it-IT')})`);
                } else if (hasWarning) {
                    warningPagamenti.push(`${athlete.name} (scad. ${warningDate.toLocaleDateString('it-IT')})`);
                }
            }
        });
        
        elements.alertsContainer.innerHTML = '';

        // Banner UNICO e compatto: una riga di "chip" contatori cliccabili.
        // Click su un chip → espande/chiude la lista dei nomi relativi.
        // Rosso = scaduti (urgente), ambra = in scadenza. Niente più 6 banderoni.
        const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const groups = [
            { key: 'vis-exp', sev: 'exp', icon: '🩺', label: 'Visite scadute',        items: expiredVisita },
            { key: 'vis-warn', sev: 'warn', icon: '🩺', label: 'Visite in scadenza',    items: warningVisita },
            { key: 'tes-exp', sev: 'exp', icon: '🪪', label: 'Tessere scadute',        items: expiredTessera },
            { key: 'tes-warn', sev: 'warn', icon: '🪪', label: 'Tessere in scadenza',   items: warningTessera },
            { key: 'pag-exp', sev: 'exp', icon: '💰', label: 'Pagamenti scaduti',      items: expiredPagamenti },
            { key: 'pag-warn', sev: 'warn', icon: '💰', label: 'Pagamenti in scadenza', items: warningPagamenti },
        ].filter(g => g.items.length > 0);

        if (groups.length === 0) return; // nessuna scadenza → nessun banner

        const chip = (g) => {
            const bg = g.sev === 'exp' ? '#7f1d1d' : '#78350f';
            const bd = g.sev === 'exp' ? '#dc2626' : '#d97706';
            return `<button type="button" class="gs-alert-chip" data-target="gsd-${g.key}"
                style="background:${bg};border:1px solid ${bd};color:#fde8e8;border-radius:999px;padding:5px 12px;font-size:0.82rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                ${g.icon} ${esc(g.label)} <span style="background:rgba(255,255,255,0.22);border-radius:999px;padding:0 7px;font-weight:700;">${g.items.length}</span></button>`;
        };
        const detail = (g) => `<div id="gsd-${g.key}" class="gs-alert-detail" style="display:none;font-size:0.85rem;color:#e2e8f0;padding:8px 4px 2px;line-height:1.6;">${g.items.map(esc).join(' · ')}</div>`;

        const totExp = expiredVisita.length + expiredTessera.length + expiredPagamenti.length;
        const headTxt = totExp > 0 ? '⚠️ Scadenze da gestire' : '🔔 Promemoria scadenze';

        // Colori ancorati ai token --sm-*: l'alert segue automaticamente il tema
        // (scuro/chiaro) senza doversi rigenerare al cambio tema. La stripe
        // sinistra è semantica: rosso se ci sono scadenze, ambra se solo promemoria.
        const isLightTheme = document.documentElement.classList.contains('theme-light') || document.body.classList.contains('theme-light');
        const stripe = totExp > 0 ? 'var(--sm-danger)' : 'var(--sm-warn)';
        elements.alertsContainer.innerHTML = `
            <div class="alert alert-dismissible fade show gs-deadline-alert" role="alert"
                 style="background:var(--sm-surface);border:1px solid var(--sm-border);border-left:4px solid ${stripe};color:var(--sm-text);">
                <div style="font-weight:700;margin-bottom:8px;color:var(--sm-text);">${headTxt}</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">${groups.map(chip).join('')}</div>
                ${groups.map(g => `<div id="gsd-${g.key}" class="gs-alert-detail" style="display:none;font-size:0.85rem;color:var(--sm-text-muted);padding:8px 4px 2px;line-height:1.6;">${g.items.map(esc).join(' · ')}</div>`).join('')}
                <button type="button" class="${isLightTheme ? 'btn-close' : 'btn-close btn-close-white'}" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;

        // Toggle espansione dei dettagli al click sul chip
        elements.alertsContainer.querySelectorAll('.gs-alert-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = document.getElementById(btn.getAttribute('data-target'));
                if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
            });
        });
    };
    const logout = () => { sessionStorage.removeItem('isAuthenticated'); updateAllUI(); };
    const syncAndUpdateEvaluationDate = (newDate) => {
        elements.evaluationDatePicker.value = newDate;
        elements.evaluationDatePicker2.value = newDate;
        // Sincronizza anche il picker della sezione presenze
        const presenzePicker = document.getElementById('presenze-date-picker');
        if (presenzePicker) presenzePicker.value = newDate;
        updateEvaluationCharts();
        updateAttendanceChart();
        updateHallOfFame();
    };
    window.syncAndUpdateEvaluationDate = syncAndUpdateEvaluationDate;
    elements.evaluationDatePicker.addEventListener('change', (e) => syncAndUpdateEvaluationDate(e.target.value));
    elements.evaluationDatePicker2.addEventListener('change', (e) => syncAndUpdateEvaluationDate(e.target.value));
    elements.logoutBtn.addEventListener('click', logout);
    elements.cardsSummaryTbody.addEventListener('click', e => {
        const removeBtn = e.target.closest('.remove-card-summary-row-btn');
        if (!removeBtn) return;
        // v1.5.13: ora il pulsante cancella TUTTI i cartellini di un atleta
        const athleteId = removeBtn.dataset.athleteId;
        if (!athleteId) return;
        const athlete = athletes.find(a => String(a.id) === athleteId);
        const nome = athlete ? athlete.name : 'questo atleta';
        if (!confirm(`Cancellare TUTTI i cartellini di ${nome} dalla stagione corrente?`)) return;
        // Itera su tutte le partite e rimuove i cartellini di quell'atleta
        let totRemossi = 0;
        Object.keys(matchResults).forEach(matchId => {
            const match = matchResults[matchId];
            if (!match || !match.cards) return;
            const before = match.cards.length;
            match.cards = match.cards.filter(c => String(c.athleteId) !== String(athleteId));
            totRemossi += (before - match.cards.length);
        });
        if (totRemossi > 0) {
            saveData();
            renderCardsSummary();
        } else {
            // Nessun cartellino trovato (caso teorico: visuallyDeletedCards)
            renderCardsSummary();
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
        const newDate = document.getElementById('session-date').value;
        const id = document.getElementById('session-id').value || Date.now();
        const title = document.getElementById('session-title').value;

        // Cerca la sessione su TUTTE le date (potrebbe essere stata spostata)
        let oldDate = null;
        let existingSession = null;
        for (const d in trainingSessions) {
            const found = trainingSessions[d].find(s => String(s.id) === String(id));
            if (found) { oldDate = d; existingSession = found; break; }
        }

        // Determina se è una sessione Individual spostata di data
        const isMoving = oldDate && oldDate !== newDate;
        const isIndividualSession = existingSession && existingSession.isIndividual;

        // Titolo: aggiungi "Rip." se è individual spostata
        let finalTitle = title;
        if (isMoving && isIndividualSession && !title.includes('Rip.')) {
            finalTitle = title.replace(/\s*\(Rec\.\)/, '') + ' (Rip.)';
        }

        const sessionData = {
            id,
            date: newDate,
            title: finalTitle,
            type: document.getElementById('session-type').value,
            time: document.getElementById('session-time').value,
            location: document.getElementById('session-location').value,
            goals: document.getElementById('session-goals').value,
            description: document.getElementById('session-description').value,
            note: document.getElementById('session-note').value.trim(),
            // Preserva i metadati individual se presenti
            ...(existingSession && existingSession.isIndividual ? {
                isIndividual: true,
                athleteId: existingSession.athleteId,
                coachColor: existingSession.coachColor
            } : {})
        };

        // Rimuovi dalla data vecchia se spostata
        if (isMoving && oldDate) {
            trainingSessions[oldDate] = trainingSessions[oldDate].filter(s => String(s.id) !== String(id));
            if (trainingSessions[oldDate].length === 0) delete trainingSessions[oldDate];
        }

        // Salva sulla nuova data
        if (!trainingSessions[newDate]) trainingSessions[newDate] = [];
        const existingIndex = trainingSessions[newDate].findIndex(s => String(s.id) === String(id));
        if (existingIndex > -1) {
            trainingSessions[newDate][existingIndex] = sessionData;
        } else {
            trainingSessions[newDate].push(sessionData);
        }

        // Copia in Calendario Squadra (calendarEvents) se checkbox spuntata
        if (document.getElementById('session-sync-cal')?.checked) {
            const ceDate = sessionData.date;
            const ceEntry = { type: sessionData.type || 'Allenamento', time: sessionData.time || '' };
            if (sessionData.note) ceEntry.note = sessionData.note;
            const existing = window.calendarEvents && window.calendarEvents[ceDate];
            if (!existing || confirm('Esiste già un evento nel Calendario Squadra per il ' + ceDate + '.\nVuoi sostituirlo con "' + ceEntry.type + '"?')) {
                if (!window.calendarEvents) window.calendarEvents = {};
                window.calendarEvents[ceDate] = ceEntry;
            }
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
            // Fascia Da–A: mostra i picker e precompila con gli ultimi 30 giorni
            const rangeWrap = document.getElementById('attendance-range-wrap');
            const rangeStart = document.getElementById('attendance-range-start');
            const rangeEnd = document.getElementById('attendance-range-end');
            if (rangeWrap) rangeWrap.style.display = (attendanceChartPeriod === 'custom') ? 'flex' : 'none';
            if (attendanceChartPeriod === 'custom' && rangeStart && rangeEnd && (!rangeStart.value || !rangeEnd.value)) {
                const presenzePicker = document.getElementById('presenze-date-picker');
                const ref = (presenzePicker && presenzePicker.value) ? new Date(presenzePicker.value) : new Date();
                const from = new Date(ref); from.setDate(from.getDate() - 30);
                const iso = (dt) => dt.toISOString().substring(0, 10);
                if (!rangeEnd.value) rangeEnd.value = iso(ref);
                if (!rangeStart.value) rangeStart.value = iso(from);
            }
            updateAttendanceChart();
        }
    });
    // Ridisegna il conteggio quando cambiano le date della fascia Da–A
    ['attendance-range-start', 'attendance-range-end'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (attendanceChartPeriod === 'custom') updateAttendanceChart();
        });
    });
    // Listener Aggiungi Staff
    // FIX v1.5.21: funzione per impostare tipo persona nel modal
    window._setTipoPersona = function(tipo) {
        var tipoEl = document.getElementById('modal-tipo-persona');
        if (tipoEl) tipoEl.value = tipo;
        // Aggiorna colori bottoni
        ['atleta','allenatore','dirigente'].forEach(function(t) {
            var btn = document.getElementById('tipo-' + t + '-btn');
            if (!btn) return;
            if (t === tipo) {
                btn.style.background = t === 'atleta' ? '#3b82f6' : t === 'allenatore' ? '#16a34a' : '#166534';
                btn.style.color = '#fff';
            } else {
                btn.style.background = '#374151';
                btn.style.color = '#9ca3af';
            }
        });
        // Aggiorna dataset.isStaff
        var idEl = document.getElementById('modal-athlete-id');
        if (idEl) idEl.dataset.isStaff = (tipo !== 'atleta') ? 'true' : '';
    };
    if (elements.addStaffBtn) {
        elements.addStaffBtn.addEventListener('click', () => {
            document.getElementById('athleteModalLabel').textContent = 'Aggiungi Staff';
            document.getElementById('athlete-form').reset();
            document.getElementById('modal-athlete-id').value = '';
            document.getElementById('modal-athlete-id').dataset.isStaff = 'true';
            window._setTipoPersona('allenatore'); // default staff = allenatore
            const avatarUrl = document.getElementById('athlete-avatar-url');
            if (avatarUrl) avatarUrl.value = '';
            const avatarBase64 = document.getElementById('athlete-avatar-base64');
            if (avatarBase64) avatarBase64.value = '';
            document.getElementById('avatar-preview').style.display = 'none';
            document.getElementById('avatar-preview').src = '';
            document.getElementById('athlete-captain').checked = false;
            document.getElementById('athlete-vice-captain').checked = false;
            document.getElementById('athlete-guest').checked = false;
            athleteModal.show();
        });
    }

    // Listener Quick Aggiungi Staff (da Home)
    if (elements.quickAddStaffBtn) {
        elements.quickAddStaffBtn.addEventListener('click', () => {
            if (elements.addStaffBtn) elements.addStaffBtn.click();
        });
    }

    // Inizializza switch vista
    const _initView = sessionStorage.getItem('gosport_squad_view') || 'box';
    if (_initView === 'list') {
        document.getElementById('view-box-btn')?.classList.remove('active');
        document.getElementById('view-list-btn')?.classList.add('active');
    }

    elements.addAthleteBtn.addEventListener('click', () => {
        document.getElementById('athleteModalLabel').textContent = 'Aggiungi Atleta';
        document.getElementById('athlete-form').reset();
        document.getElementById('modal-athlete-id').value = '';
        document.getElementById('modal-athlete-id').dataset.isStaff = '';
        window._setTipoPersona('atleta'); // default = atleta
        document.getElementById('avatar-preview').style.display = 'none';
        document.getElementById('avatar-preview').src = '';
        const avatarInput = document.getElementById('athlete-avatar-url');
        if (avatarInput) avatarInput.value = '';
        const avatarBase64 = document.getElementById('athlete-avatar-base64');
        if (avatarBase64) avatarBase64.value = '';
        document.getElementById('athlete-captain').checked = false;
        document.getElementById('athlete-vice-captain').checked = false;
        document.getElementById('athlete-guest').checked = false;
        athleteModal.show();
    });
    // Chiude il menu "⋯" delle card quando si clicca fuori da esso.
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.card-more-wrap')) {
            document.querySelectorAll('.card-more-wrap.open').forEach(w => {
                w.classList.remove('open');
                const c = w.closest('.athlete-card'); if (c) c.style.overflow = '';
            });
        }
    });
    elements.athleteGrid.addEventListener('click', async (e) => {
        // Menu "⋯" azioni secondarie: apri/chiudi e non propagare ad altri handler.
        const moreBtn = e.target.closest('.card-more-btn');
        if (moreBtn) {
            e.stopPropagation();
            const wrap = moreBtn.closest('.card-more-wrap');
            const wasOpen = wrap.classList.contains('open');
            // chiudi tutti gli altri menu e ripristina il loro overflow
            document.querySelectorAll('.card-more-wrap.open').forEach(w => {
                w.classList.remove('open');
                const c = w.closest('.athlete-card'); if (c) c.style.overflow = '';
            });
            if (!wasOpen) {
                wrap.classList.add('open');
                // fallback per browser senza :has() — mostra il menu fuori dalla card
                const c = wrap.closest('.athlete-card'); if (c) c.style.overflow = 'visible';
            }
            return;
        }
        const card = e.target.closest('[data-athlete-id]');
        if (!card) return;
        const athleteId = card.dataset.athleteId;
        const athlete = athletes.find(a => a.id.toString() === athleteId);
        if (!athlete) return;
        // Dopo aver scelto un'azione dal menu, richiudilo.
        document.querySelectorAll('.card-more-wrap.open').forEach(w => {
            w.classList.remove('open');
            const c = w.closest('.athlete-card'); if (c) c.style.overflow = '';
        });
        if (e.target.closest('.parent-btn')) {
            openParentModal(athleteId);
        }
        else if (e.target.closest('.infortuni-btn')) {
            window.openInfortuniModal(athleteId);
        }
        else if (e.target.closest('.individual-btn')) {
            const indModal = bootstrap.Modal.getInstance(document.getElementById('individualModal')) || new bootstrap.Modal(document.getElementById('individualModal'));
            document.getElementById('individual-athlete-name').textContent = athlete.name;
            document.getElementById('ind-modal-athlete-id').value = athlete.id;
            const pkg = athlete.individualPackage || {};
            const pkgEl = document.getElementById('athlete-individual-pkg');
            if (pkgEl) pkgEl.value = pkg.type || '';
            const stEl = document.getElementById('athlete-individual-start');
            const expEl = document.getElementById('athlete-individual-expiry');
            const dwEl = document.getElementById('athlete-ind-days-week');
            const csEl = document.getElementById('athlete-ind-coach-sessions');
            const ptEl = document.getElementById('athlete-ind-time');
            const coachEl = document.getElementById('athlete-ind-coach');
            const coachColorEl = document.getElementById('athlete-ind-coach-color');
            if (stEl) stEl.value = pkg.startDate || '';
            if (expEl) expEl.value = pkg.expiryDate || '';
            if (dwEl) dwEl.value = pkg.daysPerWeek || '';
            if (csEl) csEl.value = pkg.coachSessions || '';
            if (ptEl) ptEl.value = pkg.preferredTime || '';
            if (coachEl) coachEl.value = pkg.coachName || '';
            if (coachColorEl) coachColorEl.value = pkg.coachColor || '#3b82f6';
            document.querySelectorAll('#ind-days-selector input').forEach(cb => {
                cb.checked = (pkg.weekDays || []).includes(cb.value);
            });
            if (pkgEl) pkgEl.onchange = window.calcIndividualExpiry;
            if (dwEl) dwEl.onchange = window.calcIndividualExpiry;
            indModal.show();
        }
        else if (e.target.closest('.edit-btn')) {
            document.getElementById('athleteModalLabel').textContent = 'Modifica Atleta';
            document.getElementById('modal-athlete-id').value = athlete.id;
            // FIX v1.5.21: imposta tipo persona corretto dal dato esistente
            document.getElementById('modal-athlete-id').dataset.isStaff = athlete.isStaff ? 'true' : '';
            var _tipoEdit = athlete.isStaff ? (athlete.role && athlete.role.toLowerCase().includes('dirigente') ? 'dirigente' : 'allenatore') : 'atleta';
            window._setTipoPersona(_tipoEdit);
            const _np = (athlete.name || '').split(/\s+/);
            document.getElementById('athlete-nome').value    = athlete.nome    || _np.slice(0, -1).join(' ') || athlete.name || '';
            document.getElementById('athlete-cognome').value = athlete.cognome || _np[_np.length - 1] || '';
            document.getElementById('athlete-role').value = athlete.role;
            document.getElementById('athlete-number').value = athlete.number;
            document.getElementById('scadenza-visita').value = athlete.scadenzaVisita || '';
            document.getElementById('prenotazione-visita').value = athlete.dataPrenotazioneVisita || '';
            const tesseraField = document.getElementById('scadenza-tessera');
            if (tesseraField) tesseraField.value = athlete.scadenzaTessera || '';
            const certField = document.getElementById('athlete-cert-link');
            if (certField) certField.value = athlete.certLink || '';
            document.getElementById('athlete-captain').checked = athlete.isCaptain;
            document.getElementById('athlete-vice-captain').checked = athlete.isViceCaptain;
            document.getElementById('athlete-guest').checked = athlete.isGuest;
            const infEl = document.getElementById('athlete-infortunato');
            if (infEl) { infEl.checked = athlete.infortunato || false; const rientroField = document.getElementById('rientro-field'); if (rientroField) rientroField.style.display = athlete.infortunato ? '' : 'none'; }
            const rientroEl = document.getElementById('data-rientro');
            if (rientroEl) rientroEl.value = athlete.dataRientro || '';
            // Carica pacchetto individual
            if (document.getElementById('athlete-email')) document.getElementById('athlete-email').value = athlete.email || '';
            if (document.getElementById('athlete-phone')) document.getElementById('athlete-phone').value = athlete.phone || '';
            if (document.getElementById('athlete-sesso')) document.getElementById('athlete-sesso').value = athlete.sesso || '';
            if (document.getElementById('athlete-data-nascita')) document.getElementById('athlete-data-nascita').value = athlete.dataNascita || '';
            if (document.getElementById('athlete-comune-nascita')) document.getElementById('athlete-comune-nascita').value = athlete.comuneNascita || '';
            if (document.getElementById('athlete-provincia-nascita')) document.getElementById('athlete-provincia-nascita').value = athlete.provinciaNascita || '';
            if (document.getElementById('athlete-codice-fiscale')) { document.getElementById('athlete-codice-fiscale').value = athlete.codiceFiscale || ''; window.validateCF(); }
            if (document.getElementById('athlete-numero-tessera')) document.getElementById('athlete-numero-tessera').value = athlete.numeroTessera || '';
            if (document.getElementById('athlete-numero-matricola')) document.getElementById('athlete-numero-matricola').value = athlete.numeroMatricola || '';
            const pkgEl = document.getElementById('athlete-individual-pkg');
            const expEl = document.getElementById('athlete-individual-expiry');
            if (pkgEl) pkgEl.value = athlete.individualPackage?.type || '';
            if (expEl) expEl.value = athlete.individualPackage?.expiryDate || '';
            const dwEl = document.getElementById('athlete-ind-days-week');
            const csEl = document.getElementById('athlete-ind-coach-sessions');
            const ptEl = document.getElementById('athlete-ind-time');
            const stEl = document.getElementById('athlete-individual-start');
            if (dwEl) dwEl.value = athlete.individualPackage?.daysPerWeek || '';
            if (csEl) csEl.value = athlete.individualPackage?.coachSessions || '';
            if (ptEl) ptEl.value = athlete.individualPackage?.preferredTime || '';
            if (stEl) stEl.value = athlete.individualPackage?.startDate || '';
            // Giorni settimana
            document.querySelectorAll('#ind-days-selector input').forEach(cb => {
                cb.checked = (athlete.individualPackage?.weekDays || []).includes(cb.value);
            });
            // Coach
            const coachEl = document.getElementById('athlete-ind-coach');
            const coachColorEl = document.getElementById('athlete-ind-coach-color');
            if (coachEl) coachEl.value = athlete.individualPackage?.coachName || '';
            if (coachColorEl) coachColorEl.value = athlete.individualPackage?.coachColor || '#3b82f6';
            // Ricalcola on change
            if (pkgEl) pkgEl.onchange = window.calcIndividualExpiry;
            if (dwEl) dwEl.onchange = window.calcIndividualExpiry;
            const preview = document.getElementById('avatar-preview');
            document.getElementById('athlete-avatar-base64').value = '';
            const urlField = document.getElementById('athlete-avatar-url');
            const av = athlete.avatar || '';
            if (urlField) urlField.value = av.startsWith('data:') ? '' : av;
            if (av && !av.startsWith('data:')) {
                preview.src = av;
                preview.style.display = 'block';
                preview.onerror = function() { this.style.display = 'none'; };
            }
            if (athlete.avatar) {
                preview.src = athlete.avatar;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
            athleteModal.show();
        }
        else if (e.target.closest('.archive-btn')) {
            if (confirm(`Archiviare ${athlete.name}? L'atleta verrà nascosto dalla rosa ma tutti i dati saranno conservati.\n\nNota: gli atleti archiviati vengono cancellati automaticamente dopo 12 mesi (norme privacy/GDPR).`)) {
                const idx = athletes.findIndex(a => String(a.id) === athleteId);
                // archivedAt: da qui parte il conteggio dei 12 mesi per l'auto-oblio (R2/art.17)
                if (idx !== -1) { athletes[idx] = { ...athletes[idx], archived: true, archivedAt: new Date().toISOString() }; saveData(); renderAthletes(); }
            }
        }
        else if (e.target.closest('.restore-btn')) {
            const idx = athletes.findIndex(a => String(a.id) === athleteId);
            // ripristino in rosa: azzera archivedAt così il timer di retention si ferma
            if (idx !== -1) { const { archivedAt, ...rest } = athletes[idx]; athletes[idx] = { ...rest, archived: false }; saveData(); renderAthletes(); }
        }
        else if (e.target.closest('.delete-btn')) {
            if (confirm(`Sei sicuro di voler eliminare ${athlete.name}? Tutti i suoi dati storici verranno rimossi.\n\nLa cancellazione è definitiva e propaga a presenze, pagelle, pagamenti, certificati, formazioni e convocazioni (GDPR art. 17).`)) {
                // R2: la cancellazione completa avviene LATO SERVER (purge-athlete),
                // perché molte strutture per-atleta (ratingSheets, pagamenti, athleteDocs,
                // materiale, convocazioni) sono chiavi Redis separate che il client non
                // riscrive → pulirle solo qui lascerebbe dati orfani.
                const annataId = sessionStorage.getItem('gosport_current_annata') ||
                                 localStorage.getItem('currentAnnata');
                try {
                    const resp = await fetch('/api/data?action=purge-athlete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId },
                        body: JSON.stringify({ athleteId })
                    });
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                } catch (err) {
                    console.error('Errore cancellazione atleta:', err);
                    alert('⚠️ Errore durante la cancellazione. Riprova.');
                    return;
                }
                // Allinea lo stato locale e ricarica dal server per riflettere il purge completo.
                athletes = athletes.filter(a => a.id.toString() !== athleteId);
                for (const date in evaluations) { delete evaluations[date][athleteId]; }
                delete gpsData[athleteId];
                for (const date in awards) {
                    awards[date] = awards[date].filter(a => a.athleteId.toString() !== athleteId);
                }
                Object.keys(matchResults).forEach(matchId => {
                    matchResults[matchId].scorers = matchResults[matchId].scorers.filter(s => String(s.athleteId) !== athleteId);
                    matchResults[matchId].cards = matchResults[matchId].cards.filter(c => String(c.athleteId) !== athleteId);
                    matchResults[matchId].assists = matchResults[matchId].assists.filter(a => String(a.athleteId) !== athleteId);
                });
                updateAllUI();
            }
        }
        else if (e.target.closest('.copy-annata-btn')) {
            const annataId = sessionStorage.getItem('gosport_current_annata') || localStorage.getItem('currentAnnata');
            let modal = document.getElementById('copyAnnataModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'copyAnnataModal';
                modal.className = 'modal fade';
                modal.tabIndex = -1;
                modal.innerHTML = `<div class="modal-dialog modal-sm"><div class="modal-content" style="background:#1e293b;color:#f1f5f9;"><div class="modal-header border-secondary"><h5 class="modal-title">📋 Copia in annata</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><p id="copyAnnataAthlName" class="fw-bold mb-3"></p><label class="form-label small">Annata di destinazione</label><select id="copyAnnataSelect" class="form-select form-select-sm" style="background:#0f172a;color:#f1f5f9;border-color:#334155;"></select></div><div class="modal-footer border-secondary"><button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annulla</button><button type="button" class="btn btn-info btn-sm" id="copyAnnataConfirmBtn">Copia</button></div></div></div>`;
                document.body.appendChild(modal);
            }
            document.getElementById('copyAnnataAthlName').textContent = athlete.name;
            const select = document.getElementById('copyAnnataSelect');
            select.innerHTML = '<option value="">Caricamento…</option>';
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            try {
                const resp = await fetch('/api/annate/list', {
                    headers: { 'X-Auth-Session': sessionStorage.getItem('gosport_session_token') || '' }
                });
                const data = await resp.json();
                const annateList = Array.isArray(data) ? data : (data.annate || []);
                const filtered = annateList.filter(a => String(a.id) !== String(annataId));
                if (filtered.length === 0) {
                    select.innerHTML = '<option value="">Nessuna altra annata disponibile</option>';
                } else {
                    select.innerHTML = filtered.map(a => `<option value="${a.id}">${a.nome || a.id}</option>`).join('');
                }
            } catch (err) {
                select.innerHTML = '<option value="">Errore caricamento annate</option>';
            }
            document.getElementById('copyAnnataConfirmBtn').onclick = async function () {
                const destId = select.value;
                if (!destId) return;
                this.disabled = true;
                this.textContent = 'Copia in corso…';
                try {
                    const r = await fetch('/api/data?action=copy-athlete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Annata-Id': annataId },
                        body: JSON.stringify({ _action: 'copy-athlete', athleteId, destAnnataId: destId })
                    });
                    const res = await r.json();
                    bsModal.hide();
                    if (res.skipped) {
                        alert(`ℹ️ ${athlete.name} è già presente nell'annata selezionata. Nessuna copia effettuata.`);
                    } else if (res.success) {
                        alert(`✅ ${athlete.name} copiato con successo!`);
                    } else {
                        alert('⚠️ Errore durante la copia: ' + (res.error || 'sconosciuto'));
                    }
                } catch (err) {
                    bsModal.hide();
                    alert('⚠️ Errore di rete durante la copia.');
                }
            };
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
                // Carica presenza-individual
                const indEl = document.getElementById('presenza-individual');
                if (indEl) {
                    const indSaved = existingEvaluation['presenza-individual'];
                    indEl.value = indSaved !== undefined ? String(indSaved) : '';
                }
                document.getElementById('award-checkbox').checked = !!(awards[date]?.find(a => a.athleteId.toString() === athleteId));
                // Su mobile usa pannello fisso, su desktop usa modal Bootstrap
                // Usa sempre il pannello mobile custom (più stabile del Bootstrap modal)
                showMobileEvalPanel(athlete.name, athlete.id, date);
            }
        }
    });
    modalsContainer.addEventListener('change', (e) => {
        if (e.target.id === 'athlete-avatar-input') {
            const file = e.target.files[0];
            if (file) {
                if (!confirm("ATTENZIONE: L'importazione sovrascriverà tutti i dati attuali. Vuoi continuare?")) {
            e.target.value = null; // Resetta il file selezionato
            return;
        }
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
        const isStaffFlag = ['allenatore','dirigente'].includes(
            document.getElementById('modal-tipo-persona')?.value || ''
        ) || document.getElementById('modal-athlete-id').dataset.isStaff === 'true';
        const avatarElement = document.getElementById('athlete-avatar-base64');
        const avatarBase64 = avatarElement ? avatarElement.value : '';
        const existingAthlete = athleteId ? athletes.find(a => a.id.toString() === athleteId) : null;
        const athleteData = {
            id: existingAthlete ? existingAthlete.id : generateId(),
            nome: (document.getElementById('athlete-nome')?.value?.trim() || ''),
            cognome: (document.getElementById('athlete-cognome')?.value?.trim() || ''),
            name: [(document.getElementById('athlete-nome')?.value?.trim() || ''), (document.getElementById('athlete-cognome')?.value?.trim() || '')].filter(Boolean).join(' '),
            email: document.getElementById('athlete-email')?.value?.trim() || '',
            phone: document.getElementById('athlete-phone')?.value?.trim() || '',
            role: document.getElementById('athlete-role')?.value?.trim() || '',
            isStaff: isStaffFlag || false,
            number: (document.getElementById('athlete-number')?.value || '').trim(),
            isCaptain: document.getElementById('athlete-captain')?.checked || false,
            isViceCaptain: document.getElementById('athlete-vice-captain')?.checked || false,
            isGuest: document.getElementById('athlete-guest')?.checked || false,
            infortunato: document.getElementById('athlete-infortunato')?.checked || false,
            dataRientro: document.getElementById('data-rientro')?.value || '',
            scadenzaVisita: document.getElementById('scadenza-visita')?.value || '',
            dataPrenotazioneVisita: document.getElementById('prenotazione-visita')?.value || '',
            scadenzaTessera: document.getElementById('scadenza-tessera')?.value || '',
            certLink: (document.getElementById('athlete-cert-link')?.value || '').trim(),
            sesso: document.getElementById('athlete-sesso')?.value || '',
            dataNascita: document.getElementById('athlete-data-nascita')?.value || '',
            comuneNascita: (document.getElementById('athlete-comune-nascita')?.value || '').trim(),
            provinciaNascita: (document.getElementById('athlete-provincia-nascita')?.value || '').toUpperCase().trim(),
            codiceFiscale: (document.getElementById('athlete-codice-fiscale')?.value || '').toUpperCase().trim(),
            numeroTessera: (document.getElementById('athlete-numero-tessera')?.value || '').trim(),
            numeroMatricola: (document.getElementById('athlete-numero-matricola')?.value || '').trim()
        };

        const avatarUrl = (document.getElementById('athlete-avatar-url')?.value || '').trim();
        if (avatarUrl) {
            athleteData.avatar = avatarUrl;
        } else if (existingAthlete && existingAthlete.avatar) {
            athleteData.avatar = existingAthlete.avatar; // mantieni foto esistente
        }

        if (existingAthlete) {
            // Aggiorna atleta esistente - merge per preservare campi non nel form
            const index = athletes.findIndex(a => a.id === existingAthlete.id);
            athletes[index] = { ...existingAthlete, ...athleteData };
        } else {
            // Aggiungi nuovo atleta
            athletes.push(athleteData);
        }

        saveData().then(() => {
            updateAllUI();
            athleteModal.hide();
            alert(`${existingAthlete ? 'Atleta aggiornato' : 'Atleta aggiunto'} con successo!`);
        });
    });

    // ── Submit Pacchetto Individual ───────────────────────────────────────
    document.getElementById('individual-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const athleteId = document.getElementById('ind-modal-athlete-id').value;
        const idx = athletes.findIndex(a => String(a.id) === String(athleteId));
        if (idx === -1) return;
        athletes[idx] = {
            ...athletes[idx],
            individualPackage: {
                type: document.getElementById('athlete-individual-pkg')?.value || '',
                startDate: document.getElementById('athlete-individual-start')?.value || '',
                expiryDate: document.getElementById('athlete-individual-expiry')?.value || '',
                daysPerWeek: document.getElementById('athlete-ind-days-week')?.value || '',
                coachSessions: document.getElementById('athlete-ind-coach-sessions')?.value || '',
                preferredTime: document.getElementById('athlete-ind-time')?.value || '',
                weekDays: Array.from(document.querySelectorAll('#ind-days-selector input:checked')).map(cb => cb.value),
                coachName: document.getElementById('athlete-ind-coach')?.value?.trim() || '',
                coachColor: document.getElementById('athlete-ind-coach-color')?.value || '#3b82f6'
            }
        };
        saveData().then(() => {
            updateAllUI();
            bootstrap.Modal.getInstance(document.getElementById('individualModal'))?.hide();
        });
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
        // Salva presenza-individual
        const indVal = document.getElementById('presenza-individual').value;
        if (indVal !== '') {
            // 's' = Non Fruita causa Società → salva come stringa, non parseInt
            evaluations[date][athleteId]['presenza-individual'] = indVal === 's' ? 's' : parseInt(indVal);
        } else {
            delete evaluations[date][athleteId]['presenza-individual'];
        }

        // ── Auto-recupero: se "Soc. — Non Fruita", aggiungi sessione in coda ──
        if (indVal === 's') {
            const athlete = athletes.find(a => String(a.id) === String(athleteId));
            if (athlete && athlete.individualPackage && athlete.individualPackage.type) {
                const pkg = athlete.individualPackage;
                const weekDays = (pkg.weekDays || []).map(Number);

                if (weekDays.length > 0) {
                    // Trova l'ultima sessione individual pianificata per questo atleta
                    const indDates = Object.keys(trainingSessions)
                        .filter(d => trainingSessions[d].some(s =>
                            s.isIndividual && String(s.athleteId) === String(athleteId)
                        ))
                        .sort();

                    if (indDates.length > 0) {
                        const lastDateStr = indDates[indDates.length - 1];
                        const lastDate = new Date(lastDateStr + 'T00:00:00');

                        // Cerca il prossimo giorno valido dopo l'ultima sessione
                        const next = new Date(lastDate);
                        next.setDate(next.getDate() + 1);
                        let found = false;
                        for (let i = 0; i < 14 && !found; i++) {
                            if (weekDays.includes(next.getDay())) {
                                found = true;
                                const nextStr = next.getFullYear() + '-' +
                                    String(next.getMonth()+1).padStart(2,'0') + '-' +
                                    String(next.getDate()).padStart(2,'0');
                                if (!trainingSessions[nextStr]) trainingSessions[nextStr] = [];
                                // Evita duplicati
                                const exists = trainingSessions[nextStr].some(s =>
                                    s.isIndividual && String(s.athleteId) === String(athleteId)
                                );
                                if (!exists) {
                                    const coachName = pkg.coachName || '';
                                    trainingSessions[nextStr].push({
                                        id: 'ind_rec_' + athleteId + '_' + nextStr,
                                        date: nextStr,
                                        title: '🏋️ ' + athlete.name + (coachName ? ' — ' + coachName : '') + ' (Rec.)',
                                        time: pkg.preferredTime || '',
                                        location: '',
                                        goals: coachName ? 'Coach: ' + coachName : '',
                                        description: 'Recupero automatico — assenza causa Società',
                                        coachColor: pkg.coachColor || '#3b82f6',
                                        isIndividual: true,
                                        athleteId: String(athleteId)
                                    });
                                }
                            }
                            if (!found) next.setDate(next.getDate() + 1);
                        }
                        if (found) {
                            const nextLabel = next.toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'});
                            setTimeout(() => alert('📅 Recupero pianificato automaticamente: ' + nextLabel), 300);
                        }
                    }
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────
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
    function parseActionTracerExcel(file, onSuccess, onError) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
                const labelMap = {};
                rows.forEach((row, rowIdx) => {
                    row.forEach((cell, colIdx) => {
                        if (typeof cell === 'string' && cell.trim()) {
                            const valueRow = rows[rowIdx + 1];
                            if (valueRow !== undefined && valueRow[colIdx] !== undefined && valueRow[colIdx] !== '') {
                                labelMap[cell.trim().toLowerCase()] = String(valueRow[colIdx]).trim();
                            }
                        }
                    });
                });
                const fields = {};
                let dateTimeRaw = rows[1] && rows[1][0] != null ? rows[1][0] : '';
                if (dateTimeRaw instanceof Date) {
                    const pad = n => String(n).padStart(2, '0');
                    dateTimeRaw = `${dateTimeRaw.getFullYear()}-${pad(dateTimeRaw.getMonth()+1)}-${pad(dateTimeRaw.getDate())} ${pad(dateTimeRaw.getHours())}:${pad(dateTimeRaw.getMinutes())}:00`;
                }
                dateTimeRaw = String(dateTimeRaw).trim();
                if (dateTimeRaw) {
                    const parts = dateTimeRaw.split(' ');
                    if (parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) fields['data_di_registrazione'] = parts[0];
                    if (parts[1]) fields['ora_registrazione'] = parts[1].substring(0, 5);
                }
                const labelToField = {
                    'distanza totale': 'distanza_totale',
                    'distanza sprint': 'distanza_sprint',
                    'tasso massimo': 'velocita_massima',
                    'velocità massima': 'velocita_massima',
                    'conteggio sprint': 'numero_di_sprint',
                    'max acc': 'max_acc',
                    'max dec': 'max_dec',
                };
                Object.entries(labelToField).forEach(([label, fieldKey]) => {
                    if (labelMap[label] !== undefined) fields[fieldKey] = labelMap[label];
                });
                const tempoRaw = labelMap['tempo totale'];
                if (tempoRaw) {
                    const tParts = tempoRaw.split(':').map(Number);
                    if (tParts.length === 2) fields['tempo_totale'] = (Math.round((tParts[0] + tParts[1] / 60) * 10) / 10).toFixed(1);
                    else if (tParts.length === 3) fields['tempo_totale'] = (Math.round((tParts[0] * 60 + tParts[1] + tParts[2] / 60) * 10) / 10).toFixed(1);
                }
                onSuccess(fields);
            } catch (err) {
                onError('Errore lettura file. Verificare il file e riprovare.');
            }
        };
        reader.onerror = () => onError('Errore lettura file. Verificare il file e riprovare.');
        reader.readAsArrayBuffer(file);
    }
    const GPS_PARSERS = { action_tracer_excel: parseActionTracerExcel };
    document.getElementById('gps-import-btn').addEventListener('click', () => {
        document.getElementById('gps-file-input').value = '';
        document.getElementById('gps-file-input').click();
    });
    document.getElementById('gps-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const errEl = document.getElementById('gps-import-error');
        if (errEl) errEl.textContent = '';
        const parser = GPS_PARSERS[document.getElementById('gps-import-format').value];
        if (!parser) return;
        parser(file,
            (fields) => {
                const form = document.getElementById('gps-form');
                Object.entries(fields).forEach(([key, val]) => {
                    const el = form.querySelector(`#gps-${key}`);
                    if (!el) return;
                    if (el.type === 'number' && val !== '') {
                        const num = parseFloat(val);
                        if (!isNaN(num)) {
                            const step = parseFloat(el.step);
                            const decimals = (!isNaN(step) && step > 0 && step < 1)
                                ? Math.round(-Math.log10(step))
                                : 0;
                            el.value = num.toFixed(decimals);
                        } else {
                            el.value = val;
                        }
                    } else {
                        el.value = val;
                    }
                });
                const dist = parseFloat(document.getElementById('gps-distanza_totale').value) || 0;
                const time = parseFloat(document.getElementById('gps-tempo_totale').value) || 0;
                document.getElementById('gps-distanza_per_minuto').value = (time > 0) ? (dist / time).toFixed(2) : '';
            },
            (errMsg) => {
                const errEl = document.getElementById('gps-import-error');
                if (errEl) errEl.textContent = errMsg;
            }
        );
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
    elements.weeklyAthlete1Selector.addEventListener('change', updateWeeklyAttendanceChart);
    elements.weeklyAthlete2Selector.addEventListener('change', updateWeeklyAttendanceChart);
    elements.weeklyDatePicker.addEventListener('change', updateWeeklyAttendanceChart);
    if (elements.weeklyStartDatePicker) {
        elements.weeklyStartDatePicker.addEventListener('change', () => {
            // Quando cambia la data di inizio, imposta il periodo su "Personalizzato"
            weeklyAttendancePeriod = 'custom';
            elements.weeklyPeriodToggle.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            const customBtn = elements.weeklyPeriodToggle.querySelector('[data-period="custom"]');
            if (customBtn) customBtn.classList.add('active');
            updateWeeklyAttendanceChart();
        });
    }
    elements.weeklyPeriodToggle.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            elements.weeklyPeriodToggle.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            weeklyAttendancePeriod = e.target.dataset.period;
            updateWeeklyAttendanceChart();
        }
    });
    // Imposta la data di default a oggi
    elements.weeklyDatePicker.valueAsDate = new Date();
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
    elements.exportAllDataBtn.addEventListener('click', async () => {
    const performDownload = async (includeIndividual) => {
        try {
            // 1. RECUPERA ANNATA DA SESSIONSTORAGE
const annataId = sessionStorage.getItem('gosport_current_annata');
const username = sessionStorage.getItem('gosport_auth_user') || 'admin';
const role = sessionStorage.getItem('gosport_user_role');
const societyId = sessionStorage.getItem('gosport_society_id');
const authSession = sessionStorage.getItem('gosport_session_token');

if (!annataId) {
    alert('⚠️ Errore: Nessuna annata selezionata.');
    return;
}

console.log('🔄 Backup - Annata:', annataId);

// 2. CARICA DATI FRESCHI DA API
const headers = {
    'Content-Type': 'application/json',
    'X-Annata-Id': annataId || '',
    'X-Auth-Session': authSession || '',
    'X-Auth-User': username || '',
    'X-User-Role': role || '',
    'X-Society-Id': societyId || ''
};

const response = await fetch('/api/data', {
    method: 'GET',
    headers
});

if (!response.ok) {
    throw new Error(`Errore caricamento dati: ${response.status}`);
}

const freshData = await response.json();

console.log('📊 Dati caricati:', {
    atleti: (freshData.athletes || []).length,
    valutazioni: Object.keys(freshData.evaluations || {}).length,
    gps: Object.keys(freshData.gpsData || {}).length,
    partite: Object.keys(freshData.matchResults || {}).length
});

if (!freshData.athletes || freshData.athletes.length === 0) {
    alert('⚠️ Nessun atleta trovato per questa annata.');
    return;
}

// 3. PREPARA DATI DA ESPORTARE
            let dataToExport = {
                _backup_metadata: {
                    version: '1.0',
                    annata: annataId,
                    username: username,
                    timestamp: new Date().toISOString(),
                    dataTypes: {
                        athletes: (freshData.athletes || []).length,
                        evaluations: Object.keys(freshData.evaluations || {}).length,
                        gpsData: Object.keys(freshData.gpsData || {}).length,
                        awards: Object.keys(freshData.awards || {}).length,
                        trainingSessions: Object.keys(freshData.trainingSessions || {}).length,
                        matchResults: Object.keys(freshData.matchResults || {}).length,
                        pagamenti: Object.keys(freshData.pagamenti || {}).length,
                        convocazioni: (freshData.convocazioni || []).length,
                        posts: (freshData.posts || []).length + (freshData.globalPosts || []).length
                    }
                },
                athletes: freshData.athletes || [],
                evaluations: freshData.evaluations || {},
                gpsData: freshData.gpsData || {},
                awards: freshData.awards || {},
                trainingSessions: freshData.trainingSessions || {},
                formationData: freshData.formationData || {},
                matchResults: freshData.matchResults || {},
                calendarEvents: freshData.calendarEvents || {},
                calendarResponses: freshData.calendarResponses || {},
                materiale: freshData.materiale || { items: [], assignments: {} },
                pagamenti: freshData.pagamenti || {},
                pagVoci:   freshData.pagVoci   || null,
                pagLabels: freshData.pagLabels || null,
                convocazioni: freshData.convocazioni || [],
                convSettings: freshData.convSettings || {},
                posts: freshData.posts || [],
                globalPosts: freshData.globalPosts || [],
                ratingSheets: freshData.ratingSheets || {},
                documents:    freshData.documents    || []
            };
            
            // 4. FILTRA SESSIONI "INDIVIDUAL" SE NON AUTENTICATO
            if (!includeIndividual) {
                console.log('🔒 Filtraggio sessioni Individual...');
                dataToExport = JSON.parse(JSON.stringify(dataToExport));
                
                for (const athleteId in dataToExport.gpsData) {
                    for (const date in dataToExport.gpsData[athleteId]) {
                        if (Array.isArray(dataToExport.gpsData[athleteId][date])) {
                            dataToExport.gpsData[athleteId][date] = dataToExport.gpsData[athleteId][date]
                                .filter(session => session.tipo_sessione !== 'Individual');
                            
                            if (dataToExport.gpsData[athleteId][date].length === 0) {
                                delete dataToExport.gpsData[athleteId][date];
                            }
                        }
                    }
                    if (Object.keys(dataToExport.gpsData[athleteId]).length === 0) {
                        delete dataToExport.gpsData[athleteId];
                    }
                }
            }
            
            // 5. CREA E SCARICA IL FILE JSON
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const dataSizeKB = (dataStr.length / 1024).toFixed(2);
            console.log('💾 Dimensione backup:', dataSizeKB, 'KB');
            
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `GoSport_Backup_${timestamp}.json`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // 6. MOSTRA CONFERMA
            console.log('✅ Backup completato:', filename);
            const summary = `✅ Backup completato!

File: ${filename}
Dimensione: ${dataSizeKB} KB

Dati esportati:
• Atleti: ${dataToExport._backup_metadata.dataTypes.athletes}
• Valutazioni: ${dataToExport._backup_metadata.dataTypes.evaluations}
• Dati GPS: ${dataToExport._backup_metadata.dataTypes.gpsData}
• Partite: ${dataToExport._backup_metadata.dataTypes.matchResults}
• Pagamenti: ${dataToExport._backup_metadata.dataTypes.pagamenti}
• Convocazioni: ${dataToExport._backup_metadata.dataTypes.convocazioni}
• Post Bacheca: ${dataToExport._backup_metadata.dataTypes.posts}

${!includeIndividual ? '⚠️ Sessioni Individual escluse.' : ''}`;
            
            alert(summary);
            
        } catch (error) {
            console.error('❌ Errore durante il backup:', error);
            alert(`❌ Errore durante il backup:\n\n${error.message}\n\nControlla la console (F12) per maggiori dettagli.`);
        }
    };
    
    // 7. GESTIONE SESSIONI INDIVIDUAL PROTETTE
    const hasIndividualData = Object.values(gpsData).some(ath =>
        Object.values(ath).some(sessions =>
            Array.isArray(sessions) && sessions.some(sess => sess.tiposessione === 'Individual')
        )
    );
    
    if (hasIndividualData && !isAuthenticated) {
        // Chiede autenticazione per includere sessioni Individual
        requestAuthentication(
            () => performDownload(true), // Include Individual se autenticato
            () => {
                // Se cancella autenticazione, chiede se vuole backup senza Individual
                if (confirm('Accesso annullato. Desideri scaricare il backup SENZA le sessioni Individual protette?')) {
                    performDownload(false);
                }
            }
        );
    } else {
        // Scarica tutto (con o senza Individual a seconda dell'autenticazione)
        performDownload(isAuthenticated);
    }
});

    document.getElementById('export-excel-btn').addEventListener('click', async () => {
        try {
            const annataId = sessionStorage.getItem('gosport_current_annata');
            if (!annataId) { alert('⚠️ Errore: Nessuna annata selezionata.'); return; }
            const username = sessionStorage.getItem('gosport_auth_user') || 'admin';
            const role = sessionStorage.getItem('gosport_user_role');
            const societyId = sessionStorage.getItem('gosport_society_id');
            const authSession = sessionStorage.getItem('gosport_session_token');
            const headers = {
                'Content-Type': 'application/json',
                'X-Annata-Id': annataId,
                'X-Auth-Session': authSession || '',
                'X-Auth-User': username,
                'X-User-Role': role || '',
                'X-Society-Id': societyId || ''
            };
            const response = await fetch('/api/data', { method: 'GET', headers });
            if (!response.ok) throw new Error(`Errore caricamento dati: ${response.status}`);
            const d = await response.json();
            const wb = XLSX.utils.book_new();

            // Sheet 1: Atleti
            const atletiRows = (d.athletes || []).map(a => ({
                'Nome': a.name || '',
                'Ruolo': a.role || '',
                'N. Maglia': a.number || '',
                'Email': a.email || '',
                'Telefono': a.phone || '',
                'Capitano': a.isCaptain ? 'SI' : '',
                'Vice Capitano': a.isViceCaptain ? 'SI' : '',
                'Staff': a.isStaff ? 'SI' : '',
                'Scad. Visita': a.scadenzaVisita || '',
                'Scad. Tessera': a.scadenzaTessera || '',
            }));
            if (atletiRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(atletiRows), 'Atleti');

            // Sheet 2: Valutazioni (evaluations[date][athleteId])
            const valRows = [];
            for (const [date, byAthlete] of Object.entries(d.evaluations || {})) {
                for (const [aid, vals] of Object.entries(byAthlete || {})) {
                    const ath = (d.athletes || []).find(a => String(a.id) === String(aid));
                    valRows.push({
                        'Data': date,
                        'Atleta': ath ? ath.name : aid,
                        'Presenza': vals['presenza-allenamento'] ?? '',
                        'Serietà': vals['serieta-allenamento'] ?? '',
                        'Abbig. Allenamento': vals['abbigliamento-allenamento'] ?? '',
                        'Abbig. Partita': vals['abbigliamento-partita'] ?? '',
                        'Comunicazioni': vals['comunicazioni'] ?? '',
                        'Doccia': vals['doccia'] ?? '',
                        'Individual': vals['presenza-individual'] ?? '',
                    });
                }
            }
            valRows.sort((a, b) => (a.Data > b.Data ? -1 : 1));
            if (valRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(valRows), 'Valutazioni');

            // Sheet 3: GPS / Performance (gpsData[athleteId][date] = [sessions])
            const gpsRows = [];
            for (const [aid, dates] of Object.entries(d.gpsData || {})) {
                const ath = (d.athletes || []).find(a => String(a.id) === String(aid));
                const name = ath ? ath.name : aid;
                for (const [date, sessions] of Object.entries(dates || {})) {
                    const arr = Array.isArray(sessions) ? sessions : [sessions];
                    for (const s of arr) {
                        gpsRows.push({
                            'Data': s.data_di_registrazione || date,
                            'Atleta': name,
                            'Tipo': s.tipo_sessione || '',
                            'Distanza (m)': s.distanza_totale || '',
                            'Tempo (min)': s.tempo_totale || '',
                            'Vel. Max (km/h)': s.velocita_massima || '',
                            'Sprint (m)': s.distanza_sprint || '',
                            'N. Sprint': s.numero_di_sprint || '',
                            'Max Acc': s.max_acc || '',
                            'Max Dec': s.max_dec || '',
                            'Gol': s.gol || '',
                            'Assist': s.assist || '',
                            'Note': s.note || '',
                        });
                    }
                }
            }
            gpsRows.sort((a, b) => (a.Data > b.Data ? -1 : 1));
            if (gpsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gpsRows), 'GPS-Performance');

            // Sheet 4: Partite
            const partiteRows = [];
            for (const [, m] of Object.entries(d.matchResults || {})) {
                partiteRows.push({
                    'Data': m.date || '',
                    'Ora': m.time || '',
                    'Avversario': m.opponentName || '',
                    'Casa/Trasferta': m.location === 'home' ? 'Casa' : 'Trasferta',
                    'Gol Nostri': m.homeScore ?? (m.location === 'home' ? m.myTeamScore : m.opponentScore) ?? '',
                    'Gol Avversari': m.awayScore ?? (m.location === 'away' ? m.myTeamScore : m.opponentScore) ?? '',
                    'Luogo': m.venue || '',
                });
            }
            partiteRows.sort((a, b) => (a.Data > b.Data ? -1 : 1));
            if (partiteRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partiteRows), 'Partite');

            // Sheet 5: Sessioni calendario (trainingSessions[date] = [sessions])
            const sessioniRows = [];
            for (const [date, arr] of Object.entries(d.trainingSessions || {})) {
                const list = Array.isArray(arr) ? arr : [arr];
                for (const s of list) {
                    sessioniRows.push({
                        'Data': s.date || date,
                        'Tipo': s.type || '',
                        'Titolo': s.title || '',
                        'Ora': s.time || '',
                        'Luogo': s.location || '',
                        'Obiettivi': s.goals || '',
                        'Note': s.note || '',
                    });
                }
            }
            sessioniRows.sort((a, b) => (a.Data > b.Data ? -1 : 1));
            if (sessioniRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessioniRows), 'Sessioni');

            // Helper: nome atleta da id (usato dai fogli sotto)
            const _athName = (id) => {
                const a = (d.athletes || []).find(x => String(x.id) === String(id));
                return a ? a.name : String(id);
            };

            // Sheet 6: Pagamenti — pagamenti[athleteId][voce] = {base, discount, installments:[{amount,dueDate,paid}]}
            const pagRows = [];
            const pagLabels = d.pagLabels || {};
            for (const [aid, voci] of Object.entries(d.pagamenti || {})) {
                for (const [voce, dett] of Object.entries(voci || {})) {
                    if (!dett || typeof dett !== 'object') continue;
                    const rate = Array.isArray(dett.installments) ? dett.installments : [];
                    if (rate.length === 0) {
                        pagRows.push({
                            'Atleta': _athName(aid),
                            'Voce': pagLabels[voce] || voce,
                            'Importo Base (€)': dett.base ?? '',
                            'Sconto': dett.discount ? `${dett.discount}${dett.discountType === 'percent' ? '%' : '€'}` : '',
                            'Rata': '', 'Importo Rata (€)': '', 'Scadenza': '', 'Pagata': ''
                        });
                    } else {
                        rate.forEach((r, ri) => {
                            pagRows.push({
                                'Atleta': _athName(aid),
                                'Voce': pagLabels[voce] || voce,
                                'Importo Base (€)': dett.base ?? '',
                                'Sconto': dett.discount ? `${dett.discount}${dett.discountType === 'percent' ? '%' : '€'}` : '',
                                'Rata': ri + 1,
                                'Importo Rata (€)': r.amount ?? '',
                                'Scadenza': r.dueDate || '',
                                'Pagata': r.paid ? 'SI' : 'NO'
                            });
                        });
                    }
                }
            }
            if (pagRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagRows), 'Pagamenti');

            // Sheet 7: Materiale — materiale.assignments[athleteId][itemId] = {status, qty, taglia, nota}
            const matItems = (d.materiale && Array.isArray(d.materiale.items)) ? d.materiale.items : [];
            const matItemTitle = (id) => {
                const it = matItems.find(x => String(x.id) === String(id));
                return it ? (it.title || it.id) : String(id);
            };
            const matRows = [];
            const matAssign = (d.materiale && d.materiale.assignments) ? d.materiale.assignments : {};
            for (const [aid, items] of Object.entries(matAssign)) {
                for (const [itemId, entry] of Object.entries(items || {})) {
                    if (itemId === '_numero') continue; // campo speciale (numero maglia)
                    if (!entry || typeof entry !== 'object') continue;
                    matRows.push({
                        'Atleta': _athName(aid),
                        'Materiale': matItemTitle(itemId),
                        'Stato': entry.status || '',
                        'Quantità': entry.qty ?? '',
                        'Taglia': entry.taglia || '',
                        'Note': entry.nota || ''
                    });
                }
            }
            if (matRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matRows), 'Materiale');

            // Sheet 8: Convocazioni — array di {data, tipo, avversario, luogo, ritrovo, inizio, categoria, note, atletiIds, staffIds}
            const convRows = (d.convocazioni || []).map(c => ({
                'Data': c.data || '',
                'Tipo': c.tipo || '',
                'Avversario': c.avversario || '',
                'Categoria': c.categoria || '',
                'Luogo': c.luogo || '',
                'Ritrovo': c.ritrovo || '',
                'Inizio': c.inizio || '',
                'N. Convocati': Array.isArray(c.atletiIds) ? c.atletiIds.length : '',
                'Convocati': Array.isArray(c.atletiIds) ? c.atletiIds.map(_athName).join(', ') : '',
                'Note': c.note || ''
            }));
            convRows.sort((a, b) => (a.Data > b.Data ? -1 : 1));
            if (convRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(convRows), 'Convocazioni');

            // Sheet 9: Hall of Fame / Premi — awards[athleteId] o awards[id] = {reason, date,...}
            const awardRows = [];
            for (const [key, aw] of Object.entries(d.awards || {})) {
                const list = Array.isArray(aw) ? aw : [aw];
                list.forEach(a => {
                    if (!a || typeof a !== 'object') return;
                    awardRows.push({
                        'Atleta': _athName(a.athleteId || key),
                        'Motivazione': a.reason || '',
                        'Data': a.date || ''
                    });
                });
            }
            if (awardRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(awardRows), 'Hall of Fame');

            if (wb.SheetNames.length === 0) { alert('⚠️ Nessun dato da esportare.'); return; }

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `GoSport_Backup_${timestamp}.xlsx`;
            XLSX.writeFile(wb, filename);
            alert(`✅ Backup Excel completato!\n\nFile: ${filename}\nFogli: ${wb.SheetNames.join(', ')}`);
        } catch (e) {
            console.error('❌ Errore backup Excel:', e);
            alert('❌ Errore durante il backup Excel:\n\n' + e.message);
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
                        // Aggiorna variabili globali
                        athletes = importedData.athletes || [];
                        if (importedData.ratingSheets && window._appData) {
                            window._appData.ratingSheets = importedData.ratingSheets;
                        }
                        evaluations = importedData.evaluations || {};
                        gpsData = importedData.gpsData || {};
                        awards = importedData.awards || {};
                        trainingSessions = importedData.trainingSessions || {};
                        formationData = importedData.formationData || { starters: [], bench: [], tokens: [] };
                        matchResults = importedData.matchResults || {};
                        // ── BANNER SPONSOR (aggiunto v1.5.16) ───────────────────────────
            // bachecaConfig non è nel GET con annataId → fetch separata globale
            if (!window._bannerShown) {
                try {
                    var xhrBanner = new XMLHttpRequest();
                    xhrBanner.open('GET', '/api/data', true); // senza X-Annata-Id = risposta globale
                    xhrBanner.onload = function() {
                        try {
                            var bd = JSON.parse(xhrBanner.responseText);
                            var spCfg = (bd && bd.bachecaConfig) || {};
                            var saB = (bd && bd.superadminBanners) || {};
                            var allSlots = _buildBannerSlots(saB, spCfg);
                            if (allSlots.length > 0) _showSponsorBannerOverlay(allSlots);
                        } catch(e) { console.warn('[Banner] parse err:', e); }
                    };
                    xhrBanner.send();
                } catch(e) { console.warn('[Banner] fetch err:', e); }
            }
            // ── FINE BANNER SPONSOR ──────────────────────────────────────────

            athletes.forEach(athlete => {
                            if (athlete.isViceCaptain === undefined) athlete.isViceCaptain = false;
                            if (athlete.isGuest === undefined) athlete.isGuest = false;
                        });
                        migrateGpsData();

                        // Annata corrente
                        const restoreAnnataId = sessionStorage.getItem('gosport_current_annata')
                            || localStorage.getItem('currentAnnata') || '';
                        if (!restoreAnnataId) {
                            alert('❌ Errore: nessuna annata selezionata. Seleziona un\'annata prima di ripristinare.');
                            return;
                        }

                        // Payload completo — tutti i campi inclusi nuovi
                        const fullPayload = {
                            athletes,
                            evaluations,
                            gpsData,
                            awards,
                            trainingSessions,
                            formationData,
                            matchResults,
                            calendarEvents:    importedData.calendarEvents    || {},
                            calendarResponses: importedData.calendarResponses || {},
                            materiale:         importedData.materiale         || { items: [], assignments: {} },
                            pagamenti:         importedData.pagamenti         || {},
                            pagVoci:           importedData.pagVoci           ?? null,
                            pagLabels:         importedData.pagLabels         ?? null,
                            convocazioni:      importedData.convocazioni      || [],
                            convSettings:      importedData.convSettings      || {},
                            posts:             importedData.posts             || [],
                            globalPosts:       importedData.globalPosts       || [],
                            ratingSheets:      importedData.ratingSheets      || {},
                            documents:         importedData.documents         || []
                        };

                        console.log('[RESTORE] Annata:', restoreAnnataId, 'Atleti:', athletes.length);

                        fetch('/api/data', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Annata-Id': restoreAnnataId
                            },
                            body: JSON.stringify(fullPayload)
                        }).then(function(res) {
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            updateAllUI();
                            alert('✅ Ripristino completato!\n\nAnnata: ' + restoreAnnataId + '\nAtleti: ' + athletes.length + '\nTutti i dati sono stati ripristinati.');
                        }).catch(function(err) {
                            console.error('[RESTORE] Errore:', err);
                            alert('❌ Errore durante il ripristino: ' + err.message + '\n\nControlla la console (F12).');
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
    let isTouchDrag = false;
    let lastTouchPos = { x: 0, y: 0 };
    let dragStarted = false;
    let startPos = { x: 0, y: 0 };
    const DRAG_THRESHOLD = 6; // px minimi per avviare il drag
    
    // Rileva se il campo è ruotato (desktop) o no (mobile)
    function isFieldRotated() {
        const field = document.getElementById('field-container');
        if (!field) return false;
        const style = window.getComputedStyle(field);
        const transform = style.transform || style.webkitTransform;
        if (!transform || transform === 'none') return false;
        const match = transform.match(/^matrix\((.+)\)$/);
        if (!match) return false;
        const values = match[1].split(',').map(Number);
        return Math.abs(values[0]) < 0.1;
    }

    function getPointerPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    function onPointerDown(e) {
        const target = e.target.closest('.player-jersey, .available-player, .tool-item, .token');
        if (!target || target.classList.contains('disabled')) return;
        
        isTouchDrag = (e.type === 'touchstart');
        if (!isTouchDrag && e.button !== 0) return;
        
        // NON fare preventDefault qui — lascia lo scroll libero finché non si supera la soglia
        draggedEl = target;
        dragStarted = false;
        const pos = getPointerPos(e);
        startPos = { x: pos.x, y: pos.y };
        lastTouchPos = { x: pos.x, y: pos.y };
        
        const rect = draggedEl.getBoundingClientRect();
        offsetX = pos.x - rect.left;
        offsetY = pos.y - rect.top;

        if (isTouchDrag) {
            document.addEventListener('touchmove', onPointerMove, { passive: false });
            document.addEventListener('touchend', onPointerUp);
            document.addEventListener('touchcancel', onPointerUp);
        } else {
            e.preventDefault();
            document.addEventListener('mousemove', onPointerMove);
            document.addEventListener('mouseup', onPointerUp);
        }
    }
    
    function onPointerMove(e) {
        if (!draggedEl) return;
        const pos = getPointerPos(e);
        lastTouchPos = { x: pos.x, y: pos.y };
        
        if (!dragStarted) {
            const dx = pos.x - startPos.x;
            const dy = pos.y - startPos.y;
            if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
            
            // Soglia superata → inizia il drag vero
            dragStarted = true;
            
            if (draggedEl.classList.contains('available-player')) {
                const athleteId = draggedEl.dataset.athleteId;
                const athlete = athletes.find(a => String(a.id) === athleteId);
                if (!athlete) { cleanUpDrag(); return; }
                dragGhost = createJerseyElement(athlete);
            } else {
                dragGhost = draggedEl.cloneNode(true);
            }
            dragGhost.classList.add('dragging');
            dragGhost.style.position = 'fixed';
            dragGhost.style.zIndex = '9999';
            dragGhost.style.pointerEvents = 'none';
            dragGhost.style.touchAction = 'none';
            document.body.appendChild(dragGhost);
        }
        
        // Solo se il drag è partito, blocca lo scroll
        if (dragStarted && dragGhost) {
            e.preventDefault();
            dragGhost.style.left = `${pos.x - offsetX}px`;
            dragGhost.style.top = `${pos.y - offsetY}px`;
        }
    }
    
    function onPointerUp(e) {
        if (!draggedEl) { cleanUpDrag(); return; }
        
        // Se non abbiamo mai iniziato il drag (era un tap), ignora
        if (!dragStarted || !dragGhost) { cleanUpDrag(); return; }
        
        dragGhost.style.display = 'none';
        const pos = (e.type === 'touchend' || e.type === 'touchcancel') ? lastTouchPos : getPointerPos(e);
        const dropTarget = document.elementFromPoint(pos.x, pos.y);
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
            const mouseX = pos.x - rect.left;
            const mouseY = pos.y - rect.top;
            const normalizedX = mouseX / rect.width;
            const normalizedY = mouseY / rect.height;
            
            let left, top;
            if (isFieldRotated()) {
                // Desktop: campo ruotato 90° → (x,y) → (y, 1-x)
                left = normalizedY * 100;
                top = (1 - normalizedX) * 100;
            } else {
                // Mobile: campo dritto → coordinate dirette
                left = normalizedX * 100;
                top = normalizedY * 100;
            }
            
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
        if (dragGhost) dragGhost.remove();
        draggedEl = null;
        dragGhost = null;
        isTouchDrag = false;
        dragStarted = false;
        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('touchend', onPointerUp);
        document.removeEventListener('touchcancel', onPointerUp);
    };
    const formSection = document.getElementById('formazione-section');
    if (formSection) {
        formSection.addEventListener('mousedown', onPointerDown);
        formSection.addEventListener('touchstart', onPointerDown, { passive: false });
    }
    // ==========================================
    // SISTEMA DI STAMPA OTTIMIZZATO (DEFINITIVO)
    // ==========================================
    const PRINT_CHART_WRAPPERS = [
        'trend-chart-wrapper', 'radar-chart-wrapper',
        'performance-chart-wrapper', 'multi-athlete-chart-wrapper'
    ];

    function applyPrintColorsToChart(chart) {
        if (!chart || !chart.options) return;
        if (chart.options.scales) {
            Object.values(chart.options.scales).forEach(scale => {
                if (scale.ticks) scale.ticks.color = '#000000';
                if (scale.pointLabels) scale.pointLabels.color = '#000000';
                if (scale.grid) scale.grid.color = '#888888';
                if (scale.angleLines) scale.angleLines.color = '#888888';
                if (scale.title) scale.title.color = '#000000';
            });
        }
        if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = '#000000';
        if (chart.options.plugins?.title) chart.options.plugins.title.color = '#000000';
        chart.update('none');
    }

    function convertAllPrintingCharts() {
        const sections = document.querySelectorAll('.printing-now');
        sections.forEach(section => {
            // padding-top via @page margin in CSS, non più via JS
            // (per evitare spazio fantasma sulle pagine successive)
            const canvases = section.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                const chartKey = canvas.id.replace(/Chart$/, '');
                const chart = window.chartInstances && window.chartInstances[chartKey];
                if (chart) {
                    applyPrintColorsToChart(chart);
                    if (typeof chart.render === 'function') chart.render();
                }
                // Forza dimensioni del wrapper e overflow per non uscire dal foglio
                let wrapper = canvas.parentElement;
                while (wrapper && wrapper !== section) {
                    if (!wrapper.dataset.origCss) {
                        wrapper.dataset.origCss = wrapper.style.cssText || '';
                    }
                    wrapper.style.setProperty('overflow', 'visible', 'important');
                    wrapper.style.setProperty('min-width', '0', 'important');
                    wrapper.style.setProperty('max-width', '100%', 'important');
                    wrapper.style.setProperty('width', '100%', 'important');
                    wrapper = wrapper.parentElement;
                }
                // Forza canvas a max-width 100%
                if (!canvas.dataset.origStyle) canvas.dataset.origStyle = canvas.style.cssText || '';
                canvas.style.setProperty('max-width', '100%', 'important');
                canvas.style.setProperty('width', '100%', 'important');
                canvas.style.setProperty('height', 'auto', 'important');
                console.log('[STAMPA] preparato:', canvas.id);
            });
        });
    }

    function restoreAfterPrint() {
        // v1.5.7: rimuovi classi landscape per Materiali/Pagamenti
        document.body.classList.remove('print-landscape', 'print-landscape-mat', 'print-landscape-pag');
        document.documentElement.style.removeProperty('--print-table-fs');

        // Ripristina stili originali wrapper e canvas
        document.querySelectorAll('[data-orig-css]').forEach(el => {
            el.style.cssText = el.dataset.origCss || '';
            delete el.dataset.origCss;
        });
        document.querySelectorAll('canvas[data-orig-style]').forEach(c => {
            c.style.cssText = c.dataset.origStyle || '';
            delete c.dataset.origStyle;
        });
        // Rimuovi classi e stili di stampa
        document.querySelectorAll('.tab-section').forEach(el => {
            el.classList.remove('printing-now');
            el.style.removeProperty('padding-top');
        });
        // Gestisci confronto-squadra-section in base al tab attivo
        const confronto = document.getElementById('confronto-squadra-section');
        if (confronto) {
            confronto.classList.remove('printing-now');
            const currentTab = document.querySelector('.tab-section.tab-active');
            const isGpsActive = currentTab && currentTab.id === 'monitoraggio-gps-section';
            if (isGpsActive && window.innerWidth >= 992) {
                confronto.style.setProperty('display', 'block', 'important');
            } else {
                confronto.style.setProperty('display', 'none', 'important');
            }
        }
        // Ripristina i colori originali ai chart (non distrutti, solo modificati)
        setTimeout(() => {
            try {
                if (window.updateAthleteTrendChart) window.updateAthleteTrendChart();
                if (window.updateAthleteRadarChart) window.updateAthleteRadarChart();
                if (window.updatePerformanceChart) window.updatePerformanceChart();
                if (window.updateMultiAthleteChart) window.updateMultiAthleteChart();
            } catch (e) { console.warn('[STAMPA] re-render err:', e); }
        }, 150);
    }

    // Listener click pulsante Stampa (gestione unificata)
    document.body.addEventListener('click', (e) => {
        const printBtn = e.target.closest('.print-section-btn');
        if (!printBtn) return;
        const sectionToPrint = printBtn.closest('.printable-area') || printBtn.closest('.tab-section');
        if (!sectionToPrint) return;

        // v1.5.11: Pagamenti -> finestra di stampa dedicata (sempre landscape, niente bug @page)
        if (sectionToPrint.id === 'pagamenti-section') {
            if (typeof window.printPagamentiDedicato === 'function') {
                window.printPagamentiDedicato();
                return;
            }
        }
        // v1.5.12: Materiali -> finestra di stampa dedicata (stesso pattern)
        if (sectionToPrint.id === 'materiale-section') {
            if (typeof window.printMaterialiDedicato === 'function') {
                window.printMaterialiDedicato();
                return;
            }
        }

        // Reset stato precedente
        document.querySelectorAll('.printing-now').forEach(el => el.classList.remove('printing-now'));
        document.querySelectorAll('.tab-section').forEach(el => el.style.removeProperty('display'));

        const gps = document.getElementById('monitoraggio-gps-section');
        const confronto = document.getElementById('confronto-squadra-section');
        // Se stampo da GPS o Confronto, stampo ENTRAMBI
        const isGpsContext = (sectionToPrint === gps || sectionToPrint === confronto ||
                              printBtn.closest('#monitoraggio-gps-section, #confronto-squadra-section'));

        if (isGpsContext && gps && confronto) {
            gps.classList.add('printing-now');
            confronto.classList.add('printing-now');
            confronto.style.setProperty('display', 'block', 'important');
        } else {
            sectionToPrint.classList.add('printing-now');
        }

        // v1.5.9: Materiali/Pagamenti -> A4 landscape per non tagliare colonne
        // Approccio: classe sul <body> + CSS statico in fondo al file
        var sectId = sectionToPrint.id || (sectionToPrint.closest('[id]') || {}).id || '';
        document.body.classList.remove('print-landscape', 'print-landscape-mat', 'print-landscape-pag');
        if (sectId === 'materiale-section') {
            document.body.classList.add('print-landscape', 'print-landscape-mat');
        } else if (sectId === 'pagamenti-section') {
            document.body.classList.add('print-landscape', 'print-landscape-pag');
        }
        // Scaling font in base al numero di colonne (per Materiali serve piu'
        // aggressivo: ogni colonna contiene 2 widget impilati, e le scritte
        // sono lunghe come "Pantaloncino Riscaldamento")
        if (document.body.classList.contains('print-landscape')) {
            var allTables = sectionToPrint.querySelectorAll('table');
            var maxCols = 4;
            allTables.forEach(function(t) {
                var hr = t.querySelector('thead tr');
                if (hr) maxCols = Math.max(maxCols, hr.children.length);
            });
            // Scaling piu' aggressivo per Materiali (sectId === 'materiale-section')
            var fontPt;
            if (sectId === 'materiale-section') {
                // Materiali: header lunghi + 2 widget per cella = serve font piccolo
                fontPt = maxCols <= 5 ? 8 : (maxCols <= 7 ? 7 : (maxCols <= 9 ? 6 : (maxCols <= 11 ? 5.5 : 5)));
            } else {
                // Pagamenti: testo corto, fitting facile
                fontPt = maxCols <= 6 ? 9 : (maxCols <= 10 ? 8 : (maxCols <= 14 ? 7 : 6));
            }
            document.documentElement.style.setProperty('--print-table-fs', fontPt + 'pt');
            console.log('[STAMPA] landscape attivo, sezione=' + sectId + ', ' + maxCols + ' colonne max, font ' + fontPt + 'pt');
        }

        // Converti TUTTI i canvas trovati nelle sezioni printing-now
        // Aspetta 2 frame per dare tempo a Chart.js di renderizzare prima della cattura
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                convertAllPrintingCharts();
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    window.print();
                }, 100);
            });
        });
    });

    // beforeprint VUOTO per evitare conflitti con il click handler
    // Se la stampa parte da Ctrl+P, gestiamo qui anche se senza pulsante
    window.addEventListener('beforeprint', () => {
        // Se nessuna sezione ha printing-now (Ctrl+P), marca quella attiva e converti
        const alreadyPrinting = document.querySelector('.printing-now');
        if (alreadyPrinting) return; // Click handler ha già preparato tutto
        const activeTab = document.querySelector('.tab-section.tab-active');
        if (activeTab) {
            activeTab.classList.add('printing-now');
            convertAllPrintingCharts();
        }
    });

    window.addEventListener('afterprint', restoreAfterPrint);


    const openMatchResultModal = (matchId = null) => {
        elements.matchResultForm.reset();
        document.getElementById('scorers-container').innerHTML = '';
        document.getElementById('assists-container').innerHTML = '';
        document.getElementById('cards-container').innerHTML = '';
        // Mostra il nome reale della squadra al posto del vecchio "GO Sport" fisso
        var _mt = getMyTeamName();
        ['match-myteam-label','match-scorers-team','match-assists-team','match-cards-team'].forEach(function(id){
            var el = document.getElementById(id); if (el) el.textContent = _mt;
        });
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
        div.innerHTML = `<select class="form-select form-select-sm scorer-athlete" required><option value="">Seleziona atleta...</option>${athletes.map(a => `<option value="${a.id}" ${scorer.athleteId == a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select><input type="number" class="form-control form-control-sm scorer-minute" placeholder="Min" min="1" style="width: 80px;" value="${scorer.minute || ''}" required><button type="button" class="btn btn-sm btn-outline-danger remove-row-btn"><i class="bi bi-trash"></i></button>`;
        container.appendChild(div);
    };
    const addAssistInput = (assist = {}) => {
        const container = document.getElementById('assists-container');
        const div = document.createElement('div');
        div.className = 'd-flex gap-2 align-items-center';
        div.innerHTML = `<select class="form-select form-select-sm assist-athlete" required><option value="">Seleziona atleta...</option>${athletes.map(a => `<option value="${a.id}" ${assist.athleteId == a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select><input type="number" class="form-control form-control-sm assist-minute" placeholder="Min" min="1" style="width: 80px;" value="${assist.minute || ''}" required><button type="button" class="btn btn-sm btn-outline-danger remove-row-btn"><i class="bi bi-trash"></i></button>`;
        container.appendChild(div);
    };
    const addCardInput = (card = {}) => {
        const container = document.getElementById('cards-container');
        const div = document.createElement('div');
        div.className = 'd-flex gap-2 align-items-center';
        div.innerHTML = `<select class="form-select form-select-sm card-athlete" required><option value="">Seleziona atleta...</option>${athletes.map(a => `<option value="${a.id}" ${card.athleteId == a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select><select class="form-select form-select-sm card-type" style="width: 120px;" required><option value="yellow" ${card.type === 'yellow' ? 'selected' : ''}>Giallo</option><option value="red" ${card.type === 'red' ? 'selected' : ''}>Rosso</option></select><input type="number" class="form-control form-control-sm card-minute" placeholder="Min" min="1" style="width: 80px;" value="${card.minute || ''}" required><button type="button" class="btn btn-sm btn-outline-danger remove-row-btn"><i class="bi bi-trash"></i></button>`;
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
    // Fascia Da–A: ricalcola lista partite, grafico, marcatori/assist e cartellini
    ['risultati-filter-start', 'risultati-filter-end'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            renderMatchResults();
            window.updateMatchResultsFilterDependents();
        });
    });
    function startPolling() {
        // 5 minuti (era 5 sec = 312 comandi Redis/min → troppo costoso su Upstash free tier)
        pollingInterval = setInterval(async () => {
            // Non aggiornare se il tab è in background
            if (document.visibilityState !== 'visible') return;
            const currentDataSnapshot = JSON.stringify({ athletes, evaluations, gpsData, awards, trainingSessions, formationData, matchResults });
            await loadData();
            const newDataSnapshot = JSON.stringify({ athletes, evaluations, gpsData, awards, trainingSessions, formationData, matchResults });
            if (currentDataSnapshot !== newDataSnapshot) {
                console.log("Dati aggiornati dal server. Ricarico l'interfaccia.");
                updateAllUI();
            }
        }, 300000); // 5 minuti
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
    initializeApp().then(() => {
        // Ripristina stato grafici Presenze dopo il caricamento
        if (window.restorePresenzeChartsState) {
            setTimeout(window.restorePresenzeChartsState, 400);
        }
        // FIX v1.5.21: controlla documenti caricati dai genitori
        setTimeout(window._checkPendingAthleteDocs, 2000);
        setTimeout(window._checkPendingAthleteDocs, 6000); // secondo check per sicurezza
    });
});

// ==========================================
// HEADER CON TITOLO ANNATA E PULSANTI RAPIDI
// ==========================================

// ✅ AGGIUNGI QUESTE FUNZIONI GLOBALI ALL'INIZIO
window.handleQuickLogout = function() {
    if (confirm('Vuoi davvero uscire?')) {
        // Pulisci tutto
        sessionStorage.clear();
        localStorage.clear();
        
        // Ricarica la pagina (tornerà al login)
        window.location.href = window.location.origin + window.location.pathname;
    }
};

window.handleQuickChangeAnnata = function() {
    // ✅ Rimuovi l'annata corrente (chiave corretta!)
    sessionStorage.removeItem('gosport_current_annata');
    
    // Ricarica la pagina (mostrerà la selezione annate)
    window.location.reload();
};

// Funzione per aggiornare l'header
function updateAppHeader() {
    // ✅ Non mostrare l'header se non autenticati o senza annata selezionata
    const isAuth = sessionStorage.getItem('gosport_auth_session') === 'true';
    const hasAnnata = !!sessionStorage.getItem('gosport_current_annata');
    if (!isAuth || !hasAnnata) {
        const existing = document.getElementById('app-header-info');
        if (existing) existing.remove();
        return;
    }

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : sessionStorage.getItem('gosport_auth_user');
    const currentAnnataId = window.getCurrentAnnata ? window.getCurrentAnnata() : sessionStorage.getItem('gosport_current_annata');
    const userRole = window.getUserRole ? window.getUserRole() : sessionStorage.getItem('gosport_user_role');
    
    let headerContainer = document.getElementById('app-header-info');
    
    if (!headerContainer) {
        headerContainer = document.createElement('div');
        headerContainer.id = 'app-header-info';
        headerContainer.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            z-index: 1060;
            display: flex;
            gap: 10px;
            align-items: center;
        `;
        document.body.appendChild(headerContainer);
    }
    
    let annataName = 'N/A';
    if (currentAnnataId) {
        fetch('/api/annate/list')
            .then(r => r.json())
            .then(data => {
                const annata = data.annate?.find(a => a.id === currentAnnataId);
                if (annata) {
                    annataName = annata.nome;
                    sessionStorage.setItem('gosport_current_annata_name', annataName);
                    updateHeaderUI(annataName, currentUser, userRole, currentAnnataId);
                }
            })
            .catch(() => {
                annataName = currentAnnataId.substring(0, 8) + '...';
                sessionStorage.setItem('gosport_current_annata_name', annataName);
                updateHeaderUI(annataName, currentUser, userRole, currentAnnataId);
            });
    } else {
        updateHeaderUI(annataName, currentUser, userRole, currentAnnataId);
    }
}

function updateHeaderUI(annataName, currentUser, userRole, currentAnnataId) {
    const headerContainer = document.getElementById('app-header-info');
    if (!headerContainer) return;
    const roleIcon = userRole === 'admin' ? '\u{1F451}' : userRole && userRole.startsWith('dirigente') ? '\u{1F3C5}' : '\u{1F468}\u200d\u{1F3EB}';
    // "Cambia Annata" appare a chi ha 2+ annate assegnate (admin inclusi): chi ne ha
    // una sola non ha nulla da cambiare. Il pulsante nasce nascosto e viene mostrato
    // dopo un fetch che conta le annate disponibili (vedi in fondo alla funzione).
    const canChangeAnnata = true;

    headerContainer.innerHTML = `
        <div style="position:relative;display:inline-block;">
            <button type="button" id="admin-dd-btn"
                onclick="toggleAdminMenu(this)"
                style="background:${document.documentElement.classList.contains('theme-light') ? 'rgba(255,255,255,0.9)' : 'linear-gradient(135deg,var(--bg-panel) 0%,var(--bg-primary) 100%)'};color:${document.documentElement.classList.contains('theme-light') ? '#000103' : 'white'};
                       border:${document.documentElement.classList.contains('theme-light') ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(255,255,255,0.2)'};padding:6px 14px;border-radius:8px;
                       font-weight:600;font-size:14px;cursor:pointer;display:flex;align-items:center;
                       gap:8px;white-space:nowrap;">
                ${roleIcon} ${currentUser || 'Utente'} &#9662;
            </button>
        </div>
    `;

    // Crea il menu fuori dal flusso — position:fixed per evitare overflow
    var existingMenu = document.getElementById('admin-dd-menu');
    if (existingMenu) existingMenu.remove();

    var menu = document.createElement('div');
    menu.id = 'admin-dd-menu';
    var isLightTheme = document.documentElement.classList.contains('theme-light');
    var menuBg = isLightTheme ? '#ffffff' : 'var(--bg-panel)';
    var menuBorder = isLightTheme ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.15)';
    var menuText = isLightTheme ? '#000103' : '#64748b';
    var menuStrong = isLightTheme ? '#000103' : 'white';
    var menuDivider = isLightTheme ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)';
    menu.style.cssText = `display:none;position:fixed;z-index:9999;background:${menuBg};border:${menuBorder};border-radius:10px;min-width:200px;padding:10px;box-shadow:0 8px 24px rgba(0,0,0,0.3);`;
    menu.innerHTML = `
        <div style="font-size:12px;color:${menuText};padding:4px 8px 8px;border-bottom:${menuDivider};margin-bottom:8px;">
            📅 Annata: <strong style="color:${menuStrong};">${annataName}</strong>
        </div>
        ${canChangeAnnata ? `<button type="button" id="admin-dd-change-annata" onclick="window.handleQuickChangeAnnata();closeAdminMenu();"
            style="width:100%;background:linear-gradient(135deg,#8b5cf6,#8b5cf6);color:white;border:none;
                   padding:8px 12px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;
                   margin-bottom:6px;display:none;text-align:left;">
            📅 Cambia Annata
        </button>` : ''}
        <button type="button" onclick="window.openChangePasswordModal();closeAdminMenu();"
            style="width:100%;background:linear-gradient(135deg,#0369a1,#0284c7);color:white;border:none;
                   padding:8px 12px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;
                   margin-bottom:6px;display:block;text-align:left;">
            🔑 Cambia Password
        </button>
        <button type="button" onclick="window.handleQuickLogout();"
            style="width:100%;background:#d90429;color:white;border:none;
                   padding:8px 12px;border-radius:8px;font-weight:600;font-size:13px;
                   cursor:pointer;display:block;text-align:left;">
            🚪 Esci
        </button>
    `;
    document.body.appendChild(menu);

    // "Cambia Annata": mostralo solo se l'utente ha 2+ annate assegnate.
    // /api/annate/list restituisce già le sole annate visibili all'utente (filtrate
    // per società/permessi lato server). Il pulsante nasce nascosto (display:none)
    // e viene mostrato qui se il conteggio è >= 2.
    var changeBtn = document.getElementById('admin-dd-change-annata');
    if (changeBtn) {
        fetch('/api/annate/list')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var list = Array.isArray(data) ? data : (data.annate || []);
                if (list.length >= 2) changeBtn.style.display = 'block';
            })
            .catch(function () { /* in caso di errore lascia nascosto */ });
    }

    // Chiudi cliccando fuori
    document.addEventListener('click', function onClickOutside(e) {
        var btn = document.getElementById('admin-dd-btn');
        var m   = document.getElementById('admin-dd-menu');
        if (m && btn && !btn.contains(e.target) && !m.contains(e.target)) {
            m.style.display = 'none';
        }
    });
}

function toggleAdminMenu(btn) {
    var menu = document.getElementById('admin-dd-menu');
    if (!menu) return;
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
        return;
    }
    // Posiziona il menu sotto il pulsante, allineato a destra
    var rect = btn.getBoundingClientRect();
    var menuW = 210;
    var left  = Math.max(8, Math.min(rect.right - menuW, window.innerWidth - menuW - 8));
    menu.style.top  = (rect.bottom + 6) + 'px';
    menu.style.left = left + 'px';
    menu.style.display = 'block';
}

function closeAdminMenu() {
    var m = document.getElementById('admin-dd-menu');
    if (m) m.style.display = 'none';
}

// ── Cambio Password self-service ──────────────────────────────
window.openChangePasswordModal = function() {
    var modal = document.getElementById('changePasswordModal');
    if (!modal) return;
    // Reset campi e messaggi
    ['chpwd-current', 'chpwd-new', 'chpwd-confirm'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('chpwd-error').style.display   = 'none';
    document.getElementById('chpwd-success').style.display = 'none';
    var btn = document.getElementById('chpwd-submit-btn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-shield-lock-fill"></i> Aggiorna Password'; }
    var bsModal = bootstrap.Modal.getOrCreateInstance(modal);
    bsModal.show();
};

window.submitChangePassword = async function() {
    var currentPwd  = (document.getElementById('chpwd-current')?.value  || '').trim();
    var newPwd      = (document.getElementById('chpwd-new')?.value      || '').trim();
    var confirmPwd  = (document.getElementById('chpwd-confirm')?.value  || '').trim();
    var errEl       = document.getElementById('chpwd-error');
    var okEl        = document.getElementById('chpwd-success');
    var btn         = document.getElementById('chpwd-submit-btn');

    var showErr = function(msg) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
        okEl.style.display = 'none';
    };

    errEl.style.display = 'none';
    okEl.style.display  = 'none';

    if (!currentPwd || !newPwd || !confirmPwd) return showErr('Compila tutti i campi.');
    if (newPwd.length < 6)                      return showErr('La nuova password deve avere almeno 6 caratteri.');
    if (newPwd !== confirmPwd)                   return showErr('Le due password non coincidono.');
    if (newPwd === currentPwd)                   return showErr('La nuova password deve essere diversa da quella attuale.');

    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Aggiornamento...';

    try {
        var sessionToken = sessionStorage.getItem('gosport_session_token') || '';
        var response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Session': sessionToken
            },
            body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd })
        });
        var data = await response.json();
        if (data.success) {
            okEl.textContent = '✅ ' + data.message;
            okEl.style.display = 'block';
            errEl.style.display = 'none';
            btn.innerHTML = '✅ Aggiornata';
            // Chiudi automaticamente dopo 2 secondi
            setTimeout(function() {
                var modal = document.getElementById('changePasswordModal');
                if (modal) bootstrap.Modal.getInstance(modal)?.hide();
            }, 2000);
        } else {
            showErr('⚠️ ' + data.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-shield-lock-fill"></i> Aggiorna Password';
        }
    } catch(e) {
        showErr('⚠️ Errore di rete. Riprova.');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-shield-lock-fill"></i> Aggiorna Password';
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAppHeader);
} else {
    updateAppHeader();
}

if (typeof updateAllUI !== 'undefined') {
    const originalUpdateAllUI = updateAllUI;
    updateAllUI = function() {
        originalUpdateAllUI.apply(this, arguments);
        updateAppHeader();
    };
}
//

// ==========================================
// PANNELLO VALUTAZIONE MOBILE - FIXED FULLSCREEN
// ==========================================
function showMobileEvalPanel(athleteName, athleteId, date) {
    const existing = document.getElementById('mobile-eval-panel');
    if (existing) existing.remove();

    const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
        day: 'numeric', month: 'short'
    });

    const existingEval = {};
    document.querySelectorAll('#evaluation-form select').forEach(sel => {
        existingEval[sel.id] = sel.value;
    });
    const awardChecked = document.getElementById('award-checkbox')?.checked || false;

    const categories = [
        { id: 'presenza-allenamento', label: 'Presenza & Puntualità', hasNegative: true },
        { id: 'serieta-allenamento', label: 'Serietà All.', hasNegative: false },
        { id: 'abbigliamento-allenamento', label: 'Abbig. All.', hasNegative: false },
        { id: 'abbigliamento-partita', label: 'Abbig. Partita', hasNegative: false },
        { id: 'comunicazioni', label: 'Comunicazioni', hasNegative: false },
        { id: 'doccia', label: 'Doccia', hasNegative: false }
    ];

    let rowsHTML = '';
    categories.forEach(cat => {
        const val = existingEval[cat.id] || '0';
        const options = cat.hasNegative
            ? ['-1:Ass. Giust.','0:0-NV','1:1-B','2:2-M','3:3-A']
            : ['0:0-NV','1:1-B','2:2-M','3:3-A'];
        const optHTML = options.map(o => {
            const [v, l] = o.split(':');
            return `<option value="${v}"${v===val?' selected':''}>${l}</option>`;
        }).join('');
        rowsHTML += `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #64748b">
                <span style="font-size:0.85rem;color:var(--text-primary)">${cat.label}</span>
                <select id="mob-${cat.id}" style="width:130px;padding:5px 8px;border-radius:6px;border:1px solid #64748b;background:var(--bg-primary);color:white;font-size:0.88rem">${optHTML}</select>
            </div>`;
    });

    // Riga Presenza Individual
    const indCurVal = existingEval['presenza-individual'] !== undefined ? String(existingEval['presenza-individual']) : '';
    rowsHTML += `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #64748b">
            <span style="font-size:0.85rem;color:#60a5fa;font-weight:600">🏋️ Presenza Individual</span>
            <select id="mob-presenza-individual" style="width:130px;padding:5px 8px;border-radius:6px;border:1px solid #64748b;background:var(--bg-primary);color:white;font-size:0.88rem">
                <option value=""${indCurVal===''?' selected':''}>— N/A —</option>
                <option value="0"${indCurVal==='0'?' selected':''}>0 — Assente</option>
                <option value="1"${indCurVal==='1'?' selected':''}>1 — Presente</option>
                <option value="s"${indCurVal==='s'?' selected':''}>Soc. — Non Fruita</option>
            </select>
        </div>`;

    // Overlay scuro dietro
    const overlay = document.createElement('div');
    overlay.id = 'mobile-eval-panel';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';

    // Card centrata (NON fullscreen)
    overlay.innerHTML = `
        <div style="background:var(--bg-panel);border-radius:12px;width:100%;max-width:420px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.8)">
            
            <div style="background:#3b82f6;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-radius:12px 12px 0 0">
                <span style="font-weight:700;color:white;font-size:0.95rem">
                    ${athleteName}
                    <span style="font-weight:400;font-size:0.78rem;color:#60a5fa;margin-left:6px">${dateFormatted}</span>
                </span>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button onclick="document.getElementById('mobile-eval-panel').style.display='none';window.openInfortuniModal('${athleteId}');" title="Infortuni" style="background:rgba(220,38,38,0.75);border:none;color:white;padding:4px 9px;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;white-space:nowrap;">🩹 Infortuni</button>
                    <button id="mobile-eval-close" style="background:rgba(0,0,0,0.3);border:none;color:white;width:28px;height:28px;border-radius:50%;font-size:0.9rem;cursor:pointer;line-height:1">✕</button>
                </div>
            </div>

            <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 14px 0 14px;min-height:0">
                ${rowsHTML}
                <div style="display:flex;align-items:center;padding:8px 0">
                    <input type="checkbox" id="mob-award-checkbox" ${awardChecked?'checked':''} style="width:18px;height:18px;accent-color:#f59e0b;margin-right:8px;cursor:pointer">
                    <label for="mob-award-checkbox" style="color:#f59e0b;font-weight:600;font-size:0.88rem;cursor:pointer">🏆 Assegna Premio</label>
                </div>
            </div>

            <div style="background:#3b82f6;padding:10px 14px;display:flex;gap:8px;flex-shrink:0;border-radius:0 0 12px 12px">
                <button id="mob-eval-delete" style="background:#d90429;color:white;border:none;width:40px;height:40px;border-radius:8px;cursor:pointer;font-size:1rem;flex-shrink:0">🗑</button>
                <button id="mob-eval-cancel" style="flex:1;background:#64748b;color:white;border:none;height:40px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.9rem">Chiudi</button>
                <button id="mob-eval-save" style="flex:2;background:#16a34a;color:white;border:none;height:40px;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.95rem">✅ Salva</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const closePanel = () => { overlay.remove(); document.body.style.overflow = ''; };

    // Chiudi cliccando fuori dalla card
    overlay.onclick = (e) => { if (e.target === overlay) closePanel(); };
    overlay.querySelector('#mobile-eval-close').onclick = closePanel;
    overlay.querySelector('#mob-eval-cancel').onclick = closePanel;

    overlay.querySelector('#mob-eval-delete').onclick = () => {
        if (confirm('Eliminare i dati di valutazione per questo giorno?')) {
            document.getElementById('modal-athlete-id-eval').value = athleteId;
            document.getElementById('delete-single-athlete-day-btn').click();
            closePanel();
        }
    };

    overlay.querySelector('#mob-eval-save').onclick = () => {
        categories.forEach(cat => {
            const s = overlay.querySelector('#mob-' + cat.id);
            const o = document.getElementById(cat.id);
            if (s && o) o.value = s.value;
        });
        // Sync presenza-individual
        const mobInd = overlay.querySelector('#mob-presenza-individual');
        const origInd = document.getElementById('presenza-individual');
        if (mobInd && origInd) origInd.value = mobInd.value;
        const ma = overlay.querySelector('#mob-award-checkbox');
        const oa = document.getElementById('award-checkbox');
        if (ma && oa) oa.checked = ma.checked;
        const form = document.getElementById('evaluation-form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        closePanel();
    };
}

// ============================================================
// STAMPA DEDICATA PAGAMENTI (v1.5.11)
// Apre una finestra dedicata con HTML pulito + @page A4 landscape.
// Risolve il bug del browser sull'orientamento misto delle pagine
// con @page nominate (la 2a pagina tornava portrait).
// ============================================================
window.printPagamentiDedicato = function() {
    var tA = document.getElementById('pag-table-atleti');
    var tS = document.getElementById('pag-table-staff');
    if (!tA || !tS) { alert('Tabelle pagamenti non trovate.'); return; }

    var teamName = (window._appData && window._appData.teamName) || 'La mia squadra';
    var dataStampa = new Date().toLocaleDateString('it-IT');

    // Funzione per estrarre HTML "pulito" da una tabella (rimuove pulsanti, sticky, colori scuri)
    function cleanTable(tableEl, titoloSezione, count) {
        if (!tableEl || !tableEl.innerHTML.trim()) return '';
        // Clone profondo per non toccare il DOM live
        var clone = tableEl.cloneNode(true);
        // Rimuove pulsanti "Modifica" e elementi .no-print
        clone.querySelectorAll('button, .no-print').forEach(function(el){ el.remove(); });
        // Rimuove TUTTI gli stili inline (rendono il dark-theme nei colori, sticky pos ecc.)
        clone.querySelectorAll('[style]').forEach(function(el){ el.removeAttribute('style'); });
        // Rimuove le classi che danno background scuri
        clone.querySelectorAll('tr,td,th').forEach(function(el){
            el.removeAttribute('class');
        });
        return ''
            + '<h2 class="section-title">' + titoloSezione + (count ? ' <span class="count">(' + count + ')</span>' : '') + '</h2>'
            + '<div class="table-wrap">' + clone.outerHTML + '</div>';
    }

    var nAtleti = (tA.querySelectorAll('tbody tr')||[]).length;
    var nStaff  = (tS.querySelectorAll('tbody tr')||[]).length;
    // Conta colonne max per scaling font
    var maxCols = 4;
    [tA, tS].forEach(function(t) {
        var hr = t.querySelector('thead tr');
        if (hr) maxCols = Math.max(maxCols, hr.children.length);
    });
    var fontPt = maxCols <= 6 ? 9 : (maxCols <= 10 ? 8 : (maxCols <= 14 ? 7 : 6));

    var html = ''
        + '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">'
        + '<title>Pagamenti — ' + teamName + ' — ' + dataStampa + '</title>'
        + '<style>'
        + '@page { size: A4 landscape; margin: 8mm 10mm; }'
        + '* { box-sizing: border-box; }'
        + 'body { font-family: "Segoe UI", system-ui, Arial, sans-serif; color:#000; margin:0; padding:0; background:#fff; font-size: ' + fontPt + 'pt; }'
        + 'h1 { font-size: 16pt; margin: 0 0 2mm 0; color:#1e3a5f; border-bottom: 2px solid #d90429; padding-bottom: 2mm; }'
        + 'h2.section-title { font-size: 11pt; margin: 4mm 0 2mm 0; color:#1e3a5f; }'
        + 'h2.section-title .count { color:#666; font-weight: 400; font-size: 9pt; }'
        + '.header-info { display:flex; justify-content:space-between; align-items:center; font-size: 9pt; color:#444; margin-bottom: 3mm; }'
        + '.table-wrap { width: 100%; }'
        + 'table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; page-break-inside: auto; }'
        + 'thead { display: table-header-group; }'  // ripete header su ogni pagina
        + 'tbody tr { page-break-inside: avoid; }'
        + 'th { background: #1e3a5f; color: #fff; padding: 5px 6px; text-align: center; font-weight: 600; border: 1px solid #1e3a5f; font-size: ' + (fontPt + 0.5) + 'pt; }'
        + 'th:first-child { text-align: left; }'
        + 'td { padding: 4px 6px; border: 1px solid #ccc; vertical-align: middle; text-align: center; }'
        + 'td:first-child { text-align: left; font-weight: 600; }'
        + 'td:last-child { font-weight: 700; color: #16a34a; }'
        + 'tbody tr:nth-child(even) td { background: #f7f7f7; }'
        + '.print-bar { position: fixed; top: 8px; right: 8px; }'
        + '.print-bar button { padding: 6px 14px; font-size: 12px; cursor: pointer; margin-left: 4px; }'
        + '@media print { .print-bar { display: none !important; } }'
        + '</style></head><body>'
        + '<div class="print-bar">'
        +   '<button onclick="window.print()">🖨 Stampa</button>'
        +   '<button onclick="window.close()">✖ Chiudi</button>'
        + '</div>'
        + '<h1>💳 Gestione Pagamenti</h1>'
        + '<div class="header-info"><span>' + teamName + '</span><span>Stampato il ' + dataStampa + '</span></div>'
        + cleanTable(tA, '👥 Atleti', nAtleti)
        + cleanTable(tS, '🎓 Staff', nStaff)
        + '</body></html>';

    var w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { alert('Sblocca i popup del browser per stampare i Pagamenti.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = function() {
        setTimeout(function(){ try { w.focus(); w.print(); } catch(e){ console.error(e); } }, 300);
    };
};

// ============================================================
// STAMPA DEDICATA MATERIALI (v1.5.12)
// Apre una finestra dedicata con HTML pulito + @page A4 landscape.
// Per Materiali ogni cella contiene un input (qta) + select (taglia):
// estraiamo i valori e li renderizziamo come testo plain.
// ============================================================
window.printMaterialiDedicato = function() {
    var tA = document.getElementById('materiale-table-atleti');
    var tS = document.getElementById('materiale-table-staff');
    if (!tA || !tS) { alert('Tabelle materiali non trovate.'); return; }

    var teamName = (window._appData && window._appData.teamName) || 'La mia squadra';
    var dataStampa = new Date().toLocaleDateString('it-IT');

    // Trasforma una tabella DOM in HTML pulito per stampa.
    // - rimuove pulsanti / .no-print
    // - per ogni input/select estrae il valore e lo sostituisce con testo
    // - rimuove tutti gli style inline e classi (per evitare dark theme)
    function cleanTable(tableEl, titoloSezione, count) {
        if (!tableEl || !tableEl.innerHTML.trim()) return '';
        var clone = tableEl.cloneNode(true);
        // Rimuove pulsanti e .no-print
        clone.querySelectorAll('button, .no-print').forEach(function(el){ el.remove(); });
        // Sostituisce input/select con il loro valore corrente
        clone.querySelectorAll('input, select').forEach(function(el) {
            var val = '';
            if (el.tagName === 'SELECT') {
                var opt = el.options[el.selectedIndex];
                val = opt ? (opt.text || opt.value || '') : '';
                // Se la taglia non e' selezionata, mostra "—"
                if (!val || val === '— Taglia —' || val === '— Taglia—') val = '—';
            } else {
                val = el.value || '';
                if (el.type === 'number' && (!val || val === '0')) val = el.placeholder || '—';
                if (!val) val = '—';
            }
            var span = document.createElement('span');
            span.className = 'cell-value';
            span.textContent = val;
            el.parentNode.replaceChild(span, el);
        });
        // Rimuove etichette ridondanti tipo "Qtà:" "Taglia:"
        clone.querySelectorAll('label, small').forEach(function(el){
            var txt = (el.textContent || '').trim().toLowerCase();
            if (txt === 'qtà:' || txt === 'qta:' || txt === 'taglia:' || txt === 'qtà' || txt === 'taglia') {
                el.remove();
            }
        });
        // Rimuove tutti gli style inline e classi
        clone.querySelectorAll('[style]').forEach(function(el){ el.removeAttribute('style'); });
        clone.querySelectorAll('tr,td,th,div,span').forEach(function(el){
            // Conserva solo classi che usiamo a stampa
            var keep = ['cell-value','riepilogo','consegnato-mark','restituito-mark'];
            var cur = (el.className || '').split(/\s+/).filter(function(c){ return keep.indexOf(c) !== -1; });
            if (cur.length) el.className = cur.join(' '); else el.removeAttribute('class');
        });
        return ''
            + '<h2 class="section-title">' + titoloSezione + (count ? ' <span class="count">(' + count + ')</span>' : '') + '</h2>'
            + '<div class="table-wrap">' + clone.outerHTML + '</div>';
    }

    // Conta righe (escludendo eventuale riepilogo) e colonne max
    var nAtleti = 0;
    (tA.querySelectorAll('tbody tr')||[]).forEach(function(tr){
        // Esclude righe riepilogo (di solito hanno una cella che dice "Riepilogo")
        var firstTd = tr.querySelector('td');
        if (firstTd && /riepilogo/i.test(firstTd.textContent)) return;
        nAtleti++;
    });
    var nStaff = 0;
    (tS.querySelectorAll('tbody tr')||[]).forEach(function(tr){
        var firstTd = tr.querySelector('td');
        if (firstTd && /riepilogo/i.test(firstTd.textContent)) return;
        nStaff++;
    });
    var maxCols = 4;
    [tA, tS].forEach(function(t) {
        var hr = t.querySelector('thead tr');
        if (hr) maxCols = Math.max(maxCols, hr.children.length);
    });
    // Materiali ha 2 valori per cella (qta + taglia): scaling piu' aggressivo
    var fontPt;
    if (maxCols <= 5)       fontPt = 9;
    else if (maxCols <= 7)  fontPt = 8;
    else if (maxCols <= 9)  fontPt = 7;
    else if (maxCols <= 11) fontPt = 6.5;
    else                    fontPt = 6;

    var html = ''
        + '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">'
        + '<title>Materiali — ' + teamName + ' — ' + dataStampa + '</title>'
        + '<style>'
        + '@page { size: A4 landscape; margin: 8mm 10mm; }'
        + '* { box-sizing: border-box; }'
        + 'body { font-family: "Segoe UI", system-ui, Arial, sans-serif; color:#000; margin:0; padding:0; background:#fff; font-size: ' + fontPt + 'pt; }'
        + 'h1 { font-size: 16pt; margin: 0 0 2mm 0; color:#1e3a5f; border-bottom: 2px solid #d90429; padding-bottom: 2mm; }'
        + 'h2.section-title { font-size: 11pt; margin: 4mm 0 2mm 0; color:#1e3a5f; }'
        + 'h2.section-title .count { color:#666; font-weight: 400; font-size: 9pt; }'
        + '.header-info { display:flex; justify-content:space-between; align-items:center; font-size: 9pt; color:#444; margin-bottom: 3mm; }'
        + '.table-wrap { width: 100%; }'
        + 'table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; page-break-inside: auto; table-layout: auto; }'
        + 'thead { display: table-header-group; }'
        + 'tbody tr { page-break-inside: avoid; }'
        + 'th { background: #1e3a5f; color: #fff; padding: 5px 4px; text-align: center; font-weight: 600; border: 1px solid #1e3a5f; font-size: ' + (fontPt + 0.5) + 'pt; word-break: break-word; }'
        + 'th:first-child { text-align: left; }'
        + 'td { padding: 3px 4px; border: 1px solid #ccc; vertical-align: middle; text-align: center; word-break: break-word; }'
        + 'td:first-child { text-align: left; font-weight: 600; }'
        + 'tbody tr:nth-child(even) td { background: #f7f7f7; }'
        + '/* Cella materiale: qta + taglia uno sotto l\'altro */'
        + '.cell-value { display: block; line-height: 1.3; }'
        + '.cell-value + .cell-value { margin-top: 1px; color: #555; font-size: 0.92em; }'
        + '/* Riga riepilogo in evidenza */'
        + 'tbody tr:last-child td { background: #e6f0ff !important; font-weight: 700; border-top: 2px solid #1e3a5f; }'
        + '.print-bar { position: fixed; top: 8px; right: 8px; }'
        + '.print-bar button { padding: 6px 14px; font-size: 12px; cursor: pointer; margin-left: 4px; }'
        + '@media print { .print-bar { display: none !important; } }'
        + '</style></head><body>'
        + '<div class="print-bar">'
        +   '<button onclick="window.print()">🖨 Stampa</button>'
        +   '<button onclick="window.close()">✖ Chiudi</button>'
        + '</div>'
        + '<h1>📦 Gestione Materiale</h1>'
        + '<div class="header-info"><span>' + teamName + '</span><span>Stampato il ' + dataStampa + '</span></div>'
        + cleanTable(tA, '👥 Atleti', nAtleti)
        + cleanTable(tS, '🎓 Staff', nStaff)
        + '</body></html>';

    var w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { alert('Sblocca i popup del browser per stampare i Materiali.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = function() {
        setTimeout(function(){ try { w.focus(); w.print(); } catch(e){ console.error(e); } }, 300);
    };
};


// ═══════════════════════════════════════════════════════════════════
// ████  BANNER SPONSOR OVERLAY per index.html  (aggiunto v1.5.16)
// ═══════════════════════════════════════════════════════════════════
function _buildBannerSlots(saBanners, spCfg) {
    function toSlots(cfg, keys) {
        return keys.map(function(k){ return cfg[k]||{}; })
            .filter(function(s){ return s.img && s.img.trim(); })
            .map(function(s) {
                var m = s.img.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (!m) m = s.img.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                return Object.assign({}, s, { img: m ? 'https://lh3.googleusercontent.com/d/' + m[1] : s.img, _driveId: m ? m[1] : null });
            });
    }
    var saSlots = saBanners.bannersEnabled !== false ? toSlots(saBanners, [0,1]) : [];
    var spSlots = spCfg.bannersEnabled !== false ? toSlots(spCfg, [0,1,2]) : [];
    return saSlots.concat(spSlots);
}

window._showSponsorBannerOverlay = function(slots) {
    if (!slots || !slots.length) return;
    if (window._bannerShown) return;
    window._bannerShown = true;

    var existing = document.getElementById('sponsor-overlay-container');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'sponsor-overlay-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:min(340px,calc(100vw - 32px));';
    document.body.appendChild(container);

    function fadeOut(card, cb){
        card.style.opacity='0'; card.style.transform='translateY(20px)';
        setTimeout(function(){ if(card.parentNode) card.parentNode.removeChild(card); if(cb) cb(); }, 400);
    }

    function showSlot(idx) {
        if (idx >= slots.length) return;
        var slot = slots[idx];
        var m = slot.img && (slot.img.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || slot.img.match(/[?&]id=([a-zA-Z0-9_-]+)/));
        var did = m ? m[1] : null;

        var card = document.createElement('div');
        card.style.cssText = 'background:rgba(13,27,42,0.97);border:1px solid #3b5a9d;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:auto;opacity:0;transform:translateY(20px);transition:opacity 0.4s ease,transform 0.4s ease;cursor:'+(slot.link?'pointer':'default')+';';

        var img = document.createElement('img');
        img.src = did ? 'https://lh3.googleusercontent.com/d/' + did : slot.img;
        img.alt = 'Sponsor';
        img.style.cssText = 'width:100%;max-height:160px;object-fit:cover;display:block;';
        img.onerror = function(){
            if (did && !this._f1) { this._f1 = true; this.src = 'https://drive.google.com/uc?export=view&id=' + did; }
            else if (did && !this._f2) { this._f2 = true; this.src = 'https://drive.google.com/thumbnail?id=' + did + '&sz=w600'; }
            else { this.style.display = 'none'; }
        };
        card.appendChild(img);

        var bar = document.createElement('div');
        bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(26,58,95,0.95);';
        var lbl = document.createElement('span');
        lbl.style.cssText = 'color:#f59e0b;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;';
        lbl.textContent = '⭐ SPONSOR';
        var closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:none;border:none;color:#60a5fa;cursor:pointer;font-size:0.85rem;padding:2px 6px;line-height:1;';
        closeBtn.onclick = function(e){ e.stopPropagation(); fadeOut(card, function(){ showSlot(idx + 1); }); };
        bar.appendChild(lbl); bar.appendChild(closeBtn);
        card.appendChild(bar);

        if (slot.link) card.onclick = function(){ window.open(slot.link,'_blank','noopener'); };
        container.appendChild(card);
        requestAnimationFrame(function(){ requestAnimationFrame(function(){
            card.style.opacity='1'; card.style.transform='translateY(0)';
        }); });
        setTimeout(function(){ fadeOut(card, function(){ showSlot(idx + 1); }); }, 5000);
    }

    showSlot(0);
};
// ═══ FINE BANNER SPONSOR OVERLAY ════════════════════════════════════════

// ═══ ALERT DOCUMENTI ATLETI IN ATTESA (v1.5.21) ═════════════════════════
window._checkPendingAthleteDocs = async function() {
    try {
        var aid = sessionStorage.getItem('gosport_current_annata') || '';
        if (!aid) return;

        // Fetch fresca — i dati in memoria potrebbero essere precedenti al caricamento del documento
        var res = await fetch('/api/data', {
            cache: 'no-store',
            headers: { 'x-annata-id': aid }
        });
        if (!res.ok) return;
        var d = await res.json();

        var docs = d.athleteDocs || {};
        if (!Object.keys(docs).length) return;

        var athletes = (d.athletes || []).filter(function(a){ return !a.isGuest && !a.isStaff; });

        // Solo atleti con documenti NON ancora scaricati
        var withUndownloaded = athletes.filter(function(a) {
            var aDocs = docs[String(a.id)] || {};
            return Object.keys(aDocs).some(function(k) {
                return aDocs[k] && aDocs[k].url && !aDocs[k].downloadLog;
            });
        });
        if (!withUndownloaded.length) return;

        var existing = document.getElementById('_athlete-docs-alert');
        if (existing) return;

        var names = withUndownloaded.slice(0, 3).map(function(a){ return a.name.split(' ')[0]; }).join(', ');
        if (withUndownloaded.length > 3) names += ' e altri ' + (withUndownloaded.length - 3);

        var alertEl = document.createElement('div');
        alertEl.id = '_athlete-docs-alert';
        alertEl.style.cssText = 'background:#1e3a5f;border:1px solid #3b82f6;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
        alertEl.innerHTML = '<span style="font-size:1.2rem;">📎</span>'
            + '<span style="color:#e2e8f0;font-size:0.88rem;flex:1;">'
            + '<strong style="color:#60a5fa;">' + withUndownloaded.length + ' atleti</strong> hanno caricato documenti da scaricare: '
            + names + '. '
            + '<a href="/calendario.html" style="color:#22c55e;font-weight:700;">Vai a Documenti Atleti →</a>'
            + '</span>'
            + '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.1rem;">✕</button>';

        var homeSection = document.getElementById('home-section');
        if (homeSection) {
            var firstRow = homeSection.querySelector('.row');
            homeSection.insertBefore(alertEl, firstRow || homeSection.firstChild);
        }
    } catch(e) {
        console.warn('[AthleteDocsAlert]', e);
    }
};
