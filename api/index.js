const express = require('express');
const { kv } = require('@vercel/kv');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(express.json({ limit: '10mb' }));

// Serve i file statici dalla cartella 'public'
app.use(express.static(path.join(__dirname, '../public')));

// Endpoint per LEGGERE i dati dal database Vercel KV
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

// Endpoint per SALVARE i dati nel database Vercel KV
app.post('/api/data', async (req, res) => {
  try {
    await kv.set('database', req.body);
    res.status(200).json({ success: true, message: 'Dati salvati correttamente.' });
  } catch (error) {
    console.error('Errore scrittura su Vercel KV:', error);
    res.status(500).json({ error: 'Impossibile salvare i dati.' });
  }
});

// Gestisce tutte le altre rotte, servendo l'app principale
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Esporta l'app per Vercel
module.exports = app;