"""Synthesized music bed + SFX stems (music.wav, sfx.wav) for The Boy Who Built Niagara's First Bridge."""
import shutil
import subprocess
import wave
import numpy as np

SR = 48000
DUR = 76.75
N = int(round(DUR * SR))
rng = np.random.default_rng(1848)


def get_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / r)


def lp_fast(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x)).astype(np.float32)


def hp_fast(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 - 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x)).astype(np.float32)


def place(buf, sig, t0, gain=1.0):
    i = int(t0 * SR)
    j = min(N, i + len(sig))
    if i < N and j > i:
        buf[i:j] += sig[: j - i] * gain


midi = lambda m: 440 * 2 ** ((m - 69) / 12)


def pluck(f, dur=0.35, bright=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum((bright ** k) * np.sin(2 * np.pi * f * (k + 1) * t) / (k + 1) for k in range(6))
    return (s * env(n, 0.003, dur * 0.35)).astype(np.float32)


def brass(fs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in fs:
        ph = 2 * np.pi * f * t + 0.003 * np.sin(2 * np.pi * 5 * t)
        s += sum(np.sin((k + 1) * ph) / (k + 1) ** 1.3 for k in range(8))
    a = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15).clip(0)
    return lp_fast((s * a).astype(np.float32), 1800) / len(fs)


def drum(kind):
    if kind == "kick":
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        f = 50 + 90 * np.exp(-t * 30)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)).astype(np.float32)
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    s = rng.standard_normal(n) * np.exp(-t * 28) * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 20) * 0.5
    return hp_fast(s.astype(np.float32), 300)


# ---------------- music stem ----------------
music = np.zeros(N, np.float32)
BPM = 108
beat = 60 / BPM
prog_bright = [(60, [60, 64, 67]), (57, [57, 60, 64]), (53, [53, 57, 60]), (55, [55, 59, 62])]  # C Am F G
prog_night = [(57, [57, 60, 64]), (53, [53, 57, 60]), (50, [50, 53, 57]), (52, [52, 56, 59])]   # Am F Dm E

MUSIC_END = 74.15  # stops at f2225 ("all started by a five-dollar kite")
bar = 0
tt = 0.0
while tt < MUSIC_END:
    is_night = 43.4 <= tt < 59.8
    prog = prog_night if is_night else prog_bright
    root, ch = prog[bar % 4]
    place(music, brass([midi(m) for m in ch], beat * 4 * 0.98), tt, 0.08 if is_night else 0.10)
    for b in range(4):
        tb = tt + b * beat
        if tb >= MUSIC_END:
            break
        if not is_night or b % 2 == 0:
            place(music, drum("kick" if b % 2 == 0 else "snare"), tb, 0.52 if b % 2 == 0 else 0.30)
        place(music, pluck(midi(root - 12), 0.38, 0.42), tb, 0.34)
        place(music, pluck(midi(ch[(b + bar) % 3] + 12), 0.22, 0.55), tb + beat / 2, 0.13)
    if bar % 2 == 1 and not is_night:
        for k, m in enumerate([ch[0] + 12, ch[1] + 12, ch[2] + 12]):
            place(music, brass([midi(m)], beat * 0.44), tt + 2 * beat + k * beat * 0.5, 0.065)
    bar += 1
    tt += beat * 4

# Crisp stop at MUSIC_END + warm drone to end
i0 = int((MUSIC_END - 0.08) * SR)
music[i0:] *= np.linspace(1, 0, N - i0) ** 8
dn = int((DUR - MUSIC_END) * SR)
td = np.arange(dn) / SR
drone = (np.sin(2 * np.pi * 65.4 * td) + 0.5 * np.sin(2 * np.pi * 98.0 * td) + 0.3 * np.sin(2 * np.pi * 130.8 * td)) * np.minimum(1, td / 0.8)
drone = lp_fast(drone.astype(np.float32), 650)
place(music, drone, MUSIC_END, 0.08)

# ---------------- sfx stem ----------------
sfx = np.zeros(N, np.float32)
noise = lambda d: rng.standard_normal(int(d * SR)).astype(np.float32)


def thunk(f0=90, d=0.3):
    n = int(d * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f0 * t * (1 + 0.6 * np.exp(-t * 40))) * np.exp(-t * 14) + lp_fast(noise(d), 1200) * np.exp(-t * 30) * 0.5).astype(np.float32)


def rumble(d):
    n = int(d * SR)
    t = np.arange(n) / SR
    return (lp_fast(noise(d), 160) * 2.5 * np.minimum(1, t / 0.15) * np.exp(-t / (d * 0.45))).astype(np.float32)


def crash(d=1.2):
    n = int(d * SR)
    t = np.arange(n) / SR
    s = np.zeros(n, np.float32)
    for _ in range(12):
        tk = rng.uniform(0, d * 0.55)
        i = int(tk * SR)
        g = thunk(rng.uniform(60, 160), 0.35) * rng.uniform(0.3, 0.8)
        s[i:i + len(g)] += g[: n - i]
    s += lp_fast(noise(d), 2400) * np.exp(-t * 3) * 0.25
    return s


def cuckoo():
    out = []
    for f, d in [(740, 0.16), (587, 0.24)]:
        n = int(d * SR)
        t = np.arange(n) / SR
        out.append(np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.01) * np.exp(-t * 6))
        out.append(np.zeros(int(0.06 * SR)))
    return np.concatenate(out).astype(np.float32)


