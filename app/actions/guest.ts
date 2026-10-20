"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { allowAction } from "@/lib/ratelimit";

const fail = (message: string): { ok: boolean; message: string } => ({ message, ok: false });
const okMsg = (message: string): { ok: boolean; message: string } => ({ message, ok: true });

export type GuestRequestState = { ok: boolean; message: string } | null;

/** 游客提交登录求助（无需登录；仅管理员在后台可见） */
export async function submitGuestRequestAction(
  _prev: GuestRequestState,
  formData: FormData
): Promise<GuestRequestState> {
  const rawUsername = formData.get("username") ?? "";
  const rawContact = formData.get("contact");
  const rawDetail = formData.get("detail");
  if (typeof rawUsername !== "string" || typeof rawContact !== "string" || typeof rawDetail !== "string") {
    return fail("请填写用户名、联系方式和问题描述，不能上传文件");
  }
  if (rawUsername.length > 30) return fail("用户名不能超过 30 字");
  if (rawContact.length > 60) return fail("联系方式不能超过 60 字");
  if (rawDetail.length > 300) return fail("问题描述不能超过 300 字");
  if (/[\u0000-\u001f\u007f]/.test(rawUsername + rawContact) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(rawDetail)) {
    return fail("填写内容含有无效字符，请检查后重试");
  }
  const username = rawUsername.trim();
  const contact = rawContact.trim();
  const detail = rawDetail.trim();
  if (!contact) return fail("请留下联系方式（QQ / 微信号），方便管理员联系你");
  if (!detail) return fail("请简单描述你遇到的问题");
  const ip = clientIpFromHeaders(await headers());
  const rate = allowAction(`guest-request:${ip}`, 15 * 60_000, 3);
  if (!rate.ok) return fail(`提交过于频繁，请 ${rate.retryAfterSec} 秒后再试`);
  try {
    db.prepare(
      "INSERT INTO guest_requests (username, contact, detail, created_at) VALUES (?, ?, ?, datetime('now','localtime'))"
    ).run(username, contact, detail);
  } catch {
    return fail("求助保存失败，请稍后重试");
  }
  revalidatePath("/admin");
  return okMsg("已提交！管理员会尽快通过你留下的方式联系你，请留意消息。");
}

/** 管理员删除一条已处理的求助 */
export async function deleteGuestRequestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return;
  db.prepare("DELETE FROM guest_requests WHERE id = ?").run(id);
  revalidatePath("/admin");
}
