import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Colophon } from "./components/Colophon";
import { AR, EN, LangProvider, useT } from "./i18n";
import { LANG_STORAGE_KEY, detectLang, dirOf } from "./lang";

/** Any Arabic letter — the range that must not appear in an English string. */
const ARABIC = /[؀-ۿ]/;

/** Arabic-Indic digits ٠-٩. */
const ARABIC_DIGITS = /[٠-٩]/;

/**
 * Walk a bundle and yield `[path, string]` for every string it can produce,
 * calling functions with stand-in arguments. The point is coverage without a
 * hand-maintained list: a key added to `Strings` is visited the day it exists,
 * which is the only way "no Arabic left in the English sheet" can stay true.
 *
 * Function arity decides the arguments, and the stand-ins are deliberately
 * Latin — an Arabic argument would be echoed back and read as a failure of the
 * bundle rather than of the caller.
 */
function* strings(node: unknown, path = ""): Generator<[string, string]> {
  if (typeof node === "string") {
    yield [path, node];
    return;
  }
  if (typeof node === "function") {
    const args = Array.from({ length: node.length }, (_, i) =>
      // `origin` is the one union-typed parameter in the interface; everything
      // else takes a number or a string and is happy with either stand-in.
      i === 0 && /^arrived/.test(path) ? "jump" : i === 0 ? 7 : "X",
    );
    try {
      yield* strings((node as (...a: unknown[]) => unknown)(...args), path);
    } catch {
      // A formatter that rejects the stand-ins (a key parser, say) has nothing
      // to say about copy — `format.test` covers those on real input.
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) yield* strings(v, `${path}[${i}]`);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) yield* strings(v, path ? `${path}.${k}` : k);
  }
}

describe("the bundles", () => {
  it("carries the same keys in both languages", () => {
    // TypeScript already enforces this at build time; asserting it at runtime
    // catches the one case the type cannot see — a bundle built by spreading
    // another, where a key exists but was never given its own value.
    expect(Object.keys(EN).sort()).toEqual(Object.keys(AR).sort());
  });

  it("leaves no Arabic in the English chrome", () => {
    const leaked: string[] = [];
    for (const [path, value] of strings(EN)) {
      // `names` is the surah-name table and `langName` is what Arabic calls
      // itself; both are proper names, and both are Arabic on purpose. The
      // English table is romanised — that is asserted separately, below.
      if (path.startsWith("names") || path === "langName") continue;
      if (ARABIC.test(value)) leaked.push(`${path}: ${value}`);
    }
    expect(leaked).toEqual([]);
  });

  it("romanises the surah names for the English jumper, and only there", () => {
    expect(EN.surahName(2)).toBe("Al-Baqarah");
    expect(AR.surahName(2)).toBe("البقرة");
  });

  it("gives each language its own digits", () => {
    expect(AR.num(48)).toBe("٤٨");
    expect(EN.num(48)).toBe("48");
  });

  it("spells the page number in Latin in both languages", () => {
    // The one figure a reader reads off the printed mus'haf's corner and types
    // back into the jumper. The aria snapshots in e2e/__aria__ record «صفحة 7»,
    // and this is the assertion that stops a well-meaning sweep from
    // "fixing" it to «صفحة ٧» and taking the snapshots with it.
    expect(AR.pageN(7)).toBe("صفحة 7");
    expect(EN.pageN(7)).toBe("Page 7");
    expect(ARABIC_DIGITS.test(AR.pageN(7))).toBe(false);
  });

  it("labels an ayah from coordinates without needing a canonical key", () => {
    // `ayahLabel` takes `quran/<edition>/2:58` and answers null to anything
    // else — including the bare "2:58" a jumper result is built from. Every
    // call site pairs it with `?? key`, so the null does not crash; it prints
    // the raw string, which in the Arabic UI is Latin digits sitting inside an
    // Arabic row and looks enough like a label to survive review.
    expect(AR.ayahAt(2, 58)).toBe("البقرة · ٢:٥٨");
    expect(EN.ayahAt(2, 58)).toBe("Al-Baqarah · 2:58");
    expect(AR.ayahLabel("2:58")).toBeNull();
  });

  it("keeps the tajweed rule's Arabic name in both languages", () => {
    // A rule name is what a teacher says out loud; the Latin spelling is how it
    // is written down. Both ship in both languages — only the order changes.
    const ar = AR.ruleName("إدغام", "idgham");
    const en = EN.ruleName("إدغام", "idgham");
    expect(ar.primary).toBe("إدغام");
    expect(en.secondary).toBe("إدغام");
    expect(en.primary).toBe("idgham");
  });
});

describe("LangProvider", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
    document.documentElement.dir = "";
  });

  function Probe(): JSX.Element {
    const { lang, dir, t, setLang } = useT();
    return (
      <div>
        <span data-testid="state">{`${lang} ${dir} ${t.mushaf}`}</span>
        <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          flip
        </button>
      </div>
    );
  }

  it("opens in the device's language, and moves the document with it", () => {
    // jsdom's navigator is en-US, so this is the "reader whose phone is in
    // English" path — the one that must not require finding an Arabic control.
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("en ltr Mus'haf");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("remembers a choice, and the choice outranks the device", () => {
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "flip" }));
    expect(screen.getByTestId("state")).toHaveTextContent("ar rtl المصحف");
    expect(document.documentElement.dir).toBe("rtl");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("ar");
    // Same storage, a fresh read: the stored decision wins over navigator.
    expect(detectLang()).toBe("ar");
  });

  it("reads Arabic outside the provider, so no existing test has to change", () => {
    // The default context is Arabic with an inert setter (see i18n.tsx). Every
    // `*.test.tsx` written before this feature renders components bare and
    // asserts the Arabic wording; that must keep working untouched.
    render(<Probe />);
    expect(screen.getByTestId("state")).toHaveTextContent("ar rtl المصحف");
  });

  it("agrees with dirOf about which way each language runs", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
});

describe("what the English UI must not translate", () => {
  it("keeps the licence credits in Arabic, verbatim", () => {
    // `gate:license-copy` binds these rows byte-for-byte to SOURCES.md. An
    // attribution that reads differently depending on the reader is not an
    // attribution anyone actually made — so the English colophon still shows
    // «المتشابهات» and its licence line unchanged.
    render(
      <LangProvider>
        <Colophon open onClose={() => {}} />
      </LangProvider>,
    );
    expect(screen.getByRole("dialog", { name: EN.aboutTitle })).toBeInTheDocument();
    expect(screen.getByText("المتشابهات")).toBeInTheDocument();
    expect(screen.getByText("استعمال حرّ مع ذكر المصدر")).toBeInTheDocument();
  });

  it("offers both languages by name, in their own script", () => {
    render(
      <LangProvider>
        <Colophon open onClose={() => {}} />
      </LangProvider>,
    );
    const arabic = screen.getByRole("radio", { name: EN.langSwitchTo(AR.langName) });
    const english = screen.getByRole("radio", { name: "English" });
    expect(arabic).toHaveTextContent("العربية");
    expect(english).toHaveAttribute("aria-checked", "true");

    // And the switch works from inside the sheet a reader opened to find it.
    fireEvent.click(arabic);
    expect(screen.getByRole("dialog", { name: AR.aboutTitle })).toBeInTheDocument();
  });
});
