// api/check-old-data.js - Verifica presenza dati vecchi
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
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
        
        const results = {};
        
        for (const dataType of dataTypes) {
            try {
                const data = await kv.get(dataType);
                
                if (data) {
                    let count = 0;
                    if (Array.isArray(data)) {
                        count = data.length;
                    } else if (typeof data === 'object') {
                        count = Object.keys(data).length;
                    }
                    
                    results[dataType] = {
                        exists: true,
                        count: count,
                        sample: Array.isArray(data) ? data.slice(0, 2) : null
                    };
                } else {
                    results[dataType] = {
                        exists: false,
                        count: 0
                    };
                }
            } catch (err) {
                results[dataType] = {
                    error: err.message
                };
            }
        }
        
        return res.status(200).json({
            success: true,
            oldData: results,
            message: 'Controlla quali dati vecchi esistono ancora'
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
