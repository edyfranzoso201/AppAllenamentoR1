// auth-multi-annata.js - Sistema autenticazione con gestione annate - VERSIONE SICURA
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
    // BLOCCO RENDERING PREVENTIVO
    // ==========================================
    
    // CRITICO: Blocca il rendering di TUTTO il body fino all'autenticazione
    const originalBodyHTML = document.body.innerHTML;
    
    // Verifica immediata all'avvio
    const session = sessionStorage.getItem(SESSION_KEY);
    const expiry = sessionStorage.getItem(SESSION_KEY + '_expiry');
    const now = Date.now();
    const isCurrentlyAuthenticated = session === 'true' && expiry && now <= parseInt(expiry);
    
    // Se NON autenticato, svuota COMPLETAMENTE il body
    if (!isCurrentlyAuthenticated) {
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
            return data; // { success: true, user: {...}, role: 'admin' | 'user' }
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
            return data.annate || []; // Array di annate autorizzate
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
        // SICUREZZA: Svuota completamente il DOM prima di mostrare il login
        document.documentElement.innerHTML = '';
        
        // Ricrea head e body
        const head = document.createElement('head');
        head.innerHTML = `
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login - Coach Dashboard</title>
        `;
        
        const body = document.createElement('body');
        body.style.cssText = 'margin:0;padding:0;font-family:system-ui;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;';
        
        document.documentElement.appendChild(head);
        document.documentElement.appendChild(body);
        
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
        
        body.appendChild(container);
        
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
                    // Salva sessione
                    sessionStorage.setItem(SESSION_KEY, 'true');
                    sessionStorage.setItem(SESSION_USER, username);
                    sessionStorage.setItem(SESSION_USER_ROLE, result.role);
                    
                    // Imposta scadenza sessione (8 ore)
                    const expiry = Date.now() + (8 * 60 * 60 * 1000);
                    sessionStorage.setItem(SESSION_KEY + '_expiry', expiry.toString());
                    
                    errorDiv.textContent = '✅ Login effettuato!';
                    errorDiv.style.color = '#10b981';
                    
                    // Mostra selezione annata
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
        // SICUREZZA: Svuota completamente il DOM
        document.documentElement.innerHTML = '';
        
        const head = document.createElement('head');
        head.innerHTML = `
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Selezione Annata - Coach Dashboard</title>
        `;
        
        const body = document.createElement('body');
        body.style.cssText = 'margin:0;padding:0;font-family:system-ui;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;';
        
        document.documentElement.appendChild(head);
        document.documentElement.appendChild(body);
        
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
        
        body.appendChild(container);
        
        // Carica annate
        loadUserAnnate();
        
        // Event listeners
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
            
            if (role === 'admin') {
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
        
        // SICUREZZA: Solo ora ricarichiamo la pagina per mostrare il contenuto
        window.location.reload();
    }

    // ==========================================
    // UI - ADMIN PANEL
    // ==========================================
    
    function showAdminPanel() {
        document.documentElement.innerHTML = '';
        
        const head = document.createElement('head');
        head.innerHTML = `
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin Panel - Coach Dashboard</title>
        `;
        
        const body = document.createElement('body');
        body.style.cssText = 'margin:0;padding:20px;font-family:system-ui;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;color:#e2e8f0;';
        
        document.documentElement.appendChild(head);
        document.documentElement.appendChild(body);
        
        const container = document.createElement('div');
        container.style.cssText = 'max-width:1200px;margin:0 auto;';
        
        container.innerHTML = `
            <div style="background:rgba(30,41,59,0.95);padding:30px;border-radius:15px;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid rgba(96,165,250,0.2);margin-bottom:30px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h1 style="color:#60a5fa;margin:0;font-size:32px;">⚙️ Pannello Amministratore</h1>
                    <button 
                        id="back-btn"
                        style="background:#64748b;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;"
                    >
                        ← Torna Indietro
                    </button>
                </div>
            </div>
            
            <!-- GESTIONE ANNATE -->
            <div style="background:rgba(30,41,59,0.95);padding:30px;border-radius:15px;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid rgba(96,165,250,0.2);margin-bottom:30px;">
                <h2 style="color:#60a5fa;margin:0 0 20px 0;">📅 Gestione Annate</h2>
                
                <div style="background:#0f172a;padding:20px;border-radius:8px;margin-bottom:20px;">
                    <h3 style="color:#e2e8f0;margin:0 0 15px 0;font-size:18px;">Crea Nuova Annata</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;">
                        <input 
                            type="text" 
                            id="new-annata-nome" 
                            placeholder="Nome annata (es. 2024-2025)"
                            style="padding:10px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#fff;font-size:14px;"
                        />
                        <input 
                            type="date" 
                            id="new-annata-inizio"
                            style="padding:10px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#fff;font-size:14px;"
                        />
                        <input 
                            type="date" 
                            id="new-annata-fine"
                            style="padding:10px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#fff;font-size:14px;"
                        />
                        <button 
                            id="create-annata-btn"
                            style="background:#10b981;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;"
                        >
                            + Crea Annata
                        </button>
                    </div>
                </div>
                
                <div id="annate-admin-list" style="display:flex;flex-direction:column;gap:15px;">
                    <div style="text-align:center;color:#94a3b8;padding:40px;">
                        <div style="font-size:32px;margin-bottom:10px;">⏳</div>
                        <p>Caricamento annate...</p>
                    </div>
                </div>
            </div>
            
            <!-- GESTIONE UTENTI -->
            <div style="background:rgba(30,41,59,0.95);padding:30px;border-radius:15px;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid rgba(96,165,250,0.2);">
                <h2 style="color:#60a5fa;margin:0 0 20px 0;">👥 Gestione Utenti</h2>
                
                <div style="background:#0f172a;padding:20px;border-radius:8px;margin-bottom:20px;">
                    <h3 style="color:#e2e8f0;margin:0 0 15px 0;font-size:18px;">Crea Nuovo Utente</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;">
                        <input 
                            type="text" 
                            id="new-user-username" 
                            placeholder="Username"
                            style="padding:10px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#fff;font-size:14px;"
                        />
                        <input 
                            type="password" 
                            id="new-user-password" 
                            placeholder="Password"
                            style="padding:10px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#fff;font-size:14px;"
                        />
                        <select 
                            id="new-user-role"
                            style="padding:10px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#fff;font-size:14px;"
                        >
                            <option value="user">👤 Utente</option>
                            <option value="admin">👑 Admin</option>
                        </select>
                        <button 
                            id="create-user-btn"
                            style="background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;"
                        >
                            + Crea Utente
                        </button>
                    </div>
                </div>
                
                <div id="users-list" style="display:flex;flex-direction:column;gap:15px;">
                    <div style="text-align:center;color:#94a3b8;padding:40px;">
                        <div style="font-size:32px;margin-bottom:10px;">⏳</div>
                        <p>Caricamento utenti...</p>
                    </div>
                </div>
            </div>
        `;
        
        body.appendChild(container);
        
        // Event listeners
        document.getElementById('back-btn').addEventListener('click', () => {
            showAnnataSelection();
        });
        
        // Crea annata
        document.getElementById('create-annata-btn').addEventListener('click', async () => {
            const nome = document.getElementById('new-annata-nome').value.trim();
            const dataInizio = document.getElementById('new-annata-inizio').value;
            const dataFine = document.getElementById('new-annata-fine').value;
            
            if (!nome || !dataInizio || !dataFine) {
                alert('Compila tutti i campi');
                return;
            }
            
            try {
                const response = await fetch('/api/annate/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, dataInizio, dataFine })
                });
                
                if (!response.ok) throw new Error('Errore nella creazione');
                
                alert('✅ Annata creata con successo!');
                document.getElementById('new-annata-nome').value = '';
                document.getElementById('new-annata-inizio').value = '';
                document.getElementById('new-annata-fine').value = '';
                
                loadAllAnnate();
            } catch (error) {
                alert('❌ Errore: ' + error.message);
            }
        });
        
        // Crea utente
        document.getElementById('create-user-btn').addEventListener('click', async () => {
            const username = document.getElementById('new-user-username').value.trim();
            const password = document.getElementById('new-user-password').value;
            const role = document.getElementById('new-user-role').value;
            
            if (!username || !password) {
                alert('Username e password richiesti');
                return;
            }
            
            try {
                const response = await fetch('/api/auth/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, role })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message);
                }
                
                alert('✅ Utente creato con successo!');
                document.getElementById('new-user-username').value = '';
                document.getElementById('new-user-password').value = '';
                
                loadExistingUsers();
            } catch (error) {
                alert('❌ Errore: ' + error.message);
            }
        });
        
        // Carica dati
        loadAllAnnate();
        loadExistingUsers();
    }

    async function loadAllAnnate() {
        const listDiv = document.getElementById('annate-admin-list');
        if (!listDiv) return;
        
        try {
            const annate = await getAllAnnate();
            
            if (annate.length === 0) {
                listDiv.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">Nessuna annata presente</p>';
                return;
            }
            
            listDiv.innerHTML = '';
            
            annate.forEach(annata => {
                const card = document.createElement('div');
                card.style.cssText = 'background:#0f172a;padding:15px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid #334155;';
                
                card.innerHTML = `
                    <div>
                        <h4 style="margin:0;color:#60a5fa;">${annata.nome}</h4>
                        <p style="margin:5px 0 0 0;color:#94a3b8;font-size:13px;">📅 ${annata.dataInizio} - ${annata.dataFine}</p>
                    </div>
                    <button 
                        class="delete-annata-btn"
                        data-id="${annata.id}"
                        style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;"
                    >
                        🗑️ Elimina
                    </button>
                `;
                
                listDiv.appendChild(card);
            });
            
            // Event listeners per eliminazione
            document.querySelectorAll('.delete-annata-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const annataId = e.target.dataset.id;
                    
                    if (!confirm('Sei sicuro? Eliminare un\'annata eliminerà anche tutti i suoi dati!')) {
                        return;
                    }
                    
                    try {
                        const response = await fetch('/api/annate/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ annataId })
                        });
                        
                        if (!response.ok) throw new Error('Errore nell\'eliminazione');
                        
                        loadAllAnnate();
                    } catch (error) {
                        alert('Errore: ' + error.message);
                    }
                });
            });
            
        } catch (error) {
            listDiv.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;">Errore nel caricamento</p>';
        }
    }

    async function loadExistingUsers() {
        const listDiv = document.getElementById('users-list');
        if (!listDiv) return;
        
        try {
            const usersResponse = await fetch('/api/auth/list-users');
            const usersData = await usersResponse.json();
            const users = usersData.users || [];
            
            const annate = await getAllAnnate();
            
            listDiv.innerHTML = '';
            
            for (const user of users) {
                const userCard = document.createElement('div');
                userCard.style.cssText = 'background:#0f172a;padding:20px;border-radius:8px;border:1px solid #334155;';
                
                const userAnnate = user.annate || [];
                
                userCard.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:15px;">
                        <div>
                            <h4 style="margin:0;color:#e2e8f0;">${user.username}</h4>
                            <p style="margin:5px 0 0 0;color:#94a3b8;font-size:14px;">
                                ${user.role === 'admin' ? '👑 Amministratore' : '👤 Utente Standard'}
                            </p>
                        </div>
                        ${user.username !== 'admin' ? `
                        <button 
                            class="delete-user-btn"
                            data-username="${user.username}"
                            style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;"
                        >
                            🗑️ Elimina
                        </button>
                        ` : ''}
                    </div>
                    
                    <div>
                        <label style="display:block;margin-bottom:8px;color:#e2e8f0;font-weight:500;font-size:14px;">
                            Annate Autorizzate:
                        </label>
                        <div id="user-annate-${user.username}" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                            ${userAnnate.length === 0 ? '<span style="color:#94a3b8;font-size:13px;">Nessuna annata assegnata</span>' : 
                              userAnnate.map(a => `<span style="background:#3b82f6;color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;">${a}</span>`).join('')}
                        </div>
                        <select 
                            class="assign-annata-select"
                            data-username="${user.username}"
                            style="width:100%;padding:8px;border:1px solid #334155;border-radius:6px;background:#1e293b;color:#fff;font-size:14px;"
                        >
                            <option value="">+ Assegna annata...</option>
                            ${annate.filter(a => !userAnnate.includes(a.id)).map(a => 
                                `<option value="${a.id}">${a.nome}</option>`
                            ).join('')}
                        </select>
                    </div>
                `;
                
                listDiv.appendChild(userCard);
            }
            
            // Event listeners
            document.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const username = e.target.dataset.username;
                    if (confirm(`Sei sicuro di voler eliminare l'utente ${username}?`)) {
                        try {
                            const response = await fetch('/api/auth/delete-user', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username })
                            });
                            
                            if (!response.ok) throw new Error('Errore nell\'eliminazione');
                            
                            loadExistingUsers();
                        } catch (error) {
                            alert('Errore: ' + error.message);
                        }
                    }
                });
            });
            
            document.querySelectorAll('.assign-annata-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const username = e.target.dataset.username;
                    const annataId = e.target.value;
                    
                    if (!annataId) return;
                    
                    try {
                        const response = await fetch('/api/annate/assign-user', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, annataId })
                        });
                        
                        if (!response.ok) throw new Error('Errore nell\'assegnazione');
                        
                        loadExistingUsers();
                    } catch (error) {
                        alert('Errore: ' + error.message);
                    }
                });
            });
            
        } catch (error) {
            const listDiv = document.getElementById('users-list');
            listDiv.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;">Errore nel caricamento</p>';
        }
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
                logoutBtn.textContent = `👤 ${username} | ${annata || 'N/A'}`;
                logoutBtn.style.display = 'inline-block';
                logoutBtn.onclick = () => {
                    if (confirm('Vuoi uscire?')) {
                        logout();
                        window.location.reload();
                    }
                };
            }
        }, 100);
    }

    // ==========================================
    // FETCH INTERCEPTOR - Aggiunge automaticamente annata alle richieste
    // ==========================================
    
    function setupFetchInterceptor() {
        const originalFetch = window.fetch;
        
        window.fetch = function(...args) {
            const [url, options = {}] = args;
            
            // Se la richiesta è per /api/data, aggiungi l'header con l'annata
            if (url && url.includes('/api/data')) {
                const currentAnnata = getCurrentAnnata();
                
                if (currentAnnata) {
                    options.headers = options.headers || {};
                    
                    // Se headers è un oggetto Headers, usa set
                    if (options.headers instanceof Headers) {
                        options.headers.set('X-Annata-Id', currentAnnata);
                    } else {
                        // Altrimenti è un oggetto normale
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
    
    // Verifica se siamo in modalità presenza (non serve auth)
    const path = window.location.pathname;
    if (path.includes('/presenza/')) {
        // Ripristina il contenuto originale per le pagine di presenza
        if (!isCurrentlyAuthenticated) {
            document.body.innerHTML = originalBodyHTML;
        }
        return;
    }

    // Controlla autenticazione
    if (!isAuthenticated()) {
        showLoginScreen();
    } else if (!hasSelectedAnnata()) {
        showAnnataSelection();
    } else {
        // ✅ UTENTE AUTENTICATO E ANNATA SELEZIONATA
        // SICUREZZA: Ora possiamo ripristinare il contenuto originale
        if (originalBodyHTML) {
            document.body.innerHTML = originalBodyHTML;
        }
        
        // Mostra il contenuto rimuovendo il blocco CSS
        document.documentElement.classList.add('authenticated');
        
        // Setup interceptor per aggiungere annata alle richieste
        setupFetchInterceptor();
        
        addLogoutButton();
        
        // Esponi funzioni globali
        window.getCurrentAnnata = getCurrentAnnata;
        window.getCurrentUser = getCurrentUser;
        window.getUserRole = getUserRole;
        window.isAdmin = isAdmin;
    }

})();
