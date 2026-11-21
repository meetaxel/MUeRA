import { describe, expect, it } from "vitest";
import { renderErrorPage } from "./error-page";

describe("renderErrorPage", () => {
  const html = renderErrorPage();

  it("returns a complete HTML document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
  });

  it("tells the user the page did not load", () => {
    expect(html).toContain("<title>This page didn't load</title>");
    expect(html).toContain("<h1>This page didn't load</h1>");
  });

  it("offers retry and home actions", () => {
    expect(html).toContain('onclick="location.reload()"');
    expect(html).toContain('href="/"');
  });

  it("sets a mobile viewport", () => {
    expect(html).toContain('name="viewport"');
    expect(html).toContain("width=device-width");
  });
});
