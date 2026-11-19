/**
 * What a screen reader finds on a page drawing.
 *
 * A page drawing has two parts that are pictures and nothing more: the
 * verse-number rings with their numbers, and the lettering. Left as they are,
 * the iPad's screen reader announces each piece as a nameless picture (Apple's
 * accessibility check counted 23 on page 7, most too small to touch). The
 * verses are named by the verse outlines the highlighter turns into buttons,
 * and those sit beside these groups, not inside them, so hiding the groups
 * hides nothing a reader can use.
 */
export function hideDrawingFromReaders(svg: SVGSVGElement): void {
  for (const part of svg.querySelectorAll("#ayah_markers, #content")) {
    part.setAttribute("aria-hidden", "true");
  }
}
