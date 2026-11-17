(async () => {
  // Can the app reach the recitation audio? Loads one verse's sound (the first verse of the
  // first sura, from the same place the app's own player uses) far enough to know its length,
  // and says whether it came. Made for the sandboxed Mac app, which may use the network only
  // because it is signed to: without that permission this says "error". Plays nothing.
  const url = "https://verses.quran.com/Minshawi/Murattal/mp3/001001.mp3";
  const audio = new Audio();
  audio.preload = "metadata";
  audio.muted = true;
  const outcome = await new Promise((resolve) => {
    const stop = setTimeout(() => resolve("timeout"), 20000);
    audio.addEventListener("loadedmetadata", () => { clearTimeout(stop); resolve("loaded"); });
    audio.addEventListener("error", () => { clearTimeout(stop); resolve(`error code=${audio.error?.code ?? "?"}`); });
    audio.src = url;
  });
  return `recitation=${outcome} seconds=${Number.isFinite(audio.duration) ? audio.duration.toFixed(1) : "?"}`;
})()
