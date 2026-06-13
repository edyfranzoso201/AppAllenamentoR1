# Policy di conservazione e cancellazione dei dati

> Bozza tecnica — da validare con consulente privacy. Vedi `00_LEGGIMI.md`.

Principio guida (art. 5.1.e — limitazione della conservazione): i dati sono
conservati **per il tempo strettamente necessario** alle finalità, dopodiché
vengono cancellati o anonimizzati.

## Tempi di conservazione per categoria

| Categoria di dati | Conservazione | Dopo la scadenza |
|---|---|---|
| Anagrafici atleta / contatti | Durata del rapporto sportivo (tesseramento attivo) | Cancellazione o anonimizzazione a fine rapporto + eventuale periodo di tolleranza per re-iscrizione |
| Dati del genitore/tutore | Finché l'atleta è minorenne e tesserato | Cancellazione al venir meno della necessità |
| **Dati sanitari** (scadenze visite, certificati) | Stagione in corso + periodo minimo richiesto dalla normativa sportiva | Cancellazione/anonimizzazione; **non conservare oltre il necessario** |
| Valutazioni / performance / presenze | Durata del rapporto; possibile valore storico | Anonimizzazione per finalità statistiche |
| Pagamenti / dati amministrativi | **Termini fiscali di legge** (di norma 10 anni per documenti contabili) | Cancellazione allo scadere dell'obbligo |
| Account utenti (staff) | Durata dell'incarico | Disattivazione/cancellazione a fine incarico |
| Log accessi | Limitati nel numero (rotazione automatica) | Sovrascritti automaticamente |
| Subscription push | Finché valide | Rimosse automaticamente quando il browser le invalida (410) |
| Prova del consenso | Per tutta la durata del trattamento + tempo utile a dimostrare la liceità | Conservata come evidenza (accountability) |

## Diritto alla cancellazione (art. 17)

Quando un interessato (o il genitore) richiede la cancellazione, oppure a fine
rapporto, occorre eliminare i dati da **tutti** i luoghi in cui risiedono:

- [ ] Database principale (record atleta nell'annata).
- [ ] Eventuali chiavi collegate (valutazioni, pagamenti, materiale, documenti, presenze).
- [ ] Richiesta di iscrizione originale (se ancora presente).
- [ ] **Backup**: i dati restano negli snapshot finché questi non vengono ruotati/eliminati → documentare il tempo massimo di permanenza nei backup e comunicarlo all'interessato.

> Nota tecnica: l'app prevede la cancellazione dell'atleta. Verificare che la
> cancellazione **propaghi** a tutte le chiavi collegate (hard delete) e non
> lasci dati orfani.

## ⚠️ Nota sui backup (punto aperto)

Attualmente gli snapshot giornalieri dei dati (che includono **dati di minori e
sanitari**) vengono conservati con rotazione. Raccomandazioni:

1. Conservare i backup su **storage cifrato e ad accesso ristretto**.
2. Definire e documentare la **finestra di ritenzione** dei backup (es. 14 giorni).
3. Considerare che la cancellazione di un dato "vive" nei backup fino alla loro
   rotazione: ciò va indicato nei tempi di risposta alle richieste art. 17.
4. Evitare di conservare i backup in repository di codice; preferire un bucket
   privato cifrato.

## Procedura periodica consigliata

- **Fine stagione**: rivedere gli atleti non più tesserati → cancellazione/anonimizzazione.
- **Annuale**: verifica dei tempi di conservazione e pulizia dei dati non più necessari.
- **Su richiesta**: evasione delle richieste di cancellazione entro i termini di legge (di norma 1 mese, art. 12.3).

_Bozza 2026-06-13 — da validare._
