// auth-multi-annata.js - Sistema autenticazione con gestione annate
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
    // Crea un overlay di login
    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(30,41,59,0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        padding: 20px;
    `;
    
    overlay.innerHTML = `
        <div style="background:rgba(30,41,59,0.95);padding:40px;border-radius:15px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:400px;width:90%;border:1px solid rgba(96,165,250,0.2);">
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
        </div>
    `;
    
    document.body.appendChild(overlay);
    
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
        
        try {
            errorDiv.textContent = '⏳ Accesso in corso...';
            const result = await loginUser(username, password);
            
            // Login riuscito - salva sessione
            const expiry = Date.now() + (8 * 60 * 60 * 1000); // 8 ore
            sessionStorage.setItem(SESSION_KEY, 'true');
            sessionStorage.setItem(SESSION_KEY + '_expiry', expiry.toString());
            sessionStorage.setItem(SESSION_USER, username);
            sessionStorage.setItem(SESSION_USER_ROLE, result.role);
            
            // Nascondi l'overlay
            overlay.remove();
            
            // Mostra selezione annata
            showAnnataSelection();
            
        } catch (error) {
            errorDiv.textContent = '❌ ' + error.message;
            passwordInput.value = '';
            usernameInput.style.borderColor = '#ef4444';
            passwordInput.style.borderColor = '#ef4444';
            
            setTimeout(() => {
                errorDiv.textContent = '';
                usernameInput.style.borderColor = 'rgba(96,165,250,0.3)';
                passwordInput.style.borderColor = 'rgba(96,165,250,0.3)';
            }, 3000);
        }
    });
}

    // ==========================================
    // UI - ANNATA SELECTION SCREEN
    // ==========================================
    
    async function showAnnataSelection() {
    // Crea un overlay di selezione annata
    const overlay = document.createElement('div');
    overlay.id = 'annata-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(30,41,59,0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        padding: 20px;
    `;
    
    const username = getCurrentUser();
    const role = getUserRole();
    
    overlay.innerHTML = `
        <div style="background:rgba(30,41,59,0.95);padding:40px;border-radius:15px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:500px;width:90%;border:1px solid rgba(96,165,250,0.2);">
            <div style="text-align:center;margin-bottom:30px;">
                <div style="font-size:48px;margin-bottom:10px;">📅</div>
                <h1 style="color:#60a5fa;margin:0 0 10px 0;font-size:28px;font-weight:700;">Seleziona Annata</h1>
                <p style="color:#94a3b8;margin:0;">Benvenuto, <strong style="color:#60a5fa;">${username}</strong></p>
                ${role === 'admin' ? '<p style="color:#fbbf24;margin:5px 0 0 0;font-size:13px;">👑 Amministratore</p>' : ''}
            </div>
            
            <div id="annate-list" style="display:flex;flex-direction:column;gap:15px;margin-bottom:20px;">
                <div style="text-align:center;padding:40px;color:#94a3b8;">
                    <div class="spinner-border text-primary" role="status" style="width:40px;height:40px;"></div>
                    <p style="margin-top:15px;">Caricamento annate...</p>
                </div>
            </div>
            
            ${role === 'admin' ? `
            <div style="margin-top:30px;padding-top:20px;border-top:1px solid rgba(96,165,250,0.2);">
                <button 
                    id="admin-panel-btn"
                    style="width:100%;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#fff;padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:transform 0.2s;"
                    onmouseover="this.style.transform='scale(1.02)'"
                    onmouseout="this.style.transform='scale(1)'"
                >
                    ⚙️ Gestione Annate e Utenti
                </button>
            </div>
            ` : ''}
            
            <div style="margin-top:20px;text-align:center;">
                <button 
                    id="logout-btn"
                    style="background:transparent;color:#94a3b8;border:1px solid rgba(96,165,250,0.2);padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;"
                    onmouseover="this.style.color='#fff'"
                    onmouseout="this.style.color='#94a3b8'"
                >
                    🚪 Esci
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Carica annate
    try {
        let annate;
        if (role === 'admin') {
            annate = await getAllAnnate();
        } else {
            annate = await getUserAnnate(username);
        }
        
        const annateList = document.getElementById('annate-list');
        
        if (annate.length === 0) {
            annateList.innerHTML = `
                <div style="text-align:center;padding:40px;color:#94a3b8;">
                    <p>❌ Nessuna annata disponibile</p>
                    ${role !== 'admin' ? '<p style="font-size:13px;margin-top:10px;">Contatta l\'amministratore per ottenere l\'accesso</p>' : ''}
                </div>
            `;
        } else {
            annateList.innerHTML = '';
            
            annate.forEach(annata => {
                const annataBtn = document.createElement('button');
                annataBtn.style.cssText = 'background:rgba(59,130,246,0.1);border:1px solid rgba(96,165,250,0.3);color:#e2e8f0;padding:20px;border-radius:12px;cursor:pointer;text-align:left;transition:all 0.2s;';
                annataBtn.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <h3 style="margin:0;color:#60a5fa;font-size:20px;">${annata.nome}</h3>
                            <p style="margin:5px 0 0 0;color:#94a3b8;font-size:14px;">${annata.descrizione || 'Squadra ' + annata.nome}</p>
                        </div>
                        <span style="color:#60a5fa;font-size:16px;">→</span>
                    </div>
                `;
                
                annataBtn.addEventListener('click', () => {
                    // Salva l'annata selezionata
                    sessionStorage.setItem('gosport_current_annata', annata.id);
                    
                    // Nascondi l'overlay
                    overlay.remove();
                    
                    // Mostra il contenuto
                    document.getElementById('loading-screen').classList.add('hidden');
                    document.getElementById('app-content').style.display = 'block';
                });
                
                annateList.appendChild(annataBtn);
            });
        }
    } catch (error) {
        console.error('Errore nel caricamento delle annate:', error);
        const annateList = document.getElementById('annate-list');
        annateList.innerHTML = `
            <div style="text-align:center;padding:40px;color:#ef4444;">
                <p>❌ Errore nel caricamento delle annate</p>
                <p style="font-size:13px;margin-top:10px;">Riprova o contatta l'amministratore</p>
            </div>
        `;
    }
    
    // Gestisci logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.reload();
    });
    
    // Gestisci admin panel
    if (role === 'admin') {
        document.getElementById('admin-panel-btn').addEventListener('click', () => {
            // Mostra il pannello admin
            showAdminPanel();
        });
    }
}
    // ==========================================
    // UI - ADMIN PANEL
    // ==========================================
    
    async function showAdminPanel() {
        document.documentElement.innerHTML = '';
        document.body.style.cssText = 'margin:0;padding:0;font-family:system-ui;background:#f8f9fa;min-height:100vh;';
        
        const container = document.createElement('div');
        container.style.cssText = 'max-width:1200px;margin:0 auto;padding:20px;';
        
        container.innerHTML = `
            <div style="background:#fff;padding:30px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:30px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h1 style="margin:0;color:#1e293b;font-size:28px;">⚙️ Pannello Amministrazione</h1>
                    <button 
                        id="back-btn"
                        style="background:#6b7280;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;"
                    >
                        ← Torna alla selezione
                    </button>
                </div>
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px;">
                    <div style="background:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid #3b82f6;">
                        <h3 style="margin:0 0 15px 0;color:#1e293b;">📅 Gestione Annate</h3>
                        <button 
                            id="create-annata-btn"
                            style="width:100%;background:#3b82f6;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;"
                        >
                            + Crea Nuova Annata
                        </button>
                    </div>
                    
                    <div style="background:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid #f59e0b;">
                        <h3 style="margin:0 0 15px 0;color:#1e293b;">👥 Gestione Utenti</h3>
                        <button 
                            id="manage-users-btn"
                            style="width:100%;background:#f59e0b;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;"
                        >
                            Gestisci Utenti e Permessi
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="admin-content" style="background:#fff;padding:30px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <p style="text-align:center;color:#6b7280;padding:40px;">Seleziona un'azione dal menu sopra</p>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Event listeners
        document.getElementById('back-btn').onclick = () => showAnnataSelection();
        document.getElementById('create-annata-btn').onclick = () => showCreateAnnataForm();
        document.getElementById('manage-users-btn').onclick = () => showManageUsersForm();
    }

    async function showCreateAnnataForm() {
        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <h2 style="margin:0 0 20px 0;color:#1e293b;">📅 Crea Nuova Annata</h2>
            
            <form id="create-annata-form" style="max-width:600px;">
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;color:#1e293b;font-weight:500;">Nome Annata *</label>
                    <input 
                        type="text" 
                        id="annata-nome" 
                        placeholder="Es: 2012, Under 15, Allievi..."
                        style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;"
                        required
                    />
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;color:#1e293b;font-weight:500;">Descrizione</label>
                    <input 
                        type="text" 
                        id="annata-descrizione" 
                        placeholder="Es: Squadra 2012 - Stagione 2025/2026"
                        style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;"
                    />
                </div>
                
                <div id="create-error" style="color:#ef4444;margin-bottom:15px;"></div>
                <div id="create-success" style="color:#10b981;margin-bottom:15px;"></div>
                
                <button 
                    type="submit"
                    style="background:#3b82f6;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;font-size:16px;"
                >
                    ✅ Crea Annata
                </button>
            </form>
            
            <hr style="margin:40px 0;border:none;border-top:1px solid #e5e7eb;">
            
            <h3 style="margin:0 0 20px 0;color:#1e293b;">📋 Annate Esistenti</h3>
            <div id="annate-existing-list" style="display:flex;flex-direction:column;gap:15px;">
                <div style="text-align:center;padding:20px;color:#6b7280;">
                    <div class="spinner-border" role="status"></div>
                    <p>Caricamento...</p>
                </div>
            </div>
        `;
        
        // Carica annate esistenti
        loadExistingAnnate();
        
        // Form submit
        document.getElementById('create-annata-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('annata-nome').value.trim();
            const descrizione = document.getElementById('annata-descrizione').value.trim();
            const errorDiv = document.getElementById('create-error');
            const successDiv = document.getElementById('create-success');
            
            errorDiv.textContent = '';
            successDiv.textContent = '';
            
            try {
                const response = await fetch('/api/annate/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, descrizione })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Errore nella creazione');
                }
                
                successDiv.textContent = '✅ Annata creata con successo!';
                document.getElementById('annata-nome').value = '';
                document.getElementById('annata-descrizione').value = '';
                
                // Ricarica lista
                setTimeout(() => {
                    loadExistingAnnate();
                    successDiv.textContent = '';
                }, 2000);
                
            } catch (error) {
                errorDiv.textContent = '❌ ' + error.message;
            }
        });
    }

    async function loadExistingAnnate() {
        try {
            const annate = await getAllAnnate();
            const listDiv = document.getElementById('annate-existing-list');
            
            if (annate.length === 0) {
                listDiv.innerHTML = '<p style="text-align:center;color:#6b7280;padding:20px;">Nessuna annata creata</p>';
                return;
            }
            
            listDiv.innerHTML = '';
            
            annate.forEach(annata => {
                const annataCard = document.createElement('div');
                annataCard.style.cssText = 'background:#f8f9fa;padding:20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;border-left:4px solid #3b82f6;';
                annataCard.innerHTML = `
                    <div>
                        <h4 style="margin:0;color:#1e293b;">${annata.nome}</h4>
                        <p style="margin:5px 0 0 0;color:#6b7280;font-size:14px;">${annata.descrizione || 'Nessuna descrizione'}</p>
                        <p style="margin:5px 0 0 0;color:#9ca3af;font-size:12px;">ID: ${annata.id}</p>
                    </div>
                    <button 
                        class="delete-annata-btn"
                        data-annata-id="${annata.id}"
                        style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;"
                    >
                        🗑️ Elimina
                    </button>
                `;
                listDiv.appendChild(annataCard);
            });
            
            // Event listeners per eliminazione
            document.querySelectorAll('.delete-annata-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const annataId = e.target.dataset.annataId;
                    if (confirm('Sei sicuro di voler eliminare questa annata? Tutti i dati associati verranno persi!')) {
                        try {
                            const response = await fetch('/api/annate/delete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ annataId })
                            });
                            
                            if (!response.ok) throw new Error('Errore nell\'eliminazione');
                            
                            loadExistingAnnate();
                        } catch (error) {
                            alert('Errore: ' + error.message);
                        }
                    }
                });
            });
            
        } catch (error) {
            const listDiv = document.getElementById('annate-existing-list');
            listDiv.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;">Errore nel caricamento</p>';
        }
    }

    async function showManageUsersForm() {
        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <h2 style="margin:0 0 20px 0;color:#1e293b;">👥 Gestione Utenti e Permessi</h2>
            
            <div style="background:#fef3c7;padding:20px;border-radius:8px;margin-bottom:30px;border-left:4px solid #f59e0b;">
                <h3 style="margin:0 0 10px 0;color:#92400e;">ℹ️ Come funziona</h3>
                <ul style="margin:0;color:#78350f;line-height:1.8;">
                    <li>Crea nuovi utenti con username e password</li>
                    <li>Assegna le annate a cui ogni utente può accedere</li>
                    <li>Solo gli amministratori possono gestire utenti e annate</li>
                </ul>
            </div>
            
            <form id="create-user-form" style="max-width:600px;margin-bottom:40px;">
                <h3 style="margin:0 0 20px 0;color:#1e293b;">➕ Crea Nuovo Utente</h3>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;color:#1e293b;font-weight:500;">Username *</label>
                    <input 
                        type="text" 
                        id="new-username" 
                        placeholder="Es: coach.mario"
                        style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;"
                        required
                    />
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;color:#1e293b;font-weight:500;">Password *</label>
                    <input 
                        type="password" 
                        id="new-password" 
                        placeholder="Password sicura"
                        style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;"
                        required
                    />
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;color:#1e293b;font-weight:500;">Ruolo</label>
                    <select 
                        id="new-role" 
                        style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;"
                    >
                        <option value="user">Utente Standard</option>
                        <option value="admin">Amministratore</option>
                    </select>
                </div>
                
                <div id="user-error" style="color:#ef4444;margin-bottom:15px;"></div>
                <div id="user-success" style="color:#10b981;margin-bottom:15px;"></div>
                
                <button 
                    type="submit"
                    style="background:#f59e0b;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;font-size:16px;"
                >
                    ✅ Crea Utente
                </button>
            </form>
            
            <hr style="margin:40px 0;border:none;border-top:1px solid #e5e7eb;">
            
            <h3 style="margin:0 0 20px 0;color:#1e293b;">📋 Utenti Esistenti</h3>
            <div id="users-list" style="display:flex;flex-direction:column;gap:15px;">
                <div style="text-align:center;padding:20px;color:#6b7280;">
                    <div class="spinner-border" role="status"></div>
                    <p>Caricamento...</p>
                </div>
            </div>
        `;
        
        // Carica utenti esistenti
        loadExistingUsers();
        
        // Form submit
        document.getElementById('create-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('new-username').value.trim();
            const password = document.getElementById('new-password').value;
            const role = document.getElementById('new-role').value;
            const errorDiv = document.getElementById('user-error');
            const successDiv = document.getElementById('user-success');
            
            errorDiv.textContent = '';
            successDiv.textContent = '';
            
            try {
                const response = await fetch('/api/auth/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, role })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Errore nella creazione');
                }
                
                successDiv.textContent = '✅ Utente creato con successo!';
                document.getElementById('new-username').value = '';
                document.getElementById('new-password').value = '';
                
                setTimeout(() => {
                    loadExistingUsers();
                    successDiv.textContent = '';
                }, 2000);
                
            } catch (error) {
                errorDiv.textContent = '❌ ' + error.message;
            }
        });
    }

    async function loadExistingUsers() {
        try {
            const response = await fetch('/api/auth/list-users');
            if (!response.ok) throw new Error('Errore nel caricamento utenti');
            
            const data = await response.json();
            const users = data.users || [];
            const annate = await getAllAnnate();
            
            const listDiv = document.getElementById('users-list');
            
            if (users.length === 0) {
                listDiv.innerHTML = '<p style="text-align:center;color:#6b7280;padding:20px;">Nessun utente trovato</p>';
                return;
            }
            
            listDiv.innerHTML = '';
            
            for (const user of users) {
                const userCard = document.createElement('div');
                userCard.style.cssText = 'background:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid #f59e0b;';
                
                const userAnnate = user.annate || [];
                
                userCard.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:15px;">
                        <div>
                            <h4 style="margin:0;color:#1e293b;">${user.username}</h4>
                            <p style="margin:5px 0 0 0;color:#6b7280;font-size:14px;">
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
                        <label style="display:block;margin-bottom:8px;color:#1e293b;font-weight:500;font-size:14px;">
                            Annate Autorizzate:
                        </label>
                        <div id="user-annate-${user.username}" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                            ${userAnnate.length === 0 ? '<span style="color:#6b7280;font-size:13px;">Nessuna annata assegnata</span>' : 
                              userAnnate.map(a => `<span style="background:#3b82f6;color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;">${a}</span>`).join('')}
                        </div>
                        <select 
                            class="assign-annata-select"
                            data-username="${user.username}"
                            style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;"
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
            
            const header = document.querySelector('h1, .main-title');
            if (!header) return;
            
            const logoutBtn = document.createElement('button');
            logoutBtn.textContent = `👤 ${username} | ${annata || 'N/A'} | Esci`;
            logoutBtn.style.cssText = 'position:fixed;top:20px;right:20px;background:#ef4444;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;z-index:1000;';
            logoutBtn.onclick = () => {
                if (confirm('Vuoi uscire?')) {
                    logout();
                    window.location.reload();
                }
            };
            document.body.appendChild(logoutBtn);
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

        /// ==========================================
        // MAIN FLOW
        // ==========================================
        if (!isAuthenticated()) {
        // Nascondi il contenuto e mostra il form di login
        const loadingScreen = document.getElementById('loading-screen');
        const appContent = document.getElementById('app-content');
    
        if (loadingScreen) loadingScreen.style.display = 'flex';
        if (appContent) appContent.style.display = 'none';
    
        showLoginScreen();
        } else if (!hasSelectedAnnata()) {
        // Nascondi il contenuto e mostra la selezione annata
        const loadingScreen = document.getElementById('loading-screen');
        const appContent = document.getElementById('app-content');
    
        if (loadingScreen) loadingScreen.style.display = 'flex';
        if (appContent) appContent.style.display = 'none';
    
        showAnnataSelection();
    } else {
    // Setup interceptor per aggiungere annata alle richieste
    setupFetchInterceptor();
    addLogoutButton();
    // Esponi funzioni globali
    window.getCurrentAnnata = getCurrentAnnata;
    window.getCurrentUser = getCurrentUser;
    window.getUserRole = getUserRole;
    window.isAdmin = isAdmin;

    // Mostra il contenuto
    const loadingScreen = document.getElementById('loading-screen');
    const appContent = document.getElementById('app-content');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
}

})();
