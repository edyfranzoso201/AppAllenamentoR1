// api/force-migrate.js - Forza migrazione dati vecchi
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        // 1. Recupera l'annata esistente
        const annate = await kv.hgetall('annate');
        
        if (!annate || Object.keys(annate).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nessuna annata trovata. Esegui prima /api/init'
            });
        }
        
        // Prendi la prima annata (dovrebbe essere "2012")
        const annataId = Object.keys(annate)[0];
        const annata = annate[annataId];
        
        console.log('📋 Migrazione per annata:', annataId, '-', annata.nome);
        
        // 2. Lista dei tipi di dati da migrare
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
        
        const migratedData = [];
        const errors = [];
        
        // 3. Migra ogni tipo di dato
        for (const dataType of dataTypes) {
            try {
                console.log(`\n🔍 Controllo ${dataType}...`);
                
                // Controlla se i dati vecchi esistono
                const oldData = await kv.get(dataType);
                
                if (!oldData) {
                    console.log(`⚠️ ${dataType} - nessun dato trovato`);
                    continue;
                }
                
                // Controlla se già migrato
                const newKey = `data:${annataId}:${dataType}`;
                const existingData = await kv.get(newKey);
                
                if (existingData) {
                    console.log(`ℹ️ ${dataType} - già migrato (${existingData.length || 0} elementi)`);
                    migratedData.push({
                        type: dataType,
                        status: 'already_migrated',
                        count: existingData.length || Object.keys(existingData).length || 0
                    });
                    continue;
                }
                
                // Migra i dati
                await kv.set(newKey, oldData);
                
                const count = Array.isArray(oldData) 
                    ? oldData.length 
                    : (typeof oldData === 'object' ? Object.keys(oldData).length : 1);
                
                console.log(`✅ ${dataType} - migrato (${count} elementi)`);
                
                migratedData.push({
                    type: dataType,
                    status: 'migrated',
                    count: count
                });
                
            } catch (err) {
                console.error(`❌ ${dataType} - errore:`, err.message);
                errors.push({
                    type: dataType,
                    error: err.message
                });
            }
        }
        
        return res.status(200).json({
            success: true,
            message: '✅ Migrazione completata!',
            annata: {
                id: annataId,
                nome: annata.nome
            },
            migrated: migratedData,
            errors: errors.length > 0 ? errors : undefined,
            nextSteps: [
                '1. Ricarica la dashboard',
                '2. Verifica che i dati siano presenti',
                '3. Se OK, puoi eliminare i dati vecchi con /api/cleanup-old-data'
            ]
        });
        
    } catch (error) {
        console.error('❌ ERRORE migrazione:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
