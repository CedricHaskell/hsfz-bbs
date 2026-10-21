import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import sharp from "sharp";

const directory = mkdtempSync(path.join(tmpdir(), "hsfz-security-"));
process.env.HSFZ_DATA_DIR = directory;
process.env.HSFZ_ENCRYPT_KEY = "test-only-key-with-more-than-32-characters";
delete process.env.HSFZ_SEED_DEMO;

// An old production-shaped database must upgrade without losing application data.
const legacy = new Database(path.join(directory, "bbs.db"));
legacy.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL, bio TEXT DEFAULT '', avatar TEXT DEFAULT '', role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'approved', reject_reason TEXT DEFAULT '', banned INTEGER DEFAULT 0,
    custom_title TEXT DEFAULT '', grade TEXT DEFAULT '', phone TEXT DEFAULT '', email TEXT DEFAULT '', created_at TEXT DEFAULT '');
  CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT DEFAULT '');
  CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER DEFAULT 0, window_start INTEGER DEFAULT 0);
  INSERT INTO users (id, username, password_hash, nickname, phone) VALUES (42, 'legacy_user', 'old-hash', '旧用户', '13800000000');
  INSERT INTO sessions VALUES ('legacy-session', 42, '2020-01-01 00:00:00');
  CREATE TABLE threads (id INTEGER PRIMARY KEY, board_id INTEGER NOT NULL, author_id INTEGER NOT NULL,
    title TEXT NOT NULL, content TEXT NOT NULL, images TEXT DEFAULT '', anonymous INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0, reply_count INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0, created_at TEXT DEFAULT '', last_reply_at TEXT DEFAULT '');
  CREATE TABLE replies (id INTEGER PRIMARY KEY, thread_id INTEGER NOT NULL, author_id INTEGER NOT NULL,
    content TEXT NOT NULL, images TEXT DEFAULT '', reply_to INTEGER DEFAULT 0, created_at TEXT DEFAULT '');
  CREATE TABLE thread_likes (user_id INTEGER NOT NULL, thread_id INTEGER NOT NULL, PRIMARY KEY(user_id, thread_id));
  CREATE TABLE thread_favorites (user_id INTEGER NOT NULL, thread_id INTEGER NOT NULL, PRIMARY KEY(user_id, thread_id));
  INSERT INTO threads (id, board_id, author_id, title, content, images, views, reply_count) VALUES (42, 999, 42, '旧帖子', '旧正文', '["/uploads/old.png"]', 123, 1);
  INSERT INTO replies (id, thread_id, author_id, content) VALUES (42, 42, 42, '旧回复');
  INSERT INTO thread_likes VALUES (42, 42);
  INSERT INTO thread_favorites VALUES (42, 42);
