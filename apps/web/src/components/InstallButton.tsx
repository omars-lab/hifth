import { useEffect, useState } from "react";
import { onInstallAvailability, promptInstall } from "../pwa";
import styles from "./InstallButton.module.css";

/**
 * Install affordance. Hidden until the browser offers an install prompt (and on
 * iOS, where beforeinstallprompt never fires, this stays hidden — Loop 6 adds
 * the iOS "Add to Home Screen" coach mark instead, per research §5).
 */
export function InstallButton(): JSX.Element | null {
  const [available, setAvailable] = useState(false);
  useEffect(() => onInstallAvailability(setAvailable), []);
  if (!available) return null;
  return (
    <button className={styles.install} onClick={() => void promptInstall()}>
      <span aria-hidden="true">↧</span> ثبّت التطبيق
    </button>
  );
}
