import { newInstance } from "@jsplumb/browser-ui";
import { fetchModels, streamGenerate } from "./api.js";
import { getOutgoers, findAllDescendants, getConversationHistory } from "./history.js";
import { renderMarkdownInto } from "./markdown.js";
import { createPanZoom } from "./panzoom.js";

const canvas = document.getElementById("canvas");
const viewport = document.getElementById("viewport");
const minimapEl = document.getElementById("minimap");

const state = {
  nodes: new Map(), // id -> { id, type, text, model, el, folded }
  edges: new Map(), // id -> { id, source, target, conn }
  models: [],
  defaultModel: "",
  selectedIds: new Set(),
  contextNodeId: null,
};

let seq = 0;
function uid(type) {
  return `${type}-${Date.now()}-${seq++}`;
}

const instance = newInstance({
  container: canvas,
  elementsDraggable: true,
  connectionsDetachable: false,
  scope: "flowchat",
  connector: "Bezier",
  paintStyle: { stroke: "#6c757d", strokeWidth: 3 },
  hoverPaintStyle: { stroke: "#495057", strokeWidth: 3 },
});

const panzoom = createPanZoom({
  canvas,
  viewport,
  instance,
  onTransform: () => drawMinimap(),
});

/* ---------- jsPlumb source/target selectors ---------- */

instance.addSourceSelector(".flow-node .source", {
  scope: "flowchat",
  anchor: "Center",
  maxConnections: -1,
  allowLoopback: false,
  endpoint: "Blank",
});

instance.addTargetSelector(".flow-node .target", {
  scope: "flowchat",
  anchor: "Center",
  maxConnections: -1,
  allowLoopback: false,
  endpoint: "Blank",
});

instance.bind("connection", (info) => {
  const conn = info.connection;
  const sourceId = (conn.source && conn.source.closest(".flow-node"))?.dataset.id;
  const targetId = (conn.target && conn.target.closest(".flow-node"))?.dataset.id;

  if (!sourceId || !targetId || sourceId === targetId) {
    instance.deleteConnection(conn);
    return;
  }

  for (const e of state.edges.values()) {
    if (e.source === sourceId && e.target === targetId) {
      instance.deleteConnection(conn);
      return;
    }
  }

  const edgeId = uid("e");
  state.edges.set(edgeId, { id: edgeId, source: sourceId, target: targetId, conn });
  drawMinimap();
});

instance.bind("connection:detach", (info) => {
  const conn = info.connection;
  for (const [id, e] of state.edges.entries()) {
    if (e.conn === conn) {
      state.edges.delete(id);
      break;
    }
  }
  drawMinimap();
});

instance.bind("connection:click", (conn) => {
  instance.deleteConnection(conn);
});

/* ---------- node rendering ---------- */

function getNodePosition(node) {
  return {
    x: parseFloat(node.el.style.left) || 0,
    y: parseFloat(node.el.style.top) || 0,
  };
}

function renderNodeBody(node) {
  const body = node.el.querySelector(".node-body");
  if (!body) return;
  if (node.type === "llm") {
    renderMarkdownInto(body, node.text || "");
  } else {
    body.textContent = node.text || "";
  }
  body.classList.toggle("folded", !!node.folded);
}

