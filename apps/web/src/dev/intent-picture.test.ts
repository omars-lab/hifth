import { intentPictureRoute } from "./intent-picture";

// The dev server hands over the "what each commit was for" picture at /intent/, so it opens
// from the local hub instead of as a file:// page. Only these addresses answer; nothing
// can reach another file in the repo.
describe("intentPictureRoute", () => {
  it("serves the picture at /intent/ and /intent/index.html, keeping the page's own query", () => {
    expect(intentPictureRoute("/intent/")).toBe("page");
    expect(intentPictureRoute("/intent/index.html")).toBe("page");
    expect(intentPictureRoute("/intent/?g=33")).toBe("page");
  });

  it("sends /intent to /intent/ so the page's relative links resolve", () => {
    expect(intentPictureRoute("/intent")).toBe("add-slash");
    expect(intentPictureRoute("/intent?g=33")).toBe("add-slash");
  });

  it("answers nothing else, so no other file can be read through it", () => {
    for (const url of [
      "/",
      "/intent/../.env",
      "/intent/asks.jsonl",
      "/intent/%2e%2e/.env",
      "/intentional",
      "/docs/intent/",
    ]) {
      expect(intentPictureRoute(url)).toBeNull();
    }
  });
});
