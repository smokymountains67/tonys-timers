import { TimerEngine, clamp, beep, speak, shouldBeep, shouldSpeak,
         formatTime, vibrate, VIB } from '../engine.js';

let nextId = 1;

export async function init({ timerMain, drawerInputGrid, drawerTitle, drawerPreset, soundMode, setWakeLock }) {
  const accent    = '#f59e0b';
  const accentDim = 'rgba(245,158,11,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);
  drawerTitle.textContent = 'Cooking Timers';
  drawerPreset.style.display = 'none';
  drawerInputGrid.innerHTML = `<p style="color:var(--muted);font-size:0.85rem">
    Add, name, and run as many timers as you need — they all run independently.</p>`;

  timerMain.innerHTML = `
    <div class="timer-panel" style="grid-template-rows:auto 1fr auto;min-height:0">
      <div class="phase-header">
        <div class="phase-eyebrow" style="color:${accent}">Cooking Timers</div>
        <div class="phase-label">Kitchen</div>
      </div>
      <div id="cookTimerList" style="display:grid;gap:10px;align-content:start;overflow-y:auto;max-height:52svh;padding:2px 0"></div>
      <div class="controls" style="margin-top:4px">
        <button class="btn-primary" id="addTimerBtn" type="button" style="background:${accent};color:#1a0e00">+ Add Timer</button>
      </div>
    </div>`;

  const list   = document.getElementById('cookTimerList');
  const addBtn = document.getElementById('addTimerBtn');

  const timers  = new Map();   // id => { name, engine, el }
  const runningSet = new Set();

  function updateWakeDot() { setWakeLock(runningSet.size > 0); }

  function addTimer(name = '', minutes = 5, seconds = 0) {
    const id   = nextId++;
    const secs = Math.max(1, clamp(minutes, 0, 99) * 60 + clamp(seconds, 0, 59));
    const t    = { id, name: name || `Timer ${id}`, secs };

    const engine = new TimerEngine({
      onTick(state) { renderRow(t, state); },
      onComplete() {
        runningSet.delete(id); updateWakeDot();
        if (shouldBeep(soundMode())) {
          beep(880, 0.2); setTimeout(() => beep(660, 0.2), 250); setTimeout(() => beep(880, 0.3), 500);
        }
        if (shouldSpeak(soundMode())) speak(`${t.name} is done!`);
        vibrate(VIB.done);
      },
      onWakeLock() { /* aggregated via runningSet */ }
    });
    t.engine = engine;
    timers.set(id, t);

    const el = document.createElement('div');
    el.id = `cook-${id}`;
    el.style.cssText = `
      background:var(--panel-2); border:1px solid var(--line); border-radius:10px;
      padding:12px; display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center;`;
    el.innerHTML = `
      <div>
        <input class="cook-name" value="${t.name}" placeholder="Timer name" style="
          background:transparent; border:none; color:var(--text); font-weight:700;
          font-size:0.85rem; letter-spacing:0.04em; text-transform:uppercase;
          width:100%; padding:0; outline:none;">
        <div style="display:grid;grid-template-columns:auto auto auto auto;align-items:center;gap:6px;margin-top:6px">
          <input class="field-input cook-min" type="number" min="0" max="99" value="${minutes}"
            style="min-height:36px;font-size:1rem;width:60px" inputmode="numeric">
          <span class="time-sep">m</span>
          <input class="field-input cook-sec" type="number" min="0" max="59" value="${seconds}"
            style="min-height:36px;font-size:1rem;width:60px" inputmode="numeric">
          <span class="time-sep">s</span>
        </div>
      </div>
      <div style="display:grid;gap:6px;justify-items:center">
        <div class="cook-display" style="
          font-family:'Barlow Condensed',sans-serif; font-size:2rem; font-weight:900;
          color:var(--text); font-variant-numeric:tabular-nums; min-width:80px; text-align:center;">
          ${formatTime(secs * 1000)}
        </div>
        <div style="display:flex;gap:6px">
          <button class="cook-start btn-secondary" style="min-height:34px;min-width:60px;font-size:0.85rem;padding:0 10px">Start</button>
          <button class="cook-reset btn-secondary" style="min-height:34px;min-width:40px;font-size:0.85rem;padding:0 8px">↺</button>
          <button class="cook-delete btn-secondary" style="min-height:34px;min-width:34px;font-size:0.85rem;padding:0 8px;color:#ff5a4f;border-color:#ff5a4f22">✕</button>
        </div>
      </div>`;
    list.appendChild(el);
    t.el = el;

    const reload = () => {
      const m = clamp(el.querySelector('.cook-min').value, 0, 99);
      const s = clamp(el.querySelector('.cook-sec').value, 0, 59);
      t.secs = Math.max(1, m * 60 + s);
      runningSet.delete(id); updateWakeDot();
      engine.load([{ type: 'cook', label: t.name, seconds: t.secs }]);
    };

    el.querySelector('.cook-name').addEventListener('change', e => {
      t.name = e.target.value || `Timer ${id}`;
    });
    el.querySelector('.cook-min').addEventListener('change', reload);
    el.querySelector('.cook-sec').addEventListener('change', reload);

    el.querySelector('.cook-start').addEventListener('click', () => {
      engine.toggle();
      if (engine.isRunning) runningSet.add(id); else runningSet.delete(id);
      updateWakeDot();
    });
    el.querySelector('.cook-reset').addEventListener('click', reload);
    el.querySelector('.cook-delete').addEventListener('click', () => {
      engine.destroy();
      runningSet.delete(id); updateWakeDot();
      timers.delete(id);
      el.remove();
    });

    engine.load([{ type: 'cook', label: t.name, seconds: t.secs }]);
  }

  function renderRow(t, state) {
    const disp = t.el?.querySelector('.cook-display');
    const btn  = t.el?.querySelector('.cook-start');
    if (!disp || !btn) return;
    disp.textContent = formatTime(state.remainingMs);
    disp.style.color = state.isRunning ? accent : state.isComplete ? '#28c98b' : 'var(--text)';
    btn.textContent  = state.isRunning ? 'Pause'
      : state.hasStarted && !state.isComplete ? 'Resume' : 'Start';
    if (state.isComplete || !state.isRunning) {
      runningSet.delete(t.id); updateWakeDot();
    }
  }

  addBtn.addEventListener('click', () => addTimer('', 5, 0));

  addTimer('Pasta', 8, 0);
  addTimer('Sauce', 15, 0);

  return {
    destroy() {
      timers.forEach(t => t.engine.destroy());
      timers.clear();
      runningSet.clear();
      setWakeLock(false);
      timerMain.innerHTML = '';
      drawerInputGrid.innerHTML = '';
    },
    onSoundModeChange() {}
  };
}
