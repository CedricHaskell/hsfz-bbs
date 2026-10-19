"use client";

import { useActionState, useState } from "react";
import { createThreadAction } from "@/app/actions/forum";
import type { ActionState } from "@/app/actions/auth";
import type { BoardRow } from "@/lib/queries";
import { ImagePicker } from "./ImagePicker";
import { SubmitButton } from "./SubmitButton";

export function NewThreadForm({
  boards,
  defaultBoardId,
  isAdmin,
}: {
  boards: BoardRow[];
  defaultBoardId?: number;
  isAdmin: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createThreadAction, null);
  const [boardId, setBoardId] = useState<string>(defaultBoardId ? String(defaultBoardId) : "");
  const visible = isAdmin ? boards : boards.filter((b) => b.slug !== "announcements");
  const isConfession = visible.find((b) => String(b.id) === boardId)?.slug === "confession";

  return (
    <form action={formAction} className="space-y-4 p-4">
      {state && !state.ok && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {state.message}
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">选择板块</label>
        <select
          name="board_id"
          defaultValue={defaultBoardId ?? ""}
          required
          className="input"
          onChange={(e) => setBoardId(e.target.value)}
        >
          <option value="" disabled>
            请选择板块…
          </option>
          {visible.map((b) => (
            <option key={b.id} value={b.id}>
              {b.icon} {b.name}
              {b.grade_lock ? `（仅限${b.grade_lock}）` : ""} — {b.description}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">标题</label>
        <input
          name="title"
          required
          minLength={2}
          maxLength={60}
          className="input"
          placeholder="一句话说清你的主题（2-60 字）"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">正文</label>
        <textarea
          name="content"
          required
          minLength={2}
          rows={8}
          className="input resize-y"
          placeholder="支持换行，请友善发言（遵守社区公约）"
        />
      </div>
      {isConfession && (
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-soft/60 px-3 py-2.5 text-sm">
          <input type="checkbox" name="anonymous" className="h-4 w-4 accent-[#0e7490]" />
          <span>
            匿名发表
            <span className="ml-1 text-xs text-muted">（展示为「匿名同学」；管理员仍可查看作者以维护秩序）</span>
          </span>
        </label>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">图片（最多 4 张，自动压缩）</label>
        <ImagePicker max={4} />
        <p className="mt-1.5 text-xs text-muted">
          支持 JPG / PNG / WEBP / GIF，上传前自动压缩，共 4 张以内。
        </p>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="发布中…">🚀 发布帖子</SubmitButton>
      </div>
    </form>
  );
}
