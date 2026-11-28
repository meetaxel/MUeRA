import { beforeEach, describe, expect, it } from "vitest";
import type { ClassKind, TimetableDraft } from "./timetable";
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

describe("actions.saveTimetable", () => {
  const draft = (extra: Partial<TimetableDraft> = {}): TimetableDraft => ({
    key: "k1",
    subject: "Maths",
    kind: "theory",
    day: 2,
    start: "09:00",
    end: "10:00",
    uncertain: false,
    source: "",
    ...extra,
  });
  const save = (
    entries: TimetableDraft[],
    detected: { name: string; kind: ClassKind }[] = [{ name: "Maths", kind: "theory" }],
    includeLabs = false,
    replace = false,
    recurring = true,
  ) =>
    actions.saveTimetable(entries, detected, "2026-12-01", "2026-12-31", includeLabs, replace, recurring);

  it("rejects an inverted date range without touching state", () => {
    const r = actions.saveTimetable([draft()], [], "2026-12-31", "2026-12-01", false, false);
    expect(r.error).toMatch(/valid effective date/);
    expect(getState().timetable).toHaveLength(0);
    expect(getState().subjects).toHaveLength(0);
  });

  it("rejects when no entry is valid", () => {
    const r = save([draft({ end: "08:00" })]);
    expect(r.error).toMatch(/No valid class sessions/);
    expect(getState().timetable).toHaveLength(0);
  });

  it("saves the subject and weekly slot with linked subjectId", () => {
    const r = save([draft()]);
    expect(r.error).toBeUndefined();
    expect(r.subjectsSaved).toBe(1);
    expect(r.saved).toBe(1);
    const [slot] = getState().timetable;
    expect(slot).toMatchObject({
      subject: "Maths",
      day: 2,
      start: "09:00",
      end: "10:00",
      effectiveDate: "2026-12-01",
      endDate: "2026-12-31",
    });
    expect(slot.subjectId).toBe(getState().subjects[0].id);
    expect(slot.singleDate).toBeUndefined();
  });

  it("skips lab subjects but keeps lab sessions on the timetable when labs are not included", () => {
    const r = save(
      [draft(), draft({ key: "k2", subject: "Physics Lab", kind: "lab", start: "11:00", end: "12:00" })],
      [
        { name: "Maths", kind: "theory" },
        { name: "Physics Lab", kind: "lab" },
      ],
    );
    expect(r.error).toBeUndefined();
    expect(getState().subjects.map((s) => s.name)).toEqual(["Maths"]);
    expect(getState().timetable.map((s) => s.subject)).toEqual(["Maths", "Physics Lab"]);
    expect(getState().timetable[1].subjectId).toBeUndefined();
  });

  it("includes lab subjects and sessions when labs are included", () => {
    const r = save(
      [draft({ subject: "Physics Lab", kind: "lab" })],
      [{ name: "Physics Lab", kind: "lab" }],
      true,
    );
    expect(r.error).toBeUndefined();
    expect(getState().subjects[0]).toMatchObject({ name: "Physics Lab", kind: "lab" });
    expect(getState().timetable[0].subjectId).toBe(getState().subjects[0].id);
  });

  it("does not duplicate a subject whose name only differs by case or spacing", () => {
    const r = save([draft({ subject: "  maths " })], [{ name: "Maths", kind: "theory" }]);
    expect(r.error).toBeUndefined();
    expect(getState().subjects).toHaveLength(1);
    expect(getState().timetable[0].subjectId).toBe(getState().subjects[0].id);
  });

  it("reports an unchanged re-import as already saved", () => {
    save([draft()]);
    const r = save([draft()]);
    expect(r.duplicates).toBe(1);
    expect(r.error).toMatch(/already saved/);
    expect(getState().timetable).toHaveLength(1);
  });

  it("replace clears the old timetable but keeps existing subjects", () => {
    save([draft()]);
    const oldId = getState().timetable[0].id;
    const r = save([draft({ start: "10:00", end: "11:00" })], [], false, true);
    expect(r.error).toBeUndefined();
    expect(getState().timetable).toHaveLength(1);
    expect(getState().timetable[0].start).toBe("10:00");
    expect(getState().timetable[0].id).not.toBe(oldId);
    expect(getState().subjects).toHaveLength(1);
  });

  it("stamps singleDate on a one-day schedule", () => {
    const r = save([draft()], undefined, false, false, false);
    expect(r.error).toBeUndefined();
    expect(getState().timetable[0].singleDate).toBe("2026-12-01");
  });
});

