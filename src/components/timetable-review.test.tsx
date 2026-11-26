import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { addDays, format } from "date-fns";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TimetableReview } from "./timetable-review";
import { getState, setState } from "@/lib/store";
import type { TimetableDraft } from "@/lib/timetable";

const d = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");

const entry = (extra: Partial<TimetableDraft> = {}): TimetableDraft => ({
  key: "k1",
  subject: "Maths",
  kind: "theory",
  day: 3,
  start: "09:00",
  end: "10:00",
  uncertain: false,
  source: "",
  ...extra,
});

const result = (over: Partial<Parameters<typeof TimetableReview>[0]["result"]> = {}) => ({
  entries: [entry()],
  subjects: [{ name: "Maths", kind: "theory" as const }],
  effective: d(0),
  ...over,
});

beforeEach(() => {
  setState(() => ({
    tasks: [],
    subjects: [],
    timetable: [],
    docs: [],
    chat: [],
    planNote: "",
    aiCalls: 0,
    attendanceRecords: [],
  }));
});
afterEach(cleanup);

describe("TimetableReview", () => {
  it("summarizes the detected subjects and sessions", () => {
    render(<TimetableReview result={result()} />);
    expect(screen.getByText(/1 theory subjects detected · 1 weekly class sessions detected/)).toBeInTheDocument();
    expect(screen.getByText(/Ready for confirmation/)).toBeInTheDocument();
  });

  it("renames matching class entries when a detected subject is renamed", () => {
    render(<TimetableReview result={result()} />);
    fireEvent.change(screen.getByLabelText("Detected subject 1"), { target: { value: "Mathematics" } });
    expect(screen.getByLabelText("Class subject 1")).toHaveValue("Mathematics");
  });

  it("flags incomplete entries for correction", () => {
    render(<TimetableReview result={result({ entries: [entry({ start: "10:00", end: "09:00" })] })} />);
    expect(screen.getByText(/Please check the subject, weekday and times/)).toBeInTheDocument();
  });

  it("requires a semester end date for recurring schedules", () => {
    render(<TimetableReview result={result()} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm timetable" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enter a valid effective date and semester end date.",
    );
    expect(getState().timetable).toHaveLength(0);
  });

  it("rejects a one-day schedule when a class weekday does not match the effective date", () => {
    // effective is today; the entry's Wednesday only matches if today is Wednesday
    const todayDow = new Date().getDay();
    const otherDay = (todayDow + 1) % 7;
    render(<TimetableReview result={result({ entries: [entry({ day: otherDay })] })} />);
    fireEvent.click(screen.getByLabelText("Repeat weekly"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm timetable" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "For a one-day schedule, each class weekday must match the effective date.",
    );
    expect(getState().timetable).toHaveLength(0);
  });

  it("saves subjects and sessions on a valid confirm", () => {
    render(<TimetableReview result={result()} />);
    fireEvent.change(screen.getByLabelText("Semester end date"), { target: { value: d(30) } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm timetable" }));
    expect(getState().subjects.map((s) => s.name)).toEqual(["Maths"]);
    expect(getState().timetable).toHaveLength(1);
    expect(getState().timetable[0]).toMatchObject({ subject: "Maths", day: 3, start: "09:00", end: "10:00" });
    expect(screen.getByRole("status")).toHaveTextContent("1 weekly class sessions saved");
  });

  it("removes an extracted class and adds a blank one for correction", () => {
    render(<TimetableReview result={result()} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove extracted class" }));
    expect(screen.queryByLabelText("Class subject 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add timetable class" }));
    expect(screen.getByText(/Please check the subject, weekday and times/)).toBeInTheDocument();
  });
});
