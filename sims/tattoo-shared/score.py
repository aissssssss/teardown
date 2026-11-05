"""Score for the CM-8 coil tattoo machine film: a quiet bed (Em9 colours, 92 bpm) under the machine itself. Every
contact snap is placed by integrating the machine's own cycles per film second from the timeline, so the real-speed
buzz at the open and the close and the single slow-motion ticks in between are the same sound at different rates.
In the skin, each needle strike adds a soft wet tap. A down-sweep as time slows, an up-sweep as it speeds back up, a
quiet click on every button the operator presses.

    python run_sfx.py sims/tattoo-shared/score.py

Times from tattoo-film/timeline.json, which tattoo-film/make-timeline.mjs writes from timing.js and the physics.
"""

import math
import os
import random

from sfx.score_kit import airy, bed, chords, hz, thud
from sfx.synth import SR, bandnoise, click

TIMELINE = "../tattoo-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "tattoo-score.wav")
TARGET_LUFS = -14.0
SEED = 23

CHORDS = chords("Em9:E2 B2 D3 F#3 G3/E1", "Cmaj7:C3 E3 G3 B3/C1", "Am9:A2 C3 E3 G3 B3/A0", "Bsus4:B2 E3 F#3 A3/B0")
MOTIF = [(0.5, hz("B4")), (1.5, hz("D5")), (2.5, hz("F#5"))]

_rng = random.Random(SEED)
_grit = bandnoise(int(0.03 * SR), lambda k: 3400, q=0.7)


def snap(volt, slow):
    """One make-and-break: the silver contact's tick, the armature's knock on the stop, a breath of coil hum."""
    n = int((0.06 if slow else 0.022) * SR)
    out = [0.0] * n
    lvl = 0.75 + 0.1 * (volt - 7.5)
    body = 150 + 10 * (volt - 7.5)
    for k in range(n):
        t = k / SR
        s = _grit[k % len(_grit)] * math.exp(-t / 0.0016) * 1.6
        s += math.sin(2 * math.pi * body * t) * math.exp(-t / (0.012 if slow else 0.004)) * 0.9
        s += math.sin(2 * math.pi * 2 * body * t + 0.4) * math.exp(-t / 0.003) * 0.35
        out[k] = s * lvl
    return out


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 92, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.6, keys_lp=3200)
    mix.put_stereo(0, left, right, 0.1)
    mix.put(0, low, 0.09)
    # the machine: walk its phase through the film, one snap per cycle
    step = tl["cpsStep"]
    cps = tl["cps"]
    volts = tl["volts"]
    phase = 0.0
    sounds = {}
    for j in range(len(cps) - 1):
        t0 = j * step
        c = cps[j]
        sub = max(1, int(c * step * 4) + 1)
        for s in range(sub):
            phase += c * step / sub
            if phase >= 1.0:
                phase -= 1.0
                t = t0 + (s + 1) * step / sub
                v = volts[min(len(volts) - 1, int(t / tl["voltStep"]))]
                slow = c < 7
                key = (round(v, 1), slow)
                if key not in sounds:
                    sounds[key] = snap(v, slow)
                # a buzz is many snaps: keep each one small so the sum sits where one slow tick does
                g = 0.2 if slow else 0.2 / (1 + 0.035 * c)
                mix.put(t, sounds[key], g, pan=_rng.uniform(-0.08, 0.08))
    # the needle in the skin: a soft wet tap on each slow strike
    for t, sk, v in tl["strikes"]:
        if sk > 0.5:
            mix.put(t, thud(95 + 8 * (v - 7.5), 0.03, 0.12), 0.14)
            mix.put(t, click(900, 0.02), 0.03)
    # time slowing, time speeding up
    for t, r in tl["rateChanges"]:
        if r < 0.5:
            mix.put(t, airy(1.4, 2400, 300, 0.7), 0.05)
        else:
            mix.put(t - 0.2, airy(1.4, 300, 2600, 0.7), 0.05)
    for t in tl["clicks"]:
        mix.put(t, click(2600, 0.025), 0.045)
