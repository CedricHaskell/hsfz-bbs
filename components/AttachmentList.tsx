"use client";

import { useState } from "react";
import type { AttachmentSummary } from "@/lib/attachments";
import { PdfPreview } from "./PdfPreview";

export function AttachmentList({ attachments }: { attachments: AttachmentSummary[] }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  if (!attachments.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {attachments.map((attachment) => {
        const id = String(attachment.id);
        const preview = attachment.kind === "pdf" && previewId === id;
        const url = `/attachments/${encodeURIComponent(id)}`;
        return (
          <li key={id} className="overflow-hidden rounded-md border-[1.5px] border-line bg-soft/30">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 break-all font-medium">{attachment.name}</span>
              <span className="shrink-0 text-xs text-muted">{attachment.size < 1024 * 1024 ? `${Math.ceil(attachment.size / 1024)} KB` : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`}</span>
              {attachment.kind === "pdf" && <button type="button" className="shrink-0 text-brand hover:underline" aria-expanded={preview} aria-controls={`attachment-preview-${id}`} onClick={() => setPreviewId(preview ? null : id)}>{preview ? "收起预览" : "预览"}</button>}
              <a href={url} download={attachment.name} className="shrink-0 text-brand hover:underline">下载</a>
            </div>
            {preview && (
              <div id={`attachment-preview-${id}`} className="border-t border-line bg-paper">
                <PdfPreview url={`${url}?preview=1`} name={attachment.name} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
