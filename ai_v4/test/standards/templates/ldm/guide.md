# Logical Data Model (LDM)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Model logiczny danych dla obszaru: obiekty logiczne, atrybuty, relacje, typy
logiczne. Pomost między domeną (DDM) a interfejsami. Plik indeksu; szczegóły
encji leżą w osobnych plikach.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz logiczny model danych: encje, atrybuty, relacje.

**Nie używaj gdy:**

- opisujesz znaczenie pojęć → [ddm](../ddm/guide.md),
- opisujesz szczegóły jednej encji → [ldm-entity](../ldm-entity/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Typy logiczne: `String`, `Integer`, `Decimal`, `Date`, `DateTime`, `Boolean`, `UUID`, `Dictionary[NazwaSłownika]`, `Enum`. Bez typów fizycznych, np. `VARCHAR(255)`, `BIGINT`, `TIMESTAMP WITH TIME ZONE`.
- Nie umieszczasz: kluczy fizycznych i relacji po kluczach, typów i struktur fizycznych, nazw klas i adnotacji ORM, wartości domyślnych zależnych od środowiska, referencji do konsumentów.
- Sposób pracy: DDM jako źródło, mapowanie `DOM-*` na `ENT-*`, diagram ER, plik na encję, relacje i słowniki.
- LDM wskazuje pojęcia, które realizuje, wszystkie z jednego DDM: `LDM-001 realizes DDM-001.DOM-Dyspozycja`. Jeden DDM może mieć kilka LDM.
- LDM zawiera encje: `LDM-001 contains ENT-Disposition`. Encja należy do jednego LDM. Nazwa encji jest jej doc-id i jest unikalna także między modelami: `ENT-Account` w systemie transakcyjnym, `ENT-AccountSnapshot` w hurtowni.
- Reguły walidacyjne RW leżą w encji, którą walidują ([ldm-entity](../ldm-entity/guide.md)).

## 4. Warianty

Brak wariantów.
