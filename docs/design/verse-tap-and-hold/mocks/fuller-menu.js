// Options A and B: today's verse menu with the four new buttons added.
(() => {
  const listen = [...document.querySelectorAll("button")].find((b) => /Listen/.test(b.textContent));
  const row = listen.parentElement;
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
  return row.children.length;
})();
