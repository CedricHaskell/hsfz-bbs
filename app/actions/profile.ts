"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db, GRADES, UPLOAD_DIR } from "@/lib/db";
import { getCurrentUser, requireUser, destroyUserSessions } from "@/lib/auth";
import { nowStr } from "@/lib/format";
import { findSensitiveWord } from "@/lib/moderation";
import { saveUploadImage, removeUploadFile } from "@/lib/upload";
import { allowAction } from "@/lib/ratelimit";
import { decryptPhone, encryptPhone } from "@/lib/crypto";
import type { ActionState } from "./auth";

const fail = (message: string): ActionState => ({ message, ok: false });
const okMsg = (message: string): ActionState => ({ message, ok: true });

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const bindPassword = String(formData.get("bind_password") ?? "");
  if (!nickname || nickname.length > 12) return fail("昵称不能为空，且不超过 12 个字");
  if (bio.length > 100) return fail("个性签名不能超过 100 字");
  if (![...GRADES, ""].includes(grade)) return fail("年级不正确");
  const sensitive = findSensitiveWord(`${nickname}\n${bio}`);
  if (sensitive) return fail(`内容包含敏感词「${sensitive}」，请修改后重试`);
  if (grade !== user.grade) return fail("年级变更请通过工单联系管理员核实");
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) return fail("手机号格式不正确");
  const current = db.prepare("SELECT phone, password_hash FROM users WHERE id = ?").get(user.id) as
    { phone: string; password_hash: string } | undefined;
  if (!current) return fail("账号不存在，请重新登录");
  // An empty replacement preserves the binding. Matching the decrypted value also keeps its existing ciphertext.
  const changesPhone = phone !== "" && phone !== decryptPhone(current.phone);
  if (changesPhone) {
    const rate = allowAction(`password:${user.id}`, 15 * 60_000, 10);
    if (!rate.ok) return fail(`操作太频繁，请 ${rate.retryAfterSec} 秒后再试`);
    if (!bindPassword || Buffer.byteLength(bindPassword, "utf8") > 4096 ||
        !(await bcrypt.compare(bindPassword, current.password_hash))) {
      return fail("绑定或更换手机号需输入正确的当前登录密码");
    }
  }
  const updated = db.prepare(`UPDATE users SET nickname = ?, bio = ?, phone = ?
    WHERE id = ? AND password_hash = ? AND phone = ? AND grade = ? AND status = 'approved' AND banned = 0`)
    .run(nickname, bio, changesPhone ? encryptPhone(phone) : current.phone,
      user.id, current.password_hash, current.phone, user.grade);
  // A password reset, moderation change or concurrent phone update must invalidate the earlier password check.
  if (!updated.changes) return fail("账号状态或资料已变更，请重新登录后重试");
  revalidatePath("/", "layout");
  return okMsg("资料已更新");
}

export async function uploadAvatarAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const rate = allowAction(`avatar:${user.id}`, 60_000);
  if (!rate.ok) return fail(`操作太频繁啦，请 ${rate.retryAfterSec} 秒后再试`);
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return fail("请先选择一张图片");
  if (file.size > 2 * 1024 * 1024) return fail("图片不能超过 2MB");
  const previous = db.prepare("SELECT avatar FROM users WHERE id = ?").get(user.id) as { avatar: string };
  let url: string;
  try {
    url = await saveUploadImage(file, "avatar");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "图片保存失败");
  }
  db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(url, user.id);
  await removeUploadFile(previous.avatar);
  revalidatePath("/", "layout");
  return okMsg("头像已更新");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const oldPassword = String(formData.get("old_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const newPassword2 = String(formData.get("new_password2") ?? "");
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as {
    password_hash: string;
  };
  const rate = allowAction(`password:${user.id}`, 15 * 60_000, 10);
  if (!rate.ok) return fail(`操作太频繁，请 ${rate.retryAfterSec} 秒后再试`);
  if (Buffer.byteLength(oldPassword, "utf8") > 4096 || !(await bcrypt.compare(oldPassword, row.password_hash))) return fail("当前密码不正确");
  if (newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72) return fail("新密码至少 8 位，且不能超过 72 字节");
  if (newPassword !== newPassword2) return fail("两次输入的新密码不一致");
  const newHash = await bcrypt.hash(newPassword, 10);
  const changed = db.transaction(() => {
    const updated = db.prepare("UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?")
      .run(newHash, user.id, row.password_hash);
    if (!updated.changes) return false;
    destroyUserSessions(user.id);
    return true;
  }).immediate();
  if (!changed) return fail("密码已变更，请重新登录后再试");
  redirect("/login?pwd=1");
}

export async function removeAvatarAction(): Promise<void> {
  const user = await requireUser();
  const row = db.prepare("SELECT avatar FROM users WHERE id = ?").get(user.id) as { avatar: string };
  if (row.avatar?.startsWith("/uploads/")) {
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(row.avatar)));
    } catch {
      /* 文件不存在则忽略 */
    }
  }
  db.prepare("UPDATE users SET avatar = '' WHERE id = ?").run(user.id);
  revalidatePath("/", "layout");
}

