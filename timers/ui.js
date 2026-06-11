/**
 * Tony's Timers — Shared Timer UI Builder v4 (visual pass)
 * - Stopwatch-bezel ring with tick marks + glow (ringMarkup shared export)
 * - Phase pulse animation on transitions
 * - Completion celebration overlay with workout summary
 */

import { TimerEngine, beep, speak, vibrate, formatTime,
         clamp, shouldBeep, shouldSpeak, VIB, logSession } from '../engine.js';

export const RING_LENGTH = 339.292;

const PHASE_COLORS = {
  prep: '#f4c84a',
  work: '#ff5a4f',
  rest: '#28c98b',
  done: '#78a6ff'
};

// ── Shared ring markup with stopwatch tick bezel ──────────────────────────────
function ringTicks() {
  let out = '';
  for (let i = 0; i < 60; i++) {
    const a     = i * 6 * Math.PI / 180;
    const major = i % 5 === 0;
    const r1    = major ? 44 : 46.5;
    const r2    = 49;
    const x1 = (60 + r1 * Math.sin(a)).toFixed(2);
    const y1 = (60 - r1 * Math.cos(a)).toFixed(2);
    const x2 = (60 + r2 * Math.sin(a)).toFixed(2);
    const y2 = (60 - r2 * Math.cos(a)).toFixed(2);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ring-tick${major ? ' major' : ''}"/>`;
  }
  return out;
}

export function ringMarkup(fillId, color = '') {
  const style = color
    ? ` style="stroke:${color};filter:drop-shadow(0 0 6px ${color}66)"`
    : '';
  return `
    <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
      ${ringTicks()}
      <circle class="ring-track" cx="60" cy="60" r="54"/>
      <circle class="ring-fill" id="${fillId}" cx="60" cy="60" r="54"${style}/>
    </svg>`;
}

// ── Completion overlay ─────────────────────────────────────────────────────────
function buildCompleteOverlay() {
  const el = document.createElement('div');
  el.className = 'complete-overlay';
  el.innerHTML = `
    <div class="complete-flash"></div>
    <div class="complete-card">
      <div class="complete-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>
      </div>
      <div class="complete-title">Complete!</div>
      <div class="complete-stats">
        <div><span class="c-time">--:--</span><label>Total Time</label></div>
        <div><span class="c-rounds">—</span><label>Rounds</label></div>
      </div>
      <button class="complete-done-btn" type="button">Done</button>
    </div>`;
  document.body.appendChild(el);
  return el;
}

export function buildTimerUI(config) {
  const {
    accent, accentDim,
    timerId = 'timer',
    timerMain,
    drawerInputGrid, drawerTitle, drawerPreset,
    soundMode, setWakeLock,
    buildSchedule,
    renderSettings,
    onSettingsChange,
    phaseSounds = {},
    storageKey,
    timerName = 'Timer',
    presetLabel,
    onPreset,
    showPhaseStrip = true,
  } = config;

  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

  // ── Drawer ─────────────────────────────────────────────────────────────────
  drawerTitle.textContent = timerName + ' Settings';

  if (onPreset && presetLabel) {
    drawerPreset.style.display = '';
    drawerPreset.textContent   = presetLabel;
  } else {
    drawerPreset.style.display = 'none';
  }

  const PRESETS_KEY = `tonys-presets-${timerId}`;

  drawerInputGrid.innerHTML = (renderSettings ? renderSettings() : '') + `
    <div class="preset-section">
      <div class="preset-title">My Presets</div>
      <div class="preset-list"></div>
      <div class="preset-save-row">
        <input class="field-input preset-name" placeholder="Preset name" maxlength="24">
        <button class="btn-preset preset-save" type="button">Save</button>
      </div>
    </div>`;

  const presetList = drawerInputGrid.querySelector('.preset-list');
  const presetName = drawerInputGrid.querySelector('.preset-name');
  const presetSave = drawerInputGrid.querySelector('.preset-save');

  function getPresets() {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; }
    catch { return []; }
  }

  function setPresets(list) {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch {}
  }

  function renderPresetList() {
    const presets = getPresets();
    presetList.innerHTML = presets.length === 0
      ? `<div class="preset-empty">None saved yet — set up your timer, then save it here.</div>`
      : presets.map((p, i) => `
          <div class="preset-row">
            <span class="p-name">${p.name}</span>
            <button class="btn-preset p-load" data-i="${i}" type="button">Load</button>
            <button class="p-del" data-i="${i}" type="button" aria-label="Delete preset">✕</button>
          </div>`).join('');
  }

  presetSave.addEventListener('click', () => {
    const presets = getPresets();
    const name = presetName.value.trim() || `Preset ${presets.length + 1}`;
    presets.push({ name, settings: config.readSettings() });
    while (presets.length > 10) presets.shift();
    setPresets(presets);
    presetName.value = '';
    renderPresetList();
  });

  presetList.addEventListener('click', (e) => {
    const load = e.target.closest('.p-load');
    const del  = e.target.closest('.p-del');
    if (load) {
      const p = getPresets()[Number(load.dataset.i)];
      if (p && config.loadSettings) {
        config.loadSettings(p.settings);
        reload();
      }
    } else if (del) {
      const presets = getPresets();
      presets.splice(Number(del.dataset.i), 1);
      setPresets(presets);
      renderPresetList();
    }
  });

  renderPresetList();

  // ── Timer panel ────────────────────────────────────────────────────────────
  timerMain.innerHTML = `
    <div class="timer-panel">
      <div class="phase-header">
        <div class="phase-eyebrow" id="phaseEyebrow">Ready</div>
        <div class="phase-label"   id="phaseLabel">—</div>
      </div>

      <div class="ring-wrap" id="ringWrap">
        ${ringMarkup('ringFill')}
        <div class="ring-center">
          <div class="time-display" id="timeDisplay">--:--</div>
        </div>
      </div>

      ${showPhaseStrip ? `<div class="phase-strip" id="phaseStrip"></div>` : '<div></div>'}

      <div class="controls">
        <button class="btn-primary"   id="startPauseBtn" type="button">Start</button>
        <button class="btn-secondary" id="resetBtn"      type="button">Reset</button>
      </div>

      <div class="info-blocks" id="infoBlocks" style="display:none">
        <div class="info-block">
          <div class="info-value" id="roundDisplay">—</div>
          <div class="info-key">Round</div>
        </div>
        <div class="info-block">
          <div class="info-pct" id="progressPct">0%</div>
          <div class="info-key">Complete</div>
          <div class="progress-track" style="margin-top:6px">
            <div class="progress-fill" id="progressFill" style="width:0%"></div>
          </div>
        </div>
        <div class="info-block">
          <div class="info-value" id="totalLabel">—</div>
          <div class="info-key">Remaining</div>
        </div>
      </div>
    </div>`;

  const overlay = buildCompleteOverlay();

  const els = {
    phaseEyebrow: document.getElementById('phaseEyebrow'),
    phaseLabel:   document.getElementById('phaseLabel'),
    ringWrap:     document.getElementById('ringWrap'),
    ringFill:     document.getElementById('ringFill'),
    timeDisplay:  document.getElementById('timeDisplay'),
    phaseStrip:   document.getElementById('phaseStrip'),
    startPause:   document.getElementById('startPauseBtn'),
    reset:        document.getElementById('resetBtn'),
    infoBlocks:   document.getElementById('infoBlocks'),
    roundDisplay: document.getElementById('roundDisplay'),
    progressPct:  document.getElementById('progressPct'),
    progressFill: document.getElementById('progressFill'),
    totalLabel:   document.getElementById('totalLabel'),
    cTime:        overlay.querySelector('.c-time'),
    cRounds:      overlay.querySelector('.c-rounds'),
    cDone:        overlay.querySelector('.complete-done-btn'),
  };

  // ── Storage ────────────────────────────────────────────────────────────────
  function saveToStorage() {
    try { localStorage.setItem(storageKey, JSON.stringify(config.readSettings())); } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && config.loadSettings) config.loadSettings(JSON.parse(raw));
    } catch {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }

  let totalWorkoutMs = 0;
  let workRounds     = 0;

  // ── Engine ─────────────────────────────────────────────────────────────────
  const engine = new TimerEngine({
    onTick(state)  { renderState(state); },
    onPhase(phase) {
      const s = phaseSounds[phase.type] || {};
      if (shouldBeep(soundMode())) beep(s.freq || 660);
      if (shouldSpeak(soundMode())) speak(s.voice || phase.label);
      vibrate(phase.type === 'work' ? VIB.work : VIB.rest);
      // Pulse the ring on every phase change
      els.ringWrap.classList.remove('pulse');
      void els.ringWrap.offsetWidth;
      els.ringWrap.classList.add('pulse');
    },
    onComplete() {
      if (shouldBeep(soundMode())) beep(440, 0.25);
      if (shouldSpeak(soundMode())) speak('Complete. Great work!');
      vibrate(VIB.done);
      logSession(timerId, timerName, totalWorkoutMs);
      // Celebration
      els.cTime.textContent   = formatTime(totalWorkoutMs);
      els.cRounds.textContent = workRounds || engine.schedule.length;
      overlay.classList.add('show');
    },
    onWakeLock(active) { setWakeLock(active); }
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderState(state) {
    const { phase, progress, remainingMs, totalRemainingMs,
            isRunning, hasStarted, isComplete, currentIndex } = state;

    const phaseType  = isComplete ? 'done' : (phase?.type || 'prep');
    const phaseColor = PHASE_COLORS[phaseType] || accent;

    els.ringFill.style.stroke = phaseColor;
    els.ringFill.style.filter = `drop-shadow(0 0 6px ${phaseColor}66)`;
    els.ringFill.style.strokeDashoffset = RING_LENGTH * (1 - progress);

    els.timeDisplay.textContent = formatTime(remainingMs);
    els.timeDisplay.style.color = phaseColor;

    if (isComplete) {
      els.phaseEyebrow.textContent = 'Done';
      els.phaseEyebrow.style.color = phaseColor;
      els.phaseLabel.textContent   = 'Complete!';
    } else if (phase) {
      els.phaseEyebrow.textContent = phase.type.toUpperCase();
      els.phaseEyebrow.style.color = phaseColor;
      els.phaseLabel.textContent   = phase.label;
    }

    if (showPhaseStrip && els.phaseStrip) {
      const dots = els.phaseStrip.querySelectorAll('.phase-dot');
      dots.forEach((dot, i) => dot.classList.toggle('active', i <= currentIndex));
    }

    if (totalWorkoutMs > 0 || isComplete) {
      els.infoBlocks.style.display = '';
      els.roundDisplay.textContent = isComplete ? 'Done' : (phase?.roundLabel || '—');

      const elapsed = Math.max(0, totalWorkoutMs - totalRemainingMs);
      const pct     = isComplete ? 100 : Math.min(99, Math.round((elapsed / totalWorkoutMs) * 100));
      els.progressPct.textContent       = pct + '%';
      els.progressPct.style.color       = phaseColor;
      els.progressFill.style.width      = pct + '%';
      els.progressFill.style.background = phaseColor;

      els.totalLabel.textContent = isComplete ? '0:00' : formatTime(totalRemainingMs);
    }

    els.startPause.textContent      = isRunning ? 'Pause' : hasStarted ? 'Resume' : 'Start';
    els.startPause.style.background = phaseColor;
    els.startPause.style.color      = phaseType === 'prep' ? '#1a1400' :
                                      phaseType === 'rest' ? '#071a10' :
                                      phaseType === 'done' ? '#05102a' : '#fff';
  }

  function buildPhaseStrip(schedule) {
    if (!showPhaseStrip || !els.phaseStrip) return;
    els.phaseStrip.innerHTML = schedule.map(p => {
      const col = PHASE_COLORS[p.type] || accent;
      return `<span class="phase-dot ${p.type}" style="--dot-color:${col}"></span>`;
    }).join('');
  }

  function reload() {
    overlay.classList.remove('show');
    const schedule = buildSchedule();
    totalWorkoutMs = schedule.reduce((s, p) => s + p.seconds * 1000, 0);
    workRounds     = schedule.filter(p => p.type === 'work').length;
    buildPhaseStrip(schedule);
    engine.load(schedule);
    saveToStorage();
  }

  loadFromStorage();
  reload();

  // ── Events ─────────────────────────────────────────────────────────────────
  els.startPause.addEventListener('click', () => engine.toggle());
  els.reset.addEventListener('click',     () => reload());
  els.cDone.addEventListener('click',     () => overlay.classList.remove('show'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('complete-flash')) {
      overlay.classList.remove('show');
    }
  });

  if (onPreset) {
    drawerPreset.addEventListener('click', () => { onPreset(); reload(); });
  }

  drawerInputGrid.querySelectorAll('input, select').forEach(input => {
    if (input.closest('.preset-section')) return;
    input.addEventListener('change', () => {
      if (onSettingsChange) onSettingsChange(input);
      reload();
    });
  });

  const observer = new MutationObserver(() => {
    drawerInputGrid.querySelectorAll('input, select').forEach(input => {
      if (input.closest('.preset-section')) return;
      if (!input.dataset.wired) {
        input.dataset.wired = '1';
        input.addEventListener('change', () => {
          if (onSettingsChange) onSettingsChange(input);
          reload();
        });
      }
    });
  });
  observer.observe(drawerInputGrid, { childList: true, subtree: true });

  return {
    destroy() {
      engine.destroy();
      observer.disconnect();
      overlay.remove();
      timerMain.innerHTML        = '';
      drawerInputGrid.innerHTML  = '';
      drawerPreset.style.display = 'none';
    },
    onSoundModeChange() {},
    reload
  };
}

// ── HTML field helpers ─────────────────────────────────────────────────────────
export function timeField(id, label, defaultMin = 0, defaultSec = 0) {
  return `
    <label class="field-label">
      <span>${label}</span>
      <div class="time-input-row">
        <input class="field-input" id="${id}Min" type="number" min="0" max="59"
               inputmode="numeric" value="${defaultMin}" aria-label="${label} minutes">
        <span class="time-sep">m</span>
        <input class="field-input" id="${id}Sec" type="number" min="0" max="59"
               inputmode="numeric" value="${defaultSec}" aria-label="${label} seconds">
        <span class="time-sep">s</span>
      </div>
    </label>`;
}

export function numberField(id, label, value, min = 1, max = 99) {
  return `
    <label class="field-label">
      <span>${label}</span>
      <input class="field-input" id="${id}" type="number"
             min="${min}" max="${max}" inputmode="numeric" value="${value}">
    </label>`;
}

export function selectField(id, label, options, selected) {
  const opts = options.map(([v, l]) =>
    `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`
  ).join('');
  return `
    <label class="field-label">
      <span>${label}</span>
      <select class="field-input" id="${id}">${opts}</select>
    </label>`;
}
