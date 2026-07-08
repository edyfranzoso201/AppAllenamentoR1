# Restyle visivo trasversale — Sport Monitoring

**Data:** 2026-07-08
**Stato:** approvato (direzione + strategia), esecuzione a fasi
**Mockup di riferimento:** https://claude.ai/code/artifact/cd8db697-72ca-4f37-a2f9-02b3ddd1af7b

## Obiettivo
Rendere l'app visivamente più curata e moderna **mantenendo l'identità navy sportiva esistente**, con un
**unico accento di marca** applicato a tutte le pagine, componenti coerenti e un **tema chiaro solido**
(niente più fragilità da `!important`). Cura identica su **tema scuro, tema chiaro e mobile**.

Non è un rewrite: è un consolidamento su token + restyle progressivo pagina per pagina.

## Vincoli
- Vercel Hobby: nessun impatto (solo CSS/HTML frontend).
- Bootstrap 5.3.3 resta la base; i token si affiancano, non lo sostituiscono.
- Nessun deploy/push senza ok esplicito dell'utente nella conversazione corrente.
- Ogni fase verificata su tema scuro + chiaro + mobile PRIMA di dichiararla conclusa.

## Stato attuale rilevato (il problema)
Tre sistemi di variabili sovrapposti + accenti diversi per pagina:

| Fonte | Accento | Note |
|---|---|---|
| `style.css` (`:root`, condiviso) | `--primary-red: #d90429`, `--primary-blue:#0a2463`, `--card-bg:#1a3a7a` | base condivisa da index/bacheca/calendario/dashboard |
| `index.html` (`:root` inline) | verde `#198754`, sfondo `#060f1e` | **sovrascrive** style.css localmente |
| `calendario.html` | `--accent:#d90429` (rosso) | |
| `dashboard.html` | `--accent:#3b82f6` (blu) | |
| `area-tecnica.html` | `--accent:#16a34a` (verde) | |

Effetto: navigando tra pagine l'accento cambia (verde→rosso→blu) → percezione "amatoriale".
Il tema chiaro di `index.html` è costruito con decine di override `!important` → fragile.

**Bug CSS trovato:** `public/style.css:10` inizia con `* ✅ FIX:` invece di `/* ✅ FIX:`
(apertura commento mancante). Da correggere in Fase 0.

## Token unici (target)
Un solo set semantico, tema scuro default + `.theme-light` (l'app usa `html.theme-light`/`body.theme-light`).

Scuro:
- `--bg:#0a1424` · `--surface:#13233a` · `--surface-2:#1a2d47` · `--border:#263e63`
- `--text:#e8eef8` · `--text-muted:#8ea3c0` · `--text-dim:#617694`
- **marca** `--brand:#1aa05e` · `--brand-strong:#15864e` · `--brand-soft:rgba(26,160,94,.14)`
- semantici (separati dall'accento): `--ok:#1aa05e` · `--warn:#e0a53a` · `--danger:#e5484d` · `--info:#4a90e2`

Chiaro:
- `--bg:#f4f7fb` · `--surface:#ffffff` · `--surface-2:#f7fafd` · `--border:#dbe4f0`
- `--text:#0f1e33` · `--text-muted:#5a6b82` · `--text-dim:#8496ac`
- `--brand:#16884f` · `--warn:#c98410` · `--danger:#d23539` · `--info:#2f6fc4`

Regole:
- **Un solo pulsante primario pieno per schermata**; resto outline/ghost.
- **Rosso = solo azioni distruttive/urgenti**, mai accento decorativo.
- Colori semantici (ok/warn/danger/info) distinti dall'accento di marca.

## Strategia: token-first, incrementale
Pulizia **man mano** (scelta utente): a ogni fase si rimuovono i vecchi `!important` della sezione
toccata e si ricostruisce pulito sui token.

### Fase 0 — Fondamenta (nessun cambiamento visibile)
- Correggere il bug commento `style.css:10`.
- Aggiungere in `style.css` un blocco token semantici (`--brand`, `--surface`, `--ok`… + varianti `.theme-light`),
  **mappando** i nomi legacy esistenti ai nuovi dove utile (es. `--primary-red` resta ma non è più l'accento).
- Non toccare ancora i componenti. Verifica: l'app appare identica a prima.

### Fase 1 — Home / index (pilota)
- Restyle di: tab nav, card riepilogo Home, pulsanti azioni rapide, badge.
- Rimuovere gli override `!important` del tema chiaro della Home, ricostruiti sui token.
- Verifica scuro + chiaro + mobile. Valida il pattern per le fasi successive.

### Fase 2 — Calendario
- Portare l'accento rosso `#d90429` alla marca unica; restyle eventi/tab/pill.

### Fase 3 — Dashboard, Bacheca, Register, Area-tecnica
- Allineare gli `--accent` locali (blu/verde) alla marca; restyle componenti chiave.

## Edge cases / rischi da presidiare
- **Tema chiaro**: ogni componente ridisegnato va verificato in `.theme-light` (contrasto testo, bordi, alert).
- **Mobile**: touch target ≥ 44px, tab nav che va a capo, tabelle in `overflow-x:auto`, leggibilità al sole
  (contrasto AA). Testare a 360px di larghezza.
- **Modalità Campo**: ha un tema chiaro forzato su mobile — non deve rompersi.
- **Bootstrap**: alcune classi (`.btn-primary`, `.alert-*`, `.card`) hanno stili propri; i token vanno
  applicati con specificità sufficiente ma senza tornare a `!important` a tappeto.
- **calendario/dashboard**: hanno `:root` propri → vanno riconciliati, non solo sovrascritti.
- **Print CSS** (`@media print`): non deve regredire.

## Definizione di "fatto" per fase
- [ ] Componenti della fase ridisegnati sui token
- [ ] Vecchi `!important` della sezione rimossi
- [ ] Verificato tema scuro
- [ ] Verificato tema chiaro
- [ ] Verificato mobile ≤360px
- [ ] Nessuna regressione su print
- [ ] Commit locale (push solo su ok esplicito)