describe("actions.recordAttendance / correctAttendance", () => {
  const seedSlot = () => {
    actions.saveTimetable(
      [
        {
          key: "k1",
          subject: "Maths",
          kind: "theory",
          day: 2,
          start: "09:00",
          end: "10:00",
          uncertain: false,
          source: "",
        },
      ],
      [{ name: "Maths", kind: "theory" }],
      "2026-12-01",
      "2026-12-31",
      false,
      false,
    );
    return { slot: getState().timetable[0], subject: () => getState().subjects[0] };
  };

  it("counts a present class as attended and conducted", () => {
    const { slot, subject } = seedSlot();
    actions.recordAttendance(slot.id, "2026-12-01", "Present");
    expect(subject()).toMatchObject({ attended: 1, conducted: 1 });
    expect(getState().attendanceRecords[0]).toMatchObject({
      slotId: slot.id,
      subjectId: subject().id,
      date: "2026-12-01",
      status: "Present",
    });
  });

  it("counts an absent class as conducted only, and a cancelled one as neither", () => {
    const { slot, subject } = seedSlot();
    actions.recordAttendance(slot.id, "2026-12-01", "Absent");
    actions.recordAttendance(slot.id, "2026-12-08", "Cancelled");
    expect(subject()).toMatchObject({ attended: 0, conducted: 1 });
    expect(getState().attendanceRecords).toHaveLength(2);
  });

  it("ignores dates the slot does not occur on and unknown slots", () => {
    const { slot, subject } = seedSlot();
    actions.recordAttendance(slot.id, "2026-12-02", "Present");
    actions.recordAttendance(slot.id, "2027-01-06", "Present");
    actions.recordAttendance("no-such-slot", "2026-12-01", "Present");
    expect(subject()).toMatchObject({ attended: 0, conducted: 0 });
    expect(getState().attendanceRecords).toHaveLength(0);
  });

  it("re-recording the same class replaces the status instead of double counting", () => {
    const { slot, subject } = seedSlot();
    actions.recordAttendance(slot.id, "2026-12-01", "Present");
    actions.recordAttendance(slot.id, "2026-12-01", "Absent");
    expect(subject()).toMatchObject({ attended: 0, conducted: 1 });
    expect(getState().attendanceRecords).toHaveLength(1);
  });

  it("clearing a status removes the record and its counts", () => {
    const { slot, subject } = seedSlot();
    actions.recordAttendance(slot.id, "2026-12-01", "Present");
    actions.recordAttendance(slot.id, "2026-12-01", null);
    expect(subject()).toMatchObject({ attended: 0, conducted: 0 });
    expect(getState().attendanceRecords).toHaveLength(0);
  });

  it("correctAttendance updates counts and can remove a record", () => {
    const { slot, subject } = seedSlot();
    actions.recordAttendance(slot.id, "2026-12-01", "Absent");
    const recordId = getState().attendanceRecords[0].id;
    actions.correctAttendance(recordId, "Present");
    expect(subject()).toMatchObject({ attended: 1, conducted: 1 });
    actions.correctAttendance(recordId, "Cancelled");
    expect(subject()).toMatchObject({ attended: 0, conducted: 0 });
    actions.correctAttendance(recordId, null);
    expect(getState().attendanceRecords).toHaveLength(0);
  });
});
