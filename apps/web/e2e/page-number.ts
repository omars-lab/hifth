/**
 * The page number in the top bar, read the way a test means it.
 *
 * The bar prints the number in the chrome's own digits — ٩ in Arabic, 9 in
 * English — like the printed page's foot. Most tests only care *which page*
 * the reader is on, not how it is spelled, so they ask for the page and accept
 * either spelling; which spelling each language uses is pinned on its own, in
 * the language tests and the unit test over every label that carries a page.
 */
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

export const PAGE_NUMBER = "header .numeric";

/** Matches exactly page `n`, in Latin or Arabic-Indic digits. */
export function pageNumber(n: number): RegExp {
  const latin = String(n);
  const arabic = latin.replace(/[0-9]/g, (d) => ARABIC[Number(d)]!);
  return new RegExp(`^(?:${latin}|${arabic})$`);
}

/** The page a printed number names, whichever digits it is in. */
export function readPageNumber(text: string | null): number {
  return Number((text ?? "").trim().replace(/[٠-٩]/g, (d) => String(ARABIC.indexOf(d))));
}
