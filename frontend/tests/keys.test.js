import { test } from "node:test";
import assert from "node:assert/strict";
import { launchApp } from "./helpers.js";

test("adding an API key detects provider, dismisses overlay, populates models", async () => {
  const ctx = await launchApp({ seedProvider: false });
  try {
    await ctx.goto();

    // overlay visible
    await ctx.page.waitForFunction(
      () => !document.getElementById("key-overlay").hidden,
      { timeout: 10000 }
    );

    await ctx.page.type("#overlay-key-input", "test-key-opencode-go");
    await ctx.page.click("#overlay-key-form button[type=submit]");

    // overlay dismissed after detection
    await ctx.page.waitForFunction(
      () => document.getElementById("key-overlay").hidden,
      { timeout: 15000 }
    );

    // default model select populated
    const modelCount = await ctx.page.$$eval(
      "#default-model-select option",
      (els) => els.length
    );
    assert.ok(modelCount >= 2, `expected >=2 model options, got ${modelCount}`);

    // settings shows the provider row and a masked key
    await ctx.page.click("#settings-btn");
    const badge = await ctx.page.$eval(".provider-badge", (el) => el.textContent);
    assert.equal(badge, "OpenCode Go");
    const masked = await ctx.page.$eval(".provider-key", (el) => el.textContent);
    assert.ok(masked.startsWith("••••••••"), `expected a masked key, got "${masked}"`);
    assert.ok(!masked.includes("test-key-opencode-go"), "full key must not be shown");
  } finally {
    await ctx.close();
  }
});

test("blank key shows a status message and keeps the overlay up", async () => {
  const ctx = await launchApp({ seedProvider: false });
  try {
    await ctx.goto();
    await ctx.page.type("#overlay-key-input", "   ");
    await ctx.page.click("#overlay-key-form button[type=submit]");

    await ctx.page.waitForFunction(
      () =>
        document.getElementById("overlay-status").textContent.includes(
          "Enter a key"
        ),
      { timeout: 10000 }
    );
    const stillVisible = await ctx.page.$eval("#key-overlay", (el) => el.hidden);
    assert.equal(stillVisible, false);
  } finally {
    await ctx.close();
  }
});