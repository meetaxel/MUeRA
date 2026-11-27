import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useIsMobile } from "./use-mobile";

const setWidth = (w: number) =>
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: w });

let listeners: Set<() => void>;
let queries: string[];

beforeEach(() => {
  listeners = new Set();
  queries = [];
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      media: query,
      matches: false,
      addEventListener: (_: string, cb: () => void) => {
        queries.push(query);
        listeners.add(cb);
      },
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    }),
  });
});
afterEach(() => setWidth(1024));

describe("useIsMobile", () => {
  it("is false on a desktop-width viewport", () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("is true below the 768px breakpoint", () => {
    setWidth(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    expect(queries).toContain("(max-width: 767px)");
  });

  it("tracks viewport changes through the media-query listener", () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => {
      setWidth(390);
      listeners.forEach((cb) => cb());
    });
    expect(result.current).toBe(true);
  });

  it("removes its change listener on unmount", () => {
    const { unmount } = renderHook(() => useIsMobile());
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
