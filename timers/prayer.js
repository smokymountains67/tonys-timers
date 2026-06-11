import { TimerEngine, clamp, beep, speak, shouldBeep, shouldSpeak,
         formatTime, vibrate, VIB } from '../engine.js';

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
  const accentDim = 'rgba(212,165,23,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);
  drawerTitle.textContent = 'Prayer Settings';
  drawerPreset.style.display = '';
  drawerPreset.textContent = '10 min';

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
          <div class="info-key" id="prayStatus" style="margin-top:4px">Ready</div>
        </div>
      </div>
      <div id="prayIntention" style="
        text-align:center; color:var(--muted); font-style:italic;
        font-size:0.85rem; line-height:1.6; padding:0 8px;
      "></div>
      <div class="controls">
        <button class="btn-primary" id="prayStart" type="button" style="background:${accent};color:#1a1000">Begin</button>
        <button class="btn-secondary" id="prayReset" type="button">Reset</button>
      </div>
    </div>`;

  drawerInputGrid.innerHTML = `
    <label class="field-label"><span>Duration (minutes)</span>
      <input class="field-input" id="prayDur" type="number" min="1" max="60" value="10" inputmode="numeric">
    </label>
    <label class="field-label"><span>Gentle bell every (minutes, 0 = off)</span>
      <input class="field-input" id="prayBell" type="number" min="0" max="15" value="5" inputmode="numeric">
    </label>`;

  const els = {
    ring:      document.getElementById('prayRing'),
    time:      document.getElementById('prayTime'),
    status:    document.getElementById('prayStatus'),
    intention: document.getElementById('prayIntention'),
    start:     document.getElementById('prayStart'),
    reset:     document.getElementById('prayReset'),
    dur:       document.getElementById('prayDur'),
    bell:      document.getElementById('prayBell')
  };

  let lastBell = 0;

  function softBell() {
    if (shouldBeep(soundMode())) {
      beep(432, 1.2, 0.1);
      setTimeout(() => beep(528, 1.0, 0.08), 500);
    }
    vibrate(VIB.bell);
  }

  const engine = new TimerEngine({
    onTick(state) {
      els.ring.style.strokeDashoffset = RING_LENGTH * (1 - state.progress);
      els.time.textContent = formatTime(state.remainingMs);
      els.status.textContent = state.isComplete ? 'Amen'
        : state.isRunning ? 'Praying...'
        : state.hasStarted ? 'Paused' : 'Ready';
      els.start.textContent = state.isRunning ? 'Pause'
        : state.hasStarted && !state.isComplete ? 'Resume' : 'Begin';

      const intervalMs = clamp(els.bell.value, 0, 15) * 60000;
      if (intervalMs > 0 && state.isRunning) {
        const elapsed = state.durationMs - state.remainingMs;
        const count   = Math.floor(elapsed / intervalMs);
        if (count > lastBell) { lastBell = count; softBell(); }
      }
    },
    onComplete() {
      softBell();
      if (shouldSpeak(soundMode())) speak('Amen. Prayer time complete.');
      vibrate(VIB.done);
    },
    onWakeLock(active) { setWakeLock(active); }
  });

  function rotateIntention() {
    els.intention.textContent = INTENTIONS[Math.floor(Math.random() * INTENTIONS.length)];
  }

  function reload() {
    lastBell = 0;
    rotateIntention();
    const secs = Math.max(60, clamp(els.dur.value, 1, 60) * 60);
    engine.load([{ type: 'pray', label: 'Be Still', seconds: secs }]);
  }

  els.start.addEventListener('click', () => {
    if (!engine.isRunning && shouldSpeak(soundMode()) && !engine.elapsedMs) speak('Begin your prayer.');
    engine.toggle();
  });
  els.reset.addEventListener('click', reload);
  drawerPreset.addEventListener('click', () => { els.dur.value = 10; els.bell.value = 5; reload(); });
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
