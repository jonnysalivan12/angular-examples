# Ściąga: co trzymać w ryzach

---

## 5 zasad, na których wszystko stoi

**1. Piszesz tylko o sobie w górę.**
Deklarujesz, z czego wynikasz i co zawierasz. Nigdy: kto z ciebie korzysta.
Dodajesz nowy dokument → edytujesz jeden plik.

**2. Każdy identyfikator w treści ma wpis w `relations`.**
Napisałeś w tekście `API-021`? Musi być relacja do `API-021`.
Nie umiesz nazwać typu relacji → nie ma czego wspominać.

**3. Wymagania są węzłami, nie tekstem.**
`REQ-01`, `RB-01`, `DOM-*` zgłaszasz przez `defines`.
Wskazujesz je z prefiksem: `BFS-003.REQ-01`.

**4. Nic nie wisi w próżni.**
Każdy plik połączony z resztą. Dwa pliki wskazujące tylko na siebie to błąd.

**5. Jeden BFS = jeden proces.**
Jeden start, jeden koniec. Nie dziel po iteracjach ani po ścieżkach błędnych.

---

## Co sprawdzi linter

Odpalasz przed scaleniem. Jak przejdzie — architektura się nie rozjechała.

| ✅ Sprawdzane automatycznie |
|---|
| typ relacji jest ze słownika |
| cel relacji istnieje |
| identyfikator lokalny zgłoszony przez `defines` w swoim pliku |
| identyfikator w treści ma relację w metadanych |
| para typów dozwolona (np. `SCRSEC → ENT` tak, `SCRSEC → BFS` nie) |
| brak sierot i wysp |
| `doc-id` unikalny |
| numer wymagania nie użyty ponownie |
| dokument `active` nie wskazuje `draft` |

| ❌ Czego linter nie złapie |
|---|
| czy wymaganie ma sens |
| czy to naprawdę jeden proces |
| czy zakres BFS jest dobry |
| czy reguła biznesowa jest prawdziwa |
| czy scenariusz opisuje to, co robi system |
| czy nie brakuje relacji, której nikt nie zapisał |

---

## Co generuje się samo

Nie pisz tego ręcznie. Wyliczy się z grafu.

- **Macierz aktorów** — kto w czym uczestniczy
- **Zakres capability** — co do niej należy
- **Listy „wskazywany przez"** — kto używa tej encji, tego NFR
- **Ścieżka wymaganie → kod** — `REQ` → `UC` → `API` → `ENT`
- **Zasięg zmiany** — co poprawić, gdy ruszasz plik
- **Lista do przetestowania** — scenariusze dotknięte zmianą
- **Spis treści, mapy nawigacji, diagramy zależności**

---

## Co zostaje ręczne

To jest praca analityka. Nikt tego nie wygeneruje.

- **Granica procesu** — czy to jeden BFS czy trzy
- **Treść wymagań i reguł** — `REQ`, `RB`, `RD`
- **Wybór typu relacji** — czy to `realizes`, czy `constrained-by`
- **Podział na capability** — gdzie kończy się odpowiedzialność komponentu
- **Kryteria akceptacji** — co znaczy „działa"
- **Definicje pojęć domenowych** — co znaczy „dyspozycja"
- **Decyzja, czy zmiana wymaga nowego numeru** czy wystarczy edycja

---

## Rytm pracy przy zmianie

```
1. Zapytaj graf o zasięg     ← NAJPIERW
2. Popraw wskazane pliki
3. Usuń relacje i wiersz     ← NA KOŃCU
4. Odpal linter
```

Odwrotnie nie zadziała — po usunięciu relacji graf nie wie już, kogo dotyczyła zmiana.

---

## Kto co robi

Trzy narzędzia i człowiek. Każde zadanie ma jednego właściciela.

### Skrypt migracyjny — jednorazowo

Przepisuje repozytorium ze starego formatu na nowy.

- `source-spec-ids` i `related-doc-ids` → jedno pole `relations`
- typ relacji z pary typów dokumentów (`UC → CAP` = `realizes`, `X → NFR` = `constrained-by`)
- dopisanie `defines` dla identyfikatorów znalezionych w tabelach
- dopisanie prefiksu dokumentu: `REQ-01` → `BFS-003.REQ-01`
- odwrócenie kierunku tam, gdzie stary standard go mylił (`SCR` ↔ `SCRSEC`)
- usunięcie wpisów zwrotnych — zostaje strona deklarująca
- raport przypadków, których nie umiał rozstrzygnąć → do ręki

### Linter — przy każdym scaleniu

Pilnuje, żeby nowe zmiany nie rozjechały struktury. Lista sprawdzeń wyżej.

