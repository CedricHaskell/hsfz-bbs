import type { Root, RootContent } from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).freeze();
const excluded = new Set(["link", "linkReference", "code", "inlineCode", "math", "inlineMath", "html", "image", "imageReference"]);
const mentionPattern = /(^|[^a-zA-Z0-9_@])@([a-z0-9_]{3,20})(?![a-zA-Z0-9_])/g;
type Parent = Root | { children: RootContent[] };

function visitProse(parent: Parent, visit: (text: string) => void) {
  for (const node of parent.children) {
    if (node.type === "text") visit(node.value);
    else if ("children" in node && !excluded.has(node.type)) visitProse(node as Parent, visit);
  }
}

/** Use the same Markdown grammar for visible mentions and notification recipients. */
export function markdownMentionNames(content: string, limit = 100): string[] {
  const names = new Set<string>();
  if (limit <= 0) return [];
  const tree = parser.parse(content);
  visitProse(tree, (text) => {
    if (names.size >= limit) return;
    for (const match of text.matchAll(mentionPattern)) {
      names.add(match[2]);
      if (names.size >= limit) break;
    }
  });
  return [...names];
}

/** Adapted from PR #3: transform prose AST nodes instead of rewriting Markdown source. */
export function mentionPlugin(usernames: readonly string[]) {
  const known = new Set(usernames);
  return () => (tree: Root) => {
    if (!known.size) return;
    function walk(parent: Parent) {
      const result: RootContent[] = [];
      for (const node of parent.children) {
        if (node.type === "text") {
          const text = node.value;
          let cursor = 0;
          for (const match of text.matchAll(mentionPattern)) {
            if (!known.has(match[2])) continue;
            const start = match.index + match[1].length;
            if (start > cursor) result.push({ type: "text", value: text.slice(cursor, start) });
            result.push({ type: "link", url: `/u/${match[2]}`, children: [{ type: "text", value: `@${match[2]}` }] });
            cursor = start + match[2].length + 1;
          }
          result.push({ type: "text", value: text.slice(cursor) });
        } else {
          if ("children" in node && !excluded.has(node.type)) walk(node as Parent);
          result.push(node);
        }
      }
      parent.children = result;
    }
    walk(tree);
  };
}
