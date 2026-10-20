export const LEVELS = [
  { min: 100, name: "传奇学长", cls: "bg-[#e45735] text-white" },
  { min: 50, name: "校园达人", cls: "bg-[#fa6c8d] text-white" },
  { min: 20, name: "活跃同学", cls: "bg-[var(--success)] text-white" },
  { min: 5, name: "校园新人", cls: "bg-[var(--tertiary)] text-white" },
  { min: 0, name: "新入校", cls: "bg-[#535a60] text-white" },
];

export function getLevel(postCount: number) {
  return LEVELS.find((l) => postCount >= l.min) ?? LEVELS[LEVELS.length - 1];
}
