import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { RootFamily, RootHop } from "@hifth/core";
import { RootLens, RootLensTrigger } from "./RootLens";

const hop = (
  surah: number,
  ayah: number,
  dPage: number,
  extra: Partial<RootHop> = {},
): RootHop => ({
  key: `quran/hafs-kfqc/${surah}:${ayah}`,
  surah,
  ayah,
  page: 7 + dPage,
  dPage,
  dSurah: surah - 2,
  sameJuz: dPage === 0,
  count: 1,
  lemmas: [],
  ...extra,
});

/** ن ع م: one same-page occurrence. ذ ك ر: two lemmas across three pages. */
const FAMILIES: RootFamily[] = [
  {
    root: "ن ع م",
    here: 1,
    ayahs: 2,
    words: 2,
    hops: [hop(2, 47, 0)],
    truncated: false,
    lemmas: [],
  },
  {
    root: "ذ ك ر",
    here: 1,
    ayahs: 3,
    words: 6,
    hops: [
      hop(2, 122, 12, { lemmas: ["ذَكَرَ"] }),
      hop(14, 5, -3, { lemmas: ["ذِكْر"] }),
    ],
    truncated: true,
    lemmas: [
      { lemma: "ذَكَرَ", hops: [hop(2, 122, 12, { lemmas: ["ذَكَرَ"] })] },
      { lemma: "ذِكْر", hops: [hop(14, 5, -3, { lemmas: ["ذِكْر"] })] },
    ],
  },
];

const noop = () => {};
const always = () => true;

describe("RootLens", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RootLens families={null} canHop={always} onHop={noop} onClose={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is a modal dialog that takes focus on open", () => {
    render(<RootLens families={FAMILIES} canHop={always} onHop={noop} onClose={noop} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("lists the families in the order given and opens the nearest one", () => {
    render(<RootLens families={FAMILIES} canHop={always} onHop={noop} onClose={noop} />);
    const heads = screen.getAllByRole("button", { expanded: false });
    expect(screen.getByText("ن ع م")).toBeInTheDocument();
    // The first (nearest) family is expanded; the other one is not.
    expect(heads.map((h) => h.textContent)).toEqual([expect.stringContaining("ذ ك ر")]);
    expect(screen.getByText("نفس الصفحة")).toBeInTheDocument();
  });

  it("says page distance the way a hafiz does, in both directions", () => {
    render(<RootLens families={FAMILIES} canHop={always} onHop={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("١٢ صفحة بعد")).toBeInTheDocument();
    expect(screen.getByText("٣ صفحات قبل")).toBeInTheDocument();
  });

  it("sub-groups by lemma and flags a truncated family", () => {
    render(<RootLens families={FAMILIES} canHop={always} onHop={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("heading", { name: "ذَكَرَ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ذِكْر" })).toBeInTheDocument();
    expect(screen.getByText(/أقرب ٢ مواضع فقط/)).toBeInTheDocument();
  });

  it("hops to an occurrence, and disables one whose page is not vendored", () => {
    const onHop = vi.fn();
    render(
      <RootLens
        families={FAMILIES}
        canHop={(key) => key !== "quran/hafs-kfqc/14:5"}
        onHop={onHop}
        onClose={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText(/انتقل إلى البقرة · ٢:٤٧/));
    expect(onHop).toHaveBeenCalledWith(expect.objectContaining({ key: "quran/hafs-kfqc/2:47" }));

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByLabelText(/انتقل إلى إبراهيم · ١٤:٥/)).toBeDisabled();
    expect(screen.getByText(/غير متوفّرة بعد/)).toBeInTheDocument();
  });

  it("closes on Escape and on the close button", () => {
    const onClose = vi.fn();
    render(<RootLens families={FAMILIES} canHop={always} onHop={noop} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByLabelText("إغلاق"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("credits the corpus and links to it (required by its terms of use)", () => {
    render(<RootLens families={FAMILIES} canHop={always} onHop={noop} onClose={noop} />);
    expect(screen.getByRole("link", { name: "Quranic Arabic Corpus" })).toHaveAttribute(
      "href",
      "http://corpus.quran.com",
    );
  });

  it("says so when the ayah has no known roots, and waits quietly while loading", () => {
    const { rerender } = render(
      <RootLens families={[]} loading canHop={always} onHop={noop} onClose={noop} />,
    );
    expect(screen.getByText("…")).toBeInTheDocument();
    rerender(<RootLens families={[]} canHop={always} onHop={noop} onClose={noop} />);
    expect(screen.getByText("لا جذور معروفة لهذه الآية")).toBeInTheDocument();
  });
});

describe("RootLensTrigger", () => {
  it("hides itself when the selection carries no roots", () => {
    const { container } = render(
      <RootLensTrigger count={0} open={false} onToggle={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the root count in Arabic-Indic digits and reports its state", () => {
    const onToggle = vi.fn();
    render(<RootLensTrigger count={5} open onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: "الجذور · ٥" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalled();
  });
});
