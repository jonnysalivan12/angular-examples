---
doc-id: SCRSEC-011
title: "Wybór produktu"
description: "Sekcja wniosku o rachunek z wyborem produktu z oferty oraz kwotą i okresem lokaty terminowej."
status: draft                                  # draft | active
owner: "Katarzyna Wójcik"
relations:
  - type: consumes
    target: ENT-Account
  - type: consumes
    target: ENT-Deposit
  - type: consumes
    target: ENT-Product
---

# Wybór produktu

## Opis sekcji

Sekcja pokazuje produkty z oferty banku i pozwala wybrać rachunek osobisty albo
lokatę terminową. Po wyborze lokaty sekcja rozwija pola kwoty i okresu lokaty.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Produkt

| Atrybut | Wartość |
|---|---|
| Typ pola | Lista kart wyboru (radio), jedna wartość |
| Etykieta | Wybierz produkt |
| Wartość domyślna | Brak wyboru |
| Wartość przykładowa | Konto Osobiste Plus, opłata miesięczna 0,00 PLN |
| Źródło danych | ENT-Product (atrybuty productCode, name, productType, monthlyFee) |
| Miejsce utrwalenia | ENT-Account (atrybut productCode) |
| Edytowalność | tak |
| Wymagalność | tak |
| Uprawnienia | Klient: odczyt i wybór |
| Walidacja | Wybrana jedna pozycja; komunikat „Wybierz produkt” |
| Zachowanie | Wybór produktu typu TERM_DEPOSIT pokazuje pola Kwota lokaty i Okres lokaty; wybór PERSONAL_ACCOUNT je ukrywa i czyści |
| Tooltip | Opłata miesięczna według tabeli opłat i prowizji |
| WCAG (atrybut aria) | role="radiogroup", aria-required="true" |
| Analityka zdarzeń (opcjonalnie) | konto_wniosek_produkt_wybrany z kodem produktu |
| Referencja komponentu UI (opcjonalnie) | ProductCardRadioGroup |

### Kwota lokaty

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole kwoty w walucie wybranego produktu |
| Etykieta | Kwota lokaty |
| Wartość domyślna | Pusta |
| Wartość przykładowa | 10 000,00 PLN |
| Źródło danych | — (wpisuje klient) |
| Miejsce utrwalenia | ENT-Deposit (atrybut amount) |
| Edytowalność | tak |
| Wymagalność | tak, gdy wybrano lokatę terminową |
| Uprawnienia | Klient: odczyt i edycja |
| Walidacja | Kwota większa od zera, najwyżej dwa miejsca po przecinku; komunikat „Podaj kwotę lokaty” |
| Zachowanie | Widoczne tylko po wyborze produktu typu TERM_DEPOSIT; brak wywołań |
| Tooltip | Kwotę przelejesz na lokatę po jej otwarciu |
| WCAG (atrybut aria) | aria-required="true", inputmode="decimal" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | AmountInput |

### Okres lokaty

| Atrybut | Wartość |
|---|---|
| Typ pola | Lista rozwijana z liczbą miesięcy |
| Etykieta | Okres lokaty |
| Wartość domyślna | 3 miesiące |
| Wartość przykładowa | 12 miesięcy |
| Źródło danych | — (wartości 1–24 miesiące z reguły lokaty) |
| Miejsce utrwalenia | ENT-Deposit (atrybut termMonths) |
| Edytowalność | tak |
| Wymagalność | tak, gdy wybrano lokatę terminową |
| Uprawnienia | Klient: odczyt i wybór |
| Walidacja | Liczba całkowita od 1 do 24 miesięcy |
| Zachowanie | Widoczne tylko po wyborze produktu typu TERM_DEPOSIT; zmiana okresu przelicza wyświetlaną datę zakończenia lokaty |
| Tooltip | Po tym okresie lokata się kończy, a środki wracają na rachunek |
| WCAG (atrybut aria) | aria-required="true", aria-describedby wskazuje datę zakończenia |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | Select |

## Reguły biznesowe

- Wnioskodawca wybiera dokładnie jeden produkt.
- Lokata terminowa wymaga kwoty większej od zera i okresu od 1 do 24 miesięcy.
- Pola lokaty nie trafiają do wniosku o rachunek osobisty.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
gdy Produkt.productType = TERM_DEPOSIT:
    pokaż Kwota lokaty, Okres lokaty
    data zakończenia = dzisiejsza data + Okres lokaty (w miesiącach)
w przeciwnym razie:
    ukryj i wyczyść Kwota lokaty, Okres lokaty
```
