"use client";

import { useActionState, useRef, useState } from "react";
import { createThreadAction } from "@/app/actions/forum";
import type { ActionState } from "@/app/actions/auth";
import type { BoardRow } from "@/lib/queries";
import { SubmitButton } from "./SubmitButton";

const MAX_IMAGES = 4;

/** 压缩到最长边 1600px 的 JPEG（GIF 保持原样以保留动图） */
async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/png") return file;
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [boardId, setBoardId] = useState<string>(defaultBoardId ? String(defaultBoardId) : "");
  const visible = isAdmin ? boards : boards.filter((b) => b.slug !== "announcements");
  const isConfession = visible.find((b) => String(b.id) === boardId)?.slug === "confession";

  async function handleFiles(list: FileList) {
    setBusy(true);
    try {
      const picked = Array.from(list).slice(0, MAX_IMAGES);
      const compressed = await Promise.all(picked.map(compressImage));
      const merged = [...images, ...compressed].slice(0, MAX_IMAGES);
      setImages(merged);
      setPreviews(merged.map((f) => URL.createObjectURL(f)));
      syncInput(merged);
    } finally {
      setBusy(false);
    }
  }

  function removeAt(i: number) {
    const merged = images.filter((_, idx) => idx !== i);
    setImages(merged);
    setPreviews(previews.filter((_, idx) => idx !== i));
    syncInput(merged);
  }

  function syncInput(files: File[]) {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

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
        <label className="mb-1 block text-sm font-medium">图片（最多 {MAX_IMAGES} 张，自动压缩）</label>
        <input
          ref={inputRef}
          type="file"
          name="images"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`图片 ${i + 1}`} className="h-20 w-20 rounded-md border border-line object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                aria-label="移除图片"
              >
                ×
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line text-xs text-muted hover:bg-soft disabled:opacity-50"
            >
              <span className="text-xl">🖼️</span>
              {busy ? "处理中…" : "添加图片"}
            </button>
          )}
        </div>
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
