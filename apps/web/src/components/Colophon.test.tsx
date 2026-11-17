import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { Colophon } from "./Colophon";
import { LangProvider, stringsFor } from "../i18n";
import { SOURCE_COPY, SOURCE_HOME, SOURCE_REPO, isCommit, sourceUrl, urlFor } from "../provenance";
import { CARD_EDGE_KEY } from "../card-edge";
import { LOOKALIKE_COMPARE_KEY } from "../lookalike-compare";
import { PASSAGE_ROWS_KEY } from "../passage-rows";
import { PASSAGE_HOP_KEY } from "../passage-hop";
import { LOOKALIKE_ARROWS_KEY } from "../lookalike-arrows";
import { TURN_LANDING_KEY } from "../turn-landing";
import { OPEN_SIZE_KEY } from "../open-size";
import { UPRIGHT_AGAIN_KEY } from "../upright-again";
import { ZOOM_ACROSS_KEY } from "../zoom-across";
import { RIBBON_LENGTH_KEY } from "../ribbon-length";
import { RUN_FOLLOW_KEY } from "../run-follow";
import { RUN_AHEAD_KEY } from "../run-ahead";
import { LOOKALIKE_PREVIEW_KEY } from "../lookalike-preview";

/*
 * The colophon is the app's licence compliance, so these tests assert
 * obligations rather than markup: the GPL §6 offer resolves to a real place,
 * and the five sources whose licences ask to be named are named with their
 * links intact. A rendering detail may change freely; a missing credit is a
 * licence breach.
 *
 * The sixth row — the ligature corpus the word boxes were measured from — is
 * deliberately not in the list below. Its licence asks for nothing, so its row
 * is a courtesy, and asserting a courtesy here would file it under obligation
 * and make it un-droppable for a reason that was never true. `gate:license-copy`
 * still holds it to SOURCES.md byte for byte; what it is not held to is this
 * file's promise, which is about breaches.
 */

