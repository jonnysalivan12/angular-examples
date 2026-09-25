---
doc-id: SCRSEC-013
title: "Dokument tożsamości"
description: "Sekcja zadania ręcznej weryfikacji: zdjęcie i numer dokumentu, wynik porównania danych klienta i decyzja pracownika."
status: draft                                  # draft | active
owner: "Katarzyna Wójcik"
relations:
  - type: consumes
    target: ENT-Client
---

# Dokument tożsamości

## Opis sekcji

Sekcja pokazuje pracownikowi zaplecza zdjęcie dokumentu tożsamości wnioskodawcy,
numer dokumentu i wynik porównania danych klienta z rejestrem PESEL oraz listą
sankcyjną. Pracownik wybiera w niej decyzję, która kończy zadanie ręcznej
weryfikacji w procesie otwarcia rachunku.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Zdjęcie dokumentu

| Atrybut | Wartość |
|---|---|
| Typ pola | Podgląd obrazu z powiększeniem i obrotem |
| Etykieta | Zdjęcie dokumentu tożsamości |
| Wartość domyślna | Awers dokumentu |
| Wartość przykładowa | Awers i rewers dowodu osobistego, JPG |
| Źródło danych | — (szczegóły weryfikacji tożsamości pobierane przy otwarciu zadania) |
| Miejsce utrwalenia | — (tylko odczyt) |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Pracownik zaplecza: odczyt |
| Walidacja | Brak |
| Zachowanie | Przełącznik awers/rewers; obraz nie jest zapisywany w pamięci przeglądarki |
| Tooltip | Kliknij, aby powiększyć |
| WCAG (atrybut aria) | alt="Zdjęcie dokumentu tożsamości wnioskodawcy", przyciski powiększenia z aria-label |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ImageViewer |

### Numer dokumentu

| Atrybut | Wartość |
|---|---|
| Typ pola | Tekst tylko do odczytu, maskowany |
| Etykieta | Numer dokumentu |
| Wartość domyślna | Numer zamaskowany poza ostatnimi czterema znakami |
| Wartość przykładowa | ABC•••456 |
| Źródło danych | — (szczegóły weryfikacji tożsamości pobierane przy otwarciu zadania) |
| Miejsce utrwalenia | — (tylko odczyt) |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Pracownik zaplecza: odczyt, odsłonięcie pełnego numeru |
| Walidacja | Brak |
| Zachowanie | Przycisk „Pokaż” odsłania pełny numer na 30 sekund; każde odsłonięcie trafia do śladu audytowego |
| Tooltip | Pełny numer pokazuj tylko do porównania ze zdjęciem |
| WCAG (atrybut aria) | aria-live="polite" przy odsłonięciu numeru |
| Analityka zdarzeń (opcjonalnie) | zaplecze_weryfikacja_numer_odsloniety |
| Referencja komponentu UI (opcjonalnie) | MaskedText |

### Wynik porównania

| Atrybut | Wartość |
|---|---|
| Typ pola | Tabela tylko do odczytu: dane z wniosku, dane z rejestru, zgodność |
| Etykieta | Wynik porównania danych |
| Wartość domyślna | Wynik weryfikacji automatycznej |
| Wartość przykładowa | Nazwisko: „Kowalsky” we wniosku, „Kowalski” w rejestrze, zgodne w granicy tolerancji; lista sankcyjna: POSSIBLE_MATCH |
| Źródło danych | ENT-Client (atrybuty pesel, firstName, lastName, birthDate) zestawione z wynikiem weryfikacji automatycznej |
| Miejsce utrwalenia | — (tylko odczyt) |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Pracownik zaplecza: odczyt |
| Walidacja | Brak |
| Zachowanie | Wiersze z rozbieżnością są wyróżnione; brak wyniku automatycznego pokazuje komunikat „Weryfikacja automatyczna niedostępna – porównaj dane ręcznie” |
| Tooltip | Wynik POSSIBLE_MATCH oznacza, że system nie rozstrzygnął zgodności |
| WCAG (atrybut aria) | Tabela z nagłówkami scope="col"; rozbieżność oznaczona tekstem, nie tylko kolorem |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ComparisonTable |

### Decyzja

| Atrybut | Wartość |
|---|---|
| Typ pola | Przyciski wyboru (radio) z polem uzasadnienia |
| Etykieta | Decyzja weryfikacji |
| Wartość domyślna | Brak wyboru |
| Wartość przykładowa | ZATWIERDZONA |
| Źródło danych | — (wybiera pracownik) |
| Miejsce utrwalenia | — (zmienna procesu manualDecision, zapisywana przy zakończeniu zadania) |
| Edytowalność | tak |
| Wymagalność | tak |
| Uprawnienia | Pracownik zaplecza: wybór i zapis |
| Walidacja | Wybrana wartość ZATWIERDZONA albo ODRZUCONA; przy ODRZUCONA uzasadnienie od 10 do 500 znaków |
| Zachowanie | Wybór ODRZUCONA pokazuje wymagane pole uzasadnienia; zapis kończy zadanie w silniku procesów |
| Tooltip | Odrzuć, gdy zdjęcie albo dane dokumentu nie zgadzają się z danymi wnioskodawcy |
| WCAG (atrybut aria) | role="radiogroup", aria-required="true" |
| Analityka zdarzeń (opcjonalnie) | zaplecze_weryfikacja_decyzja z wartością decyzji |
| Referencja komponentu UI (opcjonalnie) | DecisionRadioGroup |

## Reguły biznesowe

- Decyzję zapisuje tylko pracownik zaplecza przypisany do zadania.
- Odrzucenie wymaga uzasadnienia, które trafia do śladu audytowego wniosku.
- Numer dokumentu jest maskowany; pełny numer widać tylko po świadomym odsłonięciu.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
gdy Decyzja = ODRZUCONA:
    pokaż Uzasadnienie (wymagane)
gdy zadanie przypisane do innego pracownika:
    wszystkie pola tylko do odczytu, przycisk "Zatwierdź decyzję" ukryty
```
