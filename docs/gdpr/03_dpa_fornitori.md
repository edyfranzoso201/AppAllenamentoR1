# Sub-responsabili del trattamento e DPA (art. 28 GDPR)

> Bozza tecnica — da validare con consulente privacy. Vedi `00_LEGGIMI.md`.

Sport Monitoring (Responsabile del trattamento) si avvale dei seguenti
**sub-responsabili** per fornire il servizio. Per ciascuno occorre avere in
essere un **Data Processing Agreement (DPA)** e verificare le garanzie per gli
eventuali trasferimenti extra-UE.

## Elenco sub-responsabili

| Fornitore | Ruolo nel sistema | Dati trattati | Dove trovare il DPA | Trasferimento extra-UE |
|---|---|---|---|---|
| **Vercel** | Hosting applicazione, esecuzione API serverless | Tutti i dati in transito verso le funzioni | DPA standard Vercel (dashboard account → Legal/Privacy) | Possibile (USA) — verificare SCC / Data Privacy Framework |
| **Upstash** (Redis) | Database (KV) — archiviazione dati | Anagrafici, sanitari (scadenze), valutazioni, pagamenti, account | DPA Upstash (sito fornitore) | Verificare regione del database (preferire EU) e SCC |
| **Google** (Drive) | Archiviazione immagini/certificati linkati | Foto profilo, eventuali link certificati medici | Google Cloud / Workspace DPA | Possibile (USA) — SCC / DPF |
| **Gmail SMTP** (Nodemailer) | Invio email di alert (scadenze) | Email destinatario, nome atleta, tipo scadenza | Incluso nei termini Google | Possibile (USA) |
| **GitHub** (Actions) | Esecuzione backup automatici | Snapshot dati (vedi nota ⚠️) | DPA GitHub/Microsoft | Possibile (USA) |

## Azioni da completare (checklist)

- [ ] Recuperare e archiviare copia del **DPA firmato/accettato** per ciascun fornitore.
- [ ] Verificare la **regione di hosting** del database Upstash → preferire EU per minimizzare i trasferimenti.
- [ ] Verificare le **garanzie per i trasferimenti extra-UE** (clausole contrattuali standard / adesione al Data Privacy Framework).
- [ ] Mantenere aggiornato l'elenco dei sub-responsabili e **informarne i titolari** (società clienti) in caso di modifiche (art. 28 §2).
- [ ] ⚠️ **Backup su GitHub**: gli snapshot contengono dati di minori. Valutare di spostarli su storage privato cifrato anziché in un repository, e comunque garantire accesso ristretto. Vedi `04_data_retention.md`.

## Struttura del DPA che Sport Monitoring offre alle società (titolari)

Poiché Sport Monitoring è Responsabile verso le società, dovrebbe **mettere a
disposizione delle società clienti un proprio DPA** (art. 28 §3) che includa:

1. Oggetto, durata, natura e finalità del trattamento.
2. Tipologie di dati e categorie di interessati (atleti minori, genitori, staff).
3. Obblighi del responsabile: riservatezza, sicurezza (art. 32), assistenza al titolare per i diritti degli interessati e per il data breach.
4. Elenco dei **sub-responsabili autorizzati** (la tabella sopra) e procedura di notifica delle modifiche.
5. Misure di sicurezza adottate (rinvio a `01_registro_trattamenti.md`).
6. Gestione del **data breach**: notifica al titolare senza ingiustificato ritardo.
7. Sorte dei dati al termine del servizio: restituzione o cancellazione.

_Bozza 2026-06-13 — da validare._
