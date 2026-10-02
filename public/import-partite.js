// Importa calendario partite (tab Risultati).
// Una partita per riga:  data ; ora ; casa|trasferta ; avversario ; luogo
//   es. 27/09/2026;17:00;casa;Trofarello;Corso M. L. King 8, Grugliasco
// Separatore ";" oppure tabulazione (incollando da Excel arriva il tab).
// Il parser e' puro (nessun accesso al DOM o ai dati) per poterlo testare da solo;
// l'unione con matchResults/calendarEvents sta in pianificaImportPartite.
(function (root) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Restituisce "YYYY-MM-DD" oppure null se la data non esiste davvero
  // (31/02 non deve diventare 3 marzo).
  function normalizzaData(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    var g, me, a;
    if (m) { g = +m[1]; me = +m[2]; a = +m[3]; }
    else {
      m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) return null;
      a = +m[1]; me = +m[2]; g = +m[3];
    }
    var d = new Date(a, me - 1, g);
    if (d.getFullYear() !== a || d.getMonth() !== me - 1 || d.getDate() !== g) return null;
    return a + '-' + pad2(me) + '-' + pad2(g);
  }

  function normalizzaOra(s) {
    var m = String(s || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return pad2(+m[1]) + ':' + m[2];
  }

  function normalizzaCampo(s) {
    var v = String(s || '').trim().toLowerCase();
    if (v === 'casa' || v === 'c' || v === 'home') return 'home';
    if (v === 'trasferta' || v === 't' || v === 'fuori' || v === 'away') return 'away';
    return null;
  }

  function parseCalendarioPartite(testo) {
    var partite = [], errori = [];
    String(testo || '').split(/\r?\n/).forEach(function (riga, i) {
      if (!riga.trim() || riga.trim().charAt(0) === '#') return;
      var c = riga.split(riga.indexOf('\t') > -1 ? '\t' : ';').map(function (x) { return x.trim(); });
      var n = i + 1;
      if (c.length < 4) { errori.push('Riga ' + n + ': servono almeno data;ora;casa/trasferta;avversario'); return; }
      var data = normalizzaData(c[0]);
      var ora = normalizzaOra(c[1]);
      var campo = normalizzaCampo(c[2]);
      var avv = c[3];
      if (!data) { errori.push('Riga ' + n + ': data non valida "' + c[0] + '" (usa 27/09/2026)'); return; }
      if (!ora) { errori.push('Riga ' + n + ': ora non valida "' + c[1] + '" (usa 17:00)'); return; }
      if (!campo) { errori.push('Riga ' + n + ': scrivi casa o trasferta, non "' + c[2] + '"'); return; }
      if (!avv) { errori.push('Riga ' + n + ': manca l\'avversario'); return; }
      partite.push({ date: data, time: ora, location: campo, opponentName: avv, venue: c.slice(4).join(', ').trim() });
    });
    return { partite: partite, errori: errori };
  }

  // Decide cosa scrivere senza toccare niente: le partite gia' presenti
  // (stessa data e stesso avversario) non vengono duplicate, e un evento del
  // Calendario Squadra gia' esistente in quella data non viene MAI sovrascritto.
  function pianificaImportPartite(partite, matchResults, calendarEvents) {
    matchResults = matchResults || {}; calendarEvents = calendarEvents || {};
    var esistenti = Object.keys(matchResults).map(function (k) { return matchResults[k]; });
    var nuovePartite = [], nuoviEventi = {}, giaPresenti = [], eventiOccupati = [];
    partite.forEach(function (p) {
      var avv = p.opponentName.toLowerCase();
      var doppia = esistenti.concat(nuovePartite).some(function (m) {
        return m && String(m.date || '').slice(0, 10) === p.date &&
               String(m.opponentName || '').trim().toLowerCase() === avv;
      });
      if (doppia) giaPresenti.push(p); else nuovePartite.push(p);

      var ev = calendarEvents[p.date] || nuoviEventi[p.date];
      if (!ev) {
        var e = { type: 'Partita', time: p.time, note: 'vs ' + p.opponentName + (p.location === 'home' ? ' (casa)' : ' (trasferta)') };
        if (p.venue) e.indirizzo = p.venue;
        nuoviEventi[p.date] = e;
      } else if (ev.type !== 'Partita') {
        eventiOccupati.push({ partita: p, evento: ev });
      }
    });
    return { nuovePartite: nuovePartite, nuoviEventi: nuoviEventi, giaPresenti: giaPresenti, eventiOccupati: eventiOccupati };
  }

  var api = { parseCalendarioPartite: parseCalendarioPartite, pianificaImportPartite: pianificaImportPartite, normalizzaData: normalizzaData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ImportPartite = api;
})(this);
