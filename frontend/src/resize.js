const MIN_W = 160;
const MIN_H = 80;

const HANDLES = [
  { dir: "n", edges: { top: true } },
  { dir: "s", edges: { bottom: true } },
  { dir: "e", edges: { right: true } },
  { dir: "w", edges: { left: true } },
  { dir: "ne", edges: { top: true, right: true } },
  { dir: "nw", edges: { top: true, left: true } },
  { dir: "se", edges: { bottom: true, right: true } },
  { dir: "sw", edges: { bottom: true, left: true } },
];

export function makeResizable(node, { getZoom, onResize }) {
  const el = node.el;

  for (const { dir, edges } of HANDLES) {
    const h = document.createElement("div");
    h.className = `resize-handle resize-${dir}`;
    h.setAttribute("data-jtk-not-draggable", "true");
    h.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      startResize(e, edges);
    });
    el.appendChild(h);
  }

  function startResize(e, edges) {
    const zoom = getZoom();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.offsetWidth;
    const startH = el.offsetHeight;
    const startLeft = parseFloat(el.style.left) || 0;
    const startTop = parseFloat(el.style.top) || 0;
    el.classList.add("resizing");

    function onMove(ev) {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;

      let w = startW;
      let h = startH;

      if (edges.right) w = startW + dx;
      else if (edges.left) w = startW - dx;

      if (edges.bottom) h = startH + dy;
      else if (edges.top) h = startH - dy;

      w = Math.max(MIN_W, w);
      h = Math.max(MIN_H, h);

      const left = edges.left ? startLeft + (startW - w) : startLeft;
      const top = edges.top ? startTop + (startH - h) : startTop;

      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      node.w = w;
      node.h = h;

      if (onResize) onResize();
    }

    function onUp() {
      el.classList.remove("resizing");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (onResize) onResize();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
}
