// Put a few made-up jumps on page 9 (the same ones the browser tests use),
// hide the install notices, set the "Saved jump arrows" setting to the way
// window.ARROWS names ("stays" or "asked"), and reopen the page. Run by record.sh through the
// recorder's evalfile step; nothing here is part of the app.
(() => {
  const KEY = (v) => `quran/hafs-kfqc/${v}`;
  const jump = (id, from, to, at, state = "sometimes") => ({
    id,
    from: { key: KEY(from), word: 3 },
    to: to ? { key: KEY(to) } : null,
    times: at.map((t) => ({ at: t, device: "d-demo" })),
    state,
    createdAt: at[0],
    updatedAt: at[at.length - 1],
  });
  const day = Date.now() - 86_400_000;
  const confusions = [
    jump("j1", "2:58", "7:161", [day, day + 1, day + 2]),
    jump("j2", "2:58", "2:35", [day + 3]),
    jump("j3", "2:59", null, [day + 4]),
    jump("j4", "2:60", "7:160", [day + 5], "beaten"),
  ];
  for (const kind of ["install-ios", "install", "storage", "persist"]) localStorage.setItem(`hifth.notice.${kind}`, "1");
  localStorage.setItem("hifth.jump.arrows.v1", window.ARROWS ?? "stays");
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("hifth.bookmarks.v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("sets", "readwrite");
      tx.objectStore("sets").put({ id: "confusions", confusions });
      tx.oncomplete = () => {
        open.result.close();
        // After the recorder has its answer, so the reload does not cut it off.
        setTimeout(() => location.reload(), 50);
        resolve(`seeded, reopening as ${window.ARROWS ?? "stays"}`);
      };
    };
  });
})();
