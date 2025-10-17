import * as d3 from 'd3';

// Simple singleton D3 background controller for one SVG instance
const TILE = 2;

let sel, gTiles, gFx;
let cols = 0, rows = 0, capacity = 0;
let width = 0, height = 0;

function init(svgNode, w, h) {
  width = w; height = h;
  sel = d3.select(svgNode)
    .attr('width', width)
    .attr('height', height);

  // clear previous
  sel.selectAll('*').remove();

  gTiles = sel.append('g').attr('class', 'tiles');
  gFx = sel.append('g').attr('class', 'fx');

  cols = Math.max(1, Math.floor(width / TILE));
  rows = Math.max(1, Math.floor(height / TILE));
  capacity = cols * rows;
}

function updateTiles(totalUnits) {
  if (!gTiles) return;
  const visible = Math.min(Math.max(0, totalUnits), capacity);
  const data = d3.range(visible);

  const selRects = gTiles.selectAll('rect').data(data, (d) => d);
  selRects.exit().remove();

  const enter = selRects.enter().append('rect')
    .attr('width', TILE)
    .attr('height', TILE)
    .attr('fill', 'limegreen')
    .attr('opacity', 0.85);

  enter.merge(selRects)
    .attr('x', (d) => (d % cols) * TILE)
    .attr('y', (d) => Math.floor(d / cols) * TILE)
    .attr('transform', null);
}

function shake(durationMs = 10000) {
  if (!gTiles) return;
  const start = performance.now();
  function frame(now) {
    const tiles = gTiles.selectAll('rect');
    tiles.attr('transform', () => `translate(${(Math.random() * 4 - 2).toFixed(2)},${(Math.random() * 4 - 2).toFixed(2)})`);
    if (now - start < durationMs) {
      requestAnimationFrame(frame);
    } else {
      tiles.attr('transform', null);
    }
  }
  requestAnimationFrame(frame);
}

function fireworks(bursts = 8) {
  if (!gFx) return;
  const cx = width / 2;
  const cy = height / 2;
  for (let i = 0; i < bursts; i++) {
    const angle = (i / bursts) * 2 * Math.PI;
    const bx = cx + Math.cos(angle) * (20 + 20 * Math.random());
    const by = cy + Math.sin(angle) * (20 + 20 * Math.random());
    gFx.append('circle')
      .attr('cx', bx)
      .attr('cy', by)
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', 'gold')
      .attr('stroke-width', 2)
      .attr('opacity', 1)
      .transition()
      .duration(900)
      .attr('r', 90 + Math.random() * 50)
      .attr('opacity', 0)
      .remove();
  }
}

function destroy() {
  if (sel) sel.selectAll('*').remove();
  sel = gTiles = gFx = null;
}

export default { init, updateTiles, shake, fireworks, destroy };
