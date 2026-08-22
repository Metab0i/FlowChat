export function createPanZoom({ canvas, viewport, instance, onTransform }) {
  const GRID = 24;
  let zoom = 1;
  let panX = 0;
  let panY = 0;

  function apply() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    canvas.style.transformOrigin = "0 0";
    viewport.style.backgroundSize = `${GRID}px ${GRID}px`;
    viewport.style.backgroundPosition = `${panX}px ${panY}px`;
    instance.setZoom(zoom);
    instance.repaintEverything();
    if (onTransform) onTransform({ zoom, panX, panY });
  }

  function isPanModifier(e) {
    return e.ctrlKey || e.metaKey;
  }

  viewport.addEventListener(
    "wheel",
    (e) => {
      const inText = e.target && e.target.closest && e.target.closest(".node-body, textarea");
      if (isPanModifier(e)) {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = Math.min(3, Math.max(0.2, zoom * factor));
        panX = mx - ((mx - panX) / zoom) * newZoom;
        panY = my - ((my - panY) / zoom) * newZoom;
        zoom = newZoom;
        apply();
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        panX -= e.deltaY || e.deltaX;
        apply();
        return;
      }
      if (inText) return;
      e.preventDefault();
      panY -= e.deltaY;
      panX -= e.deltaX;
      apply();
    },
    { passive: false }
  );

  let panning = false;
  let startX = 0;
  let startY = 0;
  let origPanX = 0;
  let origPanY = 0;

  viewport.addEventListener("mousedown", (e) => {
    if (!isPanModifier(e)) return;
    if (e.target.closest && e.target.closest("input, select, textarea, button, a")) return;
    panning = true;
    startX = e.clientX;
    startY = e.clientY;
    origPanX = panX;
    origPanY = panY;
    viewport.classList.add("panning");
  });

  window.addEventListener("mousemove", (e) => {
    if (!panning) return;
    panX = origPanX + (e.clientX - startX);
    panY = origPanY + (e.clientY - startY);
    apply();
  });

  window.addEventListener("mouseup", () => {
    panning = false;
    viewport.classList.remove("panning");
  });

  function enterPanMode() {
    viewport.classList.add("pan-mode");
    instance.elementsDraggable = false;
  }

  function exitPanMode() {
    viewport.classList.remove("pan-mode");
    viewport.classList.remove("panning");
    panning = false;
    instance.elementsDraggable = true;
  }

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) enterPanMode();
  });

  window.addEventListener("keyup", (e) => {
    if (!e.ctrlKey && !e.metaKey) exitPanMode();
  });

  window.addEventListener("blur", () => exitPanMode());

  apply();

  return {
    getZoom: () => zoom,
    getPan: () => ({ x: panX, y: panY }),
    viewportCenter: () => {
      const rect = viewport.getBoundingClientRect();
      return {
        x: (rect.width / 2 - panX) / zoom,
        y: (rect.height / 2 - panY) / zoom,
      };
    },
    apply,
  };
}
