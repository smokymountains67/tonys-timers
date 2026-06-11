import { clamp, beep, speak, shouldBeep, shouldSpeak, formatTimeLong, vibrate, VIB } from '../engine.js';

const RING_LENGTH = 339.292;
const KEY = 'tonys-fasting-state';

export async function init({ timerMain, drawerInputGrid, drawerTitle, drawerPreset, soundMode, setWakeLock }) {
  const accent    = '#14b8a6';
  const accentDim = 'rgba(20,184,166,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);
  drawerTitle.textContent = 'Fasting Settings';
  drawerPreset.style.display = 'none';

  timerMain.innerHTML = `
    <div class="timer-panel">
      <div class="phase-header">
        <div class="phase-eyebrow" style="color:${accent}">Fasting Timer</div>
        <div class="phase-label" id="fastLabel">Ready to Fast</div>
      </div>
      <div class="ring-wrap">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="54"/>
          <circle class="ring-fill" id="fastRing" cx="60" cy="60" r="54" style="stroke:${accent}"/>
        </svg>
        <div class="ring-center">
          <div class="time-display" id="fastTime" style="font-size:clamp(2.4rem,12vw,4rem)">00:00:00</div>
          <div class="info-key" id="fastStatus" style="margin-top:4px">Set your fast duration</div>
          <div class="info-key" id="fastTarget" style="opacity:0.6"></div>
        </div>
      </div>
      <div></div>
      <div class="controls">
        <button class="btn-primary" id="fastStart" type="button" style="background:${accent};color:#0a1f1e">Start Fast</button>
        <button class="btn-secondary" id="fastReset" type="button">Reset</button>
      </div>
    </div>`;

  drawerInputGrid.innerHTML = `
    <label class="field-label"><span>Protocol</span>
      <select class="field-input" id="fastProtocol">
        <option value="16">16:8 (16hr fast)</option>
        <option value="18">18:6 (18hr fast)</option>
        <option value="20">20:4 (20hr fast)</option>
        <option value="24">24hr fast</option>
        <option value="custom">Custom</option>
      </select>
    </label>
    <label class="field-label" id="fastCustomRow" style="display:none"><span>Custom hours</span>
      <input class="field-input" id="fastCustomHrs" type="number" min="1" max="72" value="16" inputmode="numeric">
    </label>`;

  const els = {
    label:     document.getElementById('fastLabel'),
    ring:      document.getElementById('fastRing'),
    time:      document.getElementById('fastTime'),
    status:    document.getElementById('fastStatus'),
    target:    document.getElementById('fastTarget'),
    start:     document.getElementById('fastStart'),
    reset:     document.getElementById('fastReset'),
    protocol:  document.getElementById('fastProtocol'),
    customRow: document.getElementById('fastCustomRow'),
    customHrs: document.getElementById('fastCustomHrs')
  };

  // Wall-clock state — survives page reloads via localStorage
  let fastStartTime = 0;
  let durationMs    = 0;
  let completed     = false;
  let intervalId    = 0;

  // Restore an in-progress fast
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.fastStartTime && saved?.durationMs) {
      fastStartTime = saved.fastStartTime;
      durationMs    = saved.durationMs;
    }
  } catch {}

  const isActive = () => fastStartTime > 0 && !completed;

  function getTargetMs() {
    const p   = els.protocol.value;
    const hrs = p === 'custom' ? clamp(els.customHrs.value, 1, 72) : Number(p);
    return hrs * 3600000;
  }

  function render() {
    const elapsed   = fastStartTime > 0 ? Date.now() - fastStartTime : 0;
    const remaining = Math.max(0, durationMs - elapsed);
    const progress  = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 0;

    els.ring.style.strokeDashoffset = RING_LENGTH * (1 - progress);
    els.time.textContent = formatTimeLong(Math.min(elapsed, durationMs || elapsed));

    if (fastStartTime === 0) {
      els.label.textContent  = 'Ready to Fast';
      els.status.textContent = 'Set your protocol and start';
      els.target.textContent = '';
      els.start.textContent  = 'Start Fast';
    } else if (remaining > 0) {
      const pct = Math.round(progress * 100);
      els.label.textContent  = `${pct}% Complete`;
      els.status.textContent = `${formatTimeLong(remaining)} remaining`;
      els.target.textContent = `Target: ${formatTimeLong(durationMs)}`;
      els.start.textContent  = 'Fasting...';
    } else {
      els.label.textContent  = 'Fast Complete!';
      els.status.textContent = `You fasted ${formatTimeLong(durationMs)} 🎉`;
      els.target.textContent = '';
      els.start.textContent  = 'Start New Fast';
    }
  }

  function checkComplete() {
    if (!isActive()) return;
    if (Date.now() - fastStartTime >= durationMs) {
      completed = true;
      if (shouldBeep(soundMode())) beep(528, 1.0, 0.2);
      if (shouldSpeak(soundMode())) speak('Fast complete! Great discipline!');
      vibrate(VIB.done);
      try { localStorage.removeItem(KEY); } catch {}
    }
  }

  function startLoop() {
    clearInterval(intervalId);
    // 1-second heartbeat is plenty for an hours-long timer, and it
    // recomputes from wall clock so background gaps are harmless
    intervalId = setInterval(() => { render(); checkComplete(); }, 1000);
  }

  const onVis = () => {
    if (document.visibilityState === 'visible') { render(); checkComplete(); }
  };
  document.addEventListener('visibilitychange', onVis);

  els.start.addEventListener('click', () => {
    if (isActive()) return; // a fast is running — use Reset to abandon
    completed     = false;
    durationMs    = getTargetMs();
    fastStartTime = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify({ fastStartTime, durationMs })); } catch {}
    if (shouldSpeak(soundMode())) speak('Fast started. Stay strong!');
    startLoop();
    render();
  });

  els.reset.addEventListener('click', () => {
    fastStartTime = 0; durationMs = 0; completed = false;
    clearInterval(intervalId);
    try { localStorage.removeItem(KEY); } catch {}
    render();
  });

  els.protocol.addEventListener('change', () => {
    els.customRow.style.display = els.protocol.value === 'custom' ? '' : 'none';
    render();
  });

  if (isActive()) startLoop();
  render();
  checkComplete();

  return {
    destroy() {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVis);
      timerMain.innerHTML = '';
      drawerInputGrid.innerHTML = '';
    },
    onSoundModeChange() {}
  };
}
