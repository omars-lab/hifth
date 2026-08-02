import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { appKeyAction } from "@hifth/core";
import { LANG_STORAGE_KEY, LOCALES } from "../lang";
import { LOCALE_IDS } from "../messages/locales.gen";
import { LangProvider, useT } from "../i18n";
import { DesktopChrome } from "./DesktopChrome";

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

function chrome() {
  render(
    <LangProvider>
      <DesktopChrome />
      <LangProbe />
    </LangProvider>,
  );
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
    const options = screen.getAllByRole("radio");
    expect(options.map((o) => o.getAttribute("lang"))).toEqual([...LOCALE_IDS]);
    for (const option of options) expect(group).toContainElement(option);
  });

  it("wears each language's declared abbreviation, not a truncated name", () => {
    // «العربية» does not fit beside five other controls and nothing shortens it
    // to «ع» by rule — an abbreviation is a decision a language makes about
    // itself, which is why `abbr` is declared in `LOCALES` next to `name`. The
    // full name still does the talking, in the accessible label below.
    chrome();
    const options = screen.getAllByRole("radio");
    expect(options.map((o) => o.textContent)).toEqual(LOCALE_IDS.map((id) => LOCALES[id].abbr));
  });

  it("marks the current language checked and switches to the other", () => {
    chrome();
    const [ar, en] = screen.getAllByRole("radio");
    expect(ar!.getAttribute("aria-checked")).toBe("true");
    expect(en!.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(en!);
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getAllByRole("radio")[1]!.getAttribute("aria-checked")).toBe("true");
  });

  it("names the option a reader cannot currently read", () => {
    // The unchecked option's glyph is in a script its reader may not have. The
    // accessible name spells the language out; the checked one needs no override
    // because it already says what it is in the language being read.
    chrome();
    const [ar, en] = screen.getAllByRole("radio");
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
