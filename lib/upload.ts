import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { UPLOAD_DIR } from "./db";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
const MAX_PIXELS = 24_000_000;

export function isAllowedImageType(file: File): boolean {
  return Object.hasOwn(EXT_BY_TYPE, file.type);
}

export function detectImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (["GIF87a", "GIF89a"].includes(buf.toString("ascii", 0, 6))) return "gif";
  return null;
}

/** Fully decode and re-encode untrusted images. Sharp strips metadata by default. */
export async function saveUploadImage(file: File, prefix: string): Promise<string> {
  if (!isAllowedImageType(file)) throw new Error("仅支持 JPG / PNG / WEBP / GIF 格式图片");
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error("图片不能为空，且不能超过 8MB");
  if (!/^[a-z0-9-]+$/i.test(prefix)) throw new Error("图片名称不正确");
  const input = Buffer.from(await file.arrayBuffer());
  const ext = detectImageType(input);
  if (!ext || ext !== EXT_BY_TYPE[file.type]) throw new Error("图片内容与声明的格式不一致");
  let output: Buffer;
  try {
    const image = sharp(input, { animated: true, limitInputPixels: MAX_PIXELS, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS ||
        (metadata.pages ?? 1) > 100) throw new Error("图片尺寸或帧数过大");
    const oriented = image.autoOrient();
    output = await (ext === "jpg" ? oriented.jpeg({ quality: 85 }) :
      ext === "png" ? oriented.png() : ext === "gif" ? oriented.gif() : oriented.webp({ quality: 85 }))
      .timeout({ seconds: 10 }).toBuffer();
  } catch {
    throw new Error("图片无效、已损坏或尺寸过大（最多 2400 万像素、100 帧）");
  }
  if (output.length > 8 * 1024 * 1024) throw new Error("处理后的图片超过 8MB，请缩小图片");
  const name = `${prefix}-${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), output, { flag: "wx" });
  return `/uploads/${name}`;
}

export async function removeUploadFile(url: string): Promise<void> {
  if (!/^\/uploads\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif|svg)$/.test(url)) return;
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
}
