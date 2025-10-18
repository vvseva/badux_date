import * as d3 from 'd3';

// D3-driven Canvas background controller
const TILE = 4; // px
const BASE_COLOR = 'rgb(34, 197, 94)';    // green-500
const HILITE_COLOR = 'rgb(74, 222, 128)'; // green-400

let canvas, ctx;
let width = 0, height = 0, dpr = 1;
let cols = 0, rows = 0, capacity = 0;
let drawnVisible = 0; // number of base tiles drawn so far (monotonic until capacity)
let lastHighlight = -1;

// Offscreen layer for grid (static)
let gridCanvas, gridCtx;

// Offscreen scratch layer for transient effects (shake/fireworks)
let scratchCanvas, scratchCtx;

function setCanvasSize(node, w, h) {
  dpr = Math.max(1, window.devicePixelRatio || 1);
  node.width = Math.floor(w * dpr);
  node.height = Math.floor(h * dpr);
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
  const c2d = node.getContext('2d');
  c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c2d;
}

function init(canvasNode, w, h) {
  canvas = canvasNode;
  width = w; height = h;
  ctx = setCanvasSize(canvas, width, height);

  cols = Math.max(1, Math.floor(width / TILE));
  rows = Math.max(1, Math.floor(height / TILE));
  capacity = cols * rows;

  // grid layer
  gridCanvas = document.createElement('canvas');
  gridCtx = setCanvasSize(gridCanvas, width, height);
  gridCtx.clearRect(0, 0, width, height);
  gridCtx.globalAlpha = 0.06;
  gridCtx.strokeStyle = '#000';
  gridCtx.lineWidth = 1;
  for (let gx = 0; gx < width; gx += 50) {
    gridCtx.beginPath();
    gridCtx.moveTo(gx + 0.5, 0);
    gridCtx.lineTo(gx + 0.5, height);
    gridCtx.stroke();
  }
  for (let gy = 0; gy < height; gy += 50) {
    gridCtx.beginPath();
    gridCtx.moveTo(0, gy + 0.5);
    gridCtx.lineTo(width, gy + 0.5);
    gridCtx.stroke();
  }
  gridCtx.globalAlpha = 1;

  // clear main canvas, draw grid once
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(gridCanvas, 0, 0);

  // create/reset scratch layer
  scratchCanvas = document.createElement('canvas');
  scratchCtx = setCanvasSize(scratchCanvas, width, height);
  scratchCtx.clearRect(0, 0, width, height);

  drawnVisible = 0;
  lastHighlight = -1;
}

function tilePos(i) {
  const x = (i % cols) * TILE;
  const y = Math.floor(i / cols) * TILE;
  return [x, y];
}

function fillTile(i, color) {
  const [x, y] = tilePos(i);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, TILE, TILE);
}

function updateTiles(totalUnits) {
  if (!ctx) return;
  const clamped = Math.max(0, totalUnits);
  const visible = Math.min(clamped, capacity);

  // Draw any newly visible base tiles incrementally
  if (visible > drawnVisible) {
    ctx.save();
    for (let i = drawnVisible; i < visible; i++) {
      fillTile(i, BASE_COLOR);
    }
    ctx.restore();
    drawnVisible = visible;
  }

  // Determine current highlight index
  let newHighlight = -1;
  if (visible > 0 && visible < capacity) {
    newHighlight = visible - 1; // last newly visible tile
  } else if (visible >= capacity) {
    newHighlight = clamped % capacity; // wrap across full screen
  }

  if (newHighlight !== -1 && newHighlight !== lastHighlight) {
    // restore previous highlight to base
    if (lastHighlight !== -1) fillTile(lastHighlight, BASE_COLOR);
    // draw new highlight
    fillTile(newHighlight, HILITE_COLOR);
    lastHighlight = newHighlight;
  }
}

// Lightweight global shake: jitter canvas content by small offset for duration.
// Uses a per-frame copy of the current canvas so tile updates persist during the effect.
function shake(durationMs = 10000) {
  const endAt = performance.now() + durationMs;
  function step(now) {
    if (!ctx || now > endAt) return;
    // copy current canvas to scratch
    scratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scratchCtx.clearRect(0, 0, width, height);
    scratchCtx.drawImage(canvas, 0, 0);
    // jitter draw back
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const jx = (Math.random() * 4 - 2);
    const jy = (Math.random() * 4 - 2);
    ctx.save();
    ctx.translate(jx, jy);
    ctx.drawImage(scratchCanvas, 0, 0);
    ctx.restore();
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Simple fireworks on canvas (optional): draw expanding circles briefly
function fireworks(bursts = 8) {
  if (!ctx) return;
  const cx = width / 2;
  const cy = height / 2;
  const starts = d3.range(bursts).map(i => ({
    angle: (i / bursts) * 2 * Math.PI,
    r0: 0,
    r1: 90 + Math.random() * 50,
    life: 900,
  }));
  const startTime = performance.now();
  function frame(now) {
    const t = now - startTime;
    // copy current content so tile updates persist
    scratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scratchCtx.clearRect(0, 0, width, height);
    scratchCtx.drawImage(canvas, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(scratchCanvas, 0, 0);

    ctx.strokeStyle = 'gold';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1 - Math.min(1, t / 900);
    starts.forEach(s => {
      const bx = cx + Math.cos(s.angle) * (20 + 20 * Math.random());
      const by = cy + Math.sin(s.angle) * (20 + 20 * Math.random());
      const r = s.r0 + (s.r1 - s.r0) * Math.min(1, t / s.life);
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    if (t < 900) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function destroy() {
  canvas = ctx = null;
  gridCanvas = gridCtx = null;
  scratchCanvas = scratchCtx = null;
  width = height = 0;
  cols = rows = capacity = 0;
  drawnVisible = 0;
  lastHighlight = -1;
}

export default { init, updateTiles, shake, fireworks, destroy };
