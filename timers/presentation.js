import { TimerEngine, clamp, beep, speak, shouldBeep, shouldSpeak,
         formatTime, vibrate, VIB } from '../engine.js';

const RING_LENGTH = 339.292;

export async function init({ timerMain, drawerInputGrid, drawerTitle, drawerPreset, soundMode, setWakeLock }) {
  const accent    = '#64748b';
  const accentDim = 'rgba(100,116,139,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);
  drawerTitle.textContent = 'Presentation Settings';
  drawerPreset.style.display = '';
  drawerPreset.textContent = '5 slides';

  timerMain.innerHTML = `
    <div class="timer-panel">
      <div class="phase-header">
        <div class="phase-eyebrow" style="color:${accent}">Presentation</div>
        <div class="phase-label" id="presLabel">Ready</div>
      </div>
      <div class="ring-wrap">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="54"/>
          <circle class="ring-fill" id="presRing" cx="60" cy="60" r="54" style="stroke:${accent}"/>
        </svg>
        <div class="ring-center">
          <div class="time-display" id="presTime">--:--</div>
          <div class="info-key" id="presStatus" style="margin-top:4px"></div>
        </div>
      </div>
      <div class="phase-strip" id="presStrip"></div>
      <div class="controls">
        <button class="btn-primary" id="presStart" type="button" style="background:${accent}">Start</button>
        <button class="btn-secondary" id="presNext" type="button">Next →</button>
        <button class="btn-secondary" id="presReset" type="button" style="min-width:70px">Reset</button>
      </div>
    </div>`;

  drawerInputGrid.innerHTML = `
    <label class="field-label"><span>Number of slides</span>
      <input class="field-input" id="presSlides" type="number" min="1" max="50" value="5" inputmode="numeric">
    </label>
    <label class="field-label"><span>Minutes per slide</span>
      <input class="field-input" id="presPerSlide" type="number" min="1" max="30" value="3" inputmode="numeric">
    </label>
    <label class="field-label"><span>Warning at (seconds left)</span>
      <input class="field-input" id="presWarn" type="number" min="10" max="120" value="30" inputmode="numeric">
    </label>`;

  const els = {
    label:    document.getElementById('presLabel'),
    ring:     document.getElementById('presRing'),
    time:     document.getElementById('presTime'),
    status:   document.getElementById('presStatus'),
    strip:    document.getElementById('presStrip'),
    start:    document.getElementById('presStart'),
    next:     document.getElementById('presNext'),
    reset:    document.getElementById('presReset'),
    slides:   document.getElementById('presSlides'),
    perSlide: document.getElementById('presPerSlide'),
    warn:     document.getElementById('presWarn')
  };

  const warned = new Set();

  const engine = new TimerEngine({
    onTick(state) {
      const warnMs = clamp(els.warn.value, 10, 120) * 1000;
      const warn   = !state.isComplete && state.remainingMs <= warnMs && state.remainingMs > 0;

      els.ring.style.stroke = warn ? '#ff5a4f' : accent;
      els.ring.style.strokeDashoffset = RING_LENGTH * (1 - state.progress);
      els.time.textContent = formatTime(state.remainingMs);

      if (state.isComplete) {
        els.label.textContent  = 'Done';
        els.status.textContent = 'Presentation complete';
      } else {
        els.label.textContent  = `Slide ${state.currentIndex + 1}`;
        els.status.textContent = warn ? '⚠️ Wrap up!'
          : `${state.currentIndex + 1} of ${state.scheduleLength}`;
      }

      els.start.textContent = state.isRunning ? 'Pause'
        : state.hasStarted && !state.isComplete ? 'Resume' : 'Start';

      // One-time warning per slide
      if (warn && !warned.has(state.currentIndex)) {
        warned.add(state.currentIndex);
        if (shouldBeep(soundMode())) beep(440, 0.15);
        vibrate([80, 40, 80]);
      }

      // Strip
      const dots = els.strip.querySelectorAll('.phase-dot');
      dots.forEach((d, i) => d.classList.toggle('active', i <= state.currentIndex));
    },
    onPhase(phase, leaving) {
      if (shouldBeep(soundMode())) beep(660, 0.1);
      if (shouldSpeak(soundMode())) speak(phase.label);
    },
    onComplete() {
      if (shouldSpeak(soundMode())) speak('Presentation complete.');
      vibrate(VIB.done);
    },
    onWakeLock(active) { setWakeLock(active); }
  });

  function buildStrip(n) {
    els.strip.innerHTML = Array.from({ length: n },
      () => `<span class="phase-dot" style="--dot-color:${accent}"></span>`).join('');
  }

  function reload() {
    warned.clear();
    const n   = clamp(els.slides.value, 1, 50);
    const per = clamp(els.perSlide.value, 1, 30) * 60;
    const schedule = Array.from({ length: n }, (_, i) =>
      ({ type: 'work', label: `Slide ${i + 1}`, seconds: per }));
    buildStrip(n);
    engine.load(schedule);
  }

  els.start.addEventListener('click', () => engine.toggle());
  els.next.addEventListener('click', () => {
    if (!engine.schedule.length) return;
    const next = engine.lastIndex + 1;
    if (shouldBeep(soundMode())) beep(660, 0.1);
    engine.seekToIndex(next);
    if (next < engine.schedule.length && shouldSpeak(soundMode())) speak(`Slide ${next + 1}`);
  });
  els.reset.addEventListener('click', reload);
  drawerPreset.addEventListener('click', () => {
    els.slides.value = 5; els.perSlide.value = 3; els.warn.value = 30; reload();
  });
  [els.slides, els.perSlide, els.warn].forEach(el => el.addEventListener('change', reload));

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
