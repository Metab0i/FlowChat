export function textNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

export function plainText(root) {
  return textNodes(root).map((n) => n.data).join("");
}

function pointToOffset(root, container, offset) {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

export function rangeToOffsets(root, range) {
  const start = pointToOffset(root, range.startContainer, range.startOffset);
  const end = pointToOffset(root, range.endContainer, range.endOffset);
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return { start: lo, end: hi, text: range.toString() };
}

function offsetToPoint(root, target) {
  let acc = 0;
  for (const n of textNodes(root)) {
    const len = n.data.length;
    if (target <= acc + len) {
      return { container: n, offset: Math.max(0, Math.min(len, target - acc)) };
    }
    acc += len;
  }
  return { container: root, offset: root.childNodes.length };
}

function boxLeft(style) {
  return parseFloat(style.borderLeftWidth) || 0;
}

function boxTop(style) {
  return parseFloat(style.borderTopWidth) || 0;
}

export function clearSelectionOverlays(root) {
  for (const o of root.querySelectorAll(".flow-selection")) o.remove();
}

function overlaps(a, b) {
  return Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
}

function unionRects(rects) {
  let list = Array.from(rects).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom }));
  if (!list.length) return list;

  let changed = true;
  while (changed) {
    changed = false;
    const out = [];
    for (const r of list) {
      const m = out.find((o) => overlaps(o, r));
      if (m) {
        m.l = Math.min(m.l, r.l);
        m.t = Math.min(m.t, r.t);
        m.r = Math.max(m.r, r.r);
        m.b = Math.max(m.b, r.b);
        changed = true;
      } else {
        out.push({ ...r });
      }
    }
    list = out;
  }

  list.sort((a, b) => a.t - b.t || a.l - b.l);
  const bands = [];
  for (const r of list) {
    const band = bands.find((o) => Math.min(o.b, r.b) - Math.max(o.t, r.t) > 0.5);
    if (band) {
      band.l = Math.min(band.l, r.l);
      band.t = Math.min(band.t, r.t);
      band.r = Math.max(band.r, r.r);
      band.b = Math.max(band.b, r.b);
    } else {
      bands.push({ ...r });
    }
  }
  return bands;
}

export function applySelectionOverlays(root, ranges, getZoom) {
  clearSelectionOverlays(root);
  const zoom = getZoom ? getZoom() : 1;
  const rootStyle = getComputedStyle(root);
  const rootRect = root.getBoundingClientRect();
  const borderLeft = boxLeft(rootStyle);
  const borderTop = boxTop(rootStyle);

  for (const r of ranges) {
    const length = plainText(root).length;
    const start = Math.max(0, Math.min(r.start, length));
    const end = Math.max(start, Math.min(r.end, length));
    if (start >= end) continue;

    const range = document.createRange();
    const s = offsetToPoint(root, start);
    const e = offsetToPoint(root, end);
    range.setStart(s.container, s.offset);
    range.setEnd(e.container, e.offset);

    for (const rect of unionRects(range.getClientRects())) {
      const div = document.createElement("div");
      div.className = "flow-selection";
      div.setAttribute("contenteditable", "false");
      if (r.id) div.dataset.selectionId = r.id;
      div.style.left = `${(rect.l - rootRect.left - borderLeft) / zoom + root.scrollLeft}px`;
      div.style.top = `${(rect.t - rootRect.top - borderTop) / zoom + root.scrollTop}px`;
      div.style.width = `${(rect.r - rect.l) / zoom}px`;
      div.style.height = `${(rect.b - rect.t) / zoom}px`;
      root.appendChild(div);
    }
  }
}
