---
doc-id: SPEC-WF-014
title: "Publikacja otwarcia rachunku"
description: "Ostatnie zadanie procesu otwarcia rachunku: publikacja zdarzenia AccountOpened z numerem otwartego rachunku."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Katarzyna Wójcik"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: QUE-010
  - type: consumes
    target: SPEC-WF-013
---

# Publikacja otwarcia rachunku

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | account-service |

## Cel zadania

Ogłosić innym systemom banku, że rachunek został otwarty, tak aby mogły go
aktywować w systemie centralnym i potwierdzić otwarcie klientowi, bez
bezpośredniego wołania tych systemów przez proces. Zadanie powiadamia też
klienta e-mailem i SMS o otwarciu rachunku.

## Warunki wstępne

- Zadanie otwarcia rachunku zakończyło się sukcesem i zapisało numer rachunku.
- Rachunek ma stan OTWARTY.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| Zdarzenie | QUE-010 | Publikuje zdarzenie AccountOpened z numerem rachunku, kodem produktu i identyfikatorem wniosku |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| accountNumber | String (IBAN) | SPEC-WF-013 | Numer otwartego rachunku albo rachunku lokaty |
| applicationId | UUID | Start procesu (wysłanie wniosku) | Identyfikator wniosku, z którego powstał rachunek |
| productCode | String | Start procesu (wysłanie wniosku) | Kod wybranego produktu |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| accountOpenedMessageId | String | Identyfikator opublikowanego komunikatu, zapisany do wyjaśniania reklamacji i incydentów |

## Reguły i logika

- Jeśli accountNumber jest pusty, to zadanie nie publikuje zdarzenia, nie zleca powiadomienia i tworzy incydent w silniku.
- Jeśli zadanie jest ponawiane, to publikuje komunikat z tym samym identyfikatorem wyliczonym z applicationId, aby konsumenci mogli pominąć duplikat.
- Jeśli zadanie jest ponawiane, to zleca powiadomienie o otwarciu rachunku z tym samym kluczem idempotencji wyliczonym z applicationId, więc klient nie dostaje go drugi raz.
- Jeśli broker nie potwierdzi zapisu komunikatu w 5 sekund, to zadanie ponawia publikację do 3 razy, a potem tworzy incydent.

## Scenariusze błędów

Niedostępność brokera po ponowieniach zatrzymuje proces na incydencie przed
zdarzeniem końcowym. Rachunek pozostaje otwarty, ale nieaktywny, dopóki
administrator nie ponowi zadania i zdarzenie nie zostanie opublikowane.
Niedostępność usługi powiadomień po 3 ponowieniach też kończy się incydentem;
ponowione zadanie nie wysyła klientowi drugiego powiadomienia.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych; błędy publikacji obsługuje incydent
w silniku.

## Efekty uboczne

- Po publikacji system centralny aktywuje rachunek, a klient widzi potwierdzenie otwarcia na ekranie wniosku.
- Po publikacji account-service zleca w usłudze powiadomień banku e-mail i SMS do klienta o otwarciu rachunku z numerem IBAN.
- Proces kończy się zdarzeniem końcowym „Rachunek otwarty”.

## Kryteria akceptacji

### AC-01

- Given zadanie otwarcia rachunku zapisało numer rachunku PL61109010140000071219812874
- When zadanie opublikuje zdarzenie otwarcia rachunku
- Then broker potwierdza zapis komunikatu AccountOpened z tym numerem rachunku, a proces kończy się zdarzeniem końcowym „Rachunek otwarty”

## Powiązane dokumenty

- QUE-010: kontrakt publikowanego zdarzenia.
- SPEC-WF-013: zadanie, które zapisuje numer rachunku.
