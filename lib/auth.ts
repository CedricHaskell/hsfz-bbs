import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { db, type UserRow } from "./db";
import { SESSION_TTL_SECONDS, sessionUserByToken } from "./session";

const COOKIE = "hsfz_session";

export type SessionUser = Pick<
  UserRow,
  "id" | "username" | "nickname" | "avatar" | "role" | "status" | "banned" | "custom_title" | "grade"
>;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const row = sessionUserByToken(token);
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
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, datetime('now','localtime'), ?)").run(
    token, userId, Date.now() + SESSION_TTL_SECONDS * 1000
  );
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    // Production defaults to HTTPS; explicit 0 supports isolated HTTP deployments.
    secure: process.env.HSFZ_COOKIE_SECURE !== "0" && (process.env.NODE_ENV === "production" || process.env.HSFZ_COOKIE_SECURE === "1"),
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
