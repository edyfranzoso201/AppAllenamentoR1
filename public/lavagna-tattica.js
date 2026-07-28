(function () {
  'use strict';

  // Sistema di coordinate logico: x 0-100 (larghezza campo), y 0-100 (0 = linea di
  // centrocampo in alto, 100 = linea di porta in basso, dove il campo è più largo).
  // Costanti ricalibrate (2026-07-28) per allinearsi al trapezio reale dell'immagine
  // di sfondo campo_Trasp.PNG (misurato via analisi pixel: widthFrac 0.65 in alto ->
  // 0.99 in basso, fit quasi lineare INSET=0.34/CURVE=0.99).
  const PERSPECTIVE_TOP_INSET = 0.34; // quanto si restringe la larghezza in alto (0-1)
  const PERSPECTIVE_Y_CURVE = 0.99;   // <1 comprime le linee lontane verso l'alto
  // Frazione della larghezza canvas occupata dal trapezio nell'immagine a y=100 (misurata
  // su campo_Trasp.PNG: il trapezio non tocca i bordi del canvas nemmeno alla base).
  const FIELD_IMAGE_WIDTH_FRAC = 0.991;

  function perspective(x, y, w, h) {
    const yNorm = y / 100;
    const yCurved = Math.pow(yNorm, PERSPECTIVE_Y_CURVE);
    const py = yCurved * h;
    const widthScale = (1 - PERSPECTIVE_TOP_INSET) + PERSPECTIVE_TOP_INSET * yCurved;
    const centerOffset = (50 - x) * widthScale * FIELD_IMAGE_WIDTH_FRAC;
    const px = w / 2 - centerOffset * (w / 100);
    return { px, py };
  }

  function inversePerspective(px, py, w, h) {
    const yCurved = Math.max(0, Math.min(1, py / h));
    const yNorm = Math.pow(yCurved, 1 / PERSPECTIVE_Y_CURVE);
    const y = yNorm * 100;
    const widthScale = (1 - PERSPECTIVE_TOP_INSET) + PERSPECTIVE_TOP_INSET * yCurved;
    const centerOffset = (w / 2 - px) / (w / 100) / widthScale / FIELD_IMAGE_WIDTH_FRAC;
    const x = 50 - centerOffset;
    return { x, y };
  }

  function polyPath(ctx, points) {
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    });
    ctx.closePath();
  }

  // Immagine di sfondo del campo (fotografia/render con trasparenza fuori dal trapezio).
  // Precaricata una sola volta a livello di modulo; drawField la disegna quando è pronta,
  // altrimenti ricade sul disegno vettoriale (drawFieldVector) così il canvas non resta mai vuoto.
  const fieldImage = new Image();
  let fieldImageReady = false;
  let onFieldImageReady = null; // callback opzionale impostata da initUI per un redraw immediato
  fieldImage.onload = function () {
    fieldImageReady = true;
    if (typeof onFieldImageReady === 'function') onFieldImageReady();
  };
  fieldImage.onerror = function () {
    console.warn('Lavagna Tattica: impossibile caricare campo_Trasp.PNG, uso il disegno vettoriale come fallback.');
  };
  fieldImage.src = 'campo_Trasp.PNG';

  function drawField(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    if (fieldImageReady) {
      ctx.drawImage(fieldImage, 0, 0, w, h);
      return;
    }
    drawFieldVector(ctx, w, h);
  }

  function drawFieldVector(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);

    // --- Sfondo a strisce orizzontali alternate ---
    const BANDS = 10;
    for (let i = 0; i < BANDS; i++) {
      const y0 = (i / BANDS) * 100;
      const y1 = ((i + 1) / BANDS) * 100;
      const p1 = perspective(0, y0, w, h);
      const p2 = perspective(100, y0, w, h);
      const p3 = perspective(100, y1, w, h);
      const p4 = perspective(0, y1, w, h);
      polyPath(ctx, [p1, p2, p3, p4]);
      ctx.fillStyle = i % 2 === 0 ? '#1e7d34' : '#238a3c';
      ctx.fill();
    }

    // --- Linee bianche del campo ---
    ctx.save();
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    // Contorno mezzo campo: sinistra, destra, centrocampo (alto), linea di porta (basso)
    const corners = [
      perspective(0, 0, w, h),
      perspective(100, 0, w, h),
      perspective(100, 100, w, h),
      perspective(0, 100, w, h)
    ];
    ctx.beginPath();
    ctx.moveTo(corners[0].px, corners[0].py);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].px, corners[i].py);
    ctx.closePath();
    ctx.stroke();

    // Semicerchio di centrocampo (disegnato come poligono approssimato con perspective)
    {
      const centerX = 50, centerY = 0, radius = 9.15;
      ctx.beginPath();
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const angle = Math.PI * (i / steps); // 0 -> PI, semicerchio verso il basso
        const x = centerX + radius * Math.sin(angle);
        const y = centerY + radius * (1 - Math.cos(angle));
        const p = perspective(x, y, w, h);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.stroke();
    }

    // Area di rigore (grande): x 21-79, y 100-75.74
    // y della linea d'area derivata dalle proporzioni reali di un campo 105x68m (area grande
    // a 16.5m dalla linea di porta) usando la stessa scala logica del resto del disegno
    // (100 unità ≈ 68m, coerente con la larghezza campo su x e con l'area 21-79 già presente):
    // y = 100 - 16.5/0.68 ≈ 75.74. Questo mantiene il cerchio di raggio 9.15 (= cerchio di
    // centrocampo, stessa unità) geometricamente in grado di intersecare la linea d'area,
    // come nel calcio reale (vedi arco del rigore più sotto).
    {
      const pts = [
        perspective(21, 75.74, w, h),
        perspective(79, 75.74, w, h),
        perspective(79, 100, w, h),
        perspective(21, 100, w, h)
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0].px, pts[0].py);
      ctx.lineTo(pts[1].px, pts[1].py);
      ctx.lineTo(pts[2].px, pts[2].py);
      ctx.lineTo(pts[3].px, pts[3].py);
      ctx.stroke();
    }

    // Area piccola: x 36.8-63.2, y 100-94
    {
      const pts = [
        perspective(36.8, 94, w, h),
        perspective(63.2, 94, w, h),
        perspective(63.2, 100, w, h),
        perspective(36.8, 100, w, h)
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0].px, pts[0].py);
      ctx.lineTo(pts[1].px, pts[1].py);
      ctx.lineTo(pts[2].px, pts[2].py);
      ctx.lineTo(pts[3].px, pts[3].py);
      ctx.stroke();
    }

    // Dischetto del rigore: punto pieno a (50, 83.82)
    // y derivato dalle proporzioni reali (dischetto a 11m dalla linea di porta, stessa scala
    // logica ~0.68 m/unità di cui sopra): y = 100 - 11/0.68 ≈ 83.82.
    {
      const p = perspective(50, 83.82, w, h);
      const rp = perspective(51.2, 83.82, w, h); // riferimento per stimare un raggio in pixel coerente
      const radius = Math.max(2, Math.hypot(rp.px - p.px, rp.py - p.py));
      ctx.beginPath();
      ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f5f5f5';
      ctx.fill();
    }

    // Arco del rigore ("la D"): porzione del cerchio di raggio 9.15 centrato sul dischetto
    // (50, 83.82) che sta fuori dal rettangolo dell'area di rigore grande (x 21-79, y 75.74-100).
    // Calcolo analitico in coordinate LOGICHE (non pixel): intersezione fra il cerchio e la retta
    // y = boxEdgeY (il lato dell'area rivolto verso il centrocampo). Il centro del cerchio è più
    // vicino alla porta rispetto a boxEdgeY, quindi l'arco "fuori area" è quello superiore
    // (verso y minori). Gestiamo esplicitamente anche il caso degenere in cui il cerchio non
    // raggiunge la linea dell'area (nessun arco fuori area) o la contiene interamente.
    {
      const centerX = 50, centerY = 83.82, radius = 9.15;
      const boxEdgeY = 75.74;
      const boxX1 = 21, boxX2 = 79;
      const distToEdge = centerY - boxEdgeY; // distanza (positiva) fra dischetto e linea area

      if (distToEdge >= radius) {
        // Il cerchio intero sta dentro l'area (non la raggiunge nemmeno): nessun arco onesto da
        // disegnare fuori area. Non disegniamo nulla di fittizio.
      } else {
        // cos(a) = distToEdge / radius, con a angolo rispetto alla verticale (asse y verso l'alto)
        // al quale il cerchio interseca la retta y = boxEdgeY (dato che y = centerY - radius*cos(theta),
        // vedi calcolo di x/y nel loop sotto).
        const halfSpan = Math.acos(distToEdge / radius); // in [0, PI/2)
        // Verifichiamo anche i limiti laterali dell'area (x = boxX1..boxX2): se l'intersezione
        // cade oltre i bordi laterali, l'arco va comunque disegnato per intero verso il centrocampo
        // (il dischetto è centrato in x=50, a metà strada fra 21 e 79: con raggio 9.15 il punto più
        // laterale dell'arco, x = 50 ± 9.15*sin(halfSpan), resta ampiamente dentro [21,79], quindi
        // qui i bordi laterali non tagliano ulteriormente l'arco).
        ctx.beginPath();
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const t = -1 + (2 * i) / steps; // -1..1
          const theta = t * halfSpan; // -halfSpan..halfSpan attorno alla verticale verso l'alto
          const x = centerX + radius * Math.sin(theta);
          const y = centerY - radius * Math.cos(theta);
          const clampedX = Math.max(boxX1, Math.min(boxX2, x));
          const p = perspective(clampedX, y, w, h);
          if (i === 0) ctx.moveTo(p.px, p.py);
          else ctx.lineTo(p.px, p.py);
        }
        ctx.stroke();
      }
    }

    ctx.restore();

    // --- Porta stilizzata centrata su x=50, y=100 ---
    {
      const goalHalfWidth = 7.32 / 2; // larghezza porta in unità logiche coerenti col campo (~7.3 su 100)
      const goalX1 = 50 - goalHalfWidth;
      const goalX2 = 50 + goalHalfWidth;

      const baseL = perspective(goalX1, 100, w, h);
      const baseR = perspective(goalX2, 100, w, h);

      // Calcoliamo l'altezza dei pali in pixel come frazione della larghezza porta a schermo
      const goalWidthPx = Math.abs(baseR.px - baseL.px);
      const postH = Math.max(18, goalWidthPx * 0.32);

      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';

      const postTopL = { px: baseL.px, py: baseL.py - postH };
      const postTopR = { px: baseR.px, py: baseR.py - postH };

      // Pali verticali
      ctx.beginPath();
      ctx.moveTo(baseL.px, baseL.py);
      ctx.lineTo(postTopL.px, postTopL.py);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(baseR.px, baseR.py);
      ctx.lineTo(postTopR.px, postTopR.py);
      ctx.stroke();

      // Traversa
      ctx.beginPath();
      ctx.moveTo(postTopL.px, postTopL.py);
      ctx.lineTo(postTopR.px, postTopR.py);
      ctx.stroke();

      // Rete a griglia semplice (5 colonne x 3 righe), opacità ridotta
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      const cols = 5, rows = 3;
      for (let c = 0; c <= cols; c++) {
        const t = c / cols;
        const xTop = postTopL.px + (postTopR.px - postTopL.px) * t;
        const yTop = postTopL.py + (postTopR.py - postTopL.py) * t;
        const xBot = baseL.px + (baseR.px - baseL.px) * t;
        const yBot = baseL.py + (baseR.py - baseL.py) * t;
        ctx.beginPath();
        ctx.moveTo(xTop, yTop);
        ctx.lineTo(xBot, yBot);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        const xL = postTopL.px + (baseL.px - postTopL.px) * t;
        const yL = postTopL.py + (baseL.py - postTopL.py) * t;
        const xR = postTopR.px + (baseR.px - postTopR.px) * t;
        const yR = postTopR.py + (baseR.py - postTopR.py) * t;
        ctx.beginPath();
        ctx.moveTo(xL, yL);
        ctx.lineTo(xR, yR);
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();
    }
  }

  const state = {
    pedine: [],   // { id, tipo: 'blu'|'rosso'|'bianco', x, y, numero }
    pallone: null, // { x, y } | null
    frecce: [],   // { id, daX, daY, aX, aY }
  };

  const COLORI_PEDINA = { blu: '#2563eb', rosso: '#dc2626', bianco: '#f8fafc' };
  const TESTO_PEDINA = { blu: '#ffffff', rosso: '#ffffff', bianco: '#111827' };
  const RAGGIO_PEDINA = 16;

  function nextId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4).toString(36);
  }

  function drawPedina(ctx, p, w, h) {
    const { px, py } = perspective(p.x, p.y, w, h);
    ctx.beginPath();
    ctx.fillStyle = COLORI_PEDINA[p.tipo] || '#888';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.arc(px, py, RAGGIO_PEDINA, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (p.numero) {
      ctx.fillStyle = TESTO_PEDINA[p.tipo] || '#000';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.numero).slice(0, 3), px, py);
    }
  }

  function drawPallone(ctx, b, w, h) {
    const { px, py } = perspective(b.x, b.y, w, h);
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - 5, py - 2);
    ctx.lineTo(px + 5, py - 2);
    ctx.lineTo(px, py + 6);
    ctx.closePath();
    ctx.fillStyle = '#111827';
    ctx.fill();
  }

  function drawAll(ctx, w, h) {
    drawField(ctx, w, h);
    state.frecce.forEach(f => drawFreccia(ctx, f, w, h));
    state.pedine.forEach(p => drawPedina(ctx, p, w, h));
    if (state.pallone) drawPallone(ctx, state.pallone, w, h);
  }

  function drawFreccia(ctx, f, w, h) {
    const a = perspective(f.daX, f.daY, w, h);
    const b = perspective(f.aX, f.aY, w, h);
    ctx.strokeStyle = '#fbbf24';
    ctx.fillStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
    const angle = Math.atan2(b.py - a.py, b.px - a.px);
    const headLen = 12;
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.px - headLen * Math.cos(angle - Math.PI / 6), b.py - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(b.px - headLen * Math.cos(angle + Math.PI / 6), b.py - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function findPedinaAt(px, py, w, h) {
    for (let i = state.pedine.length - 1; i >= 0; i--) {
      const p = state.pedine[i];
      const { px: cx, py: cy } = perspective(p.x, p.y, w, h);
      if (Math.hypot(px - cx, py - cy) <= RAGGIO_PEDINA) return p;
    }
    return null;
  }

  function findFrecciaAt(px, py, w, h) {
    const TOLL = 8;
    for (let i = state.frecce.length - 1; i >= 0; i--) {
      const f = state.frecce[i];
      const a = perspective(f.daX, f.daY, w, h);
      const b = perspective(f.aX, f.aY, w, h);
      const distToSegment = pointToSegmentDistance(px, py, a.px, a.py, b.px, b.py);
      if (distToSegment <= TOLL) return f;
    }
    return null;
  }

  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx, projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  let dragTarget = null; // { kind: 'pedina'|'pallone', ref }
  let arrowDragFrom = null; // { x, y } in coordinate logiche, quando si trascina una freccia

  function attachInteraction(canvas, ctx, onChange) {
    function getCanvasPoint(evt) {
      const rect = canvas.getBoundingClientRect();
      const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      return { px: clientX - rect.left, py: clientY - rect.top };
    }

    function redraw() {
      drawAll(ctx, canvas.width, canvas.height);
    }

    function onDown(evt) {
      const { px, py } = getCanvasPoint(evt);
      const w = canvas.width, h = canvas.height;
      if (evt.button === 2 || evt.shiftKey) {
        // trascinamento con tasto destro / shift = disegna freccia da pedina esistente
        const pedina = findPedinaAt(px, py, w, h);
        if (pedina) {
          arrowDragFrom = { x: pedina.x, y: pedina.y };
          evt.preventDefault();
        }
        return;
      }
      const pedina = findPedinaAt(px, py, w, h);
      if (pedina) { dragTarget = { kind: 'pedina', ref: pedina }; return; }
      if (state.pallone) {
        const bp = perspective(state.pallone.x, state.pallone.y, w, h);
        if (Math.hypot(px - bp.px, py - bp.py) <= 12) { dragTarget = { kind: 'pallone', ref: state.pallone }; return; }
      }
      const freccia = findFrecciaAt(px, py, w, h);
      if (freccia) {
        state.frecce = state.frecce.filter(f => f.id !== freccia.id);
        redraw();
        if (onChange) onChange();
      }
    }

    function onMove(evt) {
      if (!dragTarget && !arrowDragFrom) return;
      const { px, py } = getCanvasPoint(evt);
      const w = canvas.width, h = canvas.height;
      const { x, y } = inversePerspective(px, py, w, h);
      if (dragTarget) {
        dragTarget.ref.x = Math.max(0, Math.min(100, x));
        dragTarget.ref.y = Math.max(0, Math.min(100, y));
        redraw();
      } else if (arrowDragFrom) {
        redraw();
        drawFreccia(ctx, { daX: arrowDragFrom.x, daY: arrowDragFrom.y, aX: x, aY: y }, w, h);
      }
    }

    function onUp(evt) {
      if (dragTarget) {
        dragTarget = null;
        if (onChange) onChange();
      }
      if (arrowDragFrom) {
        const { px, py } = getCanvasPoint(evt);
        const w = canvas.width, h = canvas.height;
        const { x, y } = inversePerspective(px, py, w, h);
        state.frecce.push({ id: nextId('fr'), daX: arrowDragFrom.x, daY: arrowDragFrom.y, aX: x, aY: y });
        arrowDragFrom = null;
        redraw();
        if (onChange) onChange();
      }
    }

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);
    canvas.addEventListener('contextmenu', evt => evt.preventDefault());
    canvas.addEventListener('dblclick', evt => {
      const { px, py } = getCanvasPoint(evt);
      const w = canvas.width, h = canvas.height;
      const pedina = findPedinaAt(px, py, w, h);
      if (pedina) {
        const nuovo = window.prompt('Numero maglia:', pedina.numero || '');
        if (nuovo !== null) {
          pedina.numero = nuovo.slice(0, 3);
          redraw();
          if (onChange) onChange();
        }
      }
    });

    redraw();
    return { redraw };
  }

  function nuovoSchema() {
    state.pedine = [];
    state.pallone = null;
    state.frecce = [];
  }

  function serializzaSchemaCorrente(nome, idEsistente) {
    return {
      id: idEsistente || nextId('tb'),
      nome: nome,
      pedine: state.pedine.map(p => ({ ...p })),
      pallone: state.pallone ? { ...state.pallone } : null,
      frecce: state.frecce.map(f => ({ ...f })),
      updatedAt: new Date().toISOString()
    };
  }

  function caricaSchema(schema) {
    state.pedine = (schema.pedine || []).map(p => ({ ...p }));
    state.pallone = schema.pallone ? { ...schema.pallone } : null;
    state.frecce = (schema.frecce || []).map(f => ({ ...f }));
  }

  function salvaSchemaInLista(lista, nome, idEsistente) {
    const schema = serializzaSchemaCorrente(nome, idEsistente);
    const idx = lista.findIndex(s => s.id === schema.id);
    if (idx >= 0) lista[idx] = schema; else lista.push(schema);
    return schema;
  }

  function rinominaSchemaInLista(lista, id, nuovoNome) {
    const schema = lista.find(s => s.id === id);
    if (schema) schema.nome = nuovoNome;
    return schema || null;
  }

  function eliminaSchemaDaLista(lista, id) {
    const idx = lista.findIndex(s => s.id === id);
    if (idx >= 0) lista.splice(idx, 1);
    return idx >= 0;
  }

  function initUI(root) {
    const canvas = root.querySelector('#lavagna-canvas');
    const selectSchemi = root.querySelector('#lavagna-select-schemi');
    let schemaCorrenteId = null;

    function getLista() {
      window.tacticalBoards = window.tacticalBoards || [];
      return window.tacticalBoards;
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function refreshSelect() {
      const lista = getLista();
      selectSchemi.innerHTML = '<option value="">-- nessuno schema --</option>' +
        lista.map(s => `<option value="${s.id}">${escapeHtml(s.nome)}</option>`).join('');
      selectSchemi.value = schemaCorrenteId || '';
    }

    // Protezione anti-doppia-inizializzazione: initUI può essere richiamata più volte sullo
    // stesso canvas (es. retry via setTimeout dopo il caricamento asincrono dei dati). Se è già
    // stata inizializzata, non ri-attacchiamo attachInteraction né i listener dei bottoni (che
    // altrimenti si accumulerebbero causando doppie push/onChange per ogni interazione): ci
    // limitiamo ad aggiornare la select con eventuali schemi nel frattempo caricati.
    if (canvas.dataset.lavagnaInitDone === 'true') {
      refreshSelect();
      return { refreshSelect };
    }
    canvas.dataset.lavagnaInitDone = 'true';

    const ctx = canvas.getContext('2d');

    const interaction = attachInteraction(canvas, ctx, () => interaction.redraw());

    // Se il primo redraw avviene prima che l'immagine di sfondo sia pronta (probabile, dato
    // il caricamento asincrono), ridisegna appena arriva così il campo non resta vettoriale.
    onFieldImageReady = () => interaction.redraw();
    if (fieldImageReady) interaction.redraw();

    root.querySelectorAll('[data-pedina-tool]').forEach(el => {
      el.addEventListener('click', () => {
        const tipo = el.getAttribute('data-pedina-tool');
        state.pedine.push({ id: nextId('pd'), tipo, x: 50, y: 50, numero: '' });
        interaction.redraw();
      });
    });

    const palloneBtn = root.querySelector('[data-pallone-tool]');
    if (palloneBtn) {
      palloneBtn.addEventListener('click', () => {
        state.pallone = { x: 50, y: 50 };
        interaction.redraw();
      });
    }

    root.querySelector('[data-azione="nuovo"]').addEventListener('click', () => {
      nuovoSchema();
      schemaCorrenteId = null;
      interaction.redraw();
      refreshSelect();
    });

    root.querySelector('[data-azione="salva"]').addEventListener('click', () => {
      const lista = getLista();
      const esistente = lista.find(s => s.id === schemaCorrenteId);
      const nome = window.prompt('Nome schema:', esistente ? esistente.nome : '');
      if (!nome) return;
      const schema = salvaSchemaInLista(lista, nome, schemaCorrenteId);
      schemaCorrenteId = schema.id;
      refreshSelect();
      if (window.saveData) window.saveData();
    });

    root.querySelector('[data-azione="rinomina"]').addEventListener('click', () => {
      if (!schemaCorrenteId) return;
      const lista = getLista();
      const esistente = lista.find(s => s.id === schemaCorrenteId);
      const nome = window.prompt('Nuovo nome:', esistente ? esistente.nome : '');
      if (!nome) return;
      rinominaSchemaInLista(lista, schemaCorrenteId, nome);
      refreshSelect();
      if (window.saveData) window.saveData();
    });

    root.querySelector('[data-azione="elimina"]').addEventListener('click', () => {
      if (!schemaCorrenteId) return;
      if (!window.confirm('Eliminare questo schema?')) return;
      eliminaSchemaDaLista(getLista(), schemaCorrenteId);
      schemaCorrenteId = null;
      nuovoSchema();
      interaction.redraw();
      refreshSelect();
      if (window.saveData) window.saveData();
    });

    selectSchemi.addEventListener('change', () => {
      const id = selectSchemi.value;
      if (!id) { nuovoSchema(); schemaCorrenteId = null; interaction.redraw(); return; }
      const schema = getLista().find(s => s.id === id);
      if (schema) {
        caricaSchema(schema);
        schemaCorrenteId = id;
        interaction.redraw();
      }
    });

    refreshSelect();

    return { refreshSelect };
  }

  window.LavagnaTattica = {
    perspective, inversePerspective, drawField, drawAll,
    state, nextId, findPedinaAt, findFrecciaAt, pointToSegmentDistance,
    attachInteraction, initUI,
    nuovoSchema, serializzaSchemaCorrente, caricaSchema,
    salvaSchemaInLista, rinominaSchemaInLista, eliminaSchemaDaLista
  };
})();
