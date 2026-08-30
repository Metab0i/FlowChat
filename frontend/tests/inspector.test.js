import { test } from "node:test";
import assert from "node:assert/strict";
import { launchApp, sendAndWait } from "./helpers.js";

test("inspector opens from the toolbar and can be closed", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "inspect me");

    await ctx.page.click("#inspector-toggle");
    await ctx.page.waitForFunction(
      () => !document.getElementById("inspector").hidden,
      { timeout: 10000 }
    );
    const title = await ctx.page.$eval("#inspector-title", (el) => el.textContent);
    assert.ok(title.length > 0, "inspector title should be populated");

    await ctx.page.click("#inspector-close");
    await ctx.page.waitForFunction(
      () => document.getElementById("inspector").hidden,
      { timeout: 10000 }
    );
  } finally {
    await ctx.close();
  }
});

test("double-clicking an LLM node opens the inspector", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "dbl click");

    // index 1 is the LLM node (user-input dbl-click edits instead). Dispatch a
    // real dblclick DOM event on the node element; CDP mouse dbl-clicks proved
    // unreliable under this headless build.
    await ctx.page.evaluate(() => {
      document
        .querySelectorAll(".flow-node")[1]
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });

    await ctx.page.waitForFunction(
      () => !document.getElementById("inspector").hidden,
      { timeout: 10000 }
    );
    const badge = await ctx.page.$eval("#inspector-badge", (el) => el.textContent);
    assert.equal(badge, "LLM");
  } finally {
    await ctx.close();
  }
});