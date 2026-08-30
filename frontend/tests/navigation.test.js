import { test } from "node:test";
import assert from "node:assert/strict";
import { launchApp, sendAndWait } from "./helpers.js";

test("ctrl+wheel zooms the canvas and the minimap renders", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "navigate");

    // minimap canvas has real dimensions once nodes exist
    await ctx.page.waitForFunction(
      () => {
        const c = document.querySelector("#minimap canvas");
        return c && c.width > 0 && c.height > 0;
      },
      { timeout: 10000 }
    );

    const before = await ctx.page.$eval("#canvas", (el) => el.style.transform);

    // dispatch a ctrl+wheel zoom at the viewport centre
    await ctx.page.evaluate(() => {
      const viewport = document.getElementById("viewport");
      const rect = viewport.getBoundingClientRect();
      viewport.dispatchEvent(
        new WheelEvent("wheel", {
          ctrlKey: true,
          deltaY: -120,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await ctx.page.waitForFunction(
      (prev) => document.getElementById("canvas").style.transform !== prev,
      { timeout: 10000 },
      before
    );
    const after = await ctx.page.$eval("#canvas", (el) => el.style.transform);
    assert.notEqual(after, before);
  } finally {
    await ctx.close();
  }
});