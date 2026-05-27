import { clamp, beep, speak, shouldBeep, shouldSpeak, TimerEngine, formatTime, VIB, vibrate } from '../engine.js';

const RING_LENGTH = 339.292;

export async function init({ timerMain, drawerInputGrid, drawerTitle, drawerPreset, soundMode, setWakeLock }) {
  const accent    = '#6366f1';
  drawerTitle.textContent = 'Meditation Settings';
  const accentDim = 'rgba(99,102,241,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

  timerMain.innerHTML = `
    <div class="timer-panel">
      <div class="phase-header">
        <div class="phase-eyebrow" style="color:${accent}">Meditation</div>
        <div class="phase-label" id="medLabel">Breathe</div>
      </div>
      <div class="ring-wrap">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="54"/>
          <circle class="ring-fill" id="medRing" cx="60" cy="60" r="54" style="stroke:${accent}"/>
        </svg>
        <div class="ring-center">
          <div class="time-display" id="medTime">--:--</div>
          <div class="round-label" id="medRound"></div>
          <div class="total-label" id="medTotal"></div>
        </div>
      </div>
      <div></div>
      <div class="controls">
        <button class="btn-primary" id="medStart" type="button" style="background:${accent}">Start</button>
        <button class="btn-secondary" id="medReset" type="button">Reset</button>
      </div>
    </div>`;

  
  drawerInputGrid.innerHTML = `
    <div class="settings-header">
      <div class="settings-title">Settings</div>
      <button class="btn-preset" id="medPreset">15 min</button>
    </div>
    <div class="input-grid">
      <label class="field-label"><span>Duration (minutes)</span>
        <input class="field-input" id="medDur" type="number" min="1" max="120" value="15" inputmode="numeric">
      </label>
      <label class="field-label"><span>Bell interval (minutes, 0 = off)</span>
        <input class="field-input" id="medBell" type="number" min="0" max="30" value="5" inputmode="numeric">
      </label>
    </div>`;

  const els = {
    label: document.getElementById('medLabel'),
    ring:  document.getElementById('medRing'),
    time:  document.getElementById('medTime'),
    round: document.getElementById('medRound'),
    total: document.getElementById('medTotal'),
    start: document.getElementById('medStart'),
    reset: document.getElementById('medReset'),
    dur:   document.getElementById('medDur'),
    bell:  document.getElementById('medBell'),
    preset:document.getElementById('medPreset')
  };

  let isRunning = false, startedAt = 0, pausedAt = 0, durationMs = 0, rafId = 0;
  let nextBellAt = 0, bellIntervalMs = 0;
  let wakeLock = null;

  function playBell() {
    if (shouldBeep(soundMode())) {
      // Three gentle rising tones
      beep(528, 0.8, 0.15);
      setTimeout(() => beep(660, 0.6, 0.12), 300);
      setTimeout(() => beep(784, 0.5, 0.1),  600);
    }
    vibrate(VIB.bell);
  }

  function getDuration() { return Math.max(60, clamp(els.dur.value,1,120) * 60) * 1000; }
  function getBellInterval() { return clamp(els.bell.value,0,30) * 60 * 1000; }

  function render(remainingMs) {
    const progress = durationMs > 0 ? remainingMs / durationMs : 1;
    els.ring.style.strokeDashoffset = RING_LENGTH * (1 - progress);
    els.time.textContent  = formatTime(remainingMs);
    els.round.textContent = isRunning ? 'Breathe...' : remainingMs < durationMs ? 'Paused' : 'Ready';
    els.total.textContent = '';
    els.start.textContent = isRunning ? 'Pause' : remainingMs < durationMs ? 'Resume' : 'Start';
  }

  function tick(now) {
    const elapsed     = now - startedAt;
    const remainingMs = Math.max(0, durationMs - elapsed);
    render(remainingMs);

    // Bell
    if (bellIntervalMs > 0 && now >= nextBellAt) {
      playBell();
      nextBellAt += bellIntervalMs;
    }

    if (remainingMs <= 0) {
      isRunning = false;
      playBell();
      if (shouldSpeak(soundMode())) speak('Meditation complete. Namaste.');
      vibrate(VIB.done);
      setWakeLock(false);
      render(0);
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  async function requestWL() {
    if (!('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); setWakeLock(true); } catch {}
  }
  function releaseWL() {
    if (wakeLock) { wakeLock.release().catch(()=>{}); wakeLock=null; }
    setWakeLock(false);
  }

  function start() {
    durationMs    = getDuration();
    bellIntervalMs = getBellInterval();
    isRunning     = true;
    const elapsed = pausedAt > 0 ? pausedAt : 0;
    startedAt     = performance.now() - elapsed;
    pausedAt      = 0;
    if (bellIntervalMs > 0) nextBellAt = startedAt + bellIntervalMs;
    if (shouldSpeak(soundMode())) speak('Begin.');
    requestWL();
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    isRunning = false;
    cancelAnimationFrame(rafId);
    pausedAt = performance.now() - startedAt;
    releaseWL();
    render(Math.max(0, durationMs - pausedAt));
  }

  function reset() {
    isRunning = false;
    cancelAnimationFrame(rafId);
    pausedAt  = 0;
    startedAt = 0;
    durationMs = getDuration();
    releaseWL();
    render(durationMs);
  }

  els.start.addEventListener('click', () => { if (isRunning) pause(); else start(); });
  els.reset.addEventListener('click', reset);
  els.preset.addEventListener('click', () => { els.dur.value=15; els.bell.value=5; reset(); });
  [els.dur, els.bell].forEach(el => el.addEventListener('change', reset));

  reset();

  return {
    destroy() { cancelAnimationFrame(rafId); releaseWL(); timerMain.innerHTML='';  },
    onSoundModeChange() {}
  };
}
