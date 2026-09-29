import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getTafsirProvider, listTafsirProviders, unregisterTafsirProvider } from "@hifth/core";
import { TafsirImport } from "./TafsirImport";

const noop = () => {};
const noRemove = async () => {};

/** jsdom's File does not implement `.text()` (real browsers do, which is what
 * the component calls), so the test hands the input file-likes that carry it. */
function file(name: string, body: unknown): File {
  return { name, text: async () => JSON.stringify(body) } as unknown as File;
}

/** A minimal on-disk bundle: a manifest naming one surah, and that surah file. */
function bundleFiles(): File[] {
  return [
    file("manifest.json", {
      source: "study-quran",
      license: "private",
      edition: "hafs-kfqc",
      title: "The Study Quran",
      surahs: { "1": { file: "001.json" } },
    }),
    file("001.json", {
      surah: 1,
      entries: [{ key: "quran/hafs-kfqc/1:1", translation: "In the Name of God.", refs: [] }],
    }),
  ];
}

function pick(input: HTMLElement, files: File[]): void {
  // jsdom lets us define a read-only FileList-ish on the input.
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  for (const p of listTafsirProviders()) unregisterTafsirProvider(p.source.id);
});

describe("TafsirImport", () => {
  it("imports a picked folder, registers a provider, and reports success", async () => {
    const onImported = vi.fn();
    render(<TafsirImport onImported={onImported} onRemoved={noop} removeBundle={noRemove} />);
    const input = screen.getByTestId("tafsir-folder-input");

    pick(input, bundleFiles());

    await waitFor(() => expect(onImported).toHaveBeenCalledWith("study-quran"));
    expect(getTafsirProvider("study-quran")?.has(1)).toBe(true);
    // Arabic-default UI: "… مُحمَّل · ١ سورة، ١ مدخلًا"
    expect(await screen.findByText(/مُحمَّل/)).toBeInTheDocument();
  });

  it("reports an error for a folder with no manifest", async () => {
    render(<TafsirImport onImported={noop} onRemoved={noop} removeBundle={noRemove} />);
    const input = screen.getByTestId("tafsir-folder-input");

    pick(input, [file("001.json", {})]);

    expect(await screen.findByText(/تعذّر تحميل/)).toBeInTheDocument();
  });

  it("offers removal when an edition is already loaded and calls back", async () => {
    const removeBundle = vi.fn(async () => {});
    const onRemoved = vi.fn();
    render(
      <TafsirImport
        loaded={{ id: "study-quran", label: "The Study Quran" }}
        onImported={noop}
        onRemoved={onRemoved}
        removeBundle={removeBundle}
      />,
    );
    // The loaded state names the edition and offers a remove button, not a picker.
    expect(screen.getByText(/The Study Quran/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إزالة" }));

    await waitFor(() => expect(removeBundle).toHaveBeenCalledWith("study-quran"));
    expect(onRemoved).toHaveBeenCalledWith("study-quran");
  });
});