function createNodeElement(node) {
  const el = document.createElement("div");
  node.el = el;
  el.className = `flow-node card ${node.type === "userInput" ? "border-success bg-success-subtle" : "border-primary bg-primary-subtle"}`;
  el.dataset.id = node.id;

  const title = node.type === "userInput" ? "User Input" : "LLM Response";
  const regen = node.type === "userInput"
    ? '<button class="btn btn-sm btn-outline-secondary regenerate" title="Regenerate">🗘</button>'
    : "";
  const modelSelect = node.type === "llm"
    ? '<div class="px-2 pt-2"><select class="model-select form-select form-select-sm" data-jtk-not-draggable></select></div>'
    : "";

  el.innerHTML = `
    <div class="card-header node-header py-1 px-2">
      <span class="node-title"></span>
      <span class="node-actions">
        ${regen}
        <button class="btn btn-sm btn-outline-secondary fold" title="Fold">▾</button>
        <button class="btn btn-sm btn-outline-secondary delete" title="Delete">✕</button>
      </span>
    </div>
    ${modelSelect}
    <div class="card-body node-body p-2"></div>
    <div class="handle target" data-node-id="${node.id}"></div>
    <div class="handle source" data-node-id="${node.id}"></div>
  `;

  el.querySelector(".node-title").textContent = title;

  if (node.type === "llm") {
    populateModelSelect(el.querySelector(".model-select"), node.model);
    el.querySelector(".model-select").addEventListener("change", (e) => {
      node.model = e.target.value;
    });
  }

  el.querySelector(".delete").addEventListener("click", (e) => {
    e.stopPropagation();
    deleteNode(node.id);
  });

  el.querySelector(".fold").addEventListener("click", (e) => {
    e.stopPropagation();
    node.folded = !node.folded;
    renderNodeBody(node);
  });

  if (node.type === "userInput") {
    el.querySelector(".regenerate").addEventListener("click", (e) => {
      e.stopPropagation();
      regenerateFrom(node.id);
    });
  }

  el.addEventListener("click", (e) => {
    if (e.shiftKey) toggleSelectNode(node.id);
    else selectNode(node.id);
  });
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(node.id, e.clientX, e.clientY);
  });

  const body = el.querySelector(".node-body");
  body.addEventListener("dblclick", () => beginEdit(node));

  renderNodeBody(node);
  return el;
}

function populateModelSelect(select, value) {
  select.innerHTML = "";
  if (state.models.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Loading models...";
    select.appendChild(opt);
    return;
  }
  const hasValue = value && state.models.some((m) => m.id === value);
  if (value && !hasValue) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  for (const m of state.models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    select.appendChild(opt);
  }
  if (hasValue) select.value = value;
}

function beginEdit(node) {
  const body = node.el.querySelector(".node-body");
  if (!body) return;
  const ta = document.createElement("textarea");
  ta.className = "node-editor";
  ta.value = node.text || "";
  ta.setAttribute("data-jtk-not-draggable", "true");
  body.replaceWith(ta);
  node._editor = ta;
  ta.focus();
  ta.addEventListener("blur", () => finishEdit(node));
}

function finishEdit(node) {
  const ta = node._editor;
  if (!ta) return;
  node.text = ta.value;

  const body = document.createElement("div");
  body.className = "node-body";
  body.addEventListener("dblclick", () => beginEdit(node));
  ta.replaceWith(body);
  node._editor = null;

  renderNodeBody(node);
}

/* ---------- node / edge management ---------- */

function addNode(type, opts = {}) {
  const node = {
    id: uid(type),
    type,
    text: opts.text ?? (type === "userInput" ? "New user input" : ""),
    model: opts.model ?? (type === "llm" ? state.defaultModel : undefined),
    folded: type === "llm" ? true : false,
  };

  node.el = createNodeElement(node);
  canvas.appendChild(node.el);

  let pos = opts.position;
  if (!pos) {
    const c = panzoom.viewportCenter();
    const offset = (state.nodes.size % 6) * 16;
    pos = { x: c.x + offset - 130, y: c.y + offset - 40 };
  }
  node.el.style.left = `${pos.x}px`;
  node.el.style.top = `${pos.y}px`;

  instance.manage(node.el);
  state.nodes.set(node.id, node);
  drawMinimap();
  return node;
}

function connectNodes(sourceId, targetId) {
  const source = state.nodes.get(sourceId);
  const target = state.nodes.get(targetId);
  if (!source || !target) return null;

  for (const e of state.edges.values()) {
    if (e.source === sourceId && e.target === targetId) return e.conn;
  }

  const conn = instance.connect({
    source: source.el,
    target: target.el,
    anchors: ["Bottom", "Top"],
    scope: "flowchat",
  });
  const edgeId = uid("e");
  state.edges.set(edgeId, { id: edgeId, source: sourceId, target: targetId, conn });
  drawMinimap();
  return conn;
}

function deleteEdge(conn) {
  instance.deleteConnection(conn);
}

function deleteNode(id) {
  const node = state.nodes.get(id);
  if (!node) return;

  for (const [edgeId, e] of [...state.edges.entries()]) {
    if (e.source === id || e.target === id) {
      state.edges.delete(edgeId);
    }
  }

  instance.unmanage(node.el, true);
  state.nodes.delete(id);
  state.selectedIds.delete(id);
  if (state.contextNodeId === id) state.contextNodeId = null;
  drawMinimap();
}

