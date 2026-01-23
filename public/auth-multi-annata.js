// auth-multi-annata.js - Sistema autenticazione con gestione annate - VERSIONE FINALE
(function() {
    'use strict';

    // ==========================================
    // CONFIGURAZIONE
    // ==========================================
    
    const SESSION_KEY = 'gosport_auth_session';
    const SESSION_USER = 'gosport_auth_user';
    const SESSION_ANNATA = 'gosport_current_annata';
    const SESSION_USER_ROLE = 'gosport_user_role';

    // ==========================================
    // VERIFICA MODALITÀ GENITORE (SENZA AUTH)
    // ==========================================
    
    function isParentMode() {
        const path = window.location.pathname;
        const search = window.location.search;
        
        // Verifica se siamo in una pagina che non richiede autenticazione
        // 1. Path esplicito /presenza/
        if (path.includes('/presenza/')) {
            return true;
        }
        
        // 2. Qualsiasi pagina con parametro athleteId (link genitore)
        if (search.includes('athleteId=')) {
            return true;
        }
        
        // 3. calendario.html con parametro (modalità genitore)
        if (path.includes('calendario.html') && search.length > 0) {
            return true;
        }
        
        return false;
    }

    // ==========================================
    // BLOCCO RENDERING PREVENTIVO
    // ==========================================
    
    function initAuth() {
        // SE MODALITÀ GENITORE, NON APPLICARE AUTENTICAZIONE
        if (isParentMode()) {
            console.log('🔓 Modalità Genitore - Accesso libero');
            return; // Esci subito, lascia la pagina normale
        }
        
        // Verifica immediata dello stato di autenticazione
        const session = sessionStorage.getItem(SESSION_KEY);
        const expiry = sessionStorage.getItem(SESSION_KEY + '_expiry');
        const now = Date.now();
        const isCurrentlyAuthenticated = session === 'true' && expiry && now <= parseInt(expiry);
        
        // Salva il contenuto originale solo se esiste
        const originalBodyHTML = document.body ? document.body.innerHTML : '';
        
        // Se NON autenticato, svuota COMPLETAMENTE il body
        if (!isCurrentlyAuthenticated && document.body) {
            document.body.innerHTML = '';
            document.body.style.cssText = 'margin:0;padding:0;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;';
        }

        // ==========================================
        // UTILITY FUNCTIONS
        // ==========================================
        
        function isAuthenticated() {
            const session = sessionStorage.getItem(SESSION_KEY);
            const expiry = sessionStorage.getItem(SESSION_KEY + '_expiry');
            
            if (!session || !expiry) return false;
            
            const now = Date.now();
            if (now > parseInt(expiry)) {
                logout();
                return false;
            }
            
            return session === 'true';
        }

        function hasSelectedAnnata() {
            return sessionStorage.getItem(SESSION_ANNATA) !== null;
        }

        function getCurrentAnnata() {
            return sessionStorage.getItem(SESSION_ANNATA);
        }

        function getCurrentUser() {
            return sessionStorage.getItem(SESSION_USER);
        }

        function getUserRole() {
            return sessionStorage.getItem(SESSION_USER_ROLE) || 'user';
        }

        function isAdmin() {
            return getUserRole() === 'admin';
        }

        function logout() {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY + '_expiry');
            sessionStorage.removeItem(SESSION_USER);
            sessionStorage.removeItem(SESSION_ANNATA);
            sessionStorage.removeItem(SESSION_USER_ROLE);
        }

        // ==========================================
        // API CALLS
        // ==========================================
        
        async function loginUser(username, password) {
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Credenziali non valide');
                }
                
                const data = await response.json();
                return data;
            } catch (error) {
                throw error;
            }
        }

        async function getUserAnnate(username) {
            try {
                const response = await fetch(`/api/annate/user-annate?username=${username}`);
                
                if (!response.ok) {
                    throw new Error('Errore nel recupero delle annate');
                }
                
                const data = await response.json();
                return data.annate || [];
            } catch (error) {
                console.error('Errore getUserAnnate:', error);
                return [];
            }
        }

        async function getAllAnnate() {
            try {
                const response = await fetch('/api/annate/list');
                
                if (!response.ok) {
                    throw new Error('Errore nel recupero delle annate');
                }
                
                const data = await response.json();
                return data.annate || [];
            } catch (error) {
                console.error('Errore getAllAnnate:', error);
                return [];
            }
        }

        // ==========================================
        // UI - LOGIN SCREEN
        // ==========================================
        
        function showLoginScreen() {
            // Pulisci il body
            document.body.innerHTML = '';
            document.body.style.cssText = 'margin:0;padding:0;font-family:system-ui;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;';
            
            const container = document.createElement('div');
            container.style.cssText = 'background:rgba(30,41,59,0.95);padding:40px;border-radius:15px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:400px;width:90%;border:1px solid rgba(96,165,250,0.2);';
            
            container.innerHTML = `
                <div style="text-align:center;margin-bottom:30px;">
                    <div style="font-size:48px;margin-bottom:10px;">🏃‍♂️</div>
                    <h1 style="color:#60a5fa;margin:0 0 10px 0;font-size:28px;font-weight:700;">GO SPORT</h1>
                    <p style="color:#94a3b8;margin:0;">Coach Dashboard</p>
                </div>
                
                <form id="login-form" style="display:flex;flex-direction:column;gap:20px;">
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;font-weight:500;display:block;margin-bottom:8px;">
                            Username
                        </label>
                        <input 
                            type="text" 
                            id="username" 
                            placeholder="Inserisci username"
                            autocomplete="username"
                            style="width:100%;padding:12px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;font-size:16px;box-sizing:border-box;"
                        />
                    </div>
                    
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;font-weight:500;display:block;margin-bottom:8px;">
                            Password
                        </label>
                        <input 
                            type="password" 
                            id="password" 
                            placeholder="Inserisci password"
                            autocomplete="current-password"
                            style="width:100%;padding:12px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;font-size:16px;box-sizing:border-box;"
                        />
                    </div>
                    
                    <div id="error" style="color:#ef4444;font-size:14px;text-align:center;min-height:20px;"></div>
                    
                    <button 
                        type="submit"
                        style="background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);color:#fff;padding:14px;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:transform 0.2s;"
                        onmouseover="this.style.transform='scale(1.02)'"
                        onmouseout="this.style.transform='scale(1)'"
                    >
                        🔓 Accedi
                    </button>
                </form>
                
                <div style="margin-top:30px;padding-top:20px;border-top:1px solid rgba(96,165,250,0.2);">
                    <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">
                        👤 Sei un genitore?<br>
                        Usa il link ricevuto dal coach
                    </p>
                </div>
            `;
            
            document.body.appendChild(container);
            
            const form = document.getElementById('login-form');
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const errorDiv = document.getElementById('error');
            
            usernameInput.focus();
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = usernameInput.value.trim();
                const password = passwordInput.value;
                
                if (!username || !password) {
                    errorDiv.textContent = '⚠️ Compila tutti i campi';
                    return;
                }
                
                errorDiv.textContent = '⏳ Accesso in corso...';
                errorDiv.style.color = '#60a5fa';
                
                try {
                    const result = await loginUser(username, password);
                    
                    if (result.success) {
                        sessionStorage.setItem(SESSION_KEY, 'true');
                        sessionStorage.setItem(SESSION_USER, username);
                        sessionStorage.setItem(SESSION_USER_ROLE, result.role);
                        
                        const expiry = Date.now() + (8 * 60 * 60 * 1000);
                        sessionStorage.setItem(SESSION_KEY + '_expiry', expiry.toString());
                        
                        errorDiv.textContent = '✅ Login effettuato!';
                        errorDiv.style.color = '#10b981';
                        
                        setTimeout(() => showAnnataSelection(), 500);
                    } else {
                        errorDiv.textContent = '❌ Credenziali non valide';
                        errorDiv.style.color = '#ef4444';
                    }
                } catch (error) {
                    errorDiv.textContent = '❌ ' + error.message;
                    errorDiv.style.color = '#ef4444';
                }
            });
        }

        // ==========================================
        // UI - ANNATA SELECTION
        // ==========================================
        
        function showAnnataSelection() {
            document.body.innerHTML = '';
            document.body.style.cssText = 'margin:0;padding:0;font-family:system-ui;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;';
            
            const container = document.createElement('div');
            container.style.cssText = 'background:rgba(30,41,59,0.95);padding:40px;border-radius:15px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:600px;width:100%;border:1px solid rgba(96,165,250,0.2);';
            
            const username = getCurrentUser();
            const role = getUserRole();
            
            container.innerHTML = `
                <div style="text-align:center;margin-bottom:30px;">
                    <div style="font-size:48px;margin-bottom:10px;">📅</div>
                    <h1 style="color:#60a5fa;margin:0 0 10px 0;font-size:28px;font-weight:700;">Seleziona Annata</h1>
                    <p style="color:#94a3b8;margin:0;">Bentornato, <strong style="color:#60a5fa;">${username}</strong></p>
                    ${role === 'admin' ? '<p style="color:#f59e0b;margin:5px 0 0 0;font-size:13px;">👑 Modalità Amministratore</p>' : ''}
                </div>
                
                <div id="annate-list" style="display:flex;flex-direction:column;gap:15px;margin-bottom:20px;">
                    <div style="text-align:center;color:#94a3b8;padding:40px;">
                        <div style="font-size:32px;margin-bottom:10px;">⏳</div>
                        <p>Caricamento annate...</p>
                    </div>
                </div>
                
                ${role === 'admin' ? `
                <div style="margin-top:30px;padding-top:20px;border-top:1px solid rgba(96,165,250,0.2);">
                    <button 
                        id="manage-users-btn"
                        style="width:100%;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#fff;padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:transform 0.2s;"
                        onmouseover="this.style.transform='scale(1.02)'"
                        onmouseout="this.style.transform='scale(1)'"
                    >
                        ⚙️ Gestione Utenti e Annate
                    </button>
                </div>
                ` : ''}
                
                <div style="margin-top:20px;text-align:center;">
                    <button 
                        id="logout-btn-annata"
                        style="background:transparent;color:#ef4444;border:1px solid #ef4444;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;"
                    >
                        🚪 Esci
                    </button>
                </div>
            `;
            
            document.body.appendChild(container);
            
            loadUserAnnate();
            
            const logoutBtn = document.getElementById('logout-btn-annata');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    if (confirm('Vuoi uscire?')) {
                        logout();
                        window.location.reload();
                    }
                });
            }
            
            const manageUsersBtn = document.getElementById('manage-users-btn');
            if (manageUsersBtn) {
                manageUsersBtn.addEventListener('click', () => showAdminPanel());
            }
        }

        async function loadUserAnnate() {
            const username = getCurrentUser();
            const role = getUserRole();
            const listDiv = document.getElementById('annate-list');
            
            if (!listDiv) return;
            
            try {
                let annate;
                
        if (role === 'admin' || role === 'supercoach') {
            annate = await getAllAnnate();
                } else {
                    const userAnnate = await getUserAnnate(username);
                    const allAnnate = await getAllAnnate();
                    annate = allAnnate.filter(a => userAnnate.includes(a.id));
                }
                
                if (annate.length === 0) {
                    listDiv.innerHTML = `
                        <div style="text-align:center;color:#94a3b8;padding:40px;">
                            <div style="font-size:32px;margin-bottom:10px;">📭</div>
                            <p>Nessuna annata disponibile</p>
                            <p style="font-size:13px;margin-top:10px;">Contatta l'amministratore</p>
                        </div>
                    `;
                    return;
                }
                
                listDiv.innerHTML = '';
                
                annate.forEach(annata => {
                    const annataCard = document.createElement('div');
                    annataCard.style.cssText = 'background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:20px;border-radius:12px;cursor:pointer;border:2px solid rgba(96,165,250,0.2);transition:all 0.3s;';
                    
                    annataCard.innerHTML = `
                        <h3 style="color:#60a5fa;margin:0 0 8px 0;font-size:20px;">${annata.nome}</h3>
                        <p style="color:#94a3b8;margin:0;font-size:14px;">📅 ${annata.dataInizio} - ${annata.dataFine}</p>
                    `;
                    
                    annataCard.onmouseover = function() {
                        this.style.borderColor = '#60a5fa';
                        this.style.transform = 'translateY(-2px)';
                        this.style.boxShadow = '0 4px 12px rgba(96,165,250,0.3)';
                    };
                    
                    annataCard.onmouseout = function() {
                        this.style.borderColor = 'rgba(96,165,250,0.2)';
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = 'none';
                    };
                    
                    annataCard.onclick = () => selectAnnata(annata.id);
                    
                    listDiv.appendChild(annataCard);
                });
                
            } catch (error) {
                listDiv.innerHTML = `
                    <div style="text-align:center;color:#ef4444;padding:40px;">
                        <div style="font-size:32px;margin-bottom:10px;">⚠️</div>
                        <p>Errore nel caricamento</p>
                        <p style="font-size:13px;margin-top:10px;">${error.message}</p>
                    </div>
                `;
            }
        }

        function selectAnnata(annataId) {
            sessionStorage.setItem(SESSION_ANNATA, annataId);
            window.location.reload();
        }
            
        // ==========================================
        // UI - ADMIN PANEL CON GESTIONE ANNATE
        // ==========================================
        
        function showAdminPanel() {
          const username = getCurrentUser();
          const container = document.createElement('div');
          container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;overflow-y:auto;';
          const panel = document.createElement('div');
          panel.style.cssText = 'background:rgba(30,41,59,0.95);padding:30px;border-radius:15px;max-width:700px;width:90%;max-height:85vh;overflow-y:auto;border:1px solid rgba(96,165,250,0.2);margin:20px;';
          panel.innerHTML = '<h2 style="color:#60a5fa;margin-top:0">⚙️ Pannello Admin</h2><p style="color:#94a3b8">Admin: <strong>'+username+'</strong></p><div style="display:flex;gap:8px;margin:15px 0;border-bottom:1px solid rgba(96,165,250,0.2);padding-bottom:12px"><button class="tab-btn" data-tab="utenti" style="background:#3b82f6;color:#fff;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">👥 Utenti</button><button class="tab-btn" data-tab="annate" style="background:transparent;color:#60a5fa;border:1px solid #60a5fa;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">📅 Annate</button><button class="tab-btn" data-tab="abbina" style="background:transparent;color:#60a5fa;border:1px solid #60a5fa;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">🔗 Abbina</button></div><div id="tab-utenti" class="tab-content" style="display:block"><div style="background:rgba(15,23,42,0.6);padding:18px;border-radius:10px;margin:15px 0"><h3 style="color:#60a5fa;font-size:16px;margin:0 0 12px 0">➕ Aggiungi Utente</h3><form id="add-user-form" style="display:flex;flex-direction:column;gap:10px"><input type="text" id="new-username" placeholder="Username" required style="padding:9px;border:1px solid rgba(96,165,250,0.3);border-radius:5px;background:#0f172a;color:#fff;font-size:14px"><input type="password" id="new-password" placeholder="Password" required style="padding:9px;border:1px solid rgba(96,165,250,0.3);border-radius:5px;background:#0f172a;color:#fff;font-size:14px"><select id="new-role" style="padding:9px;border:1px solid rgba(96,165,250,0.3);border-radius:5px;background:#0f172a;color:#fff;font-size:14px"><option value="user">Utente</option><option value="allenatore">Allenatore</option><option value="supercoach">Super Coach</option><option value="admin">Admin</option></select><button type="submit" style="background:#3b82f6;color:#fff;padding:9px;border:none;border-radius:5px;cursor:pointer;font-weight:600;font-size:14px">Crea</button><div id="add-user-msg" style="color:#10b981;font-size:12px;text-align:center;min-height:16px"></div></form></div><div style="background:rgba(15,23,42,0.6);padding:18px;border-radius:10px"><h3 style="color:#60a5fa;font-size:16px;margin:0 0 12px 0">📋 Utenti</h3><div id="users-list" style="max-height:250px;overflow-y:auto;color:#94a3b8;font-size:12px"><p>Caricamento...</p></div></div></div><div id="tab-annate" class="tab-content" style="display:none"><div style="background:rgba(15,23,42,0.6);padding:18px;border-radius:10px;margin:15px 0"><h3 style="color:#60a5fa;font-size:16px;margin:0 0 12px 0">➕ Crea Annata</h3><form id="add-annata-form" style="display:flex;flex-direction:column;gap:10px"><input type="text" id="annata-nome" placeholder="Nome (es: 2013)" required style="padding:9px;border:1px solid rgba(96,165,250,0.3);border-radius:5px;background:#0f172a;color:#fff;font-size:14px"><input type="text" id="annata-desc" placeholder="Descrizione" style="padding:9px;border:1px solid rgba(96,165,250,0.3);border-radius:5px;background:#0f172a;color:#fff;font-size:14px"><button type="submit" style="background:#10b981;color:#fff;padding:9px;border:none;border-radius:5px;cursor:pointer;font-weight:600;font-size:14px">Crea</button><div id="add-annata-msg" style="color:#10b981;font-size:12px;text-align:center;min-height:16px"></div></form></div><div style="background:rgba(15,23,42,0.6);padding:18px;border-radius:10px"><h3 style="color:#60a5fa;font-size:16px;margin:0 0 12px 0">📅 Annate</h3><div id="annate-list" style="max-height:250px;overflow-y:auto;color:#94a3b8;font-size:12px"><p>Caricamento...</p></div></div></div><div id="tab-abbina" class="tab-content" style="display:none"><div style="background:rgba(15,23,42,0.6);padding:18px;border-radius:10px"><h3 style="color:#60a5fa;font-size:16px;margin:0 0 12px 0">🔗 Abbina Utente</h3><form id="assign-form" style="display:flex;flex-direction:column;gap:10px"><select id="assign-user" required style="padding:9px;border:1px solid rgba(96,165,250,0.3);border-radius:5px;background:#0f172a;color:#fff;font-size:14px"><option value="">Seleziona Utente...</option></select><select id="assign-annata" required style="padding:9px;border:1px solid rgba(96,165,250,0.3);border-radius:5px;background:#0f172a;color:#fff;font-size:14px"><option value="">Seleziona Annata...</option></select><button type="submit" style="background:#f59e0b;color:#fff;padding:9px;border:none;border-radius:5px;cursor:pointer;font-weight:600;font-size:14px">Abbina</button><div id="assign-msg" style="color:#10b981;font-size:12px;text-align:center;min-height:16px"></div></form><div style="margin-top:15px;padding:18px;background:rgba(15,23,42,0.6);border-radius:10px"><h3 style="color:#60a5fa;font-size:16px;margin:0 0 12px 0">📊 Abbinamenti</h3><div id="assignments-list" style="max-height:250px;overflow-y:auto;color:#94a3b8;font-size:12px"><p>Caricamento...</p></div></div></div></div><div style="text-align:center;margin-top:18px;padding-top:15px;border-top:1px solid rgba(96,165,250,0.2)"><button id="close-admin" style="background:transparent;color:#ef4444;border:1px solid #ef4444;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px">🚪 Chiudi</button></div>';
          container.appendChild(panel);document.body.appendChild(container);
          document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',e=>{document.querySelectorAll('.tab-content').forEach(t=>t.style.display='none');document.getElementById('tab-'+e.target.dataset.tab).style.display='block';document.querySelectorAll('.tab-btn').forEach(x=>{x.style.background='transparent';x.style.color='#60a5fa';x.style.border='1px solid #60a5fa'});e.target.style.background='#3b82f6';e.target.style.color='#fff';e.target.style.border='none'}));
          document.getElementById('add-user-form').addEventListener('submit',async e=>{e.preventDefault();const u=document.getElementById('new-username').value.trim(),p=document.getElementById('new-password').value,r=document.getElementById('new-role').value,m=document.getElementById('add-user-msg');if(!u||!p){m.textContent='❌ Riempi tutti i campi';m.style.color='#ef4444';return}try{const res=await fetch('/api/auth/create-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,role:r})});const d=await res.json();if(res.ok){m.textContent='✅ '+d.message;m.style.color='#10b981';document.getElementById('add-user-form').reset();loadUsersList();loadAssignSelects()}else{m.textContent='❌ '+d.message;m.style.color='#ef4444'}}catch(err){m.textContent='❌ '+err.message;m.style.color='#ef4444'}});
          document.getElementById('add-annata-form').addEventListener('submit',async e=>{e.preventDefault();const n=document.getElementById('annata-nome').value.trim(),d=document.getElementById('annata-desc').value.trim(),m=document.getElementById('add-annata-msg');if(!n){m.textContent='❌ Inserisci nome';m.style.color='#ef4444';return}try{const res=await fetch('/api/annate/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:n,descrizione:d})});const data=await res.json();if(res.ok){m.textContent='✅ Annata creata!';m.style.color='#10b981';document.getElementById('add-annata-form').reset();loadAnnateList();loadAssignSelects()}else{m.textContent='❌ '+data.message;m.style.color='#ef4444'}}catch(err){m.textContent='❌ '+err.message;m.style.color='#ef4444'}});
          document.getElementById('assign-form').addEventListener('submit',async e=>{e.preventDefault();const u=document.getElementById('assign-user').value,a=document.getElementById('assign-annata').value,m=document.getElementById('assign-msg');if(!u||!a){m.textContent='❌ Seleziona entrambi';m.style.color='#ef4444';return}try{const res=await fetch('/api/annate/assign-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,annataId:a})});const d=await res.json();if(res.ok){m.textContent='✅ Abbinamento creato!';m.style.color='#10b981';loadAssignments()}else{m.textContent='❌ '+d.message;m.style.color='#ef4444'}}catch(err){m.textContent='❌ '+err.message;m.style.color='#ef4444'}});
          async function loadUsersList(){const l=document.getElementById('users-list');try{const res=await fetch('/api/auth/list-users');const d=await res.json();if(d.users?.length>0){l.innerHTML=d.users.map(u=>'<div style="padding:8px;background:rgba(30,41,59,0.5);margin:6px 0;border-radius:6px;display:flex;justify-content:space-between"><div><strong>'+u.username+'</strong> ('+u.role+')</div>'+(u.username!=='admin'?'<button onclick="delUser(\''+u.username+'\')" style="background:#ef4444;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px">Elimina</button>':'')+'</div>').join('')}else{l.innerHTML='<p>Nessun utente</p>'}}catch(err){l.innerHTML='<p style="color:#ef4444">Errore: '+err.message+'</p>'}}
              async function loadAnnateList(){const l=document.getElementById('annate-list');try{const res=await fetch('/api/annate/list');const d=await res.json();if(d.annate?.length>0){l.innerHTML=d.annate.map(a=>'<div style="padding:8px;background:rgba(30,41,59,0.5);margin:6px 0;border-radius:6px;display:flex;justify-content:space-between"><div><strong>'+a.nome+'</strong><br><small>'+a.descrizione+'</small></div><button onclick="delAnnata(\''+a.id+'\')" style="background:#ef4444;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px">Elimina</button></div>').join('')}else{l.innerHTML='<p>Nessuna annata</p>'}}catch(err){l.innerHTML='<p style="color:#ef4444">Errore: '+err.message+'</p>'}}
          async function loadAssignSelects(){try{const[u,a]=await Promise.all([fetch('/api/auth/list-users'),fetch('/api/annate/list')]);const users=await u.json(),annate=await a.json();document.getElementById('assign-user').innerHTML='<option value="">Seleziona...</option>'+users.users.map(x=>'<option value="'+x.username+'">'+x.username+' ('+x.role+')</option>').join('');document.getElementById('assign-annata').innerHTML='<option value="">Seleziona...</option>'+annate.annate.map(x=>'<option value="'+x.id+'">'+x.nome+'</option>').join('')}catch(err){console.error('Errore caricamento select',err)}}
          async function loadAssignments(){const l=document.getElementById('assignments-list');try{const res=await fetch('/api/auth/list-users');const d=await res.json();if(d.users?.length>0){const items=d.users.filter(u=>u.annate&&u.annate.length>0).map(u=>'<div style="padding:8px;background:rgba(30,41,59,0.5);margin:6px 0;border-radius:6px"><strong>'+u.username+'</strong>: '+u.annate.length+' annate</div>').join('');l.innerHTML=items||'<p>Nessun abbinamento</p>'}else{l.innerHTML='<p>Nessun dato</p>'}}catch(err){l.innerHTML='<p style="color:#ef4444">Errore: '+err.message+'</p>'}}
          window.delUser=async u=>{if(!confirm('Eliminare '+u+'?'))return;try{const res=await fetch('/api/auth/delete-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u})});if(res.ok){alert('✅ Eliminato');loadUsersList();loadAssignSelects()}else{alert('❌ Errore')}}catch(err){alert('❌ '+err.message)}};
          window.delAnnata=async a=>{if(!confirm('Eliminare annata?'))return;try{const res=await fetch('/api/annate/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({annataId:a})});if(res.ok){alert('✅ Eliminata');loadAnnateList();loadAssignSelects()}else{alert('❌ Errore')}}catch(err){alert('❌ '+err.message)}};
          document.getElementById('close-admin').addEventListener('click',()=>container.remove());
          loadUsersList();loadAnnateList();loadAssignSelects();loadAssignments();
        }

        // ==========================================
        // UI - LOGOUT BUTTON IN APP
        // ==========================================
        
        function addLogoutButton() {
    setTimeout(() => {
        const username = getCurrentUser();
        const annata = getCurrentAnnata();
        if (!username) return;
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            // Modifica contenuto bottone
            logoutBtn.innerHTML = `
                <span>👤 ${username} | ${annata || 'N/A'}</span>
                <span style="margin-left: 10px; border-left: 1px solid rgba(255,255,255,0.3); padding-left: 10px; cursor: pointer;" id="change-annata-btn" title="Cambia Annata">🔄</span>
            `;
            logoutBtn.style.display = 'inline-block';
            
            // Click sul bottone principale = logout
            logoutBtn.onclick = (e) => {
                // Se ha cliccato sul cambio annata, non fare logout
                if (e.target.id === 'change-annata-btn' || e.target.closest('#change-annata-btn')) {
                    sessionStorage.removeItem(SESSION_ANNATA);
                    window.location.reload();
                } else {
                    if (confirm('Vuoi uscire?')) {
                        logout();
                        window.location.reload();
                    }
                }
            };
        }
    }, 100);
}

        // ==========================================
        // FETCH INTERCEPTOR
        // ==========================================
        
        function setupFetchInterceptor() {
            const originalFetch = window.fetch;
            
            window.fetch = function(...args) {
                const [url, options = {}] = args;
                
                if (url && url.includes('/api/data')) {
                    const currentAnnata = getCurrentAnnata();
                    
                    if (currentAnnata) {
                        options.headers = options.headers || {};
                        
                        if (options.headers instanceof Headers) {
                            options.headers.set('X-Annata-Id', currentAnnata);
                        } else {
                            options.headers['X-Annata-Id'] = currentAnnata;
                        }
                    }
                }
                
                return originalFetch.apply(this, [url, options]);
            };
        }

        // ==========================================
        // MAIN FLOW
        // ==========================================

        if (!isAuthenticated()) {
            showLoginScreen();
        } else if (!hasSelectedAnnata()) {
            showAnnataSelection();
        } else {
            // Ripristina il contenuto originale
            if (originalBodyHTML) {
                document.body.innerHTML = originalBodyHTML;
            }
            
            document.documentElement.classList.add('authenticated');
            setupFetchInterceptor();
            addLogoutButton();
            
            // Esponi funzioni globali
            window.getCurrentAnnata = getCurrentAnnata;
            window.getCurrentUser = getCurrentUser;
            window.getUserRole = getUserRole;
            window.isAdmin = isAdmin;
        }
    }

    // ==========================================
    // INIZIALIZZAZIONE CON CONTROLLO MODALITÀ
    // ==========================================
    
    // Aspetta che il DOM sia caricato
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }

})();
