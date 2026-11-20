import { describe, expect, it } from "vitest";
import { consumeLastCapturedError, describeError } from "./error-capture";

describe("describeError", () => {
  it("includes the stack by default", () => {
    const err = new Error("boom");
    expect(describeError(err)).toContain("Error: boom");
  });

  it("walks the cause chain with labels", () => {
    const root = new Error("disk full");
    const mid = new Error("write failed", { cause: root });
    const top = new Error("save failed", { cause: mid });
    const text = describeError(top);
    expect(text).toContain("save failed");
    expect(text).toContain("caused by: Error: write failed");
    expect(text).toContain("caused by: Error: disk full");
  });

  it("stops at the cause depth limit", () => {
    let err = new Error("depth 0");
    for (let i = 1; i <= 6; i++) err = new Error(`depth ${i}`, { cause: err });
    const text = describeError(err);
    expect(text).toContain("depth 6");
    expect(text).toContain("depth 2");
    expect(text).not.toContain("depth 1");
  });

  it("appends numeric status or statusCode", () => {
    expect(describeError(Object.assign(new Error("http"), { status: 503 }))).toContain("(status 503)");
    expect(describeError(Object.assign(new Error("http"), { statusCode: 404 }))).toContain("(status 404)");
    expect(describeError(new Error("plain"))).not.toContain("(status");
  });

  it("describes non-Error values", () => {
    expect(describeError("just a string")).toBe("just a string");
    expect(describeError({ code: 42 })).toBe('{"code":42}');
  });

  it("caps very long descriptions", () => {
    const err = new Error("x".repeat(10_000));
    expect(describeError(err).length).toBeLessThanOrEqual(8_000);
  });
});

describe("consumeLastCapturedError", () => {
  it("returns the error recorded through console.error once", () => {
    const err = new Error("captured");
    console.error(err);
    expect(consumeLastCapturedError()).toBe(err);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("ignores non-Error console.error arguments", () => {
    console.error("plain message");
    expect(consumeLastCapturedError()).toBeUndefined();
  });
});
