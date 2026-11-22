import { describe, expect, it } from "vitest";
import { parseJSON, ytLink } from "./client";

describe("parseJSON", () => {
  it("parses a bare JSON array", () => {
    expect(parseJSON('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("extracts an array embedded in prose", () => {
    const text = 'Here are the flashcards:\n[{"q":"x","a":"y"}]\nHope these help!';
    expect(parseJSON(text)).toEqual([{ q: "x", a: "y" }]);
  });

  it("handles nested arrays and whitespace", () => {
    expect(parseJSON('  [ [1, 2], [3] ]  ')).toEqual([[1, 2], [3]]);
  });

  it("returns null when there are no brackets", () => {
    expect(parseJSON('no json here')).toBeNull();
  });

  it("returns null for invalid JSON inside brackets", () => {
    expect(parseJSON('[{bad json}]')).toBeNull();
  });

  it("matches greedily, so two separate arrays do not parse", () => {
    // The regex spans from the first [ to the last ], which is not valid JSON here.
    expect(parseJSON('first [1, 2] then [3, 4]')).toBeNull();
  });

  it("only extracts arrays, not objects", () => {
    expect(parseJSON('{"a": 1}')).toBeNull();
  });
});

describe("ytLink", () => {
  it("builds a YouTube search URL with the explained suffix", () => {
    expect(ytLink("photosynthesis")).toBe(
      "https://www.youtube.com/results?search_query=photosynthesis%20explained",
    );
  });

  it("encodes spaces and special characters", () => {
    expect(ytLink("Kirchhoff's laws & circuits")).toBe(
      `https://www.youtube.com/results?search_query=${encodeURIComponent("Kirchhoff's laws & circuits explained")}`,
    );
  });
});
