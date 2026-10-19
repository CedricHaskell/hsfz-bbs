"use client";

import { useActionState } from "react";
import { createReplyAction } from "@/app/actions/forum";
import type { ActionState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

export function ReplyForm({ threadId, nickname }: { threadId: number; nickname: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createReplyAction, null);
  return (
    <form action={formAction} className="card mt-4 p-4">
      <input type="hidden" name="thread_id" value={threadId} />
      <label className="mb-1.5 block text-sm font-medium">回复 · {nickname}</label>
      {state && !state.ok && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {state.message}
        </div>
      )}
      <textarea
        name="content"
        required
        rows={4}
        className="input resize-y"
        placeholder="友善回复，理性讨论…"
      />
      <div className="mt-3 flex justify-end">
        <SubmitButton>↩︎ 回复</SubmitButton>
      </div>
    </form>
  );
}
