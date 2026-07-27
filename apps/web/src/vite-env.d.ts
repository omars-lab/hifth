/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Set only by `make phone-perf`, which builds a throwaway bundle carrying the
   * on-device perf probe (`src/perf/probe.ts`). Absent everywhere else, which is
   * what lets the bundler drop the probe entirely — see `main.tsx`.
   */
  readonly VITE_PERF_PROBE?: string;
}

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
