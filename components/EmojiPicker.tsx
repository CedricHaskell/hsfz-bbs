"use client";

import { useEffect, useRef, useState } from "react";

const EMOJIS =
  "😀 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😍 🥰 😘 😜 🤪 🤔 🤨 🧐 🤓 😎 🥳 😏 😌 😔 😪 😭 😢 😱 🥺 🤗 🤫 🤭 😇 🙄 😴 😷 🤒 🤕 🤧 🥵 🥶 🤯 😤 👍 👎 👏 🙌 🤝 💪 🙏 👀 💯 🔥 ✨ 🎉 🎓 📚 ✏️ 📝 ❤️ 💚 💙 💜 🖤 ⭐ 🌙".split(
    " "
  );

/** 表情选择器：把选中的表情插入到目标输入框的光标处 */
export function EmojiPicker({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function pick(emoji: string) {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + emoji + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + emoji.length;
    el.focus();
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        aria-label="插入表情"
        className="text-lg leading-none hover:opacity-70"
        onClick={() => setOpen(!open)}
      >
        😀
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 grid w-72 grid-cols-8 gap-1 rounded-md border border-line bg-card p-2 shadow-lg">
          {EMOJIS.map((e, i) => (
            <button
              key={i}
              type="button"
              className="cursor-pointer rounded p-1 text-lg hover:bg-soft"
              onClick={() => {
                pick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
