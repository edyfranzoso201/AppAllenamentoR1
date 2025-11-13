:root { --primary-blue: #0a2463; --secondary-blue: #1e5095; --primary-red: #d90429; --text-light: #ffffff; --card-bg: #1a3a7a; --border-color: #3b5a9d; --gold-star: #FFD700; --field-green: #008000; --field-line: #FFF; --gk-color: #E8C135; --custom-purple: #6f42c1; }
html { scroll-behavior: smooth; }
body { background-color: var(--primary-blue); color: var(--text-light); padding-top: 56px; }
.bg-dark-blue { background-color: #051438; border-bottom: 2px solid var(--primary-red); }
.main-title { color: var(--text-light); border-left: 4px solid var(--primary-red); padding-left: 1rem; }
.text-muted { color: rgba(255, 255, 255, 0.75) !important; }
.card { background-color: var(--card-bg); border: 1px solid var(--border-color); }
.athlete-card { border-radius: 12px; transition: all 0.3s ease; position: relative; overflow: hidden; }
.athlete-card-clickable:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(217, 4, 41, 0.2); border-color: var(--primary-red); cursor: pointer;}
.athlete-avatar { width: 70px; height: 70px; border-radius: 50%; border: 3px solid var(--border-color); object-fit: cover; background-color: var(--secondary-blue); }
.shirt-number { font-size: 1.5rem; font-weight: bold; color: var(--text-light); background-color: var(--primary-red); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: absolute; top: 50%; right: 15px; transform: translateY(-50%); }
.is-captain { color: var(--gold-star); } .is-vice-captain { color: silver; }
.card-actions { position: absolute; bottom: 10px; right: 10px; z-index: 5; display: flex; gap: 5px; }
.card-actions .btn { background: rgba(0,0,0,0.3); border: none; }
.btn-primary-custom { background-color: var(--primary-red); border-color: var(--primary-red); color: white; }
.btn-primary-custom:hover { background-color: #b80323; border-color: #b80323; }
.form-control, .form-select { background-color: var(--secondary-blue); color: var(--text-light); border-color: var(--border-color); }
.form-control:focus, .form-select:focus { background-color: var(--secondary-blue); color: var(--text-light); border-color: var(--primary-red); box-shadow: 0 0 0 0.25rem rgba(217, 4, 41, 0.25); }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.calendar-day { background-color: var(--secondary-blue); border: 1px solid var(--border-color); min-height: 120px; padding: 8px; font-size: 0.9rem; }
.calendar-day.today { border-color: var(--primary-red); } .calendar-day.other-month { opacity: 0.3; }
.calendar-session { padding: 4px; border-radius: 4px; font-size: 0.75rem; margin-top: 5px; cursor: pointer; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.session-allenamento { background-color: var(--primary-red); color: white; }
.session-partita-casa { background-color: var(--primary-blue); color: white; }
.session-partita-trasferta { background-color: var(--primary-red); color: white; }
#pitch-wrapper { display: flex; align-items: flex-start; gap: 1rem; }
#field-container { background-color: var(--field-green); border: 2px solid var(--field-line); position: relative; width: 100%; max-width: 450px; aspect-ratio: 5 / 7; box-sizing: border-box; flex-shrink: 0; }
#field-bench-area { background-color: rgba(0,0,0,0.2); border: 2px dashed var(--border-color); border-radius: 8px; width: 150px; height: 630px; position: relative; flex-shrink: 0; }
.field-line, .field-box, .field-circle { position: absolute; border-color: var(--field-line); }
.halfway-line { border-top: 2px solid var(--field-line); width: 100%; top: 50%; }
.center-circle { top: 50%; left: 50%; transform: translate(-50%, -50%); width: 25%; aspect-ratio: 1/1; border: 2px solid var(--field-line); border-radius: 50%; }
.penalty-box-top { top: 0; left: 50%; transform: translateX(-50%); width: 60%; height: 16.5%; border: 2px solid var(--field-line); border-top: none; }
.penalty-box-bottom { bottom: 0; left: 50%; transform: translateX(-50%); width: 60%; height: 16.5%; border: 2px solid var(--field-line); border-bottom: none; }
.goal-box-top { top: 0; left: 50%; transform: translateX(-50%); width: 30%; height: 6%; border: 2px solid var(--field-line); border-top: none; }
.goal-box-bottom { bottom: 0; left: 50%; transform: translateX(-50%); width: 30%; height: 6%; border: 2px solid var(--field-line); border-bottom: none; }
.player-jersey { position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 15%; cursor: grab; user-select: none; font-size: clamp(4.5px, 0.6vw, 8px); transform: translate(-50%, -50%); }
.jersey-body { position: relative; width: 5em; height: 5em; background-color: var(--secondary-blue); border-radius: 0.8em 0.8em 0.5em 0.5em; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 -4px 8px rgba(0,0,0,0.3); }
.jersey-number { font-size: 2.2em; font-weight: bold; color: white; text-shadow: 1px 1px 2px black; }
.player-name { margin-top: 0.5em; font-size: 1.33em; font-weight: bold; color: white; background-color: rgba(0,0,0,0.6); padding: 0.1em 0.4em; border-radius: 4px; white-space: nowrap; }
.dragging { opacity: 0.5; z-index: 1056; pointer-events: none; }
.token { position: absolute; cursor: grab; user-select: none; z-index: 10; text-align: center; transform: translate(-50%, -50%); }
.token-captain { font-weight: bold; color: white; background: black; padding: 0.2em 0.5em; border-radius: 4px; font-size: clamp(8px, 1vw, 12px); }
.token-ball { font-size: 2rem; } .token-opponent { width: 2.5em; height: 2.5em; background-color: var(--primary-red); border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5); }
.match-future { border-left: 4px solid #006400 !important; } .match-home { border-left: 4px solid var(--primary-blue) !important; } .match-away { border-left: 4px solid var(--primary-red) !important; }
@media print { body { padding-top: 0; } .no-print { display: none !important; } body * { visibility: hidden; } .printing-now, .printing-now * { visibility: visible; } .printing-now { position: absolute; left: 0; top: 0; width: 100%; } .printing-now .card, .printing-now .table { background-color: #fff !important; color: #000 !important; border: 1px solid #ccc !important; } .printing-now h1, .printing-now h2, .printing-now h3, .printing-now p, .printing-now td, .printing-now th { color: #000 !important; } }