import { clamp, beep, speak, shouldBeep, shouldSpeak, formatTime, vibrate, VIB } from '../engine.js';

export async function init({ timerMain, settingsPanel, soundMode, setWakeLock }) {
  const accent    = '#78a6ff';
  const accentDim = 'rgba(120,166,255,0.15)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

  timerMain.innerHTML = `
    <div class="timer-panel" style="gap:12px">
      <div class="phase-header">
        <div class="phase-eyebrow" style="color:${accent}">Chess Clock</div>
        <div class="phase-label" id="chessStatus">Player 1's Turn</div>
      </div>

      <div style="display:grid;gap:10px;">
        <!-- Player 1 -->
        <button id="p1Btn" class="chess-player-btn" style="
          min-height:100px; border-radius:12px; border:2px solid ${accent};
          background:var(--panel-2); color:var(--text);
          font-family:'Barlow Condensed',sans-serif; font-size:2.8rem;
          font-weight:900; display:grid; place-items:center; gap:4px;
          transition: background 150ms, border-color 150ms;">
          <span id="p1Name" style="font-size:0.8rem;color:var(--muted);font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Player 1</span>
          <span id="p1Time">10:00</span>
        </button>

        <!-- Player 2 -->
        <button id="p2Btn" class="chess-player-btn" style="
          min-height:100px; border-radius:12px; border:1px solid var(--line);
          background:var(--panel-2); color:var(--muted);
          font-family:'Barlow Condensed',sans-serif; font-size:2.8rem;
          font-weight:900; display:grid; place-items:center; gap:4px;
          transition: background 150ms, border-color 150ms; opacity:0.6">
          <span id="p2Name" style="font-size:0.8rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Player 2</span>
          <span id="p2Time">10:00</span>
        </button>
      </div>

      <div></div>
      <div class="controls">
        <button class="btn-primary" id="chessStartPause" type="button" style="background:${accent}">Start</button>
        <button class="btn-secondary" id="chessReset" type="button">Reset</button>
      </div>
    </div>`;

  settingsPanel.style.display = '';
  settingsPanel.innerHTML = `
    <div class="settings-header">
      <div class="settings-title">Settings</div>
      <button class="btn-preset" id="chessPreset">10 min</button>
    </div>
    <div class="input-grid">
      <label class="field-label"><span>Time per player (minutes)</span>
        <input class="field-input" id="chessMinutes" type="number" min="1" max="60" value="10" inputmode="numeric">
      </label>
      <label class="field-label"><span>Increment per move (seconds)</span>
        <input class="field-input" id="chessIncrement" type="number" min="0" max="30" value="0" inputmode="numeric">
      </label>
    </div>`;

  const els = {
    status: document.getElementById('chessStatus'),
    p1Btn:  document.getElementById('p1Btn'),
    p2Btn:  document.getElementById('p2Btn'),
    p1Time: document.getElementById('p1Time'),
    p2Time: document.getElementById('p2Time'),
    startPause: document.getElementById('chessStartPause'),
    reset:  document.getElementById('chessReset'),
    minutes: document.getElementById('chessMinutes'),
    increment: document.getElementById('chessIncrement'),
    preset: document.getElementById('chessPreset')
  };

  let isRunning=false, activePlayer=1, rafId=0;
  let p1Ms=0, p2Ms=0, lastTick=0;
  const INC = () => clamp(els.increment.value,0,30)*1000;

  function getInitialMs() { return Math.max(60, clamp(els.minutes.value,1,60))*60*1000; }

  function render() {
    els.p1Time.textContent = formatTime(p1Ms);
    els.p2Time.textContent = formatTime(p2Ms);

    const p1Active = isRunning && activePlayer===1;
    const p2Active = isRunning && activePlayer===2;

    els.p1Btn.style.borderColor = p1Active ? accent : 'var(--line)';
    els.p1Btn.style.background  = p1Active ? 'rgba(120,166,255,0.12)' : 'var(--panel-2)';
    els.p1Btn.style.color       = p1Active ? 'var(--text)' : 'var(--muted)';
    els.p1Btn.style.opacity     = p1Active ? '1' : '0.55';

    els.p2Btn.style.borderColor = p2Active ? accent : 'var(--line)';
    els.p2Btn.style.background  = p2Active ? 'rgba(120,166,255,0.12)' : 'var(--panel-2)';
    els.p2Btn.style.color       = p2Active ? 'var(--text)' : 'var(--muted)';
    els.p2Btn.style.opacity     = p2Active ? '1' : '0.55';

    if (!isRunning && p1Ms===getInitialMs() && p2Ms===getInitialMs()) {
      els.status.textContent = 'Tap a player button to start';
    } else if (!isRunning) {
      els.status.textContent = 'Paused';
    } else {
      els.status.textContent = `Player ${activePlayer}'s Turn`;
    }
    els.startPause.textContent = isRunning ? 'Pause' : 'Resume';
  }

  function tick(now) {
    const delta = now - lastTick;
    lastTick = now;
    if (activePlayer===1) p1Ms = Math.max(0, p1Ms-delta);
    else                   p2Ms = Math.max(0, p2Ms-delta);
    render();

    const out = activePlayer===1 ? p1Ms===0 : p2Ms===0;
    if (out) {
      isRunning = false;
      if (shouldBeep(soundMode())) beep(220, 0.5);
      if (shouldSpeak(soundMode())) speak(`Player ${activePlayer} is out of time!`);
      vibrate(VIB.done);
      els.status.textContent = `Player ${activePlayer} — Time's up!`;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function switchPlayer() {
    // Add increment to player who just moved
    if (activePlayer===1) { p1Ms += INC(); activePlayer=2; }
    else                   { p2Ms += INC(); activePlayer=1; }
    if (shouldBeep(soundMode())) beep(660, 0.06);
    vibrate(VIB.tick);
  }

  function startFrom(player) {
    isRunning   = true;
    activePlayer = player;
    lastTick    = performance.now();
    rafId       = requestAnimationFrame(tick);
    render();
  }

  els.p1Btn.addEventListener('click', () => {
    if (!isRunning) { p1Ms||=getInitialMs(); p2Ms||=getInitialMs(); startFrom(1); return; }
    if (activePlayer===1) { switchPlayer(); }
  });

  els.p2Btn.addEventListener('click', () => {
    if (!isRunning) { p1Ms||=getInitialMs(); p2Ms||=getInitialMs(); startFrom(2); return; }
    if (activePlayer===2) { switchPlayer(); }
  });

  els.startPause.addEventListener('click', () => {
    if (isRunning) { isRunning=false; cancelAnimationFrame(rafId); render(); }
    else if (p1Ms>0 && p2Ms>0) { lastTick=performance.now(); isRunning=true; rafId=requestAnimationFrame(tick); render(); }
  });

  els.reset.addEventListener('click', () => {
    isRunning=false; cancelAnimationFrame(rafId);
    p1Ms=getInitialMs(); p2Ms=getInitialMs(); activePlayer=1;
    els.startPause.textContent='Start';
    render();
  });

  els.preset.addEventListener('click', () => { els.minutes.value=10; els.increment.value=0; els.reset.click(); });
  [els.minutes, els.increment].forEach(el => el.addEventListener('change', () => els.reset.click()));

  p1Ms=getInitialMs(); p2Ms=getInitialMs();
  render();

  return {
    destroy() { cancelAnimationFrame(rafId); timerMain.innerHTML=''; settingsPanel.innerHTML=''; settingsPanel.style.display='none'; },
    onSoundModeChange() {}
  };
}
