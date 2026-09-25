# Plan: a tool bar above the page, where picking a tool changes what a tap does

*Plan, written 25 September 2026 at the owner's request: a FigJam-like tool bar above the
Qur'an page, for bookmarking, marking mistakes, adding notes and so on. Clicking a tool changes
what the pointer does, like Figma's comment mode; there are select and crop tools too, and
keyboard shortcuts to switch. Nothing here is built yet. The steps are in the order they pay
off.*

## A few words, defined once

- **Verse** (ayah): one numbered verse of the Qur'an. Tapping one today selects it.
- **Mus'haf**: the printed Qur'an, one page at a time on a phone, two side by side on a
  computer.
- **Tool**: one button on the bar. Exactly one tool is on at a time, and it decides what a tap,
  click or drag on the page does.
- **Stays on / goes back**: after you use a tool once, it either stays on for the next tap, or
  hands back to the select tool by itself.

## Why do this at all?

The page is already doing a lot with one finger. Today a tap selects a verse; pressing and
holding, then dragging, paints a highlight across several verses; holding inside the selected
verse picks a single word; a sideways swipe turns the page; plain dragging moves it; pinching
zooms. Every new thing a reader can do to the page, such as a note or a mistake mark, would
need yet another press-and-hold variant. Nobody finds those without being told, and we just took
the tips off the first screen.

A tool bar turns hidden gestures into buttons you can see. With the note tool on, a plain tap
means "note here". With the highlight tool on, a plain drag paints, with no hold needed first.

It also offers an answer to two questions we are still holding open:

- **How does a reader open the word tools as opposed to the verse tools?** (open decision
  "selection drawer")
- **How does a reader pick the exact vowel mark to note?** (open decision "harakah pick")

With a mistake tool on, a tap has only one meaning, so neither question has to be solved with a
gesture.

## What have we already decided that this has to respect?

- **Notes attach to a letter, a vowel mark or a pause sign**, not only to a whole verse.
- **Every note is a report that syncs**, and a batch of notes leaves the phone as a file.
- **Bookmarks are many ribbons you drop and lift**, kept on the device.
- **A verse's tools open in one drawer**: a sheet from the bottom on a phone, and a panel on the
  opposite page on a computer.
- **The page must never lose room to chrome it does not need.** Two strips stacked above the
  page once took a quarter of a phone screen, and they now take turns.

## What do other people do?

