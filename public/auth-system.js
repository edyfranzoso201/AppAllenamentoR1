// auth-system.js - Sistema di autenticazione per dashboard
(function() {
    'use strict';

    const COACH_PASSWORD = 'edy201201'; // CAMBIA QUESTA PASSWORD!
    const AUTH_KEY = 'coach_authenticated';
    const AUTH_EXPIRY = 'coach_auth_expiry';

    // Controlla se siamo in modalità presenza (non serve autenticazione)
    const path = window.location.pathname;
    if (path.includes('/presenza/')) {
        // Modalità presenza, parent-view.js gestirà tutto
        return;
    }

    // Controlla se l'utente è già autenticato
    function isAuthenticated() {
        const auth = sessionStorage.getItem(AUTH_KEY);
        const expiry = sessionStorage.getItem(AUTH_EXPIRY);
        
        if (!auth || !expiry) return false;
        
        const now = new Date().getTime();
        if (now > parseInt(expiry)) {
            // Sessione scaduta
            sessionStorage.removeItem(AUTH_KEY);
            sessionStorage.removeItem(AUTH_EXPIRY);
            return false;
        }
        
        return auth === 'true';
    }

    // Mostra schermata di login
    function showLoginScreen() {
        // Nascondi tutto il contenuto
        document.body.innerHTML = '';
        document.body.style.backgroundColor = '#0f172a';
        document.body.style.display = 'flex';
        document.body.style.alignItems = 'center';
        document.body.style.justifyContent = 'center';
        document.body.style.minHeight = '100vh';
        document.body.style.margin = '0';
        document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        const loginContainer = document.createElement('div');
        loginContainer.style.cssText = 'background: rgba(30, 41, 59, 0.95); padding: 40px; border-radius: 15px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%; border: 1px solid rgba(96, 165, 250, 0.2);';
        
        loginContainer.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #60a5fa; font-size: 28px; margin: 0 0 10px 0; font-weight: 700;">
                    🏃‍♂️ GO SPORT
                </h1>
                <p style="color: #94a3b8; font-size: 16px; margin: 0;">
                    Coach Dashboard
                </p>
            </div>
            
            <form id="login-form" style="display: flex; flex-direction: column; gap: 20px;">
                <div>
                    <label style="color: #e2e8f0; font-size: 14px; font-weight: 500; display: block; margin-bottom: 8px;">
                        Password Coach
                    </label>
                    <input 
                        type="password" 
                        id="password-input" 
                        placeholder="Inserisci la password"
                        style="width: 100%; padding: 12px; border: 1px solid rgba(96, 165, 250, 0.3); border-radius: 8px; background: #0f172a; color: #ffffff; font-size: 16px; box-sizing: border-box;"
                        autocomplete="current-password"
                    />
                </div>
                
                <div id="error-message" style="color: #ef4444; font-size: 14px; text-align: center; min-height: 20px;"></div>
                
                <button 
                    type="submit" 
                    style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 12px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
                    onmouseover="this.style.transform='scale(1.02)'"
                    onmouseout="this.style.transform='scale(1)'"
                >
                    🔓 Accedi
                </button>
            </form>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(96, 165, 250, 0.2);">
                <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0;">
                    👤 Sei un genitore? Usa il link ricevuto dal coach
                </p>
            </div>
        `;

        document.body.appendChild(loginContainer);

        // Gestisci login
        const form = document.getElementById('login-form');
        const passwordInput = document.getElementById('password-input');
        const errorMessage = document.getElementById('error-message');

        passwordInput.focus();

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = passwordInput.value;

            if (password === COACH_PASSWORD) {
                // Password corretta
                const expiry = new Date().getTime() + (4 * 60 * 60 * 1000); // 4 ore
                sessionStorage.setItem(AUTH_KEY, 'true');
                sessionStorage.setItem(AUTH_EXPIRY, expiry.toString());
                
                // Ricarica pagina
                window.location.reload();
            } else {
                // Password sbagliata
                errorMessage.textContent = '❌ Password errata';
                passwordInput.value = '';
                passwordInput.style.borderColor = '#ef4444';
                
                setTimeout(() => {
                    errorMessage.textContent = '';
                    passwordInput.style.borderColor = 'rgba(96, 165, 250, 0.3)';
                }, 3000);
            }
        });
    }

    // Verifica autenticazione all'avvio
    if (!isAuthenticated()) {
        showLoginScreen();
    }

})();
