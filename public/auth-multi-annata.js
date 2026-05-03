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

    // Chiavi localStorage per la licenza (persistente tra sessioni)
    const LICENSE_KEY = 'gosport_license_key';
    const LICENSE_EMAIL = 'gosport_license_email';
    const LICENSE_DATA = 'gosport_license_data';
    const LICENSE_VERIFIED = 'gosport_license_verified';
    const LICENSE_VERIFIED_EXPIRY = 'gosport_license_verified_expiry';
    const SESSION_SOCIETY = 'gosport_society_id'; // societyId della società loggata

    // ==========================================
    // VERIFICA MODALITÀ GENITORE (SENZA AUTH)
    // ==========================================
    
    function isParentMode() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    const athleteId = params.get('athleteId');
    const token = params.get('token');
    const annata = params.get('annata');

    if (path.includes('presenza') && athleteId && token) return true;
    if (path.includes('calendario.html') && athleteId && annata) return true;

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
            sessionStorage.removeItem(SESSION_SOCIETY);
        }

        // ==========================================
        // LICENZA - FUNZIONI
        // ==========================================

        function getLicenseData() {
            try {
                const data = localStorage.getItem(LICENSE_DATA);
                return data ? JSON.parse(data) : null;
            } catch(e) { return null; }
        }

        function isLicenseVerified() {
            // Controlla se la verifica è ancora valida (cache 24h)
            const verified = localStorage.getItem(LICENSE_VERIFIED);
            const expiry = localStorage.getItem(LICENSE_VERIFIED_EXPIRY);
            if (verified !== 'true' || !expiry) return false;
            return Date.now() < parseInt(expiry);
        }

        function saveLicenseVerified(licenseData) {
            localStorage.setItem(LICENSE_VERIFIED, 'true');
            // Cache verifica per 24 ore
            localStorage.setItem(LICENSE_VERIFIED_EXPIRY, (Date.now() + 30 * 24 * 60 * 60 * 1000).toString()); // 30 giorni
            localStorage.setItem(LICENSE_DATA, JSON.stringify(licenseData));
        }

        function clearLicense() {
            localStorage.removeItem(LICENSE_KEY);
            localStorage.removeItem(LICENSE_EMAIL);
            localStorage.removeItem(LICENSE_DATA);
            localStorage.removeItem(LICENSE_VERIFIED);
            localStorage.removeItem(LICENSE_VERIFIED_EXPIRY);
        }

        async function verifyLicense(email, licenseKey) {
            const response = await fetch('/api/licenze?action=verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, licenseKey })
            });
            return await response.json();
        }

        // ==========================================
        // AGGIORNA EMAIL UTENTE SU SERVER
        // ==========================================
        async function updateUserEmailOnServer(email) {
            const username = getCurrentUser();
            const societyId = sessionStorage.getItem(SESSION_SOCIETY);
            
            if (!username || !societyId) return;

            try {
                await fetch('/api/auth/manage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Society-Id': societyId
                    },
                    body: JSON.stringify({
                        action: 'update',
                        username,
                        role: 'admin',
                        email
                    })
                });
                console.log('✅ Email utente aggiornata su server');
            } catch(e) {
                console.error('❌ Errore aggiornamento email:', e);
            }
        }

        // ==========================================
        // LICENZA - SCHERMATA ATTIVAZIONE
        // ==========================================

        function showLicenseScreen(errorMessage) {
            document.body.innerHTML = '';
            document.body.style.cssText = 'margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;';

            const savedEmail = localStorage.getItem(LICENSE_EMAIL) || '';
            const savedKey = localStorage.getItem(LICENSE_KEY) || '';

            const card = document.createElement('div');
            card.style.cssText = 'background:#1e293b;border:1px solid #64748b;border-radius:16px;padding:36px;width:100%;max-width:420px;box-shadow:0 25px 50px rgba(0,0,0,0.5);';
            card.innerHTML = `
                <div style="text-align:center;margin-bottom:28px">
                    <div style="font-size:3rem;margin-bottom:8px">⚽</div>
                    <h1 style="color:white;margin:0 0 4px 0;font-size:1.5rem;font-weight:700">Sport Monitoring</h1>
                    <p style="color:#64748b;margin:0;font-size:0.85rem">Attivazione Licenza</p>
                </div>

                <div id="license-alert" style="padding:10px 14px;border-radius:8px;font-size:0.85rem;margin-bottom:16px;${errorMessage ? '' : 'display:none'}background:#450a0a;border:1px solid #d90429;color:#d90429">${errorMessage || ''}</div>

                <div style="margin-bottom:14px">
                    <label style="display:block;font-size:0.8rem;color:#64748b;font-weight:600;margin-bottom:6px">
                        📧 Email Amministratore
                    </label>
                    <input type="email" id="license-email" value="${savedEmail}"
                        placeholder="admin@società.com"
                        style="width:100%;padding:11px 14px;border-radius:8px;border:1px solid #64748b;background:#0f172a;color:white;font-size:0.95rem;box-sizing:border-box;outline:none">
                </div>

                <div style="margin-bottom:20px">
                    <label style="display:block;font-size:0.8rem;color:#64748b;font-weight:600;margin-bottom:6px">
                        🔑 Chiave Licenza
                    </label>
                    <input type="text" id="license-key" value="${savedKey}"
                        placeholder="GS-XXXXX-XXXXX-XXXXX-XXXXX-XXXXXXXX"
                        style="width:100%;padding:11px 14px;border-radius:8px;border:1px solid #64748b;background:#0f172a;color:#60a5fa;font-family:monospace;font-size:0.88rem;box-sizing:border-box;outline:none;letter-spacing:0.5px">
                </div>

                <button id="license-btn"
                    style="width:100%;padding:13px;background:linear-gradient(135deg,#3b82f6,#3b82f6);color:white;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;transition:opacity 0.2s">
                    🔓 Attiva Licenza
                </button>

                <p style="text-align:center;font-size:0.75rem;color:#64748b;margin-top:16px;margin-bottom:0">
                    Non hai una licenza? Contatta Sport Monitoring per acquistarla.
                </p>
            `;

            document.body.appendChild(card);

            const alertEl = card.querySelector('#license-alert');
            const btn = card.querySelector('#license-btn');
            const emailInput = card.querySelector('#license-email');
            const keyInput = card.querySelector('#license-key');

            function showLicenseAlert(msg, type) {
                alertEl.textContent = msg;
                alertEl.style.display = 'block';
                if (type === 'error') {
                    alertEl.style.background = '#450a0a';
                    alertEl.style.border = '1px solid #d90429';
                    alertEl.style.color = '#d90429';
                } else if (type === 'success') {
                    alertEl.style.background = '#16a34a';
                    alertEl.style.border = '1px solid #16a34a';
                    alertEl.style.color = '#16a34a';
                } else {
                    alertEl.style.background = '#1a3a5f';
                    alertEl.style.border = '1px solid #3b82f6';
                    alertEl.style.color = '#60a5fa';
                }
            }

            async function doActivate() {
                const email = emailInput.value.trim();
                const key = keyInput.value.trim();

                if (!email || !key) {
                    showLicenseAlert('⚠️ Inserisci email e chiave licenza', 'error');
                    return;
                }

                btn.textContent = '⏳ Verifica in corso...';
                btn.disabled = true;
                showLicenseAlert('Connessione al server...', 'info');

                try {
                    const result = await verifyLicense(email, key);

                    if (result.valid) {
                        // Salva societyId e licenseStatus in sessione
                        sessionStorage.setItem(SESSION_SOCIETY, result.societyId);
                        sessionStorage.setItem('gosport_license_status', JSON.stringify(result));
                        sessionStorage.setItem('gosport_license_plan', result.plan || 'platinum');

                        const expiry = new Date(result.expiry + 'T00:00:00').toLocaleDateString('it-IT');
                        showLicenseAlert(`✅ Benvenuto ${result.societyName}! Licenza valida fino al ${expiry}`, 'success');

                        // Aggiorna l'utente su Redis con l'email (per futuri login automatici)
                        updateUserEmailOnServer(email).catch(e => console.warn('Errore aggiornamento email:', e));

                        setTimeout(() => proceedAfterLogin(), 1200);
                    } else if (result.expired) {
                        showLicenseAlert(`❌ Licenza scaduta. Contatta Sport Monitoring per rinnovarla.`, 'error');
                        btn.textContent = '🔓 Attiva Licenza';
                        btn.disabled = false;
                    } else {
                        showLicenseAlert('❌ ' + (result.message || 'Licenza non valida'), 'error');
                        btn.textContent = '🔓 Attiva Licenza';
                        btn.disabled = false;
                    }
                } catch(e) {
                    showLicenseAlert('❌ Errore di connessione. Riprova.', 'error');
                    btn.textContent = '🔓 Attiva Licenza';
                    btn.disabled = false;
                }
            }

            btn.addEventListener('click', doActivate);
            keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') doActivate(); });
        }

        // ==========================================
        // LICENZA - BANNER SCADENZA (avviso 30gg)
        // ==========================================

        function showLicenseBanner() {
            const data = getLicenseData();
            if (!data || !data.expiry) return;

            const daysLeft = Math.ceil((new Date(data.expiry) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft > 30) return; // Nessun banner se mancano più di 30 giorni

            const banner = document.createElement('div');
            const isExpired = daysLeft <= 0;
            banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:99999;padding:8px 16px;text-align:center;font-size:0.82rem;font-weight:600;${isExpired ? 'background:#450a0a;color:#d90429;border-bottom:2px solid #d90429' : 'background:#422006;color:#f59e0b;border-bottom:2px solid #f59e0b'}`;
            banner.innerHTML = isExpired
                ? `⚠️ Licenza Sport Monitoring <strong>SCADUTA</strong>. Contatta Sport Monitoring per rinnovarla. <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:8px;font-size:1rem">✕</button>`
                : `⏰ Licenza Sport Monitoring in scadenza tra <strong>${daysLeft} giorni</strong> (${new Date(data.expiry+'T00:00:00').toLocaleDateString('it-IT')}). <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:8px;font-size:1rem">✕</button>`;

            document.body.prepend(banner);
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
                const societyId = sessionStorage.getItem(SESSION_SOCIETY);
                const headers = {};
                if (societyId) headers['X-Society-Id'] = societyId;
                
                const response = await fetch('/api/annate/list', { headers });
                
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
                    <h1 style="color:#60a5fa;margin:0 0 10px 0;font-size:28px;font-weight:700;">SPORT MONITORING</h1>
                    <p style="color:#64748b;margin:0;">Sport Monitoring</p>
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
                            style="width:100%;padding:12px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;font-size:16px;box-sizing:border-box;"
                        />
                    </div>
                    
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;font-weight:500;display:block;margin-bottom:8px;">
                            Password
                        </label>
                        <div style="position:relative;">
                            <input 
                                type="password" 
                                id="password" 
                                placeholder="Inserisci password"
                                autocomplete="current-password"
                                style="width:100%;padding:12px;padding-right:44px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;font-size:16px;box-sizing:border-box;"
                            />
                            <button 
                                type="button"
                                onclick="(function(){var f=document.getElementById('password');var b=document.getElementById('toggle-pwd-btn');if(f.type==='password'){f.type='text';b.textContent='🙈';}else{f.type='password';b.textContent='👁';}})()"
                                id="toggle-pwd-btn"
                                style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;padding:4px;line-height:1;"
                                title="Mostra/Nascondi password"
                            >👁</button>
                        </div>
                    </div>
                    
                    <div id="error" style="color:#d90429;font-size:14px;text-align:center;min-height:20px;"></div>
                    
                    <button 
                        type="submit"
                        style="background:linear-gradient(135deg,#3b82f6 0%,#3b82f6 100%);color:#ffffff;padding:14px;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:transform 0.2s;"
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
                        // Salva permissions per controllo lato client
                        if (result.user && result.user.permissions) {
                            sessionStorage.setItem('gosport_permissions', JSON.stringify(result.user.permissions));
                        }
                        
                        // Salva societyId per filtrare annate e utenti
                        if (result.societyId) {
                            sessionStorage.setItem(SESSION_SOCIETY, result.societyId);
                        } else {
                            sessionStorage.removeItem(SESSION_SOCIETY);
                        }

                        // Salva licenseStatus per verifiche
                        if (result.licenseStatus) {
                            sessionStorage.setItem('gosport_license_status', JSON.stringify(result.licenseStatus));
                            // Salva piano licenza: viene da licenseStatus.plan (login con societyId)
                            const planFromLogin = result.licenseStatus.plan || result.plan || 'platinum';
                            sessionStorage.setItem('gosport_license_plan', planFromLogin);
                        }

                        const expiry = Date.now() + (8 * 60 * 60 * 1000);
                        sessionStorage.setItem(SESSION_KEY + '_expiry', expiry.toString());
                        
                        // Registra accesso — usa /api/log che non richiede annata
                        try {
                            fetch('/api/log', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    entry: {
                                        ts: new Date().toISOString(),
                                        username: username,
                                        role: result.role || 'user',
                                        societyId: result.societyId || null
                                    }
                                })
                            }).then(r => r.json())
                              .then(d => console.log('✅ Log accesso:', d))
                              .catch(e => console.warn('Log non critico:', e.message));
                        } catch(e) { /* non bloccante */ }
                        
                        errorDiv.textContent = '✅ Login effettuato!';
                        errorDiv.style.color = '#16a34a';
                        
                        setTimeout(() => proceedAfterLogin(), 500);
                    } else {
                        errorDiv.textContent = '❌ Credenziali non valide';
                        errorDiv.style.color = '#d90429';
                    }
                } catch (error) {
                    errorDiv.textContent = '❌ ' + error.message;
                    errorDiv.style.color = '#d90429';
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
                    <p style="color:#64748b;margin:0;">Bentornato, <strong style="color:#60a5fa;">${username}</strong></p>
                    ${role === 'admin' ? '<p style="color:#f59e0b;margin:5px 0 0 0;font-size:13px;">👑 Modalità Amministratore</p>' : ''}
                </div>
                
                <div id="annate-list" style="display:flex;flex-direction:column;gap:15px;margin-bottom:20px;">
                    <div style="text-align:center;color:#64748b;padding:40px;">
                        <div style="font-size:32px;margin-bottom:10px;">⏳</div>
                        <p>Caricamento annate...</p>
                    </div>
                </div>
                
                ${role === 'admin' ? `
                <div style="margin-top:30px;padding-top:20px;border-top:1px solid rgba(96,165,250,0.2);">
                    <button 
                        id="manage-users-btn"
                        style="width:100%;background:linear-gradient(135deg,#f59e0b 0%,#f59e0b 100%);color:#ffffff;padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:transform 0.2s;"
                        onmouseover="this.style.transform='scale(1.02)'"
                        onmouseout="this.style.transform='scale(1)'"
                    >
                        ⚙️ Gestione Utenti, Annate e Gruppi
                    </button>
                </div>
                ` : ''}
                
                <div style="margin-top:20px;text-align:center;">
                    <button 
                        id="logout-btn-annata"
                        style="background:transparent;color:#d90429;border:1px solid #d90429;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;"
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
                        <div style="text-align:center;color:#64748b;padding:40px;">
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
                    annataCard.style.cssText = 'background:linear-gradient(135deg,#1e293b 0%,#64748b 100%);padding:20px;border-radius:12px;cursor:pointer;border:2px solid rgba(96,165,250,0.2);transition:all 0.3s;';
                    
                    annataCard.innerHTML = `
                        <h3 style="color:#60a5fa;margin:0 0 8px 0;font-size:20px;">${annata.nome}</h3>
                        <p style="color:#64748b;margin:0;font-size:14px;">📅 ${annata.dataInizio} - ${annata.dataFine}</p>
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
                    <div style="text-align:center;color:#d90429;padding:40px;">
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
// PANNELLO ADMIN AGGIORNATO - USA API UNIFICATE
// Sostituisci la funzione showAdminPanel() e tutte le funzioni correlate
// nel file /public/auth-multi-annata.js
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
                    <p style="color:#64748b;margin:0;">Gestione Utenti, Annate e Gruppi</p>
                </div>
                <button id="back-btn" style="background:#64748b;color:#ffffff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">
                    ← Torna Indietro
                </button>
            </div>
        </div>
        
        <div style="background:rgba(30,41,59,0.95);padding:20px;border-radius:15px;margin-bottom:20px;border:1px solid rgba(96,165,250,0.2);">
            <div style="display:flex;gap:10px;">
                <button id="tab-annate" class="tab-btn active" style="flex:1;background:linear-gradient(135deg,#3b82f6 0%,#3b82f6 100%);color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                    📅 Gestione Annate e Gruppi
                </button>
                <button id="tab-utenti" class="tab-btn" style="flex:1;background:#64748b;color:#64748b;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
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
            tab.style.background = 'linear-gradient(135deg,#3b82f6 0%,#3b82f6 100%)';
            tab.style.color = '#fff';
        } else {
            tab.style.background = '#64748b';
            tab.style.color = '#64748b';
        }
    });
    
    if (tabName === 'annate') {
        showAnnatePanel();
    } else {
        showUtentiPanel();
    }
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
                <button id="add-annata-btn" style="background:linear-gradient(135deg,#16a34a 0%,#16a34a 100%);color:#ffffff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;">
                    ➕ Crea Nuova Annata e Gruppo
                </button>
            </div>
            <div id="annate-list-admin" style="display:flex;flex-direction:column;gap:15px;">
                <div style="text-align:center;padding:40px;color:#64748b;">
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
        const _sid = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/annate/list', _sid ? {headers:{'X-Society-Id':_sid}} : {});
        if (!response.ok) throw new Error('Errore caricamento');
        
        const data = await response.json();
        const annate = data.annate || [];
        
        if (annate.length === 0) {
            listDiv.innerHTML = `
                <div style="text-align:center;padding:40px;color:#64748b;">
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
                        <p style="color:#64748b;margin:0 0 5px 0;font-size:14px;">📅 ${annata.dataInizio} - ${annata.dataFine}</p>
                        <p style="color:#64748b;margin:0;font-size:14px;">👥 ${athletesCount} atleti</p>
                        ${annata.descrizione ? `<p style="color:#64748b;margin:10px 0 0 0;font-size:13px;">${annata.descrizione}</p>` : ''}
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="editAnnata('${annata.id}')" style="background:#3b82f6;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            ✏️ Modifica
                        </button>
                        <button onclick="deleteAnnata('${annata.id}', '${annata.nome}')" style="background:#d90429;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            🗑️ Elimina
                        </button>
                    </div>
                </div>
            `;
            listDiv.appendChild(card);
        }
    } catch (error) {
        listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#d90429;"><p>Errore: ${error.message}</p></div>`;
    }
}

