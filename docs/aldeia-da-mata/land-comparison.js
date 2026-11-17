'use strict';

function landArea(points) {
  if (points.length < 3) return 0;
  const origin = points[0];
  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    twiceArea += (a.x - origin.x) * (b.y - origin.y) - (b.x - origin.x) * (a.y - origin.y);
  }
  return Math.abs(twiceArea) / 2;
}

function landSegmentsIntersect(a, b, c, d) {
  const epsilon = 1e-7;
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p, q, r) => Math.abs(cross(p, q, r)) <= epsilon &&
    r.x >= Math.min(p.x, q.x) - epsilon && r.x <= Math.max(p.x, q.x) + epsilon &&
    r.y >= Math.min(p.y, q.y) - epsilon && r.y <= Math.max(p.y, q.y) + epsilon;
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  return (abC * abD < 0 && cdA * cdB < 0) ||
    onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function landIsSimple(points, closed = true) {
  const edges = closed ? points.length : points.length - 1;
  for (let i = 0; i < edges; i++) {
    for (let j = i + 2; j < edges; j++) {
      if (closed && i === 0 && j === edges - 1) continue;
      if (landSegmentsIntersect(points[i], points[(i + 1) % points.length],
        points[j], points[(j + 1) % points.length])) return false;
    }
  }
  return true;
}