function refreshSelection() {
  for (const n of state.nodes.values()) {
    n.el.classList.toggle("selected", state.selectedIds.has(n.id));
  }
}

function selectNode(id) {
  state.selectedIds = new Set([id]);
  refreshSelection();
}

function toggleSelectNode(id) {
  if (state.selectedIds.has(id)) state.selectedIds.delete(id);
  else state.selectedIds.add(id);
  refreshSelection();
}

function setSelection(ids) {
  state.selectedIds = new Set(ids);
  refreshSelection();
}

function addToSelection(ids) {
  for (const id of ids) state.selectedIds.add(id);
  refreshSelection();
}

function deselectAll() {
  state.selectedIds = new Set();
  refreshSelection();
}

/* ---------- rubber-band selection ---------- */

const selectionRect = document.getElementById("selection-rect");

function rectsIntersect(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

let selectDrag = null;

viewport.addEventListener("mousedown", (e) => {
  if (e.ctrlKey || e.metaKey) return;
  if (e.button !== 0) return;
  if (e.target !== canvas && e.target !== viewport) return;

  selectDrag = {
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
  };
  if (!e.shiftKey) deselectAll();

  const vr = viewport.getBoundingClientRect();
  selectionRect.style.display = "block";
  selectionRect.style.left = `${e.clientX - vr.left}px`;
  selectionRect.style.top = `${e.clientY - vr.top}px`;
  selectionRect.style.width = "0px";
  selectionRect.style.height = "0px";
});

window.addEventListener("mousemove", (e) => {
  if (!selectDrag) return;
  const dx = e.clientX - selectDrag.startX;
  const dy = e.clientY - selectDrag.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) selectDrag.moved = true;

  const vr = viewport.getBoundingClientRect();
  const left = Math.min(e.clientX, selectDrag.startX) - vr.left;
  const top = Math.min(e.clientY, selectDrag.startY) - vr.top;
  selectionRect.style.left = `${left}px`;
  selectionRect.style.top = `${top}px`;
  selectionRect.style.width = `${Math.abs(dx)}px`;
  selectionRect.style.height = `${Math.abs(dy)}px`;
});

window.addEventListener("mouseup", (e) => {
  if (!selectDrag) return;
  const wasDrag = selectDrag.moved;
  const rect = {
    left: Math.min(selectDrag.startX, e.clientX),
    top: Math.min(selectDrag.startY, e.clientY),
    right: Math.max(selectDrag.startX, e.clientX),
    bottom: Math.max(selectDrag.startY, e.clientY),
  };
  selectDrag = null;
  selectionRect.style.display = "none";
  if (!wasDrag) return;

  const ids = [];
  for (const n of state.nodes.values()) {
    if (rectsIntersect(rect, n.el.getBoundingClientRect())) ids.push(n.id);
  }
  if (e.shiftKey) addToSelection(ids);
  else setSelection(ids);
});

function replicateNode(id) {
  const node = state.nodes.get(id);
  if (!node) return;

  const pos = getNodePosition(node);
  const copy = addNode(node.type, {
    text: node.text,
    model: node.model,
    position: { x: pos.x + 220, y: pos.y + 20 },
  });

  // rewire upstream connections
  for (const e of state.edges.values()) {
    if (e.target === id) {
      connectNodes(e.source, copy.id);
    }
  }
}

function createConnectedNode(id) {
  const node = state.nodes.get(id);
  if (!node) return;

  const newType = node.type === "userInput" ? "llm" : "userInput";
  const pos = getNodePosition(node);
  const height = node.el.offsetHeight || 100;
  const newNode = addNode(newType, {
    position: { x: pos.x + 20, y: pos.y + height + 60 },
  });
  connectNodes(node.id, newNode.id);
}

