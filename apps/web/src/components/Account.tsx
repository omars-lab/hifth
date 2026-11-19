import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useT, type Strings } from "../i18n";
import { askApp } from "../ask-app";
import { accountState, deleteAccount, forgetInvite, inviteKept, signIn, signOut, type AccountState } from "../account";
import styles from "./Account.module.css";

/**
 * The account section of the info panel (sign-in step 16,
 * docs/design/sign-in.md).
 *
 * The app is the one that knows whether anyone is signed in, so this asks it
 * when the section is drawn and again after every press, and draws only what
 * it answered. Until it answers, and wherever sign-in is not offered (a
 * browser, a store build before hifth.app switches sign-in on), it draws
 * nothing at all.
 *
 * The reader decides who sees their data. So the sentence saying what leaves
 * the device and who sees it sits right above the sign-in button, a signed-in
 * reader sees what hifth.app keeps with "sign out" and "delete my account"
 * beside it, and deleting asks once more inside the section, saying what goes
 * and what stays.
 *
 * An invite code a tester types is read from the box and the box emptied in
 * the same breath: it is handed to the app and kept in no state, no storage
 * and no message here.
 */

type Ask = typeof askApp;
type Line = keyof Pick<
  Strings,
  | "accountInviteRefused"
  | "accountTooMany"
  | "accountOffline"
  | "accountFailed"
  | "accountSignOutFailed"
  | "accountDeletedCut"
  | "accountDeletedLeft"
  | "accountDeleteSignedOut"
  | "accountDeleteOffline"
  | "accountDeleteFailed"
>;

