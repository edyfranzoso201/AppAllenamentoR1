// data-adapter-multi-annata.js - Adapter per gestione dati multi-annata
(function() {
    'use strict';

    console.log('📄 Data Adapter Multi-Annata: caricamento...');

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    function getCurrentAnnata() {
        return sessionStorage.getItem('gosport_current_annata');
    }

    function isAuthenticated() {
        return sessionStorage.getItem('gosport_auth_session') === 'true';
    }

    // Verifica se siamo in modalità genitore (link pubblico)
    function isParentMode() {
        const search = window.location.search;
        const path = window.location.pathname;
        
        // Se c'è athleteId, siamo in modalità genitore
        if (search.includes('athleteId=')) {
            return true;
        }
        
        // Se siamo in una pagina presenza
        if (path.includes('/presenza/')) {
            return true;
        }
        
        return false;
    }

    // Ottiene l'annata corrente o quella di default per genitori
    async function getAnnataForRequest() {
        // Se autenticato, usa l'annata dalla sessione
        if (isAuthenticated()) {
            const annataId = getCurrentAnnata();
            if (annataId) {
                return annataId;
            }
        }
        
        // Se in modalità genitore, usa l'annata di default (la più recente)
        if (isParentMode()) {
            try {
                const response = await fetch('/api/annate/list');
                if (response.ok) {
                    const data = await response.json();
                    const annate = data.annate || [];
                    
                    if (annate.length > 0) {
                        // Ordina per data e prendi la più recente
                        const sorted = annate.sort((a, b) => {
                            return new Date(b.dataInizio) - new Date(a.dataInizio);
                        });
                        
                        console.log(`🔓 Modalità Genitore: usando annata ${sorted[0].id}`);
                        return sorted[0].id;
                    }
                }
            } catch (error) {
                console.error('Errore nel recupero annata per genitore:', error);
            }
        }
        
        return null;
    }

    // ==========================================
    // OVERRIDE GLOBALE loadData
    // ==========================================

    window.loadData = async function(key) {
        try {
            const annataId = await getAnnataForRequest();
            
            if (!annataId) {
                console.warn(`⚠️ loadData(${key}): Nessuna annata disponibile`);
                return null;
            }
            
            console.log(`📥 loadData(${key}) per annata: ${annataId}`);

            // Chiamata API - USANDO HEADER x-annata-id
            const response = await fetch(`/api/data`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-annata-id': annataId
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`ℹ️ loadData(${key}): Nessun dato trovato`);
                    return null;
                }
                console.error(`❌ loadData(${key}): HTTP ${response.status}`);
                return null;
            }

            const result = await response.json();
            if (result.success) {
                const count = result.data ? (Array.isArray(result.data) ? result.data.length : 'OK') : 0;
                console.log(`✅ loadData(${key}): ${count} elementi`);
                return result.data;
            }
            return null;
        } catch (error) {
            console.error(`❌ loadData(${key}) errore:`, error);
            return null;
        }
    };

    // ==========================================
    // OVERRIDE GLOBALE saveData
    // ==========================================

    window.saveData = async function(key, value) {
        try {
            const annataId = await getAnnataForRequest();
            
            if (!annataId) {
                console.warn(`⚠️ saveData(${key}): Nessuna annata disponibile`);
                return false;
            }
            
            console.log(`💾 saveData(${key}) per annata: ${annataId}`);

            // Chiamata API - USANDO HEADER x-annata-id
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
                console.log(`✅ saveData(${key}): Salvato con successo`);
                return true;
            }

            console.error(`❌ saveData(${key}): API ritornò success=false`);
            return false;
        } catch (error) {
            console.error(`❌ saveData(${key}) errore:`, error);
            return false;
        }
    };

    // ==========================================
    // ESPONI FUNZIONI GLOBALI
    // ==========================================

    window.getCurrentAnnata = getCurrentAnnata;
    window.isParentMode = isParentMode;

    console.log('✅ Data Adapter Multi-Annata: attivo');
    
    if (isParentMode()) {
        console.log('   - 🔓 Modalità Genitore (accesso pubblico)');
    } else {
        const currentAnnata = getCurrentAnnata();
        if (currentAnnata) {
            console.log(`   - Annata corrente: ${currentAnnata}`);
        } else {
            console.log('   - Nessuna annata selezionata ancora');
        }
    }

})();
