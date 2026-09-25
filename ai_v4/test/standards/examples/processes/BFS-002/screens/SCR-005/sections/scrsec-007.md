---
doc-id: SCRSEC-007
title: "Decyzja w sprawie reklamacji"
description: "Decyzja UZNANA albo ODRZUCONA, kwota rekompensaty i uzasadnienie zapisywane przez pracownika zaplecza w zadaniu rozpatrzenia."
status: draft                                  # draft | active
owner: "Piotr Zieliński"
relations:
  - type: consumes
    target: ENT-Complaint
---

# Decyzja w sprawie reklamacji

## Opis sekcji

Sekcja służy pracownikowi zaplecza do rozstrzygnięcia reklamacji. Pracownik
wybiera decyzję, przy uznaniu wpisuje kwotę rekompensaty i uzasadnia decyzję.
Zapis decyzji kończy zadanie rozpatrzenia w silniku procesów. Sekcja pokazuje
pod polem kwoty kwotę reklamowanej dyspozycji z danych zadania, żeby pracownik
widział górną granicę rekompensaty.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Decyzja

| Atrybut | Wartość |
|---|---|
| Typ pola | przyciski opcji |
| Etykieta | Decyzja |
| Wartość domyślna | brak zaznaczenia |
| Wartość przykładowa | UZNANA |
| Źródło danych | ENT-Complaint (`decision`), puste dla reklamacji w rozpatrzeniu |
| Miejsce utrwalenia | ENT-Complaint (`decision`) |
| Edytowalność | tak |
| Wymagalność | tak |
| Uprawnienia | Pracownik zaplecza: edycja w zadaniu przypisanym do siebie |
| Walidacja | Jedna z wartości UZNANA, ODRZUCONA |
| Zachowanie | Wybór UZNANA pokazuje pole Kwota rekompensaty; wybór ODRZUCONA ukrywa je i czyści wpisaną kwotę |
| Tooltip | Uznanie reklamacji uruchamia wypłatę rekompensaty i korektę rozliczenia. |
| WCAG (atrybut aria) | `role="radiogroup"`, `aria-required="true"`, `aria-controls="kwota-rekompensaty"` |
| Analityka zdarzeń (opcjonalnie) | `complaint_decision_selected` z wartością decyzji |
| Referencja komponentu UI (opcjonalnie) | DS `RadioGroup` |

### Kwota rekompensaty

| Atrybut | Wartość |
|---|---|
| Typ pola | kwota w PLN |
| Etykieta | Kwota rekompensaty |
| Wartość domyślna | puste |
| Wartość przykładowa | 1 200,00 |
| Źródło danych | ENT-Complaint (`compensationAmount`), puste dla reklamacji w rozpatrzeniu |
| Miejsce utrwalenia | ENT-Complaint (`compensationAmount`) |
| Edytowalność | tak, gdy decyzja to UZNANA |
| Wymagalność | tak, gdy decyzja to UZNANA |
| Uprawnienia | Pracownik zaplecza: edycja w zadaniu przypisanym do siebie |
| Walidacja | Liczba dodatnia z najwyżej dwoma miejscami po przecinku; kwotę wyższą niż kwota reklamowanej dyspozycji odrzuca zapis decyzji, a komunikat pojawia się przy polu |
| Zachowanie | Pod polem tekst „Kwota dyspozycji: 3 450,00 PLN” z danych zadania; pole widoczne tylko przy decyzji UZNANA |
| Tooltip | Rekompensata nie może przekroczyć kwoty reklamowanej dyspozycji. |
| WCAG (atrybut aria) | `aria-required="true"`, `aria-describedby="kwota-dyspozycji"`, `inputmode="decimal"` |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | DS `AmountInput` |

### Uzasadnienie

| Atrybut | Wartość |
|---|---|
| Typ pola | pole tekstowe wielowierszowe |
| Etykieta | Uzasadnienie decyzji |
| Wartość domyślna | puste |
| Wartość przykładowa | Księga główna potwierdza podwójne obciążenie pozycji nr 3; uznano kwotę tej pozycji. |
| Źródło danych | — (nowa decyzja) |
| Miejsce utrwalenia | ENT-Complaint (`justification`) |
| Edytowalność | tak |
| Wymagalność | tak |
| Uprawnienia | Pracownik zaplecza: edycja w zadaniu przypisanym do siebie |
| Walidacja | Od 1 do 1000 znaków, bez samych spacji |
| Zachowanie | Licznik pozostałych znaków pod polem; treść zapisywana razem z decyzją, z retencją 5 lat w śladzie audytowym |
| Tooltip | Uzasadnienie widzi audyt wewnętrzny; podaj fakty, na których opiera się decyzja. |
| WCAG (atrybut aria) | `aria-required="true"`, `aria-describedby="uzasadnienie-licznik"` |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | DS `TextArea` z licznikiem |

## Reguły biznesowe

- Rekompensata nie przekracza kwoty reklamowanej dyspozycji.
- Reklamacja odrzucona nie ma kwoty rekompensaty.
- Każda decyzja, także odrzucenie, ma uzasadnienie.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
po zmianie pola Decyzja:
  jeśli decyzja = UZNANA:
    pokaż pole Kwota rekompensaty i oznacz je jako wymagane
  jeśli decyzja = ODRZUCONA:
    wyczyść i ukryj pole Kwota rekompensaty
przycisk "Zapisz decyzję" aktywny, gdy:
  decyzja wybrana
  i (decyzja = ODRZUCONA albo kwota rekompensaty > 0)
  i uzasadnienie ma od 1 do 1000 znaków
```
