// auth-simple.js - Autenticazione semplice
(function() {
    const USERNAME = 'coach';
    const PASSWORD = 'GoSport2025';
    
    // Check if in presenza mode (skip auth)
    if (window.location.pathname.includes('/presenza/')) return;
    if (window.location.pathname.includes('/calendario')) return;
    
    // Check session
    const isAuth = sessionStorage.getItem('authenticated') === 'true';
    
    if (!isAuth) {
        const user = prompt('Username:');
        const pass = prompt('Password:');
        
        if (user === USERNAME && pass === PASSWORD) {
            sessionStorage.setItem('authenticated', 'true');
            location.reload();
        } else {
            alert('Accesso negato');
            document.body.innerHTML = '<h1 style="text-align:center;margin-top:50px;">Accesso negato</h1>';
        }
    }
})();
