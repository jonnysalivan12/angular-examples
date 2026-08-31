# Unifikacja warstwy orkiestracji

Notatka do prezentacji

## Problem

Sposób wykorzystania AI w firmie jest nieoptymalny. Każdy zespół utrzymuje własną
orkiestrację, co wymaga kompetencji i czasu, których zespoły nie mają. Utrzymanie
całości w jednym miejscu — orkiestracja plus standardy plus dostosowanie do każdego
projektu — tworzy wąskie gardło u jednej osoby.

## Rozwiązanie

Rozdzielamy dwie rzeczy, które dziś są zlepione: **jak prowadzimy pracę** i **jak
pracujemy w tym projekcie**. Pierwsze utrzymuje rdzeń, centralnie, raz. Drugie zostaje
w zespole, bo tylko zespół to wie.

Brak wąskiego gardła po obu stronach: centrum nie musi znać dwudziestu projektów,
zespoły nie muszą umieć projektować systemów agentowych.

## Podział odpowiedzialności

| Rdzeń | Projekt |
| --- | --- |
| Agenci: planowanie, wytwarzanie, testowanie, raportowanie | Treść plików meta |
| Kolejność wywołań, fazy, podagenci | Konwencje, architektura, progi jakości |
| Szablony plików meta | Wypełnienie szablonów |
| Utrzymanie i wersjonowanie | Decyzje techniczne |
| Zero wiedzy domenowej | Zero wiedzy o orkiestracji |

## Mechanizm

Agenci rdzenia nie mają standardów wpisanych w treść. Mają odwołania do plików
o ustalonych nazwach. Zestaw i struktura tych plików to kontrakt między rdzeniem
a projektem.

Agent planujący zna etapy planowania. Tego, jak wygląda plan w tym projekcie,
dowiaduje się z `_project-planner-meta.md`. Analogicznie pozostałe role.

Pliki meta pisze właściciel projektu, wypełniając szablon dostarczony razem z rdzeniem.
Szablon niesie strukturę i pytania do odpowiedzenia, więc autor nie projektuje formatu —
opisuje własny projekt prozą w gotowych sekcjach.

## Dlaczego to działa bez kompetencji w orkiestracji

Wypełnienie szablonu wymaga wiedzy, którą właściciel projektu już ma. Nie wymaga
rozumienia, jak agenci się wywołują ani jak dzielony jest kontekst. To jest cała zmiana
w kompetencjach po stronie zespołu.

## Konsekwencje

- Poprawka w orkiestracji trafia do wszystkich projektów przez podbicie wersji rdzenia.
- Zmiana standardu jest lokalna i nie dotyka rdzenia.
- Brak pliku meta zatrzymuje przebieg z komunikatem, zamiast pozwalać agentowi
  zaimprowizować konwencję.
- Nowa rola w rdzeniu przychodzi z nowym szablonem — projekt widzi, że ma coś
  do uzupełnienia, zanim uruchomi pracę.

## Pilotaż

Jeden projekt, jeden właściciel wypełniający szablony, jedna storyjka o znanym wyniku.

Mierzymy dwie rzeczy:

1. Czas wypełnienia szablonów.
2. Czy agenci zastosowały opisane standardy, czy zaimprowizowały własne.

Drugi wynik decyduje, czy szablony są wystarczająco precyzyjne.
