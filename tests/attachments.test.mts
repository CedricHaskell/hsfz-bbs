import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const directory = mkdtempSync(path.join(tmpdir(), "hsfz-attachments-"));
process.env.HSFZ_DATA_DIR = directory;
process.env.HSFZ_ENCRYPT_KEY = "test-only-attachment-key-with-more-than-32-characters";
delete process.env.HSFZ_SEED_DEMO;
const { db, ATTACHMENT_DIR } = await import("../lib/db");
const { DOCUMENT_LIMITS } = await import("../lib/attachment-limits");
const board = (db.prepare("SELECT id FROM boards WHERE slug = 'study'").get() as { id: number }).id;
db.prepare("INSERT INTO users (id, username, password_hash, nickname) VALUES (1, 'files', 'hash', 'Files'), (2, 'other', 'hash', 'Other')").run();
function thread(userId = 1): number {
  return Number(db.prepare("INSERT INTO threads (board_id, author_id, title, content) VALUES (?, ?, '附件', '正文')").run(board, userId).lastInsertRowid);
}

// An earlier build used compressed BLOBs; migrate its references and bytes without replacing the DB.
const oldThread = thread();
const oldText = "# 旧附件\n".repeat(50);
const oldBytes = Buffer.from(oldText);
const oldHash = createHash("sha256").update("md\0").update(oldBytes).digest("hex");
const oldCompressed = gzipSync(oldBytes);
const oldId = "1".repeat(32);
db.prepare("INSERT INTO attachment_blobs VALUES (?, 'gzip', ?, ?, ?)").run(oldHash, oldBytes.length, oldCompressed.length, oldCompressed);
db.prepare("INSERT INTO attachments VALUES (?, ?, 1, ?, 0, '旧文件.md', 'md')").run(oldId, oldHash, oldThread);
const { prepareAttachments, persistAttachments, attachmentsForThread, getAttachment, getAttachmentStorage,
  readAttachmentContent, deleteThreadAttachments, attachmentTransaction, cleanupUnreferencedAttachments, AttachmentError } = await import("../lib/attachments");

after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true }); // Only our mkdtemp directory.
});
function count(table: "attachment_files" | "attachment_objects"): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}
function diskFiles(): string[] {
  return readdirSync(ATTACHMENT_DIR).filter(name => /^[a-f0-9]{64}$/.test(name));
}
function clear(): void {
  attachmentTransaction(() => {
    db.prepare("DELETE FROM threads").run();
    db.prepare("DELETE FROM replies").run();
  });
}

test("legacy BLOB migration preserves IDs, owners, bytes and existing post content", async () => {
  assert.equal(getAttachment(oldId)?.threadId, oldThread);
  assert.equal(getAttachment(oldId)?.kind, "file");
  assert.equal((await readAttachmentContent(oldId)).toString(), oldText);
  assert.deepEqual(db.prepare("SELECT title, content FROM threads WHERE id = ?").get(oldThread), { title: "附件", content: "正文" });
  assert.equal((db.prepare("SELECT COUNT(*) n FROM attachment_blobs").get() as { n: number }).n, 0);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM attachments").get() as { n: number }).n, 0);
  assert.ok(diskFiles().length > 0);
  assert.equal((db.prepare("PRAGMA table_info(attachment_objects)").all() as { name: string }[]).some(column => column.name === "bytes"), false);
});

test("text compression and cross-extension dedup retain names and original bytes outside SQLite", async () => {
  clear();
  const text = "# 我的笔记\n\n正文。\n".repeat(300);
  const files = await prepareAttachments([new File([text], "C:\\folder\\notes.md", { type: "text/markdown" })]);
  assert.equal(files[0].encoding, "gzip");
  assert.ok(files[0].storedSize < files[0].size / 10);
  const first = thread();
  persistAttachments(files, 1, first);
  const binary = await prepareAttachments([new File([text], "report.docx")]);
  assert.equal(binary[0].encoding, "raw");
  assert.equal(binary[0].hash, files[0].hash);
  const second = thread(2);
  persistAttachments(binary, 2, second);
  assert.equal(count("attachment_objects"), 1);
  assert.equal(count("attachment_files"), 2);
  assert.equal(diskFiles().length, 1);
  const meta = attachmentsForThread(first)[0];
  assert.equal(meta.name, "notes.md");
  assert.deepEqual(Object.keys(meta).sort(), ["id", "kind", "name", "replyId", "size", "storedSize"].sort());
  assert.equal(getAttachment(meta.id)?.boardSlug, "study");
  assert.equal(getAttachment("../invalid"), undefined);
  assert.equal((await readAttachmentContent(meta.id)).toString(), text);
  deleteThreadAttachments(first);
  assert.equal(diskFiles().length, 1);
  assert.equal((await readAttachmentContent(attachmentsForThread(second)[0].id)).toString(), text);
  attachmentTransaction(() => { db.prepare("DELETE FROM threads WHERE id = ?").run(second); });
  assert.equal(count("attachment_objects"), 0);
  assert.equal(diskFiles().length, 0);
});

test("generic office/archive/binary files download unchanged; only PDF receives preview kind", async () => {
  clear();
  for (const extension of ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "rar", "7z", "bin", "md", "html"]) {
    const bytes = new Uint8Array([0, 1, 255, 0, 42]);
    const [file] = await prepareAttachments([new File([bytes], `report.${extension}`, { type: "application/octet-stream" })]);
    assert.equal(file.kind, "file");
    const parent = thread();
    persistAttachments([file], 1, parent);
    assert.deepEqual(new Uint8Array(await readAttachmentContent(attachmentsForThread(parent)[0].id)), bytes);
  }
  assert.equal(diskFiles().length, 1);
  const [pdf] = await prepareAttachments([new File(["%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"], "test.pdf")]);
  assert.equal(pdf.kind, "pdf");
  assert.equal(pdf.encoding, "raw");
  await assert.rejects(prepareAttachments([new File(["fake"], "a.pdf")]), /PDF/);
  await assert.rejects(prepareAttachments([new File(["%PDF-1.7\nmissing eof"], "a.pdf")]), /PDF/);
  for (const name of ["a.exe", "a.PS1", "bad.exe.pdf", "a.lnk", "sheet.xlsm", "a.exe."]) {
    await assert.rejects(prepareAttachments([new File(["data"], name)]), /不能上传/);
  }
  await assert.rejects(prepareAttachments([new File([""], "a.md")]), /不能为空/);
  await assert.rejects(prepareAttachments([new File(["x".repeat(DOCUMENT_LIMITS.maxFileBytes + 1)], "a.bin")]), /5MB/);
  await assert.rejects(prepareAttachments(Array.from({ length: 4 }, () => new File(["x"], "a.txt"))), /3 个/);
});

test("outer SQL rollback removes new files but preserves shared objects and rolled-back deletes", async () => {
  clear();
  const parent = thread();
  const files = await prepareAttachments([new File(["shared"], "shared.txt")]);
  persistAttachments(files, 1, parent);
  const fresh = await prepareAttachments([new File(["new"], "new.bin")]);
  const next = thread();
  assert.throws(() => attachmentTransaction(() => {
    persistAttachments(files, 1, next);
    persistAttachments(fresh, 1, next);
    throw new Error("post failure");
  }), /post failure/);
  assert.equal(attachmentsForThread(next).length, 0);
  assert.equal(count("attachment_objects"), 1);
  assert.deepEqual(diskFiles(), [files[0].hash]);
  assert.throws(() => attachmentTransaction(() => {
    deleteThreadAttachments(parent);
    throw new Error("delete failure");
  }), /delete failure/);
  assert.equal((await readAttachmentContent(attachmentsForThread(parent)[0].id)).toString(), "shared");
});

test("reply deletion revokes metadata and releases its unshared file after commit", async () => {
  clear();
  const parent = thread();
  const reply = Number(db.prepare("INSERT INTO replies (thread_id, author_id, content) VALUES (?, 1, '回复')").run(parent).lastInsertRowid);
  const files = await prepareAttachments([new File(["# reply"], "reply.txt")]);
  persistAttachments(files, 1, parent, reply);
  const id = attachmentsForThread(parent)[0].id;
  assert.equal(getAttachment(id)?.replyId, reply);
  assert.throws(() => persistAttachments(files, 2, parent, reply), AttachmentError);
  attachmentTransaction(() => { db.prepare("DELETE FROM replies WHERE id = ?").run(reply); });
  assert.equal(getAttachment(id), undefined);
  assert.equal(diskFiles().length, 0);
});

test("logical quotas and per-post limits hold even for deduplicated compressed files", async () => {
  clear();
  const files = await prepareAttachments([new File(["# quota"], "quota.txt")]);
  persistAttachments(files, 1, thread());
  db.prepare("UPDATE attachment_objects SET raw_size = ?").run(DOCUMENT_LIMITS.userBytes - files[0].size);
  const next = thread();
  assert.throws(() => persistAttachments([files[0], files[0]], 1, next), /32MB/);
  assert.equal(attachmentsForThread(next).length, 0);
  clear();
  const parent = thread();
  persistAttachments([files[0], files[0], files[0]], 1, parent);
  assert.throws(() => persistAttachments(files, 1, parent), /3 个/);
  const large = await prepareAttachments([new File(["x".repeat(5 * 1024 * 1024)], "large.txt")]);
  const largeParent = thread();
  persistAttachments(large, 1, largeParent);
  assert.throws(() => persistAttachments(large, 1, largeParent), /8MB/);
});

test("global quota failure midway through a batch rolls back metadata and newly written files", async () => {
  clear();
  const existing = await prepareAttachments([new File(["# existing"], "existing.txt")]);
  persistAttachments(existing, 1, thread());
  const additions = await prepareAttachments([new File(["# new"], "new.txt"), new File(["# another"], "another.txt")]);
  // Occupied storage metadata represents a large existing file without a 512MB fixture allocation.
  db.prepare("UPDATE attachment_objects SET stored_size = ?").run(DOCUMENT_LIMITS.globalStoredBytes - additions[0].storedSize - 1);
  assert.throws(() => persistAttachments(additions, 1, thread()), /存储空间已满/);
  assert.equal(count("attachment_files"), 1);
  assert.equal(count("attachment_objects"), 1);
  assert.deepEqual(diskFiles(), [existing[0].hash]);
});

test("startup orphan recovery removes only unreferenced SHA256 files and preserves restart state", async () => {
  clear();
  const files = await prepareAttachments([new File(["# 保留附件\n".repeat(500)], "old.txt")]);
  const parent = thread();
  persistAttachments(files, 1, parent);
  const orphan = "a".repeat(64);
  writeFileSync(path.join(ATTACHMENT_DIR, orphan), "interrupted write");
  const unrelated = path.join(ATTACHMENT_DIR, "keep-me.txt");
  writeFileSync(unrelated, "unrelated");
  const before = db.prepare("SELECT * FROM attachment_files").get();
  const restart = spawnSync(process.execPath, ["--import", "tsx", "-e",
    "import('./lib/attachments.ts').then(() => import('./lib/db.ts')).then(m => (m.db ?? m.default.db).close())"], { env: process.env, encoding: "utf8" });
  assert.equal(restart.status, 0, restart.stderr);
  assert.equal(existsSync(path.join(ATTACHMENT_DIR, orphan)), false);
  assert.equal(readFileSync(unrelated, "utf8"), "unrelated");
  assert.deepEqual(db.prepare("SELECT * FROM attachment_files").get(), before);
  assert.equal((await readAttachmentContent(attachmentsForThread(parent)[0].id)).toString(), "# 保留附件\n".repeat(500));
  cleanupUnreferencedAttachments(true);
  assert.equal(existsSync(unrelated), true);
});

test("one failed physical deletion does not restore metadata for previously removed objects", (context) => {
  clear();
  const firstHash = "b".repeat(64);
  const failedHash = "c".repeat(64);
  writeFileSync(path.join(ATTACHMENT_DIR, firstHash), "unused");
  mkdirSync(path.join(ATTACHMENT_DIR, failedHash)); // A directory makes unlink fail consistently on Windows and POSIX.
  const insert = db.prepare("INSERT INTO attachment_objects VALUES (?, 'raw', 6, 6)");
  insert.run(firstHash);
  insert.run(failedHash);
  const log = context.mock.method(console, "error", () => {});
  cleanupUnreferencedAttachments();
  log.mock.restore();
  assert.equal(existsSync(path.join(ATTACHMENT_DIR, firstHash)), false);
  assert.equal(db.prepare("SELECT 1 FROM attachment_objects WHERE hash = ?").get(firstHash), undefined);
  assert.ok(db.prepare("SELECT 1 FROM attachment_objects WHERE hash = ?").get(failedHash));
  rmdirSync(path.join(ATTACHMENT_DIR, failedHash));
  cleanupUnreferencedAttachments();
  assert.equal(count("attachment_objects"), 0);
});

test("bounded decompression and content hashing reject corrupt object files", async () => {
  clear();
  const files = await prepareAttachments([new File(["safe"], "safe.txt")]);
  const parent = thread();
  persistAttachments(files, 1, parent);
  const id = attachmentsForThread(parent)[0].id;
  const descriptor = getAttachmentStorage(id)!;
  const bomb = gzipSync(Buffer.alloc(1024 * 1024, 65));
  writeFileSync(descriptor.path, bomb);
  db.prepare("UPDATE attachment_objects SET encoding = 'gzip', stored_size = ?").run(bomb.length);
  await assert.rejects(readAttachmentContent(id), /损坏/);
  writeFileSync(descriptor.path, "evil");
  db.prepare("UPDATE attachment_objects SET encoding = 'raw', stored_size = 4").run();
  await assert.rejects(readAttachmentContent(id), /损坏/);
});
