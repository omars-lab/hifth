#if DEBUG
import Foundation

/// The one question a walk capture asks the page: which page and verse, what
/// is open, and the settings. Run with `runPageScript`, so nothing is added to
/// the web build the public site ships.
///
/// The page can hold the book's words (the pitch build does), so the script
/// reads numbers, the app's own markers (`data-…` names, and their values only
/// when a value is one plain word) and short settings. It never reads a label,
/// a title or any text. `CapturePageTests` holds it to that with made-up words.
nonisolated enum CapturePage {
    /// How long the capture waits for the answer before keeping what it has.
    static let timeout: Duration = .seconds(2)

    /// `route` is the address the app last heard; `storage` stands in for the
    /// page's saved settings in the tests, and is `null` in the app.
    static func arguments(route: String, storage: [String: String]? = nil) -> [String: Any] {
        ["route": route, "storage": storage.map { $0 as Any } ?? NSNull()]
    }

    static let script = """
    const plain = (v) => typeof v === "string" && /^[A-Za-z0-9._:-]{1,32}$/.test(v);
    const markers = (el) => [...el.attributes]
      .filter((a) => a.name.startsWith("data-"))
      .map((a) => a.name.slice(5) + (a.value !== "" && plain(a.value) ? "=" + a.value : ""));
    const onScreen = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    };

    const target = (route ?? "").replace(/^#/, "").split("?")[0].split("/")[2] ?? "";
    const verse = /^(\\d+):(\\d+)/.exec(target);
    const pages = [...document.querySelectorAll("[data-page]")]
      .filter((el) => /^\\d+$/.test(el.dataset.page) && onScreen(el))
      .map((el) => Number(el.dataset.page))
      .sort((a, b) => a - b);
    const pageInRoute = /^p(\\d+)$/.exec(target);

    const open = [];
    const tool = document.querySelector("[data-tool]")?.dataset.tool;
    if (plain(tool)) open.push("tool=" + tool);
    for (const el of document.querySelectorAll("[role=dialog], [role=menu], [aria-modal=true]")) {
      open.push((el.getAttribute("role") ?? "modal") + ":" + markers(el).join(","));
    }
    for (const el of document.querySelectorAll("[aria-expanded=true]")) {
      open.push("expanded:" + markers(el).join(","));
    }
    // A panel a link can open says its own name (the name in the link), so the
    // features-page check can tell six alike dialogs apart.
    for (const el of document.querySelectorAll("[data-panel]")) {
      if (plain(el.dataset.panel)) open.push("panel=" + el.dataset.panel);
    }
    // Words laid as word ink (a link's `?w=`, or a hold), by their numbers in
    // the verse; the page sets this only while the band is drawn.
    const words = document.querySelector("[data-words]")?.dataset.words;
    if (typeof words === "string" && /^\\d+-\\d+$/.test(words)) open.push("words=" + words);
    // One page or two: the view cards are told apart by this count.
    open.push("pages=" + pages.length);

    let saved = storage;
    if (saved == null) {
      try {
        saved = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
      } catch (e) {
        saved = {};
      }
    }
    const settings = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key.startsWith("hifth.") && plain(value)) settings[key] = value;
    }

    return JSON.stringify({
      page: pages[0] ?? (pageInRoute ? Number(pageInRoute[1]) : null),
      verse: verse ? verse[1] + ":" + verse[2] : null,
      open,
      settings,
    });
    """
}
#endif
