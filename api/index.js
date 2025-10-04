const express = require('express');
const { kv } = require('@vercel/kv');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));

// API per LEGGERE i dati
app.get('/api/data', async (req, res) => {
  try {
    let data = await kv.get('database');
    if (!data) {
      // Se il database è vuoto, inizializzalo
      data = { athletes: [], evaluations: {}, gpsData: {}, awards: {}, trainingSessions: {}, formationData: {} };
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (error) {
    console.error('Errore lettura da Vercel KV:', error);
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

// Esporta l'app per Vercel
module.exports = app;