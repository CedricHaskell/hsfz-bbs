"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { nowStr } from "@/lib/format";
import { saveUploadImage, removeUploadFile } from "@/lib/upload";
import type { ActionState } from "./auth";

const fail = (message: string): ActionState => ({ message, ok: false });

export async function createThreadAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录后再发帖");
  const boardId = Number(formData.get("board_id"));
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!boardId) return fail("请选择板块");
  if (title.length < 2 || title.length > 60) return fail("标题长度需在 2-60 字之间");
  if (content.length < 2) return fail("正文太短啦，多写一点");
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId) as
    | { id: number; slug: string; name: string; grade_lock: string }
    | undefined;
  if (!board) return fail("板块不存在");
  if (board.slug === "announcements" && user.role !== "admin")
    return fail("只有管理员可以在站务公告板块发帖");
  if (board.grade_lock && user.role !== "admin" && user.grade !== board.grade_lock)
    return fail(
      `「${board.name}」是年级群，仅限${board.grade_lock}同学发言` +
        (user.grade ? `（你当前是${user.grade}）` : "（你还未填写年级）") +
        "，可在「账号设置」中确认年级"
    );

  // 图片附件（最多 4 张，浏览器端已压缩）
  const files = formData.getAll("images").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (files.length > 4) return fail("图片最多 4 张");
  const imagePaths: string[] = [];
  try {
    for (const f of files) imagePaths.push(await saveUploadImage(f, "post"));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "图片保存失败，请重试");
  }

  // 匿名发表：仅表白墙板块支持
  const anonymous = formData.get("anonymous") === "on" && board.slug === "confession" ? 1 : 0;

  const info = db
    .prepare(
      `INSERT INTO threads (board_id, author_id, title, content, images, anonymous, created_at, last_reply_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      boardId,
      user.id,
      title,
      content,
      imagePaths.length ? JSON.stringify(imagePaths) : "",
      anonymous,
      nowStr(),
      nowStr()
    );
  revalidatePath("/", "layout");
  redirect(`/t/${info.lastInsertRowid}`);
}

export async function createReplyAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("请先登录后再回复");
  const threadId = Number(formData.get("thread_id"));
  const content = String(formData.get("content") ?? "").trim();
  if (!threadId) return fail("帖子不存在");
  if (!content) return fail("回复内容不能为空");
  const thread = db
    .prepare(
      `SELECT th.id, b.grade_lock, b.name AS board_name
       FROM threads th JOIN boards b ON b.id = th.board_id WHERE th.id = ?`
    )
    .get(threadId) as { id: number; grade_lock: string; board_name: string } | undefined;
  if (!thread) return fail("帖子不存在或已删除");
  if (thread.grade_lock && user.role !== "admin" && user.grade !== thread.grade_lock)
    return fail(
      `该帖位于年级群「${thread.board_name}」，仅限${thread.grade_lock}同学回复，可到「账号设置」中确认年级`
    );

  // 回复图片（最多 2 张，浏览器端已压缩）
  const files = formData.getAll("images").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (files.length > 2) return fail("回复图片最多 2 张");
  const imagePaths: string[] = [];
  try {
    for (const f of files) imagePaths.push(await saveUploadImage(f, "reply"));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "图片保存失败，请重试");
  }

  db.prepare(
    "INSERT INTO replies (thread_id, author_id, content, images, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(threadId, user.id, content, imagePaths.length ? JSON.stringify(imagePaths) : "", nowStr());
  db.prepare("UPDATE threads SET reply_count = reply_count + 1, last_reply_at = ? WHERE id = ?").run(
    nowStr(),
    threadId
  );
  revalidatePath(`/t/${threadId}`);
  revalidatePath("/");
  return null;
}

/** 作者删除自己的帖子（连同回复、点赞、收藏、图片） */
export async function deleteOwnThreadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const threadId = Number(formData.get("thread_id"));
  if (!threadId) return;
  const thread = db
    .prepare(
      `SELECT th.id, th.author_id, th.images, b.slug
       FROM threads th JOIN boards b ON b.id = th.board_id WHERE th.id = ?`
    )
    .get(threadId) as { id: number; author_id: number; images: string; slug: string } | undefined;
  // 只有作者本人能删自己的帖子
  if (!thread || thread.author_id !== user.id) return;
  if (thread.images) {
    try {
      (JSON.parse(thread.images) as string[]).forEach((u) => removeUploadFile(u));
    } catch {
      /* 图片路径解析失败则跳过清理 */
    }
  }
  // 清理回复中的图片
  const replyImgRows = db
    .prepare("SELECT images FROM replies WHERE thread_id = ? AND images != ''")
    .all(threadId) as { images: string }[];
  replyImgRows.forEach((row) => {
    try {
      (JSON.parse(row.images) as string[]).forEach((u) => removeUploadFile(u));
    } catch {
      /* 忽略 */
    }
  });
  db.prepare("DELETE FROM replies WHERE thread_id = ?").run(threadId);
  db.prepare("DELETE FROM thread_likes WHERE thread_id = ?").run(threadId);
  db.prepare("DELETE FROM thread_favorites WHERE thread_id = ?").run(threadId);
  db.prepare("DELETE FROM threads WHERE id = ? AND author_id = ?").run(threadId, user.id);
  revalidatePath("/", "layout");
  redirect(`/b/${thread.slug}`);
}

export async function toggleLikeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const threadId = Number(formData.get("thread_id"));
  if (!threadId) return;
  const liked = db
    .prepare("SELECT 1 AS x FROM thread_likes WHERE user_id = ? AND thread_id = ?")
    .get(user.id, threadId);
  if (liked) db.prepare("DELETE FROM thread_likes WHERE user_id = ? AND thread_id = ?").run(user.id, threadId);
  else db.prepare("INSERT INTO thread_likes (user_id, thread_id) VALUES (?, ?)").run(user.id, threadId);
  revalidatePath(`/t/${threadId}`);
  revalidatePath("/");
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const threadId = Number(formData.get("thread_id"));
  if (!threadId) return;
  const faved = db
    .prepare("SELECT 1 AS x FROM thread_favorites WHERE user_id = ? AND thread_id = ?")
    .get(user.id, threadId);
  if (faved)
    db.prepare("DELETE FROM thread_favorites WHERE user_id = ? AND thread_id = ?").run(user.id, threadId);
  else db.prepare("INSERT INTO thread_favorites (user_id, thread_id) VALUES (?, ?)").run(user.id, threadId);
  revalidatePath(`/t/${threadId}`);
}