describe("Colophon", () => {
  it("renders nothing until it is opened", () => {
    const { container } = render(<Colophon open={false} onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the source for this build, not a branch", () => {
    render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const link = screen.getByRole("link", { name: /الشيفرة المصدرية/ });
    // Under vitest there is no `define`, so this is the "dev" fallback — the
    // repository root. `urlFor` covers the shape the deployed build ships.
    expect(link).toHaveAttribute("href", sourceUrl());
    expect(link.getAttribute("href")).toContain(SOURCE_REPO);
  });

  it("links the designs and decisions the site serves beside the app", () => {
    render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    // Relative: the build stages docs/ next to the app, so the link holds on
    // any host the app is served from and needs no knowledge of which.
    const link = screen.getByRole("link", { name: /التصاميم والقرارات/ });
    expect(link).toHaveAttribute("href", "./docs/");
  });

  it("inside the app, links the designs on the public site, since the app carries no copy", () => {
    // In the app the page is served from inside the bundle, which holds no docs/,
    // and the app only hands web addresses to the browser. A relative link there
    // went nowhere: Apple's reviewer would tap it and nothing would happen.
    const shelled = window as Window & { __HIFTH_NATIVE__?: unknown };
    shelled.__HIFTH_NATIVE__ = { platform: "ios", publicBase: "https://example.org/hifth/" };
    try {
      render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
      const link = screen.getByRole("link", { name: /التصاميم والقرارات/ });
      expect(link).toHaveAttribute("href", "https://example.org/hifth/docs/");
    } finally {
      delete shelled.__HIFTH_NATIVE__;
    }
  });

  it("credits every source whose licence asks to be named", () => {
    render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    // The Quranic Arabic Corpus requires the link, verbatim: "a link is made to
    // http://corpus.quran.com". quran-tajweed is CC BY 4.0. The mutashabihat
    // data asks for a mention in the app itself. KFGQPC is the mushaf. Tanzil is
    // CC BY too, and is credited even though no byte of it ships — what ships is
    // the numbers copied out of it (JUZ_STARTS, HIZB_STARTS), and the numbers are
    // the work.
    for (const href of [
      "http://corpus.quran.com",
      "https://github.com/cpfair/quran-tajweed",
      "https://github.com/Waqar144/Quran_Mutashabihat_Data",
      "https://github.com/quranpedia/quran-svg",
      "https://tanzil.net",
    ]) {
      expect(
        screen.getAllByRole("link").some((a) => a.getAttribute("href") === href),
        `no credit links to ${href}`,
      ).toBe(true);
    }
    // Exact-string queries, not regex: "GNU GPL" also appears in the prose
    // above (Hifth's own licence), and the corpus's is a separate obligation.
    expect(screen.getByText("CC BY 4.0")).toBeInTheDocument();
    expect(screen.getByText("GNU GPL")).toBeInTheDocument();
  });

  it("in English, gives every source an English line under the row its licence asks for", async () => {
    // Found on the store build, 2026-11-17 (launch item 39): with the buttons in
    // English, the sources still read only in Arabic, so an English reader (and
    // Apple's reviewer) could not tell what the app is built on. The Arabic row
    // stays as it is, because it is the attribution SOURCES.md records; the
    // English line sits under it, and is bound to SOURCES.md the same way.
    // The real language holder, so the panel's own English button switches it.
    render(
      <LangProvider>
        <Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />
      </LangProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /English/ }));
    // The English strings may load a moment after the tap.
    await screen.findByText("Mushaf pages");
    // The choice is remembered on the device; forget it for the tests after this one.
    localStorage.clear();
    const rows = Array.from(document.querySelectorAll("li[data-credit]"));
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const row of rows) {
      const english = row.querySelector('[lang="en"]');
      expect(english, `no English line for ${row.getAttribute("data-credit")}`).not.toBeNull();
      expect(english!.textContent).not.toMatch(/[؀-ۿ]/);
      // The Arabic attribution is still there, unchanged.
      expect(row.querySelector('[lang="ar"]')?.textContent).toMatch(/[؀-ۿ]/);
    }
    const page = rows.find((r) => r.getAttribute("data-credit") === "https://github.com/quranpedia/quran-svg");
    expect(page!.textContent).toMatch(/Mushaf pages/);
    expect(page!.textContent).not.toMatch(/non-commercial/i);
  });

  it("in Arabic, shows the sources as before, with no English line", () => {
    render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const rows = Array.from(document.querySelectorAll("li[data-credit]"));
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const row of rows) expect(row.querySelector('[lang="en"]')).toBeNull();
  });

  it("does not claim the mushaf artwork is restricted to non-commercial use", () => {
    // The one licence line here that is a *paraphrase* rather than a licence
    // name, and it shipped wrong: KFQC reserves commercial *printing*, while
    // non-commercial-only is the Libyan Endowments edition's term for an edition
    // Hifth does not vendor. Overstating someone else's terms fails silently —
    // it reads as caution, so no reader files a bug. This pins the negative.
    render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const row = screen.getByText(/KFGQPC/).closest("li");
    expect(row).not.toBeNull();
    expect(row!.textContent).not.toMatch(/غير التجاري/);
    expect(row!.textContent).toMatch(/الطبع التجاري محفوظ للمجمع/);
  });

  it("is a modal dialog that Escape closes", () => {
    const onClose = vi.fn();
    render(<Colophon open onClose={onClose} fisheye onToggleFisheye={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "عن حِفظ" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("is where the tips are asked for, since they no longer open by themselves", () => {
    const onShowTips = vi.fn();
    render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} onShowTips={onShowTips} />);
    fireEvent.click(screen.getByRole("button", { name: "عرض الإرشادات" }));
    expect(onShowTips).toHaveBeenCalledOnce();
  });
});

describe("what a card does at the page's edge, in settings", () => {
  it("offers the three ways, today's checked, and keeps the one picked", () => {
    localStorage.removeItem(CARD_EDGE_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} spread />);
    const way = (c: string) => container.querySelector(`[data-card-edge="${c}"]`)!;
    expect(way("turns")).toHaveAttribute("aria-checked", "true");
    expect(way("clear")).toHaveAttribute("aria-checked", "false");
    expect(way("covers")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("covers"));
    expect(way("covers")).toHaveAttribute("aria-checked", "true");
    expect(way("turns")).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem(CARD_EDGE_KEY)).toBe("covers");
    localStorage.removeItem(CARD_EDGE_KEY);
  });

  it("is not offered on a screen too narrow for two pages, where there is no facing page to cover", () => {
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    expect(container.querySelector("[data-card-edge]")).toBeNull();
    expect(container.querySelector("#colophon-card-edge")).toBeNull();
  });
});

