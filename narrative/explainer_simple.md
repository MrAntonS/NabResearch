# The Big Idea, in Plain Words

This is a "just the story" companion to `paper.md`. No jargon, no tables — just what
we did and what it means.

## What we were trying to do

The Nab experiment watches neutrons fall apart. When a neutron decays, it throws out
an electron in one direction and a proton in the other. Two detectors — one "upstream"
(the proton side) and one "downstream" (the electron side) — catch them. By measuring
the electron's energy very precisely, we learn something fundamental about the weak
force.

The catch: sometimes the electron doesn't cooperate. It hits the downstream detector,
**bounces off** ("backscatters"), and either flies over to the *other* detector or
comes right back to the *same* one. When it bounces back to the same detector, the
detector only sees part of the energy — and the event quietly looks like a normal,
lower-energy electron. That quietly **wrecks the energy spectrum**, and it's the
kind of error you don't notice until it's too late. We call this the "stealthy"
systematic.

## What we built

We trained a computer program (a machine-learning classifier) to sort every event into
one of three buckets:

- **CLEAN** — a normal event,
- **BS_SAME_DET** — bounced back to the same detector,
- **BS_CROSS_DET** — bounced across to the other detector.

In an ideal world we'd train it on real data. But real data has no labels — we don't
know, event by event, whether the electron bounced. So we train on **simulation**,
where the simulation *knows* the truth, and then check whether the simulation is
realistic enough to trust.

## How we trained it

1. We took real data from one representative detector run — about **116,000 individual detector
   "trigger" signals** grouped into about **45,700 events** — and measured the
   detectors' quirks: how they turn raw signals into energy, which of the 208 channels
   are dead, and how much electrical noise they see.
2. We wrote a "trigger emulator" that makes the simulation produce data in the **same
   format** as the real detector, then splashed in fake noise at four levels
   (none, light, medium, heavy).
3. From both real and simulated data we computed the **same 22 numbers** per event —
   things like "how many triggers fired", "total energy seen", "how long the event
   lasted". One set of numbers, both worlds.
4. We trained a gradient-boosted decision tree model (XGBoost) on the simulated
   numbers, then tested it two ways: a random train/test split, and a stricter test
   where entire simulated "jobs" were held out so the model couldn't cheat by
   memorizing.

## Why we didn't just use the raw triggers

The raw data are just a fire-hose of individual trigger signals with no obvious
structure. We *boil each event down* to 22 meaningful numbers first. That's not
cutting corners — it's how you make the problem tractable and fair. And crucially,
we deliberately did **not** use any "cheat" fields the real detector wouldn't provide
(such as the simulation's internal truth about where the electron went). If we used
those, the model would look brilliant in the lab and fail in the real world.

## What we found

**The good news:** the pipeline works end-to-end. The model sorts clean vs.
bounced-back events correctly about **96%** of the time on clean simulation, and when
we run it on *real* data it predicts only about **3%** of events are backscatter —
right in the expected range, and a reassuring sanity check that the physics isn't
wildly off.

**The bad news:** the simulation doesn't match reality well enough yet. We built a
separate "detective" model whose only job is to guess whether an event came from the
simulation or from real data, and it's right **~99%** of the time. The simulation
gets three things wrong, in order:

1. **The upstream detector's energy** is too weak in simulation (it fires too rarely
   and too softly).
2. **The timing** is too short — real events drag on about **4× longer**.
3. **The spatial spread** is too narrow — real signals light up more pixels.

And the "bounced back to the *same* detector" class is the hardest of all: it's rare
(only about **2,000 events**, under 1% of everything the simulation makes), and its
fingerprint in the trigger data is faint, so the model only catches it about a third
of the time.

## The takeaway

We have a working, honest pipeline and a clear to-do list. The simulation is a good
start but not yet a trustworthy stand-in for real data. Fix the upstream energy,
stretch out the timing, and spread out the pixels — then the detective should start
guessing wrong.