def scrape(d=0.8):
    n = int(d * SR)
    t = np.arange(n) / SR
    s = noise(d) * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * t)) * np.sin(np.pi * t / d)
    s = hp_fast(lp_fast(s, 5000), 1500)
    ring = np.sin(2 * np.pi * 1870 * t) * np.exp(-t * 3) * 0.2
    return (s * 0.6 + ring).astype(np.float32)


def ting():
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    return (sum(np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, k in [(2093, 4), (3136, 6), (4186, 8)]) * 0.3).astype(np.float32)


def sting():
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    low = np.sin(2 * np.pi * 49 * t) * np.exp(-t * 1.6) * 1.1
    hit = lp_fast(noise(1.8), 900) * np.exp(-t * 6) * 0.7
    stab = brass([midi(48), midi(52), midi(55)], 1.2)
    s = low + hit
    s[: len(stab)] += stab * 1.9 * np.exp(-np.arange(len(stab)) / SR * 2.2)
    return s.astype(np.float32)


def creak(d=0.6, f0=140):
    n = int(d * SR)
    t = np.arange(n) / SR
    rate = f0 * (1 + 0.35 * np.sin(2 * np.pi * 1.3 * t / d))
    ph = np.cumsum(rate) / SR
    pulses = (np.mod(ph, 1) < 0.08).astype(np.float32)
    s = lp_fast(pulses * (0.6 + 0.4 * rng.random(n).astype(np.float32)), 2200) * np.sin(np.pi * t / d)
    return hp_fast(s, 200) * 2.2


def snap():
    d = 0.45
    n = int(d * SR)
    t = np.arange(n) / SR
    return (hp_fast(noise(d), 800) * np.exp(-t * 18) * 1.3 + np.pad(thunk(120, 0.35), (0, n - int(0.35 * SR))) * 0.55).astype(np.float32)


def splash(d=1.0):
    n = int(d * SR)
    t = np.arange(n) / SR
    return (lp_fast(noise(d), 4000) * (np.exp(-t * 4) * np.minimum(1, t / 0.01)) + lp_fast(noise(d), 400) * np.exp(-t * 7) * 1.4).astype(np.float32)


def whoosh(d=0.5):
    n = int(d * SR)
    t = np.arange(n) / SR
    return (lp_fast(noise(d), 1500) * np.sin(np.pi * t / d) ** 2 * 0.6).astype(np.float32)


def leaves(d):
    n = int(d * SR)
    t = np.arange(n) / SR
    return (hp_fast(lp_fast(noise(d), 6000), 2500) * (0.3 + 0.3 * np.sin(2 * np.pi * 0.7 * t) ** 2) * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.4)).astype(np.float32)


def water(d):
    n = int(d * SR)
    t = np.arange(n) / SR
    return (lp_fast(noise(d), 900) * 0.45 + hp_fast(lp_fast(noise(d), 3000), 1200) * 0.14 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.4 * t))).astype(np.float32)


F = lambda f: f / 30

# Event-locked SFX cues across all 12 shots
place(sfx, whoosh(0.65), F(18), 0.55)            # hook camera pull-back
place(sfx, leaves(1.4), F(185), 0.35)             # blueprint scroll
place(sfx, water(8.0), F(260), 0.32)              # boiling rapids ambience
place(sfx, thunk(85, 0.35), F(502), 0.9)          # Ellet foot stamp
place(sfx, water(2.5), F(583), 0.45)              # rapids in Shot 4
place(sfx, snap(), F(610), 0.85)                  # boat shatters
place(sfx, splash(1.1), F(614), 0.85)             # rapids splash
place(sfx, thunk(72, 0.45), F(685), 0.95)         # cannon fire
place(sfx, crash(1.0), F(686), 0.70)              # cannon boom echo
place(sfx, snap(), F(725), 0.95)                  # cannon rope snaps mid-air
place(sfx, whoosh(0.45), F(805), 0.40)            # eagle flap 1
place(sfx, cuckoo(), F(845), 0.45)                # rival engineers cuckoo swirl
place(sfx, whoosh(0.45), F(885), 0.40)            # eagle flap 2
place(sfx, ting(), F(995), 0.60)                  # five-dollar prize reveal
place(sfx, whoosh(0.45), F(1131), 0.55)           # Canadian rim flash
place(sfx, leaves(4.5), F(1145), 0.38)            # windy Canadian cliff
place(sfx, scrape(0.9), F(1430), 0.55)            # kite line scrapes ice
place(sfx, snap(), F(1496), 0.95)                 # line snaps in two on river ice
place(sfx, ting(), F(1690), 0.55)                 # "You see," mechanism reveal
place(sfx, whoosh(0.45), F(1796), 0.55)           # sunrise flash back to shore
place(sfx, creak(0.65, 130), F(1920), 0.80)       # workers tying strong cord
place(sfx, creak(0.75, 110), F(2002), 0.85)       # capstan hauling thick rope
place(sfx, scrape(0.85), F(2068), 0.65)           # iron cable pulling across
place(sfx, rumble(1.6), F(2068), 0.65)            # heavy iron cable tension
place(sfx, creak(0.6, 150), F(2145), 0.55)        # carriage rolling over deck
place(sfx, sting(), MUSIC_END, 0.85)              # final sting at twist
place(sfx, ting(), F(2285), 0.55)                 # final $5 + kite glint


def save_wav(path, arr):
    peak = float(np.max(np.abs(arr)))
    if peak > 0.95:
        arr = arr * (0.95 / peak)
    pcm = (np.clip(arr, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


save_wav("music.wav", music)
save_wav("sfx.wav", sfx)
print(f"wrote music.wav and sfx.wav ({N/SR:.2f}s @ {SR}Hz)")
