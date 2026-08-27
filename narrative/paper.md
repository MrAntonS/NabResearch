# Trigger-Level, Noise-Injected Sim-to-Real Validation of a 3-Class Backscatter Classifier

**Nab experiment · CLEAN / BS_SAME_DET / BS_CROSS_DET**

## Abstract

We evaluate whether a Monte Carlo simulation of the Nab spectrometer can stand in
for real DAQ output when training a machine-learning classifier for electron
backscatter events. We convert both simulated hits and real DAQ triggers to
a single, unified trigger-record representation and train 22-feature, 3-class XGBoost
classifiers (CLEAN / BS_SAME_DET / BS_CROSS_DET) under two simulation conditions:
no injected noise (×0.0) and nominal measured-rate noise (×1.0). The pipeline is
validated end-to-end — identical schemas, deterministic seeds, reproducible metrics —
and the trigger-level classifier reaches 0.96 accuracy on simulated data with no
injected noise, with recall of 98.6% for CLEAN, 89.5% for cross-detector backscatter,
and 55.0% for same-detector backscatter. However, real data remain structurally
different from simulated trigger records: a two-sample discriminator separates them
with AUC ≈ 0.99 at every evaluated noise scale, and the mean Kolmogorov–Smirnov
distance across features is at best 0.18. The leading discrepancies are in the
emulated detector and readout response, including upstream energy response, timing,
and spatially correlated pixel activity.
This indicates that the current independent Poisson noise and trigger-response model
is not yet faithful to the real DAQ. We close with a ranked set of model-improvement
recommendations.

## 1. Introduction

Nab measures neutron beta decay with a magnetic spectrometer. A decaying neutron
produces an electron and a proton that travel in opposite directions toward two
segmented silicon detectors: the upstream detector (UD, proton side) and the
downstream detector (LD, electron side). The physics goal — the electron–proton
correlation coefficient *a* and related quantities — depends on measuring the
electron energy spectrum precisely.

A persistent nuisance is **electron backscatter**: an electron can strike the
downstream detector, deposit only part of its energy, and bounce back out (or strike
the opposite detector). Backscatter events fall into two classes. *Cross-detector*
backscatter leaves an unmistakable signature: energy deposits in **both** detectors.
*Same-detector* backscatter is the stealthy case — the electron scatters and returns
to the **same** detector, so it looks like a single detector firing, and the partial
energy deposition simply **corrupts the energy spectrum** with a low-energy tail that
is hard to distinguish from a legitimate low-energy electron. Because it does not
announce itself as an obvious two-detector coincidence, same-detector backscatter is
the systematic most likely to bias the spectral shape without being noticed.

A classifier trained on *truth-derived* hit features already separates these classes
well (macro recall 0.90). The open question is whether a classifier built only on the
**trigger records** that the DAQ actually produces — and trained on simulation rather
than real (unlabeled) data — remains useful, and how far the simulation currently is
from matching real data.

## 2. Data & Methods

### 2.1 Real data

Real triggers come from DAQ Run 8908, extracted as-is from the DAQ trigger stream:
**115,782 triggers** organized into **45,695 coincidence events**. Per-event triggers
carry timestamp, pixel, and energy (in ADC), mapped to detector side and pixel
position. Leakage-prone fields (event type, waveform metadata) are held out of the
features.

### 2.2 Detector response

The measured detector response is recorded in the accompanying machine-readable metrics bundle:

- **Energy calibration:** `0.3333 keV/ADC` (anchored at 90 ADC = 30 keV electron
  threshold; offset 0).
- **Channel map:** **183 OK / 25 dead** channels. [FIG: channel_occupancy.png]
- **Record window:** a **fixed 56 µs** DAQ record window.
- Per-channel trigger rates characterize the background used for fake-trigger
  injection. [FIG: fake_rate_per_channel.png]

### 2.3 Trigger emulator and noise scales

Simulated Geant4 hits are converted to the same trigger-record schema as real data.
A dead-channel mask, energy smearing, and per-channel threshold crossings reproduce
physics triggers; a noise model injects per-channel Poisson fake triggers with
amplitudes drawn from the measured noise spectrum. Four noise scales are produced:
**×0.0, ×0.5, ×1.0, and ×2.0** (the measured noise rate multiplied by the scale
factor). The clean setting (×0.0) reproduces the labeler trigger quantities as a
cross-check.

### 2.4 Unified features

