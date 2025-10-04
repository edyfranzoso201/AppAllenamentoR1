const express = require('express');
const { kv } = require('@vercel/kv');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));

// API per LEGGERE i dati
app.get('/api/data', async (req, res) => {
  try {
    let data = await kv.get('database');

    // --- NUOVA LOGICA DI CARICAMENTO INIZIALE ---
    // Se il database è vuoto (o non ha atleti), prova a caricarlo dal file di backup
    if (!data || (data.athletes && data.athletes.length === 0)) {
      console.log("Database vuoto, tento il caricamento da backup.json...");
      const backupPath = path.join(__dirname, 'backup.json');
      
      if (fs.existsSync(backupPath)) {
        const backupDataRaw = fs.readFileSync(backupPath, 'utf8');
        data = JSON.parse(backupDataRaw);
        await kv.set('database', data); // Salva i dati del backup nel database online
        console.log("Dati caricati da backup.json e salvati nel database KV.");
      }
    }
    // --- FINE NUOVA LOGICA ---

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (error) {
    console.error('Errore in /api/data:', error);
    res.status(500).json({ error: 'Impossibile leggere i dati.' });
  }
});

// API per SALVARE i dati
app.post('/api/data', async (req, res) => {
  try {
    await kv.set('database', req.body);
    res.status(200).json({ success: true, message: 'Dati salvati correttamente.' });
  } catch (error) {
    console.error('Errore scrittura su Vercel KV:', error);
    res.status(500).json({ error: 'Impossibile salvare i dati.' });
  }
});

module.exports = app;