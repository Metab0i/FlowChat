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

    for (const rect of range.getClientRects()) {
      const div = document.createElement("div");
      div.className = "flow-selection" + (r.pending ? " flow-selection-pending" : "");
      if (!r.pending && r.id) div.dataset.selectionId = r.id;
      div.style.left = `${(rect.left - rootRect.left - borderLeft) / zoom + root.scrollLeft}px`;
      div.style.top = `${(rect.top - rootRect.top - borderTop) / zoom + root.scrollTop}px`;
      div.style.width = `${rect.width / zoom}px`;
      div.style.height = `${rect.height / zoom}px`;
      root.appendChild(div);
    }
  }
}
