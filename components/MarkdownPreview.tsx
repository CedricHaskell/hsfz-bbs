"use client";

import { RichText } from "./RichText";

/** 编辑器实时预览（客户端渲染；@提及在正式发布后才会转链接） */
export function MarkdownPreview({ content, className = "" }: { content: string; className?: string }) {
  return <RichText content={content || "*（暂无内容）*"} className={className} />;
}
