import { clamp, beep, speak, shouldBeep, shouldSpeak, formatTime, vibrate, VIB } from '../engine.js';

export async function init({ timerMain, drawerInputGrid, drawerTitle, drawerPreset, soundMode, setWakeLock }) {
  const accent    = '#78a6ff';
  const accentDim = 'rgba(120,166,255,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);
  drawerTitle.textContent = 'Chess Clock Settings';
  drawerPreset.style.display = '';
  drawerPreset.textContent = '10 min';

  timerMain.innerHTML = `
    <div class="timer-panel" style="gap:12px">
      <div class="phase-header">
        <div class="phase-eyebrow" style="color:${accent}">Chess Clock</div>
        <div class="phase-label" id="chessStatus">Tap a side to start</div>
      </div>
      <div style="display:grid;gap:10px;">
        <button id="p1Btn" class="chess-player-btn" style="
          min-height:100px; border-radius:12px; border:1px solid var(--line);
          background:var(--panel-2); color:var(--muted);
          font-family:'Barlow Condensed',sans-serif; font-size:2.8rem;
          font-weight:900; display:grid; place-items:center; gap:4px;
          transition:background 150ms,border-color 150ms,opacity 150ms; opacity:0.55">
          <span style="font-size:0.8rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Player 1</span>
          <span id="p1Time">10:00</span>
        </button>
        <button id="p2Btn" class="chess-player-btn" style="
          min-height:100px; border-radius:12px; border:1px solid var(--line);
          background:var(--panel-2); color:var(--muted);
          font-family:'Barlow Condensed',sans-serif; font-size:2.8rem;
          font-weight:900; display:grid; place-items:center; gap:4px;
          transition:background 150ms,border-color 150ms,opacity 150ms; opacity:0.55">
          <span style="font-size:0.8rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Player 2</span>
          <span id="p2Time">10:00</span>
        </button>
      </div>
      <div></div>
      <div class="controls">
        <button class="btn-primary" id="chessStartPause" type="button" style="background:${accent}">Start</button>
        <button class="btn-secondary" id="chessReset" type="button">Reset</button>
      </div>
    </div>`;

  drawerInputGrid.innerHTML = `
    <label class="field-label"><span>Time per player (minutes)</span>
      <input class="field-input" id="chessMinutes" type="number" min="1" max="60" value="10" inputmode="numeric">
    </label>
    <label class="field-label"><span>Increment per move (seconds)</span>
      <input class="field-input" id="chessIncrement" type="number" min="0" max="30" value="0" inputmode="numeric">
    </label>`;

  const els = {
    status:    document.getElementById('chessStatus'),
    p1Btn:     document.getElementById('p1Btn'),
    p2Btn:     document.getElementById('p2Btn'),
    p1Time:    document.getElementById('p1Time'),
    p2Time:    document.getElementById('p2Time'),
    startPause:document.getElementById('chessStartPause'),
    reset:     document.getElementById('chessReset'),
    minutes:   document.getElementById('chessMinutes'),
    increment: document.getElementById('chessIncrement')
  };

  // ── Absolute-time state: banked ms per player + turn start timestamp ──────
  let banked    = { 1: 0, 2: 0 };
  let active    = 1;
  let running   = false;
  let turnStart = 0;        // Date.now() when active player's turn began
  let started   = false;    // has the game begun at all
  let intervalId = 0, rafId = 0;
  let wakeLock  = null;

  const initialMs = () => Math.max(60, clamp(els.minutes.value, 1, 60)) * 60000;
  const incMs     = () => clamp(els.increment.value, 0, 30) * 1000;

  function remaining(p) {
    if (running && p === active) return Math.max(0, banked[p] - (Date.now() - turnStart));
    return Math.max(0, banked[p]);
  }

  async function requestWL() {
    if (!('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); setWakeLock(true); } catch {}
  }
  function releaseWL() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    setWakeLock(false);
  }

  function render() {
    const r1 = remaining(1), r2 = remaining(2);
    els.p1Time.textContent = formatTime(r1);
    els.p2Time.textContent = formatTime(r2);

    const style = (btn, isActive) => {
      btn.style.borderColor = isActive ? accent : 'var(--line)';
      btn.style.background  = isActive ? 'rgba(120,166,255,0.12)' : 'var(--panel-2)';
      btn.style.color       = isActive ? 'var(--text)' : 'var(--muted)';
      btn.style.opacity     = isActive ? '1' : '0.55';
    };
    style(els.p1Btn, running && active === 1);
    style(els.p2Btn, running && active === 2);

    els.status.textContent = !started ? 'Tap a side to start'
      : running ? `Player ${active}'s turn` : 'Paused';
    els.startPause.textContent = running ? 'Pause' : started ? 'Resume' : 'Start';
  }

  function checkTimeout() {
    if (!running) return;
    if (remaining(active) <= 0) {
      banked[active] = 0;
      running = false;
      stopLoops();
      releaseWL();
      if (shouldBeep(soundMode())) beep(220, 0.5);
      if (shouldSpeak(soundMode())) speak(`Player ${active} is out of time!`);
      vibrate(VIB.done);
      render();
      els.status.textContent = `Player ${active} — Time's up!`;
    }
  }

  function loop() {
    render();
    checkTimeout();
    if (running) rafId = requestAnimationFrame(loop);
  }

  function startLoops() {
    stopLoops();
    intervalId = setInterval(() => { render(); checkTimeout(); }, 100);
    rafId = requestAnimationFrame(loop);
  }
  function stopLoops() {
    clearInterval(intervalId);
    cancelAnimationFrame(rafId);
  }

  const onVis = () => { if (document.visibilityState === 'visible') { render(); checkTimeout(); } };
  document.addEventListener('visibilitychange', onVis);

  function startTurn(p) {
    active    = p;
    turnStart = Date.now();
    running   = true;
    started   = true;
    startLoops();
    requestWL();
    render();
  }

  function tapSide(p) {
    if (!started) {
      banked = { 1: initialMs(), 2: initialMs() };
      // Tapping YOUR side starts the OTHER player's clock in real chess,
      // but starting the tapped side is simpler/expected here:
      startTurn(p);
      return;
    }
    if (running && p === active) {
      // Bank remaining + increment, hand over
      banked[active] = remaining(active) + incMs();
      startTurn(active === 1 ? 2 : 1);
      if (shouldBeep(soundMode())) beep(660, 0.06);
      vibrate(VIB.tick);
    }
  }

  els.p1Btn.addEventListener('click', () => tapSide(1));
  els.p2Btn.addEventListener('click', () => tapSide(2));

  els.startPause.addEventListener('click', () => {
    if (running) {
      banked[active] = remaining(active);
      running = false;
      stopLoops();
      releaseWL();
      render();
    } else if (started && banked[1] > 0 && banked[2] > 0) {
      startTurn(active);
    } else if (!started) {
      banked = { 1: initialMs(), 2: initialMs() };
      startTurn(1);
    }
  });

  function reset() {
    running = false; started = false;
    stopLoops(); releaseWL();
    banked = { 1: initialMs(), 2: initialMs() };
    active = 1;
    render();
  }

  els.reset.addEventListener('click', reset);
  drawerPreset.addEventListener('click', () => { els.minutes.value = 10; els.increment.value = 0; reset(); });
  [els.minutes, els.increment].forEach(el => el.addEventListener('change', reset));

  reset();

  return {
    destroy() {
      stopLoops();
      releaseWL();
      document.removeEventListener('visibilitychange', onVis);
      timerMain.innerHTML = '';
      drawerInputGrid.innerHTML = '';
      drawerPreset.style.display = 'none';
    },
    onSoundModeChange() {}
  };
}
