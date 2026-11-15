import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, ExternalLink, FileUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ai, extractPdf, parseJSON, ytLink } from "@/lib/client";
import { setState, uid, useStore, type Doc } from "@/lib/store";
import { toast } from "sonner";
import { AiStatus } from "@/components/ai-bits";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "PDF Learning Assistant — MUeRA" },
      {
        name: "description",
        content:
          "Upload lecture notes to get summaries, revision notes, practice quizzes, flashcards and topic videos.",
      },
      { property: "og:title", content: "PDF Learning Assistant — MUeRA" },
      {
        property: "og:description",
        content: "Turn lecture notes into summaries, quizzes and flashcards.",
      },
    ],
  }),
  component: Learn,
});

const MAX_CHARS = 24000;
type Q = { q: string; options: string[]; answer: number; why: string };
type F = { front: string; back: string };

function Learn() {
  const s = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [aiError, setAiError] = useState<{
    msg: string;
    mode: "summary" | "notes" | "quiz" | "flashcards";
  } | null>(null);
  const [pending, setPending] = useState<{
    name: string;
    pages: string[];
    from: number;
    to: number;
  } | null>(null);
  const doc = s.docs.find((d) => d.id === (sel ?? s.docs[0]?.id));

  const onFile = async (f: File) => {
    if (f.type !== "application/pdf") return toast.error("Please upload a PDF.");
    setBusy("Reading PDF on your device…");
    try {
      const pages = await extractPdf(f, (p) => setBusy(`Reading PDF… ${Math.round(p * 100)}%`));
      setBusy("");
      if (!pages.join("").trim())
        return toast.error("This PDF has no selectable text (scanned pages aren't supported yet).");
      setPending({ name: f.name, pages, from: 1, to: pages.length });
    } catch {
      setBusy("");
      toast.error("Couldn't read this PDF.");
    }
  };
  const confirm = () => {
    if (!pending) return;
    const text = pending.pages
      .slice(pending.from - 1, pending.to)
      .map((t, i) => `[Page ${pending.from + i}] ${t}`)
      .join("\n");
    const d: Doc = {
      id: uid(),
      name: pending.name,
      pages: pending.to - pending.from + 1,
      text,
      cache: {},
    };
    setState((st) => ({ docs: [...st.docs, d] }));
    setSel(d.id);
    setPending(null);
  };

  const run = async (mode: "summary" | "notes" | "quiz" | "flashcards") => {
    if (!doc) return;
    if (doc.cache[mode]) return;
    setAiError(null);
    setBusy("MUeRA is reading your notes…");
    const r = await ai(mode, `Document: ${doc.name}`, doc.text.slice(0, MAX_CHARS));
    setBusy("");
    if (r.error) return setAiError({ msg: r.error, mode });
    if ((mode === "quiz" || mode === "flashcards") && !parseJSON(r.text ?? ""))
      return setAiError({
        msg: "The AI reply couldn't be turned into cards. Nothing was saved.",
        mode,
      });
    setState((st) => ({
      docs: st.docs.map((d) =>
        d.id === doc.id ? { ...d, cache: { ...d.cache, [mode]: r.text ?? "" } } : d,
      ),
    }));
  };

  const pendChars = pending ? pending.pages.slice(pending.from - 1, pending.to).join("").length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Assistant"
        sub="PDFs are read on your device. Each result is saved, so it only uses AI once."
      >
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <FileUp className="h-4 w-4" /> Upload PDF
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      </PageHeader>
      <AiStatus
        busy={busy}
        error={aiError?.msg}
        onRetry={aiError ? () => run(aiError.mode) : undefined}
      />

      {pending && (
        <section className="card-surface space-y-3 p-4">
          <p className="text-sm">
            <b>{pending.name}</b> — {pending.pages.length} pages. Choose the pages to study.
          </p>
          <div className="flex items-center gap-2 text-sm">
            Pages{" "}
            <Input
              className="w-20"
              type="number"
              min={1}
              max={pending.pages.length}
              value={pending.from}
              onChange={(e) =>
                setPending({
                  ...pending,
                  from: Math.max(1, Math.min(pending.to, Number(e.target.value))),
                })
              }
            />
            to{" "}
            <Input
              className="w-20"
              type="number"
              min={pending.from}
              max={pending.pages.length}
              value={pending.to}
              onChange={(e) =>
                setPending({
                  ...pending,
                  to: Math.max(
                    pending.from,
                    Math.min(pending.pages.length, Number(e.target.value)),
                  ),
                })
              }
            />
          </div>
          {pendChars > MAX_CHARS && (
            <p className="rounded-lg bg-warning/20 p-2 text-sm">
              This selection is long. To save credits, AI reads only about the first{" "}
              {Math.round((MAX_CHARS / pendChars) * 100)}%. Pick fewer pages (e.g. one chapter) for
              full coverage.
            </p>
          )}
          <Button onClick={confirm}>Add document</Button>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="space-y-2">
          {s.docs.map((d) => (
            <div
              key={d.id}
              className={`flex items-center gap-2 rounded-xl border p-2 text-sm ${doc?.id === d.id ? "bg-accent" : "bg-card"}`}
            >
              <button
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => setSel(d.id)}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="line-clamp-2">{d.name}</span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete document"
                onClick={() => setState((st) => ({ docs: st.docs.filter((x) => x.id !== d.id) }))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!s.docs.length && <p className="text-sm text-muted-foreground">No documents yet.</p>}
        </aside>
        <div className="lg:col-span-3">
          {doc ? (
            <DocView doc={doc} run={run} busy={!!busy} />
          ) : (
            <p className="text-sm text-muted-foreground">Upload lecture notes to begin.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DocView({
  doc,
  run,
  busy,
}: {
  doc: Doc;
  run: (m: "summary" | "notes" | "quiz" | "flashcards") => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<"summary" | "notes" | "quiz" | "flashcards">("summary");
  const content = doc.cache[tab];
  const kw = (doc.cache.summary?.match(/KEYWORDS:\s*(.+)/i)?.[1] ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return (
    <section className="card-surface p-4">
      <h2 className="font-bold">{doc.name}</h2>
      <p className="text-xs text-muted-foreground">
        {doc.pages} page(s) · results come only from this document
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {(["summary", "notes", "quiz", "flashcards"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {t === "notes" ? "Revision notes" : t}
            {doc.cache[t] ? " ✓" : ""}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {!content ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">Not generated yet.</p>
            <Button className="mt-3" disabled={busy} onClick={() => run(tab)}>
              Generate {tab} (1 AI request)
            </Button>
          </div>
        ) : tab === "quiz" ? (
          <Quiz raw={content} />
        ) : tab === "flashcards" ? (
          <Cards raw={content} />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {content.replace(/KEYWORDS:.*$/im, "")}
          </p>
        )}
      </div>
      {kw.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-sm font-semibold">Find videos on these topics (YouTube search)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {kw.map((k) => (
              <a
                key={k}
                href={ytLink(k)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {k} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Quiz({ raw }: { raw: string }) {
  const qs = parseJSON<Q[]>(raw);
  const [picked, setPicked] = useState<Record<number, number>>({});
  if (!qs) return <p className="whitespace-pre-wrap text-sm">{raw}</p>;
  return (
    <div className="space-y-4">
      {qs.map((q, i) => (
        <div key={i}>
          <p className="text-sm font-semibold">
            {i + 1}. {q.q}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {q.options.map((o, j) => {
              const p = picked[i];
              const state =
                p == null
                  ? "bg-muted"
                  : j === q.answer
                    ? "bg-success text-success-foreground"
                    : j === p
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted opacity-60";
              return (
                <button
                  key={j}
                  disabled={p != null}
                  onClick={() => setPicked({ ...picked, [i]: j })}
                  className={`rounded-lg px-3 py-2 text-left text-sm ${state}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {picked[i] != null && <p className="mt-1 text-xs text-muted-foreground">{q.why}</p>}
        </div>
      ))}
      <p className="text-sm font-semibold">
        Score: {Object.entries(picked).filter(([i, j]) => qs[Number(i)].answer === j).length}/
        {qs.length}
      </p>
    </div>
  );
}

function Cards({ raw }: { raw: string }) {
  const cs = parseJSON<F[]>(raw);
  const [flip, setFlip] = useState<Record<number, boolean>>({});
  if (!cs) return <p className="whitespace-pre-wrap text-sm">{raw}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {cs.map((c, i) => (
        <button
          key={i}
          onClick={() => setFlip({ ...flip, [i]: !flip[i] })}
          className={`min-h-28 rounded-2xl p-4 text-sm font-medium shadow-soft ${flip[i] ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
        >
          {flip[i] ? c.back : c.front}
        </button>
      ))}
    </div>
  );
}
