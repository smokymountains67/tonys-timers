import { TimerEngine, clamp, beep, speak, shouldBeep, shouldSpeak,
         formatTime, vibrate, VIB } from '../engine.js';

const RING_LENGTH = 339.292;

export async function init({ timerMain, drawerInputGrid, drawerTitle, drawerPreset, soundMode, setWakeLock }) {
  const accent    = '#6366f1';
  const accentDim = 'rgba(99,102,241,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);
  drawerTitle.textContent = 'Meditation Settings';
  drawerPreset.style.display = '';
  drawerPreset.textContent = '15 min';

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
          <div class="info-key" id="medStatus" style="margin-top:4px">Ready</div>
        </div>
      </div>
      <div></div>
      <div class="controls">
        <button class="btn-primary" id="medStart" type="button" style="background:${accent}">Start</button>
        <button class="btn-secondary" id="medReset" type="button">Reset</button>
      </div>
    </div>`;

  drawerInputGrid.innerHTML = `
    <label class="field-label"><span>Duration (minutes)</span>
      <input class="field-input" id="medDur" type="number" min="1" max="120" value="15" inputmode="numeric">
    </label>
    <label class="field-label"><span>Bell interval (minutes, 0 = off)</span>
      <input class="field-input" id="medBell" type="number" min="0" max="30" value="5" inputmode="numeric">
    </label>`;

  const els = {
    label:  document.getElementById('medLabel'),
    ring:   document.getElementById('medRing'),
    time:   document.getElementById('medTime'),
    status: document.getElementById('medStatus'),
    start:  document.getElementById('medStart'),
    reset:  document.getElementById('medReset'),
    dur:    document.getElementById('medDur'),
    bell:   document.getElementById('medBell')
  };

  let lastBell = 0;

  function gentleBell() {
    if (shouldBeep(soundMode())) {
      beep(528, 0.8, 0.15);
      setTimeout(() => beep(660, 0.6, 0.12), 300);
      setTimeout(() => beep(784, 0.5, 0.1),  600);
    }
    vibrate(VIB.bell);
  }

  const engine = new TimerEngine({
    onTick(state) {
      els.ring.style.strokeDashoffset = RING_LENGTH * (1 - state.progress);
      els.time.textContent = formatTime(state.remainingMs);
      els.status.textContent = state.isComplete ? 'Complete'
        : state.isRunning ? 'Breathe...'
        : state.hasStarted ? 'Paused' : 'Ready';
      els.start.textContent = state.isRunning ? 'Pause'
        : state.hasStarted && !state.isComplete ? 'Resume' : 'Start';

      // Interval bells from absolute elapsed — rings once even after a gap
      const intervalMs = clamp(els.bell.value, 0, 30) * 60000;
      if (intervalMs > 0 && state.isRunning) {
        const elapsed = state.durationMs - state.remainingMs;
        const count   = Math.floor(elapsed / intervalMs);
        if (count > lastBell) { lastBell = count; gentleBell(); }
      }
    },
    onComplete() {
      gentleBell();
      if (shouldSpeak(soundMode())) speak('Meditation complete.');
      vibrate(VIB.done);
    },
    onWakeLock(active) { setWakeLock(active); }
  });

  function reload() {
    lastBell = 0;
    const secs = Math.max(60, clamp(els.dur.value, 1, 120) * 60);
    engine.load([{ type: 'med', label: 'Breathe', seconds: secs }]);
  }

  els.start.addEventListener('click', () => {
    if (!engine.isRunning && shouldSpeak(soundMode()) && !engine.elapsedMs) speak('Begin.');
    engine.toggle();
  });
  els.reset.addEventListener('click', reload);
  drawerPreset.addEventListener('click', () => { els.dur.value = 15; els.bell.value = 5; reload(); });
  [els.dur, els.bell].forEach(el => el.addEventListener('change', reload));

  reload();

  return {
    destroy() {
      engine.destroy();
      timerMain.innerHTML = '';
      drawerInputGrid.innerHTML = '';
      drawerPreset.style.display = 'none';
    },
    onSoundModeChange() {}
  };
}
