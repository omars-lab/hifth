// Option A: the verse menu, with its four new buttons (Play to, Mark, Note,
// Copy), the moment it appears. Run it BEFORE the finger goes down: it waits
// for the menu and adds the buttons as soon as the menu is put on the page,
// so the recording shows it rising already fuller instead of the buttons
// popping in afterwards. The four buttons are the same edit as the
// tap-and-hold note's fuller-menu script.
(() => {
  const addButtons = () => {
    const listen = [...document.querySelectorAll("button")].find((b) => /Listen/.test(b.textContent));
    if (!listen || listen.parentElement.dataset.fuller) return false;
    const row = listen.parentElement;
    row.dataset.fuller = "1";
    row.style.display = "grid";
    row.style.gridTemplateColumns = "repeat(5, 1fr)";
    row.style.rowGap = "10px";
    for (const [glyph, caption] of [["⏭", "Play to"], ["✎", "Mark"], ["✍", "Note"], ["⧉", "Copy"]]) {
      const b = listen.cloneNode(true);
      b.removeAttribute("aria-pressed");
      b.setAttribute("aria-label", caption);
      b.children[0].textContent = glyph;
      b.children[1].textContent = caption;
      row.appendChild(b);
    }
    return true;
  };
  if (addButtons()) return "added now";
  const watcher = new MutationObserver(() => addButtons() && watcher.disconnect());
  watcher.observe(document.body, { childList: true, subtree: true });
  return "waiting for the menu";
})();
