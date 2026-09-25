---
doc-id: UCMAP-001
title: "Mapa scenariuszy dyspozycji i reklamacji"
description: "Powiązania złożenia i korekty dyspozycji ze zgłoszeniem i rozpatrzeniem reklamacji."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: groups
    target: UC-001
  - type: groups
    target: UC-002
  - type: groups
    target: UC-003
  - type: groups
    target: UC-004
---

# Mapa scenariuszy dyspozycji i reklamacji

## Cel

Mapa zestawia scenariusze klienta i pracownika zaplecza z procesu obsługi
dyspozycji i z procesu reklamacji. Pokazuje, kiedy klient może skorygować
kwoty pozycji złożonej dyspozycji, a kiedy może ją już tylko zareklamować, oraz
że każde zgłoszenie reklamacji kończy się rozpatrzeniem.

## Diagram

<!-- Klasy dla aktorów, UC i TUC. -->

```mermaid
flowchart LR
    klient([Klient])
    pracownik([Pracownik zaplecza])
    uc001[UC-001 Złożenie dyspozycji]
    uc002[UC-002 Korekta dyspozycji]
    uc003[UC-003 Zgłoszenie reklamacji przez klienta]
    uc004[UC-004 Rozpatrzenie reklamacji]
    klient --- uc001
    klient --- uc002
    klient --- uc003
    pracownik --- uc004
    uc002 -. «extend» .-> uc001
    uc003 -. «exclude» .- uc002
    uc003 -. «include» .-> uc004
    classDef aktor fill:#fff4d6,stroke:#b58900,color:#333333
    classDef uc fill:#e3f0ff,stroke:#1f6fb2,color:#333333
    class klient,pracownik aktor
    class uc001,uc002,uc003,uc004 uc
```

## Opis relacji

| Źródło | Relacja | Cel | Uzasadnienie |
|---|---|---|---|
| UC-002 | extend | UC-001 | Korekta jest krokiem warunkowym po złożeniu: klient zmienia kwoty pozycji bez zmiany kwoty łącznej tylko wtedy, gdy dyspozycja ma status ZAAKCEPTOWANA, czyli przed startem przebiegu rozliczenia, który ją obejmuje |
| UC-003 | exclude | UC-002 | Dla jednej dyspozycji korekta i reklamacja wykluczają się: korekta kwot jest możliwa tylko przed rozliczeniem, reklamacja tylko po rozliczeniu |
| UC-003 | include | UC-004 | Rozpatrzenie jest krokiem obowiązkowym: każde przyjęte zgłoszenie trafia do pracownika zaplecza, który podejmuje decyzję |

## Powiązanie z artefaktami szczegółowymi

- UC-001 — Złożenie dyspozycji
- UC-002 — Korekta dyspozycji
- UC-003 — Zgłoszenie reklamacji przez klienta
- UC-004 — Rozpatrzenie reklamacji
