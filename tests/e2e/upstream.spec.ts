import { test, expect } from "@playwright/test";

test("phone binding preserves encrypted values and requires the current password to change", async ({ page, context }) => {
  await context.addCookies([{ name: "hsfz_session", value: "8".repeat(64), url: "http://127.0.0.1:3211" }]);
  const response = await page.goto("/settings");
  const html = await response!.text();
  expect(html).not.toContain("enc:v1:");
  expect(html).not.toContain("13800000000");
  const phone = page.locator('input[name="phone"]');
  const password = page.locator('input[name="bind_password"]');
  await expect(phone).toHaveAttribute("placeholder", "138****0000");
  await page.locator('input[name="nickname"]').fill("新的昵称");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("资料已更新", { exact: true })).toBeVisible();
  await page.reload();
  await expect(phone).toHaveAttribute("placeholder", "138****0000");
  await phone.fill("13800000000");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("资料已更新", { exact: true })).toBeVisible();
  await phone.fill("13900000000");
  await password.fill("wrong-password");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("绑定或更换手机号需输入正确的当前登录密码")).toBeVisible();
  await page.reload();
  await expect(phone).toHaveAttribute("placeholder", "138****0000");
  await phone.fill("13900000000");
  await password.fill("LocalTestPass-123");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("资料已更新", { exact: true })).toBeVisible();
  await page.reload();
  await expect(phone).toHaveAttribute("placeholder", "139****0000");
});

test("guest login help is rate limited, private and manageable by an admin", async ({ page, context, request }) => {
  await page.goto("/login");
  await page.locator("summary").filter({ hasText: "无法登录" }).click();
  const form = page.getByRole("form", { name: "登录求助" });
  for (let index = 0; index < 4; index++) {
    await form.getByLabel("用户名（选填）").fill(`help_${index}`);
    await form.getByLabel("联系方式", { exact: true }).fill(`PRIVATE_GUEST_CONTACT_${index}`);
    await form.getByLabel("问题描述", { exact: true }).fill(`PRIVATE_GUEST_DETAILS_${index}`);
    await form.getByRole("button", { name: "提交求助" }).click();
    if (index < 3) await expect(form.getByRole("status")).toContainText("已提交");
    else await expect(form.getByRole("alert")).toContainText("提交过于频繁");
  }
  expect(await (await request.get("/")).text()).not.toContain("PRIVATE_GUEST_CONTACT_");
  await context.addCookies([{ name: "hsfz_session", value: "5".repeat(64), url: "http://127.0.0.1:3211" }]);
  const denied = await page.goto("/admin?tab=tickets");
  expect(await denied!.text()).not.toContain("PRIVATE_GUEST_CONTACT_");
  await context.clearCookies();
  await context.addCookies([{ name: "hsfz_session", value: "1".repeat(64), url: "http://127.0.0.1:3211" }]);
  await page.goto("/admin?tab=tickets");
  const inbox = page.getByRole("region", { name: "登录求助" });
  await expect(inbox.getByText("联系方式：PRIVATE_GUEST_CONTACT_0")).toBeVisible();
  await expect(inbox.getByText("PRIVATE_GUEST_DETAILS_3")).toHaveCount(0);
  const item = inbox.locator("li").filter({ hasText: "PRIVATE_GUEST_DETAILS_0" });
  await item.getByRole("button", { name: "处理完成并删除" }).click();
  await expect(item).toContainText("PRIVATE_GUEST_DETAILS_0");
  await item.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(inbox.getByText("PRIVATE_GUEST_DETAILS_0")).toHaveCount(0);
});
