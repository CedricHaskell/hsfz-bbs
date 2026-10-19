import fs from "node:fs";
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
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (!/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif|svg)$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const filePath = path.join(UPLOAD_DIR, file);
  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }
  const ext = file.split(".").pop()!.toLowerCase();
  return new Response(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": MIME[ext],
      "Cache-Control": "public, max-age=86400",
    },
  });
}
