# Analiza klatek wideo — detekcja zmian stanu akcji użytkownika

Dokumentacja procesu wykrywania przejść między stanami UI na podstawie nagrania ekranu.
Wynikiem jest graf stanów (nie liniowy łańcuch), w którym powrót do wcześniejszego ekranu
oznacza powrót do tego samego węzła — a nie utworzenie nowego.

---

## Spis treści

1. [Idea i architektura](#1-idea-i-architektura)
2. [Wymagania i instalacja](#2-wymagania-i-instalacja)
3. [Struktura projektu](#3-struktura-projektu)
4. [Krok 1 — Ekstrakcja klatek](#krok-1--ekstrakcja-klatek)
5. [Krok 2 — Cechy wizualne i sygnał zmiany](#krok-2--cechy-wizualne-i-sygnał-zmiany)
6. [Krok 3 — Detekcja punktów zmiany stanu (PELT)](#krok-3--detekcja-punktów-zmiany-stanu-pelt)
7. [Krok 4 — Graf stanów z deduplicacją](#krok-4--graf-stanów-z-deduplicacją)
8. [Krok 5 — Eksport wyników](#krok-5--eksport-wyników)
9. [Parametry konfiguracyjne](#parametry-konfiguracyjne)
10. [Interpretacja wyników](#interpretacja-wyników)
11. [Kompletny skrypt lokalny](#kompletny-skrypt-lokalny)

---

## 1. Idea i architektura

### Problem

Nagranie ekranu zawiera szum, który nie jest zmianą stanu:
- ruch kursora myszy
- migotanie animacji UI (hover, podkreślenia, tooltips)
- artefakty kompresji wideo

Naiwne podejście (próg na pixel diff) traktuje każde drgnięcie kursora jako nowy stan.

### Rozwiązanie

Potok składa się z sześciu warstw:

```
Wideo
  │
  ▼
[1] Adaptacyjna ekstrakcja klatek
      └─ max MAX_FRAMES klatek z całego wideo (pomija klatki bez zmian)
  │
  ▼
[2] Wielokanałowy sygnał zmiany
      ├─ pixel_diff  (z maską kursora)   waga 45%
      ├─ pHash dist  (odporny na szum)   waga 45%
      └─ histogram diff (zmiana palety)  waga 10%
  │
  ▼
[3] PELT — detekcja punktów zmiany
      └─ algorytm statystyczny, penalty adaptacyjny (mediana × PENALTY_FACTOR)
  │
  ▼
[4] Budowanie surowych segmentów
      └─ klatka kluczowa = najstabilniejsza klatka w segmencie
  │
  ▼
[5] Graf stanów (automat skończony)
      └─ każdy segment porównywany SSIM ze WSZYSTKIMI dotąd widzianymi stanami
         jeśli SSIM ≥ DEDUP_THRESHOLD → powrót do istniejącego węzła
         jeśli nie → nowy węzeł grafu
  │
  ▼
[6] Eksport
      ├─ keyframes.zip  (PNG każdego unikalnego stanu)
      ├─ transition_tree.mmd  (graf Mermaid)
      └─ segments.json  (stany + historia + krawędzie)
```

### Kluczowa różnica: graf, nie łańcuch

```
# Łańcuch (stare podejście — błędne):
START → pulpit → modal → pulpit_kopia → END

# Graf stanów (obecne podejście):
START → state_000 (pulpit) → state_001 (modal) → state_000 (pulpit) → END
                                                        ↑ ten sam węzeł
```

Krawędź `state_001 → state_000` w JSON będzie miała `count: 1`,
co oznacza że to przejście wykonano raz. Jeśli użytkownik otworzył i zamknął
modal trzy razy, krawędź będzie miała `count: 3`.

---

## 2. Wymagania i instalacja

### Python

Wymagany Python 3.8+.

```bash
# Sprawdź wersję
python --version
```

### ffmpeg (wymagany osobno)

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt-get install ffmpeg

# Windows — pobierz z https://ffmpeg.org/download.html i dodaj do PATH
```

### Biblioteki Python

```bash
pip install opencv-python ruptures scikit-image Pillow numpy
```

Pełna lista z wersjami (do `requirements.txt`):

```
opencv-python>=4.8
ruptures>=1.1
scikit-image>=0.21
Pillow>=10.0
numpy>=1.24
```

### Weryfikacja instalacji

```python
import cv2, ruptures, skimage, PIL, numpy
print("OK")
```

---

## 3. Struktura projektu

```
projekt/
├── analyze.py          # główny skrypt (sekcja 11)
├── requirements.txt
├── moje_wideo.mp4      # wejście
└── output/
    ├── keyframes/
    │   ├── state_000_visits-3_first-0.00s.png
    │   ├── state_001_visits-1_first-4.20s.png
    │   └── ...
    ├── keyframes.zip
    ├── transition_tree.mmd
    └── segments.json
```

---

## Krok 1 — Ekstrakcja klatek

Zamiast pobierać każdą klatkę (co jest wolne i redundantne), stosujemy
adaptacyjny krok: dzielimy całkowitą liczbę klatek przez `MAX_FRAMES`.
Dla wideo 30fps × 60s = 1800 klatek przy MAX_FRAMES=300 pobieramy
co 6. klatkę (~5fps próbkowania).

```python
import cv2
import numpy as np

VIDEO_PATH = "moje_wideo.mp4"
MAX_FRAMES = 300

cap   = cv2.VideoCapture(VIDEO_PATH)
fps   = cap.get(cv2.CAP_PROP_FPS)
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
step  = max(1, total // MAX_FRAMES)

frames, timestamps = [], []
idx = 0
while True:
    ret, frame = cap.read()
    if not ret:
        break
    if idx % step == 0:
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        timestamps.append(idx / fps)
    idx += 1
cap.release()

print(f"FPS: {fps:.1f} | Klatek: {total} | Próbkowane: {len(frames)} | Czas: {total/fps:.1f}s")
```

---

## Krok 2 — Cechy wizualne i sygnał zmiany

### Maska kursora

Kursor myszy porusza się przez cały czas i wywołuje fałszywe alarmy
w pixel_diff. Rozwiązanie: ignorujemy środkowy obszar ekranu przy obliczaniu
pixel diff. Obszar jest konfigurowalny przez `CURSOR_MASK_FRAC`.

```python
CURSOR_MASK_FRAC = 0.15  # ignoruj środkowe 15% x 15% ekranu

H, W = frames[0].shape[:2]
mask = np.ones((H, W), dtype=bool)
if CURSOR_MASK_FRAC > 0:
    mh = int(H * CURSOR_MASK_FRAC)
    mw = int(W * CURSOR_MASK_FRAC)
    cy, cx = H // 2, W // 2
    mask[cy-mh:cy+mh, cx-mw:cx+mw] = False
```

### Trzy kanały cech

Każda para sąsiednich klatek opisana jest trzema wartościami:

**pixel_diff** — średnia bezwzględna różnica pikseli z maską kursora.
Wychwytuje nagłe, duże zmiany treści ekranu.

**pHash dist** — odległość Hamminga perceptualnego hasha.
pHash jest odporny na artefakty kompresji i drobne animacje UI
(hover effects, subpixel rendering). Jeśli dwie klatki są wizualnie
identyczne, ich hash jest taki sam nawet gdy pixel_diff > 0.

**histogram_diff** — L1-odległość histogramów kolorów RGB.
Wychwytuje zmiany oświetlenia, motywu (dark/light mode), tła.

```python
from skimage.transform import resize

THUMB = (64, 64)

def perceptual_hash(frame, size=16):
    small = resize(frame, (size, size), anti_aliasing=True)
    gray  = np.mean(small, axis=2)
    return gray > gray.mean()

def masked_pixel_diff(f1, f2, mask):
    d = np.abs(f1.astype(float) - f2.astype(float)).mean(axis=2)
    return float(d[mask].mean())

def color_histogram(frame, bins=32):
    h = []
    for ch in range(3):
        hi, _ = np.histogram(frame[:,:,ch], bins=bins, range=(0,255))
        h.append(hi / hi.sum())
    return np.concatenate(h)

thumbs = [resize(f, THUMB, anti_aliasing=True) for f in frames]
hashes = [perceptual_hash(f) for f in thumbs]
hists  = [color_histogram(f) for f in frames]

pixel_diffs, phash_dists, hist_diffs = [], [], []
for i in range(1, len(frames)):
    pixel_diffs.append(masked_pixel_diff(frames[i], frames[i-1], mask))
    phash_dists.append(np.sum(hashes[i] != hashes[i-1]) / hashes[i].size)
    hist_diffs.append(float(np.sum(np.abs(hists[i] - hists[i-1]))))

def normalize(arr):
    a = np.array(arr, dtype=float)
    return (a - a.min()) / (a.max() - a.min() + 1e-9)

# Sygnał łączony — pixel i phash po 45%, histogram 10%
signal = 0.45 * normalize(pixel_diffs) + 0.45 * normalize(phash_dists) + 0.10 * normalize(hist_diffs)
```

---

## Krok 3 — Detekcja punktów zmiany stanu (PELT)

PELT (Pruned Exact Linear Time) to algorytm segmentacji sygnałów
szukający optymalnych punktów podziału bez podawania ich z góry liczby.

Zamiast progu absolutnego (`if diff > 0.3`) używamy penalty adaptacyjnego:
`penalty = mediana(sygnału) × PENALTY_FACTOR`. Dzięki temu próg
automatycznie dostosowuje się do charakterystyki danego wideo.

```python
import ruptures as rpt

PENALTY_FACTOR    = 12
MIN_SEGMENT_FRAMES = 4

PENALTY = float(np.median(signal) * PENALTY_FACTOR)
algo    = rpt.Pelt(model='rbf', min_size=MIN_SEGMENT_FRAMES, jump=1).fit(signal.reshape(-1, 1))
bps     = algo.predict(pen=PENALTY)
change_points = bps[:-1]  # ostatni element = koniec sygnału, pomijamy

print(f"Punktów zmiany: {len(change_points)} (penalty={PENALTY:.4f})")
for cp in change_points:
    t = timestamps[min(cp, len(timestamps)-1)]
    print(f"  klatka {cp:4d} | {t:.2f}s")
```

Parametr `model='rbf'` oznacza że PELT szuka zmian w rozkładzie sygnału
(nie tylko w wartości średniej), co sprawia że wykrywa zarówno
nagłe skoki jak i stopniowe dryfowanie.

---

## Krok 4 — Graf stanów z deduplicacją

To jest serce całego potoku. Każdy surowy segment jest porównywany SSIM
ze **wszystkimi** dotychczas zarejestrowanymi stanami (nie tylko z poprzednim).

SSIM (Structural Similarity Index) mierzy podobieństwo strukturalne dwóch
obrazów, uwzględniając luminancję, kontrast i strukturę. Jest znacznie
lepsza niż pixel_diff do pytania „czy te dwa ekrany wyglądają tak samo?".

```python
from skimage.color import rgb2gray
from skimage.metrics import structural_similarity as ssim

DEDUP_THRESHOLD = 0.92  # SSIM >= tego progu → ten sam stan

def best_keyframe(frames, start, end, signal):
    """Najstabilniejsza klatka w segmencie (najmniejsza aktywność)."""
    seg_sig = signal[start:min(end, len(signal))]
    if len(seg_sig) == 0:
        return start
    return start + int(np.argmin(seg_sig))

def ssim_score(f1, f2, size=(128, 128)):
    g1 = rgb2gray(resize(f1, size, anti_aliasing=True))
    g2 = rgb2gray(resize(f2, size, anti_aliasing=True))
    return float(ssim(g1, g2, data_range=1.0))

# Budowanie surowych segmentów
boundaries = [0] + list(change_points) + [len(frames)]
raw_segments = []
for i in range(len(boundaries) - 1):
    s, e = boundaries[i], boundaries[i+1]
    if e - s < MIN_SEGMENT_FRAMES:
        continue
    kf  = best_keyframe(frames, s, e, signal)
    t_s = timestamps[min(s, len(timestamps)-1)]
    t_e = timestamps[min(e-1, len(timestamps)-1)]
    raw_segments.append({
        'start': s, 'end': e, 'keyframe_idx': kf,
        'start_ts': round(t_s, 2), 'end_ts': round(t_e, 2),
        'duration': round(t_e - t_s, 2),
        'frame_count': e - s,
        'mean_activity': round(float(np.mean(signal[s:min(e, len(signal))])), 4),
    })

# Graf stanów
states = []       # węzły: unikalne stany ekranu
occurrences = []  # historia: kolejność czasowa wizyt

for seg in raw_segments:
    kf_frame = frames[seg['keyframe_idx']]

    # Porównaj z WSZYSTKIMI dotychczasowymi stanami
    matched_state = None
    best_sim = 0.0
    for st in states:
        sim = ssim_score(kf_frame, frames[st['keyframe_idx']])
        if sim > best_sim:
            best_sim = sim
            if sim >= DEDUP_THRESHOLD:
                matched_state = st

    if matched_state is None:
        # Nowy unikalny stan — nowy węzeł grafu
        state_id = f"state_{len(states):03d}"
        new_state = {
            'state_id':      state_id,
            'keyframe_idx':  seg['keyframe_idx'],
            'mean_activity': seg['mean_activity'],
            'visit_count':   1,
            'first_seen_ts': seg['start_ts'],
            'keyframe_file': '',
        }
        states.append(new_state)
        matched_state = new_state
        print(f"  Nowy stan:   {state_id} | {seg['start_ts']}s")
    else:
        # Powrót do istniejącego węzła
        matched_state['visit_count'] += 1
        print(f"  Powrót do:   {matched_state['state_id']} | {seg['start_ts']}s (SSIM={best_sim:.3f})")

    occurrences.append({
        'occurrence_id': f"occ_{len(occurrences):03d}",
        'state_id':      matched_state['state_id'],
        'start_ts':      seg['start_ts'],
        'end_ts':        seg['end_ts'],
        'duration':      seg['duration'],
        'frame_count':   seg['frame_count'],
        'mean_activity': seg['mean_activity'],
    })

# Krawędzie grafu z licznikami
edges = {}
for i in range(1, len(occurrences)):
    key = (occurrences[i-1]['state_id'], occurrences[i]['state_id'])
    edges[key] = edges.get(key, 0) + 1

print(f"\nUnikalnych stanów: {len(states)}")
print(f"Wystąpień łącznie:  {len(occurrences)}")
print(f"Krawędzi w grafie:  {len(edges)}")
```

---

## Krok 5 — Eksport wyników

### PNG klatek kluczowych

Eksportujemy tylko **unikalne stany** (nie każde wystąpienie).
Nazwa pliku zawiera ID stanu, liczbę wizyt i timestamp pierwszego pojawienia.

```python
import os, zipfile
from PIL import Image

OUT_DIR = "output/keyframes"
os.makedirs(OUT_DIR, exist_ok=True)

for st in states:
    frame = frames[st['keyframe_idx']]
    fname = f"{st['state_id']}_visits-{st['visit_count']}_first-{st['first_seen_ts']:.2f}s.png"
    path  = os.path.join(OUT_DIR, fname)
    Image.fromarray(frame).save(path)
    st['keyframe_file'] = fname

with zipfile.ZipFile("output/keyframes.zip", 'w') as zf:
    for fname in os.listdir(OUT_DIR):
        zf.write(os.path.join(OUT_DIR, fname), fname)

print(f"{len(states)} stanów zapisanych → output/keyframes.zip")
```

### Graf Mermaid

Węzły reprezentują unikalne stany. Krawędzie mają etykietę `Nx` gdy
przejście wykonano więcej niż raz. Kolor węzła koduje częstotliwość wizyt:
niebieski (rzadko odwiedzany) → czerwony (często odwiedzany).

```python
def build_mermaid_graph(states, occurrences, edges):
    lines = ['flowchart TD']
    max_visits = max(st['visit_count'] for st in states) if states else 1

    for st in states:
        sid   = st['state_id']
        label = f"{sid}\\nOdwiedzony: {st['visit_count']}x\\nPierwszy raz: {st['first_seen_ts']}s"
        lines.append(f'    {sid}["{label}"]')

    lines.append('    START([START])')
    lines.append('    END([END])')

    if occurrences:
        lines.append(f"    START --> {occurrences[0]['state_id']}")

    for (frm, to), count in edges.items():
        label = f"|{count}x|" if count > 1 else ""
        lines.append(f'    {frm} -->{label} {to}')

    if occurrences:
        lines.append(f"    {occurrences[-1]['state_id']} --> END")

    for st in states:
        sid   = st['state_id']
        ratio = (st['visit_count'] - 1) / (max_visits - 1 + 1e-9)
        r = int(60  + 180 * ratio)
        g = int(120 -  80 * ratio)
        b = int(200 - 150 * ratio)
        lines.append(f'    style {sid} fill:#{r:02X}{g:02X}{b:02X},color:#fff,stroke:#333,stroke-width:2px')

    lines.append('    style START fill:#2C2C2A,color:#fff,stroke:#555')
    lines.append('    style END   fill:#2C2C2A,color:#fff,stroke:#555')
    return '\n'.join(lines)

mermaid_code = build_mermaid_graph(states, occurrences, edges)

with open("output/transition_tree.mmd", 'w', encoding='utf-8') as f:
    f.write(mermaid_code)

print("Wklej zawartość transition_tree.mmd na https://mermaid.live")
```

### JSON

Trzy kluczowe sekcje: `states` (węzły grafu), `occurrences` (pełna historia
czasowa), `transitions` (krawędzie z licznikami).

```python
import json

output = {
    'video': VIDEO_PATH,
    'fps': round(fps, 2),
    'total_duration_s': round(timestamps[-1], 2),
    'config': {
        'penalty_factor':     PENALTY_FACTOR,
        'dedup_threshold':    DEDUP_THRESHOLD,
        'cursor_mask_frac':   CURSOR_MASK_FRAC,
        'min_segment_frames': MIN_SEGMENT_FRAMES,
    },
    'summary': {
        'unique_states':     len(states),
        'total_occurrences': len(occurrences),
        'total_transitions': len(edges),
    },
    'states': [
        {
            'state_id':      st['state_id'],
            'visit_count':   st['visit_count'],
            'first_seen_ts': st['first_seen_ts'],
            'keyframe_file': st.get('keyframe_file', ''),
            'mean_activity': st['mean_activity'],
        }
        for st in states
    ],
    'occurrences': occurrences,
    'transitions': [
        {'from': frm, 'to': to, 'count': cnt}
        for (frm, to), cnt in edges.items()
    ],
}

with open("output/segments.json", 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
```

Przykładowy wynik dla scenariusza pulpit → modal → pulpit:

```json
{
  "summary": {
    "unique_states": 2,
    "total_occurrences": 3,
    "total_transitions": 2
  },
  "states": [
    { "state_id": "state_000", "visit_count": 2, "first_seen_ts": 0.0 },
    { "state_id": "state_001", "visit_count": 1, "first_seen_ts": 4.2 }
  ],
  "transitions": [
    { "from": "state_000", "to": "state_001", "count": 1 },
    { "from": "state_001", "to": "state_000", "count": 1 }
  ]
}
```

---

## Parametry konfiguracyjne

| Parametr | Domyślnie | Opis |
|---|---|---|
| `MAX_FRAMES` | 300 | Maks. klatek do analizy. Więcej = wolniej, ale bardziej precyzyjnie dla długich wideo. |
| `CURSOR_MASK_FRAC` | 0.15 | Ułamek środkowego obszaru ignorowany przy pixel_diff. `0.0` = analizuj cały obraz. |
| `PENALTY_FACTOR` | 12 | Mnożnik mediany sygnału → próg PELT. Wyższy = mniej segmentów. |
| `DEDUP_THRESHOLD` | 0.92 | Próg SSIM do uznania segmentu za powrót do istniejącego stanu. |
| `MIN_SEGMENT_FRAMES` | 4 | Minimalna liczba klatek segmentu — krótsze są odrzucane jako szum. |

### Typowe scenariusze dostrajania

| Problem | Rozwiązanie |
|---|---|
| Za dużo segmentów (każde kliknięcie = nowy stan) | Zwiększ `PENALTY_FACTOR` do 15–20 |
| Za mało segmentów (duże przejścia nie są wykrywane) | Zmniejsz `PENALTY_FACTOR` do 6–8 |
| Ruch kursora nadal wykrywany jako zmiana | Zwiększ `CURSOR_MASK_FRAC` do 0.25 |
| Różne ekrany traktowane jako ten sam stan | Zmniejsz `DEDUP_THRESHOLD` do 0.85 |
| Ten sam ekran traktowany jako nowy stan | Zwiększ `DEDUP_THRESHOLD` do 0.95 |
| Wideo bardzo długie (>5 min) | Zwiększ `MAX_FRAMES` do 500–600 |

---

## Interpretacja wyników

### Plik `transition_tree.mmd`

Otwórz na [mermaid.live](https://mermaid.live) lub wklej do dowolnego narzędzia
obsługującego Mermaid (Notion, Obsidian, GitHub Markdown, VS Code z pluginem).

- Każdy prostokąt = unikalny ekran / stan UI
- Krawędź z etykietą `3x` = to przejście wykonano trzy razy
- Kolor węzła: niebieski = rzadko odwiedzany, czerwony = często odwiedzany

### Plik `keyframes.zip`

Zawiera po jednym PNG na unikalny stan. Nazwa pliku:

```
state_000_visits-3_first-0.00s.png
└─ ID stanu ─┘  └─ wizyty ┘ └─ pierwszy raz
```

### Plik `segments.json`

- `states` — słownik unikalnych stanów (węzły grafu)
- `occurrences` — pełna historia w kolejności czasowej (kiedy pojawił się każdy stan)
- `transitions` — krawędzie grafu z licznikami przejść

---

## Kompletny skrypt lokalny

Poniżej pełny skrypt do uruchomienia lokalnie z wiersza poleceń.
Wszystkie poprzednie fragmenty są tu złączone w jeden plik `analyze.py`.

```python
"""
analyze.py — Detekcja zmian stanu akcji użytkownika na nagraniu ekranu.

Użycie:
    python analyze.py moje_wideo.mp4
    python analyze.py moje_wideo.mp4 --penalty 15 --dedup 0.90

Wyniki zapisywane do katalogu output/
"""

import os, sys, json, zipfile, argparse
import cv2
import numpy as np
from skimage.transform import resize
from skimage.color import rgb2gray
from skimage.metrics import structural_similarity as ssim_fn
from PIL import Image

try:
    import ruptures as rpt
except ImportError:
    sys.exit("Brak biblioteki ruptures. Uruchom: pip install ruptures")


# ── Konfiguracja ──────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Analiza zmian stanu w nagraniu ekranu")
    p.add_argument("video", help="Ścieżka do pliku wideo (MP4, MOV, AVI)")
    p.add_argument("--max-frames",   type=int,   default=300,  help="Maks. klatek (domyślnie 300)")
    p.add_argument("--cursor-mask",  type=float, default=0.15, help="Maska kursora (domyślnie 0.15)")
    p.add_argument("--penalty",      type=float, default=12,   help="PENALTY_FACTOR (domyślnie 12)")
    p.add_argument("--dedup",        type=float, default=0.92, help="Próg SSIM (domyślnie 0.92)")
    p.add_argument("--min-frames",   type=int,   default=4,    help="Min. klatek segmentu (domyślnie 4)")
    p.add_argument("--output",       default="output",         help="Katalog wyjściowy (domyślnie output/)")
    return p.parse_args()


# ── Ekstrakcja klatek ─────────────────────────────────────────────────────────

def extract_frames(video_path, max_frames):
    cap   = cv2.VideoCapture(video_path)
    fps   = cap.get(cv2.CAP_PROP_FPS)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step  = max(1, total // max_frames)

    frames, timestamps = [], []
    idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % step == 0:
            frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            timestamps.append(idx / fps)
        idx += 1
    cap.release()
    print(f"FPS: {fps:.1f} | Klatek: {total} | Próbkowane: {len(frames)} | Czas: {total/fps:.1f}s")
    return frames, timestamps, fps


# ── Cechy wizualne ────────────────────────────────────────────────────────────

def build_cursor_mask(frames, cursor_mask_frac):
    H, W = frames[0].shape[:2]
    mask = np.ones((H, W), dtype=bool)
    if cursor_mask_frac > 0:
        mh = int(H * cursor_mask_frac)
        mw = int(W * cursor_mask_frac)
        cy, cx = H // 2, W // 2
        mask[cy-mh:cy+mh, cx-mw:cx+mw] = False
    return mask

def perceptual_hash(frame, size=16):
    small = resize(frame, (size, size), anti_aliasing=True)
    gray  = np.mean(small, axis=2)
    return gray > gray.mean()

def masked_pixel_diff(f1, f2, mask):
    d = np.abs(f1.astype(float) - f2.astype(float)).mean(axis=2)
    return float(d[mask].mean())

def color_histogram(frame, bins=32):
    h = []
    for ch in range(3):
        hi, _ = np.histogram(frame[:,:,ch], bins=bins, range=(0,255))
        h.append(hi / hi.sum())
    return np.concatenate(h)

def normalize(arr):
    a = np.array(arr, dtype=float)
    return (a - a.min()) / (a.max() - a.min() + 1e-9)

def compute_signal(frames, mask):
    THUMB = (64, 64)
    thumbs = [resize(f, THUMB, anti_aliasing=True) for f in frames]
    hashes = [perceptual_hash(f) for f in thumbs]
    hists  = [color_histogram(f) for f in frames]

    pixel_diffs, phash_dists, hist_diffs = [], [], []
    for i in range(1, len(frames)):
        pixel_diffs.append(masked_pixel_diff(frames[i], frames[i-1], mask))
        phash_dists.append(np.sum(hashes[i] != hashes[i-1]) / hashes[i].size)
        hist_diffs.append(float(np.sum(np.abs(hists[i] - hists[i-1]))))

    return 0.45 * normalize(pixel_diffs) + 0.45 * normalize(phash_dists) + 0.10 * normalize(hist_diffs)


# ── Detekcja punktów zmiany (PELT) ────────────────────────────────────────────

def detect_change_points(signal, penalty_factor, min_segment_frames):
    penalty = float(np.median(signal) * penalty_factor)
    algo    = rpt.Pelt(model='rbf', min_size=min_segment_frames, jump=1).fit(signal.reshape(-1, 1))
    bps     = algo.predict(pen=penalty)
    print(f"Punktów zmiany: {len(bps)-1} (penalty={penalty:.4f})")
    return bps[:-1]


# ── Graf stanów ───────────────────────────────────────────────────────────────

def best_keyframe(signal, start, end):
    seg = signal[start:min(end, len(signal))]
    return start + int(np.argmin(seg)) if len(seg) > 0 else start

def ssim_score(f1, f2, size=(128, 128)):
    g1 = rgb2gray(resize(f1, size, anti_aliasing=True))
    g2 = rgb2gray(resize(f2, size, anti_aliasing=True))
    return float(ssim_fn(g1, g2, data_range=1.0))

def build_state_graph(frames, timestamps, change_points, signal, min_frames, dedup_threshold):
    boundaries = [0] + list(change_points) + [len(frames)]

    raw_segments = []
    for i in range(len(boundaries) - 1):
        s, e = boundaries[i], boundaries[i+1]
        if e - s < min_frames:
            continue
        kf  = best_keyframe(signal, s, e)
        t_s = timestamps[min(s, len(timestamps)-1)]
        t_e = timestamps[min(e-1, len(timestamps)-1)]
        raw_segments.append({
            'start': s, 'end': e, 'keyframe_idx': kf,
            'start_ts': round(t_s, 2), 'end_ts': round(t_e, 2),
            'duration': round(t_e - t_s, 2),
            'frame_count': e - s,
            'mean_activity': round(float(np.mean(signal[s:min(e, len(signal))])), 4),
        })

    states, occurrences = [], []
    for seg in raw_segments:
        kf_frame = frames[seg['keyframe_idx']]

        matched_state = None
        best_sim = 0.0
        for st in states:
            sim = ssim_score(kf_frame, frames[st['keyframe_idx']])
            if sim > best_sim:
                best_sim = sim
                if sim >= dedup_threshold:
                    matched_state = st

        if matched_state is None:
            state_id = f"state_{len(states):03d}"
            matched_state = {
                'state_id': state_id, 'keyframe_idx': seg['keyframe_idx'],
                'mean_activity': seg['mean_activity'], 'visit_count': 1,
                'first_seen_ts': seg['start_ts'], 'keyframe_file': '',
            }
            states.append(matched_state)
            print(f"  Nowy stan:   {state_id} | {seg['start_ts']}s")
        else:
            matched_state['visit_count'] += 1
            print(f"  Powrót do:   {matched_state['state_id']} | {seg['start_ts']}s (SSIM={best_sim:.3f})")

        occurrences.append({
            'occurrence_id': f"occ_{len(occurrences):03d}",
            'state_id': matched_state['state_id'],
            'start_ts': seg['start_ts'], 'end_ts': seg['end_ts'],
            'duration': seg['duration'], 'frame_count': seg['frame_count'],
            'mean_activity': seg['mean_activity'],
        })

    edges = {}
    for i in range(1, len(occurrences)):
        key = (occurrences[i-1]['state_id'], occurrences[i]['state_id'])
        edges[key] = edges.get(key, 0) + 1

    print(f"\nUnikalnych stanów: {len(states)} | Wystąpień: {len(occurrences)} | Krawędzi: {len(edges)}")
    return states, occurrences, edges


# ── Eksport ───────────────────────────────────────────────────────────────────

def export_keyframes(frames, states, out_dir):
    kf_dir = os.path.join(out_dir, "keyframes")
    os.makedirs(kf_dir, exist_ok=True)
    for st in states:
        fname = f"{st['state_id']}_visits-{st['visit_count']}_first-{st['first_seen_ts']:.2f}s.png"
        path  = os.path.join(kf_dir, fname)
        Image.fromarray(frames[st['keyframe_idx']]).save(path)
        st['keyframe_file'] = fname
    zip_path = os.path.join(out_dir, "keyframes.zip")
    with zipfile.ZipFile(zip_path, 'w') as zf:
        for fname in os.listdir(kf_dir):
            zf.write(os.path.join(kf_dir, fname), fname)
    print(f"{len(states)} stanów → {zip_path}")

def export_mermaid(states, occurrences, edges, out_dir):
    lines = ['flowchart TD']
    max_visits = max(st['visit_count'] for st in states) if states else 1
    for st in states:
        sid   = st['state_id']
        label = f"{sid}\\nOdwiedzony: {st['visit_count']}x\\nPierwszy raz: {st['first_seen_ts']}s"
        lines.append(f'    {sid}["{label}"]')
    lines += ['    START([START])', '    END([END])']
    if occurrences:
        lines.append(f"    START --> {occurrences[0]['state_id']}")
    for (frm, to), count in edges.items():
        lbl = f"|{count}x|" if count > 1 else ""
        lines.append(f'    {frm} -->{lbl} {to}')
    if occurrences:
        lines.append(f"    {occurrences[-1]['state_id']} --> END")
    for st in states:
        sid   = st['state_id']
        ratio = (st['visit_count'] - 1) / (max_visits - 1 + 1e-9)
        r = int(60 + 180 * ratio); g = int(120 - 80 * ratio); b = int(200 - 150 * ratio)
        lines.append(f'    style {sid} fill:#{r:02X}{g:02X}{b:02X},color:#fff,stroke:#333,stroke-width:2px')
    lines += ['    style START fill:#2C2C2A,color:#fff,stroke:#555',
              '    style END   fill:#2C2C2A,color:#fff,stroke:#555']
    code = '\n'.join(lines)
    path = os.path.join(out_dir, "transition_tree.mmd")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"Graf Mermaid → {path}  (wklej na https://mermaid.live)")

def export_json(video_path, fps, timestamps, frames, states, occurrences, edges, config, out_dir):
    output = {
        'video': video_path, 'fps': round(fps, 2),
        'total_duration_s': round(timestamps[-1], 2),
        'config': config,
        'summary': {
            'unique_states': len(states),
            'total_occurrences': len(occurrences),
            'total_transitions': len(edges),
        },
        'states': [
            {'state_id': st['state_id'], 'visit_count': st['visit_count'],
             'first_seen_ts': st['first_seen_ts'], 'keyframe_file': st.get('keyframe_file', ''),
             'mean_activity': st['mean_activity']}
            for st in states
        ],
        'occurrences': occurrences,
        'transitions': [{'from': f, 'to': t, 'count': c} for (f, t), c in edges.items()],
    }
    path = os.path.join(out_dir, "segments.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"JSON → {path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    if not os.path.exists(args.video):
        sys.exit(f"Plik nie istnieje: {args.video}")

    os.makedirs(args.output, exist_ok=True)

    print("\n── Ekstrakcja klatek ────────────────────────────────────")
    frames, timestamps, fps = extract_frames(args.video, args.max_frames)

    print("\n── Cechy wizualne ───────────────────────────────────────")
    mask   = build_cursor_mask(frames, args.cursor_mask)
    signal = compute_signal(frames, mask)
    print(f"Sygnał obliczony dla {len(signal)} par klatek")

    print("\n── Detekcja zmian (PELT) ────────────────────────────────")
    change_points = detect_change_points(signal, args.penalty, args.min_frames)

    print("\n── Graf stanów ──────────────────────────────────────────")
    states, occurrences, edges = build_state_graph(
        frames, timestamps, change_points, signal, args.min_frames, args.dedup
    )

    print("\n── Eksport ──────────────────────────────────────────────")
    export_keyframes(frames, states, args.output)
    export_mermaid(states, occurrences, edges, args.output)
    export_json(args.video, fps, timestamps, frames, states, occurrences, edges, {
        'max_frames': args.max_frames, 'cursor_mask_frac': args.cursor_mask,
        'penalty_factor': args.penalty, 'dedup_threshold': args.dedup,
        'min_segment_frames': args.min_frames,
    }, args.output)

    print(f"\n✓ Gotowe. Wyniki w katalogu: {args.output}/")

if __name__ == "__main__":
    main()
```

### Uruchomienie

```bash
# Podstawowe
python analyze.py moje_wideo.mp4

# Z niestandardowymi parametrami
python analyze.py moje_wideo.mp4 --penalty 15 --dedup 0.90 --output wyniki/

# Pomoc
python analyze.py --help
```

---

*Dokumentacja wygenerowana na podstawie sesji iteracyjnego budowania potoku.*
*Notebook Google Colab z tym samym kodem dostępny jako `video_analysis_pipeline.ipynb`.*
