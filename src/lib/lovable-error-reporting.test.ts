import { afterEach, describe, expect, it, vi } from "vitest";
import { reportLovableError } from "./lovable-error-reporting";

afterEach(() => {
  delete window.__lovableEvents;
  delete window.__lovableReportRuntimeError;
});

describe("reportLovableError", () => {
  it("does nothing when no telemetry hooks are installed", () => {
    expect(() => reportLovableError(new Error("boom"))).not.toThrow();
  });

  it("forwards errors to captureException with boundary context", () => {
    const captureException = vi.fn();
    window.__lovableEvents = { captureException };
    reportLovableError(new Error("boom"), { component: "Planner" });
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: "react_error_boundary", component: "Planner" }),
      { mechanism: "react_error_boundary", handled: false, severity: "error" },
    );
  });

  it("reports plain Error instances with message and stack", () => {
    const report = vi.fn();
    window.__lovableReportRuntimeError = report;
    reportLovableError(new Error("boom"));
    const payload = report.mock.calls[0][0];
    expect(payload.message).toBe("boom");
    expect(payload.stack).toContain("boom");
    expect(payload.filename).toBe(window.location.pathname);
  });

  it("describes thrown Responses with status and URL", () => {
    const report = vi.fn();
    window.__lovableReportRuntimeError = report;
    reportLovableError(new Response(null, { status: 503 }));
    expect(report.mock.calls[0][0].message).toBe("Response 503");
  });

  it("describes plain thrown strings and message-bearing objects", () => {
    const report = vi.fn();
    window.__lovableReportRuntimeError = report;
    reportLovableError("plain failure");
    expect(report.mock.calls[0][0].message).toBe("plain failure");
    reportLovableError({ message: "supabase says no", code: "42" });
    expect(report.mock.calls[1][0].message).toBe("supabase says no");
  });

  it("serializes other thrown values instead of printing [object Object]", () => {
    const report = vi.fn();
    window.__lovableReportRuntimeError = report;
    reportLovableError({ code: 42 });
    expect(report.mock.calls[0][0].message).toBe('{"code":42}');
    reportLovableError(null);
    expect(report.mock.calls[1][0].message).toBe("null");
  });

  it("omits the stack field for non-Error values", () => {
    const report = vi.fn();
    window.__lovableReportRuntimeError = report;
    reportLovableError("plain failure");
    expect("stack" in report.mock.calls[0][0]).toBe(false);
  });
});
