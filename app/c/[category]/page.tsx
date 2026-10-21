import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allBoards } from "@/lib/queries";
import { CAT_DESC, CAT_EMOJI, UNIV_CITY_ORDER } from "@/lib/categories";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { category } = await params;
  const cat = decodeURIComponent(category);
  const emoji = CAT_EMOJI[cat];
  const desc = CAT_DESC[cat];
  if (!emoji && !desc) notFound();

  const boards = allBoards().filter((b) => b.category === cat);

  // 大学分区按城市分组，其余分区平铺
  const isUniv = cat === "大学";
  const cityGroups = isUniv
    ? UNIV_CITY_ORDER.map((city) => ({
        city,
        items: boards.filter((b) => b.city === city),
      }))
        .concat(
          (() => {
            // 防御：城市字段不在序列中的板块归入「其他」，避免漏显示
            const stray = boards.filter(
              (b) => !UNIV_CITY_ORDER.includes(b.city ?? "")
            );
            return stray.length ? [{ city: "其他", items: stray }] : [];
          })()
        )
        .filter((g) => g.items.length)
    : [];

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <Link href="/" className="text-xs text-muted hover:text-brand hover:underline">
          ← 返回首页
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {emoji} {cat}
        </h1>
        <p className="mt-1 text-sm text-muted">{desc}</p>
        <p className="mt-1 text-xs text-muted">共 {boards.length} 个板块</p>
      </div>

      {isUniv ? (
        cityGroups.map(({ city, items }) => (
          <section key={city}>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-muted">
              📍 {city}
              <span className="text-xs font-normal">· {items.length} 所学校</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((b) => (
                <BoardCard key={b.id} b={b} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <BoardCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardCard({ b }: { b: { slug: string; name: string; description: string; icon: string; thread_count: number } }) {
  return (
    <Link href={`/b/${b.slug}`} className="card group p-4 transition-colors hover:border-brand">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-semibold group-hover:text-brand">
          {b.icon} {b.name}
        </p>
        <span className="shrink-0 text-xs text-muted">{b.thread_count} 帖</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted">{b.description}</p>
    </Link>
  );
}
