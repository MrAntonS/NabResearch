(() => {
  "use strict";

  const PAPER = "#f6f3ec";
  const INK = "#17150f";
  const MUTED = "#7d7667";
  const RULE = "#ddd6c6";
  const ACCENT = "#c04a2f";
  const SANS = "Helvetica Neue, Segoe UI, Arial, sans-serif";
  const MONO = "SFMono-Regular, Consolas, Liberation Mono, monospace";

  const FEATURES = [
    "n_trig",
    "n_trig_UD",
    "n_trig_LD",
    "trig_E_tot",
    "E_UD",
    "E_UD_max",
    "E_LD_max",
    "trig_t_span",
    "dt_firstUD_firstLD",
    "pix_spread_rms"
  ];

  const SCALE_LABELS = {
    noise0p0: "×0.0",
    noise0p5: "×0.5",
    noise1p0: "×1.0",
    noise2p0: "×2.0"
  };

  const AXIS_LABELS = {
    n_trig: "trigger count",
    n_trig_UD: "UD trigger count",
    n_trig_LD: "LD trigger count",
    trig_E_tot: "total trigger energy (keV)",
    E_UD: "upstream energy (keV)",
    E_UD_max: "maximum upstream energy (keV)",
    E_LD_max: "maximum downstream energy (keV)",
    trig_t_span: "trigger time span (µs)",
    dt_firstUD_firstLD: "first UD − first LD (µs)",
    pix_spread_rms: "pixel spread RMS (mm)"
  };

  const state = {
    activeScale: "noise0p5",
    numbers: null,
    distributions: {},
    ks: {},
    samples: [],
    rendering: false,
    pendingScale: null
  };

  async function loadText(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error("HTTP " + response.status + " loading " + path);
    return response.text();
  }

  async function loadJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error("HTTP " + response.status + " loading " + path);
    return response.json();
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];
    const headers = lines.shift().split(",").map((value, index) => value || (index === 0 ? "feature" : "column_" + index));
    return lines.filter(Boolean).map((line) => {
      const values = line.split(",");
      const row = {};
      headers.forEach((header, index) => { row[header] = values[index] == null ? "" : values[index]; });
      return row;
    });
  }

  function toNumericRows(rows, domain) {
    return rows.map((row) => {
      const numeric = { domain: domain };
      Object.keys(row).forEach((key) => {
        const value = Number(row[key]);
        numeric[key] = Number.isFinite(value) ? value : row[key];
      });
      return numeric;
    });
  }

  function displayValue(feature, value) {
    if ((feature === "trig_t_span" || feature === "dt_firstUD_firstLD") && Number.isFinite(value)) return value / 1000;
    return value;
  }

  function baseConfig() {
    return {
      background: null,
      font: SANS,
      view: { stroke: null },
      axis: {
        domain: false,
        ticks: false,
        gridColor: RULE,
        gridOpacity: 0.85,
        labelColor: MUTED,
        labelFont: SANS,
        labelFontSize: 10,
        labelPadding: 7,
        titleColor: INK,
        titleFont: SANS,
        titleFontSize: 11,
        titleFontWeight: 500,
        titlePadding: 12
      },
      legend: {
        labelColor: MUTED,
        labelFont: SANS,
        labelFontSize: 10,
        orient: "top",
        direction: "horizontal",
        symbolStrokeWidth: 3,
        title: null
      }
    };
  }

  function cdfRows(doc, scale) {
    const rows = [];
    const pairs = [
      { key: "real", label: "Real", total: doc.n_events.real },
      { key: "sim_" + scale, label: "Simulation " + SCALE_LABELS[scale], total: doc.n_events[scale] }
    ];

    pairs.forEach((pair) => {
      const counts = doc.series[pair.key];
      let cumulative = 0;
      rows.push({
        value: displayValue(doc.feature, Number(doc.bins[0])),
        share: 0,
        raw_count: 0,
        domain: pair.label
      });
      counts.forEach((count, index) => {
        cumulative += count;
        rows.push({
          value: displayValue(doc.feature, Number(doc.bins[index + 1])),
          share: cumulative / pair.total,
          raw_count: cumulative,
          domain: pair.label
        });
      });
    });
    return rows;
  }

  function cdfSpec(doc, scale) {
    const simLabel = "Simulation " + SCALE_LABELS[scale];
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: "container",
      height: 175,
      data: { values: cdfRows(doc, scale) },
      encoding: {
        x: {
          field: "value",
          type: "quantitative",
          title: AXIS_LABELS[doc.feature] || (doc.feature + " (" + doc.units + ")"),
          axis: { format: "~g", tickCount: 6 }
        },
        y: {
          field: "share",
          type: "quantitative",
          title: "cumulative fraction of events",
          axis: { format: ".0%", tickCount: 4 },
          scale: { domain: [0, 1] }
        },
        color: {
          field: "domain",
          type: "nominal",
          scale: { domain: ["Real", simLabel], range: [INK, ACCENT] },
          legend: { title: null }
        },
        tooltip: [
          { field: "domain", type: "nominal", title: "domain" },
          { field: "value", type: "quantitative", title: "bin edge", format: ".4~g" },
          { field: "share", type: "quantitative", title: "cumulative event share", format: ".2%" },
          { field: "raw_count", type: "quantitative", title: "cumulative count", format: ",d" }
        ]
      },
      layer: [
        { mark: { type: "line", interpolate: "step-after", strokeWidth: 2, clip: true } }
      ],
      config: baseConfig()
    };
  }

  function ksValue(feature, scale) {
    const row = state.ks[feature];
    if (!row) return NaN;
    return Number(row[scale + "_ks"]);
  }

  function updateKSBage(feature, scale) {
    const badge = document.getElementById("ks-" + feature);
    if (!badge) return;
    const value = ksValue(feature, scale);
    badge.textContent = Number.isFinite(value) ? "KS " + value.toFixed(3) : "KS —";
    badge.classList.toggle("high", Number.isFinite(value) && value >= 0.3);
  }

  async function renderCDFs(scale) {
    if (typeof window.vegaEmbed !== "function") {
      FEATURES.forEach((feature) => {
        const target = document.getElementById("chart-" + feature);
        if (target) target.innerHTML = "<p class='chart-error'>Interactive chart library did not load. Check your network connection and refresh.</p>";
      });
      return;
    }

    await Promise.all(FEATURES.map(async (feature) => {
      updateKSBage(feature, scale);
      const target = document.getElementById("chart-" + feature);
      const doc = state.distributions[feature];
      if (!target || !doc) return;
      try {
        await window.vegaEmbed(target, cdfSpec(doc, scale), {
          actions: false,
          renderer: "svg",
          tooltip: { theme: "light" }
        });
      } catch (error) {
        target.innerHTML = "<p class='chart-error'>Could not render this distribution: " + escapeHTML(error.message) + "</p>";
      }
    }));
  }

  async function drainCDFQueue() {
    if (state.rendering) return;
    state.rendering = true;
    while (state.pendingScale) {
      const scale = state.pendingScale;
      state.pendingScale = null;
      await renderCDFs(scale);
    }
    state.rendering = false;
  }

  function scheduleCDFs(scale) {
    state.pendingScale = scale;
    drainCDFQueue();
  }

  function updateReadout() {
    if (!state.numbers) return;
    const scale = state.activeScale;
    const ks = Number(state.numbers.m5.mean_ks[scale]);
    const auc = Number(state.numbers.m5.discriminator_auc[scale]);
    const readout = document.getElementById("live-readout");
    const stamp = document.getElementById("scale-stamp");
    if (readout) readout.textContent = "mean KS " + ks.toFixed(4) + " · AUC " + auc.toFixed(4);
    if (stamp) stamp.textContent = "selected · noise " + SCALE_LABELS[scale];
  }

  function renderRateBars() {
    if (!state.numbers) return;
    const fractions = state.numbers.m5.coincidence_fractions;
    const rows = [
      { key: "real", label: "Real", value: Number(fractions.real), real: true },
      { key: "noise0p0", label: "Sim ×0.0", value: Number(fractions.noise0p0) },
      { key: "noise0p5", label: "Sim ×0.5", value: Number(fractions.noise0p5) },
      { key: "noise1p0", label: "Sim ×1.0", value: Number(fractions.noise1p0) },
      { key: "noise2p0", label: "Sim ×2.0", value: Number(fractions.noise2p0) }
    ];
    const container = document.getElementById("rate-bars");
    if (!container) return;
    container.innerHTML = rows.map((row) => {
      const classes = ["rate-row"];
      if (row.real) classes.push("real");
      if (row.key === state.activeScale) classes.push("selected");
      return "<div class='" + classes.join(" ") + "'>" +
        "<span class='rate-label'>" + row.label + "</span>" +
        "<span class='rate-track'><span class='rate-fill' style='width:" + (row.value * 100).toFixed(3) + "%'></span></span>" +
        "<span class='rate-value'>" + (row.value * 100).toFixed(1) + "%</span>" +
        "</div>";
    }).join("");
  }

  function setScale(scale) {
    if (!SCALE_LABELS[scale]) return;
    state.activeScale = scale;
    document.querySelectorAll("[data-scale]").forEach((button) => {
      const selected = button.getAttribute("data-scale") === scale;
      button.classList.toggle("on", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    updateReadout();
    renderRateBars();
    scheduleCDFs(scale);
  }

  function scatterRows(xFeature, yFeature) {
    return state.samples.map((row) => ({
      x: displayValue(xFeature, Number(row[xFeature])),
      y: displayValue(yFeature, Number(row[yFeature])),
      domain: row.domain,
      event_id: row.event_id
    })).filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));
  }

  function scatterSpec(xFeature, yFeature) {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: "container",
      height: 305,
      data: { values: scatterRows(xFeature, yFeature) },
      mark: { type: "circle", filled: true, size: 20, opacity: 0.27, clip: true },
      encoding: {
        x: { field: "x", type: "quantitative", title: AXIS_LABELS[xFeature] || xFeature, axis: { tickCount: 7, format: "~g" } },
        y: { field: "y", type: "quantitative", title: AXIS_LABELS[yFeature] || yFeature, axis: { tickCount: 6, format: "~g" } },
        color: {
          field: "domain",
          type: "nominal",
          scale: { domain: ["Real", "Simulation ×1.0"], range: [INK, ACCENT] }
        },
        tooltip: [
          { field: "domain", type: "nominal", title: "domain" },
          { field: "x", type: "quantitative", title: xFeature, format: ".4~g" },
          { field: "y", type: "quantitative", title: yFeature, format: ".4~g" },
          { field: "event_id", type: "quantitative", title: "event", format: "d" }
        ]
      },
      config: baseConfig()
    };
  }

  async function renderScatter() {
    const target = document.getElementById("scatter-chart");
    const xSelect = document.getElementById("scatter-x");
    const ySelect = document.getElementById("scatter-y");
    if (!target || !xSelect || !ySelect || !state.samples.length) return;
    if (typeof window.vegaEmbed !== "function") {
      target.innerHTML = "<p class='chart-error'>Interactive chart library did not load.</p>";
      return;
    }
    try {
      await window.vegaEmbed(target, scatterSpec(xSelect.value, ySelect.value), {
        actions: false,
        renderer: "canvas",
        tooltip: { theme: "light" }
      });
    } catch (error) {
      target.innerHTML = "<p class='chart-error'>Could not render event sample: " + escapeHTML(error.message) + "</p>";
    }
  }

  function importanceSpec() {
    const values = Object.entries(state.numbers.m5.discriminator_top10_importance_gain).map(([feature, gain]) => ({ feature: feature, gain: Number(gain) }));
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: "container",
      height: 310,
      data: { values: values },
      encoding: {
        y: { field: "feature", type: "nominal", sort: "-x", title: null, axis: { labelColor: INK, labelFont: MONO, labelLimit: 185 } },
        x: { field: "gain", type: "quantitative", title: "share of discriminator gain", axis: { format: ".0%", tickCount: 5 } }
      },
      layer: [
        { mark: { type: "bar", color: ACCENT, height: { band: 0.58 } } },
        { mark: { type: "text", align: "left", baseline: "middle", dx: 5, color: INK, font: MONO, fontSize: 10 }, encoding: { text: { field: "gain", type: "quantitative", format: ".3f" } } }
      ],
      config: baseConfig()
    };
  }

  async function renderImportance() {
    const target = document.getElementById("importance-chart");
    if (!target || !state.numbers) return;
    if (typeof window.vegaEmbed !== "function") {
      target.innerHTML = "<p class='chart-error'>Interactive chart library did not load.</p>";
      return;
    }
    try {
      await window.vegaEmbed(target, importanceSpec(), { actions: false, renderer: "svg", tooltip: { theme: "light" } });
    } catch (error) {
      target.innerHTML = "<p class='chart-error'>Could not render importance chart: " + escapeHTML(error.message) + "</p>";
    }
  }

  function escapeHTML(value) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(value).replace(/[&<>"']/g, (character) => entities[character]);
  }

  function setupControls() {
    document.querySelectorAll("[data-scale]").forEach((button) => {
      button.addEventListener("click", () => setScale(button.getAttribute("data-scale")));
    });
    const xSelect = document.getElementById("scatter-x");
    const ySelect = document.getElementById("scatter-y");
    if (xSelect) xSelect.addEventListener("change", renderScatter);
    if (ySelect) ySelect.addEventListener("change", renderScatter);
  }

  function setupReadingProgress() {
    const bar = document.getElementById("reading-progress");
    if (!bar) return;
    let scheduled = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.width = (progress * 100).toFixed(2) + "%";
      scheduled = false;
    };
    window.addEventListener("scroll", () => {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function setupReveals() {
    const elements = Array.from(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => element.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    elements.forEach((element) => observer.observe(element));
  }

  async function loadCoreData() {
    const distributionPromises = FEATURES.map((feature) => loadJSON("data/distributions/" + feature + ".json"));
    const all = await Promise.all([
      loadJSON("data/key_numbers.json"),
      loadText("data/metrics/ks_wass_coincidence.csv"),
      ...distributionPromises
    ]);
    state.numbers = all[0];
    parseCSV(all[1]).forEach((row) => { state.ks[row.feature] = row; });
    FEATURES.forEach((feature, index) => { state.distributions[feature] = all[index + 2]; });
  }

  async function loadSamples() {
    const files = await Promise.all([
      loadText("data/samples/sample_real.csv"),
      loadText("data/samples/sample_sim_noise1p0.csv")
    ]);
    state.samples = toNumericRows(parseCSV(files[0]), "Real")
      .concat(toNumericRows(parseCSV(files[1]), "Simulation ×1.0"));
  }

  function showCoreError(error) {
    FEATURES.forEach((feature) => {
      const target = document.getElementById("chart-" + feature);
      if (target) target.innerHTML = "<p class='chart-error'>Data could not be loaded: " + escapeHTML(error.message) + ". Serve this folder over HTTP and refresh.</p>";
    });
    const readout = document.getElementById("live-readout");
    if (readout) readout.textContent = "data unavailable";
  }

  async function start() {
    setupControls();
    setupReadingProgress();
    setupReveals();

    try {
      await loadCoreData();
      updateReadout();
      renderRateBars();
      scheduleCDFs(state.activeScale);
      renderImportance();
    } catch (error) {
      console.error(error);
      showCoreError(error);
    }

    try {
      await loadSamples();
      renderScatter();
    } catch (error) {
      console.error(error);
      const target = document.getElementById("scatter-chart");
      if (target) target.innerHTML = "<p class='chart-error'>Event sample could not be loaded: " + escapeHTML(error.message) + "</p>";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
