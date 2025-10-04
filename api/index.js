const express = require('express');
const { kv } = require('@vercel/kv');
require('dotenv').config();
const backupData = require('./backup.json'); // Importa i dati direttamente

const app = express();
app.use(express.json({ limit: '10mb' }));

// API per LEGGERE i dati
app.get('/api/data', async (req, res) => {
  try {
    let data = await kv.get('database');

    // --- NUOVA LOGICA DI CARICAMENTO SEMPLIFICATA ---
    // Se il database è vuoto (o non ha atleti), lo popola con i dati del backup
    if (!data || !data.athletes || data.athletes.length === 0) {
      console.log("Database vuoto o senza atleti, carico i dati dal backup incorporato.");
      data = backupData; // Usa i dati importati direttamente dal file
      await kv.set('database', data);
      console.log("Dati del backup salvati nel database KV.");
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