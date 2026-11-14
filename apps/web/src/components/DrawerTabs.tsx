import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import type { DrawerTab } from "../drawer-tools";
import { useT } from "../i18n";
import styles from "./DrawerTabs.module.css";

export interface DrawerTabItem {
  key: DrawerTab;
  /** The tool's name, as its tab reads. */
  name: string;
  content: ReactNode;
}

export interface DrawerTabsProps {
  /** The tools open in the drawer, in the order their tabs stand. */
  tabs: readonly DrawerTabItem[];
  /** The tab in front. */
  front: DrawerTab;
  onPick: (key: DrawerTab) => void;
  onClose: (key: DrawerTab) => void;
}

/**
 * The verse's tools as tabs inside its drawer (selection-drawer ③, its second
 * shape). Each tool opened stays open, its contents kept as they were, so a
 * reader who goes from Same roots to Share and back finds the roots list where
 * they left it, scrolled as they left it. Only the tab in front shows; the
 * others are hidden from sight and from a screen reader until picked.
 */
export function DrawerTabs({ tabs, front, onPick, onClose }: DrawerTabsProps): JSX.Element {
  const { t, dir } = useT();
  const id = useId();
  // Each tab keeps its own scroll place: noted as the reader scrolls, and put
  // back when the tab comes forward (a hidden box does not keep it everywhere).
  const scrolled = useRef(new Map<DrawerTab, number>());
  const panels = useRef(new Map<DrawerTab, HTMLDivElement>());
  useLayoutEffect(() => {
    const box = panels.current.get(front);
    const at = scrolled.current.get(front);
    if (box && at !== undefined) box.scrollTop = at;
  }, [front]);
  return (
    <>
      <div className={styles.strip} role="tablist" aria-label={t.drawerTabsLabel} dir={dir}>
        {tabs.map((tab) => (
          <span key={tab.key} className={styles.item} data-front={tab.key === front || undefined}>
            <button
              type="button"
              role="tab"
              id={`${id}-${tab.key}-tab`}
              aria-controls={`${id}-${tab.key}`}
              aria-selected={tab.key === front}
              tabIndex={tab.key === front ? 0 : -1}
              className={styles.tab}
              onClick={() => onPick(tab.key)}
            >
              {tab.name}
            </button>
            <button type="button" className={styles.close} aria-label={t.closeTab(tab.name)} onClick={() => onClose(tab.key)}>
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          ref={(el) => {
            if (el) panels.current.set(tab.key, el);
            else panels.current.delete(tab.key);
          }}
          role="tabpanel"
          id={`${id}-${tab.key}`}
          aria-labelledby={`${id}-${tab.key}-tab`}
          hidden={tab.key !== front}
          className={styles.panel}
          onScroll={(e) => scrolled.current.set(tab.key, e.currentTarget.scrollTop)}
        >
          {tab.content}
        </div>
      ))}
    </>
  );
}
