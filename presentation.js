import { clamp, beep, speak, shouldBeep, shouldSpeak, formatTime, vibrate, VIB } from '../engine.js';

const RING_LENGTH = 339.292;

export async function init({ timerMain, settingsPanel, soundMode, setWakeLock }) {
  const accent    = '#64748b';
  const accentDim = 'rgba(100,116,139,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

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
          <div class="round-label" id="presStatus"></div>
          <div class="total-label" id="presSlide"></div>
        </div>
      </div>
      <div class="phase-strip" id="presStrip"></div>
      <div class="controls">
        <button class="btn-primary" id="presStart" type="button" style="background:${accent}">Start</button>
        <button class="btn-secondary" id="presNext" type="button">Next →</button>
        <button class="btn-secondary" id="presReset" type="button" style="min-width:70px">Reset</button>
      </div>
    </div>`;

  settingsPanel.style.display = '';
  settingsPanel.innerHTML = `
    <div class="settings-header">
      <div class="settings-title">Settings</div>
      <button class="btn-preset" id="presPreset">5 slides</button>
    </div>
    <div class="input-grid">
      <label class="field-label"><span>Number of slides</span>
        <input class="field-input" id="presSlides" type="number" min="1" max="50" value="5" inputmode="numeric">
      </label>
      <label class="field-label"><span>Minutes per slide</span>
        <input class="field-input" id="presPerSlide" type="number" min="1" max="30" value="3" inputmode="numeric">
      </label>
      <label class="field-label"><span>Warning at (seconds left)</span>
        <input class="field-input" id="presWarn" type="number" min="10" max="120" value="30" inputmode="numeric">
      </label>
    </div>`;

  const els = {
    label:     document.getElementById('presLabel'),
    ring:      document.getElementById('presRing'),
    time:      document.getElementById('presTime'),
    status:    document.getElementById('presStatus'),
    slide:     document.getElementById('presSlide'),
    strip:     document.getElementById('presStrip'),
    start:     document.getElementById('presStart'),
    next:      document.getElementById('presNext'),
    reset:     document.getElementById('presReset'),
    slides:    document.getElementById('presSlides'),
    perSlide:  document.getElementById('presPerSlide'),
    warn:      document.getElementById('presWarn'),
    preset:    document.getElementById('presPreset')
  };

  let isRunning=false, currentSlide=0, totalSlides=5;
  let startedAt=0, pausedAt=0, slideDurMs=0, rafId=0;
  let warnFired=false, warned=false;

  function getSlides()   { return clamp(els.slides.value,1,50)||5; }
  function getSlideDur() { return clamp(els.perSlide.value,1,30)*60*1000; }
  function getWarnMs()   { return clamp(els.warn.value,10,120)*1000; }

  function buildStrip() {
    totalSlides = getSlides();
    els.strip.innerHTML = Array.from({length:totalSlides},
      (_,i) => `<span class="phase-dot work" id="dot${i}"></span>`
    ).join('');
  }

  function updateStrip() {
    for (let i=0;i<totalSlides;i++) {
      const dot = document.getElementById(`dot${i}`);
      if (dot) dot.classList.toggle('active', i<=currentSlide);
    }
  }

  function render(remainingMs) {
    const progress = slideDurMs>0 ? remainingMs/slideDurMs : 1;
    const warn = remainingMs <= getWarnMs() && remainingMs > 0;

    els.ring.style.stroke = warn ? '#ff5a4f' : accent;
    els.ring.style.strokeDashoffset = RING_LENGTH*(1-progress);
    els.time.textContent  = formatTime(remainingMs);
    els.label.textContent = `Slide ${currentSlide+1}`;
    els.status.textContent = warn ? '⚠️ Wrap up!' : isRunning ? 'Speaking...' : 'Paused';
    els.slide.textContent  = `${currentSlide+1} of ${totalSlides}`;
    els.start.textContent  = isRunning ? 'Pause' : remainingMs<slideDurMs ? 'Resume' : 'Start';
    updateStrip();
  }

  function tick(now) {
    const elapsed     = now - startedAt;
    const remainingMs = Math.max(0, slideDurMs - elapsed);
    render(remainingMs);

    // Warning
    if (!warnFired && remainingMs <= getWarnMs() && remainingMs > 0) {
      warnFired = true;
      if (shouldBeep(soundMode())) beep(440, 0.15);
      vibrate([80,40,80]);
    }

    if (remainingMs <= 0) {
      // Auto advance or end
      if (shouldBeep(soundMode())) beep(880, 0.12);
      advanceSlide();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function advanceSlide(manual=false) {
    if (currentSlide >= totalSlides-1) {
      isRunning=false;
      if (shouldSpeak(soundMode())) speak('Presentation complete.');
      vibrate(VIB.done);
      render(0);
      return;
    }
    currentSlide++;
    warnFired=false;
    startedAt=performance.now();
    pausedAt=0;
    if (!manual && isRunning) {
      if (shouldBeep(soundMode())) beep(660, 0.1);
      if (shouldSpeak(soundMode())) speak(`Slide ${currentSlide+1}`);
      rafId = requestAnimationFrame(tick);
    } else {
      isRunning=false;
      render(slideDurMs);
    }
  }

  function start() {
    slideDurMs = getSlideDur();
    isRunning  = true;
    warnFired  = false;
    const elapsed = pausedAt>0 ? pausedAt : 0;
    startedAt  = performance.now()-elapsed;
    pausedAt   = 0;
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    isRunning=false; cancelAnimationFrame(rafId);
    pausedAt = performance.now()-startedAt;
    render(Math.max(0,slideDurMs-pausedAt));
  }

  function reset() {
    isRunning=false; cancelAnimationFrame(rafId);
    currentSlide=0; pausedAt=0; startedAt=0; warnFired=false;
    slideDurMs=getSlideDur();
    buildStrip();
    render(slideDurMs);
  }

  els.start.addEventListener('click', () => { if(isRunning) pause(); else start(); });
  els.next.addEventListener('click',  () => { cancelAnimationFrame(rafId); advanceSlide(true); if(isRunning) start(); });
  els.reset.addEventListener('click', reset);
  els.preset.addEventListener('click', () => { els.slides.value=5; els.perSlide.value=3; els.warn.value=30; reset(); });
  [els.slides, els.perSlide, els.warn].forEach(el => el.addEventListener('change', reset));

  reset();

  return {
    destroy() { cancelAnimationFrame(rafId); timerMain.innerHTML=''; settingsPanel.innerHTML=''; settingsPanel.style.display='none'; },
    onSoundModeChange() {}
  };
}
