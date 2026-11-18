# The Mac's store screenshots came out the wrong height

*2026-11-17, launch item ㉛ (the store's screenshots).*

## What went wrong

The store takes Mac screenshots only at 16:10 sizes, such as 2560×1600. The Mac app opened at
1280×860, so the first plan was to let `make app-store-shots` name a window size
(`HIFTH_WINDOW_SIZE=1280x800`) and hand it to SwiftUI as the size the window opens at.

The picture still came out 2560×1656, and it stayed 2560×1656 whatever size was asked for.

## What the evidence showed

- **The size reached the app.** The launch passes it with `--env`, the same way as the route.
- **SwiftUI ignored it.** It uses a window's opening size only when the Mac has no remembered
  size for that window. This laptop remembers one, from earlier launches.
- **The picture is of the page, not the window.** The app photographs the web page, and the page
  runs up under the title bar. So a 1280×860 window gives a 1280×828 page, and 828 points is
  1656 pixels. This is why it never moved.
- A first guess, asking for a window 28 points shorter to make room for the title bar, changed
  nothing, for the same reason. It was reverted.

Clearing the Mac app's saved data would have made the opening size work once. That is off
limits: it is the owner's own reading state.

## What replaced it

When a size is asked for, the app measures the page after it opens, then grows or shrinks the
window by however far the page is off, and measures again (up to four tries). It then refuses
to take the picture unless the page is exactly the size asked for.

- The arithmetic is `WindowSize.window(_:page:wanted:)` in `native/Hifth/App/WindowSize.swift`,
  with its tests in `native/HifthTests/WindowSizeTests.swift`.
- The resizing is `fitPage(to:)` in `native/Hifth/Web/ShellModel.swift`, used only when a
  screenshot is being taken.
- Result: 2560×1600, in English and Arabic.

The opening size stays as it was for readers; nothing here runs unless a screenshot is asked for.

## A second fault the right-sized pictures showed

Once the Mac pictures were the right size, they showed a red "Left off" ribbon on the spine.
The web view keeps its data where the laptop keeps it, so a picture run opened the laptop's own
reading place, bookmarks and notes, and staying on a page long enough could have moved that
place. Clearing the data was off limits for the same reason as above.

Now a run asked for a picture keeps its page data in a throwaway store that starts empty and is
gone when the app quits (`ScreenshotData` in `native/Hifth/Web/ScreenshotData.swift`, tested in
`native/HifthTests/ScreenshotDataTests.swift`). A store picture shows the app as a new reader
sees it, on every machine, and the reader's own data is neither shown nor written.
