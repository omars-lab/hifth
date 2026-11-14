import { useCallback, useState } from "react";
import { isNative } from "../native-bridge";
import { ADDRESSES_KEY, LATER_KEY, addressesFor, sheetOn, sheetShows, type Addresses } from "../moved";
import { Later, MovedCard } from "./later";
import type { MovedCardProps } from "./MovedCard";

export function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function store(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to keep it in: the sheet simply asks again next time.
  }
}

/**
 * Whether the card that carries marks to the new address shows (moved.ts says
 * the whole of it), and the card itself when it does.
 *
 * Only this decision is in the first download. The card (./MovedCard.tsx) is
 * fetched only by a reader it is shown to, at the old address, in a browser,
 * once the switch is on: everyone else never needs it (docs/performance.md,
 * item 21).
 */
export function MovedSheet(props: Omit<MovedCardProps, "addresses" | "onHide">): JSX.Element | null {
  const [addresses] = useState<Addresses>(() => addressesFor(window.location.protocol, stored(ADDRESSES_KEY)));
  const [shown, setShown] = useState(() =>
    sheetShows({
      on: sheetOn(addresses),
      native: isNative(),
      origin: window.location.origin,
      laterAt: Number(stored(LATER_KEY)) || null,
      now: Date.now(),
      addresses,
    }),
  );
  const hide = useCallback(() => setShown(false), []);
  if (!shown) return null;
  return (
    <Later>
      <MovedCard {...props} addresses={addresses} onHide={hide} />
    </Later>
  );
}
