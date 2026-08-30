import { test } from "node:test";
import assert from "node:assert/strict";
import {
  launchApp,
  makeDownloadDir,
  readDownloadedJson,
  cleanupDownloadDir,
  writeFixture,
} from "./helpers.js";

test("Export downloads a JSON snapshot equal to the graph", async () => {
  const dl = await makeDownloadDir();
  const ctx = await launchApp({ downloadDir: dl });
  try {
    await ctx.goto();
    await ctx.page.type("#chat-input", "export me");
    await ctx.page.click("#send-btn");
    await ctx.page.waitForFunction(
      () => document.querySelectorAll(".flow-node").length === 2,
      { timeout: 15000 }
    );
    // wait for title to settle so the snapshot is stable
    await ctx.page.waitForFunction(
      () =>
        [...document.querySelectorAll(".flow-node .node-title")].some(
          (t) => t.textContent === "Mock Title"
        ),
      { timeout: 10000 }
    );

    const expected = await ctx.graph();
    await ctx.page.click("#export-btn");
    const exported = await readDownloadedJson(dl, "flowchat.json");
    assert.deepEqual(exported, expected);
  } finally {
    await ctx.close();
    await cleanupDownloadDir(dl);
  }
});

test("Import restores a graph from a JSON file", async () => {
  const ctx = await launchApp();
  const tmp = await makeDownloadDir();
  try {
    await ctx.goto();
    const fixture = {
      version: 3,
      nodes: [
        { id: "i1", type: "userInput", text: "Imported A", title: null, x: 10, y: 10, w: 260, h: null },
        {
          id: "i2",
          type: "llm",
          text: "Imported **bold**",
          title: "Imported",
          model: "opencode-go/deepseek-v4-pro",
          x: 10,
          y: 300,
          w: 260,
          h: null,
        },
      ],
      edges: [{ id: "e1", source: "i1", target: "i2" }],
      selections: [],
      prompts: [],
    };
    const fixturePath = await writeFixture(tmp, "import.json", JSON.stringify(fixture));

    const input = await ctx.page.$("#import-file");
    await input.uploadFile(fixturePath);

    await ctx.page.waitForFunction(
      () => document.querySelectorAll(".flow-node").length === 2,
      { timeout: 10000 }
    );
    const g = await ctx.graph();
    assert.equal(g.nodes.length, 2);
    assert.equal(g.edges.length, 1);
    const texts = g.nodes.map((n) => n.text);
    assert.ok(texts.includes("Imported A"));
    assert.ok(texts.includes("Imported **bold**"));
  } finally {
    await ctx.close();
    await cleanupDownloadDir(tmp);
  }
});

test("malformed JSON import fails gracefully without corrupting state", async () => {
  const ctx = await launchApp();
  const tmp = await makeDownloadDir();
  const errors = [];
  try {
    await ctx.goto();
    ctx.page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    const fixturePath = await writeFixture(tmp, "bad.json", "{ this is not json");
    const input = await ctx.page.$("#import-file");
    await input.uploadFile(fixturePath);

    // allow the (failed) reader to settle; state must remain empty
    await new Promise((r) => setTimeout(r, 300));
    const g = await ctx.graph();
    assert.equal(g.nodes.length, 0);
    assert.ok(
      errors.some((t) => t.includes("Import failed")),
      `expected an import error, got: ${JSON.stringify(errors)}`
    );
  } finally {
    await ctx.close();
    await cleanupDownloadDir(tmp);
  }
});