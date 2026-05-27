import { clamp, beep, speak, shouldBeep, shouldSpeak, formatTime, vibrate, VIB } from '../engine.js';

const RING_LENGTH = 339.292;

const INTENTIONS = [
  'Be still and know that I am God.',
  'The Lord is my shepherd.',
  'Ask, and it shall be given to you.',
  'I can do all things through Christ who strengthens me.',
  'Cast all your anxiety on Him, for He cares for you.',
  'The peace of God surpasses all understanding.',
  'Be still. Listen.',
  'Thy will be done.'
];

export async function init({ timerMain, drawerInputGrid, drawerTitle, drawerPreset, soundMode, setWakeLock }) {
  const accent    = '#d4a517';
  drawerTitle.textContent = 'Prayer Settings';
  const accentDim = 'rgba(212,165,23,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

  const intention = INTENTIONS[Math.floor(Math.random() * INTENTIONS.length)];

  timerMain.innerHTML = `
    <div class="timer-panel">
      <div class="phase-header">
        <div class="phase-eyebrow" style="color:${accent}">Prayer Time</div>
        <div class="phase-label" id="prayLabel">Be Still</div>
      </div>
      <div class="ring-wrap">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="54"/>
          <circle class="ring-fill" id="prayRing" cx="60" cy="60" r="54" style="stroke:${accent}"/>
        </svg>
        <div class="ring-center">
          <div class="time-display" id="prayTime">--:--</div>
          <div class="round-label" id="prayStatus">Ready</div>
        </div>
      </div>
      <div class="prayer-intention" id="prayIntention" style="
        text-align:center; color:var(--muted); font-style:italic;
        font-size:0.85rem; line-height:1.6; padding:0 8px;
      ">${intention}</div>
      <div class="controls">
        <button class="btn-primary" id="prayStart" type="button" style="background:${accent};color:#1a1000">Begin</button>
        <button class="btn-secondary" id="prayReset" type="button">Reset</button>
      </div>
    </div>`;

  
  drawerInputGrid.innerHTML = `
    <div class="settings-header">
      <div class="settings-title">Settings</div>
      <button class="btn-preset" id="prayPreset">10 min</button>
    </div>
    <div class="input-grid">
      <label class="field-label"><span>Duration (minutes)</span>
        <input class="field-input" id="prayDur" type="number" min="1" max="60" value="10" inputmode="numeric">
      </label>
      <label class="field-label"><span>Gentle bell every (minutes, 0 = off)</span>
        <input class="field-input" id="prayBell" type="number" min="0" max="15" value="5" inputmode="numeric">
      </label>
    </div>`;

  const els = {
    label:  document.getElementById('prayLabel'),
    ring:   document.getElementById('prayRing'),
    time:   document.getElementById('prayTime'),
    status: document.getElementById('prayStatus'),
    start:  document.getElementById('prayStart'),
    reset:  document.getElementById('prayReset'),
    dur:    document.getElementById('prayDur'),
    bell:   document.getElementById('prayBell'),
    preset: document.getElementById('prayPreset')
  };

  let isRunning=false, startedAt=0, pausedAt=0, durationMs=0, rafId=0;
  let nextBellAt=0, bellIntervalMs=0, wakeLock=null;

  function softBell() {
    if (shouldBeep(soundMode())) {
      beep(432, 1.2, 0.1);
      setTimeout(() => beep(528, 1.0, 0.08), 500);
    }
    vibrate(VIB.bell);
  }

  function getDur()  { return Math.max(60, clamp(els.dur.value,1,60)*60)*1000; }
  function getBell() { return clamp(els.bell.value,0,15)*60*1000; }

  function render(remainingMs) {
    const progress = durationMs > 0 ? remainingMs/durationMs : 1;
    els.ring.style.strokeDashoffset = RING_LENGTH*(1-progress);
    els.time.textContent  = formatTime(remainingMs);
    els.status.textContent = isRunning ? 'Praying...' : remainingMs<durationMs ? 'Paused' : 'Ready';
    els.start.textContent  = isRunning ? 'Pause' : remainingMs<durationMs ? 'Resume' : 'Begin';
  }

  async function requestWL() {
    if (!('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); setWakeLock(true); } catch {}
  }
  function releaseWL() {
    if (wakeLock) { wakeLock.release().catch(()=>{}); wakeLock=null; }
    setWakeLock(false);
  }

  function tick(now) {
    const elapsed     = now - startedAt;
    const remainingMs = Math.max(0, durationMs - elapsed);
    render(remainingMs);
    if (bellIntervalMs > 0 && now >= nextBellAt) { softBell(); nextBellAt += bellIntervalMs; }
    if (remainingMs <= 0) {
      isRunning = false;
      softBell();
      if (shouldSpeak(soundMode())) speak('Amen. Prayer time complete.');
      vibrate(VIB.done);
      releaseWL();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    durationMs     = getDur();
    bellIntervalMs = getBell();
    isRunning      = true;
    const elapsed  = pausedAt > 0 ? pausedAt : 0;
    startedAt      = performance.now() - elapsed;
    pausedAt       = 0;
    if (bellIntervalMs>0) nextBellAt = startedAt + bellIntervalMs;
    if (shouldSpeak(soundMode())) speak('Begin your prayer.');
    requestWL();
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    isRunning = false;
    cancelAnimationFrame(rafId);
    pausedAt = performance.now()-startedAt;
    releaseWL();
    render(Math.max(0,durationMs-pausedAt));
  }

  function reset() {
    isRunning=false; cancelAnimationFrame(rafId);
    pausedAt=0; startedAt=0;
    durationMs=getDur();
    releaseWL();
    // Rotate intention
    const el = document.getElementById('prayIntention');
    if (el) el.textContent = INTENTIONS[Math.floor(Math.random()*INTENTIONS.length)];
    render(durationMs);
  }

  els.start.addEventListener('click', () => { if(isRunning) pause(); else start(); });
  els.reset.addEventListener('click', reset);
  els.preset.addEventListener('click', () => { els.dur.value=10; els.bell.value=5; reset(); });
  [els.dur,els.bell].forEach(el => el.addEventListener('change', reset));

  reset();

  return {
    destroy() { cancelAnimationFrame(rafId); releaseWL(); timerMain.innerHTML='';  },
    onSoundModeChange() {}
  };
}
