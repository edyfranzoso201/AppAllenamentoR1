// calendario-admin.js - Gestione Calendario Admin
(function() {
    'use strict';

    // Variabili globali per il calendario
    window.calendarEvents = window.calendarEvents || {};
    window.calendarResponses = window.calendarResponses || {};

    // Modal instances
    let eventModal, responsesModal, linksModal;

    // Elementi DOM
    const calendarElements = {
        addEventBtn: document.getElementById('add-calendar-event-btn'),
        deleteOldMonthsBtn: document.getElementById('delete-old-months-btn'),
        viewResponsesBtn: document.getElementById('view-responses-btn'),
        copyLinksBtn: document.getElementById('copy-links-btn'),
        calendarTable: document.getElementById('calendar-table'),
        calendarTbody: document.getElementById('calendar-tbody'),
        eventDetailsRow: document.getElementById('event-details-row'),
        emptyState: document.getElementById('calendar-empty-state'),
        eventForm: document.getElementById('calendar-event-form'),
        eventDateId: document.getElementById('event-date-id'),
        eventDate: document.getElementById('event-date'),
        eventType: document.getElementById('event-type'),
        eventTime: document.getElementById('event-time'),
        eventLockDays: document.getElementById('event-lock-days'),
        deleteEventBtn: document.getElementById('delete-event-btn'),
        responsesContent: document.getElementById('responses-content'),
        athleteLinksContent: document.getElementById('athlete-links-content')
    };

    // Inizializza modal
    const initModals = () => {
        eventModal = new bootstrap.Modal(document.getElementById('calendarEventModal'));
        responsesModal = new bootstrap.Modal(document.getElementById('responsesModal'));
        linksModal = new bootstrap.Modal(document.getElementById('athleteLinksModal'));
    };

    // Renderizza tabella calendario
    window.renderCalendarTable = () => {
        if (!calendarElements.calendarTable) return;

        const events = window.calendarEvents || {};
        const responses = window.calendarResponses || {};
        const athletes = window.athletes || [];

        // Ottieni date ordinate (solo future + questo mese)
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const eventDates = Object.keys(events)
            .filter(date => new Date(date) >= firstDayOfMonth)
            .sort();

        if (eventDates.length === 0) {
            calendarElements.calendarTable.style.display = 'none';
            calendarElements.emptyState.style.display = 'block';
            return;
        }

        calendarElements.calendarTable.style.display = 'table';
        calendarElements.emptyState.style.display = 'none';

        // Header con date
        const thead = calendarElements.calendarTable.querySelector('thead tr:first-child');
        thead.innerHTML = `
            <th style="width: 40px;">#</th>
            <th style="min-width: 150px;">Atleta</th>
            <th style="width: 100px;">Link</th>
            ${eventDates.map(date => {
                const d = new Date(date);
                const dayName = d.toLocaleDateString('it-IT', { weekday: 'short' });
                const dayNum = d.getDate();
                const month = d.toLocaleDateString('it-IT', { month: 'short' });
                return `<th class="text-center" style="min-width: 80px; writing-mode: vertical-rl; transform: rotate(180deg);">
                    <div class="py-2">${dayName} ${dayNum}/${month}</div>
                </th>`;
            }).join('')}
        `;

        // Riga dettagli evento
        calendarElements.eventDetailsRow.innerHTML = `
            <th colspan="3" class="text-center bg-secondary">Dettagli</th>
            ${eventDates.map(date => {
                const event = events[date];
                return `<th class="text-center bg-secondary event-header-cell" data-date="${date}" style="cursor: pointer;" title="Clicca per modificare">
                    <div class="small">${event.type}</div>
                    <div class="small">${event.time || '-'}</div>
                    <div class="small text-muted">🔒 ${event.lockDaysBefore || 0}gg</div>
                </th>`;
            }).join('')}
        `;

        // Righe atleti con token crittografato
        const nonGuestAthletes = athletes.filter(a => !a.isGuest);
        calendarElements.calendarTbody.innerHTML = nonGuestAthletes.map((athlete, index) => {
            const baseUrl = window.location.origin;
            // Genera token crittografato invece di usare ID diretto
            const athleteToken = window.generateAthleteToken(athlete.id);
            const athleteLink = `${baseUrl}/presenza/${athleteToken}`;
            
            return `
                <tr>
                    <td class="text-center">${index + 1}</td>
                    <td><strong>${athlete.name}</strong></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary copy-link-btn" 
                                data-link="${athleteLink}" 
                                title="Copia link">
                            <i class="bi bi-link-45deg"></i>
                        </button>
                    </td>
                    ${eventDates.map(date => {
                        const response = responses[date]?.[athlete.id];
                        let cellContent = '-';
                        let cellClass = 'text-center';
                        let tooltip = 'Nessuna risposta';
                        
                        if (response) {
                            if (response.presenza === 'Si') {
                                cellContent = '✅';
                                cellClass = 'text-center bg-success bg-opacity-25';
                                tooltip = `SI - ${response.motivazione}`;
                            } else {
                                cellContent = '❌';
                                cellClass = 'text-center bg-danger bg-opacity-25';
                                tooltip = `NO - ${response.motivazione}`;
                            }
                        }
                        
                        return `<td class="${cellClass}" title="${tooltip}">${cellContent}</td>`;
                    }).join('')}
                </tr>
            `;
        }).join('');

        // Event listeners
        document.querySelectorAll('.copy-link-btn').forEach(btn => {
            btn.addEventListener('click', () => copyLinkToClipboard(btn.dataset.link));
        });

        document.querySelectorAll('.event-header-cell').forEach(cell => {
            cell.addEventListener('click', () => openEditEventModal(cell.dataset.date));
        });
    };

    // Apri modal nuovo evento
    const openNewEventModal = () => {
        calendarElements.eventForm.reset();
        calendarElements.eventDateId.value = '';
        calendarElements.deleteEventBtn.style.display = 'none';
        calendarElements.eventDate.min = new Date().toISOString().split('T')[0];
        eventModal.show();
    };

    // Apri modal modifica evento
    const openEditEventModal = (eventDate) => {
        const event = window.calendarEvents[eventDate];
        if (!event) return;

        calendarElements.eventDateId.value = eventDate;
        calendarElements.eventDate.value = eventDate;
        calendarElements.eventType.value = event.type;
        calendarElements.eventTime.value = event.time || '';
        calendarElements.eventLockDays.value = event.lockDaysBefore || 2;
        calendarElements.deleteEventBtn.style.display = 'block';
        
        eventModal.show();
    };

    // Salva evento
    const saveEvent = async (e) => {
        e.preventDefault();
        
        const eventDate = calendarElements.eventDate.value;
        const isEdit = !!calendarElements.eventDateId.value;
        const oldDate = calendarElements.eventDateId.value;

        const eventData = {
            type: calendarElements.eventType.value,
            time: calendarElements.eventTime.value,
            lockDaysBefore: parseInt(calendarElements.eventLockDays.value) || 0
        };

        // Se cambio data, sposto anche le risposte
        if (isEdit && oldDate !== eventDate) {
            if (window.calendarResponses[oldDate]) {
                window.calendarResponses[eventDate] = window.calendarResponses[oldDate];
                delete window.calendarResponses[oldDate];
            }
            delete window.calendarEvents[oldDate];
        }

        window.calendarEvents[eventDate] = eventData;

        try {
            await window.saveData();
            window.renderCalendarTable();
            eventModal.hide();
            showToast('Evento salvato con successo!', 'success');
        } catch (error) {
            console.error('Errore salvataggio:', error);
            showToast('Errore nel salvataggio', 'danger');
        }
    };

    // Elimina evento
    const deleteEvent = async () => {
        const eventDate = calendarElements.eventDateId.value;
        if (!eventDate) return;

        if (!confirm('Eliminare questo evento? Le risposte degli atleti verranno mantenute.')) return;

        delete window.calendarEvents[eventDate];
        
        try {
            await window.saveData();
            window.renderCalendarTable();
            eventModal.hide();
            showToast('Evento eliminato', 'info');
        } catch (error) {
            console.error('Errore eliminazione:', error);
            showToast('Errore nell\'eliminazione', 'danger');
        }
    };

    // Elimina mesi passati
    const deleteOldMonths = async () => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const eventsToDelete = Object.keys(window.calendarEvents)
            .filter(date => new Date(date) < firstDayOfMonth);

        const responsesToDelete = Object.keys(window.calendarResponses)
            .filter(date => new Date(date) < firstDayOfMonth);

        if (eventsToDelete.length === 0 && responsesToDelete.length === 0) {
            alert('Non ci sono mesi passati da eliminare.');
            return;
        }

        const message = `Eliminare ${eventsToDelete.length} eventi e ${responsesToDelete.length} date con risposte dai mesi precedenti?`;
        if (!confirm(message)) return;

        eventsToDelete.forEach(date => delete window.calendarEvents[date]);
        responsesToDelete.forEach(date => delete window.calendarResponses[date]);

        try {
            await window.saveData();
            window.renderCalendarTable();
            showToast(`Eliminati ${eventsToDelete.length + responsesToDelete.length} record`, 'success');
        } catch (error) {
            console.error('Errore:', error);
            showToast('Errore nell\'eliminazione', 'danger');
        }
    };

    // Visualizza risposte
    const viewAllResponses = () => {
        const events = window.calendarEvents || {};
        const responses = window.calendarResponses || {};
        const athletes = window.athletes || [];

        let html = '';

        Object.keys(events).sort().forEach(eventDate => {
            const event = events[eventDate];
            const eventResponses = responses[eventDate] || {};
            const eventDateObj = new Date(eventDate);
            const dateStr = eventDateObj.toLocaleDateString('it-IT', { 
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            const totalAthletes = athletes.filter(a => !a.isGuest).length;
            const totalResponses = Object.keys(eventResponses).length;
            const siCount = Object.values(eventResponses).filter(r => r.presenza === 'Si').length;
            const noCount = Object.values(eventResponses).filter(r => r.presenza === 'No').length;

            html += `
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        <strong>${event.type}</strong> - ${dateStr}
                        ${event.time ? `<span class="ms-2">⏰ ${event.time}</span>` : ''}
                    </div>
                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-4">
                                <strong>Risposte:</strong> ${totalResponses}/${totalAthletes}
                            </div>
                            <div class="col-md-4 text-success">
                                <strong>✅ Presenti:</strong> ${siCount}
                            </div>
                            <div class="col-md-4 text-danger">
                                <strong>❌ Assenti:</strong> ${noCount}
                            </div>
                        </div>
                        ${Object.keys(eventResponses).length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Atleta</th>
                                            <th>Risposta</th>
                                            <th>Motivazione</th>
                                            <th>Data/Ora</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${Object.entries(eventResponses).map(([athleteId, resp]) => {
                                            const athlete = athletes.find(a => String(a.id) === String(athleteId));
                                            const timestamp = new Date(resp.timestamp);
                                            return `
                                                <tr>
                                                    <td>${athlete?.name || 'Sconosciuto'}</td>
                                                    <td>${resp.presenza === 'Si' ? '✅ SI' : '❌ NO'}</td>
                                                    <td>${resp.motivazione}</td>
                                                    <td class="text-muted small">
                                                        ${timestamp.toLocaleDateString('it-IT')} 
                                                        ${timestamp.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : '<p class="text-muted">Nessuna risposta ancora</p>'}
                    </div>
                </div>
            `;
        });

        calendarElements.responsesContent.innerHTML = html || '<p class="text-muted">Nessun evento con risposte</p>';
        responsesModal.show();
    };

    // Mostra link atleti
    const showAthleteLinks = () => {
        const athletes = window.athletes || [];
        const nonGuestAthletes = athletes.filter(a => !a.isGuest);
        const baseUrl = window.location.origin;

        const html = nonGuestAthletes.map(athlete => {
            // Genera token crittografato
            const athleteToken = window.generateAthleteToken(athlete.id);
            const link = `${baseUrl}/presenza/${athleteToken}`;
            
            return `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="row align-items-center">
                            <div class="col-md-4">
                                <strong>${athlete.name}</strong>
                            </div>
                            <div class="col-md-6">
                                <input type="text" class="form-control form-control-sm" value="${link}" readonly>
                            </div>
                            <div class="col-md-2">
                                <button class="btn btn-sm btn-primary w-100 copy-link-btn" data-link="${link}">
                                    <i class="bi bi-clipboard"></i> Copia
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        calendarElements.athleteLinksContent.innerHTML = html;
        
        // Event listeners per copia
        document.querySelectorAll('#athlete-links-content .copy-link-btn').forEach(btn => {
            btn.addEventListener('click', () => copyLinkToClipboard(btn.dataset.link));
        });

        linksModal.show();
    };

    // Copia link
    const copyLinkToClipboard = async (link) => {
        try {
            await navigator.clipboard.writeText(link);
            showToast('Link copiato!', 'success');
        } catch (error) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = link;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Link copiato!', 'success');
        }
    };

    // Toast notification
    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        toast.style.zIndex = '9999';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    // Event Listeners
    const initEventListeners = () => {
        if (calendarElements.addEventBtn) {
            calendarElements.addEventBtn.addEventListener('click', openNewEventModal);
        }
        if (calendarElements.deleteOldMonthsBtn) {
            calendarElements.deleteOldMonthsBtn.addEventListener('click', deleteOldMonths);
        }
        if (calendarElements.viewResponsesBtn) {
            calendarElements.viewResponsesBtn.addEventListener('click', viewAllResponses);
        }
        if (calendarElements.copyLinksBtn) {
            calendarElements.copyLinksBtn.addEventListener('click', showAthleteLinks);
        }
        if (calendarElements.eventForm) {
            calendarElements.eventForm.addEventListener('submit', saveEvent);
        }
        if (calendarElements.deleteEventBtn) {
            calendarElements.deleteEventBtn.addEventListener('click', deleteEvent);
        }
    };

    // Inizializzazione
    document.addEventListener('DOMContentLoaded', () => {
        initModals();
        initEventListeners();
    });


    // ==================== AUTO-POPOLAMENTO CALENDARIO ====================
    const TRAINING_SCHEDULE = [{day:1,time:'18:30-20:00'},{day:3,time:'17:30-19:00'},{day:5,time:'18:00-19:15'}];
    const END_DATE = new Date('2026-06-30');
    function formatDateKey(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
    async function genTraining(){try{const ev={};const td=new Date();td.setHours(0,0,0,0);let cd=new Date(td);while(cd<=END_DATE){const dw=cd.getDay();const tr=TRAINING_SCHEDULE.find(t=>t.day===dw);if(tr){const dk=formatDateKey(cd);if(!window.calendarEvents[dk]){ev[dk]={type:'Allenamento',time:tr.time,notes:'Allenamento settimanale',createdAt:new Date().toISOString()};}}cd.setDate(cd.getDate()+1);}if(Object.keys(ev).length===0){alert('Tutti gli allenamenti già creati!');return 0;}const r=await fetch('/api/data',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const ad=await r.json();ad.calendarEvents=ad.calendarEvents||{};Object.assign(ad.calendarEvents,ev);const sr=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ad)});if(!sr.ok)throw new Error('Errore salvataggio');window.calendarEvents=ad.calendarEvents;renderCalendarView();const c=Object.keys(ev).length;alert(`✅ Creati ${c} allenamenti!`);return c;}catch(e){alert('❌ Errore: '+e.message);throw e;}}
    async function impMatches(f){return new Promise((res,rej)=>{const rd=new FileReader();rd.onload=async(e)=>{try{const d=JSON.parse(e.target.result);const ev={};d.forEach(m=>{const{data:dk,ora,avversario:av,casa:cs}=m;if(!dk||!ora)return;const loc=cs?'Casa':'Trasferta';const nt=`${loc} vs ${av||'TBD'}`;ev[dk]={type:'Partita',time:ora,notes:nt,createdAt:new Date().toISOString()};});const r=await fetch('/api/data',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const ad=await r.json();ad.calendarEvents=ad.calendarEvents||{};Object.assign(ad.calendarEvents,ev);const sr=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ad)});if(!sr.ok)throw new Error('Errore');window.calendarEvents=ad.calendarEvents;renderCalendarView();const c=Object.keys(ev).length;alert(`✅ Importate ${c} partite!`);res(c);}catch(err){rej(err);}};rd.onerror=()=>rej(new Error('Errore lettura'));rd.readAsText(f);});}
    function addBtns(){const cs=document.getElementById('team-calendar-section');if(!cs)return;const bc=cs.querySelector('.row.mb-3');if(!bc||document.getElementById('auto-generate-training-btn'))return;const tc=document.createElement('div');tc.className='col-lg-3 col-md-6 mb-3';tc.innerHTML='<button class="btn btn-warning w-100" id="auto-generate-training-btn"><i class="bi bi-magic"></i> Genera Allenamenti</button>';bc.appendChild(tc);const mc=document.createElement('div');mc.className='col-lg-3 col-md-6 mb-3';mc.innerHTML='<button class="btn btn-info w-100" id="import-matches-btn"><i class="bi bi-upload"></i> Importa Partite</button><input type="file" id="import-matches-file" accept=".json" style="display:none">';bc.appendChild(mc);document.getElementById('auto-generate-training-btn').addEventListener('click',async function(){const btn=this;const oh=btn.innerHTML;try{btn.disabled=true;btn.innerHTML='<span class="spinner-border spinner-border-sm"></span> Generazione...';await genTraining();btn.innerHTML='<i class="bi bi-check-circle"></i> Fatto!';btn.className='btn btn-success w-100';setTimeout(()=>{btn.innerHTML=oh;btn.className='btn btn-warning w-100';btn.disabled=false;},3000);}catch(e){btn.innerHTML='<i class="bi bi-x-circle"></i> Errore';btn.className='btn btn-danger w-100';setTimeout(()=>{btn.innerHTML=oh;btn.className='btn btn-warning w-100';btn.disabled=false;},3000);}});const ib=document.getElementById('import-matches-btn');const fi=document.getElementById('import-matches-file');ib.addEventListener('click',()=>fi.click());fi.addEventListener('change',async function(e){const f=e.target.files[0];if(!f)return;const oh=ib.innerHTML;try{ib.disabled=true;ib.innerHTML='<span class="spinner-border spinner-border-sm"></span> Importazione...';await impMatches(f);ib.innerHTML='<i class="bi bi-check-circle"></i> Fatto!';ib.className='btn btn-success w-100';setTimeout(()=>{ib.innerHTML=oh;ib.className='btn btn-info w-100';ib.disabled=false;},3000);}catch(err){alert('❌ Errore: '+err.message);ib.innerHTML='<i class="bi bi-x-circle"></i> Errore';ib.className='btn btn-danger w-100';setTimeout(()=>{ib.innerHTML=oh;ib.className='btn btn-info w-100';ib.disabled=false;},3000);}fi.value='';});}
    setTimeout(addBtns,1000);

})();
