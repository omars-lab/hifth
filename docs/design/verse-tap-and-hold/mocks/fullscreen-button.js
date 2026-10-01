// Option B: a full-screen button. The top bar is full on a phone (its six
// buttons reach the right edge), so it sits in the hint line at the bottom,
// beside the round button already there.
(() => {
  const model = document.querySelector("footer button");
  const b = model.cloneNode(true);
  b.setAttribute("aria-label", "Full screen");
  b.textContent = "⤢";
  b.style.font = "22px/1 system-ui";
  b.style.outline = "3px solid #e0a030";
  b.style.outlineOffset = "2px";
  b.style.marginInlineEnd = "8px";
  model.parentElement.insertBefore(b, model);
  return model.parentElement.querySelectorAll("button").length;
})();
