/**
 * One entry point for every supported academic document format.
 * All extraction happens locally in the browser; nothing is uploaded to an
 * extraction service. The private Supabase Storage copy is handled by
 * `lib/data.ts` and is used only for provenance / re-opening the document.
 */
import { parseCsv } from "../../import/csv.ts";
import { interpretCalendarGrid } from "../calendar.ts";
import { interpretTimetableGrid, positionedTextToGrid } from "../grid.ts";
import type { CalendarExtraction, Confidence, TimetableExtraction } from "../types.ts";
import { sha256Hex } from "./hash.ts";
import { OcrUnavailableError, readImageWithOcr } from "./ocr.ts";
import { readPdfText } from "./pdf.ts";
import { readXlsxGrid, sheetNames } from "./xlsx.ts";

export type AcademicDocumentKind = "timetable" | "academic_calendar";
export type DocumentFormat = "csv" | "xlsx" | "pdf" | "image" | "text" | "xls" | "unknown";

export interface UploadLike {
  name: string;
  size: number;
  type: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ExtractedDocument {
  grid: string[][];
  text: string;
  confidence: Confidence;
  source: string;
  format: DocumentFormat;
  contentHash: string;
  warnings: string[];
  needsReview: boolean;
  /** Set when automatic extraction could not run; the UI offers manual entry. */
  unavailable: string | null;
  /** Extra worksheets, offered in the UI when a workbook has several sheets. */
  sheetNames: string[];
}

export function extensionOf(name: string): string {
  return name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
}

export function formatOf(name: string): DocumentFormat {
  const extension = extensionOf(name);
  if (extension === "csv" || extension === "tsv" || extension === "txt") return "csv";
  if (extension === "xlsx" || extension === "xlsm") return "xlsx";
  if (extension === "xls") return "xls";
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "bmp", "gif"].includes(extension)) return "image";
  return "unknown";
}

function gridFromDelimited(text: string): string[][] {
  const delimiter = text.includes("\t") ? "\t" : ",";
  return parseCsv(delimiter === "," ? text : text.replace(/\t/g, ","));
}

export async function extractAcademicDocument(
  file: UploadLike,
  options: { sheet?: number } = {},
): Promise<ExtractedDocument> {
  const sheetNumber = Number.isInteger(options.sheet) && (options.sheet ?? 0) > 0 ? options.sheet! : 1;
  const format = formatOf(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = await sha256Hex(bytes);
  const base: Omit<ExtractedDocument, "grid" | "text" | "confidence" | "warnings" | "unavailable" | "needsReview"> = {
    source: file.name, format, contentHash,
    sheetNames: [],
  };
  const unavailable = (message: string): ExtractedDocument => ({
    ...base, grid: [], text: "", confidence: "low", warnings: [message],
    unavailable: message, needsReview: true, sheetNames: base.sheetNames,
  });

  if (format === "xls") {
    return unavailable("Legacy binary .xls is not supported. Save the sheet as .xlsx or CSV, or paste the rows into manual entry.");
  }
  if (format === "csv") {
    const text = await file.text();
    return {
      ...base, grid: gridFromDelimited(text), text, confidence: "high",
      warnings: [], unavailable: null, needsReview: false, sheetNames: [],
    };
  }
  if (format === "xlsx") {
    try {
      const names = sheetNames(bytes);
      const grid = readXlsxGrid(bytes, sheetNumber);
      return {
        ...base, grid, text: grid.map((row) => row.join(" | ")).join("\n"),
        confidence: "high", warnings: names.length > 1 ? [`Workbook has ${names.length} sheets; sheet ${sheetNumber} was read. Choose another sheet in the review screen if needed.`] : [],
        unavailable: null, needsReview: false, sheetNames: names,
      };
    } catch (cause) {
      return unavailable(cause instanceof Error ? cause.message : "This Excel file could not be read.");
    }
  }
  if (format === "pdf") {
    const result = readPdfText(bytes);
    if (result.items.length === 0) return unavailable(result.warnings[0] ?? "No readable text layer was found in this PDF.");
    const grid = positionedTextToGrid(result.items);
    return {
      ...base, grid, text: result.text, confidence: "low",
      warnings: [...result.warnings, "PDF layout was reconstructed from the text layer; every row needs your confirmation before it is saved."],
      unavailable: null, needsReview: true, sheetNames: [],
    };
  }
  if (format === "image") {
    try {
      const result = await readImageWithOcr(file as unknown as Blob);
      const grid = positionedTextToGrid(result.items, 8);
      return {
        ...base, grid, text: result.text, confidence: "low",
        warnings: [
          `Local OCR read ${result.words.length} words (average confidence ${Math.round(result.averageConfidence)}%). Every row needs your confirmation.`,
        ],
        unavailable: null, needsReview: true, sheetNames: [],
      };
    } catch (cause) {
      const message = cause instanceof OcrUnavailableError ? cause.message : "Local OCR is unavailable for this image.";
      return unavailable(message);
    }
  }
  return unavailable("Unsupported format. Use PDF, PNG/JPG/WEBP, XLSX or CSV, or paste the timetable as text.");
}

/** Build a synthetic UploadLike from pasted text (manual fallback). */
export function fromPastedText(text: string, kind: AcademicDocumentKind): Promise<ExtractedDocument> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const file: UploadLike = {
    name: kind === "timetable" ? "pasted-timetable.csv" : "pasted-calendar.csv",
    size: bytes.byteLength,
    type: "text/csv",
    text: async () => text,
    arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
  };
  return extractAcademicDocument(file);
}

export function interpretDocument(
  document: ExtractedDocument,
  kind: AcademicDocumentKind,
): TimetableExtraction | CalendarExtraction {
  const options = { source: document.source, confidence: document.confidence };
  const extraction = kind === "timetable"
    ? interpretTimetableGrid(document.grid, options)
    : interpretCalendarGrid(document.grid, options);
  extraction.warnings.push(...document.warnings);
  return extraction;
}