function showAnnataModal(annataData = null) {
    const isEdit = annataData !== null;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;';
    
    modal.innerHTML = `
        <div style="background:#1e293b;padding:30px;border-radius:15px;max-width:500px;width:90%;border:1px solid rgba(96,165,250,0.2);">
            <h2 style="color:#60a5fa;margin:0 0 20px 0;">${isEdit ? '✏️ Modifica Annata e Gruppo' : '➕ Crea Nuova Annata e Gruppo'}</h2>
            <form id="annata-form" style="display:flex;flex-direction:column;gap:15px;">
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Nome *</label>
                    <input type="text" id="annata-nome" value="${annataData?.nome || ''}" placeholder="es. 2024" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Data Inizio *</label>
                        <input type="date" id="annata-inizio" value="${annataData?.dataInizio || ''}" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required />
                    </div>
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Data Fine *</label>
                        <input type="date" id="annata-fine" value="${annataData?.dataFine || ''}" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required />
                    </div>
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Descrizione</label>
                    <textarea id="annata-desc" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;min-height:80px;">${annataData?.descrizione || ''}</textarea>
                </div>
                ${!isEdit ? `
                <div style="background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:12px;">
                    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;color:#e2e8f0;font-size:14px;">
                        <input type="checkbox" id="copia-atleti" style="width:16px;height:16px;cursor:pointer;">
                        <span>📋 Copia gli atleti dall'annata corrente nella nuova annata</span>
                    </label>
                </div>` : ''}
                <div style="display:flex;gap:10px;margin-top:10px;">
                    <button type="submit" style="flex:1;background:linear-gradient(135deg,#16a34a 0%,#16a34a 100%);color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ${isEdit ? '💾 Salva' : '➕ Crea'}
                    </button>
                    <button type="button" id="cancel-btn" style="flex:1;background:#64748b;color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
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
            const _sid = sessionStorage.getItem('gosport_society_id');
            const response = await fetch('/api/annate/manage', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(_sid ? { 'X-Society-Id': _sid } : {})
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Errore');
            }
            
            const result = await response.json();
            document.body.removeChild(modal);

            // Copia atleti se checkbox spuntato e nuova annata
            if (!isEdit) {
                const copiaAtleti = document.getElementById('copia-atleti');
                if (copiaAtleti && copiaAtleti.checked) {
                    const currentAnnata = sessionStorage.getItem('gosport_current_annata') || '';
                    if (currentAnnata && result.annata && result.annata.id) {
                        try {
                            // Leggi atleti dall'annata corrente
                            const r = await fetch('/api/data', {
                                headers: { 'X-Annata-Id': currentAnnata, 'Content-Type': 'application/json' }
                            });
                            const d = await r.json();
                            const atleti = (d.athletes || []).map(a => ({
                                ...a,
                                isCaptain: false,
                                isViceCaptain: false
                            }));
                            if (atleti.length > 0) {
                                // Salva atleti nella nuova annata
                                await fetch('/api/data', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-Annata-Id': result.annata.id
                                    },
                                    body: JSON.stringify({ athletes: atleti })
                                });
                                alert(`✅ Annata creata! ${atleti.length} atleti copiati nella nuova annata.`);
                            } else {
                                alert('✅ Annata creata! Nessun atleta da copiare.');
                            }
                        } catch(copyErr) {
                            alert('✅ Annata creata, ma errore nella copia atleti: ' + copyErr.message);
                        }
                    } else {
                        alert('✅ Annata creata!');
                    }
                } else {
                    alert('✅ Annata creata!');
                }
            } else {
                alert('✅ Annata modificata!');
            }
            loadAnnateList();
        } catch (error) {
            alert('❌ ' + error.message);
        }
    });
}

window.editAnnata = async function(annataId) {
    try {
        const _sid = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/annate/list', _sid ? {headers:{'X-Society-Id':_sid}} : {});
        const data = await response.json();
        const annata = data.annate.find(a => a.id === annataId);
        if (annata) showAnnataModal(annata);
    } catch (error) {
        alert('❌ ' + error.message);
    }
};

window.deleteAnnata = async function(annataId, nomeAnnata) {
    var _pA = prompt('🔐 Elimina annata: ' + nomeAnnata + '\nPassword:'); if (_pA === null) return; if (_pA !== '1234') { alert('❌ Password errata.'); return; }
    
    try {
        const _sid = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/annate/manage', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(_sid ? { 'X-Society-Id': _sid } : {})
            },
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
                <button id="add-user-btn" style="background:linear-gradient(135deg,#16a34a 0%,#16a34a 100%);color:#ffffff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;">
                    ➕ Crea Nuovo Utente
                </button>
            </div>
            <div id="users-list-admin" style="display:flex;flex-direction:column;gap:15px;">
                <div style="text-align:center;padding:40px;color:#64748b;">
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
        const _sid2 = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/auth/manage', _sid2 ? {headers:{'X-Society-Id':_sid2}} : {});
        if (!response.ok) throw new Error('Errore caricamento');
        
        // Carica lista annate per mostrare i nomi nel box utenti
        let annateMap = {};
        try {
            const annateRes = await fetch('/api/annate/list', _sid2 ? {headers:{'X-Society-Id':_sid2}} : {});
            if (annateRes.ok) {
                const annateData = await annateRes.json();
                (annateData.annate || []).forEach(a => { annateMap[a.id] = a.nome; });
            }
        } catch(e) {}
        
        const data = await response.json();
        const users = data.users || [];
        
        if (users.length === 0) {
            listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;"><p>Nessun utente</p></div>`;
            return;
        }
        
        listDiv.innerHTML = '';
        
        users.forEach(user => {
            const roleMap = {
                'admin':          { icon: '👑', name: 'ADMIN',          color: '#f59e0b' },
                'coach_l1':       { icon: '🥇', name: 'COACH L1',       color: '#16a34a' },
                'coach_l2':       { icon: '🥈', name: 'COACH L2',       color: '#3b82f6' },
                'coach_l3':       { icon: '🥉', name: 'COACH L3',       color: '#8b5cf6' },
                'coach_readonly': { icon: '👁️', name: 'READ-ONLY',      color: '#64748b' },
                'dirigente_l1':   { icon: '🏅', name: 'DIRIGENTE L1',   color: '#ec4899' },
                'dirigente_l2':   { icon: '📂', name: 'DIRIGENTE L2',   color: '#f59e0b' },
                'dirigente_l3':   { icon: '📋', name: 'DIRIGENTE L3',   color: '#a855f7' },
                'dirigente_l4':   { icon: '📋', name: 'DIRIGENTE L4',   color: '#64748b' },
                'societa_l1':     { icon: '🏛️', name: 'SOCIETÀ L1',     color: '#06b6d4' },
                'societa_l3':     { icon: '🏢', name: 'SOCIETÀ L3',     color: '#0ea5e9' },
            };
            const roleInfo = roleMap[user.role] || { icon: '👨‍🏫', name: user.role.toUpperCase(), color: '#3b82f6' };
            const roleIcon = roleInfo.icon;
            const roleName = roleInfo.name;
            const roleColor = roleInfo.color;
            
            const card = document.createElement('div');
            card.style.cssText = 'background:#1e293b;padding:20px;border-radius:12px;border:1px solid rgba(96,165,250,0.2);';
            
            const annateText = user.role === 'admin'
                ? 'Tutte'
                : (user.annate?.length > 0
                    ? user.annate.map(id => annateMap[id] || id).join(', ')
                    : 'Nessuna');
            
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                            <h3 style="color:#60a5fa;margin:0;">${user.username}</h3>
                            <span style="background:${roleColor};color:#ffffff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">
                                ${roleIcon} ${roleName}
                            </span>
                        </div>
                        <p style="color:#64748b;margin:0;font-size:14px;">📧 ${user.email || 'N/A'}</p>
                        ${(user.nome || user.cognome) ? `<p style="color:#64748b;margin:3px 0 0 0;font-size:14px;">👤 ${[user.nome, user.cognome].filter(Boolean).join(' ')}</p>` : ''}
                        ${user.note ? `<p style="color:#64748b;margin:3px 0 0 0;font-size:14px;">📝 ${user.note}</p>` : ''}
                        <p style="color:#64748b;margin:5px 0 0 0;font-size:14px;">📅 Annate: ${annateText}</p>
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="editUser('${user.username}')" style="background:#3b82f6;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            ✏️ Modifica
                        </button>
                        ${user.role !== 'admin' ? `
                        <button onclick="deleteUser('${user.username}')" style="background:#d90429;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            🗑️ Elimina
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
            listDiv.appendChild(card);
        });
    } catch (error) {
        listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#d90429;"><p>Errore: ${error.message}</p></div>`;
    }
}

async function showUserModal(userData = null) {
    const isEdit = userData !== null;
    
    let annateDisponibili = [];
    try {
        const _sid = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/annate/list', _sid ? {headers:{'X-Society-Id':_sid}} : {});
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
                    <input type="text" id="user-username" value="${userData?.username || ''}" ${isEdit ? 'disabled' : ''} placeholder="es. mario.rossi" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required />
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">
                        Password ${isEdit ? '(opzionale - lascia vuoto per non modificare)' : '*'}
                    </label>
                    <input 
                        type="password" 
                        id="user-password" 
                        placeholder="${isEdit ? 'Nuova password (opzionale)' : 'Password'}" 
                        style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" 
                        ${!isEdit ? 'required' : ''} 
                    />
                    ${isEdit ? '<small style="color:#64748b;font-size:12px;">Compila solo se vuoi cambiare la password</small>' : ''}
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Email</label>
                    <input type="email" id="user-email" value="${userData?.email || ''}" placeholder="email@esempio.com" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" />
                </div>
                <div style="display:flex;gap:10px;">
                    <div style="flex:1;">
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Nome</label>
                        <input type="text" id="user-nome" value="${userData?.nome || ''}" placeholder="es. Mario" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" />
                    </div>
                    <div style="flex:1;">
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Cognome</label>
                        <input type="text" id="user-cognome" value="${userData?.cognome || ''}" placeholder="es. Rossi" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" />
                    </div>
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Note</label>
                    <textarea id="user-note" placeholder="Note aggiuntive..." rows="2" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;resize:vertical;">${userData?.note || ''}</textarea>
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Ruolo *</label>
                    <select id="user-role" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required>
                        <!-- supercoach nascosto -->
                        <option value="admin" ${userData?.role === 'admin' ? 'selected' : ''}>👑 ADMIN</option>
                        <option value="coach_l1" ${userData?.role === 'coach_l1' ? 'selected' : ''}>🥇 Coach L1 (Edit + GPS)</option>
                        <option value="coach_l2" ${userData?.role === 'coach_l2' ? 'selected' : ''}>🥈 Coach L2 (Edit, GPS View)</option>
                        <option value="coach_l3" ${userData?.role === 'coach_l3' ? 'selected' : ''}>🥉 Coach L3 (Read + GPS View)</option>
                        <option value="coach_readonly" ${userData?.role === 'coach_readonly' ? 'selected' : ''}>👁️ Coach Read-only</option><option value=\"dirigente_l2\" ${userData?.role === 'dirigente_l2' ? 'selected' : ''}>📂 Dirigente L2 (Edit+Materiale)</option><option value="dirigente_l3" ${userData?.role === 'dirigente_l3' ? 'selected' : ''}>📋 Dirigente L3 (Squadra)</option><option value="dirigente_l1" ${userData?.role === 'dirigente_l1' ? 'selected' : ''}>🏅 Dirigente L1 (Edit+Materiale Completo)</option><option value=\"dirigente_l4\" ${userData?.role === 'dirigente_l4' ? 'selected' : ''}>📋 Dirigente L4 (Solo Materiale)</option>
                        <option value="societa_l1" ${userData?.role === 'societa_l1' ? 'selected' : ''}>🏛️ Società L1 (Dirigenti Società)</option>
                        <option value="societa_l3" ${userData?.role === 'societa_l3' ? 'selected' : ''}>🏢 Società L3 (Segreteria + Visione Base)</option>
                    </select>
                </div>
                <div id="annate-container" style="display:${userData?.role !== 'admin' || !userData ? 'block' : 'none'};">
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:8px;">Annate</label>
                    <div style="max-height:200px;overflow-y:auto;border:1px solid rgba(96,165,250,0.3);border-radius:8px;padding:10px;background:#0f172a;display:flex;flex-direction:column;gap:5px;">
                        ${annateCheckboxes || '<p style="color:#64748b;margin:0;text-align:center;">Nessuna annata</p>'}
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:10px;">
                    <button type="submit" style="flex:1;background:linear-gradient(135deg,#16a34a 0%,#16a34a 100%);color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ${isEdit ? '💾 Salva' : '➕ Crea'}
                    </button>
                    <button type="button" id="cancel-user-btn" style="flex:1;background:#64748b;color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ❌ Annulla
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('user-role').addEventListener('change', (e) => {
        document.getElementById('annate-container').style.display = e.target.value !== 'admin' ? 'block' : 'none';
    });
    
    document.getElementById('cancel-user-btn').addEventListener('click', () => document.body.removeChild(modal));
    
    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const role = document.getElementById('user-role').value;
        const annateSelezionate = role !== 'admin' ? Array.from(document.querySelectorAll('input[name="annate"]:checked')).map(cb => cb.value) : [];
        
        if ((role === 'coach' || role === 'supercoach') && annateSelezionate.length === 0) {
            alert('⚠️ Seleziona almeno un\'annata');
            return;
        }
        
        const payload = {
            action: isEdit ? 'update' : 'create',
            username: document.getElementById('user-username').value.trim(),
            email: document.getElementById('user-email').value.trim(),
            nome: document.getElementById('user-nome').value.trim(),
            cognome: document.getElementById('user-cognome').value.trim(),
            note: document.getElementById('user-note').value.trim(),
            role,
            annate: annateSelezionate
        };
        
        // Invia la password solo se:
        // - È una creazione (!isEdit)
        // - È una modifica E il campo password è compilato (isEdit && password non vuota)
        const passwordValue = document.getElementById('user-password').value.trim();
        if (!isEdit || (isEdit && passwordValue !== '')) {
            payload.password = passwordValue;
        }
        
        try {
            const _sid2 = sessionStorage.getItem('gosport_society_id');
            const response = await fetch('/api/auth/manage', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(_sid2 ? { 'X-Society-Id': _sid2 } : {})
                },
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
        const _sid2 = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/auth/manage', _sid2 ? {headers:{'X-Society-Id':_sid2}} : {});
        const data = await response.json();
        const user = data.users.find(u => u.username === username);
        if (user) showUserModal(user);
    } catch (error) {
        alert('❌ ' + error.message);
    }
};

window.deleteUser = async function(username) {
    var _pU = prompt('🔐 Elimina utente: ' + username + '\nPassword:'); if (_pU === null) return; if (_pU !== '1234') { alert('❌ Password errata.'); return; }
    
    try {
        const _sid2 = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/auth/manage', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(_sid2 ? { 'X-Society-Id': _sid2 } : {})
            },
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
                    <p style="color:#64748b;margin:0;">Gestione Utenti, Annate e Gruppi</p>
                </div>
                <button id="back-btn" style="background:#64748b;color:#ffffff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">
                    ← Torna Indietro
                </button>
            </div>
        </div>
        
        <div style="background:rgba(30,41,59,0.95);padding:20px;border-radius:15px;margin-bottom:20px;border:1px solid rgba(96,165,250,0.2);">
            <div style="display:flex;gap:10px;">
                <button id="tab-annate" class="tab-btn active" style="flex:1;background:linear-gradient(135deg,#3b82f6 0%,#3b82f6 100%);color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                    📅 Gestione Annate e Gruppi
                </button>
                <button id="tab-utenti" class="tab-btn" style="flex:1;background:#64748b;color:#64748b;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
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
            tab.style.background = 'linear-gradient(135deg,#3b82f6 0%,#3b82f6 100%)';
            tab.style.color = '#fff';
        } else {
            tab.style.background = '#64748b';
            tab.style.color = '#64748b';
        }
    });
    
    if (tabName === 'annate') {
        showAnnatePanel();
    } else {
        showUtentiPanel();
    }
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
                <button id="add-annata-btn" style="background:linear-gradient(135deg,#16a34a 0%,#16a34a 100%);color:#ffffff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;">
                    ➕ Crea Nuova Annata e Gruppo
                </button>
            </div>
            <div id="annate-list-admin" style="display:flex;flex-direction:column;gap:15px;">
                <div style="text-align:center;padding:40px;color:#64748b;">
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
        const _sid = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/annate/list', _sid ? {headers:{'X-Society-Id':_sid}} : {});
        if (!response.ok) throw new Error('Errore caricamento');
        
        const data = await response.json();
        const annate = data.annate || [];
        
        if (annate.length === 0) {
            listDiv.innerHTML = `
                <div style="text-align:center;padding:40px;color:#64748b;">
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
                        <p style="color:#64748b;margin:0 0 5px 0;font-size:14px;">📅 ${annata.dataInizio} - ${annata.dataFine}</p>
                        <p style="color:#64748b;margin:0;font-size:14px;">👥 ${athletesCount} atleti</p>
                        ${annata.descrizione ? `<p style="color:#64748b;margin:10px 0 0 0;font-size:13px;">${annata.descrizione}</p>` : ''}
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="editAnnata('${annata.id}')" style="background:#3b82f6;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            ✏️ Modifica
                        </button>
                        <button onclick="deleteAnnata('${annata.id}', '${annata.nome}')" style="background:#d90429;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            🗑️ Elimina
                        </button>
                    </div>
                </div>
            `;
            listDiv.appendChild(card);
        }
    } catch (error) {
        listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#d90429;"><p>Errore: ${error.message}</p></div>`;
    }
}

