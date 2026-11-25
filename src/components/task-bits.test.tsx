import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { addDays, format } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDialog, TaskRow } from "./task-bits";
import { getState, setState, type Task } from "@/lib/store";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from "sonner";

const task = (extra: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Read chapter 4",
  subject: "Maths",
  type: "assignment",
  date: "2026-12-01",
  done: false,
  ...extra,
});

function seed(tasks: Task[]) {
  setState(() => ({
    tasks,
    subjects: [],
    timetable: [],
    docs: [],
    chat: [],
    planNote: "",
    aiCalls: 0,
    attendanceRecords: [],
  }));
}

describe("TaskRow", () => {
  beforeEach(() => seed([task()]));
  afterEach(cleanup);

  it("renders the title and type, subject and date meta", () => {
    render(<TaskRow t={task()} />);
    expect(screen.getByText("Read chapter 4")).toBeInTheDocument();
    expect(screen.getByText(/Assignment · Maths · Tue 1 Dec/)).toBeInTheDocument();
  });

  it("toggles done from the round button", () => {
    render(<TaskRow t={task()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));
    expect(getState().tasks[0].done).toBe(true);
  });

  it("postpones the task by one day", () => {
    render(<TaskRow t={task()} />);
    fireEvent.click(screen.getByRole("button", { name: "Postpone one day" }));
    expect(getState().tasks[0].date).toBe(
      format(addDays(new Date("2026-12-01T00:00:00"), 1), "yyyy-MM-dd"),
    );
  });

  it("deletes the task", () => {
    render(<TaskRow t={task()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(getState().tasks).toHaveLength(0);
  });

  it("renders the done state with struck-through title and flip label", () => {
    render(<TaskRow t={task({ done: true })} />);
    expect(screen.getByRole("button", { name: "Mark as not done" })).toBeInTheDocument();
    expect(screen.getByText("Read chapter 4")).toHaveClass("line-through");
  });

  it("hides the action buttons in compact mode", () => {
    render(<TaskRow t={task()} compact />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as done" })).toBeInTheDocument();
  });
});

describe("TaskDialog", () => {
  beforeEach(() => seed([]));
  afterEach(cleanup);

  const openAndFill = (fields: { title?: string; subject?: string }) => {
    render(<TaskDialog trigger={<button>Add</button>} defaults={{ date: "2026-12-05" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    if (fields.title !== undefined)
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: fields.title } });
    if (fields.subject !== undefined)
      fireEvent.change(screen.getByLabelText("Subject"), { target: { value: fields.subject } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  };

  it("rejects a save without a title and keeps the store unchanged", () => {
    openAndFill({ subject: "Maths" });
    expect(toast.error).toHaveBeenCalledWith("Title, subject and date are required.");
    expect(getState().tasks).toHaveLength(0);
  });

  it("adds a valid task and ensures its subject exists", () => {
    openAndFill({ title: "Quiz 3", subject: "Physics" });
    const tasks = getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: "Quiz 3",
      subject: "Physics",
      type: "assignment",
      date: "2026-12-05",
      done: false,
    });
    expect(getState().subjects.map((s) => s.name)).toEqual(["Physics"]);
    expect(toast.success).toHaveBeenCalledWith("Saved");
  });

  it("rejects duplicates on the same date", () => {
    seed([task({ title: "Quiz 3", subject: "Physics", date: "2026-12-05" })]);
    openAndFill({ title: "Quiz 3", subject: "Physics" });
    expect(toast.error).toHaveBeenCalledWith("A matching item already exists on that date.");
    expect(getState().tasks).toHaveLength(1);
  });

  it("edits the existing task instead of adding a new one", () => {
    seed([task()]);
    render(<TaskDialog task={task()} trigger={<button>Edit</button>} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Read chapter 5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(getState().tasks).toHaveLength(1);
    expect(getState().tasks[0].title).toBe("Read chapter 5");
  });
});
