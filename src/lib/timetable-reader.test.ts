import { describe, expect, it } from "vitest";
import { rows, type Positioned } from "./timetable-reader";

const word = (text: string, x: number, y: number, width = 20): Positioned => ({
  text,
  x,
  y,
  width,
});

describe("rows", () => {
  it("returns an empty string for no items", () => {
    expect(rows([])).toBe("");
  });

  it("groups words on the same line within the y tolerance", () => {
    const out = rows([word("Mon", 0, 100, 30), word("Math", 40, 103), word("Tue", 0, 120)]);
    expect(out).toBe("Mon Math\nTue");
  });

  it("sorts rows top to bottom and words left to right even when input is unsorted", () => {
    const out = rows([word("second", 0, 200), word("b", 50, 100), word("a", 0, 100, 40)]);
    expect(out).toBe("a b\nsecond");
  });

  it("starts a new row once the y difference reaches the tolerance", () => {
    const out = rows([word("x", 0, 0), word("y", 0, 6.9), word("z", 0, 7)]);
    expect(out).toBe("x y\nz");
  });

  it("separates columns with a pipe when the horizontal gap is large", () => {
    // previous word ends at x=20; next starts at x=40 -> gap 20 (>16) becomes a column break
    const out = rows([word("Math", 0, 0, 20), word("09:00", 40, 0, 30)]);
    expect(out).toBe("Math | 09:00");
  });

  it("keeps a single space for small gaps and at the boundary", () => {
    // gap of exactly 16 is not a column break
    const out = rows([word("a", 0, 0, 20), word("b", 36, 0, 10)]);
    expect(out).toBe("a b");
  });

  it("handles multiple rows with independent column breaks", () => {
    const out = rows([
      word("Tue", 0, 20, 20),
      word("English", 40, 20, 40),
      word("Mon", 0, 0, 20),
      word("Math", 40, 0, 30),
    ]);
    expect(out).toBe("Mon | Math\nTue | English");
  });

  it("compares against the first word of a row when grouping", () => {
    // words drift downward within one line but stay within tolerance of the row start
    const out = rows([word("a", 0, 100), word("b", 30, 105), word("c", 60, 106.9)]);
    expect(out).toBe("a b c");
  });
});
