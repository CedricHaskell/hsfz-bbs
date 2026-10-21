export function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function nowStr(): string {
  return fmtDate(new Date());
}

export function timeAgo(s?: string | null): string {
  if (!s) return "";
  const t = new Date(s.replace(" ", "T")).getTime();
  if (Number.isNaN(t)) return s;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return s.slice(0, 10);
}

export function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// 字母头像配色（Discourse 色板：tertiary/quaternary/success/love/danger/highlight + 灰）
const AVATAR_COLORS = [
  "bg-[#0088cc]",
  "bg-[#e45735]",
  "bg-[#009900]",
  "bg-[#fa6c8d]",
  "bg-[#c80001]",
  "bg-[#a87137]",
  "bg-[#535a60]",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function ticketCategoryName(cat: string): string {
  return (
    {
      title_request: "🎫 头衔申请",
      suggestion: "💡 改进建议",
      report: "🚩 举报",
      other: "💬 其他",
    }[cat] ?? "💬 其他"
  );
}

export const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "待处理", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30" },
  replied: { label: "已回复", cls: "bg-brand/10 text-brand border border-brand/20" },
  closed: { label: "已关闭", cls: "bg-muted/10 text-muted border border-line" },
};
