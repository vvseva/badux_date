// "Elevator music" style loop: gentle e‑piano chords, soft bass, light hi‑hat and rim on 2/4

let ac = null;
let master = null;
let running = false;
let schedulerTimer = null;
let nextNoteTime = 0;
let noiseBuffer = null; // reusable noise for drums
let resumeTimer = null; // retry resume under autoplay policies

// Music params
const BPM = 92; // relaxed tempo
const BEAT = 60 / BPM;
const SCHEDULE_AHEAD_SEC = 0.2; // schedule a bit ahead
const LOOKAHEAD_MS = 100; // scheduler tick interval

// Progression: I - vi - ii - V (Cmaj7, Am7, Dm7, G7)
const progression = [
  { root: 60, qual: 'maj7' }, // C4
  { root: 57, qual: 'm7' },   // A3
  { root: 62, qual: 'm7' },   // D4
  { root: 55, qual: '7' },    // G3
];
let progIndex = 0;

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function getIntervals(qual) {
  switch (qual) {
    case 'maj7': return [0, 4, 7, 11];
    case 'm7': return [0, 3, 7, 10];
    case '7': return [0, 4, 7, 10];
    default: return [0, 4, 7, 11];
  }
}

function ensureContext(getAudio) {
  if (!ac) {
    ac = getAudio();
    master = ac.createGain();
    master.gain.value = 0.06; // background level
    master.connect(ac.destination);
    nextNoteTime = ac.currentTime + 0.05;
    // build a reusable noise buffer
    const len = Math.floor(ac.sampleRate * 0.25);
    noiseBuffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
}

function envGain(startTime, dur, peak = 0.5, attack = 0.02, release = 0.4) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.exponentialRampToValueAtTime(peak, startTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + release);
  return g;
}

// Gentle sine bass
function playBass(rootMidi, t) {
  const f = midiToFreq(rootMidi - 12); // one octave down
  const o = ac.createOscillator();
  o.type = 'sine';
  const g = envGain(t, BEAT * 0.8, 0.22, 0.01, 0.25);
  o.frequency.setValueAtTime(f, t);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + BEAT * 1.2);
}

// E‑piano style FM voice per note
function playEPianoNote(freq, t) {
  // carrier
  const car = ac.createOscillator();
  car.type = 'sine';
  car.frequency.setValueAtTime(freq, t);
  // modulator
  const mod = ac.createOscillator();
  mod.type = 'sine';
  mod.frequency.setValueAtTime(freq * 2, t); // 2:1 ratio
  const modGain = ac.createGain();
  modGain.gain.setValueAtTime(120, t); // Hz deviation
  // decay the modulation depth for a plucky attack
  modGain.gain.exponentialRampToValueAtTime(8, t + 0.25);
  mod.connect(modGain).connect(car.frequency);

  const amp = envGain(t, BEAT * 3.2, 0.12, 0.01, 1.2);
  car.connect(amp).connect(master);

  car.start(t);
  mod.start(t);
  const stopAt = t + BEAT * 4.6;
  car.stop(stopAt);
  mod.stop(stopAt);
}

function playChord(rootMidi, qual, t) {
  const intervals = getIntervals(qual);
  // use 3 notes, add an upper extension on the 3rd
  const voices = intervals.slice(0, 3);
  voices.forEach((iv, i) => {
    const note = rootMidi + iv + (i === 2 ? 12 : 0);
    const f = midiToFreq(note);
    playEPianoNote(f, t);
  });
}

function playHat(t) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(7000, t);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  src.connect(hp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.08);
}

function playSnare(t) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1800, t);
  bp.Q.setValueAtTime(0.6, t);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.2);
}

function schedule() {
  const barDur = BEAT * 4;
  while (ac && nextNoteTime < ac.currentTime + SCHEDULE_AHEAD_SEC) {
    const tBar = nextNoteTime;
    const chord = progression[progIndex % progression.length];

    // Chord on beat 1 (sustains quietly)
    playChord(chord.root, chord.qual, tBar);
    // Bass on beats 1 and 3
    playBass(chord.root, tBar);
    playBass(chord.root, tBar + BEAT * 2);
    // Hats on 8ths
    for (let i = 0; i < 8; i++) playHat(tBar + (BEAT * 0.5) * i);
    // Rim/snare on 2 and 4
    playSnare(tBar + BEAT * 1);
    playSnare(tBar + BEAT * 3);

    // advance to next bar
    nextNoteTime += barDur;
    progIndex += 1;
  }
}

async function start(getAudio) {
  if (running) return;
  ensureContext(getAudio);
  try { if (ac.state === 'suspended') await ac.resume(); } catch {}
  running = true;
  schedulerTimer = setInterval(schedule, LOOKAHEAD_MS);
  // If autoplay blocked, keep trying to resume periodically until running
  if (ac && ac.state !== 'running' && !resumeTimer) {
    resumeTimer = setInterval(async () => {
      try { await ac.resume(); } catch {}
      if (ac.state === 'running') {
        clearInterval(resumeTimer);
        resumeTimer = null;
      }
    }, 1000);
  }
}

function stop() {
  if (!running) return;
  running = false;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
  if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
  if (master && ac) {
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 1.0);
  }
}

function setVolume(v) {
  if (master) master.gain.value = Math.max(0, Math.min(1, v));
}

export default { start, stop, setVolume };
