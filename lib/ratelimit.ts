import { createHash } from "node:crypto";
import { db } from "./db";

/** Fixed windows anchored to the first attempt; atomic across SQLite connections. */
export function allowAction(key: string, cooldownMs: number, maxCount = 1): { ok: boolean; retryAfterSec: number } {
  if (cooldownMs <= 0 || maxCount < 1) throw new Error("Invalid rate limit");
  const now = Date.now();
  const digest = createHash("sha256").update(key).digest("hex");
  const row = db.prepare(`
    INSERT INTO rate_limits (key, count, window_start, expires_at) VALUES (?, 1, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
      window_start = CASE WHEN expires_at <= ? THEN excluded.window_start ELSE window_start END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    WHERE expires_at <= ? OR count < ?
    RETURNING count
  `).get(digest, now, now + cooldownMs, now, now, now, now, maxCount);
  if (row) {
    db.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").run(now);
    return { ok: true, retryAfterSec: 0 };
  }
  const active = db.prepare("SELECT expires_at FROM rate_limits WHERE key = ?").get(digest) as { expires_at: number };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((active.expires_at - now) / 1000)) };
}
