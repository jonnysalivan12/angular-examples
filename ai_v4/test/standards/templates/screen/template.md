---
doc-id: SCR-{nnn}
title: "Ekran {Nazwa produktu}: Krok {X} z {Y} — {Nazwa kroku}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
step: "{X}"                                    # numer kroku
owner: "{Imię Nazwisko}"
relations:
  - type: contains
    target: SCRSEC-{nnn}                       # sekcja ekranu
---

# Ekran {Nazwa produktu}: Krok {X} z {Y} — {Nazwa kroku}

## Opis ekranu

- Cele ekranu: {Cele}
- Figma: {Odnośnik}

## Mapa sekcji na ekranie

{Obrazy sekcji w kolejności od góry}

## Struktura ekranu

| Kolejność | Sekcja | Opis | Warunek wyświetlenia |
|---|---|---|---|
| 1 | SCRSEC-{nnn} | {Opis} | {Warunek} |

## Kolejne ekrany

| Krok | Numer i nazwa | Status |
|---|---|---|
| Poprzedni | {X-1} {Nazwa kroku} | {Status} |
| Bieżący | {X} {Nazwa kroku} | {Status} |
| Następny | {X+1} {Nazwa kroku} | {Status} |

## Nawigacja

- Przycisk wstecz: {Zachowanie}
- Przycisk „Dalej”: {Zachowanie}
- Odnośniki dodatkowe: {Opis}
