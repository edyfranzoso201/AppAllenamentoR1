// auth-dashboard.js - Sistema autenticazione robusto
(function() {
    'use strict';

    // UTENTI AUTORIZZATI - Aggiungi qui coach, allenatori, dirigenti
    const AUTHORIZED_USERS = {
        'coach': 'GoSport2025!',
        'allenatore1': 'Allenatore123',
        'dirigente1': 'Dirigente123'
    };

    // Verifica se siamo in modalità presenza (non serve auth)
    const path = window.location.pathname;
    if (path.includes('/presenza/')) {
        return; // Genitori non hanno bisogno di login
    }

    // Verifica se siamo su calendario.html (non serve auth)
    if (path.includes('/calendario')) {
        // Proteggi anche calendario
        // return;
    }

    // Chiave sessione
    const SESSION_KEY = 'gosport_auth_session';
    const SESSION_USER = 'gosport_auth_user';

    // Controlla se già autenticato
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

    // Logout
    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY + '_expiry');
        sessionStorage.removeItem(SESSION_USER);
    }

    // Mostra schermata login
    function showLogin() {
        // Blocca completamente la pagina
        document.documentElement.innerHTML = '';
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
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            
            if (!username || !password) {
                errorDiv.textContent = '⚠️ Compila tutti i campi';
                return;
            }
            
            // Verifica credenziali
            if (AUTHORIZED_USERS[username] && AUTHORIZED_USERS[username] === password) {
                // Login riuscito
                const expiry = Date.now() + (8 * 60 * 60 * 1000); // 8 ore
                sessionStorage.setItem(SESSION_KEY, 'true');
                sessionStorage.setItem(SESSION_KEY + '_expiry', expiry.toString());
                sessionStorage.setItem(SESSION_USER, username);
                
                // Ricarica pagina
                window.location.reload();
            } else {
                // Login fallito
                errorDiv.textContent = '❌ Credenziali non valide';
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

    // Aggiungi pulsante logout alla dashboard
    function addLogoutButton() {
        setTimeout(() => {
            const username = sessionStorage.getItem(SESSION_USER);
            if (!username) return;
            
            const header = document.querySelector('h1, .main-title');
            if (!header) return;
            
            const logoutBtn = document.createElement('button');
            logoutBtn.textContent = `👤 ${username} | Esci`;
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

    // Controlla autenticazione
    if (!isAuthenticated()) {
        showLogin();
    } else {
        addLogoutButton();
    }

})();
