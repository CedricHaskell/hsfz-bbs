import crypto from "node:crypto";
import Database from "better-sqlite3";
import path from "node:path";

const previous = process.env.HSFZ_OLD_ENCRYPT_KEY;
const next = process.env.HSFZ_NEW_ENCRYPT_KEY;
if (!previous || !next || next.length < 32 || previous === next) {
  throw new Error("停站并备份后，设置 HSFZ_OLD_ENCRYPT_KEY 和新的 HSFZ_NEW_ENCRYPT_KEY（至少 32 字符且不同于旧值）。不会推测旧密钥。");
}
const oldKey = crypto.createHash("sha256").update(previous).digest();
const newKey = crypto.createHash("sha256").update(next).digest();
const data = process.env.HSFZ_DATA_DIR || path.join(process.cwd(), "data");
const db = new Database(path.join(data, "bbs.db"), { fileMustExist: true });
try {
  const count = db.transaction(() => {
    const rows = db.prepare("SELECT id, phone FROM users WHERE phone LIKE 'enc:%'").all() as { id: number; phone: string }[];
    const update = db.prepare("UPDATE users SET phone = ? WHERE id = ?");
    for (const row of rows) {
      const [prefix, version, iv, tag, value, extra] = row.phone.split(":");
      if (prefix !== "enc" || version !== "v1" || !iv || !tag || !value || extra) throw new Error("发现无法识别的手机号密文，操作已回滚");
      const decipher = crypto.createDecipheriv("aes-256-gcm", oldKey, Buffer.from(iv, "base64"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));
      const phone = Buffer.concat([decipher.update(Buffer.from(value, "base64")), decipher.final()]);
      const newIv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", newKey, newIv);
      const encoded = Buffer.concat([cipher.update(phone), cipher.final()]);
      update.run(`enc:v1:${newIv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encoded.toString("base64")}`, row.id);
    }
    return rows.length;
  }).immediate();
  console.log(`已更新 ${count} 条手机号密文。请把服务的 HSFZ_ENCRYPT_KEY 改为新密钥再启动。`);
} finally {
  db.close();
}
