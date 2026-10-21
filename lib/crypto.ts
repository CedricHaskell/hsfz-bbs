import crypto from "node:crypto";

const DEV_KEY = "hsfz-bbs-dev-only-key-00000000000000000000000000";
const configuredKey = process.env.HSFZ_ENCRYPT_KEY;
if (process.env.NODE_ENV === "production" && (!configuredKey || configuredKey.length < 32 || configuredKey === DEV_KEY)) {
  throw new Error("生产环境必须设置至少 32 字符的 HSFZ_ENCRYPT_KEY，并与数据库备份一起妥善保存");
}
const KEY_HEX = configuredKey || DEV_KEY;
const KEY = crypto.createHash("sha256").update(KEY_HEX).digest();

export function encryptPhone(phone: string): string {
  if (!phone) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptPhone(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith("enc:v1:")) return stored;
  const parts = stored.split(":");
  if (parts.length !== 5) return "";
  try {
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const data = Buffer.from(parts[4], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function maskPhone(stored: string): string {
  const p = decryptPhone(stored);
  if (!p) return "";
  if (!/^1[3-9]\d{9}$/.test(p)) return "***";
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}