describe("how two look-alikes that share words in several places are compared, in settings", () => {
  it("offers both ways, every stretch marked checked, and keeps the one picked", () => {
    localStorage.removeItem(LOOKALIKE_COMPARE_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-lookalike-compare="${c}"]`)!;
    expect(way("every")).toHaveAttribute("aria-checked", "true");
    expect(way("plain")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("plain"));
    expect(way("plain")).toHaveAttribute("aria-checked", "true");
    expect(way("every")).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem(LOOKALIKE_COMPARE_KEY)).toBe("plain");
    localStorage.removeItem(LOOKALIKE_COMPARE_KEY);
  });
});

describe("what a look-alike list does with a passage and a verse inside it, in settings", () => {
  it("offers all three ways, the verse under its passage first and checked, and keeps the one picked", () => {
    // The owner's pick, 2026-10-12: the verse sits under its passage by default.
    localStorage.removeItem(PASSAGE_ROWS_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-passage-rows="${c}"]`)!;
    const order = [...container.querySelectorAll("[data-passage-rows]")].map((b) => b.getAttribute("data-passage-rows"));
    expect(order).toEqual(["group", "both", "drop"]);
    expect(way("group")).toHaveAttribute("aria-checked", "true");
    expect(way("both")).toHaveAttribute("aria-checked", "false");
    expect(way("drop")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("both"));
    expect(way("both")).toHaveAttribute("aria-checked", "true");
    expect(way("group")).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem(PASSAGE_ROWS_KEY)).toBe("both");
    localStorage.removeItem(PASSAGE_ROWS_KEY);
  });
});

describe("how far a bookmark's ribbon hangs, in settings", () => {
  it("offers short and long, short checked, and keeps the one picked", () => {
    localStorage.removeItem(RIBBON_LENGTH_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-ribbon-length="${c}"]`)!;
    expect(way("short")).toHaveAttribute("aria-checked", "true");
    expect(way("long")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("long"));
    expect(way("long")).toHaveAttribute("aria-checked", "true");
    expect(way("short")).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem(RIBBON_LENGTH_KEY)).toBe("long");
    localStorage.removeItem(RIBBON_LENGTH_KEY);
  });
});

describe("what the page does when the reader turns away from a recitation, in settings", () => {
  it("offers staying and going back, staying checked, and keeps the one picked", () => {
    localStorage.removeItem(RUN_FOLLOW_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-run-follow="${c}"]`)!;
    expect(way("stay")).toHaveAttribute("aria-checked", "true");
    expect(way("back")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("back"));
    expect(way("back")).toHaveAttribute("aria-checked", "true");
    expect(way("stay")).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem(RUN_FOLLOW_KEY)).toBe("back");
    localStorage.removeItem(RUN_FOLLOW_KEY);
  });
});

describe("how a recitation makes its next verse ready, in settings", () => {
  it("offers keeping it, asking early and off, keeping it checked, and keeps the one picked", () => {
    localStorage.removeItem(RUN_AHEAD_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-run-ahead="${c}"]`)!;
    expect(way("hold")).toHaveAttribute("aria-checked", "true");
    expect(way("ask")).toHaveAttribute("aria-checked", "false");
    expect(way("off")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("ask"));
    expect(way("ask")).toHaveAttribute("aria-checked", "true");
    expect(way("hold")).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem(RUN_AHEAD_KEY)).toBe("ask");
    localStorage.removeItem(RUN_AHEAD_KEY);
  });
});

describe("what a closed look-alike row shows of the shared words, in settings", () => {
  it("offers the picture, the count and nothing, the picture checked, and keeps the one picked", () => {
    localStorage.removeItem(LOOKALIKE_PREVIEW_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-lookalike-preview="${c}"]`)!;
    expect(way("picture")).toHaveAttribute("aria-checked", "true");
    expect(way("count")).toHaveAttribute("aria-checked", "false");
    expect(way("none")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("count"));
    expect(way("count")).toHaveAttribute("aria-checked", "true");
    expect(way("picture")).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem(LOOKALIKE_PREVIEW_KEY)).toBe("count");
    localStorage.removeItem(LOOKALIKE_PREVIEW_KEY);
  });
});

