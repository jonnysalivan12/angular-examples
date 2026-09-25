---
doc-id: CONV-002
title: "Autentykacja API"
description: "Rodzaje tokenów, którymi wywołujący potwierdza tożsamość w punktach końcowych API."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations: []
---

# Autentykacja API

## Cel

Ujednolicić sposób, w jaki punkt końcowy sprawdza, kto go wywołuje: klient,
pracownik, usługa albo osoba, która wypełnia wniosek bez logowania.

## Zakres

Wszystkie punkty końcowe API. Dokument API podaje rodzaj tokenu oraz wymaganą
rolę albo zakres.

## Zasady

### Token użytkownika

Klient i pracownik wywołują punkt końcowy tokenem JWT w nagłówku
`Authorization: Bearer {token}`. Identyfikator i rolę użytkownika punkt końcowy
bierze z tokenu, nie z treści żądania.

### Token usługi

Krok procesu i zadanie wsadowe wywołują punkt końcowy tokenem JWT usługi,
wydanym w przepływie client credentials, w nagłówku `Authorization`. Token ma
rolę System albo zakres podany w dokumencie API. Klient ani pracownik nie
wywoła punktu końcowego, który przyjmuje tylko token usługi.

### Token sesji wniosku

Punkt końcowy formularza wniosku, dostępny bez logowania do bankowości,
przyjmuje token sesji wniosku w nagłówku `X-Application-Session`.

### Odrzucenie wywołania

Wywołanie bez ważnego tokenu kończy się kodem 401, a wywołanie tokenem bez
wymaganej roli albo zakresu kodem 403. Treść odpowiedzi opisuje konwencja
„Model odpowiedzi błędnej API”.
