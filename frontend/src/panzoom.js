export function createPanZoom({ canvas, viewport, instance, onTransform }) {
  let zoom = 1;
  let panX = 0;
  let panY = 0;

  function apply() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    canvas.style.transformOrigin = "0 0";
    instance.setZoom(zoom);
    instance.repaintEverything();
    if (onTransform) onTransform({ zoom, panX, panY });
  }

  viewport.addEventListener(
    "wheel",
    (e) => {
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
    },
    { passive: false }
  );

  let panning = false;
  let startX = 0;
  let startY = 0;
  let origPanX = 0;
  let origPanY = 0;

  viewport.addEventListener("mousedown", (e) => {
    if (e.target === canvas || e.target === viewport) {
      panning = true;
      startX = e.clientX;
      startY = e.clientY;
      origPanX = panX;
      origPanY = panY;
      viewport.classList.add("panning");
    }
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
