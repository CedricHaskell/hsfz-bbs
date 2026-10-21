export const markdownDocument = Buffer.from("# MD_PREVIEW_SENTINEL\n\nA **bold** document.\n\n![private image](https://invalid.example/markdown-tracker)\n\n<script>parent.document.body.dataset.documentPwn='yes'</script>\n");
export const htmlDocument = Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><style>h1{color:rgb(10,60,90)}</style></head><body><h1>HTML_SAFE_PREVIEW</h1><script>parent.document.body.dataset.documentPwn='yes';fetch('https://invalid.example/script-tracker')</script><img src="https://invalid.example/html-tracker"><form action="https://invalid.example/form-tracker"><input name="secret" value="test"></form></body></html>`);

/** Small valid two-page PDF with real xref offsets; no generated binary checked in. */
export function pdfDocument(): Buffer<ArrayBuffer> {
  const first = "BT /F1 22 Tf 35 140 Td (PDF PREVIEW FIRST PAGE) Tj ET";
  const second = "BT /F1 22 Tf 35 140 Td (PDF PREVIEW SECOND PAGE) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${first.length} >>\nstream\n${first}\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>",
    `<< /Length ${second.length} >>\nstream\n${second}\nendstream`,
  ];
  let data = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(data));
    data += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(data);
  data += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) data += `${String(offset).padStart(10, "0")} 00000 n \n`;
  data += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(data);
}
