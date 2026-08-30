import { test } from "node:test";
import assert from "node:assert/strict";
import { launchApp, nodeCount, sendAndWait, waitForGraph } from "./helpers.js";

test("deleting a node removes it and its edges", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "node to delete");
    assert.equal(await nodeCount(ctx.page), 2);

    // select the first (userInput) node via its (non-editable) title so the
    // Delete key isn't swallowed by the contenteditable typing guard
    await ctx.page.click(".flow-node .node-title");
    await ctx.page.keyboard.press("Delete");

    await ctx.page.waitForFunction(
      () => document.querySelectorAll(".flow-node").length === 1,
      { timeout: 10000 }
    );
    const g = await ctx.graph();
    assert.equal(g.nodes.length, 1);
    assert.equal(g.edges.length, 0);
  } finally {
    await ctx.close();
  }
});

test("replicate duplicates a node via the context menu", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "replicate me");
    assert.equal((await ctx.graph()).nodes.length, 2);

    await ctx.page.click(".flow-node", { button: "right" });
    await ctx.page.waitForSelector("#context-menu:not([hidden])");
    await ctx.page.click('[data-action="replicate"]');

    await ctx.page.waitForFunction(
      () => document.querySelectorAll(".flow-node").length === 3,
      { timeout: 10000 }
    );
    const g = await ctx.graph();
    assert.equal(g.nodes.length, 3);
    // the copy keeps the source text
    assert.equal(g.nodes.filter((n) => n.text === "replicate me").length, 2);
  } finally {
    await ctx.close();
  }
});

test("create connected node adds a linked node", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "connect me");

    await ctx.page.click(".flow-node", { button: "right" });
    await ctx.page.waitForSelector("#context-menu:not([hidden])");
    await ctx.page.click('[data-action="connect"]');

    await ctx.page.waitForFunction(
      () => document.querySelectorAll(".flow-node").length === 3,
      { timeout: 10000 }
    );
    const g = await ctx.graph();
    assert.equal(g.nodes.length, 3);
    const first = g.nodes[0];
    assert.ok(
      g.edges.some((e) => e.source === first.id),
      "expected a new edge originating from the first node"
    );
  } finally {
    await ctx.close();
  }
});

test("dragging a bottom port onto a top port creates an edge", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    const fixture = {
      version: 3,
      nodes: [
        { id: "u1", type: "userInput", text: "A", title: null, x: 80, y: 80, w: 260, h: null },
        { id: "u2", type: "userInput", text: "B", title: null, x: 480, y: 80, w: 260, h: null },
      ],
      edges: [],
      selections: [],
      prompts: [],
    };
    await ctx.deserialize(fixture);
    await ctx.page.waitForFunction(
      () => document.querySelectorAll(".flow-node").length === 2,
      { timeout: 10000 }
    );

    const ports = await ctx.page.$$(".flow-node .port");
    // per node: [0]=top, [1]=right, [2]=bottom, [3]=left
    const sb = await ports[2].boundingBox(); // u1 bottom port
    const db = await ports[4].boundingBox(); // u2 top port

    await ctx.page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await ctx.page.mouse.down();
    await ctx.page.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 25 });
    await ctx.page.mouse.up();

    await waitForGraph(ctx.page, (g) => g.edges.length === 1, { timeout: 10000 });
    const g = await ctx.graph();
    assert.equal(g.edges[0].source, g.nodes.find((n) => n.text === "A").id);
    assert.equal(g.edges[0].target, g.nodes.find((n) => n.text === "B").id);
  } finally {
    await ctx.close();
  }
});

test("fold / expand toggles a node", async () => {
  const ctx = await launchApp();
  try {
    await ctx.goto();
    await sendAndWait(ctx, "fold me");

    await ctx.page.click(".flow-node .fold");
    await ctx.page.waitForFunction(() => {
      const body = [...document.querySelectorAll(".flow-node")][0].querySelector(".node-body");
      return body.classList.contains("folded");
    }, { timeout: 10000 });

    await ctx.page.click(".flow-node .fold");
    await ctx.page.waitForFunction(() => {
      const body = [...document.querySelectorAll(".flow-node")][0].querySelector(".node-body");
      return !body.classList.contains("folded");
    }, { timeout: 10000 });
  } finally {
    await ctx.close();
  }
});