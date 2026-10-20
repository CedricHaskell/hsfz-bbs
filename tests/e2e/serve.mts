import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { markdownDocument, htmlDocument, pdfDocument } from "../fixtures/documents";

// The application under test can never open the developer's or production database.
const directory = mkdtempSync(path.join(tmpdir(), "hsfz-e2e-"));
process.env.HSFZ_DATA_DIR = directory;
process.env.HSFZ_ENCRYPT_KEY = "isolated-e2e-encryption-key-at-least-32-chars";
process.env.HSFZ_COOKIE_SECURE = "0";
delete process.env.HSFZ_SEED_DEMO;
const { db, UPLOAD_DIR } = await import("../../lib/db");
const { encryptPhone } = await import("../../lib/crypto");
const { prepareAttachments, persistAttachments } = await import("../../lib/attachments");
const hash = await bcrypt.hash("LocalTestPass-123", 10);
for (const [id, username, role, grade] of [[1, "test_admin", "admin", ""], [2, "test_member", "user", "高一"], [3, "test_other", "user", "高三"],
    [4, "document_owner", "user", "高一"], [5, "document_reader", "user", "高一"], [6, "document_uploader", "user", "高一"],
    [7, "document_reply", "user", "高一"], [8, "document_invalid", "user", "高一"]] as const) {
  db.prepare("INSERT INTO users (id, username, nickname, password_hash, role, grade) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, username, `PRIVATE_${id}`, hash, role, grade);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(String(id).repeat(64), id, Date.now() + 3600_000);
}
const boardId = (slug: string) => (db.prepare("SELECT id FROM boards WHERE slug = ?").get(slug) as { id: number }).id;
db.prepare("INSERT INTO threads (id, board_id, author_id, title, content) VALUES (1, ?, 1, '公开公告', 'PUBLIC_NOTICE_BODY')").run(boardId("announcements"));
db.prepare("INSERT INTO threads (id, board_id, author_id, title, content) VALUES (2, ?, 2, 'PRIVATE_THREAD_TITLE', 'PRIVATE_THREAD_BODY')").run(boardId("study"));
db.prepare("INSERT INTO replies (thread_id, author_id, content) VALUES (1, 2, 'PRIVATE_REPLY_SENTINEL')").run();
db.prepare("INSERT INTO whitelist (real_name, student_id, grade) VALUES ('测试同学', 'TEST-001', '高一')").run();
for (const id of [10, 12, 13, 14]) {
  db.prepare("INSERT INTO threads (id, board_id, author_id, title, content) VALUES (?, ?, 4, ?, 'DOCUMENT_THREAD_BODY')")
    .run(id, boardId("study"), `ATTACHMENT_TEST_THREAD_${id}`);
}
const image = await sharp({ create: { width: 3, height: 2, channels: 3, background: "red" } }).png().toBuffer();
writeFileSync(path.join(UPLOAD_DIR, "e2e-document-image.png"), image);
db.prepare("UPDATE users SET phone=? WHERE id=8").run(encryptPhone("13800000000"));
db.prepare("UPDATE users SET avatar='/uploads/e2e-document-image.png' WHERE id=4").run();
db.prepare("UPDATE threads SET images = ? WHERE id=10").run(JSON.stringify(["/uploads/e2e-document-image.png"]));
const documents = await prepareAttachments([
  new File([pdfDocument()], "练习.pdf", { type: "application/pdf" }),
  new File([markdownDocument], "笔记.md", { type: "text/markdown" }),
  new File([htmlDocument], "页面.html", { type: "text/html" }),
]);
persistAttachments(documents, 4, 10);
persistAttachments(documents.slice(0, 1), 4, 12);
persistAttachments(await prepareAttachments([new File(["# PUBLIC_ATTACHMENT"], "公告.md", { type: "text/markdown" })]), 1, 1);
persistAttachments(await prepareAttachments([new File(["# PRIVATE_ANNOUNCEMENT_REPLY_ATTACHMENT"], "回复附件.md", { type: "text/markdown" })]), 2, 1, 1);
db.close();
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3211"], {
  stdio: "inherit", env: { ...process.env, NODE_ENV: "production" }, windowsHide: true,
});
child.on("exit", (code) => {
  rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  process.exit(code ?? 0);
});
process.on("SIGTERM", () => child.kill());
process.on("SIGINT", () => child.kill());
