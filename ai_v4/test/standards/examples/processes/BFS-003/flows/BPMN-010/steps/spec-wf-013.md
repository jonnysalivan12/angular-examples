---
doc-id: SPEC-WF-013
title: "Otwarcie rachunku w systemie"
description: "Zadanie procesu otwarcia rachunku, które po pozytywnej weryfikacji tożsamości otwiera rachunek i nadaje mu numer IBAN."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Katarzyna Wójcik"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: API-013
  - type: consumes
    target: SPEC-WF-011
  - type: consumes
    target: SPEC-WF-012
---

# Otwarcie rachunku w systemie

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | account-service |

## Cel zadania

Otworzyć rachunek osobisty albo lokatę terminową z wniosku, którego tożsamość
wnioskodawcy potwierdziła weryfikacja automatyczna albo pracownik zaplecza,
i przekazać nadany numer rachunku do dalszych kroków procesu.

## Warunki wstępne

- Wniosek ma wynik weryfikacji automatycznej NO_MATCH albo decyzję pracownika ZATWIERDZONA.
- Rachunek z wniosku ma stan WNIOSEK.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| API | API-013 | Wysyła identyfikator wniosku do otwarcia rachunku; z odpowiedzi odczytuje nadany numer IBAN |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| applicationId | UUID | Start procesu (wysłanie wniosku) | Identyfikator wniosku, z którego powstaje rachunek |
| verificationResult | Enum: NO_MATCH, POSSIBLE_MATCH, MATCH | SPEC-WF-011 | Wynik weryfikacji automatycznej |
| manualDecision | Enum: ZATWIERDZONA, ODRZUCONA | SPEC-WF-012 | Decyzja pracownika; pusta, gdy wniosek nie przechodził ręcznej weryfikacji |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| accountNumber | String (IBAN) | Numer otwartego rachunku albo rachunku lokaty |

## Reguły i logika

- Jeśli verificationResult ma wartość NO_MATCH albo manualDecision ma wartość ZATWIERDZONA, to zadanie wywołuje otwarcie rachunku.
- Jeśli żaden z tych warunków nie jest spełniony, to zadanie nie wywołuje otwarcia i zgłasza błąd BPMN ACCOUNT_OPENING_FAILED.
- Jeśli rachunek dla tego wniosku został już otwarty, to zadanie zapisuje istniejący numer rachunku w accountNumber i nie otwiera drugiego rachunku.
- Jeśli wywołanie kończy się przekroczeniem czasu albo błędem 5xx, to zadanie ponawia je do 3 razy w odstępie 30 sekund, a po trzecim nieudanym ponowieniu zgłasza błąd ACCOUNT_OPENING_FAILED.
- Jeśli wywołanie zwraca 409, to zadanie nie ponawia wywołania i zgłasza błąd ACCOUNT_OPENING_FAILED.

## Scenariusze błędów

Niedostępność usługi rachunków po ponowieniach i odmowa otwarcia (rachunek
w stanie ZABLOKOWANY albo ZAMKNIETY, odpowiedź 409) kończą zadanie błędem
ACCOUNT_OPENING_FAILED.
Proces zatrzymuje się wtedy na incydencie, a wniosek czeka na ponowienie
zadania przez administratora procesu.

## Obsługa zdarzeń granicznych

Graniczne zdarzenie błędu ACCOUNT_OPENING_FAILED tworzy incydent w silniku
z identyfikatorem wniosku; po usunięciu przyczyny administrator ponawia
zadanie od początku.

## Efekty uboczne

- Rachunek z wniosku zmienia stan z WNIOSEK na OTWARTY i dostaje numer IBAN; dla lokaty lokata dostaje stan ZALOZONA i oprocentowanie z oferty w dniu otwarcia.
- Otwarcie rachunku trafia do śladu audytowego wniosku.

## Kryteria akceptacji

### AC-01

- Given wniosek o rachunek osobisty z wynikiem weryfikacji automatycznej NO_MATCH i rachunkiem w stanie WNIOSEK
- When zadanie wywoła otwarcie rachunku
- Then zmienna accountNumber zawiera nadany numer IBAN, a rachunek ma stan OTWARTY

## Powiązane dokumenty

- API-013: otwarcie rachunku wołane przez zadanie.
- SPEC-WF-011 i SPEC-WF-012: zadania, które zapisują wynik weryfikacji i decyzję pracownika.
