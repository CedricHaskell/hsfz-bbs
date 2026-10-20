"use client";

import { useEffect, useState } from "react";
import { avatarColor } from "@/lib/format";

export function Avatar({
  user,
  size = 40,
  className = "",
}: {
  user: { nickname: string; username: string; avatar?: string | null };
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  // 切换对象或头像地址变化时重置加载状态
  useEffect(() => setBroken(false), [user.avatar, user.username]);

  const style = { width: size, height: size };
  if (user.avatar && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar}
        alt={user.nickname}
        loading="lazy"
        style={style}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-md border border-line bg-card object-cover ${className}`}
      />
    );
  }
  return (
    <span
      style={style}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold text-white ${avatarColor(user.username)} ${className}`}
      aria-hidden
    >
      <span style={{ fontSize: Math.round(size * 0.45), lineHeight: 1 }}>
        {user.nickname.slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}
