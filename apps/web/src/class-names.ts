/**
 * The class name the build gives each rule in a component's style file
 * (`Sheet.module.css`'s `.grip` becomes `_grip_1as2g`). Used by vite.config.ts.
 *
 * The default added the line number the rule sat on (`_grip_1as2g_98`). The
 * hash of the file already keeps two files' names apart, so the line number was
 * only bytes: about 1,600 names in the start-up download carry one, in the
 * script and in the style sheet. See trims.md, "Trimmed 2026-11-19".
 *
 * The readable part stays first, because the browser tests find elements by it
 * (`[class*='foldFlap']`). The hash is of the file's text, not its path, so a
 * build in any checkout gives the same names.
 *
 * With the line number gone, only the hash keeps two files apart. So each
 * namer remembers which file every name came from, and refuses a name that a
 * second file would also get, rather than let two components share styles.
 */
export function classNamer(): (name: string, file: string, css: string) => string {
  const owner = new Map<string, string>();
  return (name, file, css) => {
    const out = `_${name}_${hashOf(css)}`;
    const had = owner.get(out);
    if (had !== undefined && had !== file) {
      throw new Error(`Two style files would both get the class ${out}: ${had} and ${file}. Change one of them a little.`);
    }
    owner.set(out, file);
    return out;
  };
}

/** The same string hash the default used (string-hash: djb2 with xor), in base 36, five letters. */
function hashOf(css: string): string {
  let hash = 5381;
  for (let i = css.length - 1; i >= 0; i--) hash = (hash * 33) ^ css.charCodeAt(i);
  return (hash >>> 0).toString(36).padStart(5, "0").slice(0, 5);
}
