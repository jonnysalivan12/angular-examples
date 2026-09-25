---
doc-id: SPEC-WF-012
title: "Ręczna weryfikacja tożsamości"
description: "Zadanie użytkownika w procesie otwarcia rachunku: pracownik zaplecza rozstrzyga weryfikację tożsamości, której system nie rozstrzygnął."
status: draft                                  # draft | active
task-type: user-task                           # service-task | user-task | script-task | call-activity
owner: "Katarzyna Wójcik"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: SPEC-WF-011
  - type: involves
    target: ACTOR-001.ROLE-02
---

# Ręczna weryfikacja tożsamości

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | ACTOR-001.ROLE-02 |

## Cel zadania

Uzyskać decyzję pracownika zaplecza, gdy weryfikacja automatyczna dała wynik
niejednoznaczny albo nie dała wyniku: pracownik porównuje zdjęcie dokumentu
z danymi wnioskodawcy i rejestrem PESEL, a proces na podstawie decyzji otwiera
rachunek albo odrzuca wniosek.

## Warunki wstępne

- Zadanie weryfikacji automatycznej zakończyło się wynikiem POSSIBLE_MATCH albo błędem niedostępności.
- Jeśli rejestr PESEL odpowiedział w weryfikacji automatycznej, zdjęcie dokumentu tożsamości wnioskodawcy jest zapisane przy wniosku.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| — | — | Zadanie nie woła zasobów |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| applicationId | UUID | Start procesu (wysłanie wniosku) | Identyfikator wniosku, którego dotyczy weryfikacja |
| pesel | String | Start procesu (wysłanie wniosku) | Numer PESEL wnioskodawcy |
| firstName | String | Start procesu (wysłanie wniosku) | Imię wnioskodawcy |
| lastName | String | Start procesu (wysłanie wniosku) | Nazwisko wnioskodawcy |
| birthDate | Date | Start procesu (wysłanie wniosku) | Data urodzenia wnioskodawcy |
| verificationId | String | SPEC-WF-011 | Identyfikator weryfikacji automatycznej; pusty, gdy usługa weryfikacji nie odpowiedziała krokowi weryfikacji automatycznej |
| verificationResult | Enum: NO_MATCH, POSSIBLE_MATCH, MATCH | SPEC-WF-011 | Wynik weryfikacji automatycznej; pusty po błędzie niedostępności |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| manualDecision | Enum: ZATWIERDZONA, ODRZUCONA | Decyzja pracownika zaplecza |
| rejectionReason | String | Uzasadnienie odrzucenia; pusty przy decyzji ZATWIERDZONA |

## Reguły i logika

- Jeśli manualDecision ma wartość ODRZUCONA, to rejectionReason jest wymagane i ma od 10 do 500 znaków.
- Jeśli zadanie jest przypisane do pracownika, to zakończyć je może tylko ten pracownik.

## Scenariusze błędów

Gdy rejestr PESEL jest niedostępny, pracownik odkłada zadanie: zadanie wraca do
puli pracowników zaplecza bez decyzji i proces czeka dalej. Gdy zapis decyzji
się nie powiedzie, zadanie pozostaje otwarte, a pracownik może ponowić zapis.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych; proces czeka na decyzję pracownika bez
limitu czasu.

## Efekty uboczne

- Decyzja, uzasadnienie i identyfikator pracownika trafiają do śladu audytowego wniosku.
- Zadanie nie zmienia stanu rachunku. Po decyzji ODRZUCONA proces przechodzi do zadania „Odrzucenie wniosku o rachunek”, które zamyka rachunek z wniosku i powiadamia klienta.

## Kryteria akceptacji

### AC-01

- Given zadanie ręcznej weryfikacji z wynikiem POSSIBLE_MATCH jest przypisane do pracownika zaplecza
- When pracownik zapisze decyzję ZATWIERDZONA
- Then zadanie kończy się ze zmienną manualDecision o wartości ZATWIERDZONA, a proces przechodzi do otwarcia rachunku w systemie

## Powiązane dokumenty

- SPEC-WF-011: zadanie, które zapisuje wynik weryfikacji automatycznej.
