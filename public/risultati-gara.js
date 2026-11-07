// Pannello "Modifica Risultato Partita": dati di Andamento Gara.
// Formazione e sostituzioni si correggono qui; il minutaggio NON si salva
// mai: si ricalcola sempre con la stessa funzione della gara
// (/gara/gara-risultati.js), cosi' le due viste non divergono.
//
// API (window.RisultatiGara):
//   apri(match|null)  all'apertura del pannello: azzera lo stato e rilegge
//                     la partita (mai tenere riferimenti fra un salvataggio
//                     e l'altro: saveData sostituisce matchResults con copie).
//   leggi()           al salvataggio:
//                     undefined = niente toccato -> il blocco gara resta com'era
//                     null      = blocco gara da togliere
//                     oggetto   = blocco gara nuovo, intero
(function () {
  'use strict';
  function GR() { return window.GaraRisultati; }

  var stato = null;         // copia di lavoro del blocco gara (null = partita senza gara)
  var matchAperta = null;   // partita come salvata: gol e cartellini della cronologia
  var aperto = false;       // apri() chiamata per questo pannello
  var toccato = false;      // l'utente ha cambiato qualcosa nelle sezioni gara
  var sezAperte = { formazione: true, cambi: true, minutaggio: true, cronologia: false };

  var esc = typeof window.escapeHtml === 'function' ? window.escapeHtml : function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function atleti() { return Array.isArray(window.athletes) ? window.athletes : []; }
  function atleta(id) {
    var s = String(id);
    return atleti().find(function (x) { return String(x.id) === s; }) || null;
  }
  // Storico: un atleta archiviato o tolto dalla rosa si mostra comunque
  // (mai filtrarlo: e' una partita gia' giocata). Mai un id nudo o vuoto.
  function nomeDi(id) {
    if (id == null || id === '') return '—';
    var a = atleta(id);
    return a ? (a.name || 'Atleta senza nome') : 'Atleta non più in rosa';
  }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function vuoto() {
    return { convocati: [], titolari: [], cambi: [], espulsioni: [],
             tempi: { numero: 2, durata: 45, durateTempi: {} },
             salvataIl: new Date().toISOString(), incompleta: false };
  }
  function opzMinuto() {
    return { durata: stato.tempi.durata, numTempi: stato.tempi.numero };
  }
  function recupero(ev) {
    return parseInt((String(ev.minuto || '').match(/\+(\d+)/) || [])[1], 10) || 0;
  }

  // Ordine della cronologia: periodo, minuto, recupero; a parita' il cambio
  // all'intervallo viene prima e poi conta l'ordine che c'era (ord della
  // gara). cambi ed espulsioni sono due liste: eventiDaBlocco le riunisce
  // con `ord` solo se TUTTI gli eventi ce l'hanno, quindi dopo ogni modifica
  // si rinumerano tutti (interi >= 0, come vuole il server).
  function riordina() {
    var tutti = [];
    stato.cambi.forEach(function (c, i) { tutti.push({ ev: c, cambio: true, i: i }); });
    stato.espulsioni.forEach(function (e, i) { tutti.push({ ev: e, cambio: false, i: stato.cambi.length + i }); });
    var ordPrima = function (x) { return typeof x.ev.ord === 'number' && isFinite(x.ev.ord) ? x.ev.ord : Infinity; };
    tutti.sort(function (a, b) {
      return ((Number(a.ev.periodo) || 1) - (Number(b.ev.periodo) || 1)) ||
        ((Number(a.ev.min) || 0) - (Number(b.ev.min) || 0)) ||
        (recupero(a.ev) - recupero(b.ev)) ||
        ((a.ev.intervallo ? 0 : 1) - (b.ev.intervallo ? 0 : 1)) ||
        (ordPrima(a) - ordPrima(b)) || (a.i - b.i);
    });
    tutti.forEach(function (x, k) { x.ev.ord = k; });
    stato.cambi = tutti.filter(function (x) { return x.cambio; }).map(function (x) { return x.ev; });
    stato.espulsioni = tutti.filter(function (x) { return !x.cambio; }).map(function (x) { return x.ev; });
  }

  // Tempi o durata cambiati a mano: periodo e minuto assoluto degli eventi
  // si rileggono dall'etichetta (23', 45+2', Int.) con le regole nuove.
  function rileggiMinuti() {
    stato.cambi.concat(stato.espulsioni).forEach(function (ev) {
      var mi = GR().leggiMinutoTesto(ev.minuto || String(ev.min), opzMinuto());
      if (!mi) return;
      delete ev.intervallo;
      Object.assign(ev, mi);
      if (!mi.intervallo) delete ev.intervallo;
    });
    riordina();
  }

  function box() {
    var b = document.getElementById('gara-risultati-box');
    if (b) return b;
    var cards = document.getElementById('cards-container');
    if (!cards) return null;
    // Sotto la riga Marcatori / Assist / Cartellini, dentro il form
    var riga = cards.closest('.row') || cards.parentNode;
    b = document.createElement('div');
    b.id = 'gara-risultati-box';
    b.className = 'mt-3 rg-box';
    riga.parentNode.insertBefore(b, riga.nextSibling);
    b.addEventListener('click', onClick);
    b.addEventListener('change', onChange);
    // Invio in un campo del box non deve inviare il form "Salva Partita"
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); }
    });
    // toggle non risale: si ascolta in cattura per ricordare le sezioni
    // aperte/chiuse fra un render e l'altro
    b.addEventListener('toggle', function (e) {
      var s = e.target && e.target.dataset && e.target.dataset.sez;
      if (s) sezAperte[s] = e.target.open;
    }, true);
    stile();
    return b;
  }

  // Stile mobile: bersagli grandi, niente scroll orizzontale
  function stile() {
    if (document.getElementById('rg-stile')) return;
    var st = document.createElement('style');
    st.id = 'rg-stile';
    st.textContent =
      '.rg-box details{border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:8px 10px;margin-bottom:10px;}' +
      '.rg-box summary{font-weight:600;cursor:pointer;min-height:36px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}' +
      '.rg-chip{display:inline-flex;align-items:center;gap:4px;min-height:40px;padding:6px 12px;margin:0 6px 6px 0;border-radius:20px;border:1px solid transparent;font-size:.9rem;line-height:1.2;max-width:100%;text-align:left;}' +
      '.rg-chip.tit{background:#198754;color:#fff;}' +
      '.rg-chip.pan{background:rgba(128,128,128,.25);color:inherit;border-color:rgba(128,128,128,.45);}' +
      '.rg-chip .rg-num{opacity:.75;font-variant-numeric:tabular-nums;}' +
      '.rg-cambio{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.25);}' +
      '.rg-cambio select{flex:1 1 40%;min-width:0;min-height:40px;}' +
      '.rg-cambio .rg-freccia{flex:0 0 auto;}' +
      '.rg-cambio input{flex:0 0 96px;min-height:40px;}' +
      '.rg-cambio .btn{min-height:40px;min-width:44px;}' +
      '.rg-box .rg-big{min-height:40px;}' +
      '.rg-min{display:flex;align-items:center;gap:8px;font-size:.875rem;margin-bottom:4px;}' +
      '.rg-min .rg-nome{flex:0 1 45%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.rg-min .rg-val{flex:0 0 3.2em;text-align:right;font-variant-numeric:tabular-nums;}' +
      '.rg-min .rg-bar{flex:1 1 auto;background:rgba(25,135,84,.18);height:8px;border-radius:4px;min-width:30px;}' +
      '.rg-min .rg-bar span{display:block;height:100%;background:#198754;border-radius:4px;}';
    document.head.appendChild(st);
  }

  function render() {
    var b = box();
    if (!b) return;
    if (!stato) {
      b.innerHTML = '<button type="button" class="btn btn-outline-secondary rg-big" data-rg="aggiungi">➕ Aggiungi formazione</button>' +
        '<div class="form-text">Le partite salvate da Andamento Gara hanno già formazione, sostituzioni e minutaggio.</div>';
      return;
    }
    b.innerHTML = sezFormazione() + sezCambi() + sezMinutaggio() + sezCronologia();
  }

  function details(sez, titolo, corpo) {
    return '<details data-sez="' + sez + '"' + (sezAperte[sez] ? ' open' : '') + '><summary>' + titolo + '</summary>' + corpo + '</details>';
  }

  function etichetta(id) {
    var a = atleta(id);
    var num = a && a.number != null && a.number !== '' ? '<span class="rg-num">' + esc(a.number) + '</span> ' : '';
    return num + esc(nomeDi(id)) + (a && a.archived ? ' <small>(archiviato)</small>' : '');
  }

  function chip(id, titolare) {
    return '<button type="button" class="rg-chip ' + (titolare ? 'tit' : 'pan') + '" data-rg="sposta" data-id="' + esc(id) +
      '" title="' + (titolare ? 'Tocca per mandarlo in panchina' : 'Tocca per metterlo fra i titolari') + '">' + etichetta(id) + '</button>';
  }

  function sezFormazione() {
    var tit = stato.titolari;
    var pan = stato.convocati.filter(function (id) { return tit.indexOf(id) < 0; });
    // La tendina aggiunge o toglie convocati. Gli archiviati restano
    // sceglibili (in fondo): la partita e' passata e possono averla giocata.
    var fuori = atleti().filter(function (a) { return !a.isStaff && stato.convocati.indexOf(String(a.id)) < 0; })
      .sort(function (a, b) { return (a.archived ? 1 : 0) - (b.archived ? 1 : 0); });
    var badge = stato.incompleta && !tit.length
      ? '<span class="badge text-bg-warning">minutaggio incompleto: titolari non schierati</span>' : '';
    var t = stato.tempi;
    var corpo =
      '<div class="d-flex gap-3 align-items-center my-2 flex-wrap">' +
        '<label class="small d-flex align-items-center gap-1">Tempi <select class="form-select form-select-sm rg-big" style="width:auto;" data-rg="numTempi">' +
        [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (Number(t.numero) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="small d-flex align-items-center gap-1">Durata (min) <input type="number" inputmode="numeric" min="1" max="90" class="form-control form-control-sm rg-big" style="width:80px;" data-rg="durata" value="' + esc(t.durata) + '"></label>' +
      '</div>' +
      '<div class="small text-muted mb-1">Titolari (' + tit.length + ') — tocca un nome per mandarlo in panchina</div>' +
      '<div class="mb-2">' + (tit.map(function (id) { return chip(id, true); }).join('') || '<em class="small">nessuno</em>') + '</div>' +
      '<div class="small text-muted mb-1">Panchina (' + pan.length + ') — tocca un nome per metterlo fra i titolari</div>' +
      '<div class="mb-2">' + (pan.map(function (id) { return chip(id, false); }).join('') || '<em class="small">nessuno</em>') + '</div>' +
      '<select class="form-select rg-big" data-rg="convoca"><option value="">Aggiungi o togli un convocato…</option>' +
        (fuori.length ? '<optgroup label="Aggiungi">' + fuori.map(function (a) {
          return '<option value="+' + esc(a.id) + '">➕ ' + esc(a.name) + (a.archived ? ' (archiviato)' : '') + '</option>';
        }).join('') + '</optgroup>' : '') +
        (stato.convocati.length ? '<optgroup label="Togli">' + stato.convocati.map(function (id) {
          return '<option value="-' + esc(id) + '">✕ ' + esc(nomeDi(id)) + '</option>';
        }).join('') + '</optgroup>' : '') +
      '</select>';
    return details('formazione', 'Formazione ' + badge, corpo);
  }

  function sezCambi() {
    // Esce/Entra: convocati, piu' chi e' gia' nel cambio anche se non lo e'
    // piu' (storico: il nome non deve sparire dalla riga)
    var opz = function (sel) {
      var ids = stato.convocati.slice();
      if (sel && ids.indexOf(String(sel)) < 0) ids.push(String(sel));
      return '<option value="">—</option>' + ids.map(function (id) {
        return '<option value="' + esc(id) + '"' + (String(sel) === id ? ' selected' : '') + '>' + esc(nomeDi(id)) + '</option>';
      }).join('');
    };
    var righe = stato.cambi.map(function (c, i) {
      return '<div class="rg-cambio">' +
        '<select class="form-select form-select-sm" data-rg="esce" data-i="' + i + '" aria-label="Esce" title="Esce">' + opz(c.esce) + '</select>' +
        '<span class="rg-freccia" aria-hidden="true">→</span>' +
        '<select class="form-select form-select-sm" data-rg="entra" data-i="' + i + '" aria-label="Entra" title="Entra">' + opz(c.entra) + '</select>' +
        '<input type="text" class="form-control form-control-sm" data-rg="minuto" data-i="' + i + '" value="' +
          esc(c.minuto || (c.min + "'")) + '" placeholder="45+2" aria-label="Minuto" title="Minuto: 23, 45+2 o Int.">' +
        '<button type="button" class="btn btn-sm btn-outline-danger" data-rg="delCambio" data-i="' + i + '" aria-label="Elimina cambio"><i class="bi bi-trash"></i></button>' +
      '</div>';
    }).join('');
    return details('cambi', 'Sostituzioni (' + stato.cambi.length + ')',
      '<div class="small text-muted my-1">Esce → Entra · minuto (23, 45+2, Int.)</div>' + righe +
      '<button type="button" class="btn btn-outline-secondary rg-big mt-2" data-rg="addCambio">➕ Aggiungi cambio</button>');
  }

  function sezMinutaggio() {
    var mm = GR().minutaggioPartita(stato);
    var dt = stato.tempi.durateTempi || {};
    var max = 0;
    for (var p = 1; p <= (Number(stato.tempi.numero) || 2); p++) {
      max += dt[p] != null ? Number(dt[p]) || 0 : (Number(stato.tempi.durata) || 45) * 60;
    }
    // Convocati piu' chiunque compaia nel calcolo (es. un cambio con un
    // atleta tolto dai convocati): nessun tratto di partita sparisce
    var ids = stato.convocati.slice();
    Object.keys(mm).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    var righe = ids.map(function (id) { return [id, (mm[id] && mm[id].tot) || 0]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (r) {
        var min = Math.round(r[1] / 60);
        var pct = max ? Math.min(100, Math.round(r[1] / max * 100)) : 0;
        return '<div class="rg-min" data-min-id="' + esc(r[0]) + '">' +
          '<span class="rg-nome">' + esc(nomeDi(r[0])) + '</span>' +
          '<span class="rg-val">' + (r[1] ? (min < 1 ? '<1' : min) + "'" : '–') + '</span>' +
          '<span class="rg-bar"><span style="width:' + pct + '%;"></span></span>' +
        '</div>';
      }).join('');
    return details('minutaggio', 'Minutaggio',
      '<div class="form-text mb-1">Calcolato da titolari, cambi ed espulsioni: si aggiorna da solo.</div>' +
      (righe || '<em class="small">Nessun convocato.</em>'));
  }

  function sezCronologia() {
    var m = matchAperta || {};
    var voci = [];
    var k = function (min, extra) { return (Number(min) || 0) + (Number(extra) || 0) / 100; };
    (Array.isArray(m.scorers) ? m.scorers : []).forEach(function (s) {
      voci.push({ t: k(s.minute), ord: 0, txt: '⚽ ' + s.minute + "' " + nomeDi(s.athleteId) });
    });
    (Array.isArray(m.cards) ? m.cards : []).forEach(function (c) {
      voci.push({ t: k(c.minute), ord: 1, txt: (c.type === 'red' ? '🟥 ' : '🟨 ') + c.minute + "' " + nomeDi(c.athleteId) });
    });
    stato.cambi.forEach(function (c) {
      voci.push({ t: k(c.min, recupero(c)), ord: c.intervallo ? -1 : 2,
        txt: '🔄 ' + (c.minuto || c.min + "'") + ' esce ' + nomeDi(c.esce) + ', entra ' + nomeDi(c.entra) });
    });
    voci.sort(function (a, b) { return (a.t - b.t) || (a.ord - b.ord); });
    return details('cronologia', 'Cronologia',
      '<div class="form-text mb-1">Gol e cartellini come salvati (le modifiche sopra valgono dopo "Salva Partita").</div>' +
      (voci.map(function (v) { return '<div class="small py-1">' + esc(v.txt) + '</div>'; }).join('') || '<em class="small">Nessun evento.</em>'));
  }

  function onClick(e) {
    var el = e.target.closest('[data-rg]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
    var az = el.dataset.rg, id = el.dataset.id;
    if (az === 'aggiungi') { stato = vuoto(); }
    else if (!stato) return;
    else if (az === 'sposta') {
      var i = stato.titolari.indexOf(id);
      if (i >= 0) stato.titolari.splice(i, 1); else stato.titolari.push(id);
    }
    else if (az === 'addCambio') {
      // Il cambio nuovo parte dal minuto dell'ultimo (o dalla fine del 1o
      // tempo): a parita' di minuto riordina() lo lascia in fondo, cosi' la
      // riga nuova compare sotto le altre e non al posto di una esistente
      var ult = stato.cambi[stato.cambi.length - 1];
      var mi = GR().leggiMinutoTesto(ult ? (ult.minuto || String(ult.min)) : String(stato.tempi.durata), opzMinuto()) ||
        GR().leggiMinutoTesto(String(stato.tempi.durata), opzMinuto()) || { min: 1, minuto: "1'", periodo: 1, intervallo: false };
      var nuovo = Object.assign({ esce: '', entra: '' }, mi);
      if (!nuovo.intervallo) delete nuovo.intervallo;
      stato.cambi.push(nuovo);
      riordina();
    }
    else if (az === 'delCambio') { stato.cambi.splice(Number(el.dataset.i), 1); riordina(); }
    else return;
    toccato = true;
    render();
  }

  function onChange(e) {
    var el = e.target, az = el.dataset && el.dataset.rg;
    if (!az || !stato) return;
    var i = Number(el.dataset.i);
    if (az === 'convoca') {
      var v = String(el.value || ''), id = v.slice(1);
      if (!id) return;
      if (v[0] === '+') { if (stato.convocati.indexOf(id) < 0) stato.convocati.push(id); }
      else {
        stato.convocati = stato.convocati.filter(function (x) { return x !== id; });
        stato.titolari = stato.titolari.filter(function (x) { return x !== id; });
      }
    }
    else if (az === 'esce' || az === 'entra') { stato.cambi[i][az] = el.value; }
    else if (az === 'minuto') {
      var mi = GR().leggiMinutoTesto(el.value, opzMinuto());
      if (!mi) { el.classList.add('is-invalid'); el.title = 'Minuto non valido: usa 23, 45+2 o Int.'; return; }
      // Minuto scritto a mano: il secondo esatto del cronometro non vale piu'
      var c = stato.cambi[i];
      delete c.sec;
      delete c.intervallo;
      Object.assign(c, mi);
      if (!mi.intervallo) delete c.intervallo;
      riordina();
    }
    else if (az === 'numTempi') {
      stato.tempi.numero = Math.max(1, Math.min(4, Number(el.value) || 2));
      // Le durate registrate valgono solo per i tempi che esistono ancora
      var dt = stato.tempi.durateTempi || {};
      Object.keys(dt).forEach(function (p) { if (Number(p) > stato.tempi.numero) delete dt[p]; });
      rileggiMinuti();
    }
    else if (az === 'durata') {
      stato.tempi.durata = Math.max(1, Math.min(90, Math.round(Number(el.value)) || 45));
      // Durata corretta a mano: i secondi del cronometro (per tempo) erano
      // della durata vecchia; ogni tempo conta ora per intero
      stato.tempi.durateTempi = {};
      rileggiMinuti();
    }
    else return;
    toccato = true;
    render();
  }

  window.RisultatiGara = {
    apri: function (match) {
      aperto = true;
      toccato = false;
      matchAperta = match ? clone(match) : null;
      stato = matchAperta && matchAperta.gara && typeof matchAperta.gara === 'object' ? clone(matchAperta.gara) : null;
      if (stato) {
        stato.convocati = (Array.isArray(stato.convocati) ? stato.convocati : []).map(String);
        stato.titolari = (Array.isArray(stato.titolari) ? stato.titolari : []).map(String);
        stato.cambi = Array.isArray(stato.cambi) ? stato.cambi : [];
        stato.espulsioni = Array.isArray(stato.espulsioni) ? stato.espulsioni : [];
        stato.tempi = Object.assign({ numero: 2, durata: 45, durateTempi: {} }, stato.tempi || {});
        if (!stato.tempi.durateTempi || typeof stato.tempi.durateTempi !== 'object') stato.tempi.durateTempi = {};
      }
      render();
    },
    leggi: function () {
      if (!aperto || !toccato) return undefined;
      if (!stato) return matchAperta && matchAperta.gara ? null : undefined;
      var g = clone(stato);
      // Titolari fuori dai convocati non hanno senso: si allineano
      g.titolari = g.titolari.filter(function (id) { return g.convocati.indexOf(id) >= 0; });
      // Righe di cambio lasciate vuote: il server le scarterebbe comunque
      g.cambi = g.cambi.filter(function (c) { return c.esce || c.entra; });
      // "Aggiungi formazione" senza scegliere niente: nessun blocco gara
      if (!(matchAperta && matchAperta.gara) && !g.convocati.length && !g.cambi.length) return undefined;
      // Senza XI il minutaggio resta incompleto; con l'XI torna completo
      g.incompleta = !g.titolari.length;
      return g;
    }
  };
})();
