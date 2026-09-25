---
doc-id: SCRSEC-001
title: "Dane klienta"
description: "Dane zleceniodawcy z profilu klienta: imię i nazwisko, PESEL i adres korespondencyjny, tylko do odczytu."
status: draft                                  # draft | active
owner: "Anna Nowak"
relations:
  - type: consumes
    target: ENT-Client
---

# Dane klienta

## Opis sekcji

Sekcja pokazuje dane klienta, który składa albo koryguje dyspozycję: imię
i nazwisko, PESEL i adres korespondencyjny z profilu klienta. Wszystkie pola są
tylko do odczytu. Sekcja nie woła usług, nie sprawdza danych i nie blokuje
przejścia do kolejnego kroku.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Imię i nazwisko

| Atrybut | Wartość |
|---|---|
| Typ pola | Tekst tylko do odczytu |
| Etykieta | Imię i nazwisko |
| Wartość domyślna | Imię i nazwisko z profilu klienta |
| Wartość przykładowa | Maria Wiśniewska |
| Źródło danych | ENT-Client (firstName, lastName) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt własnych danych |
| Walidacja | — (pole tylko do odczytu) |
| Zachowanie | Brak wywołań; pole pokazuje imię i nazwisko z profilu klienta |
| Tooltip | Zmianę imienia lub nazwiska zgłosisz w oddziale |
| WCAG (atrybut aria) | aria-readonly="true" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-read-only-text |

### PESEL

| Atrybut | Wartość |
|---|---|
| Typ pola | Tekst tylko do odczytu, 11 cyfr |
| Etykieta | PESEL |
| Wartość domyślna | Numer PESEL z profilu klienta |
| Wartość przykładowa | 85010112345 |
| Źródło danych | ENT-Client (pesel) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt własnego numeru |
| Walidacja | — (pole tylko do odczytu) |
| Zachowanie | Brak wywołań; pole pokazuje numer PESEL z profilu klienta |
| Tooltip | Numer PESEL z Twojego profilu w banku |
| WCAG (atrybut aria) | aria-readonly="true" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-read-only-text |

### Adres korespondencyjny

| Atrybut | Wartość |
|---|---|
| Typ pola | Tekst tylko do odczytu |
| Etykieta | Adres korespondencyjny |
| Wartość domyślna | Adres korespondencyjny z profilu klienta |
| Wartość przykładowa | ul. Marszałkowska 12/4, 00-590 Warszawa |
| Źródło danych | ENT-Client (address) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt własnego adresu korespondencyjnego |
| Walidacja | — (pole tylko do odczytu) |
| Zachowanie | Brak wywołań; pole pokazuje adres z profilu klienta |
| Tooltip | Na ten adres wyślemy korespondencję papierową |
| WCAG (atrybut aria) | aria-readonly="true" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-read-only-text |

## Reguły biznesowe

- Sekcja pokazuje dane z profilu klienta bez ich sprawdzania; przejście do kolejnego kroku od nich nie zależy.
- Formularz dyspozycji nie zmienia danych klienta: imię, nazwisko, PESEL i adres korespondencyjny zmienia się poza obsługą dyspozycji.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

Sekcja nie ma zachowań specjalnych: nie woła usług i nie wpływa na nawigację
ekranu.