export function Account({
  ask = askApp,
  sectionClass,
  headingClass,
}: {
  ask?: Ask;
  sectionClass?: string | undefined;
  headingClass?: string | undefined;
}): JSX.Element | null {
  const { t } = useT();
  const [state, setState] = useState<AccountState | null>(null);
  const [kept, setKept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wantsCode, setWantsCode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [line, setLine] = useState<Line | null>(null);
  const box = useRef<HTMLInputElement | null>(null);
  const shown = useRef(true);
  const id = useId();

  const look = useCallback(async () => {
    const now = await accountState(ask);
    const keeps = now === "off" ? false : await inviteKept(ask);
    if (!shown.current) return;
    setState(now);
    setKept(keeps);
  }, [ask]);

  useEffect(() => {
    shown.current = true;
    void look();
    return () => {
      shown.current = false;
    };
  }, [look]);

  /** One press at a time; afterwards the app is asked again what it holds. */
  const press = (work: () => Promise<Line | null>) => {
    if (busy) return;
    setBusy(true);
    setLine(null);
    void (async () => {
      let said: Line | null = null;
      try {
        said = await work();
      } finally {
        await look();
        if (shown.current) {
          setLine(said);
          setBusy(false);
        }
      }
    })();
  };

  const onSignIn = () => {
    // Read the box and empty it at once, so the code is nowhere on the page
    // while the app is asked, whatever the app then answers.
    const typed = box.current?.value ?? "";
    if (box.current) box.current.value = "";
    press(async () => {
      switch (await signIn(typed, ask)) {
        case "signed-in":
          setWantsCode(false);
          return null;
        case "invite":
          setWantsCode(true);
          return null;
        case "invite-refused":
          setWantsCode(true);
          return "accountInviteRefused";
        case "too-many":
          return "accountTooMany";
        case "offline":
          return "accountOffline";
        case "failed":
          return "accountFailed";
        default:
          return null;
      }
    });
  };

  const onSignOut = () => press(async () => ((await signOut(ask)) ? null : "accountSignOutFailed"));

  const onDelete = () => {
    setConfirming(false);
    press(async () => {
      switch (await deleteAccount(ask)) {
        case "deleted-cut":
          return "accountDeletedCut";
        case "deleted-left":
          return "accountDeletedLeft";
        case "signed-out":
          return "accountDeleteSignedOut";
        case "offline":
          return "accountDeleteOffline";
        default:
          return "accountDeleteFailed";
      }
    });
  };

  const onForget = () =>
    press(async () => {
      await forgetInvite(ask);
      return null;
    });

  if (state === null) return null;
  // A reader who just deleted their account is told so even where sign-in is
  // then no longer offered.
  if (state === "off" && line === null) return null;

  const leaves = `${id}-leaves`;

  return (
    <section className={sectionClass} aria-labelledby={`${id}-title`} data-account={state}>
      <h3 className={headingClass} id={`${id}-title`}>
        {t.accountTitle}
      </h3>
      <div className={styles.account}>
        {state === "signed-out" && (
          <>
            <p className={styles.body}>{t.accountOptional}</p>
            <p className={styles.body} id={leaves}>
              {t.accountLeaves}
            </p>
            {wantsCode && (
              <label className={styles.code}>
                <span className={styles.codeLabel}>{t.accountInviteLabel}</span>
                <span className={styles.body}>{t.accountInviteHelp}</span>
                <input
                  ref={(el) => {
                    box.current = el;
                    // Written as the attribute itself: a code must never reach a
                    // spelling service, and Preact drops the attribute where a
                    // browser has no spellcheck property to set.
                    el?.setAttribute("spellcheck", "false");
                  }}
                  className={styles.box}
                  type="text"
                  dir="ltr"
                  aria-label={t.accountInviteLabel}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  disabled={busy}
                />
              </label>
            )}
            <div className={styles.actions}>
              <AppleSignInButton title={t.accountSignIn} describedBy={leaves} disabled={busy} onPress={onSignIn} />
            </div>
          </>
        )}

        {state === "signed-in" && (
          <>
            <p className={styles.signedIn}>{t.accountSignedIn}</p>
            <p className={styles.body}>{t.accountHeld}</p>
            {confirming ? (
              <div className={styles.confirm}>
                <p className={styles.ask}>{t.accountDeleteAsk}</p>
                <div className={styles.actions}>
                  <button type="button" className={styles.danger} disabled={busy} onClick={onDelete}>
                    {t.accountDeleteYes}
                  </button>
                  <button type="button" className={styles.quiet} disabled={busy} onClick={() => setConfirming(false)}>
                    {t.accountDeleteNo}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <button type="button" className={styles.quiet} disabled={busy} onClick={onSignOut}>
                  {t.accountSignOut}
                </button>
                <button
                  type="button"
                  className={styles.quiet}
                  disabled={busy}
                  onClick={() => {
                    setLine(null);
                    setConfirming(true);
                  }}
                >
                  {t.accountDelete}
                </button>
              </div>
            )}
          </>
        )}

        {line !== null && (
          <p className={styles.line} role="status">
            {t[line]}
          </p>
        )}

        {kept && state !== "off" && (
          <div className={styles.kept}>
            <p className={styles.body}>{t.accountInviteKept}</p>
            <button type="button" className={styles.quiet} disabled={busy} onClick={onForget}>
              {t.accountForgetInvite}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The button that opens Apple's own sign-in panel. Apple's rules for a button
 * an app draws itself (Human Interface Guidelines, "Sign in with Apple", read
 * 2026-11-18): the title is one of Apple's three, here "Sign in with Apple" in
 * Apple's own wording for each language; black or white only; rectangular; at
 * least 140 by 30 points. It carries no logo: Apple allows only its own logo
 * artwork, never one we draw, and that artwork is not in this repo (an owner
 * question on the sign-in page). It is its own piece so it can be swapped for
 * one that carries the artwork.
 */
export function AppleSignInButton({
  title,
  describedBy,
  disabled,
  onPress,
}: {
  title: string;
  describedBy: string;
  disabled: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <button type="button" className={styles.apple} aria-describedby={describedBy} disabled={disabled} onClick={onPress}>
      {title}
    </button>
  );
}
