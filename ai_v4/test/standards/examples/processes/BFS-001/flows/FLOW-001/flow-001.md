---
doc-id: FLOW-001
title: "Przyjęcie dyspozycji — przebieg podstawowy"
description: "Przyjęcie poprawnej dyspozycji: od żądania klienta przez walidację, sprawdzenie limitu i zapis do publikacji zdarzenia przyjęcia."
status: draft                                  # draft | active
owner: "Anna Nowak"
relations:
  - type: contains
    target: ACT-001
  - type: contains
    target: ACT-002
  - type: realizes
    target: CAP-001
  - type: consumes
    target: INT-001
  - type: consumes
    target: QUE-001
---

# Przyjęcie dyspozycji — przebieg podstawowy

| Pole | Wartość |
|---|---|
| Zdolność | CAP-001 |

## Warunki wstępne

Klient jest zalogowany w aplikacji mobilnej albo w bankowości internetowej
i zatwierdził dyspozycję silnym uwierzytelnieniem. Rachunek obciążany należy
do klienta. System limitów, baza danych dyspozycji i broker zdarzeń są
dostępne.

## Diagram

<!-- Mermaid, najwyżej 10–15 uczestników lub kroków. -->

```mermaid
sequenceDiagram
    participant K as Kanał klienta
    participant U as Usługa dyspozycji
    participant L as System limitów
    participant B as Broker zdarzeń Kafka
    K->>U: Żądanie złożenia dyspozycji
    U->>U: Walidacja wejścia dyspozycji
    U->>L: Sprawdzenie limitu (clientId, amount)
    L-->>U: Decyzja pozytywna, availableLimit
    U->>U: Zapis dyspozycji
    U->>B: Zdarzenie przyjęcia dyspozycji
    U-->>K: 201, dispositionId i status ZAAKCEPTOWANA
```

## Opis przepływu

| Nr | Krok | Aktywność | Wywołanie |
|---|---|---|---|
| 1 | Usługa dyspozycji przyjmuje żądanie złożenia dyspozycji z rachunkiem obciążanym, walutą, kwotą łączną i pozycjami | — | — |
| 2 | Waliduje dane dyspozycji i pozycji; lista naruszeń jest pusta | ACT-001 | — |
| 3 | Sprawdza w systemie limitów, czy kwota łączna mieści się w dostępnym limicie klienta; decyzja jest pozytywna | — | INT-001 |
| 4 | Zapisuje dyspozycję z pozycjami w jednej transakcji i nadaje jej status ZAAKCEPTOWANA | ACT-002 | — |
| 5 | Publikuje zdarzenie przyjęcia dyspozycji i zwraca klientowi odpowiedź 201 z identyfikatorem dyspozycji | — | QUE-001 |

## Scenariusze błędów

Przebieg podstawowy kończy się przy pierwszym odchyleniu. Odrzucenie dyspozycji
opisuje przepływ „Przyjęcie dyspozycji — obsługa błędów”.

- Walidacja zwraca naruszenia (krok 2): przepływ nie sprawdza limitu i nie zapisuje dyspozycji.
- System limitów odmawia, bo kwota łączna przekracza dostępny limit, nie zna klienta albo nie odpowiada po ponowieniach (krok 3): dyspozycja zostaje odrzucona z kodem przyczyny.
- Zapis dyspozycji się nie udaje (krok 4): transakcja jest wycofana w całości, zdarzenie przyjęcia nie powstaje, a klient dostaje komunikat o chwilowej niedostępności.
- Broker nie potwierdza zdarzenia (krok 5): dyspozycja jest już zapisana, więc klient dostaje odpowiedź 201, a usługa ponawia publikację w tle, aż broker potwierdzi zapis.