async function regenerateFrom(userNodeId) {
  const userNode = state.nodes.get(userNodeId);
  if (!userNode) return;

  const outgoers = getOutgoers(userNodeId, state.nodes, state.edges);

  if (outgoers.length === 0) {
    const pos = getNodePosition(userNode);
    const height = userNode.el.offsetHeight || 100;
    const llmNode = addNode("llm", {
      position: { x: pos.x, y: pos.y + height + 60 },
    });
    connectNodes(userNodeId, llmNode.id);
    await generateResponse(llmNode.id);
    return;
  }

  const descendants = findAllDescendants(userNodeId, state.nodes, state.edges);
  for (const id of descendants) {
    const n = state.nodes.get(id);
    if (n && n.type === "llm") {
      await generateResponse(id);
    }
  }
}

async function generateResponse(llmNodeId) {
  const llmNode = state.nodes.get(llmNodeId);
  if (!llmNode) return;

  llmNode.text = "";
  renderNodeBody(llmNode);

  const history = getConversationHistory(llmNode, state.nodes, state.edges);
  try {
    await streamGenerate(llmNode.model, history, (chunk) => {
      llmNode.text += chunk;
      const now = performance.now();
      if (!llmNode._lastRender || now - llmNode._lastRender > 120) {
        renderNodeBody(llmNode);
        llmNode._lastRender = now;
      }
    });
  } catch (err) {
    llmNode.text += `\n\n[error] ${err.message}`;
  } finally {
    renderNodeBody(llmNode);
  }
}

async function sendMessage(text) {
  if (!text.trim()) return;

  const selected = [...state.selectedIds]
    .map((id) => state.nodes.get(id))
    .filter(Boolean);

  if (selected.length === 0) {
    const userNode = addNode("userInput", { text });
    const userPos = getNodePosition(userNode);
    const llmNode = addNode("llm", {
      position: { x: userPos.x, y: userPos.y + (userNode.el.offsetHeight || 100) + 60 },
    });
    connectNodes(userNode.id, llmNode.id);
    selectNode(llmNode.id);
    await generateResponse(llmNode.id);
    return;
  }

  const first = selected[0];
  const pos = getNodePosition(first);
  const userNode = addNode("userInput", {
    text,
    position: { x: pos.x, y: pos.y + (first.el.offsetHeight || 100) + 60 },
  });

  for (const src of selected) {
    connectNodes(src.id, userNode.id);
  }

  const userPos = getNodePosition(userNode);
  const llmNode = addNode("llm", {
    position: { x: userPos.x, y: userPos.y + (userNode.el.offsetHeight || 100) + 60 },
  });
  connectNodes(userNode.id, llmNode.id);

  selectNode(llmNode.id);
  await generateResponse(llmNode.id);
}

/* ---------- context menu ---------- */

const contextMenu = document.getElementById("context-menu");

function showContextMenu(nodeId, x, y) {
  state.contextNodeId = nodeId;
  contextMenu.hidden = false;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
}

function hideContextMenu() {
  contextMenu.hidden = true;
  state.contextNodeId = null;
}

contextMenu.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const nodeId = state.contextNodeId;
  hideContextMenu();
  if (!nodeId) return;

  if (action === "replicate") replicateNode(nodeId);
  else if (action === "connect") createConnectedNode(nodeId);
  else if (action === "delete") deleteNode(nodeId);
});

window.addEventListener("mousedown", (e) => {
  if (!contextMenu.hidden && !contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

/* ---------- keyboard ---------- */

window.addEventListener("keydown", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  if (typing) return;

  if ((e.key === "Delete" || e.key === "Backspace") && state.selectedIds.size) {
    e.preventDefault();
    for (const id of [...state.selectedIds]) deleteNode(id);
  }
});

/* ---------- export / import ---------- */

function serialize() {
  const nodes = [...state.nodes.values()].map((n) => {
    const pos = getNodePosition(n);
    return {
      id: n.id,
      type: n.type,
      text: n.text,
      model: n.model,
      folded: !!n.folded,
      x: pos.x,
      y: pos.y,
    };
  });
  const edges = [...state.edges.values()].map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }));
  return { version: 1, nodes, edges };
}

function clearAll() {
  for (const n of [...state.nodes.values()]) {
    instance.unmanage(n.el, true);
  }
  state.nodes.clear();
  state.edges.clear();
  state.selectedIds = new Set();
}

