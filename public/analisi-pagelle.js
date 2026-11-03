// ── AREA TECNICA — ANALISI PAGELLE ─────────────────────────────────────────
// Sunto delle Pagelle Valutazione di ogni atleta della rosa (Gestione Squadra),
// grafici delle voci deboli e filtro "voce + numero di stelle".
// Sola lettura: legge athletes e ratingSheets da GET /api/data (stessi header
// di area-tecnica.js, esposti come window.atAuthHeaders). Non scrive nulla.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  // Elenco fondamentali: unica fonte in pagelle.js (caricato prima di questo
  // file). Il fallback serve solo se pagelle.js non fosse caricato.
  const FOND = window.PAGELLE_FONDAMENTALI || [
    { key: 'colpiTesta', label: 'Colpi di Testa' }, { key: 'tiro', label: 'Tiro' },
    { key: 'velocita', label: 'Velocità corsa' }, { key: 'controlloPalla', label: 'Controllo palla' },
    { key: 'stopPalla', label: 'Stop della Palla' }
  ];
  // Note esplicative delle voci (al passaggio del mouse), definite in pagelle.js
  const DESC = {};
  (window.PAGELLE_CATEGORIE || []).concat(FOND).forEach(x => { if (x.desc) DESC[x.key] = x.desc; });
  const VOCI = [
    { id: 'tecnica',         label: 'Tecnica',       get: s => (s.ratings || {}).tecnica },
    { id: 'tattica',         label: 'Tattica',       get: s => (s.ratings || {}).tattica },
    { id: 'fisico',          label: 'Fisico',        get: s => (s.ratings || {}).fisico },
    { id: 'comportamentale', label: 'Comportamento', get: s => (s.ratings || {}).comportamentale },
    { id: 'grinta', label: 'Grinta', get: s => (s.ratings || {}).grinta },
    { id: 'qualitaCampo', label: 'Qualità in Campo', get: s => (s.ratings || {}).qualitaCampo }
  ].map(v => Object.assign(v, { key: v.id }))
    .concat(FOND.map(f => ({ id: 'f_' + f.key, key: f.key, label: f.label, fond: true, get: s => (s.fondamentali || {})[f.key] })));
  VOCI.forEach(v => { v.desc = DESC[v.key] || ''; });
  const CATEGORIE = VOCI.filter(v => !v.fond);

  // Importanza della voce per il ruolo (0-3 pallini nella pagella, sheet.pesi).
  // Le pagelle senza pesi valgono 3. Il peso moltiplica il voto nelle medie:
  // una voce a 0 non conta (es. Colpi di Testa per un portiere).
  const PESO_MAX = 3;
  const pesoOf = (s, key) => {
    const p = s.pesi && s.pesi[key] != null ? Number(s.pesi[key]) : PESO_MAX;
    return isNaN(p) ? PESO_MAX : p;
  };
  // Media pesata di [{v, p}]; null se nessuna voce ha peso
  const mediaPesata = (items) => {
    const sp = items.reduce((a, x) => a + x.p, 0);
    return sp > 0 ? Math.round(items.reduce((a, x) => a + x.v * x.p, 0) / sp * 10) / 10 : null;
  };

  let rows = [];          // una riga per atleta: { athlete, sheets, val: {voceId: {v, date, coach}} }
  let charts = [];
  let sortCol = 'nome', sortDir = 1;

  function fmtDate(d) {
    if (!d) return '';
    const x = new Date(d + 'T00:00:00');
    return isNaN(x) ? esc(d) : x.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  // Colore per voto: rosso = problema, giallo = da migliorare, verde = ok
  function tone(v) {
    if (v == null) return { bg: 'transparent', fg: '#475569' };
    if (v < 2.5) return { bg: 'rgba(239,68,68,0.18)', fg: '#f87171' };
    if (v < 3.5) return { bg: 'rgba(245,158,11,0.18)', fg: '#fbbf24' };
    return { bg: 'rgba(26,160,94,0.18)', fg: '#4ade80' };
  }

  // Valore di una voce per un atleta. "ultima": voto della pagella piu' recente
  // che ha valutato quella voce (i fondamentali sono facoltativi, quindi la
  // pagella piu' recente potrebbe non averli). "media": media dei voti > 0
  // pesata per l'importanza data in ogni pagella.
  // v = stelle (1-5), p = importanza per il ruolo (0-3).
  function valoreVoce(sheets, voce, mode) {
    const rated = sheets.map(s => ({ v: Number(voce.get(s)) || 0, p: pesoOf(s, voce.key), s })).filter(x => x.v > 0);
    if (!rated.length) return null;
    const base = { date: rated[0].s.date, coach: rated[0].s.coachName, n: rated.length };
    if (mode === 'media') {
      const pesata = mediaPesata(rated);
      // Tutte le pagelle a importanza 0: mostro comunque la media semplice
      const v = pesata != null ? pesata : Math.round(rated.reduce((a, x) => a + x.v, 0) / rated.length * 10) / 10;
      const p = Math.round(rated.reduce((a, x) => a + x.p, 0) / rated.length);
      return Object.assign(base, { v, p });
    }
    return Object.assign(base, { v: rated[0].v, p: rated[0].p });
  }

  function buildRows(athletes, ratingSheets) {
    const mode = $('ap-mode').value;
    const coach = $('ap-coach').value; // '' = tutti i valutatori
    // Solo la rosa attuale: archiviati e staff non sono atleti da valutare oggi
    return (athletes || [])
      .filter(a => a && !a.archived && !a.isStaff)
      .map(a => {
        const sheets = ((ratingSheets || {})[a.id] || [])
          .filter(s => !coach || coachKey(s.coachName) === coach)
          .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
        const val = {};
        VOCI.forEach(v => { val[v.id] = valoreVoce(sheets, v, mode); });
        // Media dell'atleta = media delle categorie pesata per importanza
        const media = mediaPesata(CATEGORIE.map(c => val[c.id]).filter(Boolean));
        return { athlete: a, sheets, val, media };
      });
  }

  let rawAthletes = [], rawSheets = {};

  // Nome valutatore normalizzato: "Edy", "edy " e "EDY" sono la stessa persona
  const coachKey = n => String(n || '').trim().toLowerCase();

  // Riempie la tendina valutatori con i nomi presenti nelle pagelle,
  // mantenendo la scelta corrente se quel nome esiste ancora
  function fillCoachSelect() {
    const sel = $('ap-coach');
    const prev = sel.value;
    const names = new Map();
    Object.values(rawSheets).forEach(list => (list || []).forEach(s => {
      const k = coachKey(s.coachName);
      if (k && !names.has(k)) names.set(k, String(s.coachName).trim());
    }));
    const sorted = [...names.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
    sel.innerHTML = '<option value="">👤 Tutti i valutatori</option>'
      + sorted.map(([k, label]) => `<option value="${esc(k)}">${esc(label)}</option>`).join('');
    sel.value = names.has(prev) ? prev : '';
  }

  async function load() {
    const body = $('ap-body');
    body.innerHTML = '<div class="at-empty">Caricamento pagelle…</div>';
    try {
      const r = await fetch('/api/data', { headers: window.atAuthHeaders(false) });
      if (r.status === 401 || r.status === 403) { body.innerHTML = '<div class="at-empty">⛔ Sessione non valida. Riapri l\'Area Tecnica dalla dashboard.</div>'; return; }
      const d = await r.json();
      rawAthletes = Array.isArray(d.athletes) ? d.athletes : [];
      rawSheets = d.ratingSheets || {};
      fillCoachSelect();
      renderAll();
    } catch (e) {
      body.innerHTML = '<div class="at-empty">Errore di caricamento delle pagelle.</div>';
    }
  }

  function renderAll() {
    // Il cambio "Ultima/Media" ridisegna tutto: conservo le scelte del filtro
    const prev = $('ap-f-voce') ? { voce: $('ap-f-voce').value, op: $('ap-f-op').value, n: $('ap-f-n').value } : null;
    rows = buildRows(rawAthletes, rawSheets);
    const conPagelle = rows.filter(r => r.sheets.length);
    const body = $('ap-body');
    charts.forEach(c => { try { c.destroy(); } catch (e) {} });
    charts = [];
    if (!rows.length) { body.innerHTML = '<div class="at-empty">Nessun atleta in rosa per questa annata.</div>'; return; }
    if (!conPagelle.length && $('ap-coach').value) { body.innerHTML = '<div class="at-empty">Nessuna pagella di questo valutatore per gli atleti in rosa.</div>'; return; }
    if (!conPagelle.length) { body.innerHTML = '<div class="at-empty">Nessuna pagella ancora compilata. Le pagelle si creano in Gestione Squadra → box atleta → Pagella Valutazione.</div>'; return; }

    body.innerHTML = `
      <div class="ap-kpis">
        <div class="ap-kpi"><b>${conPagelle.length}</b> / ${rows.length}<span>atleti con pagella</span></div>
        <div class="ap-kpi"><b>${conPagelle.reduce((s, r) => s + r.sheets.length, 0)}</b><span>pagelle totali</span></div>
        <div class="ap-kpi" title="Media delle categorie pesata per l'importanza della voce nel ruolo"><b>${rows.filter(r => r.media != null && r.media < 2.5).length}</b><span>atleti con media pesata &lt; 2,5</span></div>
      </div>

      <div class="ap-section">
        <h4>🔎 Cerca atleti per voce e stelle</h4>
        <div class="ap-filter">
          <select id="ap-f-voce">${VOCI.map(v => `<option value="${v.id}" title="${esc(v.desc)}">${v.fond ? '⚽ ' : ''}${esc(v.label)}</option>`).join('')}</select>
          <select id="ap-f-op">
            <option value="eq">esattamente</option>
            <option value="le" selected>fino a (≤)</option>
            <option value="ge">almeno (≥)</option>
          </select>
          <select id="ap-f-n">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === 2 ? 'selected' : ''}>${n} ★</option>`).join('')}</select>
        </div>
        <div id="ap-f-result"></div>
      </div>

      <div class="ap-charts">
        <div class="ap-section"><h4>📉 Media squadra per voce <small>(pesata per importanza, dalla più debole)</small></h4><div class="ap-chart"><canvas id="ap-ch-media"></canvas></div></div>
        <div class="ap-section"><h4>⚠️ Atleti in difficoltà per voce <small>(1–2 ★)</small></h4><div class="ap-chart"><canvas id="ap-ch-diff"></canvas></div></div>
      </div>

      <div class="ap-section">
        <h4>📋 Sunto per atleta <small>(clicca un'intestazione per ordinare)</small></h4>
        <div class="ap-table-wrap"><table class="ap-table" id="ap-table"></table></div>
      </div>`;

    if (prev) { $('ap-f-voce').value = prev.voce; $('ap-f-op').value = prev.op; $('ap-f-n').value = prev.n; }
    ['ap-f-voce', 'ap-f-op', 'ap-f-n'].forEach(id => $(id).addEventListener('change', renderFiltro));
    renderFiltro();
    renderTable();
    renderCharts();
  }

  function renderFiltro() {
    const voce = VOCI.find(v => v.id === $('ap-f-voce').value);
    const op = $('ap-f-op').value, n = parseInt($('ap-f-n').value, 10);
    const media = $('ap-mode').value === 'media';
    // In modalita' media il voto e' decimale: "esattamente 3" = arrotondato a 3
    const match = (v) => op === 'eq' ? Math.round(v) === n : op === 'le' ? v <= n : v >= n;
    // Chi ha la voce a importanza 0 non e' cercato: per il suo ruolo non conta
    const irrilevanti = rows.filter(r => r.val[voce.id] && r.val[voce.id].p === 0).length;
    const valutati = rows.filter(r => r.val[voce.id] && r.val[voce.id].p > 0);
    const trovati = valutati.filter(r => match(r.val[voce.id].v))
      .sort((a, b) => a.val[voce.id].v - b.val[voce.id].v || String(a.athlete.name).localeCompare(String(b.athlete.name)));
    const nonVal = rows.length - valutati.length - irrilevanti;
    const opTxt = { eq: 'esattamente', le: 'fino a', ge: 'almeno' }[op];
    let html = `<div class="ap-f-summary"><b>${trovati.length}</b> atlet${trovati.length === 1 ? 'a' : 'i'} con <b>${esc(voce.label)}</b> ${opTxt} ${n} ★${media ? ' (media)' : ''}`
      + (nonVal ? ` · <span style="color:var(--muted);">${nonVal} non valutat${nonVal === 1 ? 'o' : 'i'} su questa voce</span>` : '')
      + (irrilevanti ? ` · <span style="color:var(--muted);">${irrilevanti} con importanza 0 per il ruolo</span>` : '') + '</div>';
    if (voce.desc) html += `<div class="ap-f-desc">ℹ️ ${esc(voce.desc)}</div>`;
    if (trovati.length) {
      html += '<div class="ap-f-list">' + trovati.map(r => {
        const x = r.val[voce.id], t = tone(x.v);
        return `<div class="ap-f-item">
          <span class="ap-pill" style="background:${t.bg};color:${t.fg};">${x.v}★</span>
          <span class="ap-f-name">${esc(r.athlete.name)}</span>${x.p < PESO_MAX ? pallini(x.p) : ''}
          <span class="ap-f-meta">${media ? `media di ${x.n} pagell${x.n === 1 ? 'a' : 'e'}` : `${fmtDate(x.date)}${x.coach ? ' · ' + esc(x.coach) : ''}`}</span>
        </div>`;
      }).join('') + '</div>';
    }
    $('ap-f-result').innerHTML = html;
  }

  // Pallini di importanza (pieni = peso), mostrati solo quando non e' il massimo
  const pallini = (p) => `<span class="ap-peso" title="Importanza per il ruolo: ${p}/${PESO_MAX}">`
    + '●'.repeat(p) + '<span style="opacity:.3">' + '●'.repeat(PESO_MAX - p) + '</span></span>';

  function renderTable() {
    const cols = [{ id: 'nome', label: 'Atleta' }, { id: 'n', label: 'Pag.' }, { id: 'ultima', label: 'Ultima' }]
      .concat(VOCI.map(v => ({ id: v.id, label: v.label, fond: v.fond, desc: v.desc })))
      .concat([{ id: 'media', label: 'Media', desc: "Media delle categorie pesata per l'importanza della voce nel ruolo (pallini 0-3 della pagella)" }]);
    const key = (r) => {
      if (sortCol === 'nome') return String(r.athlete.name || '').toLowerCase();
      if (sortCol === 'n') return r.sheets.length;
      if (sortCol === 'ultima') return r.sheets[0] ? r.sheets[0].date : '';
      if (sortCol === 'media') return r.media == null ? 99 : r.media;
      const x = r.val[sortCol]; return x ? x.v : 99; // non valutati sempre in fondo
    };
    const sorted = rows.slice().sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (ka === 99 && kb !== 99) return 1;
      if (kb === 99 && ka !== 99) return -1;
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * sortDir;
    });
    const cell = (x) => {
      if (!x) return '<td class="ap-c ap-na">—</td>';
      // Voce a importanza 0: il voto resta visibile ma spento (non conta nelle medie)
      if (x.p === 0) return `<td class="ap-c" title="Importanza 0: non conta nelle medie"><span class="ap-pill" style="color:#64748b;text-decoration:line-through;">${x.v}</span></td>`;
      const t = tone(x.v);
      return `<td class="ap-c"><span class="ap-pill" style="background:${t.bg};color:${t.fg};">${x.v}</span>${x.p != null && x.p < PESO_MAX ? '<br>' + pallini(x.p) : ''}</td>`;
    };
    $('ap-table').innerHTML = '<thead><tr>' + cols.map(c =>
      `<th data-col="${c.id}"${c.desc ? ` title="${esc(c.desc)}"` : ''} class="${c.fond ? 'ap-th-fond' : ''}${c.id === 'nome' ? ' ap-th-name' : ''}">${esc(c.label)}${sortCol === c.id ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr></thead><tbody>'
      + sorted.map(r => '<tr>'
        + `<td class="ap-name">${esc(r.athlete.name)}</td>`
        + `<td class="ap-c">${r.sheets.length || '<span class="ap-na">0</span>'}</td>`
        + `<td class="ap-c ap-date">${r.sheets[0] ? fmtDate(r.sheets[0].date) : '<span class="ap-na">—</span>'}</td>`
        + VOCI.map(v => cell(r.val[v.id])).join('')
        + cell(r.media == null ? null : { v: r.media })
        + '</tr>').join('') + '</tbody>';
    $('ap-table').querySelectorAll('th').forEach(th => th.addEventListener('click', () => {
      const c = th.dataset.col;
      if (sortCol === c) sortDir = -sortDir; else { sortCol = c; sortDir = 1; }
      renderTable();
    }));
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;
    // Per squadra: media della voce pesata per importanza; chi ha la voce a 0
    // non e' contato ne' nella media ne' tra gli atleti in difficolta'
    const stats = VOCI.map(v => {
      const items = rows.map(r => r.val[v.id]).filter(x => x && x.p > 0);
      return {
        label: (v.fond ? '⚽ ' : '') + v.label,
        media: mediaPesata(items) || 0,
        diff: items.filter(x => x.v <= 2).length,
        n: items.length
      };
    }).filter(s => s.n > 0);

    const base = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { ticks: { color: '#cbd5e1', font: { size: 11 } }, grid: { display: false } }
      }
    };

    const byMedia = stats.slice().sort((a, b) => a.media - b.media);
    charts.push(new Chart($('ap-ch-media'), {
      type: 'bar',
      data: { labels: byMedia.map(s => s.label), datasets: [{ data: byMedia.map(s => s.media), backgroundColor: byMedia.map(s => tone(s.media).fg), borderRadius: 4 }] },
      options: Object.assign({}, base, {
        scales: Object.assign({}, base.scales, { x: Object.assign({}, base.scales.x, { min: 0, max: 5, ticks: { color: '#94a3b8', stepSize: 1 } }) }),
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `Media ${c.formattedValue} / 5 (${byMedia[c.dataIndex].n} atleti valutati)` } } }
      })
    }));

    const byDiff = stats.slice().sort((a, b) => b.diff - a.diff);
    charts.push(new Chart($('ap-ch-diff'), {
      type: 'bar',
      data: { labels: byDiff.map(s => s.label), datasets: [{ data: byDiff.map(s => s.diff), backgroundColor: '#f87171', borderRadius: 4 }] },
      options: Object.assign({}, base, {
        scales: Object.assign({}, base.scales, { x: Object.assign({}, base.scales.x, { beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 } }) }),
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.formattedValue} su ${byDiff[c.dataIndex].n} atleti valutati` } } }
      })
    }));
  }

  $('ap-open-btn').addEventListener('click', () => { $('ap-overlay').style.display = 'flex'; load(); });
  $('ap-mode').addEventListener('change', () => { if (rawAthletes.length) renderAll(); });
  $('ap-coach').addEventListener('change', () => { if (rawAthletes.length) renderAll(); });
  // Niente chiusura al clic fuori dal riquadro: si chiude solo con "✕ Chiudi"
})();