Dwa tryby: ostrzegawczy na start, blokujący po ustabilizowaniu.

### Skrypt generujący — po każdej zmianie

Wylicza z grafu i wstawia do plików między znacznikami:

- macierz aktorów, zakres capability, listy „wskazywany przez"
- spis treści, mapy zależności, diagramy
- indeks grafu dla modelu językowego

Treść między znacznikami jest nadpisywana — ręczna edycja tam nie ma sensu.

### Agent naprawczy — po każdym zgłoszeniu lintera

Nie poprawiasz błędów relacji ręcznie. Agent czyta raport i proponuje zmiany:

- dopisuje brakującą relację dla identyfikatora znalezionego w treści
- dopisuje `defines` dla wymagania z tabeli
- dodaje prefiks dokumentu tam, gdzie go brakuje
- usuwa relację do celu, który zniknął

Zatwierdzasz albo odrzucasz. Agent nie zmienia treści merytorycznej — tylko metadane.

### Analityk — praca, której nie da się zautomatyzować

- gdzie kończy się jeden proces, a zaczyna drugi
- treść wymagań, reguł i pojęć domenowych
- czy relacja w ogóle istnieje — typ wynika z pary dokumentów, ale nikt nie zgadnie, że twój punkt końcowy sięga po tę encję
- przy zdarzeniach: czy jesteś producentem czy odbiorcą
- podział odpowiedzialności między capability
- kryteria akceptacji
- rozstrzygnięcie: nowy numer wymagania czy edycja istniejącego
- decyzja, co zrobić z przypadkami zgłoszonymi przez skrypt migracyjny

---

## Jak z tego korzystasz na co dzień

**Nie otwierasz plików, żeby szukać powiązań.** Pytasz.

Repozytorium wystawia graf przez serwer MCP, więc model językowy w edytorze odpowiada na pytania w rodzaju:

- „co poprawić, jak zmienię `REQ-04` w `BFS-005`?"
- „co jest potrzebne, żeby zaimplementować `UC-013`?"
- „co przetestować po zmianie w `ENT-Client`?"
- „które punkty końcowe używają tej encji?"

Model nie czyta całego repozytorium — dostaje graf i odpowiada z niego. Dlatego zasady wyżej mają znaczenie: jeśli relacja nie jest zapisana, odpowiedź będzie niepełna, a model tego nie zauważy.

**Rytm pracy:** piszesz dokument → linter zgłasza braki → agent proponuje poprawki metadanych → zatwierdzasz → generator odświeża sekcje wyliczane.

---

## Dodatek: wizualizacja grafu

Osobne narzędzie, jeden plik HTML, otwierany z dysku. Nie jest potrzebne do pracy — pomaga zobaczyć całość.

Co pokazuje:

- każdy proces jako osobną wieżę, wspólne dokumenty pośrodku
- cztery warstwy: od czego zaczynasz pracę u góry, szczegóły na dole
- wymagania jako kulę wokół dokumentu, który je definiuje
- relacje kolorami, z filtrem po typie
- aktorów jako filtr, nie jako węzły

Do czego się przydaje: pokazać komuś strukturę projektu, znaleźć proces, który urósł za bardzo, zobaczyć encję, po którą sięga pół systemu, sprawdzić przed zmianą, jak daleko sięga jej zasięg.

---

## Co z tego masz

**Analityk** — dodajesz scenariusz i edytujesz jeden plik zamiast pięciu. Przed zmianą wymagania widzisz zakres zgłoszenia, zamiast go zgadywać. Macierze i listy powiązań piszą się same.

**Deweloper** — z jednego przypadku użycia dostajesz komplet: punkty końcowe, encje, ekrany, ograniczenia jakościowe. Nie szukasz po katalogach, co jeszcze trzeba dotknąć.

**Tester** — zmiana w dowolnym pliku daje listę scenariuszy do sprawdzenia. Bez zgadywania, czy coś się nie posypało gdzie indziej.

**Model językowy** — dostaje strukturę zamiast stosu plików. Odpowiada z grafu, nie z przeszukiwania treści, więc odpowiedzi są powtarzalne i tańsze.

**Dokumentacja jako całość** — nie rozjeżdża się po cichu. Wisząca referencja, sierota albo wymaganie bez realizacji zatrzymują scalenie zamiast siedzieć w repozytorium przez rok.

---

## 3 rzeczy, które psują architekturę najszybciej

**Identyfikator w treści bez relacji.** Graf go nie widzi, zasięg zmiany kłamie.

**BFS na cały moduł zamiast na proces.** Po roku sto wymagań w jednej tabeli.

**Zapisywanie relacji z obu stron.** Jedna zmiana = pięć plików = konflikty. Graf i tak zna drugą stronę.
