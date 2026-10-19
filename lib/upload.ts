import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { UPLOAD_DIR } from "./db";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isAllowedImageType(file: File): boolean {
  return !!EXT_BY_TYPE[file.type];
}

/** 保存一张上传图片，返回可访问的 /uploads/ 路径 */
export async function saveUploadImage(file: File, prefix: string): Promise<string> {
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new Error("仅支持 JPG / PNG / WEBP / GIF 格式图片");
  if (file.size > 8 * 1024 * 1024) throw new Error("单张图片不能超过 8MB");
  const name = `${prefix}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

/** 删除已保存的上传图片（按 /uploads/xxx 路径） */
export function removeUploadFile(url: string): void {
  if (!url.startsWith("/uploads/")) return;
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(url)));
  } catch {
    /* 文件不存在则忽略 */
  }
}
