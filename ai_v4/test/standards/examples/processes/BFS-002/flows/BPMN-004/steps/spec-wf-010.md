---
doc-id: SPEC-WF-010
title: "Powiadomienie kierownika o eskalacji"
description: "Zadanie serwisowe procesu eskalacji, które oznacza reklamację bez decyzji po 14 dniach jako eskalowaną i wysyła o niej e-mail kierownikowi zespołu reklamacji."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: INT-005
  - type: consumes
    target: SPEC-WF-005
---

# Powiadomienie kierownika o eskalacji

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | complaint-service |

## Cel zadania

Oznaczyć reklamację, która czeka na decyzję dłużej niż 14 dni, jako
eskalowaną, powiadomić o niej kierownika zespołu reklamacji i wskazać
pracownika, do którego przypisano zadanie rozpatrzenia.

## Warunki wstępne

- Proces „Eskalacja przeterminowanej reklamacji” wystartował komunikatem, który wysłał timer graniczny SPEC-WF-005 w procesie „Obsługa reklamacji”, ze zmiennymi complaintId i assignee.
- Reklamacja nie ma decyzji: status W_ROZPATRZENIU, a przy ponowieniu zadania ESKALOWANA.
- Konfiguracja serwisu complaint-service zawiera adres skrzynki kierownika zespołu reklamacji.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| Integracja | INT-005 | Wysyła wiadomość na adres kierownika z konfiguracji serwisu: szablon eskalacji z numerem reklamacji, loginem przypisanego pracownika i odnośnikiem do zadania rozpatrzenia; z odpowiedzi odczytuje identyfikator wiadomości |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| complaintId | UUID | SPEC-WF-005 | Identyfikator reklamacji bez decyzji po 14 dniach, przekazany w komunikacie startowym |
| assignee | String | SPEC-WF-005 | Login pracownika przypisanego do zadania rozpatrzenia, przekazany w komunikacie startowym; pusty, gdy zadanie czeka w kolejce zespołu |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| messageId | String | Identyfikator wiadomości nadany przez bramkę e-mail |

## Reguły i logika

- Jeśli reklamacja ma status W_ROZPATRZENIU, to zadanie zmienia go na ESKALOWANA przed wysłaniem wiadomości.
- Jeśli reklamacja ma już status ESKALOWANA, bo silnik ponawia zadanie po nieudanym wysłaniu, to zadanie nie zmienia statusu i ponawia tylko wysłanie wiadomości.
- Jeśli bramka e-mail przyjmie wiadomość, to zadanie zapisuje messageId, a proces kończy się zdarzeniem „Kierownik powiadomiony”.
- Jeśli assignee jest pusty, to treść wiadomości mówi, że zadanie czeka w kolejce zespołu bez przypisanego pracownika.
- Jeśli konfiguracja nie zawiera adresu kierownika, to zadanie nie woła INT-005 i kończy się incydentem.

## Scenariusze błędów

Bramka e-mail niedostępna albo błąd 5xx: silnik ponawia zadanie 3 razy co
5 minut (cykl `R3/PT5M`), a potem zgłasza incydent; reklamacja pozostaje
w statusie ESKALOWANA. Odrzucenie adresu przez bramkę (błąd 4xx): incydent bez
ponowień, administrator procesu poprawia konfigurację i wznawia instancję.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych.

## Efekty uboczne

Reklamacja przechodzi do statusu ESKALOWANA, zanim zadanie wyśle wiadomość.
Kierownik zespołu reklamacji dostaje wiadomość e-mail. Zadanie nie zmienia
przypisania zadania rozpatrzenia.

## Kryteria akceptacji

### AC-01

- Given reklamacja w statusie W_ROZPATRZENIU jest bez decyzji od 14 dni, a zadanie rozpatrzenia jest przypisane do pracownika zaplecza
- When proces eskalacji wykonuje zadanie powiadomienia kierownika
- Then reklamacja ma status ESKALOWANA, bramka e-mail przyjmuje jedną wiadomość do kierownika zespołu reklamacji z identyfikatorem reklamacji i loginem przypisanego pracownika, a instancja ma zmienną messageId

## Powiązane dokumenty

- INT-005: wysłanie wiadomości przez bramkę e-mail.
- SPEC-WF-005: zadanie rozpatrzenia w procesie „Obsługa reklamacji”, którego timer graniczny uruchamia eskalację i przekazuje zmienne wejściowe.
