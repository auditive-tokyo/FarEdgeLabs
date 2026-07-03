import { test, expect, type Page } from "@playwright/test";

// click()はdialogがdismissされるまでブロックするため、page.onceでハンドラを先に登録し、
// ハンドラ内で即座にdismissする（CIでのタイムアウト回避）。
async function clickSendAndCaptureDialog(page: Page): Promise<string> {
  let dialogMessage = "";
  page.once("dialog", (dialog) => {
    dialogMessage = dialog.message();
    void dialog.dismiss();
  });
  await page.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => dialogMessage, { timeout: 10_000 }).not.toBe("");
  return dialogMessage;
}

async function fillContactForm(page: Page) {
  // UI言語をenに固定（既定はjaのため、英語ラベル前提のセレクタ/アサーションを安定させる）
  await page.addInitScript(() => {
    localStorage.setItem("lang", "en");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByText("Contact").click();
  await page.getByRole("textbox", { name: "Name:" }).fill("test");
  await page.getByRole("textbox", { name: "Email:" }).fill("test@test.com");
  await page.getByRole("textbox", { name: "Message:" }).fill("test message");
}

test("contact form shows success message on submit", async ({ page }) => {
  await page.route("**/contact", (route) => {
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await fillContactForm(page);
  const message = await clickSendAndCaptureDialog(page);
  expect(message).toContain("successfully");
});

test("contact form shows error message on API failure", async ({ page }) => {
  // ネットワークエラーをシミュレート
  await page.route("**/contact", (route) => {
    void route.abort("connectionrefused");
  });

  await fillContactForm(page);
  const message = await clickSendAndCaptureDialog(page);
  expect(message).toContain("error");
});
