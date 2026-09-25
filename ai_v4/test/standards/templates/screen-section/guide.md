# Sekcja ekranu (SCRSEC)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Jeden wydzielony fragment ekranu: pola, źródła danych, walidacje, reguły
biznesowe, zachowania. Podrzędna wobec ekranu.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz szczegółowo pola w sekcji ekranu.

**Nie używaj gdy:**

- opisujesz układ całego ekranu → [screen](../screen/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Sekcję wskazuje ekran: `SCR-001 contains SCRSEC-001`. Wskazuje ją też scenariusz UC, którego krok opisuje pracę w tej sekcji: `UC-010 contains SCRSEC-010`. Sekcja nie wymienia ekranów ani scenariuszy, które ją wskazują.
- Atrybuty „Źródło danych” i „Miejsce utrwalenia” wskazują encję: `SCRSEC-001 consumes ENT-Client`.
- Wskazujesz encję, która w sekcji jest osobnym bytem. Część zagnieżdżona w całości dochodzi przez `ENT contains ENT`. Sekcja „Pozycje” z listą pozycji wskazuje `ENT-DispositionItem`: `SCRSEC-002 consumes ENT-DispositionItem`.
- Atrybut „Zachowanie” wskazuje API wywołania, które nie jest krokiem scenariusza: podpowiadanie, walidacja w locie, słownik wartości. Integracji INT sekcja nie woła wprost, tylko przez API. Wywołanie, które jest krokiem, wpisujesz w kolumnie „Wywołanie” w UC albo TUC.
- Test: jeśli podpowiadanie da się wymienić na listę rozwijaną bez zmiany scenariusza, wywołanie należy do sekcji.

## 4. Warianty

Brak wariantów.
