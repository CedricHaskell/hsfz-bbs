"use client";

import { useEffect, useRef, useState } from "react";

/** 压缩到最长边 1600px 的 JPEG；其余格式留给服务端处理，保留动图与透明度。 */
async function compressImage(file: File): Promise<File> {
  if (["image/gif", "image/png", "image/webp"].includes(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** 图片选择器：多选、客户端压缩、缩略图预览与移除，随所在表单一起提交 */
export function ImagePicker({ max = 4, name = "images", onBusyChange }: { max?: number; name?: string; onBusyChange?: (busy: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chooserRef = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const allocated = urls.current;
    return () => { for (const url of allocated) URL.revokeObjectURL(url); };
  }, []);

  function sync(next: File[]) {
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  async function handleFiles(list: FileList) {
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      const picked = Array.from(list).slice(0, max - files.length);
      if (picked.some((file) => file.size > 8 * 1024 * 1024)) throw new Error("单张图片不能超过 8MB");
      const compressed = await Promise.all(picked.map(compressImage));
      const merged = [...files, ...compressed].slice(0, max);
      setFiles(merged);
      const added = compressed.map((f) => {
        const url = URL.createObjectURL(f);
        urls.current.add(url);
        return url;
      });
      setPreviews([...previews, ...added]);
      sync(merged);
    } catch (error) {
      setError(error instanceof Error ? error.message : "图片处理失败，请换一张图片重试");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      if (chooserRef.current) chooserRef.current.value = "";
    }
  }

  function removeAt(i: number) {
    URL.revokeObjectURL(previews[i]);
    urls.current.delete(previews[i]);
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
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={chooserRef}
        type="file"
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
              disabled={busy}
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
            onClick={() => chooserRef.current?.click()}
            className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-line text-xs text-muted hover:bg-soft disabled:opacity-50"
          >
            <span className="text-xl">🖼️</span>
            {busy ? "处理中…" : "添加图片"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
