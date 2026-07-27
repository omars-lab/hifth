/**
 * The on-device perf probe — the phone measures itself.
 *
 * Follow-up ① (ledger check `perf-verdict-on-device`) has been open since Loop
 * 1, and not because anyone doubts it matters: it gates Loops 4b, 6b and 7, so
 * it is the single most expensive open item in the project. It stayed open
 * because the recipe for running it was "pair the phone to the Mac over USB,
 * enable Web Inspector, find the timeline, read the frame chart" — four steps
 * of friction standing in front of one number. A check that costs that much to
 * run is a check that does not get run.
 *
 * So the measurement moves into the page. You open the app on the phone, tap
 * once, pan/pinch/tap for fifteen seconds with your actual fingers, and read
 * frame-time percentiles off the screen. No cable, no DevTools, no laptop.
 *
 * **Why real fingers and not a scripted transform sweep.** `perf/pan-zoom-trace.mjs`
 * already drives a synthetic sequence, and its number (~8.3 ms/frame, flat under
 * CPU throttle) is exactly what we do not trust: writing `style.transform` in a
 * loop skips touch dispatch, hit-testing against hundreds of polygons, and the
 * compositor's decision to re-raster a scaled layer. Those are the costs the
 * verdict turns on. A hand on the glass is not repeatable, but it is the thing
 * being measured — and repeatability is what the emulated harness is for.
 *
 * **Three segments, because there are three separate risks** (PLAN §Loop 1):
 *   pan       — steady-state compositing of a mounted ~170 KB inline SVG
 *   pinch     — re-raster when zoom passes the layer's backing store
 *   highlight — overlay churn on tap, which is an INP question, not an fps one
 * A single blended number would average the one that fails into the two that
 * pass, which is how a rendering strategy gets chosen on a lie.
 *
 * The output is paste-ready JSON for `docs/validation/ledger.json`, because a
 * result that stays on the phone screen is a result nobody can act on.
 *
 * NEVER SHIPS. Mounted only when the build sets `VITE_PERF_PROBE` (see
 * `main.tsx`), which is a *build-time* flag deliberately — a URL parameter
 * would let a reader turn a measurement slab on over the mushaf, which is the
 * same defect the tajweed `skin=` param was rejected for (PLAN follow-up ⑧).
 * Reach it with `make phone-perf`.
 */

import { SOURCE_COMMIT } from "../provenance";

interface Segment {
  id: "pan" | "pinch" | "highlight";
  /** Arabic first — the app is RTL-native and so is the person holding it. */
  ar: string;
  en: string;
  seconds: number;
}

const SEGMENTS: readonly Segment[] = [
  { id: "pan", ar: "مرّر الصفحة بإصبع واحد", en: "Pan with one finger", seconds: 5 },
  { id: "pinch", ar: "قرّب وباعد بإصبعين", en: "Pinch in and out", seconds: 5 },
  { id: "highlight", ar: "اضغط آيات مختلفة", en: "Tap different ayahs", seconds: 5 },
];

/** A frame time, tagged with the segment that was being driven when it landed. */
interface Sample {
  segment: Segment["id"];
  ms: number;
}

interface Stats {
  frames: number;
  mean: number;
  fps: number;
  p50: number;
  p95: number;
  worst: number;
  /** Share of frames over 16.7 ms — the jank budget, in percent. */
  janky: number;
}

