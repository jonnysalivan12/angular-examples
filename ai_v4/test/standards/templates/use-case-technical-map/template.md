---
doc-id: UCMAP-{nnn}
title: "{Nazwa mapy}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: groups
    target: UC-{nnn}                           # scenariusz na mapie
  - type: groups
    target: TUC-{nnn}
---

# {Nazwa mapy}

| Pole | Wartość |
|---|---|
| Aktorzy biznesowi | {Nazwy ról} |
| Aktorzy systemowi | {Nazwy ról} |
| Wersja diagramu | {Wersja diagramu} |

## Cel

{Po co powstaje mapa i jakie scenariusze zestawia}

## Legenda relacji

| Relacja | Znaczenie |
|---|---|
| include | krok obowiązkowy |
| extend | krok warunkowy |
| exclude | wzajemne wykluczenie wariantów |

## Diagram

<!-- Klasy dla aktorów, UC i TUC. -->

```mermaid
flowchart LR
```

## Opis relacji

| Źródło | Relacja | Cel | Uzasadnienie |
|---|---|---|---|
| UC-{nnn} | include / extend / exclude | TUC-{nnn} | {Uzasadnienie} |

## Powiązanie z artefaktami szczegółowymi

- UC-{nnn}
- TUC-{nnn}

## Otwarte pytania

{Pytania do wyjaśnienia}
