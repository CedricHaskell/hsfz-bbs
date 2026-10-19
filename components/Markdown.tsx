import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import { db } from "@/lib/db";

/**
 * 渲染帖文/回复正文：Markdown（GFM）+ LaTeX 公式（$…$ / $$…$$）+ 换行即换行 + @提及。
 * @用户名 仅在账号真实存在时转为个人主页链接；前置不能是字母数字，避免误伤邮箱。
 * 原始 HTML 默认被转义，天然防 XSS。
 */
export function Markdown({ content, className = "" }: { content: string; className?: string }) {
  const withMentions = content.replace(
    /(^|[^a-zA-Z0-9_@])@([a-z0-9_]{3,20})/g,
    (match, pre: string, username: string) =>
      db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)
        ? `${pre}[@${username}](/u/${username})`
        : match
  );

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
      >
        {withMentions}
      </ReactMarkdown>
    </div>
  );
}
