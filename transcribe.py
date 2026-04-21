#!/usr/bin/env python3
"""
Transkrypcja audio z pliku wideo (lub audio) przy użyciu faster-whisper.

Wymagania:
    pip install faster-whisper
    + ffmpeg w systemie (apt install ffmpeg / brew install ffmpeg / choco install ffmpeg)

Użycie:
    python transcribe.py video.mp4
    python transcribe.py video.mp4 --model small --language pl
    python transcribe.py video.mp4 --output transkrypcja.txt --format srt
"""

import argparse
import sys
from pathlib import Path
from datetime import timedelta

from faster_whisper import WhisperModel


def format_timestamp(seconds: float, srt: bool = False) -> str:
    """Formatuje sekundy do HH:MM:SS,mmm (SRT) lub HH:MM:SS.mmm (VTT/czytelny)."""
    td = timedelta(seconds=seconds)
    total_ms = int(td.total_seconds() * 1000)
    hours, rem = divmod(total_ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    sep = "," if srt else "."
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{sep}{ms:03d}"


def transcribe(
    input_path: Path,
    model_size: str = "base",
    language: str | None = None,
    device: str = "auto",
    compute_type: str = "auto",
    beam_size: int = 5,
) -> tuple[list, object]:
    """Transkrybuje plik i zwraca listę segmentów oraz info o detekcji."""
    print(f"[*] Ładowanie modelu '{model_size}' (device={device})...", file=sys.stderr)
    model = WhisperModel(model_size, device=device, compute_type=compute_type)

    print(f"[*] Transkrypcja: {input_path}", file=sys.stderr)
    segments_gen, info = model.transcribe(
        str(input_path),
        language=language,
        beam_size=beam_size,
        vad_filter=True,  # odfiltrowuje ciszę = szybciej + mniej halucynacji
    )

    lang_msg = f"{info.language} (pewność {info.language_probability:.0%})"
    print(f"[*] Wykryty język: {lang_msg}", file=sys.stderr)
    print(f"[*] Długość audio: {info.duration:.1f}s", file=sys.stderr)

    # Materializujemy generator i pokazujemy postęp
    segments = []
    for seg in segments_gen:
        segments.append(seg)
        pct = (seg.end / info.duration) * 100 if info.duration else 0
        print(
            f"\r[*] Postęp: {pct:5.1f}%  [{format_timestamp(seg.end)}]",
            end="",
            file=sys.stderr,
            flush=True,
        )
    print(file=sys.stderr)  # newline po progress barze

    return segments, info


def write_txt(segments, out_path: Path) -> None:
    with out_path.open("w", encoding="utf-8") as f:
        for seg in segments:
            f.write(seg.text.strip() + "\n")


def write_srt(segments, out_path: Path) -> None:
    with out_path.open("w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, start=1):
            f.write(f"{i}\n")
            f.write(
                f"{format_timestamp(seg.start, srt=True)} --> "
                f"{format_timestamp(seg.end, srt=True)}\n"
            )
            f.write(seg.text.strip() + "\n\n")


def write_vtt(segments, out_path: Path) -> None:
    with out_path.open("w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for seg in segments:
            f.write(
                f"{format_timestamp(seg.start)} --> {format_timestamp(seg.end)}\n"
            )
            f.write(seg.text.strip() + "\n\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Transkrypcja pliku wideo/audio przez faster-whisper."
    )
    parser.add_argument("input", type=Path, help="Plik wejściowy (mp4, mkv, mp3, wav, ...)")
    parser.add_argument(
        "--model",
        default="base",
        choices=["tiny", "base", "small", "medium", "large-v3", "turbo"],
        help="Rozmiar modelu (domyślnie: base). Większy = dokładniejszy, ale wolniejszy.",
    )
    parser.add_argument(
        "--language",
        default=None,
        help="Kod języka (np. 'pl', 'en'). Pominięcie = auto-detekcja.",
    )
    parser.add_argument(
        "--device",
        default="auto",
        choices=["auto", "cpu", "cuda"],
        help="Urządzenie (domyślnie: auto).",
    )
    parser.add_argument(
        "--compute-type",
        default="auto",
        help="Typ obliczeń: auto, int8, int8_float16, float16, float32.",
    )
    parser.add_argument(
        "--format",
        default="txt",
        choices=["txt", "srt", "vtt"],
        help="Format wyjściowy (domyślnie: txt).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Plik wyjściowy (domyślnie: <input>.<format>).",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"[!] Plik nie istnieje: {args.input}", file=sys.stderr)
        return 1

    out_path = args.output or args.input.with_suffix(f".{args.format}")

    segments, _info = transcribe(
        args.input,
        model_size=args.model,
        language=args.language,
        device=args.device,
        compute_type=args.compute_type,
    )

    writers = {"txt": write_txt, "srt": write_srt, "vtt": write_vtt}
    writers[args.format](segments, out_path)

    print(f"[✓] Zapisano: {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
