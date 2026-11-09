import { expect, test } from "@playwright/test";

for (const target of ["không", "html", "body", "cả hai", "nội dung"] as const) {
  test(`kiểm tra hydration trên trang đăng nhập: ${target}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
    });
    page.on("pageerror", (error) => {
      if (/hydrat/i.test(error.message)) errors.push(error.message);
    });

    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
      return route.continue();
    });
    await page.addInitScript((target) => {
      if (target === "không") return;
      const inject = () => {
        if (!document.documentElement || !document.body) return;
        if (target === "nội dung") {
          const input = document.getElementById("login-email");
          if (!input) return;
          input.setAttribute("data-hydration-probe", "modified");
        } else {
          if (target !== "body") {
            document.documentElement.setAttribute("data-lt-installed", "true");
            document.documentElement.setAttribute("suppresshydrationwarning", "true");
            document.documentElement.classList.add("vsc-initialized");
          }
          if (target !== "html") document.body.classList.add("vsc-initialized");
        }
        observer.disconnect();
      };
      const observer = new MutationObserver(inject);
      observer.observe(document, { childList: true, subtree: true });
      inject();
    }, target);

    await page.goto("/dang-nhap");
    await expect(page.getByLabel("Địa chỉ email")).toBeVisible();
    await page.waitForFunction(() => {
      const input = document.querySelector('input[type="email"]');
      return input && Object.keys(input).some((key) => key.startsWith("__reactProps"));
    });
    await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();

    if (target === "nội dung") {
      await expect.poll(() => errors.join("\n")).toContain("data-hydration-probe");
    } else {
      if (target === "html" || target === "cả hai") {
        await expect(page.locator("html")).toHaveAttribute("data-lt-installed", "true");
      }
      if (target === "body" || target === "cả hai") {
        await expect(page.locator("body")).toHaveClass(/vsc-initialized/);
      }
      expect(errors).toEqual([]);
    }
  });
}
