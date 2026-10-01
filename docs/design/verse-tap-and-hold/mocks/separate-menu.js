// Option C: today's verse menu stays on a tap; a hold opens this second,
// smaller menu beside the verse instead.
(() => {
  const drawer = document.querySelector('section[aria-label^="Tools for"]');
  if (drawer) drawer.style.display = "none";
  const listen = [...drawer.querySelectorAll("button")].find((b) => /Listen/.test(b.textContent));
  const menu = document.createElement("div");
  Object.assign(menu.style, {
    position: "fixed", right: "16px", top: "330px", display: "flex", flexDirection: "column",
    gap: "4px", padding: "8px", borderRadius: "14px", background: "rgba(250,247,240,.98)",
    boxShadow: "0 8px 28px rgba(0,0,0,.25)", border: "1px solid rgba(0,0,0,.12)", zIndex: 99,
  });
  for (const [glyph, caption] of [["⏭", "Play to"], ["✎", "Mark"], ["✍", "Note"], ["⧉", "Copy"]]) {
    const b = listen.cloneNode(true);
    b.removeAttribute("aria-pressed");
    b.children[0].textContent = glyph;
    b.children[1].textContent = caption;
    Object.assign(b.style, { flexDirection: "row", gap: "10px", justifyContent: "flex-start", width: "130px", padding: "8px 10px" });
    menu.appendChild(b);
  }
  document.body.appendChild(menu);
  return menu.children.length;
})();
