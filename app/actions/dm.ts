"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendDm } from "@/lib/dm";
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

/** 在会话中发送一条私信 */
export async function sendDmAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录");
  const toId = Number(formData.get("to_id"));
  const content = String(formData.get("content") ?? "").trim().slice(0, 500);
  if (!toId || toId === user.id) return fail("私信对象不正确");
  if (!content) return fail("内容不能为空");
  const target = db.prepare("SELECT id, username FROM users WHERE id = ?").get(toId) as
    | { id: number; username: string }
    | undefined;
  if (!target) return fail("对方账号不存在");
  sendDm(user.id, toId, content);
  revalidatePath(`/dm/${target.username}`);
  revalidatePath("/dm");
  return null;
}
