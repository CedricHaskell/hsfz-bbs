import { db } from "./db";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function sessionUserByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return (db.prepare(`
    SELECT u.id, u.username, u.nickname, u.avatar, u.role, u.status, u.banned, u.custom_title, u.grade
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ? AND u.status = 'approved' AND u.banned = 0
  `).get(token, Date.now()) as import("./auth").SessionUser | undefined) ?? null;
}
