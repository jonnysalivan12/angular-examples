---
doc-id: UCMAP-002
title: "Mapa scenariuszy rozliczenia dyspozycji"
description: "Relacje między korektą dyspozycji, nocnym rozliczeniem i ponowieniem nieudanych rozliczeń."
status: draft                                  # draft | active
owner: "Anna Nowak"
relations:
  - type: groups
    target: UC-002
  - type: groups
    target: TUC-001
  - type: groups
    target: TUC-002
---

# Mapa scenariuszy rozliczenia dyspozycji

| Pole | Wartość |
|---|---|
| Aktorzy biznesowi | Klient |
| Aktorzy systemowi | System |
| Wersja diagramu | 1.0 |

## Cel

Mapa zestawia scenariusze, które działają na tej samej dyspozycji wokół
nocnego rozliczenia: korektę przez klienta, nocne rozliczenie i ponowienie
nieudanych rozliczeń. Pokazuje, kiedy korekta jest wykluczona i kiedy
ponowienie rozszerza nocne rozliczenie. Diagram ma dwa obszary: korektę
i rozliczenie.

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
    klient(["Klient"]):::aktor
    system(["System"]):::aktor
    subgraph korekta [Korekta]
        UC002["UC-002 Korekta dyspozycji"]:::uc
    end
    subgraph rozliczenie [Rozliczenie]
        TUC001["TUC-001 Nocne rozliczenie dyspozycji"]:::tuc
        TUC002["TUC-002 Ponowienie nieudanych rozliczeń"]:::tuc
    end
    klient --- UC002
    system --- TUC001
    system --- TUC002
    TUC002 -.->|extend| TUC001
    UC002 -.-|exclude| TUC001
    classDef aktor fill:#ffffff,stroke:#555555
    classDef uc fill:#e3f2fd,stroke:#1565c0
    classDef tuc fill:#ede7f6,stroke:#4527a0
```

## Opis relacji

| Źródło | Relacja | Cel | Uzasadnienie |
|---|---|---|---|
| TUC-002 | extend | TUC-001 | Ponowienie uruchamia się tylko dla dyspozycji, których rozliczenie się nie powiodło: mają status NIEROZLICZONA i mniej niż trzy nieudane próby rozliczenia. |
| UC-002 | exclude | TUC-001 | Korekta jest niemożliwa w trakcie rozliczenia: przy starcie nocnego przebiegu wszystkie dyspozycje wybrane do rozliczenia dostają status W_ROZLICZENIU i system odrzuca zmianę ich pozycji. Dyspozycja przyjęta po końcu dnia rozliczeniowego nie wchodzi do przebiegu, więc klient może ją skorygować. |

## Powiązanie z artefaktami szczegółowymi

- UC-002
- TUC-001
- TUC-002

## Otwarte pytania

Czy przebieg ponowienia, który nie wystartował o 06:00, bo nocne rozliczenie jeszcze trwa, ma ruszyć zaraz po zakończeniu nocnego rozliczenia, czy dopiero o kolejnej pełnej godzinie?
