import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, FileUp, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { TaskFields } from "@/components/task-bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ai, parseJSON } from "@/lib/client";
import { regenerate } from "@/lib/replan";
import { actions, getState, isDuplicate, today, type Task, type TaskType } from "@/lib/store";
import { toast } from "sonner";
import { TimetableReview } from "@/components/timetable-review";
import { readTimetable } from "@/lib/timetable-reader";
import {
  extractTimetable,
  canonicalSubject,
  classifySubject,
  type ClassKind,
  type TimetableDraft,
} from "@/lib/timetable";
import { AiStatus } from "@/components/ai-bits";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Smart Document Scanner — MUeRA" },
      {
        name: "description",
        content:
          "Upload college notices and timetables, confirm extracted dates, and add them to your calendar.",
      },
      { property: "og:title", content: "Smart Document Scanner — MUeRA" },
      {
        property: "og:description",
        content: "Turn college notices into calendar events in seconds.",
      },
    ],
  }),
  component: Scan,
});

type Draft = Partial<Task> & { key: string; uncertain?: boolean };
const SAMPLE = `NOTICE — Department of Computer Science\nQuiz 2 for Data Structures (Trees & Heaps) will be held on ${today()} at 10:00 in LH-2.\nAssignment 4 for Linear Algebra must be submitted by ${today()}.\nBring your ID card.`;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function findDate(line: string): string {
  let m = line.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = line.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m)
    return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = line.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?,?\s*(\d{4})?/);
  if (m && MONTHS.includes(m[2].toLowerCase()))
    return `${m[3] ?? new Date().getFullYear()}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

/** Free rule-based extraction (no AI). */
function ruleExtract(text: string): Draft[] {
  const subjects = getState().subjects.map((s) => s.name);
  return text
    .split(/\n|(?<=\.)\s/)
    .map((l) => l.trim())
    .filter((l) =>
      /quiz|exam|test|assignment|submission|submit|deadline|lab|viva|mid-?sem|end-?sem/i.test(l),
    )
    .map((l) => {
      const type: TaskType = /exam|mid-?sem|end-?sem/i.test(l)
        ? "exam"
        : /quiz|test|viva/i.test(l)
          ? "quiz"
          : "assignment";
      const subject = subjects.find((s) => l.toLowerCase().includes(s.toLowerCase())) ?? "";
      const time = l.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      const date = findDate(l);
      return {
        key: Math.random().toString(36),
        title: l.slice(0, 70),
        subject,
        type,
        date,
        time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : "",
        notes: l,
        uncertain: !date || !subject,
      };
    });
}

function Scan() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [fileNote, setFileNote] = useState("");
  const [mode, setMode] = useState<"notice" | "timetable">("timetable");
  const [schedule, setSchedule] = useState<ReturnType<typeof extractTimetable> | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [aiError, setAiError] = useState("");

  const onFile = async (f: File) => {
    setFileNote("");
    setSchedule(null);
    setDrafts([]);
    setText("");
    setBusy("Reading document…");
    try {
      const t = (await readTimetable(f, setBusy)).trim();
      setText(t);
      if (!t)
        setFileNote(
          "No readable text found. Try a sharper image, a text-based PDF, or enter classes manually.",
        );
    } catch {
      setFileNote(
        "Couldn't read this document. Check your connection for the first OCR download, retry with a clear image, or paste the text.",
      );
    } finally {
      setBusy("");
    }
  };

  const runAITimetable = async () => {
    setAiError("");
    setBusy("AI is reading your timetable…");
    const r = await ai("timetable", "Extract the weekly timetable.", text);
    setBusy("");
    if (r.error) return setAiError(r.error);
    const arr = parseJSON<
      {
        subject?: string;
        kind?: string;
        day?: number;
        start?: string;
        end?: string;
        uncertain?: boolean;
      }[]
    >(r.text ?? "");
    if (!arr?.length)
      return setAiError(
        "AI found no classes. Try Quick extract, a clearer file, or add classes manually.",
      );
    const kinds: ClassKind[] = ["theory", "lab", "practical", "activity"];
    const tm = (v?: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v ?? "") ? v! : "");
    const entries: TimetableDraft[] = arr
      .filter((e) => e.subject?.trim())
      .map((e) => {
        const subject = canonicalSubject(String(e.subject));
        const day = Number.isInteger(e.day) && e.day! >= 0 && e.day! <= 6 ? e.day : undefined;
        const start = tm(e.start),
          end = tm(e.end);
        return {
          key: Math.random().toString(36),
          subject,
          kind: kinds.includes(e.kind as ClassKind)
            ? (e.kind as ClassKind)
            : classifySubject(subject),
          day,
          start,
          end,
          uncertain: !!e.uncertain || day == null || !start || !end || end <= start,
          source: "AI",
        };
      });
    const local = extractTimetable(text);
    const subjects = [
      ...new Map(
        entries.map((e) => [e.subject.toLowerCase(), { name: e.subject, kind: e.kind }]),
      ).values(),
    ];
    setSchedule({ entries, subjects, effective: local.effective });
    setReviewVersion((v) => v + 1);
  };

  const runAI = async () => {
    setAiError("");
    setBusy("Extracting with AI…");
    const r = await ai("extract", `Today is ${today()}. Extract events from this notice.`, text);
    setBusy("");
    if (r.error) return setAiError(r.error);
    const arr = parseJSON<Draft[]>(r.text ?? "");
    if (!arr?.length)
      return setAiError("AI found no events. Try the free extractor or add manually.");
    setDrafts(
      arr.map((d) => ({
        ...d,
        key: Math.random().toString(36),
        time: d.time || undefined,
        uncertain: d.uncertain || !d.date,
      })),
    );
  };

  const save = () => {
    let added = 0,
      dup = 0;
    for (const d of drafts) {
      if (!d.title || !d.date || !d.subject) continue;
      const t = {
        title: d.title,
        subject: d.subject,
        type: (d.type ?? "assignment") as TaskType,
        date: d.date,
        time: d.time || undefined,
        notes: d.notes,
        reminderMin: 60,
      };
      if (isDuplicate(t)) {
        dup++;
        continue;
      }
      actions.addTask(t);
      actions.ensureSubject(t.subject);
      added++;
    }
    if (drafts.some((d) => !d.title || !d.date || !d.subject))
      toast.warning("Items missing title, subject or date were skipped.");
    if (!added) {
      toast.error(
        dup
          ? "Matching items are already saved; nothing new was added."
          : "Nothing saved. Enter a title, subject and date for at least one item.",
      );
      return;
    }
    if (added) regenerate(`${added} new item(s) added from a scanned document.`);
    toast.success(`Added ${added} item(s)${dup ? `, skipped ${dup} duplicate(s)` : ""}.`);
    setDrafts([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Scanner"
        sub="Upload a notice, check what MUeRA found, then save it to your calendar."
      />
      <div className="flex gap-2">
        {(["timetable", "notice"] as const).map((v) => (
          <Button
            key={v}
            variant={mode === v ? "default" : "outline"}
            onClick={() => {
              setMode(v);
              setDrafts([]);
              setSchedule(null);
            }}
          >
            {v === "timetable" ? "Weekly timetable" : "Notice / deadline"}
          </Button>
        ))}
      </div>
      <section className="card-surface space-y-3 p-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center hover:bg-muted">
          <FileUp className="h-8 w-8 text-primary" />
          <span className="font-semibold">Upload PDF or image</span>
          <span className="text-xs text-muted-foreground">
            Announcements, assignment sheets, quiz or exam timetables
          </span>
          <input
            type="file"
            accept="application/pdf,image/*"
            disabled={!!busy}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {fileNote && (
          <p className="flex gap-2 rounded-lg bg-warning/20 p-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {fileNote}
          </p>
        )}
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…or paste the notice text here"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!text.trim() || !!busy}
            onClick={() => {
              if (mode === "timetable") {
                const r = extractTimetable(text);
                setSchedule(r);
                setReviewVersion((v) => v + 1);
                if (!r.entries.length)
                  setFileNote(
                    "No class times could be read confidently. Detected subjects are retained below. Add or correct classes manually, or retry with a clearer document.",
                  );
              } else {
                const d = ruleExtract(text);
                setDrafts(d);
                if (!d.length)
                  toast.error(
                    "No events found. Paste dates and subjects, try AI extraction, or add manually.",
                  );
              }
            }}
          >
            <Wand2 className="h-4 w-4" /> Quick extract (free)
          </Button>
          {mode === "timetable" && (
            <Button variant="outline" disabled={!text.trim() || !!busy} onClick={runAITimetable}>
              <Sparkles className="h-4 w-4" /> Extract with AI (1 request)
            </Button>
          )}
          {mode === "notice" && (
            <>
              <Button variant="outline" disabled={!text.trim() || !!busy} onClick={runAI}>
                <Sparkles className="h-4 w-4" /> Extract with AI (1 request)
              </Button>
              <Button variant="ghost" onClick={() => setText(SAMPLE)}>
                Use sample quiz notice
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              if (mode === "timetable") {
                setSchedule({ entries: [], subjects: [], effective: "" });
                setReviewVersion((v) => v + 1);
              } else
                setDrafts((d) => [
                  ...d,
                  { key: Math.random().toString(36), type: "assignment", date: today() },
                ]);
            }}
          >
            <Plus className="h-4 w-4" /> Add manually
          </Button>
        </div>
        <AiStatus
          busy={busy}
          error={aiError}
          onRetry={mode === "timetable" ? runAITimetable : runAI}
        />
        <p className="text-xs text-muted-foreground">
          Files are read on your device. Only the text shown above is sent when you choose AI
          extraction. Nothing is saved until you confirm.
        </p>
      </section>
      {schedule && <TimetableReview key={reviewVersion} result={schedule} />}

      {drafts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Please confirm before saving</h2>
          {drafts.map((d, i) => (
            <div
              key={d.key}
              className={`card-surface space-y-2 p-4 ${d.uncertain ? "border-warning" : ""}`}
            >
              <div className="flex justify-between">
                {d.uncertain ? (
                  <span className="text-xs font-semibold text-warning-foreground">
                    ⚠ Please check the subject and date
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Looks complete</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove"
                  onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <TaskFields
                v={d}
                set={(p) => setDrafts((x) => x.map((y, j) => (j === i ? { ...y, ...p } : y)))}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button onClick={save}>Save to calendar</Button>
            <Button asChild variant="outline">
              <Link to="/calendar">Open calendar</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
