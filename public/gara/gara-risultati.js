// Dati di Andamento Gara <-> partita di Risultati.
// Funzioni pure, nessun accesso al DOM ne' alla rete: le usano la gara
// (public/gara/index.html) e l'app principale (public/risultati-gara.js,
// public/script.js), e si testano da sole (scripts/test-gara-risultati.mjs).
// Sta sotto /gara/ perche' il service worker della gara (scope /gara/) la
// metta in cache: a bordo campo senza rete la gara deve funzionare uguale.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GaraRisultati = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  var isObj = function (x) { return !!x && typeof x === 'object' && !Array.isArray(x); };
  var clone = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };

  // ── Minuti ─────────────────────────────────────────────────────
  function etichettaIntervallo(k, numTempi) {
    return Number(numTempi) > 2 ? 'Int. ' + k : 'Int.';
  }

  // Minuto scritto a mano ("23", "45+2", "int", "int 3"). null se non si
  // capisce. Il periodo si deduce dal minuto. o = { durata, numTempi,
  // durataSuppl, intervalloDefault }: intervalloDefault e' l'intervallo da
  // usare per "int" senza numero (la gara passa quello in corso).
  function leggiMinutoTesto(testo, o) {
    o = o || {};
    var t = String(testo || '').trim();
    var dur = Number(o.durata) || 45;
    var N = Math.max(1, Number(o.numTempi) || 2);
    var mi = t.match(/^int\.?\s*(\d)?/i);
    if (mi) {
      var k = mi[1] ? parseInt(mi[1], 10) : (Number(o.intervalloDefault) || 1);
      if (k < 1 || k >= N) return null;   // con un tempo solo non c'e' intervallo
      return { minuto: etichettaIntervallo(k, N), min: k * dur, periodo: k + 1, intervallo: true };
    }
    var m = t.replace(/'+$/, '').match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?$/);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    var ds = Number(o.durataSuppl) || 15;
    var periodo = n <= N * dur ? Math.max(1, Math.ceil(n / dur))
                : n <= N * dur + ds ? N + 1 : N + 2;
    return { minuto: n + (m[2] ? '+' + parseInt(m[2], 10) : '') + "'", min: n,
             periodo: periodo, intervallo: false };
  }

  // Secondo dell'evento dentro il suo tempo. Senza sec (minuto scritto a mano
  // o evento vecchio) si ricava dal minuto: "23'" del 1o = inizio del 23o
  // minuto, "45+2'" = 46 minuti e rotti. All'intervallo = 0 del tempo dopo.
  function secondoEvento(ev, durata) {
    if (ev.intervallo) return 0;
    if (ev.sec != null && ev.sec !== '' && !isNaN(Number(ev.sec))) return Math.max(0, Number(ev.sec));
    var dur = Number(durata) || 45;
    var per = Number(ev.periodo) || 1;
    var extra = parseInt((String(ev.minuto || '').match(/\+(\d+)/) || [])[1], 10) || 0;
    var m = (Number(ev.min) || 0) - (per - 1) * dur + extra;
    return Math.max(0, (m - 1) * 60);
  }

  // Rigioca la cronologia: i titolari partono in campo al secondo 0 del 1o
  // tempo, ogni cambio chiude il tratto di chi esce e apre quello di chi
  // entra, l'espulsione chiude e basta. I tratti si sommano (rientri del
  // settore di base). opts = { titolari:[id], eventi:[formato gara: tipo,
  // playerId, playerInId, periodo, min, minuto, intervallo, sec], numTempi,
  // durata, durataTempo(p) -> secondi giocati nel tempo p }.
  // Restituisce { id: { tempi:[sec...], tot, ingressi } }.
  function calcolaMinutaggio(opts) {
    var N = Math.max(1, Number(opts.numTempi) || 1);
    var durata = Number(opts.durata) || 45;
    var durataTempo = opts.durataTempo || function () { return durata * 60; };
    var eventi = opts.eventi || [];
    var ris = {};
    var voce = function (id) {
      return ris[id] || (ris[id] = { tempi: new Array(N).fill(0), tot: 0, ingressi: 0 });
    };
    // Chiave d'ordine identica a ordinaEventi() della gara: minuto, recupero
    // ("45+3" dopo "45+1"), poi posizione nell'elenco. NON si ordina per
    // secondo: un cambio scritto a mano "23'" (senza sec, quindi 22:00) dopo
    // un cambio dal vivo a 22:30 andrebbe prima di lui, e chi esce col
    // secondo cambio non sarebbe ancora entrato -> 12 in campo. Un evento
    // senza minuto leggibile eredita la chiave di quello prima, come in gara.
    var prec = [0, 0];
    var chiavi = eventi.map(function (ev) {
      if (!ev) return prec;
      var min = Number(ev.min);
      var extra = 0;
      var lbl = String(ev.minuto || '').match(/(\d+)(?:\+(\d+))?/);
      if (isNaN(min) && lbl) min = parseInt(lbl[1], 10);
      if (lbl && lbl[2]) extra = parseInt(lbl[2], 10);
      prec = isNaN(min) ? prec : [min, extra];
      return prec;
    });
    var entrato = new Map();   // id -> secondo d'ingresso nel tempo corrente
    (opts.titolari || []).forEach(function (id) {
      id = String(id); entrato.set(id, 0); voce(id).ingressi = 1;
    });
    for (var p = 1; p <= N; p++) {
      var D = Number(durataTempo(p)) || 0;
      // A inizio tempo chi e' in campo riparte da 0 (il tratto prima e' chiuso)
      entrato.forEach(function (_, id) { entrato.set(id, 0); });
      var chiudi = function (id, t, per) {
        if (!entrato.has(id)) return;
        voce(id).tempi[per - 1] += Math.max(0, t - entrato.get(id));
        entrato.delete(id);
      };
      // Ordine della cronologia della gara; secondoEvento serve solo per
      // sapere QUANDO, non in che ordine. A parita' decide l'indice originale.
      var delTempo = eventi
        .map(function (ev, i) { return { ev: ev, k: chiavi[i], i: i }; })
        .filter(function (x) {
          var ev = x.ev;
          return ev && (Number(ev.periodo) || 1) === p && (ev.tipo === 'cambio' || ev.tipo === 'espulsione');
        })
        .map(function (x) { x.t = Math.min(secondoEvento(x.ev, durata), D); return x; })
        .sort(function (a, b) { return (a.k[0] - b.k[0]) || (a.k[1] - b.k[1]) || (a.i - b.i); });
      for (var j = 0; j < delTempo.length; j++) {
        var ev = delTempo[j].ev, t = delTempo[j].t;
        if (ev.playerId) chiudi(String(ev.playerId), t, p);
        if (ev.tipo === 'cambio' && ev.playerInId) {
          var idIn = String(ev.playerInId);
          if (!entrato.has(idIn)) { entrato.set(idIn, t); voce(idIn).ingressi++; }
        }
      }
      var pp = p, DD = D;
      entrato.forEach(function (t0, id) { voce(id).tempi[pp - 1] += Math.max(0, DD - t0); });
    }
    Object.keys(ris).forEach(function (id) {
      ris[id].tot = ris[id].tempi.reduce(function (a, b) { return a + b; }, 0);
    });
    return ris;
  }

  // Blocco `gara` salvato in Risultati -> eventi nel formato del minutaggio.
  // cambi ed espulsioni sono due liste separate: `ord` (posizione nella
  // cronologia della gara) rimette insieme l'ordine originale. Blocchi senza
  // `ord`: cambi poi espulsioni, come prima.
  function eventiDaBlocco(g) {
    var cambi = (g.cambi || []).map(function (c) {
      return Object.assign({ tipo: 'cambio', playerId: c.esce || '', playerInId: c.entra || '' }, c);
    });
    var esp = (g.espulsioni || []).map(function (e) {
      return Object.assign({ tipo: 'espulsione', playerId: e.athleteId || '' }, e);
    });
    var tutti = cambi.concat(esp).map(function (ev, i) { return { ev: ev, i: i }; });
    var conOrd = function (x) { return typeof x.ev.ord === 'number' && isFinite(x.ev.ord); };
    if (tutti.length && tutti.every(conOrd)) {
      tutti.sort(function (a, b) { return (a.ev.ord - b.ev.ord) || (a.i - b.i); });
    }
    return tutti.map(function (x) { return x.ev; });
  }

  // Minutaggio della vista Risultati: stessa regola della gara, con le durate
  // dei tempi salvate al momento del salvataggio (0 = tempo non giocato).
  function minutaggioPartita(g) {
    g = g || {};
    var tempi = g.tempi || {};
    var durata = Number(tempi.durata) || 45;
    var dt = tempi.durateTempi || {};
    return calcolaMinutaggio({
      titolari: g.titolari || [], eventi: eventiDaBlocco(g),
      numTempi: Number(tempi.numero) || 2, durata: durata,
      durataTempo: function (p) { return dt[p] != null ? Number(dt[p]) || 0 : durata * 60; }
    });
  }

  // ── Partite di Risultati ───────────────────────────────────────
  function oggiLocale() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function giorniDa(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000 : NaN;
  }
  function normNome(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  // [{ id: chiave in matchResults, match }], prima le partite piu' vicine a
  // oggi (la gara si gioca oggi o quasi). Senza data non si possono proporre.
  function elencoPartite(matchResults, oggi) {
    var g0 = giorniDa(oggi || oggiLocale());
    return Object.keys(matchResults || {})
      .map(function (k) { return { id: k, match: matchResults[k] }; })
      .filter(function (x) { return isObj(x.match) && !isNaN(giorniDa(x.match.date)); })
      .sort(function (a, b) {
        return Math.abs(giorniDa(a.match.date) - g0) - Math.abs(giorniDa(b.match.date) - g0) ||
               String(a.match.date).localeCompare(String(b.match.date));
      });
  }

  // Stesso formato di "Prendi dal calendario" in Convocazioni:
  // "dom 08/11 · 17:00 · 🏠 Avversario"
  function etichettaPartita(m) {
    m = m || {};
    var p = String(m.date || '').split('-');
    var dt = p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
    var data = dt && !isNaN(dt) ? GIORNI[dt.getDay()] + ' ' + p[2] + '/' + p[1] : '—';
    var ora = /^\d{1,2}:\d{2}/.test(String(m.time || '')) ? ' · ' + String(m.time).slice(0, 5) : '';
    var luogo = m.location === 'home' ? '🏠' : m.location === 'away' ? '✈️' : '⚽';
    return data + ora + ' · ' + luogo + ' ' + (m.opponentName || 'Avversario');
  }

  // Dove salvare la gara: la partita legata dalla tendina, altrimenti quella
  // con stessa data e stesso avversario. { id, match, modo:'legata'|'trovata'|null }
  function trovaPartita(matchResults, q) {
    matchResults = matchResults || {};
    q = q || {};
    if (q.matchId && isObj(matchResults[q.matchId])) {
      return { id: String(q.matchId), match: matchResults[q.matchId], modo: 'legata' };
    }
    var avv = normNome(q.avversario);
    if (q.data && avv) {
      var ks = Object.keys(matchResults);
      for (var i = 0; i < ks.length; i++) {
        var m = matchResults[ks[i]];
        if (isObj(m) && m.date === q.data && normNome(m.opponentName) === avv) {
          return { id: ks[i], match: m, modo: 'trovata' };
        }
      }
    }
    return { id: null, match: null, modo: null };
  }

  // ── Gara -> Risultati ──────────────────────────────────────────
  // I minuti di Risultati sono stringhe di cifre >= 1 (input number min=1):
  // un gol al minuto 0 o all'intervallo diventa il primo minuto valido.
  function minuteRisultati(ev) {
    var n = parseInt(ev.min, 10);
    return String(n >= 1 ? n : 1);
  }
  // ord = posizione nella cronologia della gara (gia' ordinata da
  // ordinaEventi): serve a eventiDaBlocco per riunire cambi ed espulsioni.
  function tempoEvento(ev, ord) {
    var o = { min: Math.max(0, parseInt(ev.min, 10) || 0), minuto: String(ev.minuto || ''), periodo: Number(ev.periodo) || 1 };
    if (ev.intervallo) o.intervallo = true;
    if (ev.sec != null && ev.sec !== '' && !isNaN(Number(ev.sec))) o.sec = Number(ev.sec);
    o.ord = ord;
    return o;
  }

  // s = { noiCasa, golNoi, golLoro, eventi, convocati:[id], titolari:[id],
  //       numTempi, durata, durateTempi:{p:sec}, adesso:ISO }
  function datiDaGara(s) {
    var ev = (s.eventi || []).filter(Boolean);
    var noi = Number(s.golNoi) || 0, loro = Number(s.golLoro) || 0;
    var titolari = (s.titolari || []).map(String);
    var dt = {};
    Object.keys(s.durateTempi || {}).forEach(function (k) { dt[k] = Number(s.durateTempi[k]) || 0; });
    return {
      homeScore: s.noiCasa ? noi : loro,
      awayScore: s.noiCasa ? loro : noi,
      scorers: ev.filter(function (e) { return e.tipo === 'gol' && e.playerId; })
        .map(function (e) { return { athleteId: String(e.playerId), minute: minuteRisultati(e) }; }),
      cards: ev.filter(function (e) { return (e.tipo === 'ammonizione' || e.tipo === 'espulsione') && e.playerId; })
        .map(function (e) {
          return { athleteId: String(e.playerId), type: e.tipo === 'ammonizione' ? 'yellow' : 'red', minute: minuteRisultati(e) };
        }),
      gara: {
        convocati: (s.convocati || []).map(String),
        titolari: titolari,
        cambi: ev.filter(function (e) { return e.tipo === 'cambio' && (e.playerId || e.playerInId); })
          .map(function (e) {
            return Object.assign({ esce: e.playerId ? String(e.playerId) : '', entra: e.playerInId ? String(e.playerInId) : '' }, tempoEvento(e, ev.indexOf(e)));
          }),
        espulsioni: ev.filter(function (e) { return e.tipo === 'espulsione' && e.playerId; })
          .map(function (e) { return Object.assign({ athleteId: String(e.playerId) }, tempoEvento(e, ev.indexOf(e))); }),
        tempi: { numero: Number(s.numTempi) || 2, durata: Number(s.durata) || 45, durateTempi: dt },
        salvataIl: s.adesso || new Date().toISOString(),
        incompleta: titolari.length === 0
      }
    };
  }

  // Righe "X in Risultati: ... · dalla gara: ..." solo per cio' che la
  // partita ha GIA' e che il salvataggio cambierebbe. [] = nessun conflitto.
  function differenze(match, dati, nomeDi) {
    match = match || {};
    nomeDi = nomeDi || function (id) { return String(id); };
    var righe = [];
    var vuoto = function (v) { return v === null || v === undefined || v === ''; };
    if (!vuoto(match.homeScore) || !vuoto(match.awayScore)) {
      var a = (vuoto(match.homeScore) ? '-' : match.homeScore) + '-' + (vuoto(match.awayScore) ? '-' : match.awayScore);
      var b = dati.homeScore + '-' + dati.awayScore;
      if (a !== b) righe.push('Punteggio in Risultati: ' + a + ' · dalla gara: ' + b);
    }
    var elenco = function (l, conTipo) {
      return (l || []).map(function (x) {
        return (conTipo ? (x.type === 'red' ? '🟥 ' : '🟨 ') : '') + nomeDi(x.athleteId) + ' ' + x.minute + "'";
      }).join(', ');
    };
    [['scorers', 'Marcatori', false], ['cards', 'Cartellini', true]].forEach(function (c) {
      var prima = elenco(match[c[0]], c[2]);
      var dopo = elenco(dati[c[0]], c[2]);
      if (prima && prima !== dopo) righe.push(c[1] + ' in Risultati: ' + prima + ' · dalla gara: ' + (dopo || 'nessuno'));
    });
    return righe;
  }

  // ── Patch dei Risultati (anti lost-update) ─────────────────────
  // { id: null } = partita eliminata; { id: { campo: valore | null } } =
  // campi cambiati (null = campo tolto). null se non e' cambiato niente.
  // Speculare a applyMatchPatch in api/_match-gara.js.
  function diffMatchResults(base, cur) {
    var b0 = isObj(base) ? base : {}, c0 = isObj(cur) ? cur : {};
    var patch = {}, n = 0;
    var ids = Object.keys(b0).concat(Object.keys(c0).filter(function (k) { return !(k in b0); }));
    ids.forEach(function (id) {
      var bm = b0[id], cm = c0[id];
      if (!isObj(cm)) {
        if (isObj(bm)) { patch[id] = null; n++; }
        return;
      }
      var bo = isObj(bm) ? bm : {};
      var campi = Object.keys(bo).concat(Object.keys(cm).filter(function (k) { return !(k in bo); }));
      campi.forEach(function (f) {
        if (JSON.stringify(bo[f]) === JSON.stringify(cm[f])) return;
        patch[id] = patch[id] || {};
        patch[id][f] = cm[f] === undefined ? null : clone(cm[f]);
        n++;
      });
    });
    return n ? patch : null;
  }

  // Chiavi che, scritte su un oggetto, toccano il prototipo invece di un
  // campo: una patch (dal JSON di un altro dispositivo) non deve poterle usare.
  // (confronto fra stringhe: in un letterale `{ '__proto__': 1 }` non crea
  // la chiave, imposta il prototipo, e la ricerca non funzionerebbe)
  var vietata = function (k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; };

  function applyMatchPatch(cur, patch) {
    Object.keys(patch || {}).forEach(function (id) {
      if (vietata(id)) return;
      var v = patch[id];
      if (v === null) { delete cur[id]; return; }
      if (!isObj(v)) return;
      // Una partita che qui non c'e' si crea solo se la patch e' una partita
      // intera (ha la data): altrimenti e' il resto di una partita eliminata
      // da un altro dispositivo, e resusciterla ne farebbe un rottame.
      if (!Object.prototype.hasOwnProperty.call(cur, id) || !isObj(cur[id])) {
        if (!v.date) return;
        cur[id] = {};
      }
      Object.keys(v).forEach(function (f) {
        if (vietata(f)) return;
        if (v[f] === null) delete cur[id][f];
        else cur[id][f] = clone(v[f]);
      });
    });
    return cur;
  }

  return {
    etichettaIntervallo: etichettaIntervallo,
    leggiMinutoTesto: leggiMinutoTesto,
    secondoEvento: secondoEvento,
    calcolaMinutaggio: calcolaMinutaggio,
    eventiDaBlocco: eventiDaBlocco,
    minutaggioPartita: minutaggioPartita,
    elencoPartite: elencoPartite,
    etichettaPartita: etichettaPartita,
    trovaPartita: trovaPartita,
    datiDaGara: datiDaGara,
    differenze: differenze,
    diffMatchResults: diffMatchResults,
    applyMatchPatch: applyMatchPatch
  };
});
