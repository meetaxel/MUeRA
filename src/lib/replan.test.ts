import { addDays, format } from "date-fns";
import { describe, expect, it } from "vitest";
import { regenerate } from "./replan";
import { defaultSettings, getState, setState, type Subject, type Task } from "./store";

const d = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");

const exam = (extra: Partial<Task> = {}): Task => ({
  id: "exam1",
  title: "DS final",
  subject: "DS",
  type: "exam",
  date: d(4),
  done: false,
  ...extra,
});

const subjects: Subject[] = [{ id: "s1", name: "DS", difficulty: 3, attended: 0, conducted: 0 }];

function seed(tasks: Task[]) {
  setState(() => ({
    tasks,
    subjects,
    timetable: [],
    docs: [],
    settings: { ...defaultSettings, studyHoursPerDay: 8, sessionMin: 45, studyStart: "08:00" },
    chat: [],
    planNote: "",
    aiCalls: 0,
    attendanceRecords: [],
  }));
}

describe("regenerate", () => {
  it("schedules planned study sessions for open deadline work", () => {
    seed([exam()]);
    regenerate("Plan regenerated.");
    const sessions = getState().tasks.filter((t) => t.planned && t.forTaskId === "exam1");
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      expect(s.date >= d(0)).toBe(true);
      expect(s.date < exam().date).toBe(true); // exams are prepared until the day before
      expect(s.done).toBe(false);
    }
  });

  it("prefixes the plan note with the given reason", () => {
    seed([exam()]);
    regenerate("Recovery requested.");
    expect(getState().planNote.startsWith("Recovery requested.\n")).toBe(true);
  });

  it("replaces stale pending sessions but keeps completed ones", () => {
    const done = exam({ id: "done1", title: "Done session", planned: true, done: true, forTaskId: "exam1", date: d(0) });
    const stale = exam({ id: "stale1", title: "Stale session", planned: true, done: false, forTaskId: "exam1", date: d(0) });
    seed([exam(), done, stale]);
    regenerate("x");
    const ids = getState().tasks.map((t) => t.id);
    expect(ids).toContain("done1");
    expect(ids).not.toContain("stale1");
  });

  it("plans nothing when there is no open deadline work", () => {
    seed([]);
    regenerate("Empty.");
    expect(getState().tasks.filter((t) => t.planned)).toHaveLength(0);
  });
});
