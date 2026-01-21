// api/cleanup.js - Pulizia annate duplicate
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        // Recupera tutte le annate
        const allAnnate = await kv.hgetall('annate');
        
        if (!allAnnate) {
            return res.status(200).json({
                success: true,
                message: 'Nessuna annata da pulire'
            });
        }

        // Trova duplicati per nome
        const annateByName = {};
        const toDelete = [];
        
        for (const [id, annata] of Object.entries(allAnnate)) {
            if (!annateByName[annata.nome]) {
                // Prima annata con questo nome - tienila
                annateByName[annata.nome] = { id, annata };
            } else {
                // Duplicato - segnala per cancellazione
                toDelete.push({ id, nome: annata.nome });
            }
        }

        // Elimina duplicati
        for (const dup of toDelete) {
            await kv.hdel('annate', dup.id);
        }

        return res.status(200).json({
            success: true,
            message: toDelete.length > 0 ? `✅ Rimossi ${toDelete.length} duplicati` : 'Nessun duplicato trovato',
            removed: toDelete,
            remaining: Object.values(annateByName).map(a => ({ id: a.id, nome: a.annata.nome }))
        });

    } catch (error) {
        console.error('❌ Errore cleanup:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
