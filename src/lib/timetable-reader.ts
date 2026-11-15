/** Browser-only, called on upload. PDF coordinates preserve table rows/columns. */
type Positioned = { text: string; x: number; y: number; width: number };
function rows(items: Positioned[]): string {
  const grouped: Positioned[][] = [];
  items
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach((item) => {
      const row = grouped.find((r) => Math.abs(r[0].y - item.y) < 7);
      if (row) row.push(item);
      else grouped.push([item]);
    });
  return grouped
    .map((r) => {
      r.sort((a, b) => a.x - b.x);
      return r
        .map(
          (item, i) =>
            (i && item.x - (r[i - 1].x + r[i - 1].width) > 16 ? " | " : i ? " " : "") + item.text,
        )
        .join("");
    })
    .join("\n");
}
export async function readTimetable(
  file: File,
  progress: (message: string) => void,
): Promise<string> {
  let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | undefined;
  const ocr = async (source: File | HTMLCanvasElement) => {
    if (!worker) {
      progress("Loading free text recognition…");
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (m) => progress(`Reading image… ${Math.round(m.progress * 100)}%`),
      });
    }
    const result = await worker.recognize(source, {}, { blocks: true });
    const items: Positioned[] = [];
    for (const block of result.data.blocks ?? [])
      for (const paragraph of block.paragraphs)
        for (const line of paragraph.lines)
          for (const word of line.words) {
            items.push({
              text: word.text,
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
            });
          }
    return items.length ? rows(items) : result.data.text;
  };
  try {
    if (file.type.startsWith("image/")) return await ocr(file);
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))
      throw new Error("Upload a PDF or image.");
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
    const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await loadingTask.promise;
    const pages: string[] = [];
    try {
      for (let n = 1; n <= doc.numPages; n++) {
        progress(`Reading PDF page ${n} of ${doc.numPages}…`);
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const items = content.items.flatMap((it) =>
          "str" in it && it.str.trim()
            ? [{ text: it.str, x: it.transform[4], y: -it.transform[5], width: it.width }]
            : [],
        );
        if (items.length) pages.push(rows(items));
        else {
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Could not read scanned PDF page.");
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          pages.push(await ocr(canvas));
        }
      }
    } finally {
      await loadingTask.destroy();
    }
    return pages.join("\n");
  } finally {
    await worker?.terminate();
  }
}
