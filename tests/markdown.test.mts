import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "../components/RichText";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { markdownMentionNames } from "../lib/markdown-mentions";

const render = (content: string, usernames: string[] = []) =>
  renderToStaticMarkup(createElement(RichText, { content, usernames }));

test("shared Markdown rendering preserves GFM, math and headings without enabling raw HTML", () => {
  const html = render("# Topic\n\n**bold** and $x^2$\n\n$$\n\\sum_{i=1}^{n} i\n$$\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))");
  assert.match(html, /<h1>Topic<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /class="katex"/);
  assert.match(html, /katex-display/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<script>|href="javascript:/);
});

test("mentions become links only in prose, preserving code, math, links and email addresses", () => {
  const source = [
    "Hello @student_test and **@student_test**; @unknown_user stays plain.",
    "`@student_test`",
    "```\n@student_test\n```",
    "$@student_test$",
    "$$\n@student_test\n$$",
    "[@student_test](https://example.com/@student_test)",
    "[@student_test][reference]\n\n[reference]: https://example.org/@student_test",
    "![avatar @student_test](https://example.org/avatar.png)",
    "https://example.org/@student_test and student@student_test.example",
  ].join("\n\n");
  const html = render(source, ["student_test"]);
  assert.equal((html.match(/href="\/u\/student_test"/g) ?? []).length, 2);
  assert.match(html, /<code>@student_test<\/code>/);
  assert.match(html, /href="https:\/\/example.com\/@student_test"/);
  assert.doesNotMatch(html, /href="\/u\/unknown_user"/);
  assert.deepEqual(markdownMentionNames(source), ["student_test", "unknown_user"]);
});

test("mention extraction ignores code and links and bounds distinct candidates", () => {
  const source = "`@code_user`\n\n[link @link_user](https://example.com/@path_user)\n\n$@math_user$\n\nuser@email_user.example\n\n" +
    Array.from({ length: 25 }, (_, index) => `@student_${index}`).join(" ") + " @student_0";
  assert.deepEqual(markdownMentionNames(source, 20), Array.from({ length: 20 }, (_, index) => `student_${index}`));
  assert.deepEqual(markdownMentionNames(source, 0), []);
  assert.deepEqual(markdownMentionNames("@abcdefghijklmnopqrstu @valid_userX @valid_user"), ["valid_user"]);
});

test("KaTeX remains untrusted and cannot create executable links", () => {
  const html = render("$\\href{javascript:alert(1)}{click}$\n\n$\\htmlClass{unsafe}{text}$");
  assert.doesNotMatch(html, /href="javascript:|class="unsafe"/);
});

test("editor preview and published content use the same renderer", () => {
  const content = "**Same source**\nnext line\n\n$x^2$\n\n- first\n- second";
  const preview = renderToStaticMarkup(createElement(MarkdownPreview, { content, className: "test-preview" }));
  const published = renderToStaticMarkup(createElement(RichText, { content, className: "test-preview" }));
  assert.equal(preview, published);
  assert.match(renderToStaticMarkup(createElement(MarkdownPreview, { content: "" })), /暂无内容/);
});
