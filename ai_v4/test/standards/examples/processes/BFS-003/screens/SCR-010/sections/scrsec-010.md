---
doc-id: SCRSEC-010
title: "Dane osobowe"
description: "Sekcja wniosku o rachunek z danymi osobowymi wnioskodawcy zapisywanymi w encji klienta."
status: draft                                  # draft | active
owner: "Katarzyna Wójcik"
relations:
  - type: consumes
    target: ENT-Client
  - type: consumes
    target: API-009
---

# Dane osobowe

## Opis sekcji

Sekcja zbiera dane osobowe wnioskodawcy: PESEL, imię, nazwisko, datę urodzenia
i adres. Dane trafiają do wniosku o rachunek i są podstawą automatycznej
weryfikacji tożsamości. Klientowi zalogowanemu sekcja podpowiada dane zapisane
w banku.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### PESEL

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole tekstowe, 11 znaków, klawiatura numeryczna |
| Etykieta | PESEL |
| Wartość domyślna | Pusta; dla klienta zalogowanego numer zapisany w banku |
| Wartość przykładowa | 90010112345 |
| Źródło danych | ENT-Client (atrybut pesel) |
| Miejsce utrwalenia | ENT-Client (atrybut pesel) |
| Edytowalność | tak; dla klienta zalogowanego nie |
| Wymagalność | tak |
| Uprawnienia | Klient: odczyt i edycja |
| Walidacja | Dokładnie 11 cyfr z poprawną sumą kontrolną; komunikat „Podaj poprawny numer PESEL” |
| Zachowanie | Po poprawnym wpisaniu podpowiada datę urodzenia zakodowaną w numerze |
| Tooltip | Numer PESEL znajdziesz w dowodzie osobistym |
| WCAG (atrybut aria) | aria-required="true", aria-describedby wskazuje komunikat walidacji |
| Analityka zdarzeń (opcjonalnie) | konto_wniosek_pesel_blad przy błędzie walidacji |
| Referencja komponentu UI (opcjonalnie) | TextInput, wariant numeric |

### Imię

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole tekstowe, do 50 znaków |
| Etykieta | Imię |
| Wartość domyślna | Pusta; dla klienta zalogowanego imię zapisane w banku |
| Wartość przykładowa | Joanna |
| Źródło danych | ENT-Client (atrybut firstName) |
| Miejsce utrwalenia | ENT-Client (atrybut firstName) |
| Edytowalność | tak; dla klienta zalogowanego nie |
| Wymagalność | tak |
| Uprawnienia | Klient: odczyt i edycja |
| Walidacja | Litery, spacja i łącznik; komunikat „Podaj imię tak jak w dokumencie tożsamości” |
| Zachowanie | Usuwa spacje na początku i końcu wartości |
| Tooltip | Pierwsze imię zgodne z dowodem osobistym |
| WCAG (atrybut aria) | aria-required="true", autocomplete="given-name" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | TextInput |

### Nazwisko

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole tekstowe, do 80 znaków |
| Etykieta | Nazwisko |
| Wartość domyślna | Pusta; dla klienta zalogowanego nazwisko zapisane w banku |
| Wartość przykładowa | Kowalska-Nowicka |
| Źródło danych | ENT-Client (atrybut lastName) |
| Miejsce utrwalenia | ENT-Client (atrybut lastName) |
| Edytowalność | tak; dla klienta zalogowanego nie |
| Wymagalność | tak |
| Uprawnienia | Klient: odczyt i edycja |
| Walidacja | Litery, spacja, łącznik i apostrof; komunikat „Podaj nazwisko tak jak w dokumencie tożsamości” |
| Zachowanie | Usuwa spacje na początku i końcu wartości |
| Tooltip | Nazwisko zgodne z dowodem osobistym |
| WCAG (atrybut aria) | aria-required="true", autocomplete="family-name" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | TextInput |

### Data urodzenia

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole daty z kalendarzem |
| Etykieta | Data urodzenia |
| Wartość domyślna | Data odczytana z numeru PESEL |
| Wartość przykładowa | 01.01.1990 |
| Źródło danych | ENT-Client (atrybut birthDate) |
| Miejsce utrwalenia | ENT-Client (atrybut birthDate) |
| Edytowalność | tak; dla klienta zalogowanego nie |
| Wymagalność | tak |
| Uprawnienia | Klient: odczyt i edycja |
| Walidacja | Data z przeszłości, zgodna z datą zakodowaną w numerze PESEL; komunikat „Data urodzenia nie zgadza się z numerem PESEL” |
| Zachowanie | Brak wywołań; wartość wypełnia się po wpisaniu numeru PESEL |
| Tooltip | — |
| WCAG (atrybut aria) | aria-required="true", autocomplete="bday" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | DatePicker |

### Adres

| Atrybut | Wartość |
|---|---|
| Typ pola | Grupa pól tekstowych: ulica z numerem, kod pocztowy, miejscowość |
| Etykieta | Adres korespondencyjny |
| Wartość domyślna | Pusta; dla klienta zalogowanego adres zapisany w banku |
| Wartość przykładowa | ul. Kwiatowa 12/4, 00-950 Warszawa |
| Źródło danych | ENT-Client (atrybut address) |
| Miejsce utrwalenia | ENT-Client (atrybut address) |
| Edytowalność | tak |
| Wymagalność | tak |
| Uprawnienia | Klient: odczyt i edycja |
| Walidacja | Kod pocztowy w formacie 00-000; ulica z numerem i miejscowość niepuste |
| Zachowanie | Podpowiadanie adresu po wpisaniu co najmniej 3 znaków, API-009 (podpowiedzi adresu ze słownika TERYT); wybór podpowiedzi wypełnia ulicę z numerem, kod pocztowy i miejscowość |
| Tooltip | Adres, pod który bank wyśle korespondencję |
| WCAG (atrybut aria) | aria-required="true", autocomplete="street-address" dla ulicy |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | AddressFieldset |

## Reguły biznesowe

- Numer PESEL musi mieć 11 cyfr i poprawną sumę kontrolną; bez tego przycisk „Dalej” pozostaje nieaktywny.
- Data urodzenia musi zgadzać się z datą zakodowaną w numerze PESEL.
- Sekcja nie blokuje wniosku osoby niepełnoletniej; pełnoletność przy rachunku osobistym sprawdza system po wysłaniu wniosku.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
gdy PESEL poprawny i Data urodzenia pusta:
    Data urodzenia = data zakodowana w numerze PESEL
gdy klient zalogowany:
    PESEL, Imię, Nazwisko, Data urodzenia = dane klienta w banku, tylko do odczytu
```
