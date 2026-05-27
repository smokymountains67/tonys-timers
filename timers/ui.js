/**
 * Tony's Timers — Shared Timer UI Builder v3
 * - Phase-specific ring/dot colors (prep=yellow, work=red, rest=green, done=blue)
 * - Round + total time as info blocks BELOW the controls
 * - Big % complete below the buttons
 * - Clean ring center — just the countdown time
 */

import { TimerEngine, beep, speak, vibrate, formatTime,
         clamp, shouldBeep, shouldSpeak, VIB } from '../engine.js';

export const RING_LENGTH = 339.292;

// Phase color map
const PHASE_COLORS = {
  prep: '#f4c84a',
  work: '#ff5a4f',
  rest: '#28c98b',
  done: '#78a6ff'
};

export function buildTimerUI(config) {
  const {
    accent, accentDim,
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

  // Apply default accent for home screen glow
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

  // ── Populate drawer ────────────────────────────────────────────────────────
  drawerTitle.textContent = timerName + ' Settings';

  if (onPreset && presetLabel) {
    drawerPreset.style.display = '';
    drawerPreset.textContent   = presetLabel;
  } else {
    drawerPreset.style.display = 'none';
  }

  drawerInputGrid.innerHTML = renderSettings ? renderSettings() : '';

  // ── Render timer panel ─────────────────────────────────────────────────────
  timerMain.innerHTML = `
    <div class="timer-panel">

      <!-- Phase label at top -->
      <div class="phase-header">
        <div class="phase-eyebrow" id="phaseEyebrow">Ready</div>
        <div class="phase-label"   id="phaseLabel">—</div>
      </div>

      <!-- Ring — just the time inside, nothing else -->
      <div class="ring-wrap">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="54"/>
          <circle class="ring-fill"  id="ringFill" cx="60" cy="60" r="54"/>
        </svg>
        <div class="ring-center">
          <div class="time-display" id="timeDisplay">--:--</div>
        </div>
      </div>

      <!-- Phase dots strip -->
      ${showPhaseStrip ? `<div class="phase-strip" id="phaseStrip"></div>` : '<div></div>'}

      <!-- Controls -->
      <div class="controls">
        <button class="btn-primary"   id="startPauseBtn" type="button">Start</button>
        <button class="btn-secondary" id="resetBtn"      type="button">Reset</button>
      </div>

      <!-- Info blocks below controls -->
      <div class="info-blocks" id="infoBlocks" style="display:none">
        <div class="info-block">
          <div class="info-value" id="roundDisplay">—</div>
          <div class="info-key">Round</div>
        </div>
        <div class="info-block info-block-center">
          <div class="info-pct" id="progressPct">0%</div>
          <div class="info-key">Complete</div>
          <div class="progress-track" style="margin-top:6px">
            <div class="progress-fill" id="progressFill" style="width:0%"></div>
          </div>
        </div>
        <div class="info-block info-block-right">
          <div class="info-value" id="totalLabel">—</div>
          <div class="info-key">Remaining</div>
        </div>
      </div>

    </div>`;

  // ── Element refs ───────────────────────────────────────────────────────────
  const els = {
    phaseEyebrow: document.getElementById('phaseEyebrow'),
    phaseLabel:   document.getElementById('phaseLabel'),
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

  // ── Engine ─────────────────────────────────────────────────────────────────
  const engine = new TimerEngine({
    onTick(state)  { renderState(state); },
    onPhase(phase) {
      const s = phaseSounds[phase.type] || {};
      if (shouldBeep(soundMode())) beep(s.freq || 660);
      if (shouldSpeak(soundMode())) speak(s.voice || phase.label);
      vibrate(phase.type === 'work' ? VIB.work : VIB.rest);
    },
    onComplete() {
      if (shouldBeep(soundMode())) beep(440, 0.25);
      if (shouldSpeak(soundMode())) speak('Complete. Great work!');
      vibrate(VIB.done);
    },
    onWakeLock(active) { setWakeLock(active); }
  });

  // ── Render state ───────────────────────────────────────────────────────────
  function renderState(state) {
    const { phase, progress, remainingMs, totalRemainingMs,
            isRunning, hasStarted, isComplete, currentIndex } = state;

    // ── Phase color ──────────────────────────────────────────────────────────
    const phaseType  = isComplete ? 'done' : (phase?.type || 'prep');
    const phaseColor = PHASE_COLORS[phaseType] || accent;

    // Ring color + progress
    els.ringFill.style.stroke = phaseColor;
    els.ringFill.style.strokeDashoffset = RING_LENGTH * (1 - progress);

    // Time
    els.timeDisplay.textContent = formatTime(remainingMs);
    els.timeDisplay.style.color = phaseColor;

    // Phase labels
    if (isComplete) {
      els.phaseEyebrow.textContent = 'Done';
      els.phaseEyebrow.style.color = phaseColor;
      els.phaseLabel.textContent   = 'Complete!';
    } else if (phase) {
      els.phaseEyebrow.textContent = phase.type.toUpperCase();
      els.phaseEyebrow.style.color = phaseColor;
      els.phaseLabel.textContent   = phase.label;
    }

    // Phase strip dots — each keeps its own type color
    if (showPhaseStrip && els.phaseStrip) {
      const dots = els.phaseStrip.querySelectorAll('.phase-dot');
      dots.forEach((dot, i) => dot.classList.toggle('active', i <= currentIndex));
    }

    // Info blocks below controls
    if (totalWorkoutMs > 0 || isComplete) {
      els.infoBlocks.style.display = '';

      // Round
      els.roundDisplay.textContent = isComplete
        ? '🔥 Done'
        : (phase?.roundLabel || '—');

      // Progress %
      const elapsed = Math.max(0, totalWorkoutMs - totalRemainingMs);
      const pct     = isComplete ? 100 : Math.min(99, Math.round((elapsed / totalWorkoutMs) * 100));
      els.progressPct.textContent       = pct + '%';
      els.progressFill.style.width      = pct + '%';
      els.progressFill.style.background = phaseColor;

      // Time remaining
      els.totalLabel.textContent = isComplete
        ? '0:00'
        : formatTime(totalRemainingMs);
    }

    // Button
    els.startPause.textContent          = isRunning ? 'Pause' : hasStarted ? 'Resume' : 'Start';
    els.startPause.style.background     = phaseColor;
    els.startPause.style.color          = phaseType === 'prep' ? '#1a1400' :
                                          phaseType === 'rest' ? '#071a10' :
                                          phaseType === 'done' ? '#05102a' : '#fff';
  }

  // ── Phase strip ────────────────────────────────────────────────────────────
  function buildPhaseStrip(schedule) {
    if (!showPhaseStrip || !els.phaseStrip) return;
    els.phaseStrip.innerHTML = schedule.map(p => {
      const col = PHASE_COLORS[p.type] || accent;
      return `<span class="phase-dot ${p.type}" style="--dot-color:${col}"></span>`;
    }).join('');
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  function reload() {
    const schedule = buildSchedule();
    totalWorkoutMs = schedule.reduce((s, p) => s + p.seconds * 1000, 0);
    buildPhaseStrip(schedule);
    engine.load(schedule);
    saveToStorage();
  }

  loadFromStorage();
  reload();

  // ── Event wiring ───────────────────────────────────────────────────────────
  els.startPause.addEventListener('click', () => engine.toggle());
  els.reset.addEventListener('click',     () => reload());

  if (onPreset) {
    drawerPreset.addEventListener('click', () => { onPreset(); reload(); });
  }

  drawerInputGrid.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', () => {
      if (onSettingsChange) onSettingsChange(input);
      reload();
    });
  });

  const observer = new MutationObserver(() => {
    drawerInputGrid.querySelectorAll('input, select').forEach(input => {
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
      engine.stop();
      observer.disconnect();
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
