# Figures index

All PNGs were copied from `sources/Research/xgb_results/` and reorganized into the
four subfolders below. Each row maps a file to a 1–2 sentence caption and the
`narrative/paper.md` section it belongs to.

## `detector_response/` — measured Run 8908 detector response (paper §2.2)

| File | Caption | Section |
|---|---|---|
| `pulser_calibration.png` | Pulser calibration line establishing the 0.3333 keV/ADC scale and the 90 ADC = 30 keV anchor (offset 0). | 2.2 |
| `singles_adc_spectrum.png` | Single-trigger ADC (energy) spectrum used to characterize threshold crossings and the noise amplitude spectrum. | 2.2 |
| `beta_endpoint_spectrum.png` | Coincidence electron spectrum with the 782 keV beta endpoint, the absolute-scale cross-check for the calibration. | 2.2 |
| `noise_rms_per_channel.png` | Per-channel baseline noise RMS across all 208 channels. | 2.2 |
| `fake_rate_per_channel.png` | Per-channel fake-trigger rate (per µs) feeding the noise-injection model. | 2.2 |
| `channel_occupancy.png` | Channel occupancy map showing the 183 OK vs 25 dead channels. | 2.2 |

## `training/` — M4 trigger-level classifier (paper §3.1)

| File | Caption | Section |
|---|---|---|
| `noise0p0_confusion_random.png` | 3-class confusion matrix, noise0p0 model, random 80/20 test split. | 3.1 |
| `noise0p0_confusion_jobholdout.png` | 3-class confusion matrix, noise0p0 model, job-holdout evaluation. | 3.1 |
| `noise0p0_feature_importance.png` | Feature importance (gain) for the clean (noise0p0) trigger-level model. | 3.1 |
| `noise1p0_confusion_random.png` | 3-class confusion matrix, noise1p0 model, random 80/20 test split. | 3.1 |
| `noise1p0_confusion_jobholdout.png` | 3-class confusion matrix, noise1p0 model, job-holdout evaluation. | 3.1 |
| `noise1p0_feature_importance.png` | Feature importance (gain) for the noise1p0 trigger-level model. | 3.1 |

## `sim_vs_real/` — M5 domain-gap histograms (paper §3.2)

| File | Caption | Section |
|---|---|---|
| `hist_n_trig.png` | Real vs simulated `n_trig` (triggers per event), coincidence-selected — the count-level gap. | 3.2 |
| `hist_trig_E_tot.png` | Real vs simulated summed trigger energy `trig_E_tot`. | 3.2 |
| `hist_trig_t_span.png` | Real vs simulated trigger time span `trig_t_span` — real spans ~4× longer. | 3.2 |
| `hist_E_LD_max.png` | Real vs simulated max downstream energy `E_LD_max`. | 3.2 |
| `hist_dt_firstUD_firstLD.png` | Real vs simulated cross-detector timing `dt_firstUD_firstLD`. | 3.2 |

## `prototype/` — truth-derived baseline (paper §3.1)

| File | Caption | Section |
|---|---|---|
| `confusion_random.png` | Prototype (truth-derived 16-feature) confusion matrix, random split — the reference the trigger-level models are compared against. | 3.1 |
| `confusion_jobholdout.png` | Prototype confusion matrix, job-holdout evaluation. | 3.1 |
| `feature_importance.png` | Prototype feature importance (gain), including truth-derived hit features (`det_mismatch`, `n_trig`, …). | 3.1 |
