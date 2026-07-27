import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Colophon } from "./Colophon";
import { SOURCE_REPO, isCommit, sourceUrl, urlFor } from "../provenance";

/*
 * The colophon is the app's licence compliance, so these tests assert
 * obligations rather than markup: the GPL §6 offer resolves to a real place,
 * and the four sources whose licences ask to be named are named with their
 * links intact. A rendering detail may change freely; a missing credit is a
 * licence breach.
 */

describe("Colophon", () => {
  it("renders nothing until it is opened", () => {
    const { container } = render(<Colophon open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the source for this build, not a branch", () => {
    render(<Colophon open onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /الشيفرة المصدرية/ });
    // Under vitest there is no `define`, so this is the "dev" fallback — the
    // repository root. `urlFor` covers the shape the deployed build ships.
    expect(link).toHaveAttribute("href", sourceUrl());
    expect(link.getAttribute("href")).toContain(SOURCE_REPO);
  });

  it("credits every source whose licence asks to be named", () => {
    render(<Colophon open onClose={() => {}} />);
    // The Quranic Arabic Corpus requires the link, verbatim: "a link is made to
    // http://corpus.quran.com". quran-tajweed is CC BY 4.0. The mutashabihat
    // data asks for a mention in the app itself. KFGQPC is the mushaf.
    for (const href of [
      "http://corpus.quran.com",
      "https://github.com/cpfair/quran-tajweed",
      "https://github.com/Waqar144/Quran_Mutashabihat_Data",
      "https://github.com/quranpedia/quran-svg",
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

  it("does not claim the mushaf artwork is restricted to non-commercial use", () => {
    // The one licence line here that is a *paraphrase* rather than a licence
    // name, and it shipped wrong: KFQC reserves commercial *printing*, while
    // non-commercial-only is the Libyan Endowments edition's term for an edition
    // Hifth does not vendor. Overstating someone else's terms fails silently —
    // it reads as caution, so no reader files a bug. This pins the negative.
    render(<Colophon open onClose={() => {}} />);
    const row = screen.getByText(/KFGQPC/).closest("li");
    expect(row).not.toBeNull();
    expect(row!.textContent).not.toMatch(/غير التجاري/);
    expect(row!.textContent).toMatch(/الطبع التجاري محفوظ للمجمع/);
  });

  it("is a modal dialog that Escape closes", () => {
    const onClose = vi.fn();
    render(<Colophon open onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "عن حِفظ" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
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
});
