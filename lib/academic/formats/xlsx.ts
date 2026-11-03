/**
 * Client-side OOXML (.xlsx) reader. Deliberately dependency-light: `fflate`
 * only unzips and inflates; the sheet XML is parsed here so no third-party
 * spreadsheet engine (and no external service) is involved.
 *
 * Legacy binary .xls is NOT an OOXML zip and is reported as unsupported rather
 * than silently mis-read. Convert it to .xlsx or CSV, or use manual entry.
 */
import { strFromU8, unzipSync } from "fflate";

export function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([\da-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&");
}

function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/.exec(reference)?.[1] ?? "A";
  let value = 0;
  for (const letter of letters) value = value * 26 + (letter.toUpperCase().charCodeAt(0) - 64);
  return value - 1;
}

function rowIndex(reference: string): number {
  return Math.max(0, Number(/^[A-Z]*(\d+)/.exec(reference)?.[1] ?? "1") - 1);
}

/** Shared strings table (`t="s"`) and inline strings (`t="inlineStr"`). */
function readSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const parts = [...(match[1] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((item) => decodeXml((item[1] ?? "").replace(/<[^>]+>/g, "")));
    out.push(parts.join(""));
  }
  return out;
}

export interface XlsxSheet {
  name: string;
  grid: string[][];
}

/** List worksheet names in workbook order (best-effort, never throws). */
export function sheetNames(bytes: Uint8Array): string[] {
  try {
    const files = unzipSync(bytes);
    const workbook = files["xl/workbook.xml"];
    if (!workbook) return [];
    return [...strFromU8(workbook).matchAll(/<sheet\b[^>]*name="([^"]*)"/g)].map((match) => decodeXml(match[1] ?? ""));
  } catch {
    return [];
  }
}

/** Excel serial date (1900 system) -> YYYY-MM-DD, when a cell is clearly a date. */
export function excelSerialToDateKey(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20_000 || serial > 80_000) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Read a worksheet into a rectangular grid. Sparse cells become "" so that a
 * matrix timetable keeps its columns aligned.
 */
export function readXlsxGrid(bytes: Uint8Array, sheet = 1): string[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("This is not a readable .xlsx file. Legacy .xls is not supported — save as .xlsx or CSV.");
  }
  const sharedEntry = files["xl/sharedStrings.xml"];
  const shared = sharedEntry ? readSharedStrings(strFromU8(sharedEntry)) : [];
  const sheetEntry = files[`xl/worksheets/sheet${sheet}.xml`]
    ?? Object.entries(files).find(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))?.[1];
  if (!sheetEntry) throw new Error("No worksheet was found in this workbook.");
  const xml = strFromU8(sheetEntry);
  const cells = new Map<string, string>();
  let maxRow = 0;
  let maxColumn = 0;

  for (const match of xml.matchAll(/<c\b([^>]*)>/g)) {
    const openTag = match[0] ?? "";
    const attributes = match[1] ?? "";
    const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1] ?? "";
    if (!reference) continue;
    const type = /\bt="([^"]+)"/.exec(attributes)?.[1] ?? "n";
    const row = rowIndex(reference);
    const column = columnIndex(reference);
    let value = "";
    if (!/\/>$/.test(openTag)) {
      // `<c ...>` may be self-closing; otherwise consume up to `</c>`.
      const from = (match.index ?? 0);
      const close = xml.indexOf("</c>", from);
      const body = close > from ? xml.slice(from, Math.min(close + 4, from + 8000)) : "";
      if (type === "inlineStr") {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
          .map((item) => decodeXml((item[1] ?? "").replace(/<[^>]+>/g, ""))).join("");
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
        const decoded = decodeXml(raw);
        value = type === "s" ? (shared[Number(decoded)] ?? "") : decoded;
      }
    }
    if (type === "n" && value && /^\d{5}(\.\d+)?$/.test(value)) {
      const asDate = excelSerialToDateKey(Number(value));
      if (asDate) value = asDate;
    }
    cells.set(`${row}:${column}`, value.trim());
    maxRow = Math.max(maxRow, row);
    maxColumn = Math.max(maxColumn, column);
  }
  const grid: string[][] = [];
  for (let row = 0; row <= maxRow; row += 1) {
    const line: string[] = [];
    for (let column = 0; column <= maxColumn; column += 1) line.push(cells.get(`${row}:${column}`) ?? "");
    grid.push(line);
  }
  return grid.filter((row) => row.some((cell) => cell.length > 0));
}
