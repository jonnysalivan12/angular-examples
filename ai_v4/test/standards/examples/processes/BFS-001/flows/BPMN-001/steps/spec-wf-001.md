---
doc-id: SPEC-WF-001
title: "Pobranie dyspozycji do rozliczenia"
description: "Pierwszy krok procesu rozliczenia: ustala listę dyspozycji, które rozliczy bieżący przebieg, i od razu wyłącza je z korekty."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Anna Nowak"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: API-005
---

# Pobranie dyspozycji do rozliczenia

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | settlement-service |

## Cel zadania

Ustalić listę dyspozycji, które rozliczy bieżący przebieg, i od razu wyłączyć
je z korekty: w przebiegu nocnym dyspozycje zaakceptowane do końca dnia
rozliczeniowego, w przebiegu ponowienia dyspozycje nierozliczone, które mają
mniej niż trzy nieudane próby rozliczenia.

## Warunki wstępne

Instancja procesu ma zmienne runId, runType i businessDate zapisane przy
uruchomieniu przebiegu. Przebieg rozliczenia jest w stanie URUCHOMIONY.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| API | API-005 | Pobiera dyspozycje z filtrem statusu wynikającym z runType i bierze z odpowiedzi identyfikator, createdAt i failedSettlementAttempts każdej dyspozycji |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| runId | String (UUID) | Start procesu | Identyfikator przebiegu rozliczenia |
| runType | String | Start procesu | Rodzaj przebiegu: NIGHTLY albo RETRY |
| businessDate | Date | Start procesu | Dzień rozliczeniowy, którego dotyczy przebieg |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| dispositionIds | Json (lista UUID) | Identyfikatory dyspozycji do rozliczenia, rosnąco po createdAt; pusta lista, gdy nie ma czego rozliczać |

## Reguły i logika

- Jeśli runType = NIGHTLY, to zadanie woła API-005 z filtrem statusu ZAAKCEPTOWANA i zostawia tylko dyspozycje, których createdAt nie jest późniejszy niż koniec dnia businessDate; późniejsze rozliczy przebieg następnej nocy.
- Jeśli runType = RETRY, to zadanie woła API-005 z filtrem statusu NIEROZLICZONA i zostawia tylko dyspozycje, które mają failedSettlementAttempts puste albo mniejsze niż 3.
- Jeśli lista dispositionIds nie jest pusta, to zadanie w jednej transakcji ustawia wszystkim dyspozycjom z listy status W_ROZLICZENIU, a ich pozycjom bez statusu księgowania postingStatus = OCZEKUJE; od tej chwili korekta tych dyspozycji jest odrzucana.
- Jeśli pozycja ma już status księgowania ZAKSIEGOWANA albo NIEZAKSIEGOWANA z wcześniejszego przebiegu, to zadanie go nie zmienia.
- Jeśli żadna dyspozycja nie spełnia warunków, to dispositionIds jest pustą listą, a zadanie nie zmienia statusów.

## Scenariusze błędów

- API-005 nie odpowiada albo zwraca błąd 5xx: silnik ponawia zadanie 3 razy co 1 minutę, a po ostatniej próbie tworzy incydent. Przebieg zostaje w stanie URUCHOMIONY do decyzji operatora.
- API-005 zwraca błąd 4xx: zadanie nie ponawia wywołania i od razu tworzy incydent z treścią błędu.
- Błąd bazy danych przy zmianie statusów: transakcja jest wycofana w całości, żadna dyspozycja nie dostaje statusu W_ROZLICZENIU, a silnik ponawia zadanie jak przy błędzie 5xx.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych. Błędy kończą się incydentem w silniku,
opisanym w scenariuszach błędów.

## Efekty uboczne

Dyspozycje z listy dispositionIds przechodzą ze statusu ZAAKCEPTOWANA albo
NIEROZLICZONA do W_ROZLICZENIU, a ich pozycje bez statusu księgowania dostają
status OCZEKUJE. Po poprawnym zakończeniu zadania settlement-service przestawia
przebieg rozliczenia ze stanu URUCHOMIONY na W_TOKU.

## Kryteria akceptacji

### AC-01

- Given przebieg typu NIGHTLY za dzień 2026-09-13 oraz cztery dyspozycje: dwie w statusie ZAAKCEPTOWANA utworzone 13 września, jedna w statusie ZAAKCEPTOWANA utworzona 14 września o 00:20 i jedna w statusie ODRZUCONA utworzona 13 września
- When zadanie pobrania dyspozycji się wykona
- Then dispositionIds zawiera tylko dwie zaakceptowane dyspozycje z 13 września, w kolejności createdAt; obie mają status W_ROZLICZENIU i pozycje w statusie księgowania OCZEKUJE, a dyspozycja z 14 września zostaje w statusie ZAAKCEPTOWANA

## Powiązane dokumenty

Punkt końcowy API-005 (lista dyspozycji). Stany przebiegu opisuje maszyna
stanów „Cykl życia przebiegu rozliczenia”, a statusy dyspozycji maszyna
„Cykl życia dyspozycji”.
