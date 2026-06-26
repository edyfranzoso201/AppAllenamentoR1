// ── AREA TECNICA — libreria video/esercizi/schede (Fase 1: video) ──────────
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const $ = (id) => document.getElementById(id);

  let items = [];

  // La pagina si apre in una NUOVA scheda (target=_blank): il sessionStorage NON
  // è condiviso tra schede. L'app persiste le chiavi sessione in localStorage con
  // prefisso "_p_" (vedi auth-multi-annata.js). Quindi leggo: sessionStorage →
  // fallback localStorage "_p_" → fallback localStorage diretto.
  function ss(key) {
    return sessionStorage.getItem(key) || localStorage.getItem('_p_' + key) || '';
  }
  function annataId() {
    const u = new URLSearchParams(location.search).get('annata');
    return u || ss('gosport_current_annata') || localStorage.getItem('currentAnnata') || '';
  }
  function authHeaders(json) {
    const h = {
      'X-Annata-Id': annataId(),
      'X-Auth-Session': ss('gosport_session_token') || ss('gosport_auth_session') || '',
      'X-Auth-User': ss('gosport_auth_user') || '',
      'X-User-Role': ss('gosport_user_role') || '',
      'X-Society-Id': ss('gosport_society_id') || ''
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  function toast(msg) {
    const t = $('at-toast'); t.textContent = msg; t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 2500);
  }

  // ── Riconoscimento fonte + conversione a URL embed (streaming, no download) ──
  function detectFonte(url) {
    const u = url.trim();
    if (/youtube\.com|youtu\.be/i.test(u)) return 'youtube';
    if (/drive\.google\.com|docs\.google\.com/i.test(u)) return 'drive';
    if (/^https?:\/\//i.test(u)) return 'altro';
    if (/^(\\\\|file:\/\/)/i.test(u)) return 'locale';
    return 'altro';
  }
  function driveId(url) {
    let m = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
    return m ? m[1] : null;
  }
  function youtubeId(url) {
    let m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/) || url.match(/\/embed\/([^?&]+)/) || url.match(/\/shorts\/([^?&]+)/);
    return m ? m[1] : null;
  }
  // Ritorna { mode:'iframe', src } oppure { mode:'locale', path } oppure { mode:'link', href }
  function embedFor(item) {
    const fonte = item.fonte || detectFonte(item.url);
    if (fonte === 'youtube') {
      const id = youtubeId(item.url);
      if (id) return { mode: 'iframe', src: `https://www.youtube.com/embed/${id}` };
    }
    if (fonte === 'drive') {
      const id = driveId(item.url);
      // Drive blocca l'iframe CSP se il file non è pubblico → mostriamo link diretto
      const previewUrl = id ? `https://drive.google.com/file/d/${id}/preview` : item.url;
      const openUrl    = id ? `https://drive.google.com/file/d/${id}/view`    : item.url;
      return { mode: 'drive', previewUrl, openUrl };
    }
    if (fonte === 'locale') return { mode: 'locale', path: item.url };
    if (/^https?:\/\//i.test(item.url)) return { mode: 'link', href: item.url };
    return { mode: 'locale', path: item.url };
  }

  const TIPO_ICON = { video:'🎥', esercizio:'🏃', scheda:'📋', documento:'📄' };
  const CAT_COLOR = { allenamento:'#16a34a', partita:'#2563eb', stralcio:'#7c3aed', tattica:'#d97706', altro:'#64748b' };
  const FONTE_PREFIX = { youtube:'Y', drive:'D', locale:'F', altro:'A' };

  // Calcola il codice progressivo (es. Y3) per ogni item basandosi sulla fonte.
  // Ordina per createdAt/id, assegna numeri da 1; i buchi lasciati da item cancellati
  // vengono riutilizzati automaticamente al prossimo salvataggio.
  function assignCodes(allItems) {
    const byFonte = {};
    const sorted = [...allItems].sort((a, b) => String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id)));
    sorted.forEach(x => {
      const f = x.fonte || detectFonte(x.url || '');
      const prefix = FONTE_PREFIX[f] || 'A';
      if (!byFonte[prefix]) byFonte[prefix] = 0;
      byFonte[prefix]++;
      x._code = prefix + byFonte[prefix];
    });
    return allItems; // mutati in place
  }

  function thumbFor(item) {
    if (item.cover && /^https?:\/\//i.test(item.cover)) return item.cover;
    if ((item.fonte || detectFonte(item.url)) === 'youtube') {
      const id = youtubeId(item.url);
      if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
    }
    return null;
  }

  // ── Caricamento + render ──
  async function load() {
    $('at-annata-label').textContent = annataId() ? ('Annata: ' + annataId()) : '';
    try {
      const r = await fetch('/api/data?action=area-tecnica', { headers: authHeaders(false) });
      if (r.status === 403) { document.querySelector('.at-main').innerHTML = '<div class="at-empty">⛔ Accesso riservato allo staff. Accedi dalla dashboard.</div>'; return; }
      const d = await r.json();
      items = (d.success && d.items) || [];
      assignCodes(items);
      render();
    } catch (e) {
      document.querySelector('.at-main').innerHTML = '<div class="at-empty">Errore di caricamento. Apri questa pagina dalla dashboard (serve la sessione).</div>';
    }
  }

  function render() {
    const ft = $('at-filter-tipo').value, fc = $('at-filter-cat').value, q = ($('at-search').value || '').toLowerCase();
    const list = items
      .filter(x => !ft || x.tipo === ft)
      .filter(x => !fc || x.categoria === fc)
      .filter(x => !q || (x.titolo || '').toLowerCase().includes(q))
      .sort((a, b) => String(b.data || b.createdAt).localeCompare(String(a.data || a.createdAt)));
    const grid = $('at-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="at-empty" style="grid-column:1/-1;">Nessun contenuto.${items.length ? ' Prova a cambiare i filtri.' : ' Clicca "+ Aggiungi" per inserire il primo video.'}</div>`;
      return;
    }
    grid.innerHTML = list.map(x => {
      const thumb = thumbFor(x);
      const fmt = x.data ? new Date(x.data + 'T00:00:00').toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '';
      const titColor = x.colore || '#e2e8f0';
      const codeTag = x._code ? `<span style="background:rgba(0,0,0,0.55);color:${titColor};font-size:0.7rem;font-weight:800;border-radius:4px;padding:1px 5px;position:absolute;top:6px;left:6px;z-index:2;">${esc(x._code)}</span>` : '';
      const overlayTitle = `<div class="at-tov-icon">${TIPO_ICON[x.tipo] || '🎬'}</div><div class="at-tov-text" style="color:${titColor};">${esc(x.titolo || '(senza titolo)')}</div>`;
      const thumbHtml = thumb
        ? `<img src="${esc(thumb)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="at-title-overlay" style="display:none;">${overlayTitle}</div>`
        : `<div class="at-title-overlay">${overlayTitle}</div>`;
      return `<div class="at-card" onclick="window.atOpen('${x.id}')">
        <div class="at-thumb">${codeTag}${thumbHtml}<div class="play">▶</div></div>
        <div class="at-cardbody">
          <div class="tit" style="color:${titColor};">${esc(x.titolo) || '(senza titolo)'}</div>
          <span class="at-badge" style="background:${CAT_COLOR[x.categoria] || '#64748b'}33;color:${CAT_COLOR[x.categoria] || '#94a3b8'};">${esc(x.categoria || '')}</span>
          <div class="at-meta"><span style="font-weight:700;color:${titColor};opacity:.8;">${x._code || ''}</span><span>${TIPO_ICON[x.tipo] || ''} ${fmt}</span>
            <span><button class="at-del" title="Modifica" onclick="event.stopPropagation();window.atEdit('${x.id}')">✏️</button><button class="at-del" title="Elimina" onclick="event.stopPropagation();window.atDelete('${x.id}')">🗑️</button></span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Player ──
  window.atOpen = function (id) {
    const x = items.find(i => i.id === id); if (!x) return;
    const codeLabel = x._code ? `[${x._code}] ` : '';
    $('at-player-title').textContent = (TIPO_ICON[x.tipo] || '') + ' ' + codeLabel + (x.titolo || '');
    $('at-player-title').style.color = x.colore || '';
    const emb = embedFor(x);
    const body = $('at-player-body');
    if (emb.mode === 'iframe') {
      body.innerHTML = `<div class="at-player"><iframe src="${esc(emb.src)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe></div>`;
    } else if (emb.mode === 'drive') {
      // Tenta iframe Drive con fallback visibile se bloccato dal CSP
      body.innerHTML = `
        <div id="at-drive-wrap">
          <div class="at-player" id="at-drive-frame-wrap">
            <iframe id="at-drive-iframe" src="${esc(emb.previewUrl)}"
              allow="autoplay; encrypted-media; fullscreen" allowfullscreen
              style="width:100%;height:100%;border:0;"
              onerror="document.getElementById('at-drive-fallback').style.display='block';document.getElementById('at-drive-frame-wrap').style.display='none';">
            </iframe>
          </div>
          <div id="at-drive-fallback" class="at-locale" style="margin-top:10px;">
            <div style="color:#94a3b8;margin-bottom:10px;">⚠️ L'anteprima Drive non è disponibile (file privato o CSP). Aprilo direttamente:</div>
            <a href="${esc(emb.openUrl)}" target="_blank" rel="noopener" class="at-btn" style="text-decoration:none;">📂 Apri in Google Drive ↗</a>
          </div>
        </div>`;
      // Drive non lancia onerror sull'iframe (CSP è silenzioso) → mostriamo sempre anche il link sotto
      setTimeout(() => {
        const fb = document.getElementById('at-drive-fallback');
        if (fb) fb.style.display = 'block';
      }, 2500);
    } else if (emb.mode === 'link') {
      body.innerHTML = `<div class="at-locale">🔗 Contenuto esterno.<br><a href="${esc(emb.href)}" target="_blank" rel="noopener" class="at-btn" style="display:inline-block;margin-top:10px;text-decoration:none;">Apri in una nuova scheda ↗</a></div>`;
    } else {
      body.innerHTML = `<div class="at-locale">📁 Percorso di rete della società:<br><code style="display:block;margin:10px 0;color:#cbd5e1;word-break:break-all;">${esc(emb.path)}</code>
        <button class="at-btn" onclick="navigator.clipboard.writeText('${esc(emb.path).replace(/'/g, "\\'")}');this.textContent='✓ Copiato'">📋 Copia percorso</button>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:8px;">Incollalo nell'Esplora File del PC della società (i browser non aprono percorsi locali per sicurezza).</div></div>`;
    }
    $('at-player-note').textContent = x.note || '';
    $('at-player-overlay').style.display = 'flex';
  };
  window.atClosePlayer = function () {
    $('at-player-body').innerHTML = ''; // ferma il video
    $('at-player-overlay').style.display = 'none';
  };

  // ── Form aggiungi/modifica ──
  function openForm(x) {
    $('at-form-title').textContent = x ? '✏️ Modifica contenuto' : '➕ Aggiungi contenuto';
    $('at-edit-id').value = x ? x.id : '';
    $('at-titolo').value = x ? (x.titolo || '') : '';
    $('at-tipo').value = x ? (x.tipo || 'video') : 'video';
    $('at-categoria').value = x ? (x.categoria || 'allenamento') : 'allenamento';
    $('at-data').value = x ? (x.data || '') : new Date().toISOString().split('T')[0];
    $('at-url').value = x ? (x.url || '') : '';
    $('at-cover').value = x ? (x.cover || '') : '';
    $('at-colore').value = x ? (x.colore || '#e2e8f0') : '#e2e8f0';
    $('at-note').value = x ? (x.note || '') : '';
    $('at-form-overlay').style.display = 'flex';
    $('at-titolo').focus();
  }
  window.atEdit = function (id) { const x = items.find(i => i.id === id); if (x) openForm(x); };

  async function save() {
    const url = $('at-url').value.trim();
    const titolo = $('at-titolo').value.trim();
    if (!titolo) { toast('Inserisci un titolo'); return; }
    if (!/^(https?:\/\/|file:\/\/|\\\\)/i.test(url)) { toast('Link non valido (https://, \\\\… o file://)'); return; }
    const cover = $('at-cover').value.trim();
    const colore = $('at-colore').value || '#e2e8f0';
    const item = {
      id: $('at-edit-id').value || undefined,
      tipo: $('at-tipo').value,
      titolo, url,
      fonte: detectFonte(url),
      categoria: $('at-categoria').value,
      data: $('at-data').value,
      cover: cover || undefined,
      colore: colore,
      note: $('at-note').value.trim()
    };
    try {
      const r = await fetch('/api/data?action=area-tecnica', { method:'POST', headers: authHeaders(true), body: JSON.stringify({ item }) });
      const d = await r.json();
      if (!r.ok || !d.success) { toast(d.message || 'Errore salvataggio'); return; }
      items = d.items; assignCodes(items); render();
      $('at-form-overlay').style.display = 'none';
      toast('Salvato ✓');
    } catch (e) { toast('Errore di rete'); }
  }

  window.atDelete = async function (id) {
    if (!confirm('Eliminare questo contenuto dalla libreria?')) return;
    try {
      const r = await fetch('/api/data?action=area-tecnica', { method:'POST', headers: authHeaders(true), body: JSON.stringify({ deleteId: id }) });
      const d = await r.json();
      if (d.success) { items = d.items; assignCodes(items); render(); toast('Eliminato ✓'); }
    } catch (e) { toast('Errore'); }
  };

  // ── Eventi ──
  $('at-add-btn').addEventListener('click', () => openForm(null));
  $('at-save-btn').addEventListener('click', save);
  ['at-filter-tipo', 'at-filter-cat'].forEach(id => $(id).addEventListener('change', render));
  $('at-search').addEventListener('input', render);
  [$('at-form-overlay'), $('at-player-overlay')].forEach(ov => ov.addEventListener('click', (e) => { if (e.target === ov) { if (ov.id === 'at-player-overlay') window.atClosePlayer(); else ov.style.display = 'none'; } }));

  load();
})();
