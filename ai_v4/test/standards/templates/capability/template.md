---
doc-id: CAP-{nnn}
title: "{Nazwa zdolności}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: consumes
    target: QUE-{nnn}                          # odbierane zdarzenie
  - type: constrained_by
    target: NFR-{nnn}.NFRT-{KATEGORIA}-{nn}    # wiersz NFR
---

# {Nazwa zdolności}

## Cel biznesowy

{Jaką wartość biznesową daje zdolność}

## Zakres odpowiedzialności

{Za co odpowiada zdolność}

## Poza zakresem

{Za co zdolność nie odpowiada}

## Zdarzenia i kontrakty domenowe

### Odbierane

- QUE-{nnn}: {po co zdolność je odbiera}

## Miary i kryteria skuteczności

{Miary skuteczności: KPI, SLA}

## Ograniczenia NFR

- NFR-{nnn}.NFRT-{KATEGORIA}-{nn}

## Ryzyka i ograniczenia

{Ryzyka i ograniczenia zdolności}
