import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { conversationMessages, markConversationRead } from "@/lib/dm";
import { Avatar } from "@/components/Avatar";
import { SendDmForm } from "@/components/DmForms";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "私信会话" };

export default async function DmConversationPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const me = await requireUser();
  const { username } = await params;
  const other = db
    .prepare("SELECT id, username, nickname, avatar FROM users WHERE username = ?")
    .get(username) as { id: number; username: string; nickname: string; avatar: string } | undefined;
  if (!other) notFound();
  if (other.id === me.id) redirect("/dm");

  const messages = conversationMessages(me.id, other.id);
  markConversationRead(me.id, other.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card flex items-center gap-3 p-4">
        <Avatar user={other} size={40} />
        <div className="min-w-0 flex-1">
          <Link href={`/u/${other.username}`} className="font-semibold hover:text-brand hover:underline">
            {other.nickname}
          </Link>
          <p className="text-xs text-muted">@{other.username}</p>
        </div>
        <Link href="/dm" className="btn shrink-0">
          ← 全部私信
        </Link>
      </div>

      <div className="card p-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">还没有消息，发第一条打个招呼吧～</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = m.sender_id === me.id;
              return (
                <li key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  <div className={mine ? "order-2" : ""}>
                    <Avatar
                      user={{ nickname: m.sender_name, username: String(m.sender_id), avatar: "" }}
                      size={32}
                    />
                  </div>
                  <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                    <div
                      className={`inline-block rounded-xl px-3.5 py-2 text-left text-sm leading-6 ${
                        mine ? "bg-brand text-white" : "bg-soft text-ink"
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{timeAgo(m.created_at)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <SendDmForm toId={other.id} />
      </div>
    </div>
  );
}
