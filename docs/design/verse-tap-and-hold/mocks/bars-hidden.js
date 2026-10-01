// Option A after a tap, and option B after its button: the bars are gone.
// With MOCK_WAY_BACK set first, B's small button to bring them back is drawn.
(() => {
  document.querySelectorAll("header, footer, nav").forEach((e) => (e.style.display = "none"));
  if (window.MOCK_WAY_BACK) {
    const b = document.createElement("button");
    b.textContent = "⤡";
    b.setAttribute("aria-label", "Show the bars");
    Object.assign(b.style, {
      position: "fixed", top: "12px", right: "12px", width: "40px", height: "40px",
      borderRadius: "50%", border: "1px solid rgba(0,0,0,.25)", background: "rgba(250,247,240,.92)",
      font: "20px/1 system-ui", color: "#1f5f57", zIndex: 99,
    });
    document.body.appendChild(b);
  }
  return true;
})();
