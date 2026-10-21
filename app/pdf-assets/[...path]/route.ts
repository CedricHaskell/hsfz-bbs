import path from "node:path";
import fs from "node:fs/promises";

// Keep the filesystem scope explicit for Next's output tracing. The matching
// files are included in standalone output by next.config.ts as well.
const root = path.join(process.cwd(), "node_modules", "pdfjs-dist");
const packagePath = path.join(root, "package.json");

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const { version } = JSON.parse(await fs.readFile(packagePath, "utf8")) as { version: string };
  if (parts[0] !== version) return new Response("Not found", { status: 404 });
  let relative: string;
  let mime: string;
  if (parts.length === 2 && parts[1] === "pdf.worker.min.mjs") {
    relative = "build/pdf.worker.min.mjs";
    mime = "text/javascript; charset=utf-8";
  } else if (parts.length === 3 && /^[a-zA-Z0-9_-]+\.(bcmap|pfb|ttf|js)$/.test(parts[2]) &&
      ["cmaps", "standard_fonts", "wasm"].includes(parts[1])) {
    relative = `${parts[1]}/${parts[2]}`;
    mime = parts[2].endsWith(".js") ? "text/javascript; charset=utf-8" : "application/octet-stream";
  } else return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(root, relative));
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; connect-src 'self'",
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    throw error;
  }
}
