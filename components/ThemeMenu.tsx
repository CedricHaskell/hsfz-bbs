"use client";

import { useEffect, useRef, useState } from "react";

const PRESETS = [
  { key: "teal", label: "原版青绿", icon: "🟢" },
  { key: "blue", label: "蔚蓝", icon: "🔵" },
  { key: "discourse", label: "清爽", icon: "🎨" },
  { key: "dark", label: "深色", icon: "🌙" },
];

export default function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("teal");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(document.documentElement.getAttribute("data-theme") || "teal");
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function apply(key: string) {
    const root = document.documentElement;
    root.classList.toggle("dark", key === "dark");
    root.setAttribute("data-theme", key);
    try {
      localStorage.setItem("hsfz-theme-preset", key);
    } catch {
      /* 忽略 */
    }
    setCurrent(key);
    setOpen(false);
  }

  const active = PRESETS.find((p) => p.key === current) ?? PRESETS[0];
  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        aria-label="选择主题"
        title={"主题：" + active.label}
        className="flex h-8 cursor-pointer items-center justify-center rounded-md text-base text-white/90 hover:bg-white/15"
        onClick={() => setOpen(!open)}
      >
        🎨
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-md border border-line bg-card p-1 shadow-lg">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => apply(p.key)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm hover:bg-soft ${
                current === p.key ? "font-semibold text-brand" : "text-ink"
              }`}
            >
              <span>{p.icon}</span>
              {p.label}
              {current === p.key && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
