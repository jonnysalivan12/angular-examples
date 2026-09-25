---
doc-id: SPEC-WF-{nnn}
title: "{Nazwa zadania}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "{Imię Nazwisko}"
relations:
  - type: consumes
    target: API-{nnn}                          # Wywoływane zasoby; także INT-{nnn}, QUE-{nnn}
  - type: consumes
    target: SPEC-WF-{nnn}                      # Źródło zmiennej wejściowej; w call-activity także wyjściowej
  - type: involves
    target: ACTOR-{nnn}.ROLE-{nn}              # aktor kroku user-task
  - type: contains
    target: AC-{nn}                            # własne kryterium akceptacji
---

# {Nazwa zadania}

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | ACTOR-{nnn}.ROLE-{nn} albo {nazwa serwisu} |

## Cel zadania

{Co zadanie ma osiągnąć w procesie}

## Warunki wstępne

{Co musi być spełnione przed startem zadania}

## Wywoływane zasoby

<!-- Tylko zasoby, które krok woła sam. Krok, który niczego nie woła, np. user-task, ma jeden wiersz: „— | — | Zadanie nie woła zasobów”. -->

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| API | API-{nnn} | {Jak zadanie go używa} |
| Integracja | INT-{nnn} | {Jak zadanie go używa} |
| Zdarzenie | QUE-{nnn} | {Jak zadanie go używa} |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| {nazwa} | {Typ} | SPEC-WF-{nnn} | {Opis} |

### Wyjście

<!-- Kolumna „Źródło” opcjonalna: tylko w kroku call-activity, ID kroku podprocesu, który zmienną zapisał. -->

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| {Zmienna} | {Typ} | SPEC-WF-{nnn} | {Opis} |

## Reguły i logika

- Jeśli {X}, to {Y}.

## Scenariusze błędów

{Sytuacje błędne i reakcja zadania}

## Obsługa zdarzeń granicznych

{Zdarzenia graniczne zadania i reakcja}

## Efekty uboczne

{Efekty uboczne: zmiany stanu obiektów domenowych, powiadomienia}

## Kryteria akceptacji

### AC-01

- Given {stan}
- When {zdarzenie}
- Then {wynik}

## Powiązane dokumenty

{Dokumenty związane z zadaniem}
