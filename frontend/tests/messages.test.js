import { test } from "node:test";
import assert from "node:assert/strict";
import { launchApp, nodeCount, sendAndWait } from "./helpers.js";

const MOCK_TEXT = "Hello from the mock";

test("sending a message creates user+llm nodes and streams the response", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "Hello world");

    assert.equal(await nodeCount(ctx.page), 2);

    // streamed body appears
    await ctx.page.waitForFunction(
      (text) =>
        [...document.querySelectorAll(".flow-node .node-body")].some((b) =>
          b.textContent.includes(text)
        ),
      { timeout: 15000 },
      MOCK_TEXT
    );
    const bodies = await ctx.page.$$eval(".flow-node .node-body", (els) =>
      els.map((e) => e.textContent)
    );
    assert.ok(bodies.at(-1).includes(MOCK_TEXT));

    // title updated via /title mock
    await ctx.page.waitForFunction(
      () =>
        [...document.querySelectorAll(".flow-node .node-title")].some(
          (t) => t.textContent === "Mock Title"
        ),
      { timeout: 10000 }
    );
  } finally {
    await ctx.close();
  }
});

test("regenerate (refresh) re-runs generation without losing the node", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "regenerate me");
    await ctx.page.waitForFunction(
      (text) =>
        [...document.querySelectorAll(".flow-node .node-body")].some((b) =>
          b.textContent.includes(text)
        ),
      { timeout: 15000 },
      MOCK_TEXT
    );

    await ctx.page.click(".flow-node .regenerate");
    await ctx.page.waitForFunction(
      () => document.querySelectorAll(".flow-node").length === 2,
      { timeout: 15000 }
    );
    // after regeneration the streamed text returns
    await ctx.page.waitForFunction(
      (text) =>
        [...document.querySelectorAll(".flow-node .node-body")].some((b) =>
          b.textContent.includes(text)
        ),
      { timeout: 15000 },
      MOCK_TEXT
    );
    assert.equal(await nodeCount(ctx.page), 2);
  } finally {
    await ctx.close();
  }
});

test("SSE error frame renders an [error] message", async () => {
  const mocks = {
    "/detect": () => ({
      contentType: "application/json",
      body: JSON.stringify({ provider: "opencode-go", models: ["deepseek-v4-pro"], errors: [] }),
    }),
    "/generate": () => ({
      contentType: "text/event-stream",
      body: `data: {"error":"boom"}\n\n`,
    }),
    "/title": () => ({
      contentType: "application/json",
      body: JSON.stringify({ title: "Mock Title" }),
    }),
  };
  const ctx = await launchApp({ mocks });
  try {
    await ctx.goto();
    await sendAndWait(ctx, "trigger error");

    await ctx.page.waitForFunction(
      () =>
        [...document.querySelectorAll(".flow-node .node-body")].some((b) =>
          b.textContent.includes("[error] boom")
        ),
      { timeout: 15000 }
    );
  } finally {
    await ctx.close();
  }
});