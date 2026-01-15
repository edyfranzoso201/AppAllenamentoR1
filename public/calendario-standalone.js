// calendario-standalone.js - versione PROTETTA (obbliga il token per i genitori)
(function () {
  const TRAINING = [
    { day: 1, time: "18:30-20:00" },
    { day: 3, time: "17:30-19:00" },
    { day: 5, time: "18:00-19:15" }
  ];

  const END = new Date("2026-06-30");

  let events = {};
  let athletes = [];

  // ✅ Token semplice: base64(athleteId)
  window.generateAthleteToken = function (athleteId) {
    return btoa(String(athleteId)).replace(/=/g, "");
  };

  // ✅ Decode del token
  window.decodePresenceToken = function (token) {
    try {
      const padded = token + "==";
      const decoded = atob(padded);
      return decoded;
    } catch (e) {
      return null;
    }
  };

  // 🔒 PROTEZIONE: Controlla se siamo in modalità genitore (con token)
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get("athlete");
  let currentAthleteId = null;

  if (tokenParam) {
    currentAthleteId = window.decodePresenceToken(tokenParam);
    if (!currentAthleteId) {
      // Token invalido: mostra errore e blocca
      document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("calendar").innerHTML = `
          <div class="alert alert-danger" style="margin-top: 20px;">
            <h4>Link non valido</h4>
            <p>Il link che hai usato non è corretto o è scaduto.</p>
            <p>Contatta il coach per ricevere un nuovo link.</p>
          </div>`;
      });
      return;
    }
  }

  async function load() {
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      const d = await r.json();
      events = d.calendarEvents || {};
      athletes = d.athletes || [];
      render();
    } catch (e) {
      document.getElementById("calendar").innerHTML =
        '<div class="alert alert-danger">Errore caricamento dati</div>';
    }
  }

  function render() {
    const el = document.getElementById("calendar");
    
    // 🔒 Se siamo in modalità genitore (token presente), mostra solo quella riga
    if (tokenParam) {
      renderGenitoreMode(el);
    } else {
      // Altrimenti modalità coach: mostra tutto
      renderCoachMode(el);
    }
  }

  function renderGenitoreMode(el) {
    const dates = Object.keys(events).sort();

    if (dates.length === 0) {
      el.innerHTML =
        '<div class="alert alert-info">Nessun evento futuro.</div>';
      return;
    }

    // Filtra solo l'atleta con il token
    let visibleAthletes = athletes.filter(a => !a.guest && String(a.id) === String(currentAthleteId));

    if (visibleAthletes.length === 0) {
      el.innerHTML = `
        <div class="alert alert-danger mt-3">
          <h4>Atleta non trovato</h4>
          <p>Il link non corrisponde a nessun atleta nel sistema.</p>
          <p>Contatta il coach per verificare il link.</p>
        </div>`;
      return;
    }

    const athlete = visibleAthletes[0];

    let h = "";
    h += '<div style="background:#e0f2fe; padding:15px; border-radius:8px; margin-bottom:20px; text-align:center;">';
    h += `<h3 style="color:#0369a1; margin:0;">📋 Calendario di ${athlete.name}</h3>`;
    h += '<p style="color:#0c4a6e; margin:5px 0 0 0;">Conferma la tua presenza per i prossimi eventi</p>';
    h += '</div>';

    h += '<div class="table-responsive">';
    h += '<table class="table table-bordered calendar-table">';
    h += "<thead>";

    h += "<tr>";
    h += '<th style="color:#000">Data</th>';
    h += '<th style="color:#000">Tipo</th>';
    h += '<th style="color:#000">Orario</th>';
    h += "</tr>";
    h += "</thead>";

    h += "<tbody>";
    dates.forEach(d => {
      const e = events[d];
      const dt = new Date(d);
      h += "<tr>";
      h += `<td style="color:#000">${dt.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>`;
      h += `<td style="color:#000">${e.type === "Partita" ? "🏆 Partita" : "⚽ Allenamento"}</td>`;
      h += `<td style="color:#000">${e.time}</td>`;
      h += "</tr>";
    });
    h += "</tbody>";
    h += "</table>";
    h += "</div>";

    h += `
      <div class="alert alert-warning mt-3">
        <strong>ℹ️ Importante</strong><br>
        Questo è il link personale di <strong>${athlete.name}</strong>.<br>
        Per compilare le presenze, torna alla pagina principale e clicca "Link Presenze" sulla riga dell'atleta.
      </div>
    `;

    el.innerHTML = h;
  }

  function renderCoachMode(el) {
    const dates = Object.keys(events).sort();

    if (dates.length === 0) {
      el.innerHTML =
        '<div class="alert alert-info">Nessun evento. Usa i pulsanti sopra.</div>';
      return;
    }

    let visibleAthletes = athletes.filter(a => !a.guest);

    let h = "";
    h += '<div class="table-responsive">';
    h += '<table class="table table-bordered calendar-table">';
    h += "<thead>";

    h += "<tr>";
    h += '<th style="color:#000">#</th>';
    h += '<th style="color:#000">Atleta</th>';
    h += '<th style="color:#000">Azioni</th>';
    dates.forEach(d => {
      const dt = new Date(d);
      h += `<th class="text-center" style="color:#000">
        ${dt.toLocaleDateString("it-IT", { weekday: "short" })}<br>
        ${dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
      </th>`;
    });
    h += "</tr>";

    h += "<tr>";
    h += '<th colspan="3" style="color:#000">Evento</th>';
    dates.forEach(d => {
      const e = events[d];
      h += `<th class="text-center" style="color:#000">
        <small>${e.type === "Partita" ? "🏆" : "⚽"} ${e.type}<br>${e.time}</small>
      </th>`;
    });
    h += "</tr>";
    h += "</thead>";

    h += "<tbody>";

    visibleAthletes.forEach((a, i) => {
      h += "<tr>";
      h += `<td style="color:#000">${i + 1}</td>`;
      h += `<td style="color:#000">${a.name}</td>`;

      h += '<td class="text-center">';
      h += `<button class="btn btn-sm btn-primary" onclick="window.generatePresenceLink(${a.id}, '${a.name.replace(/'/g, "\\'")}')">`;
      h += '<i class="bi bi-link-45deg"></i> Link Presenze';
      h += "</button>";
      h += "</td>";

      dates.forEach(() => {
        h += '<td class="text-center" style="color:#000">-</td>';
      });

      h += "</tr>";
    });

    h += "</tbody>";
    h += "</table>";
    h += "</div>";

    h += `
      <div class="alert alert-info mt-3">
        <strong><i class="bi bi-info-circle"></i> Come funziona</strong><br>
        Clicca "Link Presenze" per generare il link personale dell'atleta.<br>
        Invia il link al genitore: vedrà solo la conferma presenze per suo figlio.
      </div>
    `;

    el.innerHTML = h;
  }

  // Genera link per atleta (SOLO modo coach)
  window.generatePresenceLink = function (athleteId, athleteName) {
    const token = window.generateAthleteToken(athleteId);
    const link = window.location.origin +
      "/calendario.html?athlete=" + encodeURIComponent(token);

    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top:0; left:0; right:0; bottom:0;
      background: rgba(0,0,0,0.5);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:9999;
    `;
    modal.innerHTML = `
      <div style="
        background:white;
        padding:30px;
        border-radius:15px;
        max-width:600px;
        width:90%;
      ">
        <h3 style="margin:0 0 20px 0; color:#2563eb;">Link Conferma Presenze</h3>
        <p style="margin-bottom:15px;">
          <strong>Atleta:</strong> ${athleteName}
        </p>
        <div style="
          background:#f1f5f9;
          padding:15px;
          border-radius:8px;
          margin-bottom:20px;
          word-break:break-all;
          font-family:monospace;
          font-size:14px;
        ">
          ${link}
        </div>
        <div style="display:flex; gap:10px;">
          <button
            onclick="navigator.clipboard.writeText('${link}').then(() => alert('Link copiato!')).catch(() => alert('Errore nella copia'))"
            style="
              flex:1;
              background:#10b981;
              color:white;
              border:none;
              padding:12px;
              border-radius:8px;
              cursor:pointer;
              font-weight:600;
            ">
            Copia Link
          </button>
          <button
            onclick="this.parentElement.parentElement.parentElement.remove()"
            style="
              flex:1;
              background:#64748b;
              color:white;
              border:none;
              padding:12px;
              border-radius:8px;
              cursor:pointer;
              font-weight:600;
            ">
            Chiudi
          </button>
        </div>
        <div style="
          margin-top:20px;
          padding:15px;
          background:#e0f2fe;
          border-radius:8px;
          font-size:14px;
          color:#0c4a6e;
        ">
          <strong>Invia questo link al genitore via:</strong><br>
          WhatsApp, Email o SMS.<br><br>
          Il genitore vedrà <strong>solo la riga di ${athleteName}</strong> nel calendario.
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  };

  // Funzioni gestione eventi calendario (genTraining, impMatches, addEvent, deleteOld)
  async function genTraining() {
    const btn = document.getElementById("generate-btn");
    const old = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Generazione...';

      const ev = {};
      const td = new Date();
      td.setHours(0, 0, 0, 0);
      let cd = new Date(td);

      while (cd <= END) {
        const dw = cd.getDay();
        const tr = TRAINING.find(t => t.day === dw);
        if (tr) {
          const dk = cd.toISOString().split("T")[0];
          if (!events[dk]) {
            ev[dk] = {
              type: "Allenamento",
              time: tr.time,
              notes: "Allenamento settimanale",
              createdAt: new Date().toISOString()
            };
          }
        }
        cd.setDate(cd.getDate() + 1);
      }

      if (Object.keys(ev).length === 0) {
        alert("Tutti gli allenamenti sono già creati!");
        btn.innerHTML = old;
        btn.disabled = false;
        return;
      }

      const r = await fetch("/api/data", { cache: "no-store" });
      const ad = await r.json();
      ad.calendarEvents = ad.calendarEvents || {};
      Object.assign(ad.calendarEvents, ev);

      await fetch("/api/data", {
