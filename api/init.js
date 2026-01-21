// api/init.js - Inizializzazione database GO SPORT
import { createClient } from '@vercel/kv';

// Configura KV client con variabili Upstash esistenti
const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        console.log('🚀 Inizio inizializzazione database...');
        
        // ==========================================
        // STEP 1: Crea utente ADMIN
        // ==========================================
        const adminPassword = Buffer.from('admin201').toString('base64');
        const adminUser = {
            username: 'admin',
            password: adminPassword,
            role: 'admin',
            annate: [],
            createdAt: new Date().toISOString()
        };
        
        await kv.hset('users', { admin: adminUser });
        console.log('✅ STEP 1: Admin creato');
        
        // ==========================================
        // STEP 2: Crea annata "2012"
        // ==========================================
        const annataId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const annata2012 = {
            id: annataId,
            nome: '2012',
            descrizione: 'Squadra 2012 - Stagione 2025/2026',
            createdAt: new Date().toISOString()
        };
        
        await kv.hset('annate', { [annataId]: annata2012 });
        console.log('✅ STEP 2: Annata "2012" creata con ID:', annataId);
        
        // ==========================================
        // STEP 3: Assegna annata all'admin
        // ==========================================
        adminUser.annate = [annataId];
        await kv.hset('users', { admin: adminUser });
        console.log('✅ STEP 3: Annata assegnata ad admin');
        
        // ==========================================
        // STEP 4: Migra dati esistenti (se presenti)
        // ==========================================
        const dataTypes = [
            'athletes',
            'evaluations',
            'gpsData',
            'awards',
            'trainingSessions',
            'formationData',
            'matchResults',
            'calendarEvents',
            'calendarResponses'
        ];
        
        let migratedCount = 0;
        const migratedDetails = [];
        
        for (const dataType of dataTypes) {
            try {
                const oldData = await kv.get(dataType);
                if (oldData) {
                    await kv.set(`data:${annataId}:${dataType}`, oldData);
                    console.log(`✅ Migrato: ${dataType}`);
                    migratedCount++;
                    
                    // Conta elementi
                    let count = 0;
                    if (Array.isArray(oldData)) {
                        count = oldData.length;
                    } else if (typeof oldData === 'object') {
                        count = Object.keys(oldData).length;
                    }
                    
                    migratedDetails.push({
                        type: dataType,
                        count: count
                    });
                } else {
                    console.log(`⚠️ ${dataType} - nessun dato trovato`);
                }
            } catch (err) {
                console.log(`⚠️ ${dataType} - errore:`, err.message);
            }
        }
        
        console.log(`✅ STEP 4: Migrazione completata - ${migratedCount}/${dataTypes.length} set di dati`);
        
        // ==========================================
        // STEP 5: Verifica finale
        // ==========================================
        const verifyUser = await kv.hget('users', 'admin');
        const verifyAnnate = await kv.hgetall('annate');
        
        console.log('✅ STEP 5: Verifica completata');
        console.log('   - Utenti nel DB:', verifyUser ? 1 : 0);
        console.log('   - Annate nel DB:', verifyAnnate ? Object.keys(verifyAnnate).length : 0);
        
        // ==========================================
        // RISPOSTA
        // ==========================================
        return res.status(200).json({
            success: true,
            message: '🎉 Database inizializzato con successo!',
            timestamp: new Date().toISOString(),
            admin: {
                username: 'admin',
                password: 'admin201',
                note: 'CAMBIA LA PASSWORD DOPO IL PRIMO LOGIN!'
            },
            annata: {
                id: annataId,
                nome: '2012',
                descrizione: 'Squadra 2012 - Stagione 2025/2026'
            },
            migration: {
                total: dataTypes.length,
                migrated: migratedCount,
                details: migratedDetails
            },
            verification: {
                usersInDB: verifyUser ? 1 : 0,
                annateInDB: verifyAnnate ? Object.keys(verifyAnnate).length : 0
            },
            nextSteps: [
                '1. Vai su https://app-allenamento-r1.vercel.app',
                '2. Fai login con: admin / admin201',
                '3. Seleziona l\'annata "2012"',
                '4. Cambia la password admin dal pannello',
                '5. Crea nuove annate e utenti'
            ]
        });
        
    } catch (error) {
        console.error('❌ ERRORE durante inizializzazione:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Errore durante l\'inizializzazione del database',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    }
}
