---
doc-id: SPEC-WF-015
title: "Odrzucenie wniosku o rachunek"
description: "Zadanie procesu otwarcia rachunku, które po negatywnej weryfikacji tożsamości zamyka rachunek z wniosku i powiadamia klienta o odrzuceniu wniosku."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Katarzyna Wójcik"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: SPEC-WF-011
  - type: consumes
    target: SPEC-WF-012
---

# Odrzucenie wniosku o rachunek

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | account-service |

## Cel zadania

Zamknąć wniosek, którego wnioskodawca nie przeszedł weryfikacji tożsamości:
rachunek z wniosku przechodzi do stanu ZAMKNIETY, a klient dostaje
powiadomienie o odrzuceniu wniosku, zanim proces zakończy się zdarzeniem
końcowym „Wniosek odrzucony”. Zadanie leży na obu ścieżkach odrzucenia: po
wyniku MATCH weryfikacji automatycznej i po decyzji ODRZUCONA pracownika
zaplecza.

## Warunki wstępne

- Bramka „Wynik weryfikacji automatycznej” wybrała ścieżkę MATCH albo bramka „Decyzja pracownika” wybrała ścieżkę ODRZUCONA.
- Rachunek z wniosku ma stan WNIOSEK, a przy ponowieniu zadania także ZAMKNIETY.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| — | — | Zadanie nie woła API, integracji ani zdarzeń; account-service zmienia stan rachunku we własnej bazie i zleca powiadomienie w usłudze powiadomień banku |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| applicationId | UUID | Start procesu (wysłanie wniosku) | Identyfikator wniosku, którego rachunek zadanie zamyka; z niego powstaje klucz idempotencji powiadomienia |
| verificationResult | Enum: NO_MATCH, POSSIBLE_MATCH, MATCH | SPEC-WF-011 | Wynik weryfikacji automatycznej; MATCH na ścieżce listy sankcyjnej |
| manualDecision | Enum: ZATWIERDZONA, ODRZUCONA | SPEC-WF-012 | Decyzja pracownika; pusta na ścieżce MATCH |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| rejectedAt | DateTime | Czas zamknięcia rachunku z wniosku |
| rejectionNotificationId | String | Identyfikator powiadomienia zleconego w usłudze powiadomień, do wyjaśniania reklamacji i incydentów |

## Reguły i logika

- Jeśli verificationResult ma wartość MATCH albo manualDecision ma wartość ODRZUCONA, to zadanie zmienia stan rachunku z wniosku z WNIOSEK na ZAMKNIETY i zleca powiadomienie klienta o odrzuceniu wniosku.
- Jeśli żaden z tych warunków nie jest spełniony, to zadanie nie zmienia rachunku, nie zleca powiadomienia i tworzy incydent w silniku.
- Jeśli rachunek z wniosku ma już stan ZAMKNIETY, to zadanie nie zmienia stanu, a powiadomienie zleca z tym samym kluczem idempotencji wyliczonym z applicationId, więc klient nie dostaje go drugi raz.
- Jeśli rachunek z wniosku ma stan inny niż WNIOSEK albo ZAMKNIETY, to zadanie nie zmienia stanu i tworzy incydent w silniku.
- Jeśli wniosek dotyczy lokaty, to zadanie zamyka rachunek lokaty tak samo, a lokata nie wchodzi w cykl życia lokaty.
- Jeśli wniosek odrzucono po wyniku MATCH, to powiadomienie ma tę samą treść co po decyzji pracownika i nie podaje przyczyny odrzucenia.

## Scenariusze błędów

Błąd zapisu stanu rachunku albo niedostępność usługi powiadomień: zadanie
ponawia operację do 3 razy w odstępie 30 sekund, a potem tworzy incydent
w silniku. Proces zatrzymuje się przed zdarzeniem końcowym „Wniosek odrzucony”,
a administrator procesu ponawia zadanie po usunięciu przyczyny. Klucz
idempotencji z applicationId sprawia, że ponowienie nie wysyła klientowi
drugiego powiadomienia.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych; błędy obsługuje incydent w silniku.

## Efekty uboczne

- Rachunek z wniosku zmienia stan z WNIOSEK na ZAMKNIETY.
- Klient dostaje powiadomienie e-mail i SMS o odrzuceniu wniosku.
- Odrzucenie wniosku z czasem i ścieżką odrzucenia (wynik weryfikacji automatycznej albo decyzja pracownika) trafia do śladu audytowego wniosku.
- Proces kończy się zdarzeniem końcowym „Wniosek odrzucony”.

## Kryteria akceptacji

### AC-01

- Given weryfikacja automatyczna zapisała verificationResult o wartości MATCH, a rachunek z wniosku ma stan WNIOSEK
- When zadanie odrzucenia wniosku się wykona
- Then rachunek ma stan ZAMKNIETY, klient dostaje powiadomienie o odrzuceniu wniosku bez podania przyczyny, a proces kończy się zdarzeniem końcowym „Wniosek odrzucony”

## Powiązane dokumenty

- SPEC-WF-011 i SPEC-WF-012: zadania, które zapisują wynik weryfikacji automatycznej i decyzję pracownika.
