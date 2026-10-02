// "Prendi dal calendario" nella Nuova Convocazione.
// Raccoglie i prossimi impegni di gara (partite di Risultati + Partita/Torneo/
// Campionato del Calendario Squadra) per precompilare il modulo.
// Funzioni pure, nessun accesso al DOM: si testano da sole.
(function (root) {
  'use strict';

  var TIPI_GARA = { Partita: 1, Torneo: 1, Campionato: 1 };

  function pad2(n) { return String(n).padStart(2, '0'); }

  // "17:00" o "18:00-19:30" -> "17:00" / "18:00"; altrimenti ''.
  function primaOra(s) {
    var m = String(s || '').match(/(\d{1,2})[:.](\d{2})/);
    if (!m || +m[1] > 23 || +m[2] > 59) return '';
    return pad2(+m[1]) + ':' + m[2];
  }

  // Ritrovo di default: 60' prima in casa, 75' prima in trasferta.
  // Campo sconosciuto (es. torneo) -> '' : meglio vuoto che inventato.
  function ritrovoDefault(ora, campo) {
    ora = primaOra(ora);
    var anticipo = campo === 'home' ? 60 : campo === 'away' ? 75 : 0;
    if (!ora || !anticipo) return '';
    var min = +ora.slice(0, 2) * 60 + +ora.slice(3) - anticipo;
    if (min < 0) return ''; // gara prima dell'1:15: non si torna al giorno prima
    return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60);
  }

  // Nota dell'import: "vs Trofarello (casa)" -> avversario + campo.
  function leggiNota(note) {
    var n = String(note || '').trim();
    var m = n.match(/^vs\.?\s+(.+?)\s*(?:\((casa|trasferta)\))?$/i);
    if (!m) return { avversario: n, campo: null };
    var c = m[2] ? (m[2].toLowerCase() === 'casa' ? 'home' : 'away') : null;
    return { avversario: m[1], campo: c };
  }

  function prossimiImpegni(matchResults, calendarEvents, convocazioni, oggi) {
    var lista = [];
    var perData = {};
    Object.keys(matchResults || {}).forEach(function (k) {
      var m = matchResults[k] || {};
      var data = String(m.date || '').slice(0, 10);
      if (!data || data < oggi) return;
      var campo = m.location === 'home' || m.location === 'away' ? m.location : null;
      var imp = { data: data, inizio: primaOra(m.time), avversario: String(m.opponentName || '').trim(),
        luogo: String(m.venue || '').trim(), campo: campo, tipo: 'CONVOCAZIONE PARTITA', ritrovo: '' };
      lista.push(imp);
      (perData[data] = perData[data] || []).push(imp);
    });
    Object.keys(calendarEvents || {}).forEach(function (data) {
      if (data < oggi) return;
      var evs = calendarEvents[data];
      (Array.isArray(evs) ? evs : [evs]).forEach(function (e) {
        if (!e || !TIPI_GARA[e.type]) return;
        var nota = leggiNota(e.note);
        var gia = perData[data] || [];
        // Stessa gara gia' presa da Risultati (le partite importate stanno in
        // entrambi): la si arricchisce col ritrovo/indirizzo e non la si ripete.
        var doppia = e.type !== 'Torneo' && gia.length
          ? (gia.filter(function (x) { return x.avversario.toLowerCase() === nota.avversario.toLowerCase(); })[0]
             || (gia.length === 1 ? gia[0] : null))
          : null;
        if (doppia) {
          if (e.ritrovo) doppia.ritrovo = primaOra(e.ritrovo);
          if (!doppia.luogo && e.indirizzo) doppia.luogo = String(e.indirizzo).trim();
          if (!doppia.inizio) doppia.inizio = primaOra(e.time);
          return;
        }
        lista.push({ data: data, inizio: primaOra(e.time),
          avversario: nota.avversario || (e.type === 'Torneo' ? 'Torneo' : ''),
          luogo: String(e.indirizzo || '').trim(), campo: nota.campo,
          tipo: e.type === 'Torneo' ? 'CONVOCAZIONE TORNEO' : 'CONVOCAZIONE PARTITA',
          ritrovo: primaOra(e.ritrovo) });
      });
    });
    // Le date che hanno gia' una convocazione non si propongono.
    var convocate = {};
    (convocazioni || []).forEach(function (c) { if (c && c.data) convocate[String(c.data).slice(0, 10)] = 1; });
    return lista
      .filter(function (x) { return !convocate[x.data]; })
      .map(function (x) {
        if (!x.ritrovo) x.ritrovo = ritrovoDefault(x.inizio, x.campo);
        return x;
      })
      .sort(function (a, b) { return (a.data + a.inizio).localeCompare(b.data + b.inizio); });
  }

  var GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  function etichetta(x) {
    var d = new Date(x.data + 'T12:00:00');
    var icona = x.tipo === 'CONVOCAZIONE TORNEO' ? '🏆' : x.campo === 'away' ? '✈️' : '⚽';
    return GIORNI[d.getDay()] + ' ' + x.data.slice(8, 10) + '/' + x.data.slice(5, 7)
      + (x.inizio ? ' · ' + x.inizio : '') + ' · ' + icona + ' ' + (x.avversario || '—');
  }

  var api = { prossimiImpegni: prossimiImpegni, ritrovoDefault: ritrovoDefault,
    leggiNota: leggiNota, primaOra: primaOra, etichetta: etichetta };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ImpegniConvocazione = api;
})(typeof window !== 'undefined' ? window : this);
