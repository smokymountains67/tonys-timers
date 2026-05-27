import { clamp, beep, speak, shouldBeep, shouldSpeak, formatTimeLong, vibrate, VIB } from '../engine.js';

const RING_LENGTH = 339.292;
const KEY = 'tonys-fasting-state';

export async function init({ timerMain, drawerInputGrid, drawerTitle, drawerPreset, soundMode, setWakeLock }) {
  const accent    = '#14b8a6';
  drawerTitle.textContent = 'Fasting Settings';
  const accentDim = 'rgba(20,184,166,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

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
          <div class="time-display" id="fastTime">00:00:00</div>
          <div class="round-label" id="fastStatus">Set your fast duration</div>
          <div class="total-label" id="fastTarget"></div>
        </div>
      </div>
      <div></div>
      <div class="controls">
        <button class="btn-primary" id="fastStart" type="button" style="background:${accent};color:#0a1f1e">Start Fast</button>
        <button class="btn-secondary" id="fastReset" type="button">Reset</button>
      </div>
    </div>`;

  
  drawerInputGrid.innerHTML = `
    <div class="settings-header">
      <div class="settings-title">Fast Type</div>
    </div>
    <div class="input-grid">
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
      </label>
    </div>`;

  const els = {
    label:    document.getElementById('fastLabel'),
    ring:     document.getElementById('fastRing'),
    time:     document.getElementById('fastTime'),
    status:   document.getElementById('fastStatus'),
    target:   document.getElementById('fastTarget'),
    start:    document.getElementById('fastStart'),
    reset:    document.getElementById('fastReset'),
    protocol: document.getElementById('fastProtocol'),
    customRow:document.getElementById('fastCustomRow'),
    customHrs:document.getElementById('fastCustomHrs')
  };

  let isRunning = false, fastStartTime = 0, durationMs = 0, rafId = 0;

  // Try restore state
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } })();
  if (saved?.fastStartTime && saved?.durationMs) {
    fastStartTime = saved.fastStartTime;
    durationMs    = saved.durationMs;
    const elapsed = Date.now() - fastStartTime;
    if (elapsed < durationMs) {
      isRunning = true;
      startTick();
    }
  }

  function getTargetMs() {
    const p = els.protocol.value;
    const hrs = p === 'custom' ? clamp(els.customHrs.value, 1, 72) : Number(p);
    return hrs * 3600 * 1000;
  }

  function render() {
    const elapsed     = isRunning ? Date.now() - fastStartTime : 0;
    const remaining   = Math.max(0, durationMs - elapsed);
    const progress    = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 0;

    els.ring.style.strokeDashoffset = RING_LENGTH * (1 - progress);
    els.time.textContent = formatTimeLong(elapsed);

    if (!isRunning && elapsed === 0) {
      els.label.textContent  = 'Ready to Fast';
      els.status.textContent = 'Set your protocol and start';
      els.target.textContent = '';
    } else if (remaining > 0) {
      const pct = Math.round(progress * 100);
      els.label.textContent  = `${pct}% Complete`;
      els.status.textContent = `${formatTimeLong(remaining)} remaining`;
      els.target.textContent = `Target: ${formatTimeLong(durationMs)}`;
    } else {
      els.label.textContent  = 'Fast Complete!';
      els.status.textContent = `You fasted for ${formatTimeLong(durationMs)} 🎉`;
      els.target.textContent = '';
    }

    els.start.textContent = isRunning ? 'Pause Fast' : elapsed > 0 ? 'Resume' : 'Start Fast';
  }

  function saveFastState() {
    try { localStorage.setItem(KEY, JSON.stringify({ fastStartTime, durationMs })); } catch {}
  }

  function startTick() {
    cancelAnimationFrame(rafId);
    function tick() {
      render();
      const elapsed = Date.now() - fastStartTime;
      if (elapsed >= durationMs) {
        isRunning = false;
        if (shouldBeep(soundMode())) beep(528, 1.0, 0.2);
        if (shouldSpeak(soundMode())) speak('Fast complete! Great discipline!');
        vibrate(VIB.done);
        setWakeLock(false);
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  els.start.addEventListener('click', () => {
    if (isRunning) {
      // Just pause display, keep wall-clock running (fasting continues)
      isRunning = false;
      cancelAnimationFrame(rafId);
      render();
    } else {
      durationMs    = getTargetMs();
      fastStartTime = Date.now();
      isRunning     = true;
      saveFastState();
      if (shouldSpeak(soundMode())) speak('Fast started. Stay strong!');
      startTick();
    }
  });

  els.reset.addEventListener('click', () => {
    isRunning     = false;
    fastStartTime = 0;
    durationMs    = 0;
    cancelAnimationFrame(rafId);
    try { localStorage.removeItem(KEY); } catch {}
    render();
  });

  els.protocol.addEventListener('change', () => {
    els.customRow.style.display = els.protocol.value === 'custom' ? '' : 'none';
    render();
  });

  render();

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      timerMain.innerHTML = '';
      drawerInputGrid.innerHTML = '';
      settingsPanel.style.display = 'none';
    },
    onSoundModeChange() {}
  };
}