function showAnnataModal(annataData = null) {
    const isEdit = annataData !== null;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;';
    
    modal.innerHTML = `
        <div style="background:#1e293b;padding:30px;border-radius:15px;max-width:500px;width:90%;border:1px solid rgba(96,165,250,0.2);">
            <h2 style="color:#60a5fa;margin:0 0 20px 0;">${isEdit ? '✏️ Modifica Annata e Gruppo' : '➕ Crea Nuova Annata e Gruppo'}</h2>
            <form id="annata-form" style="display:flex;flex-direction:column;gap:15px;">
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Nome *</label>
                    <input type="text" id="annata-nome" value="${annataData?.nome || ''}" placeholder="es. 2024" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Data Inizio *</label>
                        <input type="date" id="annata-inizio" value="${annataData?.dataInizio || ''}" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required />
                    </div>
                    <div>
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Data Fine *</label>
                        <input type="date" id="annata-fine" value="${annataData?.dataFine || ''}" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required />
                    </div>
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Descrizione</label>
                    <textarea id="annata-desc" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;min-height:80px;">${annataData?.descrizione || ''}</textarea>
                </div>
                ${!isEdit ? `
                <div style="background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:12px;">
                    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;color:#e2e8f0;font-size:14px;">
                        <input type="checkbox" id="copia-atleti" style="width:16px;height:16px;cursor:pointer;">
                        <span>📋 Copia gli atleti dall'annata corrente nella nuova annata</span>
                    </label>
                </div>` : ''}
                <div style="display:flex;gap:10px;margin-top:10px;">
                    <button type="submit" style="flex:1;background:linear-gradient(135deg,#16a34a 0%,#16a34a 100%);color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ${isEdit ? '💾 Salva' : '➕ Crea'}
                    </button>
                    <button type="button" id="cancel-btn" style="flex:1;background:#64748b;color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
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
            const _sid = sessionStorage.getItem('gosport_society_id');
            const response = await fetch('/api/annate/manage', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(_sid ? { 'X-Society-Id': _sid } : {})
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Errore');
            }
            
            const result = await response.json();
            document.body.removeChild(modal);

            // Copia atleti se checkbox spuntato e nuova annata
            if (!isEdit) {
                const copiaAtleti = document.getElementById('copia-atleti');
                if (copiaAtleti && copiaAtleti.checked) {
                    const currentAnnata = sessionStorage.getItem('gosport_current_annata') || '';
                    if (currentAnnata && result.annata && result.annata.id) {
                        try {
                            // Leggi atleti dall'annata corrente
                            const r = await fetch('/api/data', {
                                headers: { 'X-Annata-Id': currentAnnata, 'Content-Type': 'application/json' }
                            });
                            const d = await r.json();
                            const atleti = (d.athletes || []).map(a => ({
                                ...a,
                                isCaptain: false,
                                isViceCaptain: false
                            }));
                            if (atleti.length > 0) {
                                // Salva atleti nella nuova annata
                                await fetch('/api/data', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-Annata-Id': result.annata.id
                                    },
                                    body: JSON.stringify({ athletes: atleti })
                                });
                                alert(`✅ Annata creata! ${atleti.length} atleti copiati nella nuova annata.`);
                            } else {
                                alert('✅ Annata creata! Nessun atleta da copiare.');
                            }
                        } catch(copyErr) {
                            alert('✅ Annata creata, ma errore nella copia atleti: ' + copyErr.message);
                        }
                    } else {
                        alert('✅ Annata creata!');
                    }
                } else {
                    alert('✅ Annata creata!');
                }
            } else {
                alert('✅ Annata modificata!');
            }
            loadAnnateList();
        } catch (error) {
            alert('❌ ' + error.message);
        }
    });
}

window.editAnnata = async function(annataId) {
    try {
        const _sid = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/annate/list', _sid ? {headers:{'X-Society-Id':_sid}} : {});
        const data = await response.json();
        const annata = data.annate.find(a => a.id === annataId);
        if (annata) showAnnataModal(annata);
    } catch (error) {
        alert('❌ ' + error.message);
    }
};

window.deleteAnnata = async function(annataId, nomeAnnata) {
    var _pA = prompt('🔐 Elimina annata: ' + nomeAnnata + '\nPassword:'); if (_pA === null) return; if (_pA !== '1234') { alert('❌ Password errata.'); return; }
    
    try {
        const _sid = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/annate/manage', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(_sid ? { 'X-Society-Id': _sid } : {})
            },
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
                <button id="add-user-btn" style="background:linear-gradient(135deg,#16a34a 0%,#16a34a 100%);color:#ffffff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;">
                    ➕ Crea Nuovo Utente
                </button>
            </div>
            <div id="users-list-admin" style="display:flex;flex-direction:column;gap:15px;">
                <div style="text-align:center;padding:40px;color:#64748b;">
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
        const _sid2 = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/auth/manage', _sid2 ? {headers:{'X-Society-Id':_sid2}} : {});
        if (!response.ok) throw new Error('Errore caricamento');
        
        // Carica lista annate per mostrare i nomi nel box utenti
        let annateMap = {};
        try {
            const annateRes = await fetch('/api/annate/list', _sid2 ? {headers:{'X-Society-Id':_sid2}} : {});
            if (annateRes.ok) {
                const annateData = await annateRes.json();
                (annateData.annate || []).forEach(a => { annateMap[a.id] = a.nome; });
            }
        } catch(e) {}
        
        const data = await response.json();
        const users = data.users || [];
        
        if (users.length === 0) {
            listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;"><p>Nessun utente</p></div>`;
            return;
        }
        
        listDiv.innerHTML = '';
        
        users.forEach(user => {
            const roleMap = {
                'admin':          { icon: '👑', name: 'ADMIN',          color: '#f59e0b' },
                'coach_l1':       { icon: '🥇', name: 'COACH L1',       color: '#16a34a' },
                'coach_l2':       { icon: '🥈', name: 'COACH L2',       color: '#3b82f6' },
                'coach_l3':       { icon: '🥉', name: 'COACH L3',       color: '#8b5cf6' },
                'coach_readonly': { icon: '👁️', name: 'READ-ONLY',      color: '#64748b' },
                'dirigente_l1':   { icon: '🏅', name: 'DIRIGENTE L1',   color: '#ec4899' },
                'dirigente_l2':   { icon: '📂', name: 'DIRIGENTE L2',   color: '#f59e0b' },
                'dirigente_l3':   { icon: '📋', name: 'DIRIGENTE L3',   color: '#a855f7' },
                'dirigente_l4':   { icon: '📋', name: 'DIRIGENTE L4',   color: '#64748b' },
                'societa_l1':     { icon: '🏛️', name: 'SOCIETÀ L1',     color: '#06b6d4' },
                'societa_l3':     { icon: '🏢', name: 'SOCIETÀ L3',     color: '#0ea5e9' },
            };
            const roleInfo = roleMap[user.role] || { icon: '👨‍🏫', name: user.role.toUpperCase(), color: '#3b82f6' };
            const roleIcon = roleInfo.icon;
            const roleName = roleInfo.name;
            const roleColor = roleInfo.color;
            
            const card = document.createElement('div');
            card.style.cssText = 'background:#1e293b;padding:20px;border-radius:12px;border:1px solid rgba(96,165,250,0.2);';
            
            const annateText = user.role === 'admin'
                ? 'Tutte'
                : (user.annate?.length > 0
                    ? user.annate.map(id => annateMap[id] || id).join(', ')
                    : 'Nessuna');
            
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                            <h3 style="color:#60a5fa;margin:0;">${user.username}</h3>
                            <span style="background:${roleColor};color:#ffffff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">
                                ${roleIcon} ${roleName}
                            </span>
                        </div>
                        <p style="color:#64748b;margin:0;font-size:14px;">📧 ${user.email || 'N/A'}</p>
                        ${(user.nome || user.cognome) ? `<p style="color:#64748b;margin:3px 0 0 0;font-size:14px;">👤 ${[user.nome, user.cognome].filter(Boolean).join(' ')}</p>` : ''}
                        ${user.note ? `<p style="color:#64748b;margin:3px 0 0 0;font-size:14px;">📝 ${user.note}</p>` : ''}
                        <p style="color:#64748b;margin:5px 0 0 0;font-size:14px;">📅 Annate: ${annateText}</p>
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="editUser('${user.username}')" style="background:#3b82f6;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            ✏️ Modifica
                        </button>
                        ${user.role !== 'admin' ? `
                        <button onclick="deleteUser('${user.username}')" style="background:#d90429;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
                            🗑️ Elimina
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
            listDiv.appendChild(card);
        });
    } catch (error) {
        listDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#d90429;"><p>Errore: ${error.message}</p></div>`;
    }
}

async function showUserModal(userData = null) {
    const isEdit = userData !== null;
    
    let annateDisponibili = [];
    try {
        const _sid = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/annate/list', _sid ? {headers:{'X-Society-Id':_sid}} : {});
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
                    <input type="text" id="user-username" value="${userData?.username || ''}" ${isEdit ? 'disabled' : ''} placeholder="es. mario.rossi" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required />
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">
                        Password ${isEdit ? '(opzionale - lascia vuoto per non modificare)' : '*'}
                    </label>
                    <input 
                        type="password" 
                        id="user-password" 
                        placeholder="${isEdit ? 'Nuova password (opzionale)' : 'Password'}" 
                        style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" 
                        ${!isEdit ? 'required' : ''} 
                    />
                    ${isEdit ? '<small style="color:#64748b;font-size:12px;">Compila solo se vuoi cambiare la password</small>' : ''}
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Email</label>
                    <input type="email" id="user-email" value="${userData?.email || ''}" placeholder="email@esempio.com" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" />
                </div>
                <div style="display:flex;gap:10px;">
                    <div style="flex:1;">
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Nome</label>
                        <input type="text" id="user-nome" value="${userData?.nome || ''}" placeholder="es. Mario" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" />
                    </div>
                    <div style="flex:1;">
                        <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Cognome</label>
                        <input type="text" id="user-cognome" value="${userData?.cognome || ''}" placeholder="es. Rossi" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" />
                    </div>
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Note</label>
                    <textarea id="user-note" placeholder="Note aggiuntive..." rows="2" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;resize:vertical;">${userData?.note || ''}</textarea>
                </div>
                <div>
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:5px;">Ruolo *</label>
                    <select id="user-role" style="width:100%;padding:10px;border:1px solid rgba(96,165,250,0.3);border-radius:8px;background:#0f172a;color:#ffffff;box-sizing:border-box;" required>
                        <!-- supercoach nascosto -->
                        <option value="admin" ${userData?.role === 'admin' ? 'selected' : ''}>👑 ADMIN</option>
                        <option value="coach_l1" ${userData?.role === 'coach_l1' ? 'selected' : ''}>🥇 Coach L1 (Edit + GPS)</option>
                        <option value="coach_l2" ${userData?.role === 'coach_l2' ? 'selected' : ''}>🥈 Coach L2 (Edit, GPS View)</option>
                        <option value="coach_l3" ${userData?.role === 'coach_l3' ? 'selected' : ''}>🥉 Coach L3 (Read + GPS View)</option>
                        <option value="coach_readonly" ${userData?.role === 'coach_readonly' ? 'selected' : ''}>👁️ Coach Read-only</option><option value=\"dirigente_l2\" ${userData?.role === 'dirigente_l2' ? 'selected' : ''}>📂 Dirigente L2 (Edit+Materiale)</option><option value="dirigente_l3" ${userData?.role === 'dirigente_l3' ? 'selected' : ''}>📋 Dirigente L3 (Squadra)</option><option value="dirigente_l1" ${userData?.role === 'dirigente_l1' ? 'selected' : ''}>🏅 Dirigente L1 (Edit+Materiale Completo)</option><option value=\"dirigente_l4\" ${userData?.role === 'dirigente_l4' ? 'selected' : ''}>📋 Dirigente L4 (Solo Materiale)</option>
                        <option value="societa_l1" ${userData?.role === 'societa_l1' ? 'selected' : ''}>🏛️ Società L1 (Dirigenti Società)</option>
                        <option value="societa_l3" ${userData?.role === 'societa_l3' ? 'selected' : ''}>🏢 Società L3 (Segreteria + Visione Base)</option>
                    </select>
                </div>
                <div id="annate-container" style="display:${userData?.role !== 'admin' || !userData ? 'block' : 'none'};">
                    <label style="color:#e2e8f0;font-size:14px;display:block;margin-bottom:8px;">Annate</label>
                    <div style="max-height:200px;overflow-y:auto;border:1px solid rgba(96,165,250,0.3);border-radius:8px;padding:10px;background:#0f172a;display:flex;flex-direction:column;gap:5px;">
                        ${annateCheckboxes || '<p style="color:#64748b;margin:0;text-align:center;">Nessuna annata</p>'}
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:10px;">
                    <button type="submit" style="flex:1;background:linear-gradient(135deg,#16a34a 0%,#16a34a 100%);color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ${isEdit ? '💾 Salva' : '➕ Crea'}
                    </button>
                    <button type="button" id="cancel-user-btn" style="flex:1;background:#64748b;color:#ffffff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;">
                        ❌ Annulla
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('user-role').addEventListener('change', (e) => {
        document.getElementById('annate-container').style.display = e.target.value !== 'admin' ? 'block' : 'none';
    });
    
    document.getElementById('cancel-user-btn').addEventListener('click', () => document.body.removeChild(modal));
    
    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const role = document.getElementById('user-role').value;
        const annateSelezionate = role !== 'admin' ? Array.from(document.querySelectorAll('input[name="annate"]:checked')).map(cb => cb.value) : [];
        
        if ((role === 'coach' || role === 'supercoach') && annateSelezionate.length === 0) {
            alert('⚠️ Seleziona almeno un\'annata');
            return;
        }
        
        const payload = {
            action: isEdit ? 'update' : 'create',
            username: document.getElementById('user-username').value.trim(),
            email: document.getElementById('user-email').value.trim(),
            nome: document.getElementById('user-nome').value.trim(),
            cognome: document.getElementById('user-cognome').value.trim(),
            note: document.getElementById('user-note').value.trim(),
            role,
            annate: annateSelezionate
        };
        
        // Invia la password solo se:
        // - È una creazione (!isEdit)
        // - È una modifica E il campo password è compilato (isEdit && password non vuota)
        const passwordValue = document.getElementById('user-password').value.trim();
        if (!isEdit || (isEdit && passwordValue !== '')) {
            payload.password = passwordValue;
        }
        
        try {
            const _sid2 = sessionStorage.getItem('gosport_society_id');
            const response = await fetch('/api/auth/manage', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(_sid2 ? { 'X-Society-Id': _sid2 } : {})
                },
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
        const _sid2 = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/auth/manage', _sid2 ? {headers:{'X-Society-Id':_sid2}} : {});
        const data = await response.json();
        const user = data.users.find(u => u.username === username);
        if (user) showUserModal(user);
    } catch (error) {
        alert('❌ ' + error.message);
    }
};

window.deleteUser = async function(username) {
    var _pU = prompt('🔐 Elimina utente: ' + username + '\nPassword:'); if (_pU === null) return; if (_pU !== '1234') { alert('❌ Password errata.'); return; }
    
    try {
        const _sid2 = sessionStorage.getItem('gosport_society_id');
        const response = await fetch('/api/auth/manage', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(_sid2 ? { 'X-Society-Id': _sid2 } : {})
            },
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
        // UI - LOGOUT BUTTON IN APP
        // ==========================================
        

        // ==========================================
        // NAVIGAZIONE PER RUOLO
        // Nasconde i tab non accessibili per ogni ruolo
        // ==========================================
        
        function applyRoleNavigation() {
            const role = getUserRole();
            if (!role) return;

            // Esegui solo su index.html (non su calendario.html o altre pagine)
            const isIndexPage = document.getElementById('home-section') !== null;
            if (!isIndexPage) return;

            // Admin: mostra elementi admin-only, poi applica comunque le restrizioni piano
            if (role === 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
                // Non fare return: continua per applicare le restrizioni del piano licenza
            }

            // ─── Mappa tab nascosti per ruolo ───
            // I tab ID corrispondono agli attributi data-tab nel HTML
            const TAB_RESTRICTIONS = {
                coach_l1:       [],
                coach_l2:       [],
                coach_l3:       ['pagamenti-section'],
                coach_readonly: ['monitoraggio-gps-section', 'analisi-singolo-section', 'pagamenti-section'],
                dirigente_l1:   [],
                dirigente_l2:   [],
                dirigente_l3:   ['monitoraggio-gps-section', 'analisi-singolo-section', 'pagamenti-section'],
                dirigente_l4:   [
                    'formazione-section', 'calendario-section', 'match-results-section',
                    'report-valutazioni-section', 'report-presenze-section', 'hall-of-fame-section',
                    'monitoraggio-gps-section', 'analisi-singolo-section',
                    'pagamenti-section', 'convocazioni-section'
                ],
                societa_l1: [
                    'formazione-section', 'match-results-section', 'report-valutazioni-section',
                    'hall-of-fame-section', 'monitoraggio-gps-section', 'analisi-singolo-section',
                    'convocazioni-section'
                ],
                societa_l3: [
                    'formazione-section', 'calendario-section', 'match-results-section',
                    'report-valutazioni-section', 'report-presenze-section', 'hall-of-fame-section',
                    'monitoraggio-gps-section', 'analisi-singolo-section', 'convocazioni-section'
                ],
            };

            // Ruoli che NON vedono il link Cal. ↗ esterno
            const HIDE_CAL_EXT = ['dirigente_l4'];

            const hiddenTabs = TAB_RESTRICTIONS[role] || [];

            // Nascondi i pulsanti tab specificati
            hiddenTabs.forEach(tabId => {
                const btn = document.querySelector('[data-tab="' + tabId + '"]');
                if (btn) btn.style.display = 'none';
            });

            // Nascondi Cal. ↗ esterno se necessario
            if (HIDE_CAL_EXT.includes(role)) {
                document.querySelectorAll('.tab-external').forEach(el => el.style.display = 'none');
            }

            console.log('🔐 Navigazione applicata per ruolo: ' + role + ' | Tab nascosti: ' + hiddenTabs.length);

            // ── Restrizioni per PIANO LICENZA ─────────────────────────────
            // Si applicano SOPRA al ruolo: se il piano non include un tab, nessun ruolo lo vede
            var licensePlan = sessionStorage.getItem('gosport_license_plan') || 'platinum';

            // Tab inclusi per piano (cumulativi: gold include silver, platinum include tutto)
            var PLAN_TABS = {
                silver:   ['home-section', 'squadra-section', 'materiale-section',
                           'pagamenti-section', 'convocazioni-section'],
                gold:     ['home-section', 'squadra-section', 'materiale-section',
                           'calendario-section', 'pagamenti-section', 'convocazioni-section',
                           'monitoraggio-gps-section', 'analisi-singolo-section',
                           'report-presenze-section'],
                platinum: ['home-section', 'squadra-section', 'materiale-section',
                           'calendario-section', 'pagamenti-section', 'convocazioni-section',
                           'monitoraggio-gps-section', 'analisi-singolo-section',
                           'report-presenze-section', 'formazione-section',
                           'match-results-section', 'report-valutazioni-section',
                           'hall-of-fame-section', 'accessi-section']
            };

            var allowedByPlan = PLAN_TABS[licensePlan] || PLAN_TABS['silver'];

            // Nascondi tutti i tab non inclusi nel piano
            document.querySelectorAll('[data-tab]').forEach(function(btn) {
                var tabId = btn.getAttribute('data-tab');
                if (allowedByPlan.indexOf(tabId) === -1) {
                    btn.style.display = 'none';
                }
            });

            // Cal. ↗ esterno: visibile da Gold in su
            if (licensePlan === 'silver') {
                document.querySelectorAll('.tab-external').forEach(function(el) {
                    el.style.display = 'none';
                });
            }

            console.log('🎫 Piano licenza: ' + licensePlan + ' | Tab consentiti: ' + allowedByPlan.length);

            // Mostra pulsante Reset Fine Annata per i ruoli abilitati
            if (window.setupResetAnnataBtn) window.setupResetAnnataBtn();
        }

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

    window.fetch = async function(...args) {
        let [url, options = {}] = args;

        if (typeof url === 'string' && url.includes('/api/')) {
            options.headers = options.headers || {};

            const isHeaders = options.headers instanceof Headers;
            const currentAnnata = getCurrentAnnata();
            const societyId = sessionStorage.getItem(SESSION_SOCIETY);
            const currentUser = getCurrentUser();
            const currentRole = getUserRole();
            const session = sessionStorage.getItem(SESSION_KEY);

            if (currentAnnata) {
                if (isHeaders) options.headers.set('X-Annata-Id', currentAnnata);
                else options.headers['X-Annata-Id'] = currentAnnata;
            }

            if (societyId) {
                if (isHeaders) options.headers.set('X-Society-Id', societyId);
                else options.headers['X-Society-Id'] = societyId;
            }

            if (session) {
                if (isHeaders) options.headers.set('X-Auth-Session', session);
                else options.headers['X-Auth-Session'] = session;
            }

            if (currentUser) {
                if (isHeaders) options.headers.set('X-Auth-User', currentUser);
                else options.headers['X-Auth-User'] = currentUser;
            }

            if (currentRole) {
                if (isHeaders) options.headers.set('X-User-Role', currentRole);
                else options.headers['X-User-Role'] = currentRole;
            }
        }

        return originalFetch.apply(this, [url, options]);
    };
}

        // ==========================================
        // MAIN FLOW
        // ==========================================

        // Flusso:
        // 1. Non autenticato → Login
        // 2. Autenticato come ADMIN + no licenza verificata → Schermata licenza
        // 3. Autenticato (qualsiasi ruolo) + no annata → Selezione annata
        // 4. Tutto ok → Dashboard

        async function checkLicenseForAdmin() {
            // Solo l'admin deve verificare la licenza
            if (!isAdmin()) return true;

            const savedEmail = localStorage.getItem(LICENSE_EMAIL);
            const savedKey = localStorage.getItem(LICENSE_KEY);

            // Se non ha mai inserito la licenza → mostra schermata
            if (!savedEmail || !savedKey) return false;

            // Ha email+chiave salvate → verifica in cache valida?
            if (isLicenseVerified()) return true;

            // Cache scaduta → ri-verifica in background silenziosamente
            // Nel frattempo lascia passare (non bloccare l'utente)
            try {
                const result = await verifyLicense(savedEmail, savedKey);
                if (result.valid) {
                    saveLicenseVerified(result); // rinnova cache 30gg
                    return true;
                } else if (result.expired) {
                    return 'expired';
                }
                // Chiave non più valida (revocata) → chiede reinserimento
                return false;
            } catch(e) {
                // Errore rete → lascia passare con i dati salvati
                console.warn('⚠️ Verifica licenza offline - accesso consentito');
                return true;
            }
        }

        async function proceedAfterLogin() {
            // Verifica se il login ha restituito info sulla licenza
            const licenseStatus = sessionStorage.getItem('gosport_license_status');
            
            if (licenseStatus) {
                try {
                    const status = JSON.parse(licenseStatus);
                    
                    if (!status.valid) {
                        if (status.reason === 'expired') {
                            showLicenseScreen(`Licenza scaduta il ${new Date(status.expiry + 'T00:00:00').toLocaleDateString('it-IT')}. Contatta Sport Monitoring per rinnovarla.`);
                        } else if (status.reason === 'revoked') {
                            showLicenseScreen('Licenza disattivata. Contatta Sport Monitoring.');
                        } else if (status.reason === 'missing') {
                            showLicenseScreen(null); // Prima attivazione
                        }
                        return;
                    }
                    // Licenza valida → procedi
                } catch(e) {}
            }

            // Coach o admin con licenza ok → selezione annata
            showAnnataSelection();
        }

        if (!isAuthenticated()) {
            showLoginScreen();
        } else if (!hasSelectedAnnata()) {
            // Già autenticato ma no annata → controlla licenza se admin
            proceedAfterLogin();
        } else {
            // Già autenticato e annata selezionata → dashboard
            if (originalBodyHTML) {
                document.body.innerHTML = originalBodyHTML;
            }
            document.documentElement.classList.add('authenticated');
            setupFetchInterceptor();
            addLogoutButton();
            // Ripristina piano licenza da localStorage o licenseStatus se non già in sessione
            if (!sessionStorage.getItem('gosport_license_plan')) {
                try {
                    // Prima prova da licenseStatus (login con societyId)
                    const ls = sessionStorage.getItem('gosport_license_status');
                    if (ls) {
                        const parsed = JSON.parse(ls);
                        if (parsed.plan) {
                            sessionStorage.setItem('gosport_license_plan', parsed.plan);
                        }
                    }
                    // Poi prova da localStorage (attivazione manuale)
                    if (!sessionStorage.getItem('gosport_license_plan')) {
                        const ld = localStorage.getItem('gosport_license_data');
                        if (ld) {
                            const parsed = JSON.parse(ld);
                            sessionStorage.setItem('gosport_license_plan', parsed.plan || 'platinum');
                        }
                    }
                } catch(e) {}
            }
            setTimeout(() => applyRoleNavigation(), 150);

            // Banner scadenza solo per admin
            if (isAdmin()) {
                setTimeout(() => showLicenseBanner(), 1000);
            }

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
