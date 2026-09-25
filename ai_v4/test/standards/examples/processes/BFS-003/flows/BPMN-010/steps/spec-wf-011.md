---
doc-id: SPEC-WF-011
title: "Automatyczna weryfikacja tożsamości"
description: "Zadanie procesu otwarcia rachunku, które woła weryfikację automatyczną i zapisuje jej wynik dla bramki procesu."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Katarzyna Wójcik"
relations:
  - type: contains
    target: AC-01
  - type: contains
    target: AC-02
  - type: consumes
    target: API-011
---

# Automatyczna weryfikacja tożsamości

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | identity-verification-service |

## Cel zadania

Ustalić bez udziału pracownika, czy tożsamość wnioskodawcy jest potwierdzona:
zadanie przekazuje dane z wniosku do weryfikacji automatycznej (rejestr PESEL
i lista sankcyjna) i zapisuje wynik, na podstawie którego proces otwiera
rachunek, kieruje wniosek do pracownika albo go odrzuca.

## Warunki wstępne

- Wniosek o rachunek jest zapisany, a rachunek ma stan WNIOSEK.
- Zmienne applicationId, pesel, firstName, lastName i birthDate są ustawione przy starcie procesu.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| API | API-011 | Wysyła identyfikator wniosku, PESEL, imię, nazwisko i datę urodzenia wnioskodawcy; z odpowiedzi 201 odczytuje identyfikator weryfikacji i jej wynik, a z odpowiedzi 503 sam identyfikator weryfikacji |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| applicationId | UUID | Start procesu (wysłanie wniosku) | Identyfikator wniosku o rachunek |
| pesel | String | Start procesu (wysłanie wniosku) | Numer PESEL wnioskodawcy |
| firstName | String | Start procesu (wysłanie wniosku) | Imię wnioskodawcy |
| lastName | String | Start procesu (wysłanie wniosku) | Nazwisko wnioskodawcy |
| birthDate | Date | Start procesu (wysłanie wniosku) | Data urodzenia wnioskodawcy |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| verificationId | String | Identyfikator weryfikacji, po którym pracownik pobiera jej szczegóły; z odpowiedzi 201 albo 503, pusty, gdy usługa weryfikacji nie odpowiedziała |
| verificationResult | Enum: NO_MATCH, POSSIBLE_MATCH, MATCH | Wynik weryfikacji automatycznej; pusty, gdy zadanie zgłosiło błąd niedostępności |

## Reguły i logika

- Jeśli odpowiedź zawiera wynik NO_MATCH, POSSIBLE_MATCH albo MATCH, to zadanie zapisuje go w verificationResult bez zmian.
- Jeśli wywołanie kończy się przekroczeniem czasu albo błędem 5xx, to zadanie ponawia je do 3 razy w odstępie 30 sekund.
- Jeśli trzecie ponowienie też się nie powiedzie, to zadanie zgłasza błąd BPMN IDENTITY_VERIFICATION_UNAVAILABLE.
- Jeśli któraś odpowiedź 503 zawierała verificationId, to zadanie zapisuje go w zmiennej verificationId przed zgłoszeniem błędu IDENTITY_VERIFICATION_UNAVAILABLE.
- Jeśli żadna próba nie dostała odpowiedzi z verificationId, bo usługa weryfikacji nie odpowiedziała w limicie czasu, to zadanie zgłasza błąd IDENTITY_VERIFICATION_UNAVAILABLE z pustą zmienną verificationId.
- Jeśli wywołanie zwraca błąd 400 (niekompletne dane wnioskodawcy), to zadanie nie ponawia wywołania i tworzy incydent w silniku.

## Scenariusze błędów

Niedostępność usługi weryfikacji albo systemów, z których ona korzysta, kończy
się po ponowieniach błędem BPMN; wniosek nie jest odrzucany, tylko trafia do
pracownika. Błąd 400 oznacza wadliwe dane zapisane we wniosku: zadanie tworzy
incydent z kodem błędu, a administrator procesu poprawia dane i ponawia zadanie.

## Obsługa zdarzeń granicznych

Graniczne zdarzenie błędu IDENTITY_VERIFICATION_UNAVAILABLE przerywa zadanie
i przenosi wniosek do zadania ręcznej weryfikacji tożsamości z pustą zmienną
verificationResult. Zmienna verificationId zawiera identyfikator z odpowiedzi
503 zapisany przed zgłoszeniem błędu albo jest pusta, gdy usługa weryfikacji
nie odpowiedziała; wtedy pracownik otwiera weryfikację po identyfikatorze
wniosku.

## Efekty uboczne

- Usługa weryfikacji zapisuje wynik i jego uzasadnienie w śladzie audytowym wniosku.
- Zadanie nie zmienia stanu rachunku; rachunek pozostaje w stanie WNIOSEK, a stan zmienia dopiero otwarcie rachunku albo odrzucenie wniosku.

## Kryteria akceptacji

### AC-01

- Given wniosek z danymi zgodnymi z rejestrem PESEL i wnioskodawca spoza listy sankcyjnej
- When zadanie wywoła weryfikację automatyczną
- Then verificationResult ma wartość NO_MATCH, a proces przechodzi do otwarcia rachunku w systemie

### AC-02

- Given usługa weryfikacji nie odpowiada w limicie czasu
- When nie powiedzie się trzecie ponowienie wywołania
- Then zadanie zgłasza błąd IDENTITY_VERIFICATION_UNAVAILABLE, a proces tworzy zadanie ręcznej weryfikacji z pustymi zmiennymi verificationResult i verificationId

## Powiązane dokumenty

- API-011: weryfikacja automatyczna wołana przez zadanie.
