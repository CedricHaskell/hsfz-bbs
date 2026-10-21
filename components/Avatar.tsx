"use client";

import { useState } from "react";
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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const style = { width: size, height: size };
  if (user.avatar && user.avatar !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar}
        alt={user.nickname}
        loading="lazy"
        style={style}
        onError={() => setFailedSrc(user.avatar ?? null)}
        className={`shrink-0 rounded-md border-[1.5px] border-line bg-card object-cover ${className}`}
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
