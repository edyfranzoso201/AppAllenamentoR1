# Registro delle attività di trattamento (art. 30 GDPR)

> Bozza tecnica — da validare con consulente privacy. Vedi `00_LEGGIMI.md`.

## Titolare del trattamento
- **Denominazione**: [DA COMPLETARE: nome ASD/SSD]
- **P.IVA / C.F.**: [DA COMPLETARE]
- **Sede**: [DA COMPLETARE]
- **Contatto privacy**: [DA COMPLETARE: email]
- **Responsabile del trattamento (fornitore piattaforma)**: Sport Monitoring — [DA COMPLETARE: ragione sociale/contatto]

---

## Trattamento 1 — Gestione tesseramento e attività sportiva degli atleti

| Voce | Contenuto |
|---|---|
| **Finalità** | Gestione iscrizioni, anagrafica atleti, convocazioni, calendario, presenze, valutazioni tecniche, comunicazioni con atleti/genitori |
| **Categorie di interessati** | Atleti (anche **minori**), genitori/tutori, staff tecnico/dirigenziale |
| **Categorie di dati** | Anagrafici (nome, cognome, data/luogo nascita, sesso, codice fiscale, indirizzo); contatti (email, telefono); dati del genitore/tutore per i minori; numero tessera/matricola |
| **Base giuridica** | Esecuzione di un contratto/rapporto associativo (art. 6.1.b); per i minori, **consenso del genitore/tutore** (art. 6.1.a + art. 8); legittimo interesse per la gestione sportiva |
| **Destinatari** | Staff autorizzato della società; Federazione/Lega (FIGC/LND) per il tesseramento; responsabile del trattamento (Sport Monitoring) e sub-responsabili |
| **Trasferimenti extra-UE** | Possibili tramite fornitori cloud — vedi `03_dpa_fornitori.md` |
| **Conservazione** | Vedi `04_data_retention.md` |
| **Misure di sicurezza** | Vedi sezione "Misure tecniche" in fondo |

## Trattamento 2 — Dati relativi all'idoneità sanitaria (CATEGORIA PARTICOLARE art. 9)

| Voce | Contenuto |
|---|---|
| **Finalità** | Verifica e monitoraggio della **scadenza della visita medica** agonistica/non agonistica e della tessera, per garantire l'idoneità all'attività sportiva (obbligo D.M. 24/04/2013) |
| **Categorie di dati** | **Dati relativi alla salute** (art. 9): data di scadenza della visita medica; eventuale link/riferimento al certificato medico (`certLink`) |
| **Base giuridica** | Art. 9.2.h/b (finalità di medicina sportiva / obblighi in materia di sicurezza) + adempimento di obblighi normativi sportivi; ove necessario, consenso esplicito |
| **Note di rischio** | Categoria particolare → richiede garanzie rafforzate. **Raccomandazione**: NON conservare i certificati medici PDF nella piattaforma; conservare solo la *data di scadenza*. Se si conserva un link al certificato, verificare che l'accesso sia ristretto. |
| **Conservazione** | Fino al termine della stagione + periodo minimo richiesto dalla normativa sportiva; poi cancellazione/anonimizzazione |

## Trattamento 3 — Valutazioni e dati di performance

| Voce | Contenuto |
|---|---|
| **Finalità** | Valutazione tecnico-sportiva (pagelle: tecnica/tattica/fisico/comportamento), dati GPS/performance, statistiche partita, monitoraggio crescita atleta |
| **Categorie di dati** | Valutazioni soggettive dello staff; dati prestazionali (distanza, velocità, sprint, ecc.); presenze/assenze |
| **Base giuridica** | Legittimo interesse della società alla gestione tecnica (art. 6.1.f); per i minori, consenso del genitore |
| **Conservazione** | Durata del rapporto sportivo; valore storico/statistico → valutare anonimizzazione |

## Trattamento 4 — Gestione amministrativa e pagamenti

| Voce | Contenuto |
|---|---|
| **Finalità** | Gestione quote/pagamenti, rateizzazioni, scadenze, materiale assegnato |
| **Categorie di dati** | Importi, scadenze, stato pagamenti riferiti all'atleta |
| **Base giuridica** | Esecuzione contratto (art. 6.1.b); obblighi fiscali/contabili (art. 6.1.c) |
| **Conservazione** | Termini fiscali di legge (di norma 10 anni per documenti contabili) |

## Trattamento 5 — Account utenti e accessi

| Voce | Contenuto |
|---|---|
| **Finalità** | Autenticazione di allenatori/staff/admin; log degli accessi; notifiche push |
| **Categorie di dati** | Username, password (hash **scrypt salato**), ruolo, società; log accessi; subscription push (endpoint browser) |
| **Base giuridica** | Esecuzione contratto / legittimo interesse alla sicurezza |
| **Conservazione** | Durata dell'incarico; log accessi limitati nel numero e ruotati |

---

## Misure tecniche e organizzative (già implementate)

> Questa sezione documenta le misure di sicurezza **realmente in atto** nella
> piattaforma (utile per dimostrare l'accountability ex art. 32).

- **Autenticazione**: sessioni server-side con token, TTL scorrevole 8h, logout server-side (revoca). Password con hash **scrypt salato** (non reversibile), migrazione automatica dai vecchi hash.
- **Autorizzazione e isolamento multi-società**: ogni società accede solo ai propri dati; controllo lato server su `societyId` della sessione (non su header falsificabili). Ruoli differenziati (admin/coach/dirigente).
- **Trasporto**: HTTPS obbligatorio (HSTS attivo).
- **Header di sicurezza**: CSP enforcing, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Anti-XSS**: escaping dell'output nei punti che renderizzano dati utente.
- **Rate limiting**: su login (anti brute-force) e su iscrizioni pubbliche (anti-spam).
- **Prova del consenso**: al momento dell'iscrizione si registra versione informativa, timestamp e IP (accountability art. 7).
- **Backup**: snapshot giornalieri dei dati con rotazione. ⚠️ _Vedi nota in `04_data_retention.md` sulla protezione dei backup._
- **Cron**: notifiche/promemoria protetti da secret obbligatorio.

## Carenze note / da migliorare (trasparenza)

- I **backup** dei dati (inclusi dati di minori) andrebbero conservati su storage cifrato/ad accesso ristretto (in corso di valutazione).
- I **certificati medici**, se caricati come file, vanno trattati con cautela rafforzata (art. 9).
- Valutare nomina formale di un **DPO** se il trattamento di dati di minori su larga scala lo richiede (art. 37).

_Bozza 2026-06-13 — da validare._
