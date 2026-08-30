import { test } from "node:test";
import assert from "node:assert/strict";
import { launchApp, sendAndWait } from "./helpers.js";

test("quote & branch records a selection and spawns a branch", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();

    // create a base user+llm pair
    await sendAndWait(ctx, "base message");

    // select all text in the (last) llm node body
    await ctx.page.evaluate(() => {
      const llm = [...document.querySelectorAll(".flow-node")].at(-1);
      const body = llm.querySelector(".node-body");
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const texts = [];
      let n;
      while ((n = walker.nextNode())) texts.push(n);
      if (!texts.length) return;
      const range = document.createRange();
      range.setStart(texts[0], 0);
      const last = texts[texts.length - 1];
      range.setEnd(last, last.data.length);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });

    // quote chip appears
    await ctx.page.waitForFunction(
      () => !document.getElementById("quote-chip").hidden,
      { timeout: 10000 }
    );

    // send the quoted branch
    await ctx.page.click("#send-btn");
    await ctx.page.waitForFunction(
      () => document.querySelectorAll(".flow-node").length === 4,
      { timeout: 15000 }
    );

    const g = await ctx.graph();
    assert.equal(g.selections.length, 1, "expected exactly one recorded selection");
    const sel = g.selections[0];
    assert.ok(sel.branches.length >= 1, "selection should have a branch");
    // the branch target is a userInput node
    const branchNode = g.nodes.find((n) => n.id === sel.branches[0]);
    assert.ok(branchNode, "branch node should exist");
    assert.equal(branchNode.type, "userInput");
  } finally {
    await ctx.close();
  }
});