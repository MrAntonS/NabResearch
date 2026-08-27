# Interactive paper: trigger-level sim-to-real

Self-contained **interactive article** for the Nab trigger-level, noise-injected
sim-to-real experiment. Every number here traces back
to `sources/Research/REPORT_trigger_level_sim_to_real.md` (the source of truth) and
the machine-readable artifacts under `sources/Research/xgb_results/`.

## Folder map

| Path | Contents |
|---|---|
| `index.html` | The finished editorial paper: full narrative, static research figures, linked noise-scale controls, 10 interactive distributions, phase-space scatter, and discriminator importance. |
| `paper.css` / `paper.js` | Paper/ink visual system and dependency-free data/chart wiring (Vega-Lite is loaded from CDN). |
| `narrative/` | The written article. `paper.md` is the paper-style text; `explainer_simple.md` is a plain-language companion for a general audience. |
| `figures/` | All source PNGs, reorganized into `detector_response/`, `training/`, `sim_vs_real/`, `prototype/`. `figures/README.md` indexes every file with a caption + section. |
| `data/metrics/` | The raw machine-readable results: M4 `metrics.json` (both noise scales), M5 JSONs (`coincidence`, `discriminator`, `discriminator_importance`, `physics_sanity`), KS/Wasserstein CSVs, the prototype `summary.txt`, and `detector_response_run8908.json`. |
| `data/key_numbers.json` | One consolidated JSON of every headline number (transcribed programmatically from the metrics files, not by hand). |
| `data/distributions/` | Per-feature histogram JSONs (`{feature, bins, series:{real, sim_noise…}, coincidence_selected}`) for 10 interactive features, common bin edges, coincidence-selected on both domains. |
| `data/samples/` | Small CSV samples for scatter plots: 2,000 real events and 2,000 noise1p0 simulated events. |
| `demo/index.html` | Minimal dependency-free Vega-Lite starter (CDN only) that renders overlaid real-vs-sim histograms and a headline-number table. |

## View the paper

The page fetches local JSON and CSV, so serve this directory over HTTP:

```bash
cd interactive_paper
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`. The root page is the finished paper;
`demo/index.html` remains as the original minimal plotting starter.

## Interactive architecture

- The sticky noise-scale control updates all 10 coincidence-selected histograms,
  their feature-level KS values, and the global mean-KS/AUC readout.
- `data/distributions/*.json` supplies common bin edges and normalized real/sim
  series; `data/samples/*.csv` supplies the event-level phase-space view.
- `data/key_numbers.json` remains the source for headline and validation metrics.

## Where the data came from (regeneration pointers)

Cluster-side analysis scripts (in `~/Research/` on PACE Phoenix, via
`source ~/Research/activate_ml.sh`) produced the underlying artifacts:

| Cluster script | Produces | Pulled locally as |
|---|---|---|
| `real_extract.py` (M1) | `labels/real_triggers_run8908.parquet`, `real_features_run8908.parquet` | `labels/real_features_run8908.parquet` |
| `measure_response.py` (M2) | `labels/detector_response_run8908.json` + plots | `data/metrics/detector_response_run8908.json`, `figures/detector_response/` |
| `trigger_emu.py` (M3) | `labels/sim_triggers_noise*.parquet` | (large; not copied — histograms/samples computed on cluster) |
| `features_triggers.py` (M4) | `labels/sim_features_noise{0p0,0p5,1p0,2p0}.parquet` | (large; not copied) |
| `train_trigger_level.py` (M4) | `xgb_results/trigger_level/{noise0p0,noise1p0}/` | `data/metrics/noise*_metrics.json`, `figures/training/` |
| `sim_vs_real.py` (M5) | `xgb_results/sim_vs_real/` | `data/metrics/{coincidence,discriminator,discriminator_importance,physics_sanity}.json`, KS CSVs, `figures/sim_vs_real/` |
| `prototype_classifier.py` | `xgb_results/prototype_3class/` | `data/metrics/prototype_summary.txt`, `figures/prototype/` |

### Packaging scripts used for THIS folder

Because the sim feature parquets (~235k × 26 each) live only on the cluster, the sim
side of `data/distributions/` and `data/samples/` was computed on the cluster and
pulled back as small outputs:

- `probe_sim.py` (cluster) — reported coincidence-selected min/max/quantiles for the
  10 features (`sim_quantiles.json`), used to pick common bin edges.
- `build_local.py` (local) — computed bin edges from real-data quantiles, real-side
  histogram counts, `sample_real.csv`, and `key_numbers.json`.
- `cluster_hist.py` (cluster) — with `edges.json`, computed sim-side histogram counts
  (`sim_counts.json`) and `sample_sim_noise1p0.csv`.
- `merge_dists.py` (local) — merged real + sim counts into the final
  `data/distributions/<feature>.json` files, asserting each series sums to its
  selected-event count.

These scripts were run in `%TEMP%\opencode` and are not part of the shipped folder;
the cluster is only needed to regenerate the sim-side histograms/samples. Everything
else can be rebuilt locally from the copied `data/metrics/` files and the local real
parquet.

## Key facts at a glance

- Extraction: **115,782 triggers / 45,695 coincidence events** (Run 8908).
- Detector: **0.3333 keV/ADC**, **183 OK / 25 dead** channels, **56 µs** record window.
- Trigger-level model (noise0p0): random acc **0.9593**, macro-recall **0.8103**.
- Sim-vs-real discriminator AUC **≈0.99** at every noise scale; best mean-KS
  **0.1812** (noise0p5).
- Real predicted classes: **96.9% CLEAN / 1.6% BS_SAME_DET / 1.5% BS_CROSS_DET**.
