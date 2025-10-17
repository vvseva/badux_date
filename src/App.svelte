<script>
  import { onMount, onDestroy } from 'svelte';
  import d3Background from './d3Background.js';

  // Canvases / SVG
  let canvas, gridCanvas, svg;
  let ctx, gridCtx;

  // Dimensions
  let width = 0, height = 0;

  // Time state
  let displayed = new Date(0); // start at Unix epoch
  let speed = 1; // seconds per real-time second; negative = backwards
  let running = true;
  let lastTick = performance.now();
  let rafId;

  // Track last whole minute for D3 background updates
  let lastMin = 0;

  // Tile strip buffer (existing canvas visualization)
  const pxPerSecond = 1;
  const bufferHeight = 100;
  const bufferWidth = 6000; // wide enough to tile smoothly
  const tileAlpha = 0.6;
  let bufferCanvas, bufferCtx;
  let writeX = 0; // next x to write in buffer
  let pending = 0; // carry fractional seconds between frames

  // Audio
  let audioCtx;
  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    return audioCtx;
  }
  function playSwoosh() {
    const ac = getAudio();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(1200, ac.currentTime + 0.25);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.3);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.35);
  }
  function playExplosion() {
    const ac = getAudio();
    const length = ac.sampleRate * 1.0; // 1s
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // white noise with exponential decay
      const t = i / ac.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * t);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filt = ac.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(800, ac.currentTime);
    src.connect(filt).connect(ac.destination);
    src.start();
  }

  // derived formatted values
  $: f = formatDate(displayed);

  function formatDate(d) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return { y, mo, day, hh, mm, ss };
  }

  function currentMinute() {
    return Math.max(0, Math.floor(displayed.getTime() / 60000));
  }

  function tick(now) {
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    if (running) {
      displayed = new Date(displayed.getTime() + dt * speed * 1000);
      drawTiles(dt * Math.abs(speed));
    }

    // Update D3 tiles on whole-minute changes
    const min = currentMinute();
    if (min !== lastMin) {
      lastMin = min;
      d3Background.updateTiles(min);
    }

    render();
    rafId = requestAnimationFrame(tick);
  }

  function drawTiles(seconds) {
    pending += seconds;
    const n = Math.floor(pending);
    if (n <= 0) return;
    pending -= n;

    for (let i = 0; i < n; i++) {
      // color by time, purely decorative
      const hue = (displayed.getTime() / 1000) % 360;
      bufferCtx.fillStyle = `hsla(${hue},60%,60%,${tileAlpha})`;
      bufferCtx.fillRect(writeX, 0, pxPerSecond, bufferHeight);
      writeX = (writeX + pxPerSecond) % bufferWidth;
    }
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // center the tile strip vertically
    const y = Math.floor((ctx.canvas.height - bufferHeight) / 2);
    let x = -(writeX % bufferWidth);
    while (x < ctx.canvas.width) {
      ctx.drawImage(
        bufferCanvas,
        0,
        0,
        bufferWidth,
        bufferHeight,
        x,
        y,
        bufferWidth,
        bufferHeight
      );
      x += bufferWidth;
    }
  }

  // Button bump (shake) effect
  function bumpButton(e) {
    const el = e.currentTarget;
    el.classList.remove('bump');
    void el.offsetWidth; // reflow to restart
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 250);
  }

  // Controls
  function toggleSelect(e) {
    bumpButton(e);
    if (running) {
      running = false;
      d3Background.shake(10000); // 10s shake
      d3Background.fireworks();
      playExplosion();
    } else {
      running = true;
    }
  }
  function goBack(e) {
    bumpButton(e);
    const prevMag = Math.abs(speed);
    if (speed >= 0) speed = -1; else speed = speed * 10;
    if (Math.abs(speed) > prevMag) playSwoosh();
    running = true;
  }
  function goForward(e) {
    bumpButton(e);
    const prevMag = Math.abs(speed);
    if (speed <= 0) speed = 1; else speed = speed * 10;
    if (Math.abs(speed) > prevMag) playSwoosh();
    running = true;
  }

  // Derived labels for speed indicators
  $: speedMag = Math.max(1, Math.abs(Math.round(speed)));
  $: backFactor = speed < 0 ? speedMag : 1;
  $: forwardFactor = speed > 0 ? speedMag : 1;

  onMount(() => {
    // size canvases
    const w = Math.max(640, Math.min(1600, window.innerWidth - 40));
    const h = Math.max(360, Math.min(1000, window.innerHeight - 120));
    width = w; height = h;

    ctx = canvas.getContext('2d');
    ctx.canvas.width = width;
    ctx.canvas.height = height;

    gridCtx = gridCanvas.getContext('2d');
    gridCtx.canvas.width = width;
    gridCtx.canvas.height = height;

    // draw subtle grid once
    gridCtx.clearRect(0, 0, width, height);
    gridCtx.save();
    gridCtx.globalAlpha = 0.06; // invisible-ish grid
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
    gridCtx.restore();

    // prepare tile buffer (canvas strip)
    bufferCanvas = document.createElement('canvas');
    bufferCanvas.width = bufferWidth;
    bufferCanvas.height = bufferHeight;
    bufferCtx = bufferCanvas.getContext('2d');
    bufferCtx.clearRect(0, 0, bufferWidth, bufferHeight);

    // init D3 SVG background
    d3Background.init(svg, width, height);
    lastMin = currentMinute();
    d3Background.updateTiles(lastMin);

    lastTick = performance.now();
    rafId = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    d3Background.destroy();
  });
</script>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial;
    background: #0b1020;
    color: #fff;
  }
  .container {
    position: relative;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  svg, canvas {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
  svg { pointer-events: none; }
  .ui {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 18px;
    align-items: center;
    pointer-events: none;
  }
  .label { font-size: 14px; opacity: 0.9; pointer-events: auto; }
  .dateBox {
    background: rgba(0, 0, 0, 0.35);
    padding: 18px 28px;
    pointer-events: auto;
    text-align: center;
    border-radius: 12px;
  }
  .big {
    font-size: 42px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .small {
    font-size: 16px;
    opacity: 0.9;
  }
  .controls {
    display: flex;
    gap: 12px;
    pointer-events: auto;
  }
  button {
    padding: 10px 16px;
    border-radius: 10px;
    border: 0;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    cursor: pointer;
    font-weight: 600;
  }
  button:hover { background: rgba(255, 255, 255, 0.15); }

  @keyframes btn-shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    50% { transform: translateX(2px); }
    75% { transform: translateX(-2px); }
    100% { transform: translateX(0); }
  }
  :global(button.bump) { animation: btn-shake 0.25s linear; }
</style>

<div class="container">
  <!-- D3 SVG background (behind canvases) -->
  <svg bind:this={svg}></svg>

  <!-- Existing canvases -->
  <canvas bind:this={canvas}></canvas>
  <canvas bind:this={gridCanvas} style="pointer-events: none; opacity: 0.6;"></canvas>

  <div class="ui">
    <div class="label">Select your date of birth</div>
    <div class="dateBox">
      <div class="big">{f.y}-{f.mo}-{f.day}</div>
      <div class="small">{f.hh}:{f.mm}:{f.ss} UTC</div>
    </div>

    <div class="controls">
      <button on:click={goBack}>◀ Back ×{backFactor}</button>
      <button on:click={toggleSelect}>{running ? 'Select Date' : '▶ Continue selecting'}</button>
      <button on:click={goForward}>▶ Forward ×{forwardFactor}</button>
    </div>
  </div>
</div>
