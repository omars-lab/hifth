import { useEffect, useState } from "react";
import { PITCH } from "../pitch/pitch";
import styles from "./DeveloperPage.module.css";

/**
 * DeveloperPage — what the maintainer checks by hand, in one place
 * (docs/design/app-pages.md ②).
 *
 * Only the laptop's dev server ever loads this file: `App.tsx` reaches it
 * behind `import.meta.env.DEV`, and the size check refuses any build that
 * carries its marker (`data-developer-page`). So its words are plain English
 * written here, not in the app's word lists, which every build ships.
 *
 * It stands over the mus'haf the way the settings page does, as a dialog, so
 * the page-turn keys are not heard behind it.
 */

/** Everything the app remembers in this browser starts with this. */
const OURS = "hifth.";

interface Switch {
  name: string;
  on: boolean;
  how: string;
  what: string;
}

function switches(): Switch[] {
  return [
    {
      name: "The private pitch layer",
      on: PITCH,
      how: "make pitch",
      what: "Shows the held commentary. Never part of a public build.",
    },
    {
      name: "The library's page laid over ours",
      on: Boolean(import.meta.env.VITE_QUL_OVERLAY),
      how: "make dev-qul",
      what: "A pill on the page switches between the print, the library's words and both.",
    },
    {
      name: "The speed probe",
      on: Boolean(import.meta.env.VITE_PERF_PROBE),
      how: "VITE_PERF_PROBE=1 make dev",
      what: "A bar across the top that times panning, pinching and tapping. On a phone it is make phone-perf, a build, so without this page.",
    },
  ];
}

function remembered(): [string, string][] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(OURS))
      .sort()
      .map((k) => [k, localStorage.getItem(k) ?? ""]);
  } catch {
    // Safari private mode: nothing is remembered.
    return [];
  }
}

/** This page's address with one switch set before the `#`, the place in the book kept. */
function withSwitch(key: string, value: string): string {
  const q = new URLSearchParams(window.location.search);
  q.set(key, value);
  return `${window.location.pathname}?${q.toString()}${window.location.hash}`;
}

const screenNow = (): string =>
  `${window.innerWidth} × ${window.innerHeight} points, ${window.devicePixelRatio}× sharp, ${navigator.maxTouchPoints} touch points`;

export default function DeveloperPage({ onClose }: { onClose: () => void }): JSX.Element {
  const [kept, setKept] = useState(remembered);
  const [size, setSize] = useState(screenNow);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    const onSize = (): void => setSize(screenNow());
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onSize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onSize);
    };
  }, [onClose]);

  const forget = (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing was kept */
    }
    setKept(remembered());
  };

  const links: [string, string, string][] = [
    ["qul-diff.html", "The library's page beside ours", "Needs a page pulled first; the page says how."],
    [withSwitch("lang", "ar"), "This page in Arabic", "?lang=ar"],
    [withSwitch("lang", "en"), "This page in English", "?lang=en"],
    [withSwitch("phonebar", "a"), "The phone's toolbar, first layout", "?phonebar=a (b is the second; none is today's)"],
    [withSwitch("share", "a"), "The share sheet, first shape", "?share=a (b is the second; none is today's)"],
  ];

  return (
    <div className={styles.page} role="dialog" aria-modal="true" aria-label="Developer" data-developer-page="" dir="ltr" lang="en">
      <h2 className={styles.title}>Developer</h2>
      <p className={styles.note}>Only this laptop&apos;s dev server shows this page. No build carries it.</p>

      <section className={styles.part} aria-labelledby="dev-built">
        <h3 id="dev-built">How this app was built</h3>
        <ul className={styles.list}>
          {switches().map((s) => (
            <li key={s.name} className={styles.line}>
              <span className={styles.name}>{s.name}</span>
              <span className={styles.state} data-on={s.on ? "" : undefined}>
                {s.on ? "on" : "off"}
              </span>
              <span className={styles.what}>
                {s.what} Started with <code>{s.how}</code>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.part} aria-labelledby="dev-screen">
        <h3 id="dev-screen">This screen</h3>
        <p className={styles.what}>{size}</p>
        <p className={styles.what}>
          Language {document.documentElement.lang || "not set"}, reading {document.documentElement.dir === "rtl" ? "right to left" : "left to right"}
        </p>
        <p className={styles.what}>{navigator.userAgent}</p>
      </section>

      <section className={styles.part} aria-labelledby="dev-links">
        <h3 id="dev-links">Pages and switches opened by hand</h3>
        <ul className={styles.list}>
          {links.map(([href, name, how]) => (
            <li key={href} className={styles.line}>
              <a className={styles.link} href={href}>
                {name}
              </a>
              <span className={styles.what}>{how}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.part} aria-labelledby="dev-kept">
        <h3 id="dev-kept">What this browser remembers</h3>
        {kept.length === 0 ? (
          <p className={styles.what}>Nothing yet.</p>
        ) : (
          <ul className={styles.list}>
            {kept.map(([key, value]) => (
              <li key={key} className={styles.line}>
                <span className={styles.name}>{key}</span>
                <button type="button" className={styles.forget} aria-label={`Forget ${key}`} onClick={() => forget(key)}>
                  Forget
                </button>
                <span className={styles.what}>{value.length > 80 ? `${value.slice(0, 80)}… (${value.length} letters)` : value}</span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>Forgetting takes effect the next time the app is loaded.</p>
      </section>
    </div>
  );
}
