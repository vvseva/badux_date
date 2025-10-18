<script>
  import { onMount, onDestroy } from 'svelte';
  import d3Background from './d3Background.js';
  import music from './music.js';

  let canvas;
  let width = 0, height = 0;

  // Time state
  let displayed = new Date(0);
  let speed = 1;
  let running = true;
  let lastTick = performance.now();
  let rafId;
  let lastMin = 0;

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

  const MAX_SPEED = 10000;
  let lastUpdateTime = 0; // throttle D3 updates to ~60Hz

  function tick(now) {
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    if (running) {
      displayed = new Date(displayed.getTime() + dt * speed * 1000);
    }

    // Throttle visual updates to ~60Hz
    if (now - lastUpdateTime > 1000 / 60) {
      lastUpdateTime = now;
      const min = currentMinute();
      if (min !== lastMin) {
        // If many minutes were skipped due to high speed, jump directly to final state
        lastMin = min;
        d3Background.updateTiles(min);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  // Button bump (shake) effect
  function bumpButton(e) {
    const el = e.currentTarget;
    el.classList.remove('bump');
    void el.offsetWidth; // reflow to restart
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 250);
    // kick off background music on first interaction
    music.start(getAudio);
  }

  // Controls
  function toggleSelect(e) {
    bumpButton(e);
    // Do not pause; just trigger effects and let user continue
    d3Background.shake(10000);
    d3Background.fireworks();
    playExplosion();
    showSelectedPopup();
  }
  function goBack(e) {
    bumpButton(e);
    const prevMag = Math.abs(speed);
    if (speed >= 0) speed = -1; else speed = Math.max(-MAX_SPEED, speed * 10);
    if (Math.abs(speed) > prevMag) playSwoosh();
    running = true;
  }
  function goForward(e) {
    bumpButton(e);
    const prevMag = Math.abs(speed);
    if (speed <= 0) speed = 1; else speed = Math.min(MAX_SPEED, speed * 10);
    if (Math.abs(speed) > prevMag) playSwoosh();
    running = true;
  }

  // Derived labels for speed indicators (show capped value)
  $: speedMag = Math.max(1, Math.min(MAX_SPEED, Math.abs(Math.round(speed))));
  $: backFactor = speed < 0 ? speedMag : 1;
  $: forwardFactor = speed > 0 ? speedMag : 1;

  let resizeTO;
  let toastMsg = '';
  function showSelectedPopup() {
    toastMsg = `Selected: ${f.y}-${f.mo}-${f.day} ${f.hh}:${f.mm}:${f.ss} UTC`;
  }
  function closeToast() {
    toastMsg = '';
  }
  function handleResize() {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => {
      const w = Math.max(640, Math.min(1600, window.innerWidth - 40));
      const h = Math.max(360, Math.min(1000, window.innerHeight - 120));
      width = w; height = h;
      d3Background.init(canvas, width, height);
      lastMin = currentMinute();
      d3Background.updateTiles(lastMin);
    }, 150);
  }

  onMount(() => {
    width = Math.max(640, Math.min(1600, window.innerWidth - 40));
    height = Math.max(360, Math.min(1000, window.innerHeight - 120));

    d3Background.init(canvas, width, height);
    lastMin = currentMinute();
    d3Background.updateTiles(lastMin);

    window.addEventListener('resize', handleResize);

    lastTick = performance.now();
    rafId = requestAnimationFrame(tick);

    // Start elevator music immediately on load (attempt resume if needed)
    music.start(getAudio);
  });

  // As an extra guard, also attempt start on DOM ready in case onMount timing varies
  if (typeof window !== 'undefined') {
    const onReady = () => music.start(getAudio);
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      onReady();
    } else {
      window.addEventListener('DOMContentLoaded', onReady, { once: true });
    }
  }

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', handleResize);
    d3Background.destroy();
    music.stop();
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
  canvas {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
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
  .volbar {
    position: fixed;
    right: 14px;
    top: 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    background: rgba(0,0,0,0.35);
    padding: 8px 10px;
    border-radius: 10px;
    pointer-events: auto;
    font-size: 12px;
    opacity: 0.9;
  }
  .volbar input[type="range"] {
    appearance: none;
    width: 120px;
    height: 6px;
    background: rgba(255,255,255,0.2);
    border-radius: 3px;
  }
  .volbar input[type="range"]::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #fff; cursor: pointer; }
  .volbar input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #fff; cursor: pointer; }
  .toast {
    position: fixed;
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.75);
    color: #fff;
    padding: 10px 14px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
    opacity: 1;
    transition: opacity 0.2s ease;
    z-index: 10;
  }
  .toast button {
    background: transparent;
    border: 0;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    padding: 2px 6px;
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
  .footer {
    position: fixed;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    opacity: 0.75;
    pointer-events: auto;
  }
  .footer a { color: #9ee6b2; text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
</style>

<div class="container">
  <canvas bind:this={canvas}></canvas>

  <div class="ui">
    <div class="label">Select your date of birth</div>
    <div class="dateBox">
      <div class="big">{f.y}-{f.mo}-{f.day}</div>
      <div class="small">{f.hh}:{f.mm}:{f.ss} UTC</div>
    </div>

    <div class="controls">
      <button on:click={goBack}>◀ Back ×{backFactor}</button>
      <button on:click={toggleSelect}>Select Date</button>
      <button on:click={goForward}>▶ Forward ×{forwardFactor}</button>
    </div>
  </div>

  <div class="volbar" aria-label="Music volume">
    <span>Music</span>
    <input type="range" min="0" max="1" step="0.01" value="0.06" on:input={(e)=> music.setVolume(parseFloat(e.currentTarget.value))} />
  </div>

  {#if toastMsg}
    <div class="toast" role="status" aria-live="polite">
      <span>{toastMsg}</span>
      <button aria-label="Close" on:click={closeToast}>×</button>
    </div>
  {/if}

  <div class="footer">
    <a href="https://github.com/vvseva/badux_date" target="_blank" rel="noopener noreferrer">GitHub: vvseva/badux_date</a>
  </div>
</div>
