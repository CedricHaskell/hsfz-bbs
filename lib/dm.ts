import { db } from "./db";
import { nowStr } from "./format";

export function unreadDmCount(userId: number): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS c FROM direct_messages WHERE recipient_id = ? AND is_read = 0")
      .get(userId) as { c: number }
  ).c;
}

export type DmConversation = {
  other: { id: number; username: string; nickname: string; avatar: string };
  last: { content: string; created_at: string; mine: boolean };
  unread: number;
};

/** 与用户有关的所有私信会话（按最近消息倒序） */
export function listConversations(userId: number): DmConversation[] {
  const rows = db
    .prepare(
      `SELECT m.id, m.sender_id, m.recipient_id, m.content, m.is_read, m.created_at,
              CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END AS other_id
       FROM direct_messages m
       WHERE m.sender_id = ? OR m.recipient_id = ?
       ORDER BY m.id ASC`
    )
    .all(userId, userId, userId) as Array<{
      id: number; sender_id: number; recipient_id: number; content: string;
      is_read: number; created_at: string; other_id: number;
    }>;

  const map = new Map<number, DmConversation>();
  for (const r of rows) {
    if (!map.has(r.other_id)) {
      const other = db
        .prepare("SELECT id, username, nickname, avatar FROM users WHERE id = ?")
        .get(r.other_id) as { id: number; username: string; nickname: string; avatar: string } | undefined;
      if (!other) continue; // 对方账号已删除
      map.set(r.other_id, { other, last: { content: "", created_at: "", mine: false }, unread: 0 });
    }
    const conv = map.get(r.other_id)!;
    conv.last = { content: r.content, created_at: r.created_at, mine: r.sender_id === userId };
    if (r.recipient_id === userId && r.is_read === 0) conv.unread++;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.last.created_at < b.last.created_at ? 1 : -1
  );
}

export function conversationMessages(userId: number, otherId: number) {
  return db
    .prepare(
      `SELECT m.*, u.nickname AS sender_name
       FROM direct_messages m JOIN users u ON u.id = m.sender_id
       WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
       ORDER BY m.id ASC`
    )
    .all(userId, otherId, otherId, userId) as Array<{
      id: number; sender_id: number; recipient_id: number; content: string;
      is_read: number; created_at: string; sender_name: string;
    }>;
}

export function markConversationRead(userId: number, otherId: number) {
  db.prepare(
    "UPDATE direct_messages SET is_read = 1 WHERE recipient_id = ? AND sender_id = ? AND is_read = 0"
  ).run(userId, otherId);
}

export function sendDm(fromId: number, toId: number, content: string) {
  db.prepare(
    "INSERT INTO direct_messages (sender_id, recipient_id, content, created_at) VALUES (?, ?, ?, ?)"
  ).run(fromId, toId, content, nowStr());
}

/** 两者间是否存在拉黑关系（任一方拉黑即生效） */
export function isBlocked(a: number, b: number): boolean {
  return !!db
    .prepare(
      "SELECT 1 AS x FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)"
    )
    .get(a, b, b, a);
}

export function toggleBlock(userId: number, targetId: number): "blocked" | "unblocked" {
  const existing = db
    .prepare("SELECT id FROM blocks WHERE user_id = ? AND blocked_id = ?")
    .get(userId, targetId) as { id: number } | undefined;
  if (existing) {
    db.prepare("DELETE FROM blocks WHERE id = ?").run(existing.id);
    return "unblocked";
  }
  db.prepare(
    "INSERT INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, datetime('now','localtime'))"
  ).run(userId, targetId);
  return "blocked";
}
