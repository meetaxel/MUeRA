import { beforeEach, describe, expect, it } from "vitest";
import {
  actions,
  exportData,
  getState,
  importData,
  isDuplicate,
  setState,
  type Task,
} from "./store";

const task = (extra: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Read chapter 4",
  subject: "Maths",
  type: "assignment",
  date: "2026-12-01",
  done: false,
  ...extra,
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

describe("exportData / importData", () => {
  it("round-trips tasks and subjects", () => {
    setState(() => ({
      tasks: [task()],
      subjects: [{ id: "s1", name: "Maths", difficulty: 4, attended: 3, conducted: 5 }],
    }));
    const backup = exportData();
    setState(() => ({ tasks: [], subjects: [] }));
    expect(importData(backup)).toBeNull();
    expect(getState().tasks).toEqual([task()]);
    expect(getState().subjects).toEqual([
      { id: "s1", name: "Maths", difficulty: 4, attended: 3, conducted: 5 },
    ]);
  });

  it("marks the export with app and version", () => {
    const parsed = JSON.parse(exportData());
    expect(parsed.app).toBe("muera");
    expect(parsed.version).toBe(1);
    expect(parsed.data).toBeDefined();
  });

  it("rejects invalid JSON", () => {
    expect(importData("{not json")).toBe("This file isn't valid JSON.");
  });

  it("rejects JSON without any MUeRA data arrays", () => {
    expect(importData('{"hello": "world"}')).toBe("This file doesn't contain MUeRA data.");
    expect(importData("42")).toBe("This file doesn't contain MUeRA data.");
  });

  it("rejects a damaged section", () => {
    expect(importData('{"tasks": {"0": "x"}, "subjects": []}')).toBe(
      'The "tasks" section is damaged.',
    );
  });

  it("accepts a bare state object as well as a wrapped export", () => {
    expect(importData(JSON.stringify({ tasks: [task()] }))).toBeNull();
    expect(getState().tasks).toEqual([task()]);
  });

  it("coerces string digit counts to integers and defaults difficulty", () => {
    expect(
      importData(
        JSON.stringify({
          subjects: [
            { id: "s1", name: "Maths", difficulty: "high", attended: "7", conducted: "nine" },
          ],
        }),
      ),
    ).toBeNull();
    expect(getState().subjects[0]).toMatchObject({ attended: 7, conducted: 0, difficulty: 3 });
  });
});

describe("isDuplicate", () => {
  it("matches same date, type, subject and title ignoring case and punctuation", () => {
    const list = [task({ title: "Read Chapter 4!", subject: "MATHS" })];
    expect(isDuplicate({ title: "read chapter 4", subject: "maths", type: "assignment", date: "2026-12-01" }, list)).toBe(true);
  });

  it("does not match on a different date or type", () => {
    const list = [task()];
    expect(isDuplicate({ title: "Read chapter 4", subject: "Maths", type: "assignment", date: "2026-12-02" }, list)).toBe(false);
    expect(isDuplicate({ title: "Read chapter 4", subject: "Maths", type: "quiz", date: "2026-12-01" }, list)).toBe(false);
  });

  it("flags non-personal tasks on the same date and subject even with a different title", () => {
    const list = [task()];
    expect(isDuplicate({ title: "Different title", subject: "Maths", type: "assignment", date: "2026-12-01" }, list)).toBe(true);
  });

  it("requires the same title for personal tasks", () => {
    const list = [task({ type: "personal" })];
    expect(isDuplicate({ title: "Different title", subject: "Maths", type: "personal", date: "2026-12-01" }, list)).toBe(false);
    expect(isDuplicate({ title: "Read chapter 4", subject: "Maths", type: "personal", date: "2026-12-01" }, list)).toBe(true);
  });
});

describe("actions", () => {
  it("addTask assigns an id and starts tasks undone", () => {
    actions.addTask({ title: "New", subject: "Maths", type: "quiz", date: "2026-12-03" });
    const [added] = getState().tasks;
    expect(added.id).toBeTruthy();
    expect(added.done).toBe(false);
  });

  it("updateTask patches only the matching task and deleteTask removes it", () => {
    setState(() => ({ tasks: [task(), task({ id: "t2", title: "Other" })] }));
    actions.updateTask("t1", { done: true });
    expect(getState().tasks.find((t) => t.id === "t1")?.done).toBe(true);
    expect(getState().tasks.find((t) => t.id === "t2")?.done).toBe(false);
    actions.deleteTask("t1");
    expect(getState().tasks.map((t) => t.id)).toEqual(["t2"]);
  });

  it("ensureSubject adds a subject once, ignoring case, and skips blank names", () => {
    actions.ensureSubject("Maths");
    actions.ensureSubject("  maths  ");
    actions.ensureSubject("   ");
    expect(getState().subjects.map((s) => s.name)).toEqual(["Maths"]);
  });
});