function stats(times: number[]): Stats | null {
  // Under ~30 frames the percentiles are noise dressed up as measurement, and
  // a segment that thin means the instruction was not followed — say so rather
  // than reporting a confident number nobody drove.
  if (times.length < 30) return null;
  const sorted = [...times].sort((a, b) => a - b);
  // The `?? 0` fallbacks are unreachable past the length guard above; they are
  // here because `noUncheckedIndexedAccess` types every index access as
  // possibly-undefined, and a non-null assertion would suppress the check the
  // rest of this file benefits from.
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
  const mean = sorted.reduce((s, f) => s + f, 0) / sorted.length;
  return {
    frames: sorted.length,
    mean: round(mean),
    fps: Math.round(1000 / mean),
    p50: round(at(50)),
    p95: round(at(95)),
    worst: round(sorted.at(-1) ?? 0),
    janky: Math.round((100 * sorted.filter((f) => f > 16.7).length) / sorted.length),
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * What the browser will tell us about the hardware.
 *
 * The verdict is meaningless without it: "9 ms/frame" is a pass on a flagship
 * and a different sentence entirely on the 4-core, 4 GB phone the TTI budget is
 * written against. `deviceMemory` and `hardwareConcurrency` are Chromium-only
 * and absent on iOS — recorded as null rather than guessed, so the ledger entry
 * says which phone this was and which facts the browser withheld.
 */
function device() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    cores: nav.hardwareConcurrency ?? null,
    memoryGB: nav.deviceMemory ?? null,
    // Installed-vs-tab changes the storage tier and the chrome height, and it
    // is the axis the offline check turns on — worth stamping on every result.
    standalone: window.matchMedia("(display-mode: standalone)").matches,
  };
}

/**
 * First-paint costs, which the frame sampler structurally cannot see: it starts
 * after the page is up, and the other half of the risk is how long a ~170 KB
 * inline SVG takes to raster the first time. Safari does not implement LCP, so
 * it is read opportunistically and reported as null there rather than omitted —
 * a missing field reads as "we forgot", null reads as "this browser refuses".
 */
function paint() {
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return {
    fcpMs: fcp ? round(fcp.startTime) : null,
    lcpMs: lcp === null ? null : round(lcp),
    domContentLoadedMs: nav ? round(nav.domContentLoadedEventEnd) : null,
  };
}

