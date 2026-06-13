# Documentazione GDPR — Sport Monitoring

> ⚠️ **AVVERTENZA IMPORTANTE**
> Questi documenti sono **bozze tecniche** preparate sulla base dell'architettura
> reale dell'applicazione. **NON sostituiscono una consulenza legale.**
> Prima dell'uso reale devono essere **revisionati e approvati da un consulente
> privacy / DPO**, in particolare perché l'app tratta **dati di minori** e
> **dati sanitari** (categoria particolare ex art. 9 GDPR), che richiedono
> garanzie rafforzate.

## Modello dei ruoli (SaaS)

- **Titolare del trattamento**: ciascuna **società sportiva (ASD/SSD)** cliente.
  È lei che decide finalità e mezzi del trattamento dei dati dei propri atleti.
- **Responsabile del trattamento (art. 28)**: **Sport Monitoring** (il fornitore
  della piattaforma), che tratta i dati *per conto* delle società clienti.
- **Sub-responsabili (art. 28 §4)**: i fornitori infrastrutturali (Vercel,
  Upstash, Google, ecc.) di cui Sport Monitoring si avvale.

```
Atleta/Genitore (interessato)
        │  conferisce i dati
        ▼
Società sportiva (TITOLARE) ──incarica──► Sport Monitoring (RESPONSABILE)
                                                  │ si avvale di
                                                  ▼
                              Vercel / Upstash / Google / Gmail (SUB-RESPONSABILI)
```

## Indice documenti

| File | Cosa | A chi serve |
|---|---|---|
| `01_registro_trattamenti.md` | Registro dei trattamenti (art. 30) | Titolare + Responsabile |
| `02_informativa_privacy.md` | Informativa estesa (art. 13) | Da mostrare a atleti/genitori |
| `03_dpa_fornitori.md` | Note sui sub-responsabili (art. 28) | Sport Monitoring |
| `04_data_retention.md` | Policy di conservazione e cancellazione | Titolare + Responsabile |

## Campi da completare

I documenti contengono segnaposto tra parentesi quadre `[DA COMPLETARE: ...]`.
Vanno compilati dalla singola società (titolare) con i propri dati identificativi
prima dell'adozione.

_Ultimo aggiornamento bozza: 2026-06-13_
