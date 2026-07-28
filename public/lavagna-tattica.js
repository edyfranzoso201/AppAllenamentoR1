(function () {
  'use strict';

  // Sistema di coordinate logico: x 0-100 (larghezza campo), y 0-100 (0 = linea di
  // centrocampo in alto, 100 = linea di porta in basso, dove il campo è più largo).
  const PERSPECTIVE_TOP_INSET = 0.22; // quanto si restringe la larghezza in alto (0-1)
  const PERSPECTIVE_Y_CURVE = 0.72;   // <1 comprime le linee lontane verso l'alto

  function perspective(x, y, w, h) {
    const yNorm = y / 100;
    const yCurved = Math.pow(yNorm, PERSPECTIVE_Y_CURVE);
    const py = yCurved * h;
    const widthScale = (1 - PERSPECTIVE_TOP_INSET) + PERSPECTIVE_TOP_INSET * yCurved;
    const centerOffset = (50 - x) * widthScale;
    const px = w / 2 - centerOffset * (w / 100);
    return { px, py };
  }

  function inversePerspective(px, py, w, h) {
    const yCurved = Math.max(0, Math.min(1, py / h));
    const yNorm = Math.pow(yCurved, 1 / PERSPECTIVE_Y_CURVE);
    const y = yNorm * 100;
    const widthScale = (1 - PERSPECTIVE_TOP_INSET) + PERSPECTIVE_TOP_INSET * yCurved;
    const centerOffset = (w / 2 - px) / (w / 100) / widthScale;
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

  function drawField(ctx, w, h) {
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

    // Area di rigore (grande): x 21-79, y 100-78
    {
      const pts = [
        perspective(21, 78, w, h),
        perspective(79, 78, w, h),
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

    // Dischetto del rigore: punto pieno a (50, 89)
    {
      const p = perspective(50, 89, w, h);
      const rp = perspective(51.2, 89, w, h); // riferimento per stimare un raggio in pixel coerente
      const radius = Math.max(2, Math.hypot(rp.px - p.px, rp.py - p.py));
      ctx.beginPath();
      ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f5f5f5';
      ctx.fill();
    }

    // Arco del rigore (la parte del cerchio attorno al dischetto che sporge fuori
    // dall'area di rigore, oltre la linea y=78)
    {
      const centerX = 50, centerY = 89, radius = 9.15;
      const boxEdgeY = 78;
      // Angolo (misurato da 0 = destra, in senso orario verso l'alto) al quale il
      // cerchio interseca la linea y = boxEdgeY: sin(a) = (boxEdgeY - centerY) / radius
      const sinLimit = (boxEdgeY - centerY) / radius; // negativo: il cerchio sale sopra centerY
      const clamped = Math.max(-1, Math.min(1, sinLimit));
      const halfSpan = Math.asin(clamped); // angolo (negativo) rispetto all'orizzontale
      // L'arco visibile va da (PI/2 + halfSpan) a (PI/2 - halfSpan) passando per il top (PI/2 fisso qui è "in alto")
      // Usiamo un parametro theta che va da -halfSpan a +halfSpan attorno alla verticale verso l'alto.
      ctx.beginPath();
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = -1 + (2 * i) / steps; // -1..1
        const theta = t * (-halfSpan); // -halfSpan..halfSpan (halfSpan è negativo, quindi range corretto)
        const x = centerX + radius * Math.sin(theta);
        const y = centerY - radius * Math.cos(theta);
        const p = perspective(x, y, w, h);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.stroke();
    }

    ctx.restore();

    // --- Porta stilizzata centrata su x=50, y=100 ---
    {
      const goalHalfWidth = 7.32 / 2; // larghezza porta in unità logiche coerenti col campo (~7.3 su 100)
      const goalX1 = 50 - goalHalfWidth;
      const goalX2 = 50 + goalHalfWidth;
      const goalDepth = 4; // profondità visiva della porta oltre la linea di porta (y>100)

      const baseL = perspective(goalX1, 100, w, h);
      const baseR = perspective(goalX2, 100, w, h);
      const topL = perspective(goalX1, 100 + goalDepth, w, h);
      const topR = perspective(goalX2, 100 + goalDepth, w, h);
      // Nota: y>100 esce dalla curva prospettica "naturale"; usiamo una piccola estensione
      // lineare oltre h per dare l'idea di altezza dei pali sullo schermo.
      const postHeight = (baseL.py - topL.py) * 0 + (h - baseL.py) * 0; // placeholder non usato

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

  window.LavagnaTattica = { perspective, inversePerspective, drawField };
})();
