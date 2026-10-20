import { db } from "./db";
import { nowStr } from "./format";
import { markdownMentionNames } from "./markdown-mentions";

export type NotifyType = "reply" | "quote" | "mention" | "like" | "follow";

/** 创建一条站内通知（不通知自己） */
export function notify(
  userId: number,
  type: NotifyType,
  actorId: number,
  threadId: number,
  replyId: number,
  content: string
) {
  if (userId <= 0 || actorId <= 0 || userId === actorId) return;
  if (type === "like" || type === "follow") {
    const exists = db.prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND actor_id = ?
      AND type = ? AND thread_id = ? AND created_at >= datetime('now','localtime','-1 hour') LIMIT 1`)
      .get(userId, actorId, type, threadId);
    if (exists) return;
  }
  db.prepare(
    `INSERT INTO notifications (user_id, type, actor_id, thread_id, reply_id, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, type, actorId, threadId, replyId, content.slice(0, 120), nowStr());
}

/** 提取正文中的 @提及（用户名需真实存在，排除自己） */
export function mentionUserIds(content: string, excludeId: number): number[] {
  const limitedNames = markdownMentionNames(content, 20);
  if (!limitedNames.length) return [];
  const rows = db.prepare(`SELECT id FROM users WHERE username IN (${limitedNames.map(() => "?").join(",")})
    AND id != ? AND status = 'approved' AND banned = 0`).all(...limitedNames, excludeId) as { id: number }[];
  return rows.map((row) => row.id);
}

export function unreadNotificationCount(userId: number): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0")
      .get(userId) as { c: number }
  ).c;
}

export function recentNotifications(userId: number, limit = 30) {
  return db
    .prepare(
      `SELECT n.*, a.nickname AS actor_name, a.avatar AS actor_avatar
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
       WHERE n.user_id = ?
       ORDER BY n.id DESC LIMIT ?`
    )
    .all(userId, limit) as Array<{
      id: number; type: string; actor_id: number; thread_id: number; reply_id: number;
      content: string; is_read: number; created_at: string;
      actor_name: string | null; actor_avatar: string;
    }>;
}

/** 全部标记已读（进入消息页时调用） */
export function markNotificationsRead(userId: number) {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(userId);
}
