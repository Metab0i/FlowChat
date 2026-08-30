import { test } from "node:test";
import assert from "node:assert/strict";
import { launchApp } from "./helpers.js";

test("app loads: key overlay visible, chrome mounts, defaults load", async () => {
  const ctx = await launchApp({ seedProvider: false });
  try {
    await ctx.goto();

    const overlayHidden = await ctx.page.$eval("#key-overlay", (el) => el.hidden);
    assert.equal(overlayHidden, false, "key overlay should be visible when no provider");

    for (const id of ["#canvas", "#chat-bar", "#toolbar", "#minimap"]) {
      assert.ok(await ctx.page.$(id), `${id} should exist`);
    }

    const basePrompt = await ctx.page.$eval("#base-prompt-text", (el) => el.value);
    assert.ok(basePrompt.length > 0, "base prompt should be populated from the backend");
  } finally {
    await ctx.close();
  }
});

test("?test=1 installs the serialize/deserialize test hook", async () => {
  const ctx = await launchApp({ seedProvider: false });
  try {
    await ctx.goto();
    const hook = await ctx.page.evaluate(() => ({
      present: !!window.__flowchat,
      serializeType: typeof (window.__flowchat && window.__flowchat.serialize),
      deserializeType: typeof (window.__flowchat && window.__flowchat.deserialize),
    }));
    assert.equal(hook.present, true);
    assert.equal(hook.serializeType, "function");
    assert.equal(hook.deserializeType, "function");
  } finally {
    await ctx.close();
  }
});

test("production URL (no ?test=1) does NOT expose the test hook", async () => {
  const ctx = await launchApp({ seedProvider: false });
  try {
    await ctx.page.goto(ctx.baseUrl + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await ctx.page.waitForSelector("#canvas");
    const present = await ctx.page.evaluate(() => !!window.__flowchat);
    assert.equal(present, false);
  } finally {
    await ctx.close();
  }
});