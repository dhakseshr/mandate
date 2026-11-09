// Minimal, dependency-free PDF writer: monospaced text pages. PayPal's Disputes API only accepts
// PDF / image documents, so Writ's signed evidence pack is rendered as a readable PDF (the
// machine-verifiable JSON + signature are embedded verbatim at the end).

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 54;
const SIZE = 9;
const LEAD = 12;
const COLS = 92; // characters per line at 9pt Courier within the margins

const ascii = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[→]/g, "->")
    .replace(/[·•]/g, "*")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[^\x20-\x7e]/g, "?");

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Hard-wrap at COLS characters, preferring spaces. */
export function wrap(text: string, cols = COLS): string[] {
  const out: string[] = [];
  for (const raw of ascii(text).split("\n")) {
    let line = raw;
    while (line.length > cols) {
      let cut = line.lastIndexOf(" ", cols);
      if (cut < cols * 0.5) cut = cols;
      out.push(line.slice(0, cut));
      line = line.slice(cut).replace(/^ /, "");
    }
    out.push(line);
  }
  return out;
}

export function textPdf(lines: string[]): Uint8Array {
  const perPage = Math.floor((PAGE_H - 2 * MARGIN) / LEAD);
  const wrapped = lines.flatMap((l) => wrap(l));
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += perPage) pages.push(wrapped.slice(i, i + perPage));
  if (!pages.length) pages.push([""]);

  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  const kids: string[] = [];
  pages.forEach((pl, i) => {
    const pageId = 4 + i * 2;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const body =
      `BT /F1 ${SIZE} Tf ${LEAD} TL ${MARGIN} ${PAGE_H - MARGIN} Td\n` +
      pl.map((l) => `(${esc(l)}) Tj T*`).join("\n") +
      `\nET\nBT /F1 7 Tf ${MARGIN} ${MARGIN / 2} Td (${esc(`Writ evidence pack - page ${i + 1} of ${pages.length}`)}) Tj ET`;
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objs[contentId] = `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n < objs.length; n++) {
    offsets[n] = Buffer.byteLength(pdf, "latin1");
    pdf += `${n} 0 obj\n${objs[n]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objs.length; n++) pdf += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