One feature function runs on both domains, producing **22 trigger-level features**
(identical contract, zero NaNs):

```
n_trig, n_trig_UD, n_trig_LD, trig_E_tot, trig_E_max, trig_E_mean, trig_t_span,
E_UD, E_LD, frac_E_UD, E_UD_max, E_LD_max, det_first, det_last, det_mismatch,
both_dets, dt_firstUD_firstLD, n_unique_pix, pix_spread_max, pix_spread_rms,
Ew_mean_t, earliest_E
```

### 2.5 Classifier and evaluation

- **Model:** XGBoost, 3-class (CLEAN / BS_SAME_DET / BS_CROSS_DET).
- **Hyperparameters:** 400 trees, max depth 6, learning rate 0.05.
- **Training population:** 51,197 events (CLEAN 44,145 / BS_CROSS_DET 5,009 /
  BS_SAME_DET 2,043).
- **Evaluation protocol:** a random 80/20 split **and** a job-holdout split (10
  training simulation jobs, 2 held-out jobs), so that no training job leaks into
  evaluation.

## 3. Results

### 3.1 Trigger-level retraining

| Model | random acc / macro-rec / AUC | job-holdout acc / macro-rec / AUC | per-class recall (CLEAN / CROSS / SAME) |
|---|---|---|---|
| Prototype (truth-derived, 16 features) | 0.9787 / 0.9001 / 0.9972 | 0.9808 / 0.9013 / — | 0.989 / 1.000 / 0.711 |
| Trigger-level ×0.0 | 0.9593 / 0.8103 / 0.9523 | 0.9637 / 0.8194 / 0.9545 | 0.986 / 0.895 / 0.550 |
| Trigger-level ×1.0 | 0.9491 / 0.7189 / 0.9431 | 0.9496 / 0.7129 / 0.9456 | 0.989 / 0.854 / 0.313 |

[FIG: noise0p0_confusion_random.png] [FIG: noise0p0_feature_importance.png]
[FIG: noise1p0_confusion_jobholdout.png] [FIG: noise1p0_feature_importance.png]
[FIG: confusion_random.png] [FIG: feature_importance.png] (prototype baseline on
simulated data without injected detector noise, for comparison)

Dropping truth-derived hit features costs ~3 points of accuracy and ~8–9 points of
macro-recall, concentrated in **BS_SAME_DET** (0.711 → 0.550 clean, 0.313 with
noise).

**Cross-noise robustness** (same held-out events):

| Train → Test | acc | macro-rec | AUC | SAME recall |
|---|---|---|---|---|
| ×1.0 → ×0.0 | 0.9610 | 0.7880 | 0.9567 | 0.474 |
| ×1.0 → ×0.5 | 0.9537 | 0.7436 | 0.9517 | 0.367 |
| ×1.0 → ×2.0 | 0.9291 | 0.6544 | 0.9125 | 0.181 |
| ×0.0 → ×1.0 | 0.7430 | 0.7114 | 0.8695 | 0.528 |

The model trained with nominal noise retains 96.1% accuracy on data without injected
noise and 95.4% at half the nominal noise rate. In contrast, the model trained without
noise falls to 74.3% accuracy when tested at the nominal noise rate because it often
mistakes additional triggers for backscatter.

### 3.2 Sim-vs-real validation

Among **45,695 real events already recorded by the DAQ as coincidences**, 96.95%
contain extracted triggers on both detector sides. Applying the same `both_dets == 1`
requirement to all emulated simulation events retains **25.4% / 33.1% / 39.5% /
49.9%** for ×0.0 / ×0.5 / ×1.0 / ×2.0. Because the real sample is preselected by
the DAQ coincidence logic, these fractions diagnose a selection and trigger-emulation
mismatch rather than directly measuring simulation efficiency. Even with that
qualification, changing only the rate of independent Poisson triggers does not
produce event distributions remotely close to real data, so the noise and readout
model remains a major area for improvement.

**Distribution matching** (mean KS, coincidence-selected):

| Scale | mean KS | Discriminator AUC (5-fold CV) |
|---|---|---|
| ×0.0 | 0.1972 | 0.9901 |
| **×0.5** | **0.1812** | 0.9918 |
| ×1.0 | 0.2547 | 0.9939 |
| ×2.0 | 0.3560 | 0.9971 |

Best scale by mean-KS is ×0.5 (0.1812). The discriminator AUC is **≈0.99 at
every scale**: real and simulated events are trivially separable from the 22
features. No tested rate closes the gap, and increasing the scale beyond ×0.5
worsens the match, showing that the residual is structural rather than a simple
noise-rate correction.

[FIG: hist_n_trig.png] [FIG: hist_trig_t_span.png] [FIG: hist_trig_E_tot.png]
[FIG: hist_E_LD_max.png] [FIG: hist_dt_firstUD_firstLD.png]

**Top-5 mismatched features at the best scale (KS):** `E_UD` 0.478, `E_UD_max`
0.475, `trig_t_span` 0.404, `dt_firstUD_firstLD` 0.376, `pix_spread_rms` 0.363.

**Discriminator top-10 importances (×0.5, gain):** `trig_t_span` 0.180, `E_UD`
0.124, `E_UD_max` 0.102, `n_trig_UD` 0.098, `det_last` 0.095, `pix_spread_rms`
0.086, `pix_spread_max` 0.067, `dt_firstUD_firstLD` 0.062, `det_mismatch` 0.058,
`n_trig` 0.025. This ordering is evidence for mismatches in timing, upstream
detector response, event ordering and multiplicity, and correlated pixel activity;
gain only ranks what the discriminator uses and does not by itself establish
causation.

**Classifier predictions on real data** (the ×1.0 model applied to all real events): predicted classes
**CLEAN 96.9% / BS_SAME_DET 1.6% / BS_CROSS_DET 1.5%** — a total backscatter fraction
of ~3%, in the expected percent-level range. The real electron-candidate `E_LD_max`
has a plausible median (257 keV) but 3.25% exceed the 782 keV beta endpoint (max
2722 keV, an unphysical pileup/noise tail).

## 4. Discussion

The domain gap is real and not subtle. The two-sample discriminator separating sim
from real at AUC 0.99 means the 22 trigger-level features carry enough information to
tell the domains apart almost perfectly, and — importantly — the discriminator and
the per-feature KS distances agree on *where* the gap lives:

1. **UD (proton-side) energy response** — `E_UD`, `E_UD_max` top both the KS and the
   discriminator rankings, and they are the natural explanation for the
   coincidence-rate gap (sim 25–50% vs real 97%): the simulator does not trigger the
   upstream detector often or energetically enough.
2. **Timing structure** — real `trig_t_span` medians are ~4× longer (43.4 µs vs
   11.2 µs), and `dt_firstUD_firstLD` is a top-5 mismatch.
3. **Spatial spread** — real triggers land on more pixels than the single-channel
   Poisson noise model predicts (`pix_spread_rms`/`pix_spread_max`).

The noise model is directionally right (fixed 56 µs window) but acts only as a rate
knob; the residual mismatch is structural.

**Why BS_SAME_DET recall is low.** Same-detector backscatter is intrinsically hard
at trigger level. It is the rarest class — only **2,043 events** in total, a **0.87%
prevalence** in the full ~235k-event simulated population (≈4% within the 3-class
training set). Worse, its trigger-record signature is weak: because both the primary
deposit and the backscatter return strike the *same* detector, the only
intra-detector structure available is subtle energy/timing detail within one side's
trigger list, while the model's richest separation features (`both_dets`,
`dt_firstUD_firstLD`, `det_mismatch`) are keyed to *cross*-detector coincidences.
Recall falls from 0.711 with truth-derived hit features to 0.31–0.55 at trigger
level.

## 5. Next steps

Ranked recommendations for the next iteration:

1. **UDet energy response** — verify proton energy scale/quenching/thresholds; the
   UD energy features are the top domain discriminators and the coincidence-rate gap
   points at under-modeled UD triggering.
2. **Timing model** — add afterpulsing-like clustering / multi-trigger-per-channel /
   a longer effective record window to close `trig_t_span` and `dt_firstUD_firstLD`.
3. **Spatial spread** — model correlated multi-pixel noise or cross-talk (the
   single-channel Poisson model underestimates `pix_spread_rms`).
4. **Recover BS_SAME_DET recall** — add intra-detector timing/energy features (e.g.,
   a same-detector trigger gap), since only the cross-detector gap
   `dt_firstUD_firstLD` exists today.
5. **Re-sweep noise scales** after (1)–(3) and re-evaluate KS + discriminator AUC.
6. **Calibration review** with the DAQ expert — confirm `offset = 0` and the 90 ADC =
   30 keV anchor; a nonzero pedestal would explain part of the UD energy gap.
