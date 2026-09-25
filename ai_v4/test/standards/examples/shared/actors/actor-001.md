---
doc-id: ACTOR-001
title: "Aktorzy systemu bankowości detalicznej"
description: "Wspólna baza ról klientów, pracowników banku i systemu z nazwami kanonicznymi, uprawnieniami i dziedziczeniem."
status: active                                 # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: contains
    target: ROLE-01
  - type: contains
    target: ROLE-02
  - type: contains
    target: ROLE-03
  - type: contains
    target: ROLE-04
---

# Aktorzy systemu bankowości detalicznej

## Kontekst biznesowy

Bank obsługuje klientów detalicznych w bankowości internetowej, w aplikacji
mobilnej i w oddziałach. Dyspozycje i wnioski składa klient, reklamacje
i weryfikacje, których nie da się rozstrzygnąć automatycznie, trafiają do
zaplecza, a rozliczenia wsadowe i reakcje na zdarzenia wykonuje system bez
udziału człowieka. Ta sama osoba może występować w kilku rolach (pracownik
banku bywa też klientem), ale w danym kroku działa zawsze w jednej roli.

## Cel

Jedna baza ról dla wszystkich procesów: każda rola ma jedną nazwę kanoniczną,
jedno ID, opis odpowiedzialności i uprawnień. Scenariusze i kroki procesów
wskazują rolę pełnym ID zamiast opisywać ją od nowa, a słownik aliasów
porządkuje nazwy używane w zespołach („użytkownik”, „back office”).

## Zakres

### W zakresie

Role, które wykonują kroki w procesach bankowości detalicznej: klient (także
wnioskodawca, który nie ma jeszcze rachunku), pracownik zaplecza, doradca
w oddziale oraz system wykonujący zadania automatyczne.

### Poza zakresem

- Systemy zewnętrzne wołane przez integracje: księga główna, system limitów,
  rejestr PESEL, lista sankcyjna, system płatności. To strony integracji, nie
  aktorzy.
- Kierownik zespołu reklamacji: odbiera powiadomienie e-mail o eskalacji, ale
  nie wykonuje kroków w systemie.
- Stanowiska i struktura organizacyjna banku oraz role administracyjne
  (administrator systemu, operator wdrożeń).

## Klasyfikacja aktorów

| Klasa | Kryterium kwalifikacji |
|---|---|
| Biznesowy | Człowiek, który wykonuje krok w interfejsie banku (bankowość internetowa, aplikacja mobilna, aplikacja zaplecza albo oddziału) i odpowiada za jego wynik |
| Systemowy | Komponent systemu banku, który wykonuje kroki bez udziału człowieka, uruchamiany harmonogramem, zdarzeniem albo wywołaniem innego komponentu |

## Przykład minimalny

Klient (ROLE-01), aktor biznesowy.

- Kim jest: osoba fizyczna, która ma rachunek w banku albo składa wniosek
  o pierwszy produkt.
- Odpowiedzialność: decyduje o własnych środkach i danych, czyli zleca
  dyspozycje, zgłasza reklamacje i składa wnioski o rachunek.
- Uprawnienia: po zalogowaniu widzi i zmienia tylko własne dyspozycje,
  reklamacje i dane; każdą operację finansową zatwierdza silnym
  uwierzytelnieniem (SCA). Bez logowania może tylko złożyć wniosek o rachunek
  w sesji wniosku.
- Dziedziczenie: rola nie przejmuje uprawnień innej roli. Po niej dziedziczy
  Doradca w oddziale, w zakresie reklamacji klienta zidentyfikowanego
  w oddziale.
- Aliasy: użytkownik, klient banku, posiadacz rachunku, wnioskodawca.
  W dokumentach pisze się wyłącznie „Klient”.

## Aktorzy

| ID | Nazwa kanoniczna | Klasa | Odpowiedzialność | Uprawnienia | Dziedziczy po |
|---|---|---|---|---|---|
| ROLE-01 | Klient | biznesowy | Zleca dyspozycje z własnego rachunku, zgłasza reklamacje, składa wnioski o rachunek | Dostęp tylko do własnych rachunków, dyspozycji, reklamacji i danych po zalogowaniu; operacje finansowe z SCA; bez logowania tylko wniosek o rachunek | — |
| ROLE-02 | Pracownik zaplecza | biznesowy | Rozpatruje reklamacje i ręcznie weryfikuje tożsamość wnioskodawców w zadaniach przydzielonych przez silnik procesów | Reklamacje: odczyt reklamacji i dyspozycji klienta, zapis decyzji i kwoty rekompensaty; bez rejestracji reklamacji. Weryfikacja: odczyt wyniku weryfikacji automatycznej i zdjęcia dokumentu, sprawdzenie numeru PESEL w rejestrze, zapis decyzji | — |
| ROLE-03 | System | systemowy | Wykonuje kroki bez udziału człowieka: przetwarzanie wsadowe, obsługę odebranych zdarzeń, wywołania systemów zewnętrznych | Konto techniczne z dostępem do punktów końcowych API i integracji wskazanych w konfiguracji komponentu; bez dostępu do ekranów | — |
| ROLE-04 | Doradca w oddziale | biznesowy | Obsługuje klienta obecnego w oddziale: identyfikuje go na podstawie dokumentu tożsamości i działa w jego imieniu | Identyfikacja klienta obecnego w oddziale. Dla zidentyfikowanego klienta uprawnienia klienta w zakresie reklamacji: odczyt jego dyspozycji i rejestracja reklamacji. Bez operacji finansowych i bez rozpatrywania reklamacji | ROLE-01 |

## Słownik nazw i aliasów

| Nazwa kanoniczna | Aliasy |
|---|---|
| Klient | użytkownik, klient banku, posiadacz rachunku, wnioskodawca |
| Pracownik zaplecza | back office, specjalista ds. reklamacji, weryfikator |
| System | zadanie wsadowe, proces automatyczny, użytkownik techniczny |
| Doradca w oddziale | doradca, pracownik oddziału, doradca klienta |
