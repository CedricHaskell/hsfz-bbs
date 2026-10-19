export const LEVELS = [
  { min: 100, name: "传奇学长", cls: "bg-[#8250df] text-white" },
  { min: 50, name: "校园达人", cls: "bg-[#bc4c00] text-white" },
  { min: 20, name: "活跃同学", cls: "bg-[#1a7f37] text-white" },
  { min: 5, name: "校园新人", cls: "bg-[#0969da] text-white" },
  { min: 0, name: "新入校", cls: "bg-[#57606a] text-white" },
];

export function getLevel(postCount: number) {
  return LEVELS.find((l) => postCount >= l.min) ?? LEVELS[LEVELS.length - 1];
}
