"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { createReplyAction } from "@/app/actions/forum";
import type { ActionState } from "@/app/actions/auth";
import { EmojiPicker } from "./EmojiPicker";
import { ImagePicker } from "./ImagePicker";
import { SubmitButton } from "./SubmitButton";

export function ReplyForm({
  threadId,
  nickname,
  quote,
}: {
  threadId: number;
  nickname: string;
  quote?: { replyTo: number; floor: number; nickname: string; content: string };
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createReplyAction, null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  return (
    <form action={formAction} id="reply-form" className="card mt-4 scroll-mt-24 p-4">
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="reply_to" value={quote?.replyTo ?? 0} />
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-sm font-medium">
          {quote ? (
            <span>
              回复 <b>@{quote.nickname}</b> 的 #{quote.floor} 楼
            </span>
          ) : (
            `回复 · ${nickname}`
          )}
        </label>
        <EmojiPicker targetRef={contentRef} />
      </div>
      {quote && (
        <div className="mb-3 rounded-md border-l-4 border-brand/60 bg-soft/70 px-3 py-2 text-xs text-muted">
          {quote.content.slice(0, 80)}
          {quote.content.length > 80 ? "…" : ""}
          <Link href={`/t/${threadId}#reply-form`} className="ml-2 text-brand hover:underline">
            取消引用
          </Link>
        </div>
      )}
      {state && !state.ok && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {state.message}
        </div>
      )}
      <textarea
        ref={contentRef}
        name="content"
        required
        rows={4}
        className="input resize-y"
        placeholder="友善回复，理性讨论…"
      />
      <p className="mt-1.5 text-xs text-muted">支持 Markdown · @用户名 · $LaTeX$ 公式 · 表情</p>
      <div className="mt-3">
        <ImagePicker max={2} />
        <p className="mt-1.5 text-xs text-muted">可附 2 张图片，上传前自动压缩。</p>
      </div>
      <div className="mt-3 flex justify-end">
        <SubmitButton>↩︎ 回复</SubmitButton>
      </div>
    </form>
  );
}
