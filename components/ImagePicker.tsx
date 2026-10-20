"use client";

import { useRef, useState } from "react";

/** 压缩到最长边 1600px 的 JPEG（GIF/PNG 保持原样以保留动图与透明度） */
async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/png") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
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

/** 图片选择器：多选、客户端压缩、缩略图预览与移除，随所在表单一起提交 */
export function ImagePicker({ max = 4, name = "images" }: { max?: number; name?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function sync(next: File[]) {
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  async function handleFiles(list: FileList) {
    setBusy(true);
    try {
      const picked = Array.from(list).slice(0, max);
      const compressed = await Promise.all(picked.map(compressImage));
      const merged = [...files, ...compressed].slice(0, max);
      setFiles(merged);
      setPreviews(merged.map((f) => URL.createObjectURL(f)));
      sync(merged);
    } finally {
      setBusy(false);
    }
  }

  function removeAt(i: number) {
    const merged = files.filter((_, idx) => idx !== i);
    setFiles(merged);
    setPreviews(previews.filter((_, idx) => idx !== i));
    sync(merged);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {previews.map((src, i) => (
          <div key={src} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`图片 ${i + 1}`}
              className="h-20 w-20 rounded-md border-[1.5px] border-line object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="移除图片"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
            >
              ×
            </button>
          </div>
        ))}
        {files.length < max && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-line text-xs text-muted hover:bg-soft disabled:opacity-50"
          >
            <span className="text-xl">🖼️</span>
            {busy ? "处理中…" : "添加图片"}
          </button>
        )}
      </div>
    </div>
  );
}
