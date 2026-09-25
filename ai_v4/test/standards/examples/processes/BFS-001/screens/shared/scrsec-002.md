---
doc-id: SCRSEC-002
title: "Pozycje dyspozycji"
description: "Lista pozycji dyspozycji z rachunkiem odbiorcy, kwotą i tytułem: edytowalna przy składaniu, przy korekcie tylko kwota, na podsumowaniu tylko do odczytu."
status: draft                                  # draft | active
owner: "Anna Nowak"
relations:
  - type: consumes
    target: ENT-DispositionItem
---

# Pozycje dyspozycji

## Opis sekcji

Sekcja pokazuje listę pozycji dyspozycji; każda pozycja to jeden przelew do
odbiorcy. Przy składaniu dyspozycji klient dodaje, usuwa i wypełnia pozycje,
przy korekcie zmienia tylko kwoty istniejących pozycji, a na podsumowaniu
sekcja jest tylko do odczytu. Pod listą sekcja pokazuje sumę kwot pozycji.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Rachunek odbiorcy

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole tekstowe z maską numeru rachunku |
| Etykieta | Rachunek odbiorcy |
| Wartość domyślna | Puste w nowej pozycji; przy korekcie numer z pozycji |
| Wartość przykładowa | PL61 1090 1014 0000 0712 1981 2874 |
| Źródło danych | ENT-DispositionItem (beneficiaryAccount) |
| Miejsce utrwalenia | ENT-DispositionItem (beneficiaryAccount) |
| Edytowalność | tak przy składaniu; nie przy korekcie i na podsumowaniu |
| Wymagalność | tak |
| Uprawnienia | Klient: edycja pozycji własnej dyspozycji |
| Walidacja | Numer rachunku w formacie IBAN (26 cyfr po prefiksie PL) z poprawną sumą kontrolną |
| Zachowanie | Bez wywołań; numer jest sprawdzany lokalnie po opuszczeniu pola |
| Tooltip | Wpisz 26 cyfr numeru rachunku odbiorcy |
| WCAG (atrybut aria) | aria-required="true", aria-invalid="true" przy błędnej sumie kontrolnej |
| Analityka zdarzeń (opcjonalnie) | disposition_item_account_invalid |
| Referencja komponentu UI (opcjonalnie) | ds-iban-field |

### Kwota

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole kwotowe, 2 miejsca po przecinku |
| Etykieta | Kwota |
| Wartość domyślna | Puste w nowej pozycji; przy korekcie kwota z pozycji |
| Wartość przykładowa | 250,00 |
| Źródło danych | ENT-DispositionItem (amount) |
| Miejsce utrwalenia | ENT-DispositionItem (amount) |
| Edytowalność | tak przy składaniu i korekcie; nie na podsumowaniu |
| Wymagalność | tak |
| Uprawnienia | Klient: edycja pozycji własnej dyspozycji |
| Walidacja | Większa od zera i nie większa niż 1 000 000 PLN |
| Zachowanie | Bez wywołań; zmiana kwoty przelicza sumę pozycji pod listą |
| Tooltip | Kwota jednej pozycji, najwyżej 1 000 000 PLN |
| WCAG (atrybut aria) | aria-required="true", aria-describedby wskazuje sumę pozycji |
| Analityka zdarzeń (opcjonalnie) | disposition_item_amount_changed |
| Referencja komponentu UI (opcjonalnie) | ds-amount-field |

### Tytuł

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole tekstowe z licznikiem znaków |
| Etykieta | Tytuł |
| Wartość domyślna | Puste w nowej pozycji; przy korekcie tytuł z pozycji |
| Wartość przykładowa | Faktura FV/2026/09/118 |
| Źródło danych | ENT-DispositionItem (title) |
| Miejsce utrwalenia | ENT-DispositionItem (title) |
| Edytowalność | tak przy składaniu; nie przy korekcie i na podsumowaniu |
| Wymagalność | tak |
| Uprawnienia | Klient: edycja pozycji własnej dyspozycji |
| Walidacja | Od 1 do 140 znaków, bez znaków sterujących |
| Zachowanie | Bez wywołań |
| Tooltip | Tytuł zobaczy odbiorca przelewu |
| WCAG (atrybut aria) | aria-required="true", aria-describedby wskazuje licznik znaków |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-text-field |

## Reguły biznesowe

- Dyspozycja ma od 1 do 50 pozycji: przycisk dodania pozycji znika po dodaniu pięćdziesiątej, a usunięcie jedynej pozycji jest zablokowane.
- Suma kwot pozycji jest równa kwocie łącznej dyspozycji. Przy składaniu kwota łączna wynika z sumy pozycji. Przy korekcie kwota łączna się nie zmienia, więc zmiana kwoty jednej pozycji wymaga zmiany innej.
- Kwota pojedynczej pozycji jest większa od zera i nie większa niż 1 000 000 PLN.
- Przy korekcie klient zmienia tylko kwoty pozycji; rachunek odbiorcy i tytuł wpisuje tylko przy składaniu dyspozycji.
- Zapis zmiany pozycji przy korekcie należy do scenariusza korekty, nie do sekcji.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
PRZY zmianie kwoty dowolnej pozycji:
    suma = suma kwot wszystkich pozycji
    JEŚLI tryb = składanie:
        pokaż sumę jako kwotę łączną dyspozycji
    JEŚLI tryb = korekta ORAZ suma różna od kwoty łącznej dyspozycji:
        pokaż komunikat „Suma pozycji różni się od kwoty dyspozycji o <różnica>.”
        zablokuj przejście do podsumowania
```
