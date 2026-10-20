"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendDm, isBlocked, toggleBlock } from "@/lib/dm";
import { findSensitiveWord } from "@/lib/moderation";
import { allowAction } from "@/lib/ratelimit";
import type { ActionState } from "./auth";

const fail = (message: string): ActionState => ({ message, ok: false });

/** 通过用户名发起私信：跳转到与对方的会话页 */
export async function startDmAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!username) return fail("请输入对方的用户名");
  const target = db.prepare("SELECT id, username FROM users WHERE username = ?").get(username) as
    | { id: number; username: string }
    | undefined;
  if (!target) return fail("找不到该用户，请确认用户名");
  if (target.id === user.id) return fail("不能给自己发私信哦");
  redirect(`/dm/${target.username}`);
}

/** 拉黑 / 取消拉黑某用户（双向阻断私信） */
export async function toggleBlockAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const toId = Number(formData.get("to_id"));
  if (!toId || toId === user.id) return;
  const target = db.prepare("SELECT username FROM users WHERE id = ?").get(toId) as
    | { username: string }
    | undefined;
  toggleBlock(user.id, toId);
  if (target) {
    revalidatePath(`/dm/${target.username}`);
    revalidatePath("/dm");
  }
}

/** 在会话中发送一条私信 */
export async function sendDmAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录");
  const toId = Number(formData.get("to_id"));
  const content = String(formData.get("content") ?? "").trim().slice(0, 500);
  if (!toId || toId === user.id) return fail("私信对象不正确");
  if (!content) return fail("内容不能为空");
  if (isBlocked(user.id, toId)) return fail("无法发送：存在拉黑关系");
  const sensitive = findSensitiveWord(content);
  if (sensitive) return fail(`内容包含敏感词「${sensitive}」，请修改后重发`);
  const rate = allowAction(`dm:${user.id}`, 15_000);
  if (!rate.ok) return fail(`发送太频繁啦，请 ${rate.retryAfterSec} 秒后再试`);
  const target = db.prepare("SELECT id, username FROM users WHERE id = ?").get(toId) as
    | { id: number; username: string }
    | undefined;
  if (!target) return fail("对方账号不存在");
  sendDm(user.id, toId, content);
  revalidatePath(`/dm/${target.username}`);
  revalidatePath("/dm");
  return null;
}
