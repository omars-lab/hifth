import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Edge, TafsirEntry, TafsirSource } from "@hifth/core";
import { CommentaryLens, CommentaryLensTrigger } from "./CommentaryLens";

const noop = () => {};
const always = () => true;

const SOURCE: TafsirSource = {
  id: "study-quran",
  label: "The Study Quran",
  license: "private",
  edition: "hafs-kfqc",
};

const ENTRY: TafsirEntry = {
  key: "tafsir/study-quran/2:38",
  translation: "And We said: Get down from here, all of you.",
  commentary: [
    { text: "A faithful note.", lemma: [38, 39] },
    { text: "A recovered note.", channel: "ocr", lemma: [38, 38] },
  ],
  refs: ["quran/hafs-kfqc/2:53"],
};

const EDGES: Edge[] = [
  {
    type: "tafsir-ref",
    to: "quran/hafs-kfqc/2:53",
    page: 9,
    dir: { dSurah: 0, dPage: 2 },
  },
];

describe("CommentaryLens", () => {
  it("renders nothing when there is no entry", () => {
    const { container } = render(
      <CommentaryLens entry={null} source={SOURCE} edges={[]} canHop={always} onHop={noop} onClose={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is a modal dialog that takes focus on open", () => {
    render(
      <CommentaryLens entry={ENTRY} source={SOURCE} edges={EDGES} canHop={always} onHop={noop} onClose={noop} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("shows the source, the translation, and each commentary run", () => {
    render(
      <CommentaryLens entry={ENTRY} source={SOURCE} edges={EDGES} canHop={always} onHop={noop} onClose={noop} />,
    );
    expect(screen.getByText(/The Study Quran/)).toBeInTheDocument();
    expect(screen.getByText(/Get down from here/)).toBeInTheDocument();
    expect(screen.getByText("A faithful note.")).toBeInTheDocument();
    expect(screen.getByText("A recovered note.")).toBeInTheDocument();
  });

  it("marks an OCR-recovered run and labels the lemma span (Arabic default UI)", () => {
    render(
      <CommentaryLens entry={ENTRY} source={SOURCE} edges={EDGES} canHop={always} onHop={noop} onClose={noop} />,
    );
    expect(screen.getByText("مُستعادة")).toBeInTheDocument(); // the OCR badge
    expect(screen.getByText("الآيات ٣٨–٣٩")).toBeInTheDocument(); // a range
    expect(screen.getByText("الآية ٣٨")).toBeInTheDocument(); // a single ayah
  });

  it("lists refs as leap rows and hops on click", () => {
    const onHop = vi.fn();
    render(
      <CommentaryLens entry={ENTRY} source={SOURCE} edges={EDGES} canHop={always} onHop={onHop} onClose={noop} />,
    );
    expect(screen.getByText("إحالات")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /٢:٥٣/ }));
    expect(onHop).toHaveBeenCalledWith(EDGES[0]);
  });

  it("disables the leap for an unvendored ref", () => {
    render(
      <CommentaryLens entry={ENTRY} source={SOURCE} edges={EDGES} canHop={() => false} onHop={noop} onClose={noop} />,
    );
    expect(screen.getByRole("button", { name: /٢:٥٣/ })).toBeDisabled();
  });

  it("shows an empty note only when there is nothing at all", () => {
    render(
      <CommentaryLens
        entry={{ key: "tafsir/study-quran/2:1", refs: [] }}
        source={SOURCE}
        edges={[]}
        canHop={always}
        onHop={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText("لا تفسير لهذه الآية")).toBeInTheDocument();
  });
});

describe("CommentaryLensTrigger", () => {
  it("hides when the ayah has no entry, shows when it does", () => {
    const { rerender, container } = render(
      <CommentaryLensTrigger present={false} open={false} onToggle={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<CommentaryLensTrigger present open={false} onToggle={noop} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles on click", () => {
    const onToggle = vi.fn();
    render(<CommentaryLensTrigger present open={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
