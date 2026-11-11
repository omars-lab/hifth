import type { AppPage } from "../app-pages";
import { useT } from "../i18n";
import styles from "./PageRow.module.css";

/**
 * PageRow — the app's pages as a row of icons along the bottom
 * (docs/design/app-pages.md ①, a setting: see `app-pages.ts`).
 *
 * The lowest thing on the screen, under the page slider, so it is the one that
 * clears the home bar. Each icon carries its name in words: a picture alone is
 * a guess. The page showing is marked for the eye and for a screen reader.
 */
export function PageRow({
  page,
  onPage,
  developer,
}: {
  page: AppPage;
  onPage: (page: AppPage) => void;
  /** Only the laptop's dev server passes this; a real build has no such page. */
  developer?: string | undefined;
}): JSX.Element {
  const { t } = useT();
  const pages: readonly (readonly [AppPage, string, JSX.Element | string])[] = [
    [
      "mushaf",
      t.mushaf,
      <svg key="m" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 6c-2-1.6-5-2-8-1.4v13c3-.6 6-.2 8 1.4 2-1.6 5-2 8-1.4v-13C17 4 14 4.400 12 6zM12 6v13" />
      </svg>,
    ],
    ["settings", t.levelSettings, "⚙"],
    ...(developer ? [["developer", developer, "</>"] as const] : []),
  ];
  return (
    <nav className={styles.row} aria-label={t.appPagesNav}>
      {pages.map(([id, name, glyph]) => (
        <button
          key={id}
          type="button"
          className={styles.icon}
          aria-current={page === id ? "page" : undefined}
          data-app-page={id}
          onClick={() => onPage(id)}
        >
          <span className={styles.glyph} aria-hidden="true">
            {glyph}
          </span>
          <span className={styles.name}>{name}</span>
        </button>
      ))}
    </nav>
  );
}