/** Latest LCP, filled by an observer if the browser has one. */
let lcp: number | null = null;
try {
  new PerformanceObserver((list) => {
    const last = list.getEntries().at(-1);
    if (last) lcp = last.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
} catch {
  // Safari: no LCP. Reported as null; see paint().
}

const CSS = `
#hifth-perf {
  position: fixed;
  inset-inline: 0;
  top: 0;
  z-index: 9999;
  padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 10px;
  background: #14110d;
  color: #f4efe6;
  font: 500 14px/1.45 system-ui, sans-serif;
  text-align: center;
  /* Unmistakably not the app: a measurement slab, in the one palette the
     mushaf chrome never uses. Nobody should confuse this for product. */
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.4);
}
#hifth-perf[data-recording="true"] { pointer-events: none; }
#hifth-perf button {
  pointer-events: auto;
  font: inherit;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid #f4efe6;
  border-radius: 999px;
  background: transparent;
  color: inherit;
}
#hifth-perf .big { font-size: 20px; font-weight: 700; }
#hifth-perf .en { opacity: 0.65; font-size: 12px; }
#hifth-perf .count { font-variant-numeric: tabular-nums; font-size: 28px; font-weight: 700; }
#hifth-perf table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 6px 0; }
#hifth-perf th, #hifth-perf td { padding: 2px 4px; text-align: center; font-variant-numeric: tabular-nums; }
#hifth-perf th { opacity: 0.6; font-weight: 500; }
#hifth-perf .bad { color: #ffb4a2; }
#hifth-perf textarea {
  width: 100%; height: 96px; margin-top: 6px; font: 11px/1.3 ui-monospace, monospace;
  background: #000; color: #cfe8c9; border: 0; border-radius: 6px; padding: 6px;
}
`;

export function mountPerfProbe(): void {
  if (document.getElementById("hifth-perf")) return;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  const bar = document.createElement("div");
  bar.id = "hifth-perf";
  // dir stays inherited from <html dir="rtl">; the panel is Arabic-first.
  document.body.append(bar);

  const samples: Sample[] = [];
  let current: Segment["id"] = "pan";

  idle();

  function idle() {
    bar.dataset.recording = "false";
    bar.innerHTML = "";
    const p = el("div", "قياس الأداء على هذا الجهاز — ١٥ ثانية");
    const en = el("div", "On-device frame timing · follow-up ①", "en");
    const go = document.createElement("button");
    go.textContent = "ابدأ";
    go.addEventListener("click", () => void record());
    bar.append(p, en, go);
  }

  /**
   * Run the segments back to back, sampling frame deltas throughout.
   *
   * The rAF loop runs for the whole session rather than per segment: restarting
   * it would drop the first frame of each segment, and the first frame after an
   * instruction changes is often the most interesting one.
   */
  async function record() {
    bar.dataset.recording = "true";
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      samples.push({ segment: current, ms: now - last });
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    for (const seg of SEGMENTS) {
      current = seg.id;
      // A beat between instructions: without it the tail of one gesture lands
      // in the head of the next segment and both numbers get quietly wrong.
      await countdown(seg, 1, true);
      await countdown(seg, seg.seconds, false);
    }

    cancelAnimationFrame(raf);
    results();
  }

  function countdown(seg: Segment, seconds: number, ready: boolean): Promise<void> {
    return new Promise((resolve) => {
      let left = seconds;
      const draw = () => {
        bar.innerHTML = "";
        bar.append(
          el("div", ready ? "استعد" : seg.ar, "big"),
          el("div", ready ? "get ready" : seg.en, "en"),
          el("div", String(left), "count"),
        );
      };
      draw();
      const id = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          window.clearInterval(id);
          resolve();
          return;
        }
        draw();
      }, 1000);
    });
  }

  function results() {
    bar.dataset.recording = "false";
    bar.innerHTML = "";

    const bySegment: Record<string, Stats | null> = {};
    for (const seg of SEGMENTS) {
      bySegment[seg.id] = stats(
        samples.filter((s) => s.segment === seg.id).map((s) => s.ms),
      );
    }

    const table = document.createElement("table");
    table.innerHTML =
      "<tr><th></th><th>mean</th><th>fps</th><th>p95</th><th>worst</th><th>jank</th></tr>";
    for (const seg of SEGMENTS) {
      const s = bySegment[seg.id];
      const row = document.createElement("tr");
      row.innerHTML = s
        ? `<td>${seg.en}</td><td>${s.mean}</td><td>${s.fps}</td>` +
          `<td class="${s.p95 > 16.7 ? "bad" : ""}">${s.p95}</td>` +
          `<td class="${s.worst > 50 ? "bad" : ""}">${s.worst}</td>` +
          `<td class="${s.janky > 10 ? "bad" : ""}">${s.janky}%</td>`
        : `<td>${seg.en}</td><td colspan="5" class="bad">too few frames — not driven</td>`;
      table.append(row);
    }

    const payload = {
      check: "perf-verdict-on-device",
      device: device(),
      build: { commit: SOURCE_COMMIT, url: location.href },
      paint: paint(),
      segments: bySegment,
      verdict: "TODO — inline-svg | content-visibility | raster-fallback",
    };

    const out = document.createElement("textarea");
    out.readOnly = true;
    out.value = JSON.stringify(payload, null, 2);
    // Long-press → Select All → Copy. `navigator.clipboard` is unavailable
    // here on purpose-built grounds: a LAN preview is served over plain http,
    // which is not a secure context, so the Clipboard API is not exposed. A
    // copy button that silently does nothing is worse than no button.
    out.addEventListener("focus", () => out.select());

    const again = document.createElement("button");
    again.textContent = "أعد القياس";
    again.addEventListener("click", () => {
      samples.length = 0;
      idle();
    });

    bar.append(
      el("div", "النتيجة — الصقها في ledger.json", "big"),
      table,
      out,
      again,
    );
  }
}

function el(tag: string, text: string, cls?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
