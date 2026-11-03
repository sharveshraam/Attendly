/**
 * Local PDF text-layer extraction. No server, no OCR service, no AI.
 *
 * Inflates FlateDecode content streams, walks the text-showing operators
 * (Tm / Td / TD / T* / Tj / TJ / ' / ") and emits positioned text items which
 * the shared grid interpreter clusters into rows/columns. This preserves
 * timetable layout, which a plain "extract all text" dump would destroy.
 *
 * Scanned PDFs (image-only, no text layer) return zero items; the caller then
 * shows an honest "no readable text" state and offers image OCR or manual
 * entry. Encrypted/object-stream PDFs are likewise reported, never guessed.
 */
import { inflateSync, strFromU8 } from "fflate";
import type { PositionedText } from "../grid.ts";

export interface PdfText {
  items: PositionedText[];
  text: string;
  streamCount: number;
  warnings: string[];
}

function decodePdfString(raw: string): string {
  const out: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "\\" && index + 1 < raw.length) {
      const next = raw[index + 1];
      index += 1;
      if (next === "n") out.push("\n");
      else if (next === "r") out.push("\r");
      else if (next === "t") out.push("\t");
      else if (next === "b") out.push("\b");
      else if (next === "f") out.push("\f");
      else if (next && /[0-7]/.test(next)) {
        let octal = next;
        while (octal.length < 3 && raw[index + 1] && /[0-7]/.test(raw[index + 1])) {
          index += 1;
          octal += raw[index];
        }
        out.push(String.fromCharCode(Number.parseInt(octal, 8)));
      } else out.push(next ?? "");
    } else if (char === "\r") out.push(" ");
    else out.push(char ?? "");
  }
  return out.join("");
}

function hexString(raw: string): string {
  const hex = raw.replace(/\s+/g, "");
  let out = "";
  for (let index = 0; index + 1 < hex.length; index += 2) {
    out += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16));
  }
  return out;
}

/** Extract literal strings `( ... )` and hex strings `< ... >` from an operand. */
function readStrings(operand: string): string[] {
  const out: string[] = [];
  const pattern = /\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g;
  for (const match of operand.matchAll(pattern)) {
    if (match[1] !== undefined) out.push(decodePdfString(match[1]));
    else if (match[2] !== undefined) out.push(hexString(match[2]));
  }
  return out;
}

interface TextState {
  x: number;
  y: number;
  lineX: number;
  lineY: number;
  leading: number;
  fontSize: number;
}

function interpretContentStream(content: string, items: PositionedText[]): void {
  const state: TextState = { x: 0, y: 0, lineX: 0, lineY: 0, leading: 12, fontSize: 12 };
  // Tokenise into operands and operators. Text strings may contain spaces.
  const tokens = content.match(/\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>|\[[^\]]*\]|[^\s()\[\]<>]+|\bT\*\b/g) ?? [];
  const operands: string[] = [];
  const numbers = () => operands.map(Number).filter((value) => Number.isFinite(value));

  for (const token of tokens) {
    const operator = /^[A-Za-z'"*]+$/.test(token) ? token : null;
    if (!operator) {
      operands.push(token);
      continue;
    }
    switch (operator) {
      case "BT":
        state.x = 0; state.y = 0; state.lineX = 0; state.lineY = 0;
        break;
      case "Tm": {
        const values = numbers();
        if (values.length >= 6) {
          state.x = values[4] ?? 0;
          state.y = values[5] ?? 0;
          state.lineX = state.x;
          state.lineY = state.y;
        }
        break;
      }
      case "Td":
      case "TD": {
        const values = numbers();
        state.lineX += values[values.length - 2] ?? 0;
        state.lineY += values[values.length - 1] ?? 0;
        state.x = state.lineX;
        state.y = state.lineY;
        if (operator === "TD") state.leading = -(values[values.length - 1] ?? 0);
        break;
      }
      case "T*":
        state.lineY -= state.leading;
        state.x = state.lineX;
        state.y = state.lineY;
        break;
      case "Tf": {
        const values = numbers();
        if (values.length >= 1) state.fontSize = values[values.length - 1] ?? state.fontSize;
        break;
      }
      case "TL": {
        const values = numbers();
        if (values.length >= 1) state.leading = values[values.length - 1] ?? state.leading;
        break;
      }
      case "Tj":
      case "'":
      case "\"": {
        if (operator !== "Tj") {
          state.lineY -= state.leading;
          state.x = state.lineX;
          state.y = state.lineY;
        }
        for (const text of readStrings(operands.join(" "))) {
          if (!text.trim()) continue;
          items.push({ x: Math.round(state.x * 10) / 10, y: Math.round(state.y * 10) / 10, text: text.trim() });
          state.x += text.length * state.fontSize * 0.5;
        }
        break;
      }
      case "TJ": {
        const combined = operands.join(" ");
        for (const text of readStrings(combined)) {
          if (!text.trim()) continue;
          items.push({ x: Math.round(state.x * 10) / 10, y: Math.round(state.y * 10) / 10, text: text.trim() });
          state.x += text.length * state.fontSize * 0.5;
        }
        break;
      }
      default:
        break;
    }
    operands.length = 0;
  }
}

/** Extract positioned text from every content stream in a PDF. */
export function readPdfText(bytes: Uint8Array): PdfText {
  const warnings: string[] = [];
  const raw = strFromU8(bytes, true);
  const items: PositionedText[] = [];
  let streamCount = 0;
  let cursor = 0;
  while (cursor < raw.length) {
    const streamStart = raw.indexOf("stream", cursor);
    if (streamStart < 0) break;
    const contentStart = raw.indexOf("\n", streamStart) >= 0 && raw.indexOf("\n", streamStart) < raw.indexOf("\r", streamStart) + 2
      ? raw.indexOf("\n", streamStart) + 1
      : streamStart + 6;
    const end = raw.indexOf("endstream", contentStart);
    if (end < 0) break;
    const dictWindow = raw.slice(Math.max(0, streamStart - 500), streamStart);
    const slice = bytes.slice(contentStart, end);
    let content = "";
    if (/\/FlateDecode/.test(dictWindow)) {
      try {
        content = strFromU8(inflateSync(slice), true);
      } catch {
        // Some PDFs pad the stream; retry with trailing whitespace trimmed.
        try {
          content = strFromU8(inflateSync(slice.subarray(0, Math.max(0, slice.length - 2))), true);
        } catch {
          warnings.push("One compressed PDF stream could not be decompressed; its text was skipped.");
        }
      }
    } else if (!/\/Image|DCTDecode|JPXDecode|CCITTFaxDecode|ASCII85Decode/.test(dictWindow)) {
      content = strFromU8(slice, true);
    }
    if (content && /BT[\s\S]*?ET|Tj|TJ/.test(content)) {
      streamCount += 1;
      interpretContentStream(content, items);
    }
    cursor = end + 9;
  }
  if (items.length === 0) {
    warnings.push("No readable text layer was found. This looks like a scanned PDF — use the image OCR option or enter the timetable manually.");
  }
  const lines = [...new Set(items.map((item) => Math.round(item.y)))].sort((a, b) => b - a);
  const text = lines
    .map((y) => items.filter((item) => Math.round(item.y) === y).sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
    .join("\n");
  return { items, text, streamCount, warnings };
}
