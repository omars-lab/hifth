/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Set only by `make phone-perf`, which builds a throwaway bundle carrying the
   * on-device perf probe (`src/perf/probe.ts`). Absent everywhere else, which is
   * what lets the bundler drop the probe entirely — see `main.tsx`.
   */
  readonly VITE_PERF_PROBE?: string;
  /**
   * Set only by the private pitch build (`make pitch`), which loads The Study
   * Quran's held commentary + cross-references for a demo shown to the
   * rights-holders in a room — never shipped. Absent in every public build, so
   * `PITCH` is false: the loader early-returns before it ever fetches held copy,
   * and the gitignored JSON it would read is stripped from the build output by
   * the safety-net plugin in vite.config.ts. See `src/pitch/` and CLAUDE.md →
   * "What we are building right now".
   */
  readonly VITE_PITCH?: string;

  /**
   * The open live tafsir provider (`src/tafsir/quran-foundation.ts`). Set
   * `VITE_TAFSIR_QF_BASE` (the service's API base) and `VITE_TAFSIR_QF_ID` (which
   * of its 100+ tafsir editions) to turn it on; with either absent the provider
   * is not registered. The rest are optional: a label and licence for the source
   * line, the ayah `edition` the verse keys span, and a bearer token for the
   * keyed tier. No secret is committed — a token, if used, is a build-time env.
   */
  readonly VITE_TAFSIR_QF_BASE?: string;
  readonly VITE_TAFSIR_QF_ID?: string;
  readonly VITE_TAFSIR_QF_LABEL?: string;
  readonly VITE_TAFSIR_QF_LICENSE?: string;
  readonly VITE_TAFSIR_QF_EDITION?: string;
  readonly VITE_TAFSIR_QF_TOKEN?: string;
  /** The language the chosen edition is written in (`ar`, `en`), for its direction. */
  readonly VITE_TAFSIR_QF_LANG?: string;
  /**
   * Set only by `make dev-qul`, which runs the dev server with the store-over-print
   * overlay mounted (`src/qul-diff/overlay.ts`). Absent everywhere else, so the
   * bundler drops the overlay — and the store's words with it — from every build.
   */
  readonly VITE_QUL_OVERLAY?: string;
}

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
