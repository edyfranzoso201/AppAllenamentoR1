// data-adapter-multi-annata.js - Adapter per gestione dati multi-annata
(function() {
    'use strict';

    console.log('🔄 Data Adapter Multi-Annata: caricamento...');

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    function getCurrentAnnata() {
        return sessionStorage.getItem('gosport_current_annata');
    }

    function isAuthenticated() {
        return sessionStorage.getItem('gosport_auth_session') === 'true';
    }

    // ==========================================
    // OVERRIDE GLOBALE loadData
    // ==========================================

    window.loadData = async function(key) {
        try {
            const annataId = getCurrentAnnata();
            
            if (!annataId) {
                console.warn(`⚠️ loadData(${key}): Nessuna annata selezionata`);
                return null;
            }

            console.log(`📥 loadData(${key}) per annata: ${annataId}`);

            // Chiamata API - USANDO QUERY STRING come nel backend
            const response = await fetch(`/api/data?key=${encodeURIComponent(key)}&annataId=${encodeURIComponent(annataId)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
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
            const annataId = getCurrentAnnata();
            
            if (!annataId) {
                console.warn(`⚠️ saveData(${key}): Nessuna annata selezionata`);
                return false;
            }

            console.log(`💾 saveData(${key}) per annata: ${annataId}`);

            // Chiamata API - USANDO BODY come nel backend
            const response = await fetch(`/api/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    key: key,
                    data: value,
                    annataId: annataId
                })
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

    console.log('✅ Data Adapter Multi-Annata: attivo');
    const currentAnnata = getCurrentAnnata();
    if (currentAnnata) {
        console.log(`   - Annata corrente: ${currentAnnata}`);
    } else {
        console.log('   - Nessuna annata selezionata ancora');
    }

})();
