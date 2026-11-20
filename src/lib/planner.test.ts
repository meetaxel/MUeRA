import { describe, expect, it } from "vitest";
import { buildPlan, requiredMinutes } from "./planner";
import { defaultSettings, type Settings, type Task } from "./store";

const day = (d: number) => `2026-01-0${d}`;

function task(partial: Partial<Task> & Pick<Task, "id" | "type" | "date">): Task {
  return { title: partial.id, subject: "DS", done: false, ...partial };
}

const planned = (r: ReturnType<typeof buildPlan>, forTaskId: string) =>
  r.tasks.filter((t) => t.planned && !t.done && t.forTaskId === forTaskId);

const roomy: Settings = { ...defaultSettings, studyHoursPerDay: 8, sessionMin: 45, studyStart: "08:00" };

describe("requiredMinutes", () => {
  it("scales base minutes by difficulty and rounds to 15", () => {
    expect(requiredMinutes(task({ id: "e", type: "exam", date: day(2) }), 3)).toBe(435);
    expect(requiredMinutes(task({ id: "q", type: "quiz", date: day(2) }), 1)).toBe(150);
    expect(requiredMinutes(task({ id: "a", type: "assignment", date: day(2) }), 5)).toBe(240);
  });
  it("requires no time for types without a base", () => {
    expect(requiredMinutes(task({ id: "s", type: "study", date: day(2) }))).toBe(0);
  });
});

describe("buildPlan", () => {
  it("schedules exams only until the day before, assignments up to the due date", () => {
    const r = buildPlan(
      [task({ id: "e", type: "exam", date: day(2) }), task({ id: "a", type: "assignment", date: day(2) })],
      [],
      roomy,
      day(1),
    );
    const examSessions = planned(r, "e");
    expect(examSessions.length).toBeGreaterThan(0);
    expect(examSessions.every((t) => t.date <= day(1))).toBe(true);
    expect(planned(r, "a").some((t) => t.date === day(2))).toBe(true);
  });

  it("respects the daily cap and session length", () => {
    const r = buildPlan([task({ id: "e", type: "exam", date: day(6) })], [], defaultSettings, day(1));
    const sessions = planned(r, "e");
    expect(sessions.length).toBeGreaterThan(0);
    sessions.forEach((t) => expect(t.durationMin!).toBeLessThanOrEqual(defaultSettings.sessionMin));
    const byDay = new Map<string, number>();
    sessions.forEach((t) => byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.durationMin!));
    byDay.forEach((mins) => expect(mins).toBeLessThanOrEqual(defaultSettings.studyHoursPerDay * 60));
  });

  it("starts today at the next quarter hour when study start has passed", () => {
    const r = buildPlan([task({ id: "q", type: "quiz", date: day(3) })], [], roomy, day(1), 607);
    const todaySessions = planned(r, "q").filter((t) => t.date === day(1));
    expect(todaySessions[0]?.time).toBe("10:15");
  });

  it("counts completed sessions toward the required minutes", () => {
    const quiz = task({ id: "q", type: "quiz", date: day(3) });
    const done: Task = {
      ...task({ id: "s", type: "study", date: day(1) }),
      planned: true,
      done: true,
      forTaskId: "q",
      durationMin: requiredMinutes(quiz, 3),
    };
    const r = buildPlan([quiz, done], [], defaultSettings, day(1));
    expect(planned(r, "q")).toHaveLength(0);
    expect(r.tasks.find((t) => t.id === "s")).toBeTruthy();
  });

  it("warns when the remaining time cannot cover the work", () => {
    const r = buildPlan([task({ id: "e", title: "Exam", type: "exam", date: day(2) })], [], defaultSettings, day(1));
    expect(r.note).toContain('Not enough time for "Exam"');
  });
});
