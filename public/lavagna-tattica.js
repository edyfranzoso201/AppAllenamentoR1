(function () {
  'use strict';

  // Sistema di coordinate logico: x 0-100 (larghezza campo), y 0-100 (0 = linea di
  // centrocampo in alto, 100 = linea di porta in basso, dove il campo è più largo).
  // "currentSport" è in realtà una CHIAVE DI VARIANTE, non solo lo sport: per il calcio
  // esistono due varianti selezionabili (vedi sotto-selettore in index.html) — 'calcio'
  // (= 'Classico', DEFAULT, campo_Trasp.PNG con trapezio pronunciato, costanti ricalibrate
  // 2026-07-28) e 'calcio_nuovo' ('Nuovo', lavagna-calcio.png = "Calcio Prospettiva.jpg",
  // sostituita 2026-08-25, campo isometrico con trapezio simile alla variante Classica).
  // Basket e Volley hanno una sola variante ciascuno: foto reali in prospettiva
  // (lavagna-basket.png / lavagna-volley.png), sostituite al placeholder vettoriale
  // il 2026-08-25.
  let currentSport = 'calcio';

  const PERSPECTIVE_BY_SPORT = {
    // campo_Trasp.PNG: trapezio pronunciato (misurato via analisi pixel: widthFrac 0.65 in
    // alto -> 0.99 in basso, fit quasi lineare INSET=0.34/CURVE=0.99). Resta il DEFAULT.
    calcio:        { topInset: 0.34, yCurve: 0.99, widthFrac: 0.991 },
    // lavagna-calcio.png (sostituita 2026-08-25 con "Calcio Prospettiva.jpg", isometrica):
    // trapezio misurato via analisi pixel su centrocampo (y=87.5px, width=1350px) e linea di
    // porta (y=651px, width=1864px) su immagine 1951x718 -> INSET=0.34/FRAC=0.987, stesso
    // ordine di grandezza della variante Classica (fit quasi lineare, stesso yCurve).
    calcio_nuovo:  { topInset: 0.34, yCurve: 0.99, widthFrac: 0.987 },
    // lavagna-basket.png ("Basket Prospettiva.jpg", sostituito 2026-08-25): trapezio
    // misurato via analisi pixel su bordo campo in alto (y=42px, width=1236px) e in
    // basso (y=752px, width=1895px) su immagine 1926x792 -> INSET=0.3805/FRAC=1.0032.
    basket:        { topInset: 0.3805, yCurve: 0.99, widthFrac: 1.0032 },
    // lavagna-volley.png ("Pallavolo Prospettiva.jpg", sostituita di nuovo 2026-08-25 con
    // una versione che include la RETE, su richiesta esplicita dell'utente — niente più
    // ritaglio). Immagine intera 1905x1124: la rete occupa la fascia y=0..410px, il campo
    // di gioco la fascia y=410..1100px (yTopFrac=0.3648). Trapezio misurato SOLO sulla
    // fascia campo (bordo in alto y=410px width=1196px, in basso y=1100px width=1771px,
    // normalizzati sulla propria fascia, non sull'immagine intera) -> INSET=0.3247/
    // FRAC=0.9297. yTopFrac fa sì che le coordinate logiche 0-100 (pedine/frecce) restino
    // ancorate solo alla zona di gioco sotto la rete (vedi yTopFrac in perspective()).
    volley:        { topInset: 0.3247, yCurve: 0.99, widthFrac: 0.9297, yTopFrac: 0.3648 }
  };

  // Risoluzione interna del canvas per variante: la BASE deve rispecchiare il rapporto
  // d'aspetto reale dell'immagine di sfondo, altrimenti drawImage(img, 0, 0, w, h) la stira
  // fuori dal suo rapporto nativo e la prospettiva fotografata nell'immagine appare
  // deformata/appiattita (visto in produzione 2026-08-25: canvas 1100x722 su un'immagine
  // 1520x1400 schiacciava il campo rendendolo senza trapezio). Rapporti nativi: campo_Trasp.PNG
  // 2109x817 (1100x722), lavagna-calcio.png 1951x718 (1100x405), lavagna-basket.png 1926x792
  // (1100x452), lavagna-volley.png 1905x1124 (1100x649, immagine INTERA con rete inclusa).
  // Su richiesta esplicita dell'utente 2026-08-25 ("aumenta l'altezza in Y, il campo è troppo
  // schiacciato") l'altezza di calcio/basket/volley è stata poi aumentata del 20% oltre il
  // rapporto nativo: è uno STIRAMENTO VERTICALE VOLUTO (aumenta la profondità percepita),
  // diverso dal bug del 2026-08-25 sopra citato (lì lo stiramento era involontario/eccessivo
  // e appiattiva il trapezio anziché allungarlo).
  // Stesso giorno, richiesta successiva: anche calcio_nuovo (405 nativo) +20% -> 486, e un
  // ULTERIORE +20% sul basket già stirato (542 -> 650, +44% totale rispetto al nativo 452).
  // Stesso giorno, ultima richiesta: il Calcio Classico "andava bene anche prima" -> RIPORTATO
  // al rapporto nativo 722 (annullato il +20% solo per questa variante; Basket/Volley/Nuovo
  // restano con lo stiramento applicato).
  // Stesso giorno, richiesta successiva: ulteriore +20% AGGIUNTIVO sul solo Calcio Nuovo
  // (486 -> 583, +44% totale rispetto al nativo 405, stessa logica già usata per il Basket).
  // Stesso giorno, ultimo ritocco: +10% AGGIUNTIVO ancora sul Calcio Nuovo (583 -> 641).
  // Stesso giorno, richiesta successiva: -15% sul Volley (779 -> 662).
  const CANVAS_SIZE_BY_SPORT = {
    calcio:       { w: 1100, h: 722 },
    calcio_nuovo: { w: 1100, h: 641 },
    basket:       { w: 1100, h: 650 },
    volley:       { w: 1100, h: 662 }
  };

  function getPerspectiveParams() {
    return PERSPECTIVE_BY_SPORT[currentSport] || PERSPECTIVE_BY_SPORT.calcio;
  }

  function perspective(x, y, w, h) {
    const { topInset, yCurve, widthFrac, yTopFrac } = getPerspectiveParams();
    // yTopFrac (default 0): frazione dell'altezza immagine PRIMA dell'inizio del campo di
    // gioco (es. la rete del volley). py=0..h resta la mappa dell'intera immagine di sfondo,
    // ma il campo logico (y=0..100) occupa solo la fascia yTopFrac*h..h — vedi 'volley'.
    const top = (yTopFrac || 0) * h;
    const yNorm = y / 100;
    const yCurved = Math.pow(yNorm, yCurve);
    const py = top + yCurved * (h - top);
    const widthScale = (1 - topInset) + topInset * yCurved;
    const centerOffset = (50 - x) * widthScale * widthFrac;
    const px = w / 2 - centerOffset * (w / 100);
    return { px, py };
  }

  function inversePerspective(px, py, w, h) {
    const { topInset, yCurve, widthFrac, yTopFrac } = getPerspectiveParams();
    const top = (yTopFrac || 0) * h;
    const yCurved = Math.max(0, Math.min(1, (py - top) / (h - top)));
    const yNorm = Math.pow(yCurved, 1 / yCurve);
    const y = yNorm * 100;
    const widthScale = (1 - topInset) + topInset * yCurved;
    const centerOffset = (w / 2 - px) / (w / 100) / widthScale / widthFrac;
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
  // Una immagine per variante, precaricata on-demand quando si passa a quella variante (vedi
  // setSport). drawField disegna l'immagine della variante corrente quando è pronta,
  // altrimenti ricade sul disegno vettoriale (drawFieldVector*) così il canvas non
  // resta mai vuoto (fallback usato solo nel breve istante di caricamento immagine).
  const FIELD_IMAGE_SRC = {
    calcio: 'campo_Trasp.PNG',         // Classico, DEFAULT
    calcio_nuovo: 'lavagna-calcio.png', // Nuovo, richiamabile dal sotto-selettore
    basket: 'lavagna-basket.png',       // "Basket Prospettiva.jpg", sostituito 2026-08-25
    volley: 'lavagna-volley.png'        // "Pallavolo Prospettiva.jpg", sostituito 2026-08-25
  };

  const fieldImages = {}; // variante -> { img: Image, ready: bool }
  let onFieldImageReady = null; // callback opzionale impostata da initUI per un redraw immediato

  function preloadFieldImage(sport) {
    if (fieldImages[sport] || !FIELD_IMAGE_SRC[sport]) return;
    const entry = { img: new Image(), ready: false };
    entry.img.onload = function () {
      entry.ready = true;
      if (typeof onFieldImageReady === 'function') onFieldImageReady();
    };
    entry.img.onerror = function () {
      console.warn('Lavagna Tattica: impossibile caricare ' + FIELD_IMAGE_SRC[sport] + ', uso il disegno vettoriale come fallback.');
    };
    entry.img.src = FIELD_IMAGE_SRC[sport];
    fieldImages[sport] = entry;
  }
  preloadFieldImage('calcio');

  function setSport(sport) {
    if (!PERSPECTIVE_BY_SPORT[sport]) return;
    currentSport = sport;
    preloadFieldImage(sport);
  }

  function drawField(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    const entry = fieldImages[currentSport];
    if (entry && entry.ready) {
      ctx.drawImage(entry.img, 0, 0, w, h);
      return;
    }
    drawFieldVector(ctx, w, h);
  }

  function drawFieldVector(ctx, w, h) {
    if (currentSport === 'basket') { drawFieldVectorBasket(ctx, w, h); return; }
    if (currentSport === 'volley') { drawFieldVectorVolley(ctx, w, h); return; }
    // 'calcio' e 'calcio_nuovo' condividono lo stesso fallback vettoriale (nessun disegno
    // vettoriale dedicato per la variante 'Nuovo': se la sua immagine non è ancora pronta,
    // si vede temporaneamente il campo vettoriale classico, comunque coerente per sport).
    drawFieldVectorCalcio(ctx, w, h);
  }

  // Campo da basket (mezzo campo, vista dall'alto): placeholder vettoriale in attesa
  // dell'immagine reale (vedi FIELD_IMAGE_SRC). Nessuna prospettiva (topInset 0).
  function drawFieldVectorBasket(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    const corners = [perspective(0, 0, w, h), perspective(100, 0, w, h), perspective(100, 100, w, h), perspective(0, 100, w, h)];
    ctx.beginPath();
    ctx.moveTo(corners[0].px, corners[0].py);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].px, corners[i].py);
    ctx.closePath();
    ctx.stroke();

    // Cerchio di centrocampo
    {
      const c = perspective(50, 0, w, h);
      const r = perspective(50 + 12, 0, w, h);
      const radius = Math.hypot(r.px - c.px, r.py - c.py);
      ctx.beginPath();
      ctx.arc(c.px, c.py, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Area (pitturato) sotto canestro: rettangolo x 30.5-69.5, y 100-81.7 + tiro libero
    {
      const pts = [perspective(30.5, 81.7, w, h), perspective(69.5, 81.7, w, h), perspective(69.5, 100, w, h), perspective(30.5, 100, w, h)];
      polyPath(ctx, pts);
      ctx.stroke();
    }
    {
      const c = perspective(50, 81.7, w, h);
      const r = perspective(50 + 9, 81.7, w, h);
      const radius = Math.hypot(r.px - c.px, r.py - c.py);
      ctx.beginPath();
      ctx.arc(c.px, c.py, radius, Math.PI, Math.PI * 2);
      ctx.stroke();
    }

    // Linea del tiro da 3 punti (arco semplificato)
    {
      const centerX = 50, centerY = 100, radius = 45;
      ctx.beginPath();
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const angle = Math.PI * (i / steps);
        const x = centerX - radius * Math.cos(angle);
        const y = centerY - radius * Math.sin(angle);
        const p = perspective(Math.max(2, Math.min(98, x)), Math.max(0, y), w, h);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.stroke();
    }

    // Canestro stilizzato
    {
      const p = perspective(50, 100, w, h);
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(p.px, p.py - 10, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Campo da pallavolo (mezzo campo, vista dall'alto): placeholder vettoriale in attesa
  // dell'immagine reale (vedi FIELD_IMAGE_SRC). Nessuna prospettiva (topInset 0).
  function drawFieldVectorVolley(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.strokeStyle = '#dbeafe';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    const corners = [perspective(0, 0, w, h), perspective(100, 0, w, h), perspective(100, 100, w, h), perspective(0, 100, w, h)];
    ctx.beginPath();
    ctx.moveTo(corners[0].px, corners[0].py);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].px, corners[i].py);
    ctx.closePath();
    ctx.stroke();

    // Linea dei 3 metri (zona d'attacco): a 1/3 dal fondo verso il centro rete
    {
      const p1 = perspective(0, 66.7, w, h);
      const p2 = perspective(100, 66.7, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }

    // Rete a bordo campo (y=0, lato centrocampo)
    {
      const p1 = perspective(0, 0, w, h);
      const p2 = perspective(100, 0, w, h);
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fef9c3';
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawFieldVectorCalcio(ctx, w, h) {
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

  const COLORI_PEDINA = { blu: '#2563eb', rosso: '#dc2626', bianco: '#f8fafc', verde: '#16a34a', azzurro: '#38bdf8' };
  const TESTO_PEDINA = { blu: '#ffffff', rosso: '#ffffff', bianco: '#111827', verde: '#ffffff', azzurro: '#111827' };
  // NB: RAGGIO_PEDINA (24) e' piu' grande della tolleranza di hit-test del pallino di
  // controllo frecce (12, vedi findFrecciaControlAt): quando i due si sovrappongono su un
  // campo affollato, la correttezza dipende dall'ORDINE dei controlli in onDown, che testa
  // sempre prima findFrecciaControlAt. Non invertire quell'ordine senza motivo.
  const RAGGIO_PEDINA = 24;

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
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.numero).slice(0, 3), px, py);
    }
  }

  function drawPallone(ctx, b, w, h) {
    const { px, py } = perspective(b.x, b.y, w, h);
    const r = 12;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#111827';
    ctx.stroke();
    ctx.clip();

    // Pentagono centrale nero, tipico pattern del pallone da calcio
    ctx.fillStyle = '#111827';
    const drawPentagon = (cx, cy, radius, rotation) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = rotation + (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };
    drawPentagon(px, py, r * 0.42, 0);

    // Pentagoni/linee radiali attorno al centro per suggerire la cucitura
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x1 = px + (r * 0.42) * Math.cos(angle);
      const y1 = py + (r * 0.42) * Math.sin(angle);
      const x2 = px + r * Math.cos(angle);
      const y2 = py + r * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAll(ctx, w, h) {
    drawField(ctx, w, h);
    state.frecce.forEach(f => drawFreccia(ctx, f, w, h));
    // Pallino del punto di controllo disegnato sopra tutte le frecce (non per singola
    // freccia dentro drawFreccia) cosi' resta sempre visibile/scopribile anche quando
    // due frecce si sovrappongono.
    state.frecce.forEach(f => drawFrecciaControlHandle(ctx, f, w, h));
    state.pedine.forEach(p => drawPedina(ctx, p, w, h));
    if (state.pallone) drawPallone(ctx, state.pallone, w, h);
  }

  // Punto di controllo (in coordinate logiche) della curva quadratica di una freccia.
  // Le frecce salvate prima dell'introduzione della curva non hanno ctrlX/ctrlY: qui
  // calcoliamo il default (punto medio esatto, che rende la bezier indistinguibile da
  // una retta) cosi' non serve migrare i dati salvati negli schemi esistenti.
  function getFrecciaControlPoint(f) {
    if (typeof f.ctrlX === 'number' && typeof f.ctrlY === 'number') return { x: f.ctrlX, y: f.ctrlY };
    return { x: (f.daX + f.aX) / 2, y: (f.daY + f.aY) / 2 };
  }

  function drawFreccia(ctx, f, w, h) {
    const a = perspective(f.daX, f.daY, w, h);
    const b = perspective(f.aX, f.aY, w, h);
    const c = getFrecciaControlPoint(f);
    const cp = perspective(c.x, c.y, w, h);
    ctx.strokeStyle = '#fbbf24';
    ctx.fillStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.quadraticCurveTo(cp.px, cp.py, b.px, b.py);
    ctx.stroke();
    // Tangente della bezier nel punto finale (derivata a t=1): punta verso B partendo
    // dalla direzione "punto di controllo -> B", non piu' dalla retta A->B.
    const angle = Math.atan2(b.py - cp.py, b.px - cp.px);
    const headLen = 12;
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.px - headLen * Math.cos(angle - Math.PI / 6), b.py - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(b.px - headLen * Math.cos(angle + Math.PI / 6), b.py - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  // Pallino trascinabile del punto di controllo: disegnato per OGNI freccia (vedi drawAll),
  // non solo su hover/selezione, cosi' la possibilita' di curvare resta sempre scopribile
  // anche senza passarci sopra col mouse.
  function drawFrecciaControlHandle(ctx, f, w, h) {
    const c = getFrecciaControlPoint(f);
    const p = perspective(c.x, c.y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.px, p.py, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#7c4a03';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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
      const c = getFrecciaControlPoint(f);
      const cp = perspective(c.x, c.y, w, h);
      const distToCurve = pointToQuadraticDistance(px, py, a.px, a.py, cp.px, cp.py, b.px, b.py);
      if (distToCurve <= TOLL) return f;
    }
    return null;
  }

  // Trova il punto di controllo (in pixel) di una freccia sotto il cursore, per iniziare
  // il trascinamento della curvatura. Distinto da findFrecciaAt: qui la tolleranza e'
  // centrata solo sul pallino del controllo, non sull'intera curva.
  function findFrecciaControlAt(px, py, w, h) {
    const TOLL = 12;
    for (let i = state.frecce.length - 1; i >= 0; i--) {
      const f = state.frecce[i];
      const c = getFrecciaControlPoint(f);
      const p = perspective(c.x, c.y, w, h);
      if (Math.hypot(px - p.px, py - p.py) <= TOLL) return f;
    }
    return null;
  }

  // Distanza approssimata punto-curva quadratica, campionando N punti sulla bezier e
  // prendendo il minimo tra le distanze punto-segmento dei sotto-segmenti risultanti.
  // Sufficiente per l'hit-testing (tolleranza 8px), non serve una soluzione analitica esatta.
  function pointToQuadraticDistance(px, py, x0, y0, cx, cy, x1, y1) {
    const STEPS = 16;
    let minDist = Infinity;
    let prevX = x0, prevY = y0;
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const mt = 1 - t;
      const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
      const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
      const d = pointToSegmentDistance(px, py, prevX, prevY, x, y);
      if (d < minDist) minDist = d;
      prevX = x; prevY = y;
    }
    return minDist;
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
    let modalitaFreccia = false;
    let onModalitaFrecciaChange = null;
    let modalitaGomma = false;
    let onModalitaGommaChange = null;

    function getCanvasPoint(evt) {
      const rect = canvas.getBoundingClientRect();
      const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      // Il canvas e' scalato via CSS (width:100%) rispetto alla sua risoluzione interna
      // (width/height attribute): senza questo fattore le coordinate calcolate sono errate
      // ogni volta che la card e' renderizzata a una larghezza diversa da quella interna.
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { px: (clientX - rect.left) * scaleX, py: (clientY - rect.top) * scaleY };
    }

    function redraw() {
      drawAll(ctx, canvas.width, canvas.height);
    }

    function onDown(evt) {
      const { px, py } = getCanvasPoint(evt);
      const w = canvas.width, h = canvas.height;
      if (modalitaGomma) {
        // Modalita gomma attiva: cancella UN SOLO elemento per click (priorita' pedina >
        // pallone > freccia/pallino di controllo), altrimenti un click su elementi sovrapposti
        // (es. pallone sopra una freccia) cancellerebbe piu' cose in un colpo solo.
        const pedina = findPedinaAt(px, py, w, h);
        if (pedina) {
          state.pedine = state.pedine.filter(p => p.id !== pedina.id);
          redraw();
          if (onChange) onChange();
          return;
        }
        if (state.pallone) {
          const bp = perspective(state.pallone.x, state.pallone.y, w, h);
          if (Math.hypot(px - bp.px, py - bp.py) <= 12) {
            state.pallone = null;
            redraw();
            if (onChange) onChange();
            return;
          }
        }
        const freccia = findFrecciaControlAt(px, py, w, h) || findFrecciaAt(px, py, w, h);
        if (freccia) {
          state.frecce = state.frecce.filter(f => f.id !== freccia.id);
        }
        redraw();
        if (onChange) onChange();
        return;
      }
      // Il pallino del punto di controllo ha priorita' assoluta su tutto il resto (arrow-mode,
      // shift/tasto destro): controllato per primo cosi' trascinare un pallino esistente per
      // curvare la freccia non viene mai reinterpretato come "click a vuoto" (che disarmerebbe
      // la modalita freccia).
      const frecciaControl = findFrecciaControlAt(px, py, w, h);
      if (frecciaControl) { dragTarget = { kind: 'frecciaControl', ref: frecciaControl }; return; }
      if (evt.button === 2 || evt.shiftKey || modalitaFreccia) {
        // tasto destro / shift / modalita freccia attiva = disegna freccia da pedina esistente
        const pedina = findPedinaAt(px, py, w, h);
        if (pedina) {
          arrowDragFrom = { x: pedina.x, y: pedina.y };
          evt.preventDefault();
          return;
        }
        if (modalitaFreccia && evt.button !== 2) {
          // Click (sinistro/touch) a vuoto mentre la modalita freccia e' attiva: disarma
          // invece di lasciarla attiva per sempre, cosi le altre interazioni (drag pallone,
          // drag pedina) restano disponibili senza dover ricliccare il bottone. Il tasto
          // destro resta escluso da questo fallthrough: serve solo a sopprimere il menu
          // contestuale, non deve anche trascinare sotto il cursore.
          setModalitaFreccia(false);
        } else {
          return;
        }
      }
      const pedina = findPedinaAt(px, py, w, h);
      if (pedina) { dragTarget = { kind: 'pedina', ref: pedina }; return; }
      if (state.pallone) {
        const bp = perspective(state.pallone.x, state.pallone.y, w, h);
        if (Math.hypot(px - bp.px, py - bp.py) <= 12) { dragTarget = { kind: 'pallone', ref: state.pallone }; return; }
      }
      // Nota: click su una freccia (fuori modalita gomma) non la cancella piu' - vedi gomma.
    }

    function onMove(evt) {
      if (!dragTarget && !arrowDragFrom) return;
      const { px, py } = getCanvasPoint(evt);
      const w = canvas.width, h = canvas.height;
      const { x, y } = inversePerspective(px, py, w, h);
      if (dragTarget && dragTarget.kind === 'frecciaControl') {
        dragTarget.ref.ctrlX = Math.max(0, Math.min(100, x));
        dragTarget.ref.ctrlY = Math.max(0, Math.min(100, y));
        redraw();
      } else if (dragTarget) {
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
        if (x !== arrowDragFrom.x || y !== arrowDragFrom.y) {
          state.frecce.push({ id: nextId('fr'), daX: arrowDragFrom.x, daY: arrowDragFrom.y, aX: x, aY: y });
        }
        arrowDragFrom = null;
        if (modalitaFreccia) setModalitaFreccia(false);
        redraw();
        if (onChange) onChange();
      }
    }

    function setModalitaFreccia(attiva) {
      modalitaFreccia = attiva;
      if (attiva && modalitaGomma) setModalitaGomma(false);
      if (onModalitaFrecciaChange) onModalitaFrecciaChange(modalitaFreccia);
    }

    function setModalitaGomma(attiva) {
      modalitaGomma = attiva;
      if (attiva && modalitaFreccia) setModalitaFreccia(false);
      if (onModalitaGommaChange) onModalitaGommaChange(modalitaGomma);
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
    return {
      redraw,
      toggleModalitaFreccia() {
        setModalitaFreccia(!modalitaFreccia);
        return modalitaFreccia;
      },
      onModalitaFrecciaChange(cb) { onModalitaFrecciaChange = cb; },
      toggleModalitaGomma() {
        setModalitaGomma(!modalitaGomma);
        return modalitaGomma;
      },
      onModalitaGommaChange(cb) { onModalitaGommaChange = cb; }
    };
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

    // Applica la risoluzione interna del canvas corretta per lo sport corrente (vedi
    // CANVAS_SIZE_BY_SPORT) PRIMA di ogni redraw, altrimenti l'immagine di sfondo verrebbe
    // stirata fuori dal suo rapporto d'aspetto reale (visto in produzione 2026-08-25).
    function applicaCanvasSize(sport) {
      const size = CANVAS_SIZE_BY_SPORT[sport] || CANVAS_SIZE_BY_SPORT.calcio;
      if (canvas.width !== size.w) canvas.width = size.w;
      if (canvas.height !== size.h) canvas.height = size.h;
    }

    // Se lo sport era stato salvato in una sessione precedente, applichiamolo (con relativa
    // dimensione canvas) PRIMA del primo redraw, così non si vede mai un frame intermedio
    // con le proporzioni sbagliate.
    const sportSalvato = localStorage.getItem('lavagnaSport');
    if (sportSalvato && PERSPECTIVE_BY_SPORT[sportSalvato] && sportSalvato !== currentSport) {
      setSport(sportSalvato);
    }
    applicaCanvasSize(currentSport);

    const interaction = attachInteraction(canvas, ctx, () => interaction.redraw());

    // Se il primo redraw avviene prima che l'immagine di sfondo sia pronta (probabile, dato
    // il caricamento asincrono), ridisegna appena arriva così il campo non resta vettoriale.
    onFieldImageReady = () => interaction.redraw();
    const initialEntry = fieldImages[currentSport];
    if (initialEntry && initialEntry.ready) interaction.redraw();

    // Pulsanti Calcio/Basket/Volley: cambiano lo sport corrente (e quindi l'immagine di
    // sfondo + calibrazione prospettiva, vedi setSport) senza toccare pedine/frecce/pallone
    // già posizionati sullo schema in corso. Stesso schema colore pieno/outline usato per i
    // pulsanti analoghi in Modulo Formazione (vedi switchField in index.html).
    // NB: 'calcio' e 'calcio_nuovo' sono due VARIANTI dello stesso pulsante "⚽ Calcio" (vedi
    // sotto-selettore Classico/Nuovo gestito più sotto), non due pulsanti sport distinti: il
    // pulsante principale [data-lavagna-sport="calcio"] resta attivo per entrambe le varianti.
    const sportBtns = root.querySelectorAll('[data-lavagna-sport]');
    const SPORT_COLOR = { calcio: 'success', calcio_nuovo: 'success', basket: 'warning', volley: 'info' };
    // Il pulsante sport "principale" a cui appartiene una variante (serve per evidenziare
    // [data-lavagna-sport="calcio"] anche quando la variante attiva è 'calcio_nuovo').
    function pulsantePrincipale(sport) {
      return sport === 'calcio_nuovo' ? 'calcio' : sport;
    }
    function aggiornaSportBtns(sport) {
      const principale = pulsantePrincipale(sport);
      sportBtns.forEach(b => {
        const s = b.getAttribute('data-lavagna-sport');
        const color = SPORT_COLOR[s] || 'secondary';
        b.classList.toggle('active', s === principale);
        b.classList.toggle('btn-' + color, s === principale);
        b.classList.toggle('btn-outline-' + color, s !== principale);
      });
    }
    function applicaSport(sport) {
      setSport(sport);
      aggiornaSportBtns(sport);
      aggiornaVarianteBtns(sport);
      applicaCanvasSize(sport);
      interaction.redraw();
      localStorage.setItem('lavagnaSport', sport);
    }
    sportBtns.forEach(el => {
      el.addEventListener('click', () => {
        const sportCliccato = el.getAttribute('data-lavagna-sport');
        // Cliccando "⚽ Calcio" mentre si è già sul Calcio si mantiene la variante attiva
        // (Classico o Nuovo) invece di forzare sempre 'calcio' (Classico).
        const sport = (sportCliccato === 'calcio' && pulsantePrincipale(currentSport) === 'calcio')
          ? currentSport
          : sportCliccato;
        applicaSport(sport);
      });
    });
    aggiornaSportBtns(currentSport);

    // Sotto-selettore Classico/Nuovo: visibile solo quando lo sport principale attivo è il
    // Calcio. "Classico" = campo_Trasp.PNG (default, prospettiva pronunciata), "Nuovo" =
    // lavagna-calcio.png (aggiunta 2026-08-25, campo quasi rettangolare). Vedi FIELD_IMAGE_SRC.
    const varianteWrap = root.querySelector('[data-lavagna-variante-wrap]');
    const varianteBtns = root.querySelectorAll('[data-lavagna-variante]');
    function aggiornaVarianteBtns(sport) {
      if (!varianteWrap) return;
      varianteWrap.classList.toggle('d-none', pulsantePrincipale(sport) !== 'calcio');
      varianteBtns.forEach(b => {
        const v = b.getAttribute('data-lavagna-variante');
        b.classList.toggle('active', v === sport);
        b.classList.toggle('btn-secondary', v === sport);
        b.classList.toggle('btn-outline-secondary', v !== sport);
      });
    }
    varianteBtns.forEach(el => {
      el.addEventListener('click', () => {
        const variante = el.getAttribute('data-lavagna-variante');
        applicaSport(variante);
      });
    });
    aggiornaVarianteBtns(currentSport);

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

    const frecciaBtn = root.querySelector('[data-freccia-tool]');
    const gommaBtn = root.querySelector('[data-gomma-tool]');

    // onModalitaFrecciaChange/onModalitaGommaChange accettano UN solo listener ciascuna (non
    // una lista): registriamo qui un unico callback per modalita' che aggiorna entrambi i
    // bottoni, cosi' la mutua esclusione freccia<->gomma (vedi setModalitaFreccia/
    // setModalitaGomma in attachInteraction) si riflette sempre su entrambi senza che una
    // registrazione sovrascriva l'altra.
    if (frecciaBtn) {
      interaction.onModalitaFrecciaChange((attiva) => {
        frecciaBtn.classList.toggle('active', attiva);
        frecciaBtn.classList.toggle('btn-outline-secondary', !attiva);
        frecciaBtn.classList.toggle('btn-warning', attiva);
        if (attiva && gommaBtn) gommaBtn.classList.remove('active', 'btn-danger');
        if (attiva && gommaBtn) gommaBtn.classList.add('btn-outline-secondary');
      });
      frecciaBtn.addEventListener('click', () => { interaction.toggleModalitaFreccia(); });
    }

    if (gommaBtn) {
      interaction.onModalitaGommaChange((attiva) => {
        gommaBtn.classList.toggle('active', attiva);
        gommaBtn.classList.toggle('btn-outline-secondary', !attiva);
        gommaBtn.classList.toggle('btn-danger', attiva);
        if (attiva && frecciaBtn) frecciaBtn.classList.remove('active', 'btn-warning');
        if (attiva && frecciaBtn) frecciaBtn.classList.add('btn-outline-secondary');
      });
      gommaBtn.addEventListener('click', () => { interaction.toggleModalitaGomma(); });
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
    attachInteraction, initUI, setSport,
    nuovoSchema, serializzaSchemaCorrente, caricaSchema,
    salvaSchemaInLista, rinominaSchemaInLista, eliminaSchemaDaLista
  };
})();
