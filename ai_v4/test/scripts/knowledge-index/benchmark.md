# Test użyteczności knowledge-index

Test sprawdza, ile czasu, tokenów i pieniędzy zużywa agent AI, żeby znaleźć
potrzebne pliki dokumentacji, oraz jak trafnie je znajduje. Każde zadanie
zostało wykonane w dwóch wariantach: z serwerem MCP knowledge-index i bez niego.

Data testu: 14 września 2026 r.

## Jak przeprowadzono test

1. Agentem był Claude Code 2.1.227 uruchomiony w trybie nieinteraktywnym (`claude -p --output-format json`). Ten tryb zwraca czas, liczbę tur, zużyte tokeny i koszt każdego uruchomienia.
2. Użyto trzech modeli, wybranych w Claude Code aliasami `haiku`, `sonnet` i `opus`.
3. Dokumentacja testowa to folder `standards/examples`: 119 dokumentów.
4. W wariancie **bez MCP** agent mógł używać tylko narzędzi `Read`, `Grep` i `Glob`.
5. W wariancie **z MCP** agent miał te same narzędzia oraz narzędzia serwera knowledge-index. Serwer był uruchomiony z pliku `.mcp.json`.
6. W obu wariantach opcja `--strict-mcp-config` wyłączała wszystkie inne serwery MCP.
7. Każde zadanie zostało uruchomione dwa razy dla każdego modelu i wariantu. Razem było 72 uruchomienia, wszystkie zakończone bez błędu. Łączny koszt testu wyniósł 15,71 USD.

Każde zadanie zaczynało się od tego samego zdania: „W folderze
standards/examples jest dokumentacja projektowa w plikach Markdown. Powiązania
między dokumentami są zapisane w polu relations we front matter.” Kończyło się
prośbą o odpowiedź samą listą ścieżek plików.

### Jak oceniano odpowiedź

Wzorcem była lista plików zwrócona przez knowledge-index dla tego samego
zapytania. Dla każdej odpowiedzi policzono:

- **trafione pliki**: ile plików ze wzorca podał agent,
- **nadmiarowe pliki**: ile podanych plików nie było we wzorcu,
- **odpowiedź bezbłędną**: agent podał wszystkie pliki ze wzorca i żadnego nadmiarowego.

## Zadania

| Zadanie | Treść pytania | Zapytanie wzorcowe | Pliki we wzorcu |
|---|---|---|---:|
| T1 | Zmieniam wymaganie BFS-001.REQ-01. Wypisz wszystkie pliki dokumentacji, które trzeba przejrzeć przy tej zmianie. | `change_scope` dla `BFS-001.REQ-01` | 14 |
| T2 | Mam zaimplementować scenariusz UC-001. Wypisz wszystkie pliki dokumentacji, które trzeba przeczytać, żeby to zrobić. | `implementation` dla `UC-001` | 25 |
| T3 | Zmieniam encję ENT-Disposition. Wypisz wszystkie pliki dokumentacji, które trzeba przejrzeć przy tej zmianie. | `change_scope` dla `ENT-Disposition` | 13 |
| T4 | Zmieniam zdolność CAP-004. Wypisz wszystkie pliki dokumentacji, które trzeba przejrzeć przy tej zmianie. | `change_scope` dla `CAP-004` | 15 |
| T5 | Mam zaimplementować API-001. Wypisz wszystkie pliki dokumentacji, które trzeba przeczytać, żeby to zrobić. | `implementation` dla `API-001` | 10 |
| T6 | Zmieniam regułę walidacyjną ENT-Disposition.RW-001. Wypisz wszystkie pliki dokumentacji, które trzeba przejrzeć przy tej zmianie. | `change_scope` dla `ENT-Disposition.RW-001` | 12 |

## Wynik ogólny

Średnia na jedno uruchomienie. Każdy wariant to 36 uruchomień: 6 zadań, 3 modele
i 2 powtórzenia.

| Miara | Bez MCP | Z MCP | Różnica |
|---|---:|---:|---:|
| Czas | 64,4 s | 14,8 s | 4,4 razy krócej |
| Tury | 15,6 | 3,4 | 4,6 razy mniej |
| Tokeny wejściowe | 581 tys. | 156 tys. | 3,7 razy mniej |
| Tokeny wyjściowe | 5 365 | 895 | 6 razy mniej |
| Koszt | 0,336 USD | 0,101 USD | 3,3 razy taniej |
| Trafione pliki | 90% | 100% | o 10 punktów procentowych więcej |
| Odpowiedzi bezbłędne | 19 z 36 | 36 z 36 | |

Tokeny wejściowe obejmują także tokeny odczytane z pamięci podręcznej modelu
i do niej zapisane.

## Wynik według modelu

Średnia na jedno uruchomienie. Każdy wiersz to 12 uruchomień: 6 zadań
i 2 powtórzenia. Kolumna „Najgorsza trafność” podaje najniższy odsetek
trafionych plików w pojedynczym uruchomieniu.

| Model | Wariant | Czas | Tury | Tokeny wejściowe | Koszt | Trafione pliki | Nadmiarowe pliki | Odpowiedzi bezbłędne | Najgorsza trafność |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Haiku | bez MCP | 75,7 s | 18,5 | 719 tys. | 0,171 USD | 75% | 1,0 | 1 z 12 | 0% |
| Haiku | z MCP | 18,7 s | 4,0 | 169 tys. | 0,041 USD | 100% | 0 | 12 z 12 | 100% |
| Sonnet | bez MCP | 68,1 s | 14,8 | 591 tys. | 0,290 USD | 96% | 0,4 | 7 z 12 | 85% |
| Sonnet | z MCP | 11,5 s | 3,0 | 165 tys. | 0,078 USD | 100% | 0 | 12 z 12 | 100% |
| Opus | bez MCP | 49,6 s | 13,4 | 433 tys. | 0,547 USD | 99% | 0 | 11 z 12 | 92% |
| Opus | z MCP | 14,2 s | 3,2 | 135 tys. | 0,182 USD | 100% | 0 | 12 z 12 | 100% |

## Wynik według zadania

Średnia z dwóch powtórzeń. Każda komórka podaje czas, odsetek trafionych
plików i koszt w USD.

| Zadanie | Pliki | Haiku bez MCP | Haiku z MCP | Sonnet bez MCP | Sonnet z MCP | Opus bez MCP | Opus z MCP |
|---|---:|---|---|---|---|---|---|
| T1: zmiana `BFS-001.REQ-01` | 14 | 98 s, 75%, 0,25 | 16 s, 100%, 0,04 | 119 s, 86%, 0,53 | 10 s, 100%, 0,08 | 53 s, 100%, 0,58 | 13 s, 100%, 0,17 |
| T2: implementacja `UC-001` | 25 | 86 s, 72%, 0,20 | 18 s, 100%, 0,04 | 127 s, 100%, 0,48 | 15 s, 100%, 0,09 | 70 s, 100%, 0,74 | 16 s, 100%, 0,20 |
| T3: zmiana `ENT-Disposition` | 13 | 33 s, 85%, 0,07 | 19 s, 100%, 0,04 | 19 s, 85%, 0,11 | 10 s, 100%, 0,08 | 42 s, 96%, 0,50 | 13 s, 100%, 0,17 |
| T4: zmiana `CAP-004` | 15 | 69 s, 87%, 0,14 | 16 s, 100%, 0,04 | 22 s, 100%, 0,12 | 10 s, 100%, 0,08 | 36 s, 100%, 0,44 | 17 s, 100%, 0,21 |
| T5: implementacja `API-001` | 10 | 98 s, 80%, 0,23 | 14 s, 100%, 0,03 | 68 s, 100%, 0,33 | 10 s, 100%, 0,08 | 53 s, 100%, 0,55 | 12 s, 100%, 0,17 |
| T6: zmiana `ENT-Disposition.RW-001` | 12 | 70 s, 50%, 0,13 | 28 s, 100%, 0,06 | 54 s, 100%, 0,17 | 15 s, 100%, 0,08 | 44 s, 100%, 0,47 | 13 s, 100%, 0,17 |

## Wnioski

1. **Z knowledge-index każdy model odpowiedział bezbłędnie.** Wszystkie 36 uruchomień z MCP dało komplet plików bez żadnego nadmiarowego. Bez MCP bezbłędnych odpowiedzi było 19 z 36.
2. **Najtańszy model z indeksem wypada lepiej niż najdroższy bez indeksu.** Haiku z MCP miał 100% trafionych plików przy średnim koszcie 0,041 USD. Opus bez MCP miał 99% trafionych plików przy średnim koszcie 0,547 USD, czyli 13 razy wyższym.
3. **Bez indeksu słabszy model potrafi całkowicie się pomylić.** W jednym uruchomieniu zadania T6 Haiku bez MCP odpowiedział, że żaden plik nie wspomina `ENT-Disposition.RW-001`. Przyczyna: dokument encji `ENT-Disposition` zapisuje ten wiersz jako samo `RW-001`, więc wyszukiwanie pełnego identyfikatora niczego nie znajduje. knowledge-index zapisuje każdy wiersz pod pełnym identyfikatorem już podczas synchronizacji.
4. **Najwięcej zyskują zadania, które wymagają przejścia przez kilka poziomów relacji.** Zadania T1, T2 i T5 bez MCP trwały średnio od 53 do 127 sekund. Z MCP trwały od 10 do 18 sekund i zajmowały 3 lub 4 tury.
5. **Z MCP czas i koszt są przewidywalne.** Najdłuższe uruchomienie z MCP trwało 33 sekundy. Najdłuższe uruchomienie bez MCP trwało 153 sekundy.

## Ograniczenia testu

1. Każde połączenie modelu, wariantu i zadania zostało uruchomione dwa razy. Pojedyncze średnie mogą się przesunąć przy większej liczbie powtórzeń. Para uruchomień to ten sam model, to samo zadanie i to samo powtórzenie w obu wariantach. Na 36 par wariant z MCP był szybszy i tańszy w 33 parach. We wszystkich 36 parach dał co najmniej tyle samo trafionych plików. Trzy pary, w których wariant z MCP był wolniejszy:
   - Haiku, zadanie T3, pierwsze powtórzenie: 9,9 s bez MCP i 15,9 s z MCP,
   - Haiku, zadanie T6, pierwsze powtórzenie: 21 s bez MCP i 33 s z MCP. Bez MCP model szybko skończył, bo odpowiedział, że nie ma żadnych plików (0 z 12 trafionych),
   - Sonnet, zadanie T6, drugie powtórzenie: 10,5 s bez MCP i 12,4 s z MCP.
2. Wzorcem był wynik zapytania knowledge-index, a pytania sformułowano tak, żeby odpowiadały temu zapytaniu. Test mierzy więc, jak szybko i trafnie agent znajduje pliki wyznaczone przez wzorce z `standards/config/query-patterns.yaml`. Nie ocenia, czy same wzorce są dobre.
3. Dokumentacja testowa ma 119 dokumentów. Test nie sprawdzał, jak wyniki zmieniają się przy większej dokumentacji.
4. Skryptu, który uruchamiał test, nie ma w repozytorium.
