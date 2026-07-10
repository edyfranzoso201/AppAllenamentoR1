# Test Reattività — Area Tecnica

**Data:** 2026-07-10 · **Stato:** approvato dall'utente (mockup validato: artifact `c1bc3968`)

## Obiettivo

Strumento per allenatori: schermo che mostra stimoli colorati (cerchio gigante su fondo nero) per esercizi di reattività sul campo — l'atleta scatta a toccare il cuneo/cinesino del colore mostrato. Nessun dato registrato: è solo un generatore di stimoli.

## Architettura

- **Pagina standalone** `public/reattivita.html` (HTML+CSS+JS inline, nessuna dipendenza esterna oltre al favicon). I file statici non contano nel limite 12 funzioni Vercel.
- **Lancio**: pulsante fisso "⚡ Test Reattività" nella toolbar di `area-tecnica.html` (non è una card contenuto).
- **Zero server**: nessun endpoint nuovo, nessun dato su Redis. Preset in `localStorage` (chiave `reattivita_presets`).
- **Soft-gate**: senza token sessione (sessionStorage → fallback `_p_` localStorage, come area-tecnica.js) redirect a `/`.

## Funzionalità

### Configurazione
- **Modalità**: 🎲 Automatica (random a intervallo) / 👆 Manuale (l'allenatore tocca il colore da una barra in basso)
- **Colori**: 8 campioni (rosso, blu, verde, giallo, arancione, viola, bianco, azzurro), selezione min 2, default rosso/blu/verde/giallo
- **Sequenza** (solo automatica): intervallo 0,5–30 s (default 4); pausa neutra nera 0–10 s (default 0); stesso colore consecutivo sì/no; fine per n° stimoli (default 10) o durata in minuti
- **Opzioni**: countdown 3-2-1 a schermo intero (default sì); beep Web Audio al cambio colore (default no)
- **Preset**: salva/carica/elimina con nome, per dispositivo

### Esecuzione
- Fullscreen API all'avvio (exit alla chiusura); **Wake Lock** con ri-acquisizione su `visibilitychange`
- Cerchio ~70vmin del colore attivo su fondo nero; contatore discreto (stimoli o secondi rimanenti) in alto a destra
- Countdown 3-2-1: numeri a tutto schermo (65vmin)
- Random: estrazione uniforme tra i colori selezionati; se no-ripetizioni, escluso il precedente
- Manuale: barra swatch in basso, tocco → cerchio cambia subito; contatore stimoli
- Stop: tocco sullo schermo (fuori dalla barra manuale) o ESC → schermata fine con "↻ Ripeti" / "⚙ Configura"

## Rischi/note
- iOS Safari: Fullscreen API limitata su iPhone (funziona su iPad); il tool resta usabile anche senza fullscreen.
- Wake Lock richiede HTTPS (ok su Vercel) e non è supportato ovunque: fallback silenzioso.
- Il beep richiede un gesto utente per sbloccare l'AudioContext: l'avvio del test lo è già.
