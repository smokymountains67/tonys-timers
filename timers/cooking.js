import { clamp, beep, speak, shouldBeep, shouldSpeak, formatTime, vibrate, VIB } from '../engine.js';

let nextId = 1;

export async function init({ timerMain, settingsPanel, soundMode, setWakeLock }) {
  const accent    = '#f59e0b';
  const accentDim = 'rgba(245,158,11,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

  timerMain.innerHTML = `
    <div class="timer-panel" style="grid-template-rows:auto 1fr auto;min-height:0">
      <div class="phase-header">
        <div class="phase-eyebrow" style="color:${accent}">Cooking Timers</div>
        <div class="phase-label">Kitchen</div>
      </div>
      <div id="cookTimerList" style="display:grid;gap:10px;align-content:start;overflow-y:auto;max-height:48svh;padding:2px 0"></div>
      <div class="controls" style="margin-top:4px">
        <button class="btn-primary" id="addTimerBtn" type="button" style="background:${accent};color:#1a0e00">+ Add Timer</button>
      </div>
    </div>`;

  settingsPanel.style.display = 'none';

  const list = document.getElementById('cookTimerList');
  const addBtn = document.getElementById('addTimerBtn');

  const timers = new Map(); // id => { name, totalMs, remainingMs, startedAt, isRunning, rafId }

  function addTimer(name='', minutes=5, seconds=0) {
    const id   = nextId++;
    const totalMs = Math.max(1000, (clamp(minutes,0,99)*60 + clamp(seconds,0,59))*1000);
    const timer = { id, name: name||`Timer ${id}`, totalMs, remainingMs: totalMs, startedAt:0, isRunning:false, rafId:0 };
    timers.set(id, timer);
    renderTimer(timer);
  }

  function renderTimer(timer) {
    const existing = document.getElementById(`cook-${timer.id}`);
    const el = existing || document.createElement('div');
    el.id = `cook-${timer.id}`;
    el.style.cssText = `
      background:var(--panel-2); border:1px solid var(--line); border-radius:10px;
      padding:12px; display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center;`;
    el.innerHTML = `
      <div>
        <input class="cook-name" value="${timer.name}" style="
          background:transparent; border:none; color:var(--text); font-weight:700;
          font-size:0.85rem; letter-spacing:0.04em; text-transform:uppercase;
          width:100%; padding:0; outline:none; cursor:text;" placeholder="Timer name">
        <div style="display:grid;grid-template-columns:auto auto auto auto auto;align-items:center;gap:6px;margin-top:6px">
          <input class="field-input cook-min" type="number" min="0" max="99"
            value="${Math.floor(timer.totalMs/60000)}" style="min-height:36px;font-size:1rem;width:60px"
            inputmode="numeric" ${timer.isRunning?'disabled':''}>
          <span class="time-sep">m</span>
          <input class="field-input cook-sec" type="number" min="0" max="59"
            value="${Math.floor((timer.totalMs%60000)/1000)}" style="min-height:36px;font-size:1rem;width:60px"
            inputmode="numeric" ${timer.isRunning?'disabled':''}>
          <span class="time-sep">s</span>
        </div>
      </div>
      <div style="display:grid;gap:6px;justify-items:center">
        <div class="cook-display" style="
          font-family:'Barlow Condensed',sans-serif; font-size:2rem; font-weight:900;
          color:${timer.isRunning ? accent : 'var(--text)'};
          font-variant-numeric:tabular-nums; min-width:80px; text-align:center;">
          ${formatTime(timer.remainingMs)}
        </div>
        <div style="display:flex;gap:6px">
          <button class="cook-start btn-secondary" style="min-height:34px;min-width:60px;font-size:0.85rem;padding:0 10px">
            ${timer.isRunning ? 'Pause' : timer.remainingMs < timer.totalMs ? 'Resume' : 'Start'}
          </button>
          <button class="cook-reset btn-secondary" style="min-height:34px;min-width:40px;font-size:0.85rem;padding:0 8px">↺</button>
          <button class="cook-delete btn-secondary" style="min-height:34px;min-width:34px;font-size:0.85rem;padding:0 8px;color:#ff5a4f;border-color:#ff5a4f22">✕</button>
        </div>
      </div>`;

    if (!existing) list.appendChild(el);

    // Wire events
    el.querySelector('.cook-name').addEventListener('change', e => { timer.name = e.target.value||`Timer ${timer.id}`; });

    const updateDur = () => {
      const m = clamp(el.querySelector('.cook-min').value,0,99);
      const s = clamp(el.querySelector('.cook-sec').value,0,59);
      timer.totalMs    = Math.max(1000,(m*60+s)*1000);
      timer.remainingMs = timer.totalMs;
      el.querySelector('.cook-display').textContent = formatTime(timer.remainingMs);
    };
    el.querySelector('.cook-min').addEventListener('change', updateDur);
    el.querySelector('.cook-sec').addEventListener('change', updateDur);

    el.querySelector('.cook-start').addEventListener('click', () => {
      if (timer.isRunning) pauseTimer(timer);
      else startTimer(timer);
      renderTimer(timer);
    });

    el.querySelector('.cook-reset').addEventListener('click', () => {
      resetTimer(timer);
      renderTimer(timer);
    });

    el.querySelector('.cook-delete').addEventListener('click', () => {
      cancelAnimationFrame(timer.rafId);
      timers.delete(timer.id);
      el.remove();
    });
  }

  function startTimer(timer) {
    timer.isRunning  = true;
    timer.startedAt  = performance.now() - (timer.totalMs - timer.remainingMs);
    function tick(now) {
      timer.remainingMs = Math.max(0, timer.totalMs - (now - timer.startedAt));
      const disp = document.querySelector(`#cook-${timer.id} .cook-display`);
      if (disp) disp.textContent = formatTime(timer.remainingMs);
      if (timer.remainingMs <= 0) {
        timer.isRunning = false;
        if (shouldBeep(soundMode())) { beep(880,0.2); setTimeout(()=>beep(660,0.2),250); setTimeout(()=>beep(880,0.3),500); }
        if (shouldSpeak(soundMode())) speak(`${timer.name} is done!`);
        vibrate(VIB.done);
        renderTimer(timer);
        return;
      }
      timer.rafId = requestAnimationFrame(tick);
    }
    timer.rafId = requestAnimationFrame(tick);
  }

  function pauseTimer(timer) {
    timer.isRunning = false;
    cancelAnimationFrame(timer.rafId);
  }

  function resetTimer(timer) {
    timer.isRunning   = false;
    timer.remainingMs = timer.totalMs;
    cancelAnimationFrame(timer.rafId);
  }

  addBtn.addEventListener('click', () => { addTimer('',5,0); });

  // Start with 2 timers
  addTimer('Pasta', 8, 0);
  addTimer('Sauce', 15, 0);

  return {
    destroy() {
      timers.forEach(t => cancelAnimationFrame(t.rafId));
      timerMain.innerHTML=''; settingsPanel.innerHTML=''; settingsPanel.style.display='none';
    },
    onSoundModeChange() {}
  };
}
