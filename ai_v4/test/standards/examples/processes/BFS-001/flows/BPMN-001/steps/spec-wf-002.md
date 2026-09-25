---
doc-id: SPEC-WF-002
title: "Księgowanie pozycji"
description: "Krok procesu rozliczenia, który księguje pozycje pobranych dyspozycji w księdze głównej i ustala wynik rozliczenia każdej dyspozycji."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Anna Nowak"
relations:
  - type: contains
    target: AC-01
  - type: contains
    target: AC-02
  - type: consumes
    target: INT-002
  - type: consumes
    target: SPEC-WF-001
---

# Księgowanie pozycji

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | settlement-service |

## Cel zadania

Zaksięgować w księdze głównej pozycje każdej dyspozycji z listy dispositionIds
i zapisać wynik jej rozliczenia: dyspozycja rozliczona albo nierozliczona,
której licznik nieudanych prób rozliczenia rośnie o jeden.

## Warunki wstępne

Lista dispositionIds nie jest pusta. Przebieg rozliczenia jest w stanie W_TOKU.
Dyspozycje z listy mają status W_ROZLICZENIU nadany w kroku SPEC-WF-001, a ich
pozycje status księgowania OCZEKUJE albo, w przebiegu ponowienia, także
NIEZAKSIEGOWANA albo ZAKSIEGOWANA.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| Integracja | INT-002 | Dla każdej dyspozycji wysyła żądanie księgowania z postingType = SETTLEMENT, dispositionId i pozycjami w statusie OCZEKUJE albo NIEZAKSIEGOWANA; z odpowiedzi zapisuje w pozycjach postingId i postingStatus |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| dispositionIds | Json (lista UUID) | SPEC-WF-001 | Identyfikatory dyspozycji do rozliczenia w bieżącym przebiegu |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| postingResults | Json (lista wyników) | Dla każdej dyspozycji: dispositionId, wynik ROZLICZONA albo NIEROZLICZONA i kod błędu przy wyniku NIEROZLICZONA |

## Reguły i logika

- Jeśli pozycja ma status księgowania ZAKSIEGOWANA, to zadanie nie wysyła jej ponownie do księgi głównej.
- Jeśli wszystkie pozycje dyspozycji mają status ZAKSIEGOWANA, to zadanie nie woła INT-002 i ustawia dyspozycji status ROZLICZONA oraz datę settledAt.
- Jeśli INT-002 potwierdzi księgowanie wszystkich wysłanych pozycji, to pozycje dostają status ZAKSIEGOWANA i postingId z odpowiedzi, dyspozycja status ROZLICZONA i datę settledAt, a wynik w postingResults to ROZLICZONA.
- Jeśli INT-002 zwróci status NIEZAKSIEGOWANA dla części pozycji albo odrzuci księgowanie, to zaksięgowane pozycje dostają status ZAKSIEGOWANA i postingId, pozostałe status NIEZAKSIEGOWANA, dyspozycja status NIEROZLICZONA, failedSettlementAttempts zwiększa się o 1, a wynik zawiera kod błędu zwrócony przez księgę główną.
- Jeśli INT-002 nie odpowie w limicie czasu 3 s ani w pierwszej próbie, ani w 3 ponowieniach, to wysłane pozycje dostają status NIEZAKSIEGOWANA, dyspozycja status NIEROZLICZONA, failedSettlementAttempts zwiększa się o 1, a wynik to NIEROZLICZONA z kodem KSIEGA_NIEDOSTEPNA.
- Jeśli failedSettlementAttempts po zwiększeniu wynosi 3, to settlement-service zgłasza dyspozycję do ręcznego wyjaśnienia w zespole rozliczeń.
- Jeśli księgowanie jednej dyspozycji się nie powiedzie, to zadanie księguje kolejne dyspozycje z listy.

## Scenariusze błędów

Niedostępność i odmowa księgi głównej nie są błędami zadania: kończą się
wynikiem NIEROZLICZONA, a zadanie kończy się poprawnie. Błąd bazy danych przy
zapisie wyniku dyspozycji przerywa zadanie; silnik ponawia je 3 razy co
1 minutę, a po ostatniej próbie tworzy incydent. Ponowione zadanie księguje
tylko dyspozycje z listy, które mają jeszcze status W_ROZLICZENIU, a wynik
pozostałych odtwarza z ich statusu; pozycji ZAKSIEGOWANA nie wysyła drugi raz.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych. Niedostępność księgi głównej jest wynikiem
dyspozycji, a nie błędem BPMN, więc proces zawsze przechodzi do zamknięcia dnia
rozliczeniowego.

## Efekty uboczne

- Dyspozycja przechodzi ze statusu W_ROZLICZENIU do ROZLICZONA albo NIEROZLICZONA; przy NIEROZLICZONA failedSettlementAttempts zwiększa się o 1, a gdy osiągnie 3, settlement-service zgłasza dyspozycję do ręcznego wyjaśnienia w zespole rozliczeń.
- Pozycja przechodzi ze statusu OCZEKUJE albo NIEZAKSIEGOWANA do ZAKSIEGOWANA z postingId albo do NIEZAKSIEGOWANA.
- W księdze głównej powstaje księgowanie z postingId dla każdej zaksięgowanej pozycji.

## Kryteria akceptacji

### AC-01

- Given dispositionIds z jedną dyspozycją w statusie W_ROZLICZENIU, która ma dwie pozycje w statusie OCZEKUJE
- When zadanie księgowania się wykona, a INT-002 potwierdzi księgowanie obu pozycji
- Then obie pozycje mają status ZAKSIEGOWANA i postingId z odpowiedzi, dyspozycja ma status ROZLICZONA i settledAt, a postingResults zawiera jej wynik ROZLICZONA

### AC-02

- Given dispositionIds z dwiema dyspozycjami w statusie W_ROZLICZENIU, jedną bez wcześniejszych nieudanych prób rozliczenia i drugą z failedSettlementAttempts = 2, oraz księga główna, która nie odpowiada
- When INT-002 nie odpowie dla żadnej z nich w 3 s ani w pierwszej próbie, ani w 3 ponowieniach
- Then obie dyspozycje mają status NIEROZLICZONA, ich pozycje status NIEZAKSIEGOWANA, a postingResults zawiera dla obu wynik NIEROZLICZONA z kodem KSIEGA_NIEDOSTEPNA; pierwsza ma failedSettlementAttempts = 1, a druga failedSettlementAttempts = 3 i settlement-service zgłasza ją do ręcznego wyjaśnienia w zespole rozliczeń

## Powiązane dokumenty

Integracja INT-002 z księgą główną i krok SPEC-WF-001, który zapisuje listę
dispositionIds i ustawia dyspozycjom status W_ROZLICZENIU.
