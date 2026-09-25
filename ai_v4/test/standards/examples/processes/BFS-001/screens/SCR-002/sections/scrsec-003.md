---
doc-id: SCRSEC-003
title: "Podsumowanie kwot"
description: "Kwota łączna, waluta i liczba pozycji dyspozycji przed zatwierdzeniem, tylko do odczytu."
status: draft                                  # draft | active
owner: "Anna Nowak"
relations:
  - type: consumes
    target: ENT-Disposition
---

# Podsumowanie kwot

## Opis sekcji

Sekcja zamyka ekran podsumowania. Pokazuje kwotę łączną, walutę i liczbę
pozycji dyspozycji, żeby klient sprawdził je przed zatwierdzeniem. Wszystkie
pola są tylko do odczytu.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Kwota łączna

| Atrybut | Wartość |
|---|---|
| Typ pola | Tekst tylko do odczytu, format kwoty |
| Etykieta | Kwota łączna |
| Wartość domyślna | Suma kwot pozycji dyspozycji |
| Wartość przykładowa | 1 250,00 |
| Źródło danych | ENT-Disposition (totalAmount) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt własnej dyspozycji |
| Walidacja | — |
| Zachowanie | Bez wywołań; przy złożeniu wartość wynika z pozycji z kroku 1, przy korekcie to kwota zapisanej dyspozycji |
| Tooltip | Łączna kwota wszystkich pozycji dyspozycji |
| WCAG (atrybut aria) | aria-label="Kwota łączna dyspozycji" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-summary-amount |

### Waluta

| Atrybut | Wartość |
|---|---|
| Typ pola | Tekst tylko do odczytu |
| Etykieta | Waluta |
| Wartość domyślna | Waluta rachunku obciążanego |
| Wartość przykładowa | PLN |
| Źródło danych | ENT-Disposition (currency) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt własnej dyspozycji |
| Walidacja | — |
| Zachowanie | Bez wywołań |
| Tooltip | — |
| WCAG (atrybut aria) | aria-label="Waluta dyspozycji" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-read-only-text |

### Liczba pozycji

| Atrybut | Wartość |
|---|---|
| Typ pola | Tekst tylko do odczytu, liczba całkowita |
| Etykieta | Liczba pozycji |
| Wartość domyślna | Liczba pozycji w dyspozycji |
| Wartość przykładowa | 5 |
| Źródło danych | ENT-Disposition (liczba pozycji dyspozycji) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt własnej dyspozycji |
| Walidacja | — |
| Zachowanie | Bez wywołań |
| Tooltip | — |
| WCAG (atrybut aria) | aria-label="Liczba pozycji dyspozycji" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-read-only-text |

## Reguły biznesowe

- Kwota łączna jest równa sumie kwot pozycji; ekran nie pokazuje podsumowania dyspozycji z niezgodną sumą.
- Liczba pozycji mieści się w przedziale od 1 do 50.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

Kwota łączna ma polski format: spacja oddziela tysiące, a przecinek grosze,
np. 1 250,00. Sekcja nie ma innych zachowań specjalnych.
