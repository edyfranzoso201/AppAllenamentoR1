// data-adapter-multi-annata.js
// Questo file aggiunge supporto per visualizzare l'annata corrente

// ==========================================
// ISTRUZIONI PER L'INTEGRAZIONE
// ==========================================
/*
STEP 1: Aggiungi questo script DOPO auth-multi-annata.js in index.html:
<script src="auth-multi-annata.js"></script>
<script src="data-adapter-multi-annata.js"></script>
<script src="script.js"></script>

IMPORTANTE: NON serve modificare script.js!
Il sistema funziona automaticamente grazie all'interceptor di fetch che
aggiunge l'header X-Annata-Id a tutte le richieste verso /api/data

Il tuo codice esistente continua a funzionare esattamente come prima:
- fetch('/api/data') per GET
- fetch('/api/data', {method: 'POST', body: ...}) per POST

L'unica differenza è che ora i dati sono isolati per annata.
*/

// ==========================================
// INDICATOR ANNATA CORRENTE
// ==========================================

function addAnnataIndicator() {
    const currentAnnata = window.getCurrentAnnata();
    if (!currentAnnata) return;
    
    // Recupera nome annata
    fetch('/api/annate/list')
        .then(r => r.json())
        .then(data => {
            const annata = data.annate.find(a => a.id === currentAnnata);
            if (!annata) return;
            
            const indicator = document.createElement('div');
            indicator.id = 'annata-indicator';
            indicator.style.cssText = 'position:fixed;bottom:20px;left:20px;background:rgba(59,130,246,0.9);color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            indicator.innerHTML = `📅 ${annata.nome}`;
            document.body.appendChild(indicator);
        })
        .catch(err => console.error('Errore indicatore annata:', err));
}

// ==========================================
// GESTIONE CAMBIO ANNATA
// ==========================================

function setupAnnataChangeButton() {
    setTimeout(() => {
        const logoutBtn = document.querySelector('[onclick*="logout"]');
        if (!logoutBtn) return;
        
        const changeAnnataBtn = document.createElement('button');
        changeAnnataBtn.textContent = '🔄 Cambia Annata';
        changeAnnataBtn.style.cssText = 'position:fixed;top:60px;right:20px;background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;z-index:1000;';
        changeAnnataBtn.onclick = () => {
            if (confirm('Vuoi cambiare annata? Le modifiche non salvate andranno perse.')) {
                sessionStorage.removeItem('gosport_current_annata');
                window.location.reload();
            }
        };
        document.body.appendChild(changeAnnataBtn);
    }, 200);
}

// ==========================================
// INIZIALIZZAZIONE
// ==========================================

// Aggiungi indicatore quando la pagina è caricata
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        addAnnataIndicator();
        setupAnnataChangeButton();
    });
} else {
    addAnnataIndicator();
    setupAnnataChangeButton();
}

console.log('✅ Sistema Multi-Annata attivo - Annata corrente:', window.getCurrentAnnata?.() || 'non selezionata');

