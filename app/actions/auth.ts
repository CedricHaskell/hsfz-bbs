"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db, GRADES } from "@/lib/db";
import { createSession, destroyCurrentSession } from "@/lib/auth";

export type ActionState = { message: string; ok: boolean } | null;

const fail = (message: string): ActionState => ({ message, ok: false });

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");
  const realName = String(formData.get("real_name") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();

  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return fail("用户名只能包含小写字母、数字、下划线，长度 3-20 位");
  if (!nickname || nickname.length > 12) return fail("昵称不能为空，且不超过 12 个字");
  if (![...GRADES, ""].includes(grade)) return fail("请选择正确的年级");
  if (password.length < 6) return fail("密码至少 6 位");
  if (password !== password2) return fail("两次输入的密码不一致");
  if (db.prepare("SELECT id FROM users WHERE username = ?").get(username))
    return fail("该用户名已被注册");

  // 校友名单免审核：填写了姓名+学号则尝试匹配未使用的白名单条目
  let fastTrack = false;
  let wlEntry: { id: number; grade: string } | null = null;
  if (realName || studentId) {
    if (!realName || !studentId) return fail("如需免审核注册，请同时填写真实姓名和学号");
    wlEntry =
      (db
        .prepare("SELECT id, grade FROM whitelist WHERE real_name = ? AND student_id = ? AND used_by = 0")
        .get(realName, studentId) as { id: number; grade: string } | undefined) ?? null;
  }

  const status = wlEntry ? "approved" : "pending";
  const finalGrade = wlEntry ? wlEntry.grade || grade : grade;
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, nickname, grade, status, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))`
    )
    .run(username, bcrypt.hashSync(password, 10), nickname, finalGrade, status);

  if (wlEntry) {
    db.prepare("UPDATE whitelist SET used_by = ? WHERE id = ?").run(
      Number(info.lastInsertRowid),
      wlEntry.id
    );
    fastTrack = true;
  }

  redirect(fastTrack ? "/login?registered=1&fast=1" : "/login?registered=1");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | (import("@/lib/db").UserRow & { id: number })
    | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return fail("用户名或密码错误");
  if (user.banned) return fail("该账号已被封禁，如有疑问请联系管理员");
  if (user.status === "pending") return fail("账号正在审核中，请等待管理员批准后再登录");
  if (user.status === "rejected")
    return fail(`注册申请未通过${user.reject_reason ? `：${user.reject_reason}` : ""}`);

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}
