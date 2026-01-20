// api/test-login.js - File temporaneo per testare il login
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Test: crea admin se non esiste
    const adminPassword = Buffer.from('admin201').toString('base64');
    const adminUser = {
        username: 'admin',
        password: adminPassword,
        role: 'admin',
        annate: [],
        createdAt: new Date().toISOString()
    };
    
    try {
        // Crea admin
        await kv.hset('users', { admin: adminUser });
        
        // Crea annata 2012
        const annataId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const annata2012 = {
            id: annataId,
            nome: '2012',
            descrizione: 'Squadra 2012',
            createdAt: new Date().toISOString()
        };
        await kv.hset('annate', { [annataId]: annata2012 });
        
        // Assegna annata
        adminUser.annate = [annataId];
        await kv.hset('users', { admin: adminUser });
        
        return res.status(200).json({
            success: true,
            message: 'Sistema inizializzato!',
            credentials: {
                username: 'admin',
                password: 'admin201'
            },
            annataId
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