function deserialize(data) {
  clearAll();

  const idMap = {};
  for (const raw of data.nodes || []) {
    const node = addNode(raw.type, {
      text: raw.text,
      model: raw.model,
      position: { x: raw.x || 0, y: raw.y || 0 },
    });
    node.folded = !!raw.folded;
    renderNodeBody(node);
    idMap[raw.id] = node.id;
  }

  for (const e of data.edges || []) {
    const s = idMap[e.source];
    const t = idMap[e.target];
    if (s && t) connectNodes(s, t);
  }

  drawMinimap();
}

/* ---------- toolbar / chat wiring ---------- */

const defaultModelSelect = document.getElementById("default-model-select");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

function refreshDefaultModelSelect() {
  populateModelSelect(defaultModelSelect, state.defaultModel);
}

defaultModelSelect.addEventListener("change", (e) => {
  state.defaultModel = e.target.value;
  localStorage.setItem("flowchat.defaultModel", state.defaultModel);
});

sendBtn.addEventListener("click", () => {
  const text = chatInput.value;
  chatInput.value = "";
  sendMessage(text);
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const text = chatInput.value;
    chatInput.value = "";
    sendMessage(text);
  }
});

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "flowchat.json";
  a.click();
  URL.revokeObjectURL(url);
});

const importFile = document.getElementById("import-file");
document.getElementById("import-btn").addEventListener("click", () => {
  importFile.click();
});
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      deserialize(JSON.parse(reader.result));
    } catch (err) {
      console.error("Import failed:", err);
    }
  };
  reader.readAsText(file);
  importFile.value = "";
});

/* ---------- minimap ---------- */

function drawMinimap() {
  const mm = minimapEl;
  if (!mm._canvas) {
    mm._canvas = document.createElement("canvas");
    mm.appendChild(mm._canvas);
  }
  const c = mm._canvas;
  const w = mm.clientWidth;
  const h = mm.clientHeight;
  if (!w || !h) return;
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const nodesArr = [...state.nodes.values()];
  if (nodesArr.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodesArr) {
    const pos = getNodePosition(n);
    const bw = n.el.offsetWidth || 260;
    const bh = n.el.offsetHeight || 100;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + bw);
    maxY = Math.max(maxY, pos.y + bh);
  }

  const pad = 12;
  const scale = Math.min(
    (w - 2 * pad) / Math.max(1, maxX - minX),
    (h - 2 * pad) / Math.max(1, maxY - minY)
  );
  const ox = (w - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (h - (maxY - minY) * scale) / 2 - minY * scale;

  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1;
  for (const e of state.edges.values()) {
    const s = state.nodes.get(e.source);
    const t = state.nodes.get(e.target);
    if (!s || !t) continue;
    const sp = getNodePosition(s);
    const tp = getNodePosition(t);
    ctx.beginPath();
    ctx.moveTo((sp.x + (s.el.offsetWidth || 260) / 2) * scale + ox, (sp.y + (s.el.offsetHeight || 100)) * scale + oy);
    ctx.lineTo((tp.x + (t.el.offsetWidth || 260) / 2) * scale + ox, tp.y * scale + oy);
    ctx.stroke();
  }

  for (const n of nodesArr) {
    const pos = getNodePosition(n);
    const bw = n.el.offsetWidth || 260;
    const bh = n.el.offsetHeight || 100;
    ctx.fillStyle = n.type === "userInput" ? "#d1e7dd" : "#cfe2ff";
    ctx.fillRect(pos.x * scale + ox, pos.y * scale + oy, bw * scale, bh * scale);
    ctx.strokeStyle = "#6c757d";
    ctx.strokeRect(pos.x * scale + ox, pos.y * scale + oy, bw * scale, bh * scale);
  }
}

let lastMinimapDraw = 0;
function minimapLoop(ts) {
  if (ts - lastMinimapDraw > 100) {
    drawMinimap();
    lastMinimapDraw = ts;
  }
  requestAnimationFrame(minimapLoop);
}
requestAnimationFrame(minimapLoop);

/* ---------- init ---------- */

export async function init() {
  try {
    state.models = await fetchModels();
  } catch (err) {
    console.error("Failed to fetch models:", err);
  }

  const saved = localStorage.getItem("flowchat.defaultModel");
  if (saved && state.models.some((m) => m.id === saved)) {
    state.defaultModel = saved;
  } else if (state.models.length > 0) {
    state.defaultModel = state.models[0].id;
  }

  refreshDefaultModelSelect();
}
