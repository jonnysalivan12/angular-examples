---
doc-id: SPEC-WF-005
title: "Rozpatrzenie reklamacji"
description: "Zadanie użytkownika, w którym pracownik zaplecza zapisuje decyzję w sprawie reklamacji i kwotę rekompensaty w terminie 14 dni."
status: draft                                  # draft | active
task-type: user-task                           # service-task | user-task | script-task | call-activity
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: AC-01
  - type: contains
    target: AC-02
  - type: consumes
    target: SPEC-WF-004
  - type: involves
    target: ACTOR-001.ROLE-02
---

# Rozpatrzenie reklamacji

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | ACTOR-001.ROLE-02 (Pracownik zaplecza) |

## Cel zadania

Uzyskać od pracownika zaplecza decyzję w sprawie reklamacji (UZNANA albo
ODRZUCONA) i kwotę rekompensaty przy uznaniu, w ciągu 14 dni od utworzenia
zadania.

## Warunki wstępne

- SPEC-WF-004 zapisał zmienne complaintId i dispositionAmount i zmienił status reklamacji na W_ROZPATRZENIU.
- Zadanie trafia do wspólnej kolejki zespołu reklamacji; pracownik przypisuje je do siebie przed zapisem decyzji.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| — | — | Zadanie nie woła zasobów |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| complaintId | UUID | SPEC-WF-004 | Identyfikator reklamacji, której dotyczy decyzja |
| dispositionAmount | Decimal | SPEC-WF-004 | Kwota reklamowanej dyspozycji, górna granica kwoty rekompensaty |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| decision | String: UZNANA, ODRZUCONA | Decyzja pracownika zaplecza |
| requestedCompensation | Decimal | Kwota rekompensaty wpisana przy decyzji UZNANA; pusta przy decyzji ODRZUCONA |
| resolvedAt | DateTime | Data i godzina zapisu decyzji w systemie reklamacji |

## Reguły i logika

- Jeśli pracownik zapisze decyzję UZNANA z kwotą nie większą niż dispositionAmount, to zadanie kończy się ze zmiennymi decision = UZNANA, requestedCompensation równą wpisanej kwocie i resolvedAt.
- Jeśli pracownik zapisze decyzję ODRZUCONA, to zadanie kończy się ze zmiennymi decision = ODRZUCONA, pustą requestedCompensation i resolvedAt.
- Jeśli zapis decyzji zostanie odrzucony, bo kwota rekompensaty przekracza kwotę dyspozycji, to zadanie pozostaje otwarte i zmienne wyjściowe nie powstają.
- Jeśli zadanie jest przypisane do pracownika, to zakończyć je może tylko ten pracownik.

## Scenariusze błędów

Kwota rekompensaty wyższa niż kwota dyspozycji: zapis decyzji jest odrzucany,
a zadanie trwa. Brak odpowiedzi systemu reklamacji: zadanie pozostaje otwarte
i przypisane do pracownika.

## Obsługa zdarzeń granicznych

Timer bez przerywania `P14D`, liczony od utworzenia zadania. Po 14 dniach bez
decyzji timer wysyła komunikat startowy procesu „Eskalacja przeterminowanej
reklamacji” ze zmiennymi complaintId (identyfikator reklamacji) i assignee
(login pracownika przypisanego do zadania; pusty, gdy zadanie czeka w kolejce
zespołu). Zadanie zostaje otwarte u tego samego pracownika. Zapis decyzji przed
terminem usuwa timer.

## Efekty uboczne

Zapis decyzji zmienia stan reklamacji na UZNANA albo ODRZUCONA i utrwala
decyzję z uzasadnieniem w śladzie audytowym. Przekroczenie terminu uruchamia
proces eskalacji, który zmienia stan reklamacji na ESKALOWANA i powiadamia
kierownika zespołu reklamacji.

## Kryteria akceptacji

### AC-01

- Given zadanie rozpatrzenia przypisane do pracownika zaplecza, a reklamacja dotyczy dyspozycji na 3 450,00 PLN
- When pracownik zapisuje decyzję UZNANA z kwotą 1 200,00 PLN i uzasadnieniem
- Then zadanie kończy się, a instancja ma zmienne decision = UZNANA, requestedCompensation = 1200.00 i resolvedAt równą chwili zapisu decyzji

### AC-02

- Given zadanie rozpatrzenia utworzone 14 dni temu i nadal bez decyzji
- When upływa timer `P14D` na zadaniu
- Then silnik uruchamia proces „Eskalacja przeterminowanej reklamacji” ze zmiennymi complaintId i assignee, a zadanie pozostaje otwarte i przypisane do tego samego pracownika

## Powiązane dokumenty

- SPEC-WF-004: źródło zmiennych complaintId i dispositionAmount.
- ACTOR-001.ROLE-02 Pracownik zaplecza: wykonawca zadania.
