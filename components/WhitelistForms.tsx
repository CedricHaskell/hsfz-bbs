"use client";

import { useActionState } from "react";
import { importWhitelistAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

export function WhitelistImportForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(importWhitelistAction, null);
  return (
    <form action={formAction} className="space-y-3 p-4">
      {state && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            state.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {state.message}
        </div>
      )}
      <textarea
        name="roster"
        rows={5}
        required
        className="input resize-y font-mono text-xs"
        placeholder={"每行一条，逗号分隔，年级可省略：\n张远航, 20250101, 已毕业\n林小满, 20270215, 高二"}
      />
      <p className="text-xs text-muted">
        姓名与学号仅作为审核参考，所有新注册账号均需管理员核实后批准；请同时核实申请年级。
      </p>
      <div className="flex justify-end">
        <SubmitButton>📥 导入名单</SubmitButton>
      </div>
    </form>
  );
}