/* ---------------- 工单 ---------------- */

export async function createTicketAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const category = String(formData.get("category") ?? "other");
  const subject = String(formData.get("subject") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!["title_request", "suggestion", "report", "other"].includes(category))
    return fail("请选择正确的分类");
  if (subject.length < 2 || subject.length > 60) return fail("主题长度需在 2-60 字之间");
  if (content.length > 5000) return fail("工单内容不能超过 5000 字");
  const rate = allowAction(`ticket:${user.id}`, 60_000);
  if (!rate.ok) return fail(`提交太频繁，请 ${rate.retryAfterSec} 秒后再试`);
  if (content.length < 5) return fail("内容太短啦，至少 5 个字，方便管理员了解情况");

  const at = nowStr();
  const info = db
    .prepare(
      `INSERT INTO tickets (user_id, category, subject, status, user_read_at, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?)`
    )
    .run(user.id, category, subject, at, at, at);
  const tid = Number(info.lastInsertRowid);
  db.prepare(
    "INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, content, created_at) VALUES (?, ?, 0, ?, ?)"
  ).run(tid, user.id, content, at);
  revalidatePath("/", "layout");
  redirect(`/messages/${tid}`);
}

export async function replyTicketAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const ticketId = Number(formData.get("ticket_id"));
  const content = String(formData.get("content") ?? "").trim();
  if (!ticketId || !content || content.length > 5000) return;
  if (!allowAction(`ticket-reply:${user.id}`, 10_000).ok) return;
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ? AND user_id = ?").get(ticketId, user.id) as
    | { id: number; status: string }
    | undefined;
  if (!ticket || ticket.status === "closed") return;
  const at = nowStr();
  db.prepare(
    "INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, content, created_at) VALUES (?, ?, 0, ?, ?)"
  ).run(ticketId, user.id, content, at);
  db.prepare("UPDATE tickets SET status = 'open', updated_at = ? WHERE id = ?").run(at, ticketId);
  revalidatePath(`/messages/${ticketId}`);
  revalidatePath("/admin");
}

export async function adminReplyTicketAction(formData: FormData): Promise<void> {
  const admin = await requireUser();
  if (admin.role !== "admin") return;
  const ticketId = Number(formData.get("ticket_id"));
  const content = String(formData.get("content") ?? "").trim();
  if (!ticketId || !content) return;
  const at = nowStr();
  db.prepare(
    "INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, content, created_at) VALUES (?, ?, 1, ?, ?)"
  ).run(ticketId, admin.id, content, at);
  db.prepare("UPDATE tickets SET status = 'replied', updated_at = ? WHERE id = ?").run(at, ticketId);
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin");
  revalidatePath("/messages");
}

export async function closeTicketAction(formData: FormData): Promise<void> {
  const admin = await requireUser();
  if (admin.role !== "admin") return;
  const ticketId = Number(formData.get("ticket_id"));
  if (!ticketId) return;
  db.prepare("UPDATE tickets SET status = 'closed', updated_at = ? WHERE id = ?").run(nowStr(), ticketId);
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin");
  revalidatePath("/messages");
}

export async function grantTitleAction(formData: FormData): Promise<void> {
  const admin = await requireUser();
  if (admin.role !== "admin") return;
  const ticketId = Number(formData.get("ticket_id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!ticketId || !title || title.length > 16) return;
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticketId) as
    | { user_id: number }
    | undefined;
  if (!ticket) return;
  db.prepare("UPDATE users SET custom_title = ? WHERE id = ?").run(title, ticket.user_id);
  db.prepare(
    "INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, content, created_at) VALUES (?, ?, 1, ?, ?)"
  ).run(ticketId, admin.id, `管理员已为你授予专属头衔「${title}」，快去个人主页看看吧！`, nowStr());
  db.prepare("UPDATE tickets SET status = 'replied', updated_at = ? WHERE id = ?").run(nowStr(), ticketId);
  revalidatePath("/", "layout");
}
