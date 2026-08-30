import { test } from "node:test";
import assert from "node:assert/strict";
import { launchApp, sendAndWait } from "./helpers.js";

test("settings panel opens and base prompt is readonly", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await ctx.page.click("#settings-btn");
    await ctx.page.waitForFunction(
      () => !document.getElementById("settings-pane").hidden,
      { timeout: 10000 }
    );
    const readonly = await ctx.page.$eval("#base-prompt-text", (el) => el.readOnly);
    assert.equal(readonly, true);
  } finally {
    await ctx.close();
  }
});

test("add and delete a custom personality", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await ctx.page.click("#settings-btn");
    await ctx.page.waitForFunction(
      () => !document.getElementById("settings-pane").hidden,
      { timeout: 10000 }
    );

    // new personality
    await ctx.page.click("#new-prompt-btn");
    await ctx.page.waitForFunction(
      () => !document.getElementById("prompt-editor").hidden,
      { timeout: 10000 }
    );
    await ctx.page.$eval("#prompt-name-input", (el) => {
      el.value = "";
    });
    await ctx.page.type("#prompt-name-input", "My Personality");
    await ctx.page.$eval("#prompt-text-input", (el) => {
      el.value = "Be helpful.";
    });
    await ctx.page.click("#save-prompt-btn");
    await ctx.page.waitForFunction(
      () =>
        [...document.querySelectorAll("#prompt-select option")].some(
          (o) => o.textContent === "My Personality"
        ),
      { timeout: 10000 }
    );

    // the custom prompt is active, so delete it
    await ctx.page.click("#delete-prompt-btn");
    await ctx.page.waitForFunction(
      () =>
        ![...document.querySelectorAll("#prompt-select option")].some(
          (o) => o.textContent === "My Personality"
        ),
      { timeout: 10000 }
    );
  } finally {
    await ctx.close();
  }
});

test("per-node model override updates the node", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "model override");

    const llmSelect = await ctx.page.$(".flow-node .model-select");
    assert.ok(llmSelect, "llm node should have a model select");

    const options = await ctx.page.$$eval(".flow-node .model-select option", (els) =>
      els.map((o) => o.value)
    );
    assert.ok(options.length >= 2, `expected >=2 model options, got ${options.length}`);

    // switch to the second model
    await ctx.page.select(".flow-node .model-select", options[1]);
    const g = await ctx.graph();
    const llm = g.nodes.find((n) => n.type === "llm");
    assert.equal(llm.model, options[1]);
  } finally {
    await ctx.close();
  }
});