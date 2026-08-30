import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import puppeteer from "puppeteer";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const SERVER_READY_TIMEOUT_MS = 15000;

/** Prefer a repo-local venv python (non-Nix path); fall back to `python3`. */
async function resolvePython() {
  const venvPython = path.join(REPO_ROOT, ".venv", "bin", "python3");
  try {
    await access(venvPython);
    return venvPython;
  } catch {
    return "python3";
  }
}

/** Open a probe listener to obtain an ephemeral free port, then close it. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForReady(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `Server at ${baseUrl} did not become ready within ${timeoutMs}ms (${lastErr})`
  );
}

/** Spawn the real Flask backend on the given port. */
async function spawnServer(port) {
  const python = await resolvePython();
  const server = spawn(
    python,
    ["backend/app.py"],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, PORT: String(port), PYTHONUNBUFFERED: "1" },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let stderr = "";
  server.stderr.on("data", (d) => {
    stderr += d.toString();
  });

  server.once("error", (err) => {
    stderr += `\n[spawn error] ${err.message}`;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForReady(baseUrl, SERVER_READY_TIMEOUT_MS);
  } catch (err) {
    await stopServer(server);
    throw new Error(`${err.message}\nServer stderr:\n${stderr}`);
  }

  return { server, baseUrl };
}

async function stopServer(server) {
  return new Promise((resolve) => {
    if (!server || server.exitCode !== null) return resolve();
    const timer = setTimeout(() => resolve(), 3000);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  });
}

/**
 * Install request interception that mocks /detect, /generate and /title while
 * letting every other request (static files, /defaults/*, CDN) continue.
 */
async function installMockInterception(page, mocks) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    let pathname = "";
    try {
      pathname = new URL(req.url()).pathname;
    } catch {
      req.continue();
      return;
    }

    const handler = mocks[pathname];
    if (handler) {
      req.respond(handler(req));
      return;
    }
    req.continue();
  });
}

function sseBody(chunks) {
  const parts = chunks.map((c) => `data: ${JSON.stringify({ content: c })}\n\n`);
  parts.push(`data: ${JSON.stringify({ content: "[DONE]" })}\n\n`);
  return parts.join("");
}

const DEFAULT_MODELS = ["deepseek-v4-pro", "grok-4.5"];

/** Default set of request mocks used by launchApp. */
export function defaultMocks() {
  return {
    "/detect": () => ({
      contentType: "application/json",
      body: JSON.stringify({ provider: "opencode-go", models: DEFAULT_MODELS, errors: [] }),
    }),
    "/generate": () => ({
      contentType: "text/event-stream",
      body: sseBody(["Hello ", "from ", "the ", "mock"]),
    }),
    "/title": () => ({
      contentType: "application/json",
      body: JSON.stringify({ title: "Mock Title" }),
    }),
  };
}

function makeProvider(label = "agile-fox") {
  return {
    id: `k-${Date.now()}`,
    label,
    provider: "opencode-go",
    apiKey: "test-key-opencode-go",
    models: DEFAULT_MODELS.map((m) => `opencode-go/${m}`),
    valid: true,
    createdAt: Date.now(),
  };
}

/**
 * Launch the app for a test:
 *  - spawns the real Flask backend on a free port
 *  - launches Chromium (honouring PUPPETEER_EXECUTABLE_PATH)
 *  - optionally seeds a provider so the key overlay is dismissed
 *  - installs request mocks for /detect, /generate and /title by default
 *
 * Returns a `ctx` with helpers; call `ctx.close()` in a finally block.
 */
export async function launchApp({
  seedProvider = true,
  mocks = defaultMocks(),
  downloadDir = null,
  viewport = { width: 1280, height: 900 },
} = {}) {
  const port = await getFreePort();
  const { server, baseUrl } = await spawnServer(port);

  const args = ["--disable-dev-shm-usage"];
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  const launchOptions = {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: true,
    args,
    defaultViewport: viewport,
  };
  if (downloadDir) {
    launchOptions.downloadBehavior = { policy: "allow", downloadPath: downloadDir };
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (err) {
    await stopServer(server);
    throw err;
  }

  const page = await browser.newPage();
  await installMockInterception(page, mocks);

  // Define a minimal `bootstrap` before page scripts run so toasts never crash
  // the app even if the Bootstrap CDN script is unavailable/slow.
  await page.evaluateOnNewDocument(() => {
    if (!window.bootstrap) {
      window.bootstrap = {
        Toast: {
          getOrCreateInstance: () => ({ show() {}, hide() {} }),
        },
      };
    }
  });

  if (seedProvider) {
    await page.evaluateOnNewDocument((json) => {
      localStorage.setItem("flowchat.providers", json);
    }, JSON.stringify([makeProvider()]));
  }

  const url = `${baseUrl}/?test=1`;

  const ctx = {
    browser,
    page,
    server,
    baseUrl,
    url,
    port,
    async goto() {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // App is ready once init() has mounted the canvas and installed the hook.
      await page.waitForFunction(
        () => window.__flowchat && document.getElementById("canvas"),
        { timeout: 15000 }
      );
    },
    /** Snapshot of the full graph via the ?test=1 hook. */
    graph() {
      return page.evaluate(() => window.__flowchat.serialize());
    },
    /** Seed a graph fixture directly via the ?test=1 hook. */
    deserialize(fixture) {
      return page.evaluate((f) => window.__flowchat.deserialize(f), fixture);
    },
    async close() {
      if (page && !page.isClosed()) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      await stopServer(server);
    },
  };

  return ctx;
}

/** Convenience for counting DOM nodes. */
export const nodeCount = (page) =>
  page.$$eval(".flow-node", (els) => els.length);

/** Type a message, click Send, and wait for the user+llm node pair. */
export async function sendAndWait(ctx, text, { timeout = 15000 } = {}) {
  await ctx.page.type("#chat-input", text);
  await ctx.page.click("#send-btn");
  await ctx.page.waitForFunction(
    () => document.querySelectorAll(".flow-node").length >= 2,
    { timeout }
  );
}

/** Convenience for reading a node's rendered text by index. */
export const nodeText = (page, index) =>
  page.$$eval(".flow-node .node-body", (els) => els[index]?.textContent || "");

/** Wait until a predicate over the serialized graph holds. */
export async function waitForGraph(page, predicate, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await page.evaluate(() => window.__flowchat.serialize());
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`waitForGraph: predicate not satisfied in ${timeout}ms. Last: ${JSON.stringify(last)}`);
}

/** Create a temporary directory for download tests. */
export async function makeDownloadDir() {
  return mkdtemp(path.join(os.tmpdir(), "flowchat-dl-"));
}

/** Poll a temp download dir until `filename` appears, then read + parse it. */
export async function readDownloadedJson(dir, filename, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const entries = await readdir(dir);
    if (entries.includes(filename)) {
      return JSON.parse(await readFile(path.join(dir, filename), "utf8"));
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Downloaded file ${filename} not found in ${dir}`);
}

export async function cleanupDownloadDir(dir) {
  if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
}

/** Write a temp fixture file (used for Import via uploadFile). */
export async function writeFixture(dir, name, content) {
  const p = path.join(dir, name);
  await writeFile(p, content);
  return p;
}

export { DEFAULT_MODELS };