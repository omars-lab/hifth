import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { appKeyAction } from "@hifth/core";
import { LANG_STORAGE_KEY, LOCALES } from "../lang";
import { digits } from "../format";
import { LOCALE_IDS } from "../messages/locales.gen";
import { LangProvider, useT } from "../i18n";
import { DesktopChrome, type PageMode } from "./DesktopChrome";

/** Reads back the language the provider actually settled on. */
function LangProbe(): JSX.Element {
  const { lang } = useT();
  return <output data-testid="lang">{lang}</output>;
}

// Pinned to Arabic through the same stored preference a reader's choice writes.
// Left to `detectLang`, the language would be the *runner's* locale: jsdom
// reports en-US, CI containers report C, and the assertions below would pass on
// one machine and fail on the other for a reason nothing in the diff explains.
// This is the unit-test twin of `locale: "ar"` in playwright.config.ts, and it
// is set the honest way rather than by stubbing navigator, so the storage path
// the switch writes to is the one the test reads back.
beforeEach(() => {
  localStorage.setItem(LANG_STORAGE_KEY, "ar");
});

/**
 * The chrome is a controlled component down to the last button — it owns none of
 * page mode and none of zoom, which is the whole point of the change that added
 * them (docs/design/desktop.md §8 ②). So the harness supplies both, and the spies
 * it hands back are what the assertions read: what a press *asked for*, never
 * what the component decided on its own.
 */
function chrome(props: Partial<{ pageMode: PageMode; zoom: number }> = {}) {
  const onPageMode = vi.fn();
  const onZoom = vi.fn();
  render(
    <LangProvider>
      <DesktopChrome
        pageMode={props.pageMode ?? "two"}
        onPageMode={onPageMode}
        zoom={props.zoom ?? 1}
        onZoom={onZoom}
      />
      <LangProbe />
    </LangProvider>,
  );
  return { onPageMode, onZoom };
}

/**
 * The language switch's own radios, now that it is not the only radiogroup.
 *
 * Picked out by `lang`, not by the group's accessible name, and that is not
 * fastidiousness: the name is itself translated, so a test that switches to
 * English and looks again would be asking for «اللغة» in a chrome that has just
 * stopped saying it. `lang` is the one attribute only these options carry, and
 * it means the same thing in every locale.
 */
function langOptions() {
  return screen.getAllByRole("radio").filter((r) => r.hasAttribute("lang"));
}

describe("DesktopChrome", () => {
  it("offers every language there is, not one 'switch' button", () => {
    // The reason is the same one Colophon gives and it does not change with
    // width: a single "switch to English" button is unreadable to exactly the
    // half of its audience that cannot read the label it currently wears. One
    // radio per language, each written in its own script, so a screen reader
    // changes voice for the option it is offering.
    //
    // Asserted against `LOCALE_IDS` rather than against a count and two indices.
    // The row is built from the registry now, and this is the half of that which
    // a test can hold: drop `ur.json` into `messages/` and the switch either
    // grows a third option or this says which language it left out.
    chrome();
    const group = screen.getByRole("radiogroup", { name: "اللغة" });
    const options = langOptions();
    expect(options.map((o) => o.getAttribute("lang"))).toEqual([...LOCALE_IDS]);
    for (const option of options) expect(group).toContainElement(option);
  });

  it("wears each language's declared abbreviation, not a truncated name", () => {
    // «العربية» does not fit beside five other controls and nothing shortens it
    // to «ع» by rule — an abbreviation is a decision a language makes about
    // itself, which is why `abbr` is declared in `LOCALES` next to `name`. The
    // full name still does the talking, in the accessible label below.
    chrome();
    expect(langOptions().map((o) => o.textContent)).toEqual(
      LOCALE_IDS.map((id) => LOCALES[id].abbr),
    );
  });

  it("marks the current language checked and switches to the other", () => {
    chrome();
    const [ar, en] = langOptions();
    expect(ar!.getAttribute("aria-checked")).toBe("true");
    expect(en!.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(en!);
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(langOptions()[1]!.getAttribute("aria-checked")).toBe("true");
  });

  it("names the option a reader cannot currently read", () => {
    // The unchecked option's glyph is in a script its reader may not have. The
    // accessible name spells the language out; the checked one needs no override
    // because it already says what it is in the language being read.
    chrome();
    const [ar, en] = langOptions();
    expect(ar!.getAttribute("aria-label")).toBeNull();
    expect(en!.getAttribute("aria-label")).toBe("التبديل إلى English");
  });

  it("keeps the keyboard hint out of the accessibility tree", () => {
    // It is redundancy for the eye. A screen-reader user navigating by keyboard
    // does not need a visual legend read out between the wordmark and the page
    // number, and every control it names is already reachable and labelled.
    chrome();
    // Asserted through the ancestor rather than by asking whether the text is
    // findable: `queryByText` walks the DOM, not the accessibility tree, so it
    // finds `aria-hidden` content and would have passed this test for the wrong
    // reason no matter what the markup said.
    for (const label of [screen.getByText("تصفّح"), screen.getByText("انتقال")]) {
      expect(label.closest("[aria-hidden='true']")).not.toBeNull();
    }
    // And the hint is hidden as a unit — one `aria-hidden` on the row, not one
    // per span, so a key added later cannot arrive un-hidden.
    const hidden = document.querySelectorAll("[aria-hidden='true']");
    expect(hidden.length).toBe(1);
    expect(hidden[0]!.querySelectorAll("kbd").length).toBe(3);
  });

  it("pins the arrow keys LTR so the hint names the keys actually pressed", () => {
    // U+2190/U+2192 are Bidi_Mirrored. Inside the RTL chrome both would silently
    // flip and the legend would name the opposite keys — the same trap PageSlider
    // sidesteps by drawing ▸ ◂. Here the glyphs must stay the ones printed on the
    // keyboard, so the run is made LTR instead of the characters swapped.
    chrome();
    const keys = Array.from(document.querySelectorAll("kbd"));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k.getAttribute("dir")).toBe("ltr");
  });

  it("only hints keys that actually do the thing the hint claims", () => {
    // Fed back through `appKeyAction` rather than compared to a literal. A hint
    // is a promise about behaviour, and the way it goes wrong is that the keymap
    // moves while the legend stays — so the legend is checked against the keymap,
    // not against the string someone typed into both.
    chrome();
    const [prev, next, jump] = Array.from(document.querySelectorAll("kbd")).map(
      (k) => k.textContent ?? "",
    );
    const press = (key: string) =>
      appKeyAction({
        key,
        modified: false,
        inTextField: false,
        inDialog: false,
        defaultPrevented: false,
        onAyah: false,
      });

    // ← is drawn first, on the right of the RTL row, and it turns *forward*:
    // the next page of a mus'haf is the one to the left. The legend would be
    // actively misleading if these two were swapped.
    expect(prev).toBe("←");
    expect(next).toBe("→");
    expect(press("ArrowLeft")).toEqual({ kind: "page", step: 1 });
    expect(press("ArrowRight")).toEqual({ kind: "page", step: -1 });
    expect(press(jump!)).toEqual({ kind: "jumper" });
  });
});

describe("DesktopChrome · one page or two", () => {
  it("asks for the mode it is not in, and never decides for itself", () => {
    // The control owns nothing. That is the entire point of the change that
    // introduced it: `soloLeaf` used to be *derived* from zoom, and three
    // distinct desyncs came out of that one derivation (desktop.md §8 ②). So the
    // assertion is about the request, not about any state the chrome kept.
    const { onPageMode } = chrome({ pageMode: "two" });
    const group = screen.getByRole("radiogroup", { name: "الصفحات المعروضة" });
    const [one, two] = within(group).getAllByRole("radio");

    expect(one!.getAttribute("aria-checked")).toBe("false");
    expect(two!.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(one!);
    expect(onPageMode).toHaveBeenCalledWith("one");
    // And still says "two", because nothing but the prop can change it.
    expect(within(group).getAllByRole("radio")[1]!.getAttribute("aria-checked")).toBe("true");
  });

  it("shows a word and says a phrase", () => {
    // Same trade the language switch makes beside it: the header has room for
    // «واحدة» and not for «صفحة واحدة», and a listener loses nothing because the
    // accessible name carries the phrase. Asserted as a pair so a future edit
    // cannot quietly let the visible word become the accessible name.
    chrome({ pageMode: "one" });
    const group = screen.getByRole("radiogroup", { name: "الصفحات المعروضة" });
    const [one, two] = within(group).getAllByRole("radio");
    expect([one!.textContent, two!.textContent]).toEqual(["واحدة", "اثنتان"]);
    expect([one!.getAttribute("aria-label"), two!.getAttribute("aria-label")]).toEqual([
      "صفحة واحدة",
      "صفحتان",
    ]);
  });

  it("is a radiogroup, not a checkbox labelled 'two pages'", () => {
    // Two mutually exclusive states are two radios. A single checkbox would
    // leave a listener guessing whether *checked* means the box is ticked or the
    // book is open — and the answer would flip with the label's wording.
    chrome();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getAllByRole("radiogroup").length).toBe(2);
  });
});

describe("DesktopChrome · the zoom stepper", () => {
  /** The two buttons, in the order they are drawn: out, then in. */
  function steppers() {
    const group = screen.getByRole("group", { name: "التكبير" });
    return {
      out: within(group).getByRole("button", { name: "تصغير" }),
      into: within(group).getByRole("button", { name: "تكبير" }),
      group,
    };
  }

  it("steps to the next rung of the ladder, not by a multiplier", () => {
    // A ladder, and the readout is why: repeated multiplication drifts, and
    // «١٠٠٪» has to be true when it says so. The rungs are ZOOM_STEPS, owned by
    // the stage — the same list the clamp is applied against.
    const { onZoom } = chrome({ pageMode: "one", zoom: 1 });
    const { out, into } = steppers();

    fireEvent.click(into);
    expect(onZoom).toHaveBeenLastCalledWith(1.25);
    fireEvent.click(out);
    expect(onZoom).toHaveBeenLastCalledWith(0.8);
  });

  it("gets a reader back onto the ladder from wherever a hop left them", () => {
    // A hop frames its ayah at DEFAULT_HOP_ZOOM — 1.55, deliberately on no rung.
    // Index arithmetic ("find 1.55, go one along") has no answer here; asking for
    // the nearest rung *past* 1.55 in the direction pressed does, and it is the
    // rung the reader expected in both directions.
    const { onZoom } = chrome({ pageMode: "one", zoom: 1.55 });
    const { out, into } = steppers();

    fireEvent.click(out);
    expect(onZoom).toHaveBeenLastCalledWith(1.5);
    fireEvent.click(into);
    expect(onZoom).toHaveBeenLastCalledWith(2);
  });

  it("stops at the floor rather than pretending to move", () => {
    // MIN_ZOOM. The button that cannot move is disabled rather than
    // clickable-and-inert, and it needs no tooltip because the reason it is off
    // is already on screen beside it: the readout says 80%.
    chrome({ pageMode: "one", zoom: 0.8 });
    expect(steppers().out).toBeDisabled();
    expect(steppers().into).toBeEnabled();
    expect(steppers().out.getAttribute("title")).toBeNull();
  });

  it("stops at the ceiling too", () => {
    // MAX_ZOOM, and the mirror of the row above. Both ends are asserted because
    // the two are computed by the same helper walking the ladder in opposite
    // directions, and a sign error would leave exactly one of them working.
    chrome({ pageMode: "one", zoom: 5 });
    expect(steppers().into).toBeDisabled();
    expect(steppers().out).toBeEnabled();
  });

  it("works in two-page mode too — the spread magnifies both leaves together", () => {
    // It used to be disabled here, on the finding that two enlarged pages lose
    // their edges and read as one column. The reader reversed that: a spread is
    // magnified as a pair, so the stepper is live with the book open, greyed only
    // at the ends of the ladder, and it carries no "switch to one page" tooltip
    // because there is nothing to switch to. App is what drives both leaves to
    // the level a press asks for; the control just asks. (See the decision.)
    const { onZoom } = chrome({ pageMode: "two", zoom: 1 });
    const { out, into } = steppers();
    expect(into).toBeEnabled();
    expect(out).toBeEnabled(); // 1 is a rung with room below (0.8) and above (1.25)
    for (const b of [out, into]) expect(b.getAttribute("title")).toBeNull();
    fireEvent.click(into);
    expect(onZoom).toHaveBeenCalledWith(1.25);
  });

  it("shows the level without becoming a second announcer", () => {
    // The readout is for the eye. The app has exactly one polite live region and
    // a page turn already speaks through it; a second one in the header would
    // compete with the first for the same reader at the same moment. What landed
    // is announced at the App level instead, through `useAnnouncer` — which is
    // also why the level is in neither button's name, where it would be re-read
    // on every subsequent visit to either one.
    chrome({ pageMode: "one", zoom: 1.25 });
    const { group, out, into } = steppers();
    expect(within(group).getByText(`${digits(125, "ar")}٪`)).toBeInTheDocument();
    expect(group.querySelector("[aria-live]")).toBeNull();
    for (const b of [out, into]) expect(b.textContent).not.toContain(digits(125, "ar"));
  });
});
