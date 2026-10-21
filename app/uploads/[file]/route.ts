import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

// 用户上传的头像/校徽存放在 data/uploads（构建后写入），由本路由动态供图
export async function GET(
  req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (!/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif|svg)$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const filePath = path.join(UPLOAD_DIR, file);
  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    throw error;
  }
  const ext = file.split(".").pop()!.toLowerCase();
  const disposition = new URL(req.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[ext],
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      // Also sandbox existing SVG badges when opened as a document.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": `${disposition}; filename="${file}"`,
    },
  });
}
