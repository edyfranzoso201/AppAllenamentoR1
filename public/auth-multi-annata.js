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
            window.location.reload();
        }

// ==========================================
// GESTIONE ANNATE
// ==========================================

async function showAnnatePanel() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div style="background:rgba(30,41,59,0.95);padding:30px;border-radius:15px;border:1px solid rgba(96,165,250,0.2);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;">
                <h2 style="color:#e2e8f0;margin:0;font-size:20px;">📅 Annate Esistenti</h2>
                <button id="add-annata-btn" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;">
                    ➕ Crea Nuova Annata
                </button>
            </div>
            <div id="annate-list-admin" style="display:flex;flex-direction:column;gap:15px;">
                <div style="text-align:center;padding:40px;color:#94a3b8;">
                    <div style="font-size:32px;margin-bottom:10px;">⏳</div>
                    <p>Caricamento...</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('add-annata-btn').addEventListener('click', () => showAnnataModal());
    loadAnnateList();
}

async function loadAnnateList() {
    const listDiv = document.getElementById('annate-list-admin');
    
    try {
        const response = await fetch('/api/annate/list');
        if (!response.ok) throw new Error('Errore caricamento');
        
        const data = await response.json();
        const annate = data.annate || [];
        
        if (annate.length === 0) {
            listDiv.innerHTML = `
                <div style="text-align:center;padding:40px;color:#94a3b8;">
                    <div style="font-size:32px;margin-bottom:10px;">📭</div>
                    <p>Nessuna annata trovata</p>
                </div>
            `;
            return;
        }
        
        listDiv.innerHTML = '';
        
        for (const annata of annate) {
            let athletesCount = 0;
            try {
                const dataResponse = await fetch('/api/data', {
                    headers: { 'X-Annata-Id': annata.id }
                });
                if (dataResponse.ok) {
                    const annataData = await dataResponse.json();
                    athletesCount = annataData.athletes?.length || 0;
                }
            } catch (e) {}
            
            const card = document.createElement('div');
            card.style.cssText = 'background:#1e293b;padding:20px;border-radius:12px;border:1px solid rgba(96,165,250,0.2);';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div style="flex:1;">
                        <h3 style="color:#60a5fa;margin:0 0 8px 0;font-size:18px;">${annata.nome}</h3>
                        <p style="color:#94a3b8;margin:0 0 5px 0;font-size:14px;">📅 ${annata.dataInizio} - ${annata.dataFine}</p>
                        <p style="color:#94a3b8;margin:0;font-size:14px;">👥 ${athletesCount} atleti</p>
                        ${annata.descrizione ? `<p style="color:#64748b;margin:10px 0 0 0;font-size:13px;">${annata.descrizione}</p>` : ''}
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="editAnnata('${annata.id}')" style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            ✏️ Modifica
                        </button>
                        <button onclick="deleteAnnata('${annata.id}', '${annata.nome}')" style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            🗑️ Elimina
                        </button>
                    </div>
                </div>
            `;
            listDiv.appendChild(card);
        }
    } catch (error) {
        listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;"><p>Errore: ${error.message}</p></div>`;
    }
}

function showAnnataModal(annataData = null) {
    const isEdit = annataData !== null;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;';
    
    modal.innerHTML = `
        <div style="background:#1e293b;padding:30px;border-radius:15px;max-width:500px;width:90%;border:1px solid rgba(96,165,250,0.2);">
            <h2 style="color:#60a5fa;margin:0 0 20px 0;">${isEdit ? '✏️ Modifica Annata' : '➕ Crea Nuova Annata'}</h2>
            <form id="annata-form" style="display:flex;flex-direction:column;gap:15px;">
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Nome *</label>
                    <input type="text" id="annata-nome" value="${annataData?.nome || ''}" placeholder="es. 2024" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;box-sizing:border-box;" required />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Data Inizio *</label>
                        <input type="date" id="annata-inizio" value="${annataData?.dataInizio || ''}" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;box-sizing:border-box;" required />
                    </div>
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Data Fine *</label>
                        <input type="date" id="annata-fine" value="${annataData?.dataFine || ''}" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;box-sizing:border-box;" required />
                    </div>
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Descrizione</label>
                    <textarea id="annata-desc" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;box-sizing:border-box;min-height:80px;">${annataData?.descrizione || ''}</textarea>
                </div>
                <div style="display:flex;gap:10px;margin-top:10px;">
                    <button type="submit" style="flex:1;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ${isEdit ? '💾 Salva' : '➕ Crea'}
                    </button>
                    <button type="button" id="cancel-btn" style="flex:1;background:#64748b;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ❌ Annulla
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('cancel-btn').addEventListener('click', () => document.body.removeChild(modal));
    
    document.getElementById('annata-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            action: isEdit ? 'update' : 'create',
            nome: document.getElementById('annata-nome').value.trim(),
            dataInizio: document.getElementById('annata-inizio').value,
            dataFine: document.getElementById('annata-fine').value,
            descrizione: document.getElementById('annata-desc').value.trim()
        };
        
        if (isEdit) payload.id = annataData.id;
        
        try {
            const response = await fetch('/api/annate/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Errore');
            }
            
            document.body.removeChild(modal);
            alert(`✅ Annata ${isEdit ? 'modificata' : 'creata'}!`);
            loadAnnateList();
        } catch (error) {
            alert('❌ ' + error.message);
        }
    });
}

window.editAnnata = async function(annataId) {
    try {
        const response = await fetch('/api/annate/list');
        const data = await response.json();
        const annata = data.annate.find(a => a.id === annataId);
        if (annata) showAnnataModal(annata);
    } catch (error) {
        alert('❌ ' + error.message);
    }
};

window.deleteAnnata = async function(annataId, nomeAnnata) {
    if (!confirm(`⚠️ Eliminare "${nomeAnnata}"?\n\nQuesta operazione eliminerà tutti i dati associati ed è IRREVERSIBILE!`)) return;
    
    try {
        const response = await fetch('/api/annate/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: annataId })
        });
        
        if (!response.ok) throw new Error('Errore');
        alert('✅ Annata eliminata');
        loadAnnateList();
    } catch (error) {
        alert('❌ ' + error.message);
    }
};

// ==========================================
// GESTIONE UTENTI
// ==========================================

async function showUtentiPanel() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div style="background:rgba(30,41,59,0.95);padding:30px;border-radius:15px;border:1px solid rgba(96,165,250,0.2);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;">
                <h2 style="color:#e2e8f0;margin:0;">👥 Utenti Registrati</h2>
                <button id="add-user-btn" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;">
                    ➕ Crea Nuovo Utente
                </button>
            </div>
            <div id="users-list-admin" style="display:flex;flex-direction:column;gap:15px;">
                <div style="text-align:center;padding:40px;color:#94a3b8;">
                    <div style="font-size:32px;margin-bottom:10px;">⏳</div>
                    <p>Caricamento...</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('add-user-btn').addEventListener('click', () => showUserModal());
    loadUsersList();
}

async function loadUsersList() {
    const listDiv = document.getElementById('users-list-admin');
    
    try {
        const response = await fetch('/api/auth/manage');
        if (!response.ok) throw new Error('Errore caricamento');
        
        const data = await response.json();
        const users = data.users || [];
        
        if (users.length === 0) {
            listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;"><p>Nessun utente</p></div>`;
            return;
        }
        
        listDiv.innerHTML = '';
        
        users.forEach(user => {
            const roleIcon = user.role === 'admin' ? '👑' : user.role === 'supercoach' ? '⭐' : '👨‍🏫';
            const roleName = user.role === 'admin' ? 'ADMIN' : user.role === 'supercoach' ? 'SUPER COACH' : 'COACH';
            const roleColor = user.role === 'admin' ? '#f59e0b' : user.role === 'supercoach' ? '#8b5cf6' : '#3b82f6';
            
            const card = document.createElement('div');
            card.style.cssText = 'background:#1e293b;padding:20px;border-radius:12px;border:1px solid rgba(96,165,250,0.2);';
            
            const annateText = user.role === 'coach' && user.annate?.length > 0 ? user.annate.join(', ') : 'Tutte';
            
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                            <h3 style="color:#60a5fa;margin:0;">${user.username}</h3>
                            <span style="background:${roleColor};color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">
                                ${roleIcon} ${roleName}
                            </span>
                        </div>
                        <p style="color:#94a3b8;margin:0;font-size:14px;">📧 ${user.email || 'N/A'}</p>
                        <p style="color:#94a3b8;margin:5px 0 0 0;font-size:14px;">📅 Annate: ${annateText}</p>
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="editUser('${user.username}')" style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            ✏️ Modifica
                        </button>
                        ${user.role !== 'admin' ? `
                        <button onclick="deleteUser('${user.username}')" style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            🗑️ Elimina
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
            listDiv.appendChild(card);
        });
    } catch (error) {
        listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;"><p>Errore: ${error.message}</p></div>`;
    }
}

async function showUserModal(userData = null) {
    const isEdit = userData !== null;
    
    let annateDisponibili = [];
    try {
        const response = await fetch('/api/annate/list');
        const data = await response.json();
        annateDisponibili = data.annate || [];
    } catch (e) {}
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;overflow-y:auto;padding:20px;';
    
    const annateCheckboxes = annateDisponibili.map(annata => {
        const checked = userData?.annate?.includes(annata.id) ? 'checked' : '';
        return `
            <label style="display:flex;align-items:center;gap:8px;color:#e2e8f0;cursor:pointer;padding:8px;border-radius:6px;background:#0f172a;">
                <input type="checkbox" name="annate" value="${annata.id}" ${checked} style="width:18px;height:18px;" />
                <span>${annata.nome}</span>
            </label>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div style="background:#1e293b;padding:30px;border-radius:15px;max-width:500px;width:100%;border:1px solid rgba(96,165,250,0.2);">
            <h2 style="color:#60a5fa;margin:0 0 20px 0;">${isEdit ? '✏️ Modifica Utente' : '➕ Crea Nuovo Utente'}</h2>
            <form id="user-form" style="display:flex;flex-direction:column;gap:15px;">
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Username *</label>
                    <input type="text" id="user-username" value="${userData?.username || ''}" ${isEdit ? 'disabled' : ''} placeholder="es. mario.rossi" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;box-sizing:border-box;" required />
                </div>
                ${!isEdit ? `
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Password *</label>
                    <input type="password" id="user-password" placeholder="Password" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;box-sizing:border-box;" required />
                </div>
                ` : ''}
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Email</label>
                    <input type="email" id="user-email" value="${userData?.email || ''}" placeholder="email@esempio.com" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;box-sizing:border-box;" />
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Ruolo *</label>
                    <select id="user-role" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#fff;box-sizing:border-box;" required>
                        <option value="coach" ${userData?.role === 'coach' ? 'selected' : ''}>👨‍🏫 COACH</option>
                        <option value="supercoach" ${userData?.role === 'supercoach' ? 'selected' : ''}>⭐ SUPER COACH</option>
                        <option value="admin" ${userData?.role === 'admin' ? 'selected' : ''}>👑 ADMIN</option>
                    </select>
                </div>
                <div id="annate-container" style="display:${userData?.role === 'coach' || !userData ? 'block' : 'none'};">
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:8px;">Annate</label>
                    <div style="max-height:200px;overflow-y:auto;border:1px solid rgba(96,165,250,0.3);border-radius:8px;padding:10px;background:#0f172a;display:flex;flex-direction:column;gap:5px;">
                        ${annateCheckboxes || '<p style="color:#64748b;margin:0;text-align:center;">Nessuna annata</p>'}
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:10px;">
                    <button type="submit" style="flex:1;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ${isEdit ? '💾 Salva' : '➕ Crea'}
                    </button>
                    <button type="button" id="cancel-user-btn" style="flex:1;background:#64748b;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ❌ Annulla
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('user-role').addEventListener('change', (e) => {
        document.getElementById('annate-container').style.display = e.target.value === 'coach' ? 'block' : 'none';
    });
    
    document.getElementById('cancel-user-btn').addEventListener('click', () => document.body.removeChild(modal));
    
    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const role = document.getElementById('user-role').value;
        const annateSelezionate = role === 'coach' ? Array.from(document.querySelectorAll('input[name="annate"]:checked')).map(cb => cb.value) : [];
        
        if (role === 'coach' && annateSelezionate.length === 0) {
            alert('⚠️ Seleziona almeno un\'annata');
            return;
        }
        
        const payload = {
            action: isEdit ? 'update' : 'create',
            username: document.getElementById('user-username').value.trim(),
            email: document.getElementById('user-email').value.trim(),
            role,
            annate: annateSelezionate
        };
        
        if (!isEdit) payload.password = document.getElementById('user-password').value;
        
        try {
            const response = await fetch('/api/auth/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Errore');
            }
            
            document.body.removeChild(modal);
            alert(`✅ Utente ${isEdit ? 'modificato' : 'creato'}!`);
            loadUsersList();
        } catch (error) {
            alert('❌ ' + error.message);
        }
    });
}

window.editUser = async function(username) {
    try {
        const response = await fetch('/api/auth/manage');
        const data = await response.json();
        const user = data.users.find(u => u.username === username);
        if (user) showUserModal(user);
    } catch (error) {
        alert('❌ ' + error.message);
    }
};

window.deleteUser = async function(username) {
    if (!confirm(`⚠️ Eliminare "${username}"?\n\nOperazione IRREVERSIBILE!`)) return;
    
    try {
        const response = await fetch('/api/auth/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', username })
        });
        
        if (!response.ok) throw new Error('Errore');
        alert('✅ Utente eliminato');
        loadUsersList();
    } catch (error) {
        alert('❌ ' + error.message);
    }
};

// ==========================================
// PANNELLO ADMIN AGGIORNATO - USA API UNIFICATE
// ==========================================

function showAdminPanel() {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;padding:0;font-family:system-ui;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;overflow-y:auto;';
    
    const container = document.createElement('div');
    container.style.cssText = 'max-width:1200px;margin:0 auto;padding:40px 20px;';
    
    container.innerHTML = `
        <div style="background:rgba(30,41,59,0.95);padding:30px;border-radius:15px;margin-bottom:30px;border:1px solid rgba(96,165,250,0.2);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h1 style="color:#60a5fa;margin:0 0 5px 0;font-size:28px;font-weight:700;">⚙️ Pannello Amministratore</h1>
                    <p style="color:#94a3b8;margin:0;">Gestione Utenti e Annate</p>
                </div>
                <button id="back-btn" style="background:#64748b;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">
                    ← Torna Indietro
                </button>
            </div>
        </div>
        
        <div style="background:rgba(30,41,59,0.95);padding:20px;border-radius:15px;margin-bottom:20px;border:1px solid rgba(96,165,250,0.2);">
            <div style="display:flex;gap:10px;">
                <button id="tab-annate" class="tab-btn active" style="flex:1;background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                    📅 Gestione Annate
                </button>
                <button id="tab-utenti" class="tab-btn" style="flex:1;background:#334155;color:#94a3b8;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                    👥 Gestione Utenti
                </button>
            </div>
        </div>
        
        <div id="content-area"></div>
    `;
    
    document.body.appendChild(container);
    
    document.getElementById('back-btn').addEventListener('click', () => {
        sessionStorage.removeItem(SESSION_ANNATA);
        window.location.reload();
    });
    
    document.getElementById('tab-annate').addEventListener('click', () => switchTab('annate'));
    document.getElementById('tab-utenti').addEventListener('click', () => switchTab('utenti'));
    
    switchTab('annate');
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        if (tab.id === `tab-${tabName}`) {
            tab.style.background = 'linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)';
            tab.style.color = '#fff';
        } else {
            tab.style.background = '#334155';
            tab.style.color = '#94a3b8';
        }
    });
    
    if (tabName === 'annate') {
        showAnnatePanel();
    } else {
        showUtentiPanel();
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