- **Design tools** (Figma, FigJam, Miro, tldraw, Excalidraw) all have one tool on at a time,
  with select as the resting tool, and Escape always goes back to select. Letters switch tools:
  V is select everywhere, and Miro also accepts 1 to 9 by position on the bar.
  - Most tools go back to select after one use.
  - tldraw and Excalidraw let you lock a tool on: double-click it, or press Q.
  - Adobe Acrobat's comment tools work the same way, with a "keep tool selected" pin for
    placing several notes in a row.
  - Links: [tldraw tools](https://tldraw.dev/docs/tools),
    [Miro shortcuts](https://miro.com/shortcuts/),
    [Miro keyboard navigation](https://help.miro.com/hc/en-us/articles/11997028019858-Keyboard-navigation-while-working-on-boards),
    [Acrobat comment tools](https://helpx.adobe.com/sg/acrobat/using/commenting-pdfs.html),
    [FigJam select](https://help.figma.com/hc/en-us/articles/1500004292221-Select-move-and-order-objects-in-FigJam).
- **Note-taking apps on tablets** decide stays-on or goes-back per tool. In GoodNotes the pen
  and highlighter stay on, and other tools go back to the lasso
  ([GoodNotes](https://support.goodnotes.com/hc/en-us/articles/7353718249231-Erasing-handwriting-and-highlighting)).
  FigJam on the iPad makes you tap "Done" to leave a drawing tool
  ([FigJam for iPad](https://help.figma.com/hc/en-us/articles/4502073572247-FigJam-for-iPad)).
  Procreate shows the active tool as a filled icon; tap it again for its options
  ([Procreate](https://help.procreate.com/procreate/handbook/interface-gestures/interface)).
- **Qur'an apps do not use a tool bar.** Quran.com puts notes and bookmarks in a menu on each
  verse ([notes](https://quran.com/en/take-notes)). Hifz trackers flag whole verses. Tarteel
  marks mistakes word by word, in red, tap to see what you said, with a log of past slips
  ([Tarteel](https://support.tarteel.ai/en/articles/12160141-what-do-the-different-text-colours-mean)).
  A tool bar would be new for this kind of app. That is worth saying to the people we pitch it
  to, and it is also a risk.
- **Reading apps** (Apple Books, Kindle) work the other way round: select the words first, then
  a small bar offers highlight or note
  ([Apple Books](https://support.apple.com/guide/ipad/annotate-books-ipade2f8027b/ipados)).
  That is close to what Hifth's verse drawer does today. The tool bar does not replace it; the
  select tool keeps it.
- **Keyboard shortcuts on single letters have rules.** Screen readers already use bare letters
  (H jumps to the next heading, and so on). So the accessibility guidelines require that
  single-letter shortcuts can be turned off, or only work while the page has focus
  ([WCAG 2.1.4](https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts.html)).
  Shortcuts should also follow the key's position, not its letter, so V still works on an
  Arabic keyboard, where that key types a different letter
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code)).
- **Screen reader users need the tool named, not only shown by the pointer's shape.** The
  standard is a tool bar you tab into once, then move along with the arrow keys. The tools act
  like radio buttons, and the active one is announced
  ([toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)).
- **Cropping** in a web page is a drag rectangle over the page, then copying that rectangle into
  an image ([Konva example](https://konvajs.org/docs/sandbox/Canvas_Crop_Image.html)).

## Which tools, and what does each one do?

| tool | key | a tap or click on the page… | a drag… | after one use |
| --- | --- | --- | --- | --- |
| **Select** (resting tool) | V | selects the verse, as today | moves the page, as today | — |
| **Highlight** | H | selects the verse | paints across verses, no hold first | stays on |
| **Bookmark** | B | drops a ribbon on that page | — | goes back |
| **Note** | N | drops a note pin on that verse or word, and opens its box | — | goes back |
| **Mark a mistake** | M | marks that word; a second tap picks the exact sign | — | stays on |
| **Crop** | C | — | draws a box, then offers to share it as an image | goes back |

- **Escape** always returns to select, and so does tapping the active tool again.
- **Double-click (or long-press on a phone)** locks any tool on, as in tldraw.
- The pointer changes shape per tool on a computer: a crosshair for crop, a pin for note. The
  bar always names the active tool too, and a screen reader hears the change.
- The letters work only while the page has focus, and settings can turn them off. They follow
  key position, so they work on an Arabic keyboard.

The two tools that stay on are the ones used in a run. A hafiz checking a page marks several
slips in a row; nobody drops five bookmarks in a row.

## What is the plan?

### 1. The bar, with the tools that already exist underneath (the quick win)

Select, highlight and bookmark are all built already. Only their triggers are hidden: a press
and hold, and a button in the page corner. This step puts them on a bar above the page on a
computer, with the letters, Escape, the named active tool and the pointer shapes. Nothing new
lands on the page, so it is safe, and it shows the idea to the people we pitch it to on the
first try.

### 2. The note tool, like Figma's comment mode

Tap anywhere on the page, and a pin drops at the word under your finger, with a box to type in.
Pins stay on the page afterwards and tapping one reopens it. Notes use the report shape we
already decided on, so they export in the batch file. This is the step that makes the bar pay
for itself, because notes have no way in at all today.

### 3. The mistake tool

Tap a word to mark it. It turns a quiet red, like Tarteel, and is recorded in the revision
record, so the calendar can later show where you slip. A second tap on a marked word opens its
signs so you can pick the exact vowel or letter. This step needs the open "harakah pick"
decision settled first, and building the tool is the natural way to settle it: build its three
options as three versions of this tool and let the owner try them by hand.

### 4. The crop tool

Drag a box over the page to get an image of it to share. Before building this, check one
licence question: the print's publisher allows free digital use but keeps commercial printing
rights. An image a reader shares is probably fine, but that has to be checked against the
licence text, not assumed. If it is not fine, crop becomes "share a link to these verses",
which the app can already do.

### 5. The phone

A phone has no pointer shapes, no letters and little room. Three layouts are worth building
and trying by hand, rather than choosing from a picture:

- a slim row inside the existing top bar;
- one tool button that fans out, like a pen case;
- a row that slides up from the page bar at the bottom, where the thumb already is.

This goes to the owner as its own decision, with all three running on the decision page.

## How will we know each step worked?

- **Automatic checks:**
  - each letter switches the tool, including on an Arabic keyboard layout;
  - Escape returns to select;
  - tools that should go back after one use do;
  - locked tools stay on;
  - the bar is one tab stop and the arrows move along it;
  - the active tool is announced.
- **By eye:** a still render of the bar above a real page at computer size, then at phone size
  for step 5.
- **In the hand:** stays-on versus goes-back is felt, not seen. Try the mistake tool on a real
  page before deciding it stays on.

## What else was considered, and why is it not here?

- **A hand tool for moving the page.** Design tools have one because a drag there draws.
  Here, dragging already moves the page under select, so a hand tool adds nothing.
- **Every tool stays on until you switch back.** This is simpler to explain. But the reader
  would forget they are in the bookmark tool and drop ribbons by accident. Figma, Acrobat and
  tldraw all chose to go back after one use for single-use tools.
- **No bar: keep everything in the verse drawer**, like Quran.com. This works, and the drawer
  keeps doing it under select. But the owner asked for the mode idea, and it is what removes
  the hidden holds.

## What is this plan not settling?

- What a note or mistake mark looks like on the page. That was settled by the placement and
  granularity decisions.
- Whether notes sync to an account. The decided answer is still that they leave as a file.
- Which picking method the mistake tool uses for a single vowel. That is the open "harakah
  pick" decision, and step 3 is where it gets answered.
