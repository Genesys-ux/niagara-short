"""Strict SKILL.md gated-RMS mixer:
- Music bed sits at exactly 50% of voice gated RMS (-6.0 dB).
- SFX sits at <= 50% of voice gated RMS (-6.0 dB or lower) with peaks capped <= 0.7x voice peak.
- Pure linear sum (no ducking or compression that would change this ratio).

Usage: python mix.py voice.mp3 music.wav sfx.wav [--out mix_raw.wav]
"""
import argparse
import os
import shutil
import subprocess
import wave
import numpy as np

SR = 48000


def get_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def read_wav_mono(path):
    with wave.open(path, "rb") as w:
        ch = w.getnchannels()
        sr = w.getframerate()
        n = w.getnframes()
        sw = w.getsampwidth()
        raw = w.readframes(n)
    if sw == 2:
        arr = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
    elif sw == 4:
        arr = np.frombuffer(raw, np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width {sw} in {path}")
    if ch > 1:
        arr = arr.reshape(-1, ch).mean(axis=1)
    assert sr == SR, f"Expected {SR} Hz, got {sr} Hz in {path}"
    return arr


def write_wav_mono(path, arr):
    pcm = (np.clip(arr, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def gated_rms(x: np.ndarray, sr: int = SR) -> float:
    w = int(0.4 * sr)
    h = int(0.1 * sr)
    if len(x) < w:
        return float(np.sqrt(np.mean(x ** 2) + 1e-18))
    starts = np.arange(0, len(x) - w + 1, h)
    c = np.concatenate([[0.0], np.cumsum(x ** 2, dtype=np.float64)])
    block_ms = (c[starts + w] - c[starts]) / w
    block_db = 10.0 * np.log10(block_ms + 1e-18)
    keep = block_db > -55.0
    if not np.any(keep):
        return float(np.sqrt(np.mean(x ** 2) + 1e-18))
    rel = 10.0 * np.log10(np.mean(block_ms[keep]) + 1e-18) - 10.0
    keep2 = keep & (block_db > rel)
    if not np.any(keep2):
        keep2 = keep
    return float(np.sqrt(np.mean(block_ms[keep2]) + 1e-18))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("voice")
    ap.add_argument("music")
    ap.add_argument("sfx")
    ap.add_argument("--out", default="mix_raw.wav")
    args = ap.parse_args()

    os.makedirs("work", exist_ok=True)
    v_wav = os.path.join("work", "_voice_mix.wav")
    ff = get_ffmpeg()
    subprocess.run(
        [ff, "-v", "error", "-y", "-i", args.voice, "-ar", str(SR), "-ac", "1", "-f", "wav", v_wav],
        check=True
    )

    v = read_wav_mono(v_wav)
    m = read_wav_mono(args.music)
    s = read_wav_mono(args.sfx)

    n = len(v)
    fit = lambda arr: arr[:n] if len(arr) >= n else np.pad(arr, (0, n - len(arr)))
    m = fit(m)
    s = fit(s)

    v_rms = gated_rms(v)
    m_rms = gated_rms(m)
    s_rms = gated_rms(s)
    v_peak = float(np.max(np.abs(v)))

    # 1) Music bed at exactly 50% (-6.0 dB) of voice gated RMS
    m_scaled = m * ((0.50 * v_rms) / max(m_rms, 1e-12))

    # 2) SFX <= 50% of voice gated RMS with peaks capped at 0.70x voice peak
    s_scaled = s * ((0.46 * v_rms) / max(s_rms, 1e-12))
    s_cap = 0.70 * v_peak
    s_pk = float(np.max(np.abs(s_scaled)))
    if s_pk > s_cap:
        s_scaled = s_scaled * (s_cap / s_pk)

    m_db = 20.0 * np.log10(gated_rms(m_scaled) / max(v_rms, 1e-12))
    s_db = 20.0 * np.log10(gated_rms(s_scaled) / max(v_rms, 1e-12))
    s_pk_ratio = float(np.max(np.abs(s_scaled))) / max(v_peak, 1e-12)

    print(f"Voice gated RMS: {20*np.log10(v_rms+1e-12):+.2f} dBFS | peak: {20*np.log10(v_peak+1e-12):+.2f} dBFS")
    print(f"Music vs Voice : {m_db:+.2f} dB (ratio {gated_rms(m_scaled)/v_rms:.3f}, target -6.0 dB / 0.500)")
    print(f"SFX   vs Voice : {s_db:+.2f} dB (ratio {gated_rms(s_scaled)/v_rms:.3f}, max peak {s_pk_ratio:.3f}x voice peak)")

    assert abs(m_db - (-6.0206)) < 0.15, f"Music level off target: {m_db:.2f} dB"
    assert s_db <= -5.9, f"SFX louder than -6 dB: {s_db:.2f} dB"
    assert s_pk_ratio <= 0.701, f"SFX peak > 0.70x voice peak: {s_pk_ratio:.3f}"

    mixed = v + m_scaled + s_scaled
    # Soft safety ceiling only if linear sum exceeds +-1.0
    pk = float(np.max(np.abs(mixed)))
    if pk > 0.99:
        mixed = mixed * (0.99 / pk)
    write_wav_mono(args.out, mixed)
    print(f"Wrote {args.out} ({len(mixed)/SR:.2f}s)")


if __name__ == "__main__":
    main()
