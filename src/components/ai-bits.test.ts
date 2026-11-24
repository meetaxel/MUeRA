import { addDays, format } from "date-fns";
import { beforeEach, describe, expect, it } from "vitest";
import { recoveryFacts } from "./ai-bits";
import { setState, type Subject, type Task, type Slot } from "@/lib/store";

const d = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");

const subject = (extra: Partial<Subject> = {}): Subject => ({
  id: "s1",
  name: "Maths",
  difficulty: 3,
  attended: 10,
  conducted: 10,
  ...extra,
});

const task = (extra: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Assignment 5",
  subject: "Maths",
  type: "assignment",
  date: d(3),
  done: false,
  ...extra,
});

function seed(partial: { tasks?: Task[]; subjects?: Subject[]; timetable?: Slot[] }) {
  setState(() => ({
    tasks: partial.tasks ?? [],
    subjects: partial.subjects ?? [],
    timetable: partial.timetable ?? [],
    docs: [],
    chat: [],
    planNote: "",
    aiCalls: 0,
    attendanceRecords: [],
  }));
}

describe("recoveryFacts", () => {
  beforeEach(() => seed({}));

  it("reports nothing needed when attendance and deadlines are on track", () => {
    seed({ subjects: [subject()], tasks: [task()] });
    const facts = recoveryFacts();
    expect(facts.needed).toBe(false);
    expect(facts.text).toContain("Attendance target 75%.");
  });

  it("flags subjects below the attendance threshold with the exact streak needed", () => {
    // 1/3 = 33.3%; needs (1+x)/(3+x) >= 0.75 -> x = 5
    seed({ subjects: [subject({ attended: 1, conducted: 3 })] });
    const facts = recoveryFacts();
    expect(facts.needed).toBe(true);
    expect(facts.text).toContain("Low attendance: Maths 1/3 = 33.3%; must attend next 5 classes in a row.");
  });

  it("lists overdue tasks as missed deadlines, excluding study and class entries", () => {
    seed({
      tasks: [
        task({ date: d(-1) }),
        task({ id: "t2", title: "Old study block", type: "study", date: d(-2), planned: true }),
        task({ id: "t3", title: "Past lecture", type: "class", date: d(-2) }),
      ],
    });
    const facts = recoveryFacts();
    expect(facts.text).toContain(`Missed deadline: Assignment 5 (Maths, assignment) was due ${d(-1)}.`);
    expect(facts.text).not.toContain("Old study block (Maths");
    expect(facts.text).not.toContain("Past lecture (Maths");
    expect(facts.text).toContain("Missed study sessions: 1.");
  });

  it("ignores completed overdue tasks", () => {
    seed({ tasks: [task({ date: d(-1), done: true })] });
    expect(recoveryFacts().text).not.toContain("Missed deadline");
  });

  it("summarizes upcoming deadlines and weekly classes, with none fallbacks", () => {
    const facts = recoveryFacts();
    expect(facts.text).toContain("Upcoming deadlines: none");
    expect(facts.text).toContain("Weekly classes: none");

    seed({
      tasks: [task({ title: "Quiz 2", type: "quiz", date: d(5) })],
      timetable: [{ id: "c1", day: 1, subject: "Maths", start: "09:00", end: "10:00" }],
    });
    const withData = recoveryFacts();
    expect(withData.text).toContain(`Upcoming deadlines: Quiz 2 ${d(5)}`);
    expect(withData.text).toContain("Weekly classes: Mon 09:00 Maths");
  });
});