function landContains(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

window.createLandComparison = function createLandComparison(options) {
  const overlay = document.querySelector('#land-overlay');
  const tools = document.querySelector('#land-tools');
  const viewer = document.querySelector('#viewer');
  const launches = [...document.querySelectorAll('[data-land-launch]')];
  const storageKey = 'aldeia-land-comparison-v1';
  let original = [], draft = [], offset = { x: 0, y: 0 };
  let active = false, drawing = false, interaction = 'shadow', drag = null;
  let message = '', savedLocally = true;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && Array.isArray(saved.original) && saved.original.length >= 3 && saved.original.length <= 500 &&
      saved.original.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) &&
        Math.abs(point.x) < 1e7 && Math.abs(point.y) < 1e7) &&
      landArea(saved.original) > .01 && landIsSimple(saved.original) &&
      Number.isFinite(saved.offset?.x) && Number.isFinite(saved.offset?.y) &&
      Math.abs(saved.offset.x) < 1e7 && Math.abs(saved.offset.y) < 1e7) {
      original = saved.original;
      offset = saved.offset;
    }
  } catch {
    savedLocally = false;
  }

  function save() {
    try {
      if (original.length) localStorage.setItem(storageKey, JSON.stringify({ original, offset }));
      else localStorage.removeItem(storageKey);
      savedLocally = true;
    } catch {
      savedLocally = false;
    }
  }
  function shadowPoints() {
    return original.map(point => ({ x: point.x + offset.x, y: point.y + offset.y }));
  }
  function centerOf(points) {
    return {
      x: (Math.min(...points.map(point => point.x)) + Math.max(...points.map(point => point.x))) / 2,
      y: (Math.min(...points.map(point => point.y)) + Math.max(...points.map(point => point.y))) / 2
    };
  }
  function updateTools() {
    const points = drawing ? draft : original;
    const area = landArea(points);
    const format = value => value.toLocaleString('en', { maximumFractionDigits: 1 });
    document.querySelector('#land-area').textContent = points.length >= 3
      ? format(area) + ' m² · ' + (area / 10000).toLocaleString('en', { maximumFractionDigits: 4 }) + ' ha'
      : 'Draw your land';
    document.querySelector('#land-note').textContent = original.length && !drawing
      ? 'Plan-view estimate · ' + (savedLocally ? 'saved on this browser' : 'kept in this page session')
      : 'Plan-view area in projected metres';
    document.querySelector('#land-instruction').textContent = message || (drawing
      ? 'Tap corners. Tap the first corner or Finish to close.'
      : !original.length ? 'Zoom to your land, then tap Draw boundary.'
      : interaction === 'shadow' ? 'Drag the blue shadow, or tap to place it. Drag elsewhere to pan.'
      : 'Move the map. Choose Move shadow to compare.');
    document.querySelector('#land-draw').hidden = drawing || original.length > 0;
    document.querySelector('#land-undo').hidden = !drawing;
    document.querySelector('#land-undo').disabled = !draft.length;
    document.querySelector('#land-finish').hidden = !drawing;
    document.querySelector('#land-finish').disabled = draft.length < 3;
    document.querySelector('#land-cancel').hidden = !drawing;
    for (const id of ['land-shadow', 'land-pan', 'land-here', 'land-original', 'land-redraw', 'land-clear']) {
      document.querySelector('#' + id).hidden = drawing || !original.length;
    }
    document.querySelector('#land-shadow').setAttribute('aria-pressed', String(interaction === 'shadow'));
    document.querySelector('#land-pan').setAttribute('aria-pressed', String(interaction === 'pan'));
    launches.forEach(button => button.setAttribute('aria-pressed', String(active)));
    options.schedule();
  }
  function setActive(value) {
    active = value;
    if (!active) drag = null;
    tools.hidden = !active;
    overlay.hidden = !active;
    viewer.toggleAttribute('data-land-active', active);
    if (active) options.enterMap();
    updateTools();
    options.changed(active);
  }
  function startDrawing() {
    drawing = true;
    draft = [];
    drag = null;
    message = '';
    updateTools();
  }
  function finishDrawing() {
    if (draft.length < 3 || landArea(draft) < .01) {
      message = 'Add at least three corners enclosing an area.';
      updateTools();
      return;
    }
    if (!landIsSimple(draft)) {
      message = 'The boundary crosses itself. Undo a corner to adjust it.';
      updateTools();
      return;
    }
    original = draft.map(point => ({ ...point }));
    draft = [];
    offset = { x: 0, y: 0 };
    drawing = false;
    interaction = 'shadow';
    message = '';
    save();
    updateTools();
  }
  function setPan() {
    if (!active) return;
    if (drawing) {
      message = 'Drag to move the map. Tap to continue adding corners.';
    } else {
      interaction = 'pan';
      message = '';
    }
    updateTools();
  }
  function tap(event) {
    if (!active) return false;
    const point = options.toWorld(event.clientX, event.clientY);
    if (drawing) {
      if (draft.length >= 3) {
        const first = options.toScreen(draft[0]);
        if (Math.hypot(first.x - event.clientX, first.y - event.clientY) < 20) {
          finishDrawing();
          return true;
        }
      }
      if (draft.length) {
        const previous = options.toScreen(draft[draft.length - 1]);
        if (Math.hypot(previous.x - event.clientX, previous.y - event.clientY) < 8) return true;
      }
      if (draft.length >= 500) {
        message = 'Finish this outline before adding more corners.';
      } else if (!landIsSimple([...draft, point], false)) {
        message = 'That edge crosses the boundary. Choose another corner.';
      } else {
        draft.push(point);
        message = '';
      }
      updateTools();
      return true;
    }
    if (original.length && interaction === 'shadow') {
      const center = centerOf(original);
      offset = { x: point.x - center.x, y: point.y - center.y };
      save();
      updateTools();
      return true;
    }
    return false;
  }
  function pointerDown(event) {
    if (!active || drawing || !original.length || interaction !== 'shadow') return;
    const point = options.toWorld(event.clientX, event.clientY);
    const shadow = shadowPoints();
    const nearEdge = shadow.some((a, index) => {
      const b = shadow[(index + 1) % shadow.length];
      const pa = options.toScreen(a), pb = options.toScreen(b);
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const t = Math.max(0, Math.min(1, ((event.clientX - pa.x) * dx + (event.clientY - pa.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(event.clientX - pa.x - t * dx, event.clientY - pa.y - t * dy) < 12;
    });
    if (landContains(point, shadow) || nearEdge) {
      drag = { pointerId: event.pointerId, point, offset: { ...offset } };
    }
  }
  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return false;
    const point = options.toWorld(event.clientX, event.clientY);
    offset = { x: drag.offset.x + point.x - drag.point.x, y: drag.offset.y + point.y - drag.point.y };
    options.schedule();
    return true;
  }
  function cancelDrag() {
    if (!drag) return;
    drag = null;
    save();
  }
  function pointerUp(event) {
    if (!drag || drag.pointerId !== event.pointerId) return false;
    if (event.type === 'pointercancel') offset = drag.offset;
    drag = null;
    save();
    updateTools();
    return true;
  }
  function paintPath(ctx, points, fill, stroke, dash = []) {
    if (!points.length) return;
    const rect = options.canvas.getBoundingClientRect();
    ctx.beginPath();
    for (const [index, point] of points.entries()) {
      const screen = options.toScreen(point);
      if (!index) ctx.moveTo(screen.x - rect.left, screen.y - rect.top);
      else ctx.lineTo(screen.x - rect.left, screen.y - rect.top);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function render() {
    if (!active) return;
    const width = options.canvas.clientWidth, height = options.canvas.clientHeight;
    if (!width || !height) return;
    const ratio = options.canvas.width / width;
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (overlay.width !== pixelWidth || overlay.height !== pixelHeight) {
      overlay.width = pixelWidth; overlay.height = pixelHeight;
    }
    const ctx = overlay.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    paintPath(ctx, original, '#e3b34112', '#e3b341', [7, 5]);
    if (!drawing) paintPath(ctx, shadowPoints(), '#58a6ff45', '#79c0ff');
    if (drawing) {
      paintPath(ctx, draft, '#58a6ff22', '#79c0ff');
      const rect = options.canvas.getBoundingClientRect();
      for (const [index, point] of draft.entries()) {
        const screen = options.toScreen(point);
        ctx.beginPath();
        ctx.arc(screen.x - rect.left, screen.y - rect.top, index === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? '#3fb950' : '#e6edf3';
        ctx.fill();
        ctx.strokeStyle = '#0d1117';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  launches.forEach(button => button.onclick = () => setActive(!active));
  document.querySelector('#land-exit').onclick = () => setActive(false);
  document.querySelector('#land-draw').onclick = startDrawing;
  document.querySelector('#land-redraw').onclick = startDrawing;
  document.querySelector('#land-undo').onclick = () => { draft.pop(); message = ''; updateTools(); };
  document.querySelector('#land-finish').onclick = finishDrawing;
  document.querySelector('#land-cancel').onclick = () => { drawing = false; draft = []; message = ''; updateTools(); };
  document.querySelector('#land-shadow').onclick = () => { interaction = 'shadow'; message = ''; updateTools(); };
  document.querySelector('#land-pan').onclick = setPan;
  document.querySelector('#land-here').onclick = () => {
    const center = centerOf(original), target = options.cameraCenter();
    offset = { x: target.x - center.x, y: target.y - center.y };
    interaction = 'shadow';
    message = '';
    save();
    updateTools();
  };
  document.querySelector('#land-original').onclick = () => options.fit(original);
  document.querySelector('#land-clear').onclick = () => {
    original = []; draft = []; offset = { x: 0, y: 0 }; drawing = false; message = '';
    save();
    updateTools();
  };

  return {
    get active() { return active; },
    get drawing() { return drawing; },
    render, tap, pointerDown, pointerMove, pointerUp, cancelDrag, setPan,
    deactivate() { if (active) setActive(false); },
    keyDown(event) {
      if (!active) return false;
      if (event.key === 'Escape') {
        if (drawing) { drawing = false; draft = []; message = ''; updateTools(); }
        else setActive(false);
      } else if (drawing && event.key === 'Enter') finishDrawing();
      else if (drawing && (event.key === 'Backspace' || (event.key === 'z' && (event.ctrlKey || event.metaKey)))) {
        draft.pop(); message = ''; updateTools();
      } else return false;
      event.preventDefault();
      return true;
    }
  };
};
