"use client";

import { useActionState } from "react";
import { sendDmAction, startDmAction } from "@/app/actions/dm";
import type { ActionState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

function Alert({ state }: { state: ActionState }) {
  if (!state || state.ok) return null;
  return (
    <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
      {state.message}
    </div>
  );
}

/** 输入用户名发起新私信 */
export function StartDmForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(startDmAction, null);
  return (
    <form action={formAction} className="space-y-3 p-4">
      <Alert state={state} />
      <div className="flex gap-2">
        <input
          name="username"
          required
          className="input"
          placeholder="输入对方的用户名，如 xiaoxiao"
        />
        <SubmitButton className="btn shrink-0">发私信</SubmitButton>
      </div>
    </form>
  );
}

/** 会话页发送框 */
export function SendDmForm({ toId }: { toId: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(sendDmAction, null);
  return (
    <form action={formAction} className="border-t-[1.5px] border-line p-4">
      <input type="hidden" name="to_id" value={toId} />
      <Alert state={state} />
      <div className="flex items-end gap-2">
        <textarea
          name="content"
          required
          maxLength={500}
          rows={2}
          className="input resize-y flex-1"
          placeholder="输入私信内容（500 字以内），回车旁的按钮发送"
        />
        <SubmitButton className="btn-primary shrink-0">发送</SubmitButton>
      </div>
    </form>
  );
}
