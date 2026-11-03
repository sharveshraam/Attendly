/**
 * Optional, fully local OCR for timetable screenshots and scanned documents.
 *
 * Tesseract.js runs in a same-origin Web Worker with WASM and English language
 * data vendored under `/vendor/ocr` by `scripts/vendor-ocr-assets.mjs`.
 * No CDN, no network call, no API key, no service-role credential.
 *
 * OCR output is ALWAYS returned at `low` confidence: every derived row is
 * flagged for human confirmation. If the local assets or WASM are unavailable,
 * this throws `OcrUnavailableError` and the UI falls back to manual entry —
 * it never pretends to have read the image.
 */
import type { PositionedText } from "../grid.ts";

export class OcrUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrUnavailableError";
  }
}

export interface OcrWord {
  text: string;
  x: number;
  y: number;
  confidence: number;
}

export interface OcrResult {
  items: PositionedText[];
  text: string;
  words: OcrWord[];
  averageConfidence: number;
}

interface RawWord {
  text?: string;
  confidence?: number;
  bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
}
interface RawNode {
  words?: RawWord[];
  lines?: RawNode[];
  paragraphs?: RawNode[];
  blocks?: RawNode[];
}

function collectWords(node: RawNode | null | undefined, out: RawWord[]): void {
  if (!node) return;
  for (const word of node.words ?? []) out.push(word);
  for (const line of node.lines ?? []) collectWords(line, out);
  for (const paragraph of node.paragraphs ?? []) collectWords(paragraph, out);
  for (const block of node.blocks ?? []) collectWords(block, out);
}

/** Convert Tesseract's block/line/word tree into positioned text items. */
export function ocrBlocksToItems(data: unknown): OcrResult {
  const root = (data ?? {}) as RawNode;
  const raw: RawWord[] = [];
  collectWords(root, raw);
  const words: OcrWord[] = [];
  for (const word of raw) {
    const text = (word.text ?? "").trim();
    if (!text) continue;
    words.push({
      text,
      x: word.bbox?.x0 ?? 0,
      y: word.bbox?.y0 ?? 0,
      confidence: word.confidence ?? 0,
    });
  }
  const items: PositionedText[] = words.map((word) => ({ x: word.x, y: word.y, text: word.text }));
  const lineMap = new Map<number, OcrWord[]>();
  for (const word of words) {
    const line = Math.round(word.y / 8) * 8;
    const list = lineMap.get(line) ?? [];
    list.push(word);
    lineMap.set(line, list);
  }
  const text = [...lineMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, line]) => line.sort((a, b) => a.x - b.x).map((word) => word.text).join(" "))
    .join("\n");
  const averageConfidence = words.length === 0
    ? 0
    : words.reduce((sum, word) => sum + word.confidence, 0) / words.length;
  return { items, text, words, averageConfidence };
}

const VENDOR = "/vendor/ocr";

/** Lazily load the OCR worker so it never affects initial page load. */
export async function readImageWithOcr(file: Blob): Promise<OcrResult> {
  const assets = await fetch(`${VENDOR}/worker.min.js`, { method: "HEAD" }).catch(() => null);
  if (!assets?.ok) {
    throw new OcrUnavailableError(
      "Local OCR assets are not installed. Run `npm run vendor:ocr` and reload, or use CSV / PDF with a text layer / manual entry.",
    );
  }
  interface OcrWorkerLike {
    recognize: (image: Blob, options: Record<string, unknown>, output: Record<string, boolean>) => Promise<{ data: unknown }>;
    terminate: () => Promise<unknown>;
  }
  let createWorker: (langs: string, oem: number, options: Record<string, unknown>) => Promise<OcrWorkerLike>;
  try {
    const tesseractModule = await import("tesseract.js");
    createWorker = tesseractModule.createWorker as unknown as typeof createWorker;
  } catch {
    throw new OcrUnavailableError("The OCR engine could not be loaded. Use CSV or manual entry instead.");
  }
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker("eng", 1, {
      workerPath: `${VENDOR}/worker.min.js`,
      corePath: `${VENDOR}/tesseract-core-simd-lstm.wasm.js`,
      langPath: VENDOR,
      workerBlobURL: false,
      cacheMethod: "none",
    });
  } catch (cause) {
    throw new OcrUnavailableError(
      `The OCR worker could not start (${cause instanceof Error ? cause.message : "unknown error"}). Use manual entry instead.`,
    );
  }
  try {
    const result = await worker.recognize(file, {}, { text: true, blocks: true });
    const parsed = ocrBlocksToItems(result.data);
    if (parsed.words.length === 0) {
      throw new OcrUnavailableError("No text could be recognised in this image. Enter the timetable manually.");
    }
    return parsed;
  } catch (cause) {
    if (cause instanceof OcrUnavailableError) throw cause;
    throw new OcrUnavailableError(
      `OCR failed (${cause instanceof Error ? cause.message : "unknown error"}). Enter the timetable manually.`,
    );
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
