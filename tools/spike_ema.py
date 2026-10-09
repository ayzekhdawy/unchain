"""EMA Lightning CPU ölçümü. JSON yazar: docs/spike-result.json"""

from __future__ import annotations

import json
import time
from pathlib import Path

SHORT = "Merhaba. Bu ses yapay zekâ ile üretilmiştir."
LONG = (
    "Gece inince oda küçülür. Masanın üstündeki kitap, kapattığın yerden nefes alır. "
    "Bir cümle biter, vurgu bir sonrakine kayar. Sayı 15 Ekim 2026 tarihinde, "
    "saat 14:30'da okunur. 1.250 lira tutarındaki not da düz yazıdır."
)


def main() -> None:
    from ema_lightning import EMA

    t0 = time.perf_counter()
    tts = EMA()
    load_s = time.perf_counter() - t0

    t1 = time.perf_counter()
    short = tts.say(SHORT, speed=1.0, seed=0)
    short_s = time.perf_counter() - t1

    t1b = time.perf_counter()
    warm = tts.say(SHORT, speed=1.0, seed=0)
    warm_s = time.perf_counter() - t1b

    t2 = time.perf_counter()
    long = tts.say(LONG, speed=1.0, seed=0)
    long_s = time.perf_counter() - t2
    rtf = long_s / long.duration if long.duration else None

    result = {
        "engine": "ema-lightning",
        "device": "cpu",
        "load_s": round(load_s, 3),
        "short_text": SHORT,
        "short_generate_s": round(short_s, 3),
        "warm_short_generate_s": round(warm_s, 3),
        "warm_short_audio_s": round(warm.duration, 3),
        "short_audio_s": round(short.duration, 3),
        "short_words": [
            {"text": w.text, "start": round(w.start, 3), "end": round(w.end, 3)}
            for w in short.words
        ],
        "long_chars": len(LONG),
        "long_generate_s": round(long_s, 3),
        "long_audio_s": round(long.duration, 3),
        "rtf": None if rtf is None else round(rtf, 4),
        "realtime_factor_note": "rtf < 1 means generation is faster than playback",
        "pass_first_audio_under_2s": short_s < 2,
        "pass_warm_audio_under_2s": warm_s < 2,
        "pass_at_least_1x_realtime": bool(rtf is not None and rtf <= 1),
    }
    out = Path(__file__).resolve().parents[1] / "docs" / "spike-result.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
