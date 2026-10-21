"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, GRADES } from "@/lib/db";
import { createSession, destroyCurrentSession } from "@/lib/auth";
import { encryptPhone } from "@/lib/crypto";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { findSensitiveWord } from "@/lib/moderation";
import { allowAction } from "@/lib/ratelimit";

export type ActionState = { message: string; ok: boolean } | null;

const fail = (message: string): ActionState => ({ message, ok: false });

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = clientIpFromHeaders(await headers());
  const rate = allowAction(`reg:${ip}`, 900_000, 3);
  if (!rate.ok) return fail(`注册太频繁啦，请 ${rate.retryAfterSec} 秒后再试`);
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const realName = String(formData.get("real_name") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");

  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return fail("用户名只能包含小写字母、数字、下划线，长度 3-20 位");
  if (realName.length < 2 || realName.length > 20) return fail("请填写真实姓名（2-20 字）");
  if (!studentId || studentId.length > 20) return fail("请填写学号");
  if (![...GRADES, ""].includes(grade)) return fail("请选择正确的年级");
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail("请填写正确的 11 位手机号");
  if (email.length > 254) return fail("邮箱地址过长");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("邮箱格式不正确");
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) return fail("密码至少 8 位，且不能超过 72 字节");
  if (password !== password2) return fail("两次输入的密码不一致");
  if (findSensitiveWord(realName)) return fail("姓名包含敏感词，请核实后填写");
  if (db.prepare("SELECT id FROM users WHERE username = ?").get(username))
    return fail("该用户名已被注册");

  // Names and student numbers are not proof of identity. All registrations require review.
  const passwordHash = await bcrypt.hash(password, 10);
  const phoneCiphertext = encryptPhone(phone);
  const registered = db.transaction(() => {
    if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) return false;
    db.prepare(`
      INSERT INTO users (username, password_hash, nickname, real_name, student_id, grade, phone, email, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now','localtime'))
    `).run(username, passwordHash, username.slice(0, 12), realName, studentId, grade, phoneCiphertext, email);
    return true;
  }).immediate();
  if (!registered) return fail("该用户名已被注册");
  redirect("/login?registered=1");
}


export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = clientIpFromHeaders(await headers());
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ipRate = allowAction(`login-ip:${ip}`, 15 * 60_000, 60);
  if (!ipRate.ok) return fail(`尝试次数过多，请 ${ipRate.retryAfterSec} 秒后再试`);
  if (!/^[a-z0-9_]{3,20}$/.test(username) || Buffer.byteLength(password, "utf8") > 4096)
    return fail("用户名或密码错误");
  const pairRate = allowAction(`login-pair:${ip}:${username}`, 15 * 60_000, 10);
  if (!pairRate.ok) return fail(`尝试次数过多，请 ${pairRate.retryAfterSec} 秒后再试`);

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | (import("@/lib/db").UserRow & { id: number })
    | undefined;
  // Equal bcrypt work for unknown users; avoid sync CPU work on the server event loop.
  const hash = user?.password_hash ?? "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  const validPassword = await bcrypt.compare(password, hash);
  if (!user || !validPassword) return fail("用户名或密码错误");
  if (user.banned) return fail("该账号已被封禁，如有疑问请联系管理员");
  if (user.status === "pending") return fail("账号正在审核中，请等待管理员批准后再登录");
  if (user.status === "rejected")
    return fail(`注册申请未通过${user.reject_reason ? `：${user.reject_reason}` : ""}`);

  // Password resets can finish while bcrypt is yielding. Do not mint a session for an old hash.
  const current = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string } | undefined;
  if (current?.password_hash !== user.password_hash) return fail("密码已变更，请重新登录");
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}
