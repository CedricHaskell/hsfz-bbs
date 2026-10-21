import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { allBoards } from "@/lib/queries";
import { NewThreadForm } from "@/components/NewThreadForm";

export const metadata = { title: "发布新帖" };

export default async function NewThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const user = await requireUser();
  const { board } = await searchParams;
  const boards = allBoards().filter((b) => user.role === "admin" || (!b.grade_lock || b.grade_lock === user.grade));
  const def = board ? boards.find((b) => b.slug === board) : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-lg font-semibold">✏️ 发布新帖</h1>
      <div className="card">
        <div className="card-header">
          新主题 · 发帖前请阅读{" "}
          <Link href="/b/announcements" className="link">
            社区公约
          </Link>
        </div>
        <NewThreadForm boards={boards} defaultBoardId={def?.id} isAdmin={user.role === "admin"} />
      </div>
    </div>
  );
}
