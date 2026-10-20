/** 敏感词库：直接在此数组中维护即可（命中后拦截发布并提示） */
export const SENSITIVE_WORDS = [
  "枪支", "弹药", "枪支弹药", "毒品", "冰毒", "大麻", "摇头丸", "k粉", "赌博", "博彩", "赌场",
  "百家乐", "代开发票", "办证刻章", "假证", "迷药", "假钞", "代考", "卖答案", "淫秽", "色情",
  "嫖娼", "援交", "约炮", "裸聊", "传销", "刷单", "安眠药购买",
];

/** 返回内容中命中的第一个敏感词；无则返回 null */
export function findSensitiveWord(text: string): string | null {
  const t = text.toLowerCase().replace(/\s+/g, "");
  return SENSITIVE_WORDS.find((w) => t.includes(w.toLowerCase())) ?? null;
}
