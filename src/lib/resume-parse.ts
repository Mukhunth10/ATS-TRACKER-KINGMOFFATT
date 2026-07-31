import mammoth from "mammoth";

export interface ParsedResume {
  text: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

/** Extracts plain text from a PDF, DOCX, or plain-text upload. */
export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    // pdf-parse v2 is class-based and pulls in pdfjs-dist, so it is imported
    // lazily — DOCX and TXT uploads should not pay for it.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      // v2 injects "-- 1 of 3 --" separators between pages; they are not resume
      // content and would otherwise show up in the reviewer's text view.
      return result.text.replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, "");
    } finally {
      // pdfjs holds a worker open until the document is destroyed.
      await parser.destroy();
    }
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === "txt" || ext === "md") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported resume format: .${ext}. Use PDF, DOCX, TXT, or MD.`);
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
// A phone number is a run of 10-15 digits with optional separators. Matching on
// total digit count rather than fixed groups keeps Indian (5-5), US (3-3-4) and
// international formats working, and the 10-digit floor rejects years and IDs.
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,4}\d{2,5}/;

function digitCount(s: string) {
  return (s.match(/\d/g) ?? []).length;
}

/**
 * Best-effort contact extraction. This is a convenience to pre-fill the intake
 * form, not a source of truth — the UI lets the recruiter correct every field
 * before saving, because resume headers are wildly inconsistent.
 */
export function extractContact(text: string): Omit<ParsedResume, "text"> {
  const email = text.match(EMAIL)?.[0] ?? null;

  // Scan candidates and keep the first with a plausible digit count, so a stray
  // "2020 - 2024" date range never wins over the real number.
  let phone: string | null = null;
  for (const m of text.matchAll(new RegExp(PHONE, "g"))) {
    const digits = digitCount(m[0]);
    if (digits >= 10 && digits <= 15) {
      phone = m[0].trim().replace(/[\s.-]+$/, "");
      break;
    }
  }

  // Heuristic: the candidate's name is almost always the first substantial line
  // that isn't a contact detail or a section heading.
  let name: string | null = null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3 || line.length > 60) continue;
    if (EMAIL.test(line) || /\d{4}/.test(line)) continue;
    if (/^(curriculum|resume|cv|profile|summary|contact)\b/i.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      name = line;
      break;
    }
  }

  return { name, email, phone };
}
