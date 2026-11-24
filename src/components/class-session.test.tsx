import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClassSession } from "./class-session";
import { getState, setState, today, type Slot } from "@/lib/store";

const slot = (extra: Partial<Slot> = {}): Slot => ({
  id: "slot1",
  day: new Date().getDay(),
  subject: "Maths",
  subjectId: "s1",
  start: "09:00",
  end: "10:00",
  ...extra,
});

function seed(withSubject: boolean) {
  setState(() => ({
    tasks: [],
    subjects: withSubject
      ? [{ id: "s1", name: "Maths", difficulty: 3, attended: 0, conducted: 0 }]
      : [],
    timetable: [slot()],
    docs: [],
    chat: [],
    planNote: "",
    aiCalls: 0,
    attendanceRecords: [],
  }));
}

describe("ClassSession", () => {
  beforeEach(() => seed(true));
  afterEach(cleanup);

  it("shows the slot details and starts unrecorded", () => {
    render(<ClassSession slot={slot({ room: "B-201" })} date={today()} />);
    expect(screen.getByText("Maths")).toBeInTheDocument();
    expect(screen.getByText(/09:00–10:00 · B-201/)).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("records attendance on click and shows the pressed state", () => {
    render(<ClassSession slot={slot()} date={today()} />);
    fireEvent.click(screen.getByRole("button", { name: "Present" }));
    const records = getState().attendanceRecords;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ slotId: "slot1", date: today(), status: "Present" });
    expect(screen.getByRole("button", { name: "Present" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Present", { selector: "span" })).toBeInTheDocument();
  });

  it("clears a recorded status", () => {
    render(<ClassSession slot={slot()} date={today()} />);
    fireEvent.click(screen.getByRole("button", { name: "Absent" }));
    expect(getState().attendanceRecords[0]?.status).toBe("Absent");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("offers to enable attendance when the subject is unknown", () => {
    seed(false);
    render(<ClassSession slot={slot()} date={today()} />);
    fireEvent.click(screen.getByRole("button", { name: "Enable attendance for this subject" }));
    expect(getState().subjects.map((s) => s.name)).toEqual(["Maths"]);
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });
});