describe("provenance", () => {
  it("links a real commit at its own tree", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    expect(isCommit(sha)).toBe(true);
    expect(urlFor(sha)).toBe(`${SOURCE_REPO}/tree/${sha}`);
  });

  it("falls back to the repository when there is no commit to name", () => {
    // A dev server corresponds to a working tree; there is no tree to link.
    expect(isCommit("dev")).toBe(false);
    expect(urlFor("dev")).toBe(SOURCE_REPO);
  });

  it("links the release's tag in the public copy once there is one", () => {
    // When this repo goes private, the offer moves to a copy holding one commit per
    // release, tagged release-<first 12 of the commit>. scripts/source-offer-url.test.mjs
    // pins the same written-out tag for the script that makes it.
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const copy = "https://example.com/made-up/source-copy";
    expect(urlFor(sha, copy)).toBe(`${copy}/tree/release-0123456789ab`);
    expect(urlFor("dev", copy)).toBe(copy);
  });

  it("keeps the switch to the public copy off until that copy exists", () => {
    // Turning it on before the copy holds the live release would hand readers a dead link.
    expect(SOURCE_COPY).toBe("");
    expect(SOURCE_HOME).toBe(SOURCE_REPO);
  });
});

describe("where a passage row's arrow lands, in settings", () => {
  it("offers both, the most-alike verse checked, and keeps the one picked", () => {
    localStorage.removeItem(PASSAGE_HOP_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-passage-hop="${c}"]`)!;
    expect(way("alike")).toHaveAttribute("aria-checked", "true");
    expect(way("first")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("first"));
    expect(way("first")).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(PASSAGE_HOP_KEY)).toBe("first");
    localStorage.removeItem(PASSAGE_HOP_KEY);
  });
});

describe("which way the look-alike arrows point, in settings", () => {
  it("offers both, the book's way checked, and keeps the one picked", () => {
    localStorage.removeItem(LOOKALIKE_ARROWS_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-lookalike-arrows="${c}"]`)!;
    expect(way("book")).toHaveAttribute("aria-checked", "true");
    expect(way("reading")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("reading"));
    expect(way("reading")).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(LOOKALIKE_ARROWS_KEY)).toBe("reading");
    localStorage.removeItem(LOOKALIKE_ARROWS_KEY);
  });
});

describe("where a turn lands on a page bigger than the screen, in settings", () => {
  it("offers both, the top checked, and keeps the one picked", () => {
    localStorage.removeItem(TURN_LANDING_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-turn-landing="${c}"]`)!;
    expect(way("top")).toHaveAttribute("aria-checked", "true");
    expect(way("same")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("same"));
    expect(way("same")).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(TURN_LANDING_KEY)).toBe("same");
    localStorage.removeItem(TURN_LANDING_KEY);
  });
});

describe("how big a verse's page opens, in settings", () => {
  it("offers both, a little closer checked, and keeps the one picked", () => {
    localStorage.removeItem(OPEN_SIZE_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-open-size="${c}"]`)!;
    expect(way("closer")).toHaveAttribute("aria-checked", "true");
    expect(way("whole")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("whole"));
    expect(way("whole")).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(OPEN_SIZE_KEY)).toBe("whole");
    localStorage.removeItem(OPEN_SIZE_KEY);
  });
});

describe("how big the page is when the iPad comes back upright, in settings", () => {
  it("offers both, its opening size checked, and keeps the one picked", () => {
    localStorage.removeItem(UPRIGHT_AGAIN_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-upright-again="${c}"]`)!;
    expect(way("opening")).toHaveAttribute("aria-checked", "true");
    expect(way("whole")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("whole"));
    expect(way("whole")).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(UPRIGHT_AGAIN_KEY)).toBe("whole");
    localStorage.removeItem(UPRIGHT_AGAIN_KEY);
  });
});

describe("what zooming in keeps on the screen, in settings", () => {
  it("offers both, the line starts checked, and keeps the one picked", () => {
    localStorage.removeItem(ZOOM_ACROSS_KEY);
    const { container } = render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    const way = (c: string) => container.querySelector(`[data-zoom-across="${c}"]`)!;
    expect(way("starts")).toHaveAttribute("aria-checked", "true");
    expect(way("fold")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(way("fold"));
    expect(way("fold")).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(ZOOM_ACROSS_KEY)).toBe("fold");
    localStorage.removeItem(ZOOM_ACROSS_KEY);
  });
});

describe("report a problem, in the info panel", () => {
  it("puts the report's own heading one level under its section's", () => {
    const AR = stringsFor("ar");
    render(<Colophon open onClose={() => {}} fisheye onToggleFisheye={() => {}} />);
    expect(screen.getByRole("heading", { name: AR.reportSectionTitle, level: 3 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: AR.reportOpen }));
    expect(screen.getByRole("heading", { name: AR.reportTitle, level: 4 })).toBeTruthy();
  });
});
