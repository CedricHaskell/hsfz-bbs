import Database from "better-sqlite3";
import { mkdir, cp, stat } from "node:fs/promises";
import path from "node:path";

const data = path.resolve(process.env.HSFZ_DATA_DIR || "data");
const target = process.env.HSFZ_BACKUP_DIR;
if (!target) throw new Error("请设置 HSFZ_BACKUP_DIR，指向公开目录以外的备份目录");
const root = path.resolve(target);
const within = (base: string, child: string) => {
  const relative = path.relative(base, child);
  return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
};
if (within(data, root) || within(path.resolve("public"), root) || within(path.resolve(".next"), root)) {
  throw new Error("备份目录不能位于数据目录、public 或 .next 内");
}
const snapshot = path.join(root, `hsfz-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const db = new Database(path.join(data, "bbs.db"), { readonly: true, fileMustExist: true });
try {
  await mkdir(snapshot, { recursive: true, mode: 0o700 });
  await db.backup(path.join(snapshot, "bbs.db"));
  // Pause uploads/deletions while running this command for a consistent DB+files backup.
  await cp(path.join(data, "uploads"), path.join(snapshot, "uploads"), { recursive: true, force: false });
  const attachments = path.join(data, "attachments");
  if (await stat(attachments).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return false;
    throw error;
  })) {
    await cp(attachments, path.join(snapshot, "attachments"), { recursive: true, force: false });
  }
  console.log(`备份完成：${snapshot}。请另行安全保存 HSFZ_ENCRYPT_KEY。`);
} finally {
  db.close();
}
