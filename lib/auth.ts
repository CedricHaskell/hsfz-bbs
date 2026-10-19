import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { db, type UserRow } from "./db";

const COOKIE = "hsfz_session";

export type SessionUser = Pick<
  UserRow,
  "id" | "username" | "nickname" | "avatar" | "role" | "status" | "banned" | "custom_title" | "grade"
>;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.nickname, u.avatar, u.role, u.status, u.banned, u.custom_title, u.grade
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
    )
    .get(token) as SessionUser | undefined;
  if (!row) return null;
  // 待审核 / 被驳回 / 被封禁的会话一律踢出
  if (row.banned || row.status !== "approved") {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return row;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}

export async function createSession(userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, datetime('now','localtime'))").run(
    token,
    userId
  );
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    // 上线 HTTPS 后在服务端设置环境变量 HSFZ_COOKIE_SECURE=1 开启
    secure: process.env.HSFZ_COOKIE_SECURE === "1",
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  store.delete(COOKIE);
}

export function destroyUserSessions(userId: number): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
