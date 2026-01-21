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

            // Chiamata API con namespace corretto
            const response = await fetch(`/api/data/${key}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Annata-ID': annataId
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`ℹ️ loadData(${key}): Nessun dato trovato`);
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ loadData(${key}): ${result.data ? (Array.isArray(result.data) ? result.data.length : 'OK') : 0} elementi`);
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

            // Chiamata API
            const response = await fetch(`/api/data/${key}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Annata-ID': annataId
                },
                body: JSON.stringify({ data: value })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                console.log(`✅ saveData(${key}): Salvato con successo`);
                return true;
            }

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
    console.log(`   - Annata corrente: ${getCurrentAnnata() || 'non selezionata'}`);

})();
