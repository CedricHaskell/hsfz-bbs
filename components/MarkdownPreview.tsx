"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";

/** 编辑器实时预览（客户端渲染；@提及在正式发布后才会转链接） */
export function MarkdownPreview({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
      >
        {content || "*（暂无内容）*"}
      </ReactMarkdown>
    </div>
  );
}