`);
legacy.close();

const { db, UPLOAD_DIR } = await import("../lib/db");
const { encryptPhone, decryptPhone, maskPhone } = await import("../lib/crypto");
const { allowAction } = await import("../lib/ratelimit");
const { sessionUserByToken } = await import("../lib/session");
const { saveUploadImage } = await import("../lib/upload");
const { notify, mentionUserIds } = await import("../lib/notify");
const { searchThreads, threadsSorted } = await import("../lib/queries");
const { clientIpFromHeaders } = await import("../lib/client-ip");

after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true }); // only our mkdtemp directory
});

test("legacy migration preserves users, encrypts phones and invalidates old sessions", () => {
  const row = db.prepare("SELECT * FROM users WHERE id = 42").get() as Record<string, string>;
  assert.equal(row.password_hash, "old-hash");
  assert.equal(row.nickname, "旧用户");
  assert.ok(row.phone.startsWith("enc:v1:"));
  assert.equal(decryptPhone(row.phone), "13800000000");
  assert.equal(db.prepare("SELECT 1 FROM sessions").get(), undefined);
  assert.equal(db.prepare("SELECT id FROM users WHERE username = 'admin'").get(), undefined);
  const thread = db.prepare("SELECT content, images, views, reply_count, like_count FROM threads WHERE id = 42").get();
  assert.deepEqual(thread, { content: "旧正文", images: '["/uploads/old.png"]', views: 123, reply_count: 1, like_count: 1 });
  assert.deepEqual(db.prepare("SELECT content FROM replies WHERE id = 42").get(), { content: "旧回复" });
  assert.ok(db.prepare("SELECT 1 FROM thread_favorites WHERE user_id = 42 AND thread_id = 42").get());
  const again = spawnSync(process.execPath, ["--import", "tsx", "-e", "import('./lib/db.ts').then(m => (m.db ?? m.default.db).close())"], { encoding: "utf8", env: process.env });
  assert.equal(again.status, 0, again.stderr);
  assert.equal((db.prepare("SELECT phone FROM users WHERE id = 42").get() as { phone: string }).phone, row.phone);
});

test("phone encryption uses random IVs and never echoes tampered ciphertext", () => {
  const first = encryptPhone("13800000000");
  assert.notEqual(first, encryptPhone("13800000000"));
  assert.equal(maskPhone(first), "138****0000");
  const tampered = first.split(":");
  tampered[3] = Buffer.alloc(16).toString("base64");
  assert.equal(decryptPhone(tampered.join(":")), "");
  assert.equal(maskPhone("enc:v1:broken"), "");
});

test("server expires sessions even when a browser sends the old cookie", () => {
  const token = "a".repeat(64);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, 42, ?)").run(token, Date.now() - 1);
  assert.equal(sessionUserByToken(token), null);
  db.prepare("UPDATE sessions SET expires_at = ? WHERE token = ?").run(Date.now() + 60_000, token);
  assert.equal(sessionUserByToken(token)?.id, 42);
  db.prepare("UPDATE users SET banned = 1 WHERE id = 42").run();
  assert.equal(sessionUserByToken(token), null);
  db.prepare("UPDATE users SET banned = 0 WHERE id = 42").run();
  assert.equal(sessionUserByToken("invalid"), null);
});

test("rate limits survive process restarts and separate source IP/account pairs", () => {
  assert.equal(allowAction("login-pair:ip-a:alice", 60_000, 2).ok, true);
  assert.equal(allowAction("login-pair:ip-a:alice", 60_000, 2).ok, true);
  assert.equal(allowAction("login-pair:ip-a:alice", 60_000, 2).ok, false);
  assert.equal(allowAction("login-pair:ip-b:alice", 60_000, 2).ok, true);
  const child = spawnSync(process.execPath, ["--import", "tsx", "-e", "import('./lib/ratelimit.ts').then(m => { if ((m.allowAction ?? m.default.allowAction)('login-pair:ip-a:alice',60000,2).ok) process.exit(1); })"], { encoding: "utf8", env: process.env });
  assert.equal(child.status, 0, child.stderr);
  db.prepare("UPDATE rate_limits SET expires_at = 0").run();
  assert.equal(allowAction("login-pair:ip-a:alice", 60_000, 2).ok, true);
});

test("untrusted forwarded headers cannot create new limiter identities", () => {
  delete process.env.HSFZ_CLIENT_IP_HEADER;
  assert.equal(clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.1" })), "unknown");
  process.env.HSFZ_CLIENT_IP_HEADER = "x-real-ip";
  assert.equal(clientIpFromHeaders(new Headers({ "x-real-ip": "203.0.113.1" })), "203.0.113.1");
  assert.equal(clientIpFromHeaders(new Headers({ "x-real-ip": "203.0.113.1, 203.0.113.2" })), "unknown");
  delete process.env.HSFZ_CLIENT_IP_HEADER;
});

test("decoder rejects HTML, signature-only and MIME-mismatched uploads", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } }).png().toBuffer();
  for (const data of [Buffer.from("<html>bad</html>"), png.subarray(0, 20)]) {
    await assert.rejects(saveUploadImage(new File([data], "fake.png", { type: "image/png" }), "test"));
  }
  await assert.rejects(saveUploadImage(new File([png], "fake.jpg", { type: "image/jpeg" }), "test"));
});

test("re-encoding removes EXIF and trailing payloads, and preserves readable formats", async () => {
  for (const [format, mime] of [["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"], ["gif", "image/gif"]] as const) {
    const image = sharp({ create: { width: 3, height: 2, channels: 4, background: "red" } });
    const original = await image.withExif({ IFD0: { Artist: "private-location" } }).toFormat(format).toBuffer();
    const url = await saveUploadImage(new File([original, "<script>trailing</script>"], `test.${format}`, { type: mime }), "test");
    const saved = readFileSync(path.join(UPLOAD_DIR, path.basename(url)));
    const metadata = await sharp(saved).metadata();
    assert.equal(metadata.width, 3);
    assert.equal(metadata.exif, undefined);
    assert.equal(saved.includes(Buffer.from("<script>")), false);
  }
});

test("search treats wildcard characters literally and latest uses creation time", () => {
  const board = (db.prepare("SELECT id FROM boards WHERE slug='study'").get() as { id: number }).id;
  const insert = db.prepare("INSERT INTO threads (board_id, author_id, title, content, created_at, last_reply_at) VALUES (?, 42, ?, 'body', ?, ?)");
  insert.run(board, "100% sample", "2026-01-01 00:00:00", "2026-03-01 00:00:00");
  const latest = insert.run(board, "second_thread", "2026-02-01 00:00:00", "2026-02-01 00:00:00");
  assert.equal(searchThreads("%").length, 1);
  assert.equal(searchThreads("_").length, 1);
  assert.equal(threadsSorted("latest")[0].id, Number(latest.lastInsertRowid));
});

test("repeated likes/follows do not flood notifications and mentions are bounded", () => {
  for (let i = 0; i < 10; i++) notify(42, "like", 99, 1, 0, "like");
  const count = db.prepare("SELECT count(*) AS n FROM notifications WHERE user_id = 42").get() as { n: number };
  assert.equal(count.n, 1);
  assert.deepEqual(mentionUserIds("@legacy_user @legacy_user", 99), [42]);
});

test("animated GIF/WebP keep their frames and excessive dimensions are rejected", async () => {
  const pixels = Buffer.from([...Array.from({ length: 6 }, () => [255, 0, 0, 255]).flat(), ...Array.from({ length: 6 }, () => [0, 0, 255, 255]).flat()]);
  const animated = await sharp(pixels, { raw: { width: 3, height: 4, channels: 4, pageHeight: 2 } }).gif({ delay: [100, 100] }).toBuffer();
  for (const format of ["gif", "webp"] as const) {
    const input = await sharp(animated, { animated: true }).toFormat(format).toBuffer();
    const url = await saveUploadImage(new File([input], `animated.${format}`, { type: `image/${format}` }), "animated");
    const metadata = await sharp(readFileSync(path.join(UPLOAD_DIR, path.basename(url))), { animated: true }).metadata();
    assert.equal(metadata.pages, 2);
  }
  const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "black" } }).png().toBuffer();
  await assert.rejects(saveUploadImage(new File([huge], "large.png", { type: "image/png" }), "large"));
});

test("fresh production databases never create demo credentials", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", "import('./lib/db.ts').then(m => { const db=m.db??m.default.db; console.log(JSON.stringify(db.prepare('SELECT count(*) AS users FROM users').get())); db.close(); })"], {
    encoding: "utf8", env: { ...process.env, NODE_ENV: "production", HSFZ_SEED_DEMO: "1", HSFZ_DATA_DIR: path.join(directory, "fresh") },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { users: 0 });
});

test("backup reads the configured WAL database and key rotation rolls back on a wrong key", () => {
  const backups = mkdtempSync(path.join(tmpdir(), "hsfz-backup-test-"));
  try {
    writeFileSync(path.join(directory, "attachments", "backup-fixture"), "private attachment bytes");
    const backup = spawnSync(process.execPath, ["--import", "tsx", "scripts/backup.mts"], {
      encoding: "utf8", env: { ...process.env, HSFZ_BACKUP_DIR: backups },
    });
    assert.equal(backup.status, 0, backup.stderr);
    const snapshot = path.join(backups, readdirSync(backups)[0]);
    assert.equal(readFileSync(path.join(snapshot, "attachments", "backup-fixture"), "utf8"), "private attachment bytes");
    const copied = new Database(path.join(snapshot, "bbs.db"));
    const initial = (copied.prepare("SELECT phone FROM users WHERE id = 42").get() as { phone: string }).phone;
    assert.equal(decryptPhone(initial), "13800000000");
    copied.close();
    const nextKey = "new-rotation-test-key-at-least-32-characters";
    const rotate = (oldKey: string) => spawnSync(process.execPath, ["--import", "tsx", "scripts/rotate-phone-key.mts"], {
      encoding: "utf8", env: { ...process.env, HSFZ_DATA_DIR: snapshot, HSFZ_OLD_ENCRYPT_KEY: oldKey, HSFZ_NEW_ENCRYPT_KEY: nextKey },
    });
    assert.notEqual(rotate("wrong-key").status, 0);
    const unchanged = new Database(path.join(snapshot, "bbs.db"), { readonly: true });
    assert.equal((unchanged.prepare("SELECT phone FROM users WHERE id = 42").get() as { phone: string }).phone, initial);
    unchanged.close();
    const result = rotate(process.env.HSFZ_ENCRYPT_KEY!);
    assert.equal(result.status, 0, result.stderr);
    const verify = spawnSync(process.execPath, ["--import", "tsx", "-e", "import('./lib/db.ts').then(m => { const db=m.db??m.default.db; db.close(); })"], {
      encoding: "utf8", env: { ...process.env, NODE_ENV: "production", HSFZ_DATA_DIR: snapshot, HSFZ_ENCRYPT_KEY: nextKey },
    });
    assert.equal(verify.status, 0, verify.stderr);
  } finally {
    rmSync(backups, { recursive: true, force: true });
  }
});
