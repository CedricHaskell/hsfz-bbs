import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import { mentionPlugin } from "@/lib/markdown-mentions";

/** Shared rendering keeps the editor preview and posted Markdown consistent. */
export function RichText({ content, className = "", usernames = [] }: {
  content: string;
  className?: string;
  usernames?: readonly string[];
}) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks, mentionPlugin(usernames)]}
        rehypePlugins={[[rehypeKatex, { trust: false, throwOnError: false }]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
