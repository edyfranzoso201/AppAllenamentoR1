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

        // UI - ADMIN PANEL (COMPLETO)
function showAdminPanel() {
  const username = getCurrentUser();
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background: rgba(30, 41, 59, 0.95);
    padding: 40px;
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    border: 1px solid rgba(96, 165, 250, 0.2);
  `;

  panel.innerHTML = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="font-size: 48px; margin-bottom: 10px;">⚙️</div>
      <h1 style="color: #60a5fa; margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">Gestione Utenti</h1>
      <p style="color: #94a3b8; margin: 0;">Amministratore: <strong style="color: #60a5fa;">${username}</strong></p>
    </div>

    <!-- TAB AGGIUNTA UTENTE -->
    <div style="margin-bottom: 30px; padding: 20px; background: rgba(15, 23, 42, 0.6); border-radius: 12px;">
      <h3 style="color: #60a5fa; margin: 0 0 15px 0;">Aggiungi Utente</h3>
      <form id="add-user-form" style="display: flex; flex-direction: column; gap: 15px;">
        <input type="text" id="new-username" placeholder="Username" style="width: 100%; padding: 12px; border: 1px solid rgba(96, 165, 250, 0.3); border-radius: 8px; background: #0f172a; color: #fff; font-size: 16px; box-sizing: border-box;" required>
        <input type="password" id="new-password" placeholder="Password" style="width: 100%; padding: 12px; border: 1px solid rgba(96, 165, 250, 0.3); border-radius: 8px; background: #0f172a; color: #fff; font-size: 16px; box-sizing: border-box;" required>
        <select id="new-role" style="width: 100%; padding: 12px; border: 1px solid rgba(96, 165, 250, 0.3); border-radius: 8px; background: #0f172a; color: #fff; font-size: 16px; box-sizing: border-box;">
          <option value="user">Utente</option>
          <option value="allenatore">Allenatore</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #fff; padding: 12px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">✅ Aggiungi</button>
        <div id="add-user-message" style="color: #10b981; font-size: 14px; text-align: center; min-height: 20px;"></div>
      </form>
    </div>

    <!-- LISTA UTENTI -->
    <div style="margin-bottom: 30px; padding: 20px; background: rgba(15, 23, 42, 0.6); border-radius: 12px;">
      <h3 style="color: #60a5fa; margin: 0 0 15px 0;">Utenti Registrati</h3>
      <div id="users-list" style="max-height: 300px; overflow-y: auto;">
        <p style="color: #94a3b8; text-align: center;">Caricamento...</p>
      </div>
    </div>

    <!-- BOTTONE CHIUDI -->
    <div style="text-align: center;">
      <button id="close-admin-panel" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">🚪 Chiudi</button>
    </div>
  `;

  container.appendChild(panel);
  document.body.appendChild(container);

  // Event Listeners
  const form = document.getElementById('add-user-form');
  const closeBtn = document.getElementById('close-admin-panel');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const messageDiv = document.getElementById('add-user-message');

    if (!username || !password) {
      messageDiv.textContent = '❌ Compila tutti i campi';
      messageDiv.style.color = '#ef4444';
      return;
    }

    try {
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });

      const data = await response.json();
      if (response.ok) {
        messageDiv.textContent = `✅ ${data.message}`;
        messageDiv.style.color = '#10b981';
        form.reset();
        loadUsersList();
      } else {
        messageDiv.textContent = `❌ ${data.message}`;
        messageDiv.style.color = '#ef4444';
      }
    } catch (error) {
      messageDiv.textContent = `❌ Errore: ${error.message}`;
      messageDiv.style.color = '#ef4444';
    }
  });

  closeBtn.addEventListener('click', () => {
    container.remove();
  });

  // Carica lista utenti
  async function loadUsersList() {
    const listDiv = document.getElementById('users-list');
    try {
      const response = await fetch('/api/auth/list-users');
      const data = await response.json();
      
      if (data.users && data.users.length > 0) {
        listDiv.innerHTML = data.users.map(user => `
          <div style="padding: 12px; background: rgba(30, 41, 59, 0.5); margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="color: #60a5fa; margin: 0; font-weight: 600;">${user.username}</p>
              <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px;">Ruolo: ${user.role}</p>
            </div>
            ${user.username !== 'admin' ? `
              <button onclick="deleteUserConfirm('${user.username}')" style="background: #ef4444; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🗑️ Elimina</button>
            ` : ''}
          </div>
        `).join('');
      } else {
        listDiv.innerHTML = '<p style="color: #94a3b8; text-align: center;">Nessun utente trovato</p>';
      }
    } catch (error) {
      listDiv.innerHTML = `<p style="color: #ef4444; text-align: center;">Errore nel caricamento: ${error.message}</p>`;
    }
  }

  // Funzione globale per eliminare utente
  window.deleteUserConfirm = async (username) => {
    if (!confirm(`Sei sicuro di voler eliminare ${username}?`)) return;
    try {
      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (response.ok) {
        alert('✅ Utente eliminato');
        loadUsersList();
      } else {
        alert('❌ Errore nell\'eliminazione');
      }
    } catch (error) {
      alert(`❌ Errore: ${error.message}`);
    }
  };

  loadUsersList();
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
