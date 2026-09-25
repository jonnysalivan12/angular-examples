# Encja modelu logicznego (ENT)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Pojedyncza encja modelu logicznego: pełna lista atrybutów, powiązania, reguły.
Jeden plik to jedna encja. Podrzędna wobec indeksu LDM, realizuje pojęcie
z DDM.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz szczegółowo pojedynczą encję.

**Nie używaj gdy:**

- opisujesz indeks encji obszaru → [ldm](../ldm/guide.md),
- opisujesz znaczenie pojęcia → [ddm](../ddm/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- doc-id encji to nazwa po angielsku, bez przedrostka `t_` i sufiksu `_table`: `ENT-{Nazwa}`, unikalna w całej dokumentacji.
- Kolumna „Identyfikator” ma „Tak” dla atrybutów, które współtworzą tożsamość. To pojęcie logiczne, nie klucz główny.
- „Realizuje pojęcie (DDM)” wskazuje własne pojęcie: `ENT-Disposition realizes DDM-001.DOM-Dyspozycja`. Rodzaj pojęcia ogólnego wskazuje pojęcie ogólne: `ENT-Deposit realizes DDM-002.DOM-Rachunek`. Encja techniczna, np. `ENT-StatusDict`, nie wskazuje pojęcia.
- „Powiązania”: wartość „zawiera” w kolumnie relacji oznacza zawieranie: `ENT-Disposition contains ENT-DispositionItem`. Pozostałe powiązania relacji nie tworzą.
- „Reguły walidacyjne” numerują RW: `ENT-Disposition contains RW-001`. Kolumna RD wskazuje regułę domenową, z której RW wynika. RW leży w encji, którą waliduje, a niezmiennik agregatu w korzeniu. Reguła między agregatami to RD w DDM albo RB w BFS.

## 4. Warianty

Brak wariantów.
