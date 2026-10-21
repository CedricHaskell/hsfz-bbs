import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listConversations, unreadDmCount } from "@/lib/dm";
import { Avatar } from "@/components/Avatar";
import { StartDmForm } from "@/components/DmForms";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "私信" };

export default async function DmPage() {
  const user = await requireUser();
  const conversations = listConversations(user.id);
  const unread = unreadDmCount(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">📨 私信</h1>
      <p className="text-sm text-muted">
        和同学一对一交流。未读私信 <b className="text-ink">{unread}</b> 条。私信仅双方可见，遇到骚扰请通过工单举报。
      </p>

      <div className="card">
        <div className="card-header">✉️ 发起新私信</div>
        <StartDmForm />
      </div>

      <div className="card">
        <div className="card-header">会话列表（{conversations.length}）</div>
        {conversations.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted">
            还没有私信。去同学的个人主页点「发私信」，或在上面的输入框里输入 TA 的用户名～
          </p>
        ) : (
          <ul className="divide-y-[1.5px] divide-line">
            {conversations.map((c) => (
              <li key={c.other.id}>
                <Link
                  href={`/dm/${c.other.username}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-soft/60"
                >
                  <span className="shrink-0">
                    <Avatar user={c.other} size={40} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.other.nickname}</span>
                      {c.unread > 0 && (
                        <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {c.last.mine ? "我：" : ""}
                      {c.last.content}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(c.last.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
