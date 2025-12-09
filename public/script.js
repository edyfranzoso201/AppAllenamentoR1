// ✅ MODIFICA: Funzione loadData aggiornata per funzionare su Vercel
const loadData = async () => {
    try {
        // ✅ Usa un URL assoluto per Vercel. Sostituisci 'https://tuo-progetto.vercel.app' con il tuo URL reale.
        const response = await fetch('https://tuo-progetto.vercel.app/api/data', {
            cache: 'no-store',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn(`Errore HTTP: ${response.status} - ${response.statusText}`);
            throw new Error(`Errore HTTP: ${response.status}`);
        }

        const allData = await response.json();
        athletes = allData.athletes || [];
        evaluations = allData.evaluations || {};
        gpsData = allData.gpsData || {};
        migrateGpsData();
        awards = allData.awards || {};
        trainingSessions = allData.trainingSessions || {};
        formationData = allData.formationData || { starters: [], bench: [], tokens: [] };
        matchResults = allData.matchResults || {};

        // ✅ Assicurati che tutti gli atleti abbiano `isViceCaptain` e `isGuest`
        athletes.forEach(athlete => {
            if (athlete.isViceCaptain === undefined) athlete.isViceCaptain = false;
            if (athlete.isGuest === undefined) athlete.isGuest = false;
            if (athlete.guestFromSeason === undefined) athlete.guestFromSeason = null;
        });

        // ✅ Inizializza assists per partite
        for (const matchId in matchResults) {
            if (!matchResults[matchId].assists) matchResults[matchId].assists = [];
        }

        console.log("✅ Dati caricati con successo:", {
            atleti: athletes.length,
            valutazioni: Object.keys(evaluations).length,
            partite: Object.keys(matchResults).length
        });

    } catch (error) {
        console.error('❌ Errore nel caricamento dei dati:', error);
        // ✅ Non resetta i dati se il server non risponde, ma mostra un messaggio
        alert("⚠️ Impossibile caricare i dati dal server. Verifica la connessione o contatta l'amministratore.");
        // Se vuoi che l'app continui a funzionare con dati vuoti, lascia i dati come sono.
        // Se vuoi forzare un reset, puoi rimettere qui:
        // athletes = []; evaluations = {}; gpsData = {}; awards = {}; trainingSessions = {}; formationData = { starters: [], bench: [], tokens: [] }; matchResults = {};
    }
};