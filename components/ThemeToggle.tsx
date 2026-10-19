"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("hsfz-theme", next ? "dark" : "light");
    } catch {
      /* 隐私模式等场景忽略 */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="切换深色 / 浅色主题"
      title={dark ? "切换到浅色主题" : "切换到深色主题"}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-base text-white/90 hover:bg-white/15"
    >
      {dark === null ? "🌓" : dark ? "🌙" : "☀️"}
    </button>
  );
}
