import { setState } from "./store";

export type Mode =
  | "summary"
  | "notes"
  | "quiz"
  | "flashcards"
  | "extract"
  | "chat"
  | "plan"
  | "recovery"
  | "timetable";

/** Single reusable AI entry point. Counts calls so the student can see usage. */
export async function ai(
  mode: Mode,
  prompt: string,
  context = "",
): Promise<{ text?: string; error?: string; noCredit?: boolean }> {
  void mode;
  void prompt;
  void context;
  // The AI backend (server route, provider integration and PHP API) is
  // intentionally not part of this public snapshot. AI features in the UI
  // show this message instead of pretending AI is configured.
  setState((s) => ({ aiCalls: s.aiCalls + 1 }));
  return {
    error:
      "AI is not included in this public source snapshot. Everything else in MUeRA still works.",
  };
}

export function parseJSON<T>(text: string): T | null {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

export async function extractPdf(file: File, onProgress?: (p: number) => void) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    pages.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    onProgress?.(i / doc.numPages);
  }
  return pages;
}

export function ytLink(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " explained")}`;
}
