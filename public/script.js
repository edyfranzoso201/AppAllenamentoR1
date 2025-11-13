const DashboardApp = {
    config: {
        password: "2025Edy201",
        defaultAvatar: "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3e%3cpath fill='%231e5095' d='M128 128H0V0h128v128z'/%3e%3cpath fill='%23ffffff' d='M64 100c-19.88 0-36-16.12-36-36s16.12-36 36-36 36 16.12 36 36-16.12 36-36 36zm0-64c-15.46 0-28 12.54-28 28s12.54 28 28 28 28-12.54 28-28-12.54-28-28-28z'/%3e%3c/svg%3e",
        gpsMetrics: { 'distanza_totale': 'Dist. Totale', 'velocita_massima': 'Vel. Max', 'distanza_sprint': 'Dist. Sprint', 'numero_di_sprint': 'N. Sprint' }
    },
    
    state: {
        isAuthenticated: false,
        athletes: [],
        trainingSessions: {},
        matchResults: {},
        gpsData: {},
        formationData: { starters: [], bench: [], tokens: [] },
        currentDate: new Date(),
        charts: {}
    },

    Data: {
        async load() {
            try {
                // ✅ COMUNICAZIONE SERVER VERCEL
                const response = await fetch('/api/data', { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                const data = await response.json();
                
                // Merge dati
                DashboardApp.state.athletes = data.athletes || [];
                DashboardApp.state.trainingSessions = data.trainingSessions || {};
                DashboardApp.state.matchResults = data.matchResults || {};
                DashboardApp.state.gpsData = data.gpsData || {};
                DashboardApp.state.formationData = data.formationData || { starters: [], bench: [], tokens: [] };
                
                this.normalizeData();
                return true;
            } catch (e) {
                console.error("Errore caricamento server:", e);
                return false;
            }
        },

        async save() {
            // ✅ SALVATAGGIO SU SERVER VERCEL
            const { charts, currentDate, isAuthenticated, ...dataToSave } = DashboardApp.state;
            try {
                await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSave)
                });
            } catch (e) { console.error("Errore salvataggio server:", e); }
        },

        startPolling() {
            // ✅ POLLING: Controlla aggiornamenti ogni 5 secondi (come originale)
            setInterval(async () => {
                const currentJson = JSON.stringify({
                    athletes: DashboardApp.state.athletes,
                    matchResults: DashboardApp.state.matchResults,
                    formationData: DashboardApp.state.formationData
                });
                
                await this.load();
                
                const newJson = JSON.stringify({
                    athletes: DashboardApp.state.athletes,
                    matchResults: DashboardApp.state.matchResults,
                    formationData: DashboardApp.state.formationData
                });

                if (currentJson !== newJson) {
                    console.log("Dati aggiornati dal server, refresh UI...");
                    DashboardApp.UI.renderAll();
                }
            }, 5000);
        },

        normalizeData() {
            DashboardApp.state.athletes.forEach(a => {
                a.isCaptain = !!a.isCaptain;
                a.isViceCaptain = !!a.isViceCaptain;
            });
        }
    },

    UI: {
        renderAll() {
            this.updateStats();
            this.renderAthletes();
            this.renderCalendar();
            this.renderMatchResults();
            this.renderFormation();
            this.populateGpsSelectors();
        },

        updateStats() {
            const s = DashboardApp.state;
            document.getElementById('home-total-athletes').textContent = s.athletes.length;
            
            let pg = 0, v = 0, p = 0, l = 0, gf = 0, gs = 0;
            Object.values(s.matchResults).forEach(m => {
                const my = m.location === 'home' ? m.homeScore : m.awayScore;
                const opp = m.location === 'home' ? m.awayScore : m.homeScore;
                if (my !== null && my !== undefined && opp !== null && opp !== undefined) {
                    pg++; gf += my; gs += opp;
                    if (my > opp) v++; else if (my < opp) l++; else p++;
                }
            });
            
            document.getElementById('stat-pg').textContent = pg;
            document.getElementById('stat-vps').textContent = `${v}-${p}-${l}`;
            document.getElementById('stat-gf').textContent = gf;
            document.getElementById('stat-gs').textContent = gs;
            const dr = gf - gs;
            const drEl = document.getElementById('stat-dr');
            drEl.textContent = (dr > 0 ? '+' : '') + dr;
            drEl.className = `h4 ${dr > 0 ? 'text-success' : (dr < 0 ? 'text-danger' : '')}`;
        },

        renderAthletes() {
            const grid = document.getElementById('athlete-grid');
            grid.innerHTML = '';
            DashboardApp.state.athletes.forEach(athlete => {
                const card = document.createElement('div');
                card.className = 'col-xl-3 col-lg-4 col-md-6 mb-4';
                const vcIcon = athlete.isViceCaptain ? '<i class="bi bi-star-half is-vice-captain ms-1"></i>' : '';
                const cIcon = athlete.isCaptain ? '<i class="bi bi-star-fill is-captain ms-1"></i>' : '';
                
                card.innerHTML = `
                    <div class="card athlete-card">
                        <div class="card-body athlete-card-clickable" data-athlete-id="${athlete.id}">
                            <div class="d-flex align-items-center">
                                <img src="${athlete.avatar || DashboardApp.config.defaultAvatar}" class="athlete-avatar me-3">
                                <div><h5 class="card-title mb-0">${athlete.name} ${cIcon}${vcIcon}</h5><p class="text-muted small mb-0">${athlete.role}</p></div>
                            </div>
                            <div class="shirt-number">${athlete.number}</div>
                        </div>
                        <div class="card-actions no-print">
                            <button class="btn btn-sm btn-light edit-btn" data-id="${athlete.id}"><i class="bi bi-pencil-fill"></i></button>
                            <button class="btn btn-sm btn-light gps-btn" data-id="${athlete.id}"><i class="bi bi-speedometer"></i></button>
                        </div>
                    </div>`;
                grid.appendChild(card);
            });
        },

        renderCalendar() {
            const grid = document.getElementById('calendar-grid');
            grid.innerHTML = '';
            const now = DashboardApp.state.currentDate;
            document.getElementById('current-month-year').textContent = now.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            const year = now.getFullYear(), month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = (new Date(year, month, 1).getDay() + 6) % 7; 
            for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="calendar-day other-month"></div>`;
            for(let d=1; d<=daysInMonth; d++) {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dayEl = document.createElement('div'); dayEl.className = 'calendar-day';
                if(dateStr === new Date().toISOString().split('T')[0]) dayEl.classList.add('today');
                dayEl.innerHTML = `<div class="fw-bold">${d}</div>`;
                
                const sessions = DashboardApp.state.trainingSessions[dateStr] || [];
                sessions.forEach(s => {
                    const el = document.createElement('div'); el.className = 'calendar-session session-allenamento'; el.textContent = s.title;
                    el.onclick = () => DashboardApp.Modals.openSession(s, dateStr); dayEl.appendChild(el);
                });
                Object.values(DashboardApp.state.matchResults).forEach(m => {
                    if(m.date === dateStr) {
                        const el = document.createElement('div');
                        const isHome = m.location === 'home';
                        el.className = `calendar-session ${isHome ? 'session-partita-casa' : 'session-partita-trasferta'}`;
                        el.textContent = `vs ${m.opponentName}`;
                        el.onclick = () => DashboardApp.Modals.openMatch(m); dayEl.appendChild(el);
                    }
                });
                grid.appendChild(dayEl);
            }
        },

        renderMatchResults() {
            const container = document.getElementById('match-results-container');
            container.innerHTML = '';
            Object.values(DashboardApp.state.matchResults).sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(m => {
                const isHome = m.location === 'home';
                const hasScore = (m.homeScore !== null && m.awayScore !== null);
                const score = hasScore ? `${m.homeScore} - ${m.awayScore}` : 'da giocare';
                const col = document.createElement('div'); col.className = 'col-md-4 mb-3';
                col.innerHTML = `<div class="card match-result-item ${isHome ? 'match-home' : 'match-away'}"><div class="card-body p-2" onclick="DashboardApp.Modals.openMatchById('${m.id}')" style="cursor:pointer;"><small class="text-muted">${m.date}</small><div class="fw-bold">vs ${m.opponentName}</div><div class="h5 mb-0">${score}</div></div></div>`;
                container.appendChild(col);
            });
        },

        renderFormation() {
            const field = document.getElementById('field-container');
            const bench = document.getElementById('field-bench-area');
            field.querySelectorAll('.player-jersey, .token').forEach(e => e.remove());
            bench.querySelectorAll('.player-jersey').forEach(e => e.remove());
            const fd = DashboardApp.state.formationData;
            const renderJersey = (pid, top, left, container) => {
                const ath = DashboardApp.state.athletes.find(a => String(a.id) === String(pid));
                if(!ath) return;
                const el = document.createElement('div'); el.className = 'player-jersey'; el.style.top = top + '%'; el.style.left = left + '%'; el.dataset.athleteId = ath.id;
                const isGk = ath.role.toLowerCase().includes('portiere');
                el.innerHTML = `<div class="jersey-body" style="background-color: ${isGk ? 'var(--gk-color)' : 'var(--secondary-blue)'}"><span class="jersey-number">${ath.number}</span></div><span class="player-name">${ath.name}</span>`;
                container.appendChild(el);
            };
            fd.starters.forEach(p => renderJersey(p.athleteId, p.top, p.left, field));
            fd.bench.forEach(p => renderJersey(p.athleteId, p.top, p.left, bench));
            fd.tokens.forEach(t => {
                const el = document.createElement('div'); el.className = 'token'; el.style.top = t.top + '%'; el.style.left = t.left + '%'; el.dataset.itemType = t.type; el.dataset.tokenId = t.id;
                if(t.type === 'ball') { el.textContent = '⚽'; el.classList.add('token-ball'); }
                else if(t.type.includes('captain')) { el.textContent = t.type === 'captain-c' ? '(C)' : '(VC)'; el.classList.add('token-captain'); }
                else { el.textContent = '●'; el.classList.add('token-opponent'); }
                field.appendChild(el);
            });
            const list = document.getElementById('available-list'); list.innerHTML = '';
            const placed = new Set([...fd.starters, ...fd.bench].map(p => String(p.athleteId)));
            DashboardApp.state.athletes.forEach(a => {
                if(!placed.has(String(a.id))) {
                    const item = document.createElement('div'); item.className = 'list-group-item available-player p-1 mb-1'; item.dataset.athleteId = a.id;
                    item.innerHTML = `<strong>${a.number}.</strong> ${a.name}`; list.appendChild(item);
                }
            });
        },

        populateGpsSelectors() {
            const metricSel = document.getElementById('performance-metric-selector');
            metricSel.innerHTML = '';
            Object.entries(DashboardApp.config.gpsMetrics).forEach(([k,v]) => {
                metricSel.innerHTML += `<option value="${k}">${v}</option>`;
            });
        },

        updatePerformanceChart() {
            const ctx = document.getElementById('performanceChart').getContext('2d');
            if(DashboardApp.state.charts.perf) DashboardApp.state.charts.perf.destroy();
            DashboardApp.state.charts.perf = new Chart(ctx, {
                type: 'bar', data: { labels: [], datasets: [] },
                options: { plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
            });
        }
    },

    Events: {
        init() {
            document.getElementById('add-athlete-btn').onclick = () => DashboardApp.Modals.openAthlete();
            document.getElementById('quick-add-athlete-btn').onclick = () => DashboardApp.Modals.openAthlete();
            document.getElementById('add-session-btn').onclick = () => DashboardApp.Modals.openSession();
            document.getElementById('quick-plan-session-btn').onclick = () => DashboardApp.Modals.openSession();
            document.getElementById('add-match-btn').onclick = () => DashboardApp.Modals.openMatch();
            
            document.getElementById('prev-month-btn').onclick = () => { DashboardApp.state.currentDate.setMonth(DashboardApp.state.currentDate.getMonth() - 1); DashboardApp.UI.renderCalendar(); };
            document.getElementById('next-month-btn').onclick = () => { DashboardApp.state.currentDate.setMonth(DashboardApp.state.currentDate.getMonth() + 1); DashboardApp.UI.renderCalendar(); };

            document.getElementById('athlete-form').onsubmit = this.handleAthleteSave;
            document.getElementById('session-form').onsubmit = this.handleSessionSave;
            document.getElementById('match-result-form').onsubmit = this.handleMatchSave;
            document.getElementById('gps-form').onsubmit = this.handleGpsSave;

            document.getElementById('password-form').onsubmit = (e) => {
                e.preventDefault();
                if(document.getElementById('password-input').value === DashboardApp.config.password) {
                    DashboardApp.state.isAuthenticated = true;
                    document.getElementById('logout-btn').style.display = 'block';
                    bootstrap.Modal.getInstance(document.getElementById('passwordModal')).hide();
                    alert("Accesso effettuato");
                } else { document.getElementById('password-error').style.display = 'block'; }
            };

            document.getElementById('athlete-grid').addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-btn');
                const gpsBtn = e.target.closest('.gps-btn');
                if(editBtn) DashboardApp.Modals.openAthlete(editBtn.dataset.id);
                if(gpsBtn) DashboardApp.Modals.openGps(gpsBtn.dataset.id);
            });

            this.initDragAndDrop();
        },

        handleAthleteSave(e) {
            e.preventDefault();
            const id = document.getElementById('modal-athlete-id').value;
            const newData = {
                id: id || Date.now(),
                name: document.getElementById('athlete-name').value,
                role: document.getElementById('athlete-role').value,
                number: document.getElementById('athlete-number').value,
                isCaptain: document.getElementById('athlete-captain').checked,
                isViceCaptain: document.getElementById('athlete-vice-captain').checked,
                avatar: document.getElementById('athlete-avatar-base64').value
            };
            const list = DashboardApp.state.athletes;
            if(id) { const idx = list.findIndex(a => String(a.id) === String(id)); if(idx !== -1) list[idx] = { ...list[idx], ...newData }; } else { list.push(newData); }
            DashboardApp.Data.save();
            DashboardApp.UI.renderAll();
            bootstrap.Modal.getInstance(document.getElementById('athleteModal')).hide();
        },

        handleSessionSave(e) {
            e.preventDefault();
            const date = document.getElementById('session-date').value;
            const id = document.getElementById('session-id').value || Date.now();
            const newSession = {
                id: id,
                title: document.getElementById('session-title').value,
                time: document.getElementById('session-time').value,
                location: document.getElementById('session-location').value,
                description: document.getElementById('session-description').value
            };
            if(!DashboardApp.state.trainingSessions[date]) DashboardApp.state.trainingSessions[date] = [];
            const sessions = DashboardApp.state.trainingSessions[date];
            const idx = sessions.findIndex(s => String(s.id) === String(id));
            if(idx !== -1) sessions[idx] = newSession; else sessions.push(newSession);
            DashboardApp.Data.save();
            DashboardApp.UI.renderCalendar();
            bootstrap.Modal.getInstance(document.getElementById('sessionModal')).hide();
        },

        handleMatchSave(e) {
            e.preventDefault();
            const id = document.getElementById('match-id').value || Date.now();
            const loc = document.getElementById('match-location').value;
            const mScore = document.getElementById('match-my-team-score').value;
            const oScore = document.getElementById('match-opponent-score').value;
            const match = {
                id: id, date: document.getElementById('match-date').value,
                opponentName: document.getElementById('match-opponent-name').value, location: loc,
                homeScore: mScore, awayScore: oScore,
            };
            DashboardApp.state.matchResults[id] = match;
            DashboardApp.Data.save();
            DashboardApp.UI.renderAll();
            bootstrap.Modal.getInstance(document.getElementById('matchResultModal')).hide();
        },

        handleGpsSave(e) {
            e.preventDefault();
            const id = document.getElementById('modal-athlete-id-gps').value;
            const date = document.getElementById('gps-data_di_registrazione').value;
            if(!DashboardApp.state.gpsData[id]) DashboardApp.state.gpsData[id] = {};
            if(!DashboardApp.state.gpsData[id][date]) DashboardApp.state.gpsData[id][date] = [];
            DashboardApp.state.gpsData[id][date].push({
                id: Date.now(), tipo_sessione: document.getElementById('gps-tipo_sessione').value,
                distanza_totale: document.getElementById('gps-distanza_totale').value,
                velocita_massima: document.getElementById('gps-velocita_massima').value
            });
            DashboardApp.Data.save();
            bootstrap.Modal.getInstance(document.getElementById('gpsModal')).hide();
        },

        initDragAndDrop() {
            let dragged = null; let ghost = null;
            const onDragStart = (e) => {
                const target = e.target.closest('.player-jersey, .available-player, .tool-item, .token');
                if(!target) return;
                e.preventDefault(); dragged = target;
                ghost = target.cloneNode(true); ghost.classList.add('dragging'); ghost.style.position = 'fixed'; ghost.style.width = '50px';
                document.body.appendChild(ghost);
                document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onEnd);
            };
            const onMove = (e) => { if(ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; } };
            const onEnd = (e) => {
                if(ghost) ghost.remove();
                document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onEnd);
                const dropZone = document.elementFromPoint(e.clientX, e.clientY)?.closest('.drop-zone');
                if(dropZone && dragged) {
                    const rect = dropZone.getBoundingClientRect();
                    const left = ((e.clientX - rect.left) / rect.width) * 100;
                    const top = ((e.clientY - rect.top) / rect.height) * 100;
                    const athId = dragged.dataset.athleteId; const type = dragged.dataset.itemType;
                    const fd = DashboardApp.state.formationData;
                    if(athId) {
                        fd.starters = fd.starters.filter(p => String(p.athleteId) !== athId);
                        fd.bench = fd.bench.filter(p => String(p.athleteId) !== athId);
                        if(dropZone.id === 'field-container') fd.starters.push({athleteId: athId, top, left});
                        else if(dropZone.id === 'field-bench-area') fd.bench.push({athleteId: athId, top, left});
                    } else if (type) { fd.tokens.push({id: Date.now(), type: type, top, left}); }
                    DashboardApp.Data.save();
                    DashboardApp.UI.renderFormation();
                }
                dragged = null;
            };
            document.getElementById('formazione-section').addEventListener('mousedown', onDragStart);
        }
    },

    Modals: {
        bs: {},
        get(id) { if(!this.bs[id]) this.bs[id] = new bootstrap.Modal(document.getElementById(id)); return this.bs[id]; },
        openAthlete(id = null) {
            const form = document.getElementById('athlete-form'); form.reset();
            document.getElementById('athlete-avatar-base64').value = "";
            if(id) {
                const a = DashboardApp.state.athletes.find(x => String(x.id) === String(id));
                document.getElementById('modal-athlete-id').value = a.id; document.getElementById('athlete-name').value = a.name;
                document.getElementById('athlete-role').value = a.role; document.getElementById('athlete-number').value = a.number;
                document.getElementById('athlete-captain').checked = a.isCaptain; document.getElementById('athlete-vice-captain').checked = a.isViceCaptain;
            } else { document.getElementById('modal-athlete-id').value = ""; }
            this.get('athleteModal').show();
        },
        openSession(data = null, datePre = "") {
            const form = document.getElementById('session-form'); form.reset();
            document.getElementById('session-date').value = datePre || new Date().toISOString().split('T')[0];
            if(data) {
                document.getElementById('session-id').value = data.id; document.getElementById('session-title').value = data.title;
                document.getElementById('session-time').value = data.time; document.getElementById('session-location').value = data.location;
                document.getElementById('session-description').value = data.description; document.getElementById('delete-session-btn').style.display = 'block';
            } else { document.getElementById('session-id').value = ""; document.getElementById('delete-session-btn').style.display = 'none'; }
            this.get('sessionModal').show();
        },
        openMatchById(id) { this.openMatch(DashboardApp.state.matchResults[id]); },
        openMatch(data = null) {
            const form = document.getElementById('match-result-form'); form.reset();
            document.getElementById('match-date').valueAsDate = new Date();
            if(data) {
                document.getElementById('match-id').value = data.id; document.getElementById('match-date').value = data.date;
                document.getElementById('match-opponent-name').value = data.opponentName; document.getElementById('match-location').value = data.location;
                if(data.location === 'home') { document.getElementById('match-my-team-score').value = data.homeScore; document.getElementById('match-opponent-score').value = data.awayScore; }
                else { document.getElementById('match-my-team-score').value = data.awayScore; document.getElementById('match-opponent-score').value = data.homeScore; }
                document.getElementById('delete-match-btn').style.display = 'block';
            } else { document.getElementById('match-id').value = ""; document.getElementById('delete-match-btn').style.display = 'none'; }
            this.get('matchResultModal').show();
        },
        openGps(id) {
            const a = DashboardApp.state.athletes.find(x => String(x.id) === String(id));
            document.getElementById('modal-athlete-name-gps').textContent = a.name;
            document.getElementById('modal-athlete-id-gps').value = id;
            this.get('gpsModal').show();
        }
    },

    init() {
        this.Data.load().then(success => {
            if(success) this.Data.startPolling(); // Avvia polling solo se connesso
            this.UI.renderAll();
            this.Events.init();
            document.getElementById('athlete-avatar-input').addEventListener('change', function() {
                if(this.files && this.files[0]) {
                    const reader = new FileReader();
                    reader.onload = e => document.getElementById('athlete-avatar-base64').value = e.target.result;
                    reader.readAsDataURL(this.files[0]);
                }
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => DashboardApp.init());