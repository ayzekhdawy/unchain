"""Export EMA Lightning's three stages to ONNX and check one sentence.

Writes apps/web/public/ema/{text,sound,decoder}.onnx and meta.json.
The check fails if ONNX audio does not match the PyTorch engine.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "web" / "public" / "ema"
SENTENCE = "Merhaba. Bu ses yapay zekâ ile üretilmiştir."


def eager_attention(module, x, cos, sin, mask):
    """Same math as scaled_dot_product_attention, without the fused op ONNX rejects."""
    batch, steps, _ = x.shape
    q, k, v = (t.view(batch, steps, module.h, module.dh).transpose(1, 2) for t in module.qkv(x).chunk(3, -1))
    from ema_lightning.model import apply_rope

    q, k = apply_rope(q, cos, sin), apply_rope(k, cos, sin)
    logits = (q @ k.transpose(-2, -1)) / math.sqrt(module.dh)
    allow = mask[:, None, None, :].to(dtype=torch.bool)
    logits = logits.masked_fill(~allow, -1e4)
    weights = logits.softmax(-1) * allow
    mixed = (weights @ v).transpose(1, 2).reshape(batch, steps, -1)
    return module.proj(mixed)


def patch_attention() -> None:
    from ema_lightning.model import Attention

    Attention.forward = eager_attention
    # opset 17 has Exp, not ExpM1. expm1(x) = exp(x) - 1.
    torch.expm1 = lambda tensor: torch.exp(tensor) - 1


class TextWrap(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, ids, mask):
        return self.model.text_stage(ids, mask)


class SoundWrap(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, hidden, dur, mask, cw, wstart, fw, fp, fmask, noise):
        return self.model.sound_stage(hidden, dur, mask, cw, wstart, fw, fp, fmask, noise)


class DecodeWrap(nn.Module):
    def __init__(self, decoder):
        super().__init__()
        self.decoder = decoder

    def forward(self, latents):
        # latents: [1, frames, 64]. Length is trimmed in the browser from the frame count.
        audio = self.decoder(latents.transpose(1, 2), None)
        return audio


def export(module, args, path: Path, names: list[str], outputs: list[str], axes: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        input_names=names,
        output_names=outputs,
        dynamic_axes=axes,
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )
    try:
        torch.onnx.export(module, args, str(path), **kwargs)
    except TypeError:
        kwargs.pop("dynamo")
        torch.onnx.export(module, args, str(path), **kwargs)


def correlate(a: np.ndarray, b: np.ndarray) -> float:
    n = min(a.size, b.size)
    x = a.reshape(-1)[:n].astype(np.float64)
    y = b.reshape(-1)[:n].astype(np.float64)
    x = x - x.mean()
    y = y - y.mean()
    denom = np.linalg.norm(x) * np.linalg.norm(y)
    if denom == 0:
        return 0.0
    return float((x @ y) / denom)


def main() -> None:
    import onnxruntime as ort
    from ema_lightning import EMA

    patch_attention()
    torch.manual_seed(0)
    tts = EMA(device="cpu")
    engine = tts._engine
    model = engine.model.eval()
    decoder = engine.decoder.eval()
    spoken = tts._frontend(SENTENCE)
    piece = engine.piece(spoken, 0.0, 1)
    engine.plan([piece], 1.0)
    noise = engine.noise(piece)
    stacked = engine.stack([noise], piece.frames, 0.0, dim=1)
    with torch.no_grad():
        latents = model.sound_stage(
            piece.h[None],
            piece.dur[None],
            torch.ones(1, piece.letters, dtype=torch.bool),
            piece.cw[None],
            piece.wstart[None],
            piece.fw[None],
            piece.fp[None],
            torch.ones(1, piece.frames, dtype=torch.bool),
            stacked,
        )
        audio = decoder(latents.transpose(1, 2), None)[0].cpu().numpy()

    ids = piece.ids[None].to(torch.long)
    mask = torch.ones(1, piece.letters, dtype=torch.bool)
    text_mod = TextWrap(model).eval()
    sound_mod = SoundWrap(model).eval()
    decode_mod = DecodeWrap(decoder).eval()

    export(
        text_mod,
        (ids, mask),
        OUT / "text.onnx",
        ["ids", "mask"],
        ["hidden", "dur"],
        {"ids": {1: "letters"}, "mask": {1: "letters"}, "hidden": {1: "letters"}, "dur": {1: "letters"}},
    )
    export(
        sound_mod,
        (
            piece.h[None],
            piece.dur[None],
            mask,
            piece.cw[None].to(torch.long),
            piece.wstart[None].to(torch.long),
            piece.fw[None].to(torch.long),
            piece.fp[None],
            torch.ones(1, piece.frames, dtype=torch.bool),
            stacked,
        ),
        OUT / "sound.onnx",
        ["hidden", "dur", "mask", "cw", "wstart", "fw", "fp", "fmask", "noise"],
        ["latents"],
        {
            "hidden": {1: "letters"},
            "dur": {1: "letters"},
            "mask": {1: "letters"},
            "cw": {1: "letters"},
            "wstart": {1: "letters"},
            "fw": {1: "frames"},
            "fp": {1: "frames"},
            "fmask": {1: "frames"},
            "noise": {2: "frames"},
            "latents": {1: "frames"},
        },
    )
    export(
        decode_mod,
        (latents,),
        OUT / "decoder.onnx",
        ["latents"],
        ["audio"],
        {"latents": {1: "frames"}, "audio": {1: "samples"}},
    )

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    text = ort.InferenceSession(str(OUT / "text.onnx"), opts, providers=["CPUExecutionProvider"])
    sound = ort.InferenceSession(str(OUT / "sound.onnx"), opts, providers=["CPUExecutionProvider"])
    vocoder = ort.InferenceSession(str(OUT / "decoder.onnx"), opts, providers=["CPUExecutionProvider"])

    def feed(session, values):
        names = [item.name for item in session.get_inputs()]
        return session.run(None, {name: values[name] for name in names})

    hidden_np, dur_np = feed(
        text,
        {"ids": ids.numpy().astype(np.int64), "mask": mask.numpy()},
    )
    latent_np = feed(
        sound,
        {
            "hidden": hidden_np,
            "dur": dur_np,
            "mask": mask.numpy(),
            "cw": piece.cw[None].numpy().astype(np.int64),
            "wstart": piece.wstart[None].numpy().astype(np.int64),
            "fw": piece.fw[None].numpy().astype(np.int64),
            "fp": piece.fp[None].numpy().astype(np.float32),
            "fmask": np.ones((1, piece.frames), dtype=bool),
            "noise": stacked.numpy().astype(np.float32),
        },
    )[0]
    onnx_audio = feed(vocoder, {"latents": latent_np.astype(np.float32)})[0][0]
    score = correlate(audio, onnx_audio)
    peak = float(np.max(np.abs(audio[: min(audio.size, onnx_audio.size)] - onnx_audio[: min(audio.size, onnx_audio.size)])))
    print(json.dumps({
        "spoken": spoken,
        "letters": int(piece.letters),
        "frames": int(piece.frames),
        "audio_s": round(float(audio.size) / 48000, 3),
        "onnx_audio_s": round(float(onnx_audio.size) / 48000, 3),
        "correlation": round(score, 6),
        "peak_abs": round(peak, 6),
        "text_mb": round((OUT / "text.onnx").stat().st_size / 1e6, 2),
        "sound_mb": round((OUT / "sound.onnx").stat().st_size / 1e6, 2),
        "decoder_mb": round((OUT / "decoder.onnx").stat().st_size / 1e6, 2),
    }, ensure_ascii=False))
    if score < 0.99 or abs(audio.size - onnx_audio.size) > 1920:
        sys.exit(1)

    # A second length proves the decoder was not frozen to the traced frame count.
    short = engine.piece(tts._frontend("Deneme."), 0.0, 2)
    engine.plan([short], 1.0)
    short_noise = engine.stack([engine.noise(short)], short.frames, 0.0, dim=1)
    with torch.no_grad():
        short_h, short_dur = model.text_stage(short.ids[None].to(torch.long), torch.ones(1, short.letters, dtype=torch.bool))
        short_lat = model.sound_stage(
            short_h,
            short_dur,
            torch.ones(1, short.letters, dtype=torch.bool),
            short.cw[None].to(torch.long),
            short.wstart[None].to(torch.long),
            short.fw[None].to(torch.long),
            short.fp[None],
            torch.ones(1, short.frames, dtype=torch.bool),
            short_noise,
        )
    short_onnx = feed(vocoder, {"latents": short_lat.numpy().astype(np.float32)})[0]
    expect = int(short.frames) * int(decoder.hop)
    print(json.dumps({"short_frames": int(short.frames), "short_samples": int(short_onnx.shape[-1]), "expect": expect}))
    if int(short_onnx.shape[-1]) != expect:
        sys.exit(2)

    meta = {
        "model": "canberkkkkkk/ema-lightning",
        "version": "1.0.4",
        "sample_rate": 48000,
        "hop": int(decoder.hop),
        "fps": 25,
        "latent_dim": int(model.latent_dim),
        "steps": len(model.times),
        "times": model.times,
        "vocab": model.vocab,
        "max_word_frames": 250,
        "max_frames": 3000,
        "max_letters": 250,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    timeline = {
        "spoken": spoken,
        "dur": [round(float(x), 6) for x in piece.dur.tolist()],
        "cw": [int(x) for x in piece.cw.tolist()],
        "fw": [int(x) for x in piece.fw.tolist()],
        "frames": int(piece.frames),
    }
    (ROOT / "apps" / "web" / "fixtures" / "ema-timeline.json").write_text(
        json.dumps(timeline, ensure_ascii=False), encoding="utf-8"
    )
    print("export ok")


if __name__ == "__main__":
    main()
