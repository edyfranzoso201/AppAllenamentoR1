// data-adapter-multi-annata.js - CORRETTO per compatibilità API
(function() {
    'use strict';

    console.log('📄 Data Adapter Multi-Annata: caricamento...');

    function getCurrentAnnata() {
        return sessionStorage.getItem('gosport_current_annata');
    }

    function isAuthenticated() {
        return sessionStorage.getItem('gosport_auth_session') === 'true';
    }

    function isParentMode() {
        const search = window.location.search;
        const path = window.location.pathname;
        if (search.includes('athleteId=')) return true;
        if (path.includes('/presenza/')) return true;
        return false;
    }

    async function getAnnataForRequest() {
        if (isAuthenticated()) {
            const annataId = getCurrentAnnata();
            if (annataId) return annataId;
        }
        
        if (isParentMode()) {
            try {
                const response = await fetch('/api/annate/list');
                if (response.ok) {
                    const data = await response.json();
                    const annate = data.annate || [];
                    if (annate.length > 0) {
                        const sorted = annate.sort((a, b) => {
                            return new Date(b.dataInizio) - new Date(a.dataInizio);
                        });
                        console.log(`🔓 Modalità Genitore: usando annata ${sorted[0].id}`);
                        return sorted[0].id;
                    }
                }
            } catch (error) {
                console.error('Errore recupero annata:', error);
            }
        }
        
        // Default a 2012 se non c'è annata
        return '2012';
    }

    // ==========================================
    // OVERRIDE GLOBALE loadData - CORRETTO
    // ==========================================
    window.loadData = async function(key) {
        try {
            const annataId = await getAnnataForRequest();
            console.log(`📥 loadData(${key}) per annata: ${annataId}`);

            const response = await fetch(`/api/data`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-annata-id': annataId
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`ℹ️ loadData(${key}): Nessun dato`);
                    return null;
                }
                console.error(`❌ loadData(${key}): HTTP ${response.status}`);
                return null;
            }

            // L'API ritorna direttamente { athletes: [...], evaluations: {...}, ... }
            const result = await response.json();
            
            // Ritorna il campo specifico richiesto
            if (key && result[key] !== undefined) {
                console.log(`✅ loadData(${key}): OK`);
                return result[key];
            }
            
            // Se non c'è key, ritorna tutto
            console.log(`✅ loadData: dati completi caricati`);
            return result;
            
        } catch (error) {
            console.error(`❌ loadData(${key}) errore:`, error);
            return null;
        }
    };

    // ==========================================
    // OVERRIDE GLOBALE saveData - CORRETTO
    // ==========================================
    window.saveData = async function(key, value) {
        try {
            const annataId = await getAnnataForRequest();
            console.log(`💾 saveData(${key}) per annata: ${annataId}`);

            const response = await fetch(`/api/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-annata-id': annataId
                },
                body: JSON.stringify({ key: key, data: value })
            });

            if (!response.ok) {
                console.error(`❌ saveData(${key}): HTTP ${response.status}`);
                return false;
            }

            const result = await response.json();
            if (result.success) {
                console.log(`✅ saveData(${key}): Salvato`);
                return true;
            }

            console.error(`❌ saveData(${key}): Fallito`);
            return false;
        } catch (error) {
            console.error(`❌ saveData(${key}) errore:`, error);
            return false;
        }
    };

    // Esponi funzioni globali
    window.getCurrentAnnata = getCurrentAnnata;
    window.isParentMode = isParentMode;

    console.log('✅ Data Adapter Multi-Annata: attivo');
    
    const currentAnnata = getCurrentAnnata();
    if (currentAnnata) {
        console.log(`   - Annata corrente: ${currentAnnata}`);
    } else {
        console.log('   - Default annata: 2012');
    }

})();
