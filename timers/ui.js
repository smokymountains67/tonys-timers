/**
 * Tony's Timers — Shared Timer UI Builder v2
 * - Settings live in the gear drawer (no inline settings panel)
 * - Big round display readable from the rower
 * - Workout completion % progress bar
 */

import { TimerEngine, beep, speak, vibrate, formatTime,
         clamp, shouldBeep, shouldSpeak, VIB } from '../engine.js';

export const RING_LENGTH = 339.292;

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

  // Apply accent
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
      <div class="phase-header">
        <div class="phase-eyebrow" id="phaseEyebrow">Ready</div>
        <div class="phase-label"   id="phaseLabel">—</div>
      </div>

      <div class="ring-wrap">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="54"/>
          <circle class="ring-fill"  id="ringFill" cx="60" cy="60" r="54"/>
        </svg>
        <div class="ring-center">
          <div class="time-display"  id="timeDisplay">--:--</div>
          <div class="round-display" id="roundDisplay"></div>
          <div class="total-label"   id="totalLabel"></div>
        </div>
      </div>

      <div class="workout-progress" id="workoutProgress" style="display:none">
        <div class="progress-row">
          <span class="progress-pct"   id="progressPct">0%</span>
          <span class="progress-total" id="progressTotal"></span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" id="progressFill" style="width:0%"></div>
        </div>
      </div>

      ${showPhaseStrip ? `<div class="phase-strip" id="phaseStrip"></div>` : '<div></div>'}

      <div class="controls">
        <button class="btn-primary"   id="startPauseBtn" type="button">Start</button>
        <button class="btn-secondary" id="resetBtn"      type="button">Reset</button>
      </div>
    </div>`;

  // ── Element refs ───────────────────────────────────────────────────────────
  const els = {
    phaseEyebrow:   document.getElementById('phaseEyebrow'),
    phaseLabel:     document.getElementById('phaseLabel'),
    ringFill:       document.getElementById('ringFill'),
    timeDisplay:    document.getElementById('timeDisplay'),
    roundDisplay:   document.getElementById('roundDisplay'),
    totalLabel:     document.getElementById('totalLabel'),
    workoutProgress:document.getElementById('workoutProgress'),
    progressPct:    document.getElementById('progressPct'),
    progressTotal:  document.getElementById('progressTotal'),
    progressFill:   document.getElementById('progressFill'),
    phaseStrip:     document.getElementById('phaseStrip'),
    startPause:     document.getElementById('startPauseBtn'),
    reset:          document.getElementById('resetBtn'),
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

  // Total workout ms (computed once per schedule load)
  let totalWorkoutMs = 0;

  // ── Engine ─────────────────────────────────────────────────────────────────
  const engine = new TimerEngine({
    onTick(state)   { renderState(state); },
    onPhase(phase)  {
      const s = phaseSounds[phase.type] || {};
      if (shouldBeep(soundMode())) beep(s.freq || 660);
      if (shouldSpeak(soundMode())) speak(s.voice || phase.label);
      vibrate(phase.type === 'work' ? VIB.work : VIB.rest);
    },
    onComplete()    {
      if (shouldBeep(soundMode())) beep(440, 0.25);
      if (shouldSpeak(soundMode())) speak('Complete. Great work!');
      vibrate(VIB.done);
    },
    onWakeLock(active) { setWakeLock(active); }
  });

  // ── Render state ───────────────────────────────────────────────────────────
  function renderState(state) {
    const { phase, progress, remainingMs, totalRemainingMs,
            isRunning, hasStarted, isComplete,
            currentIndex, scheduleLength } = state;

    // Ring
    els.ringFill.style.strokeDashoffset = RING_LENGTH * (1 - progress);

    // Time
    els.timeDisplay.textContent = formatTime(remainingMs);

    if (isComplete) {
      els.phaseEyebrow.textContent = 'Done';
      els.phaseLabel.textContent   = 'Complete!';
      els.roundDisplay.textContent = '🔥 Workout Complete';
      els.totalLabel.textContent   = '';
      if (els.workoutProgress) {
        els.workoutProgress.style.display = '';
        els.progressPct.textContent  = '100%';
        els.progressFill.style.width = '100%';
        els.progressTotal.textContent = '';
      }
    } else if (phase) {
      els.phaseEyebrow.textContent = phase.type.toUpperCase();
      els.phaseLabel.textContent   = phase.label;

      // Big round display
      els.roundDisplay.textContent = phase.roundLabel || '';

      // Total remaining
      els.totalLabel.textContent = totalRemainingMs > 0
        ? formatTime(totalRemainingMs) + ' remaining'
        : '';

      // Progress bar
      if (totalWorkoutMs > 0) {
        const elapsed  = totalWorkoutMs - totalRemainingMs;
        const pct      = Math.min(100, Math.round((elapsed / totalWorkoutMs) * 100));
        els.workoutProgress.style.display = '';
        els.progressPct.textContent       = pct + '%';
        els.progressFill.style.width      = pct + '%';
        els.progressTotal.textContent     = formatTime(totalWorkoutMs) + ' total';
      }
    }

    // Phase strip
    if (showPhaseStrip && els.phaseStrip) {
      const dots = els.phaseStrip.querySelectorAll('.phase-dot');
      dots.forEach((dot, i) => dot.classList.toggle('active', i <= currentIndex));
    }

    // Button label
    els.startPause.textContent = isRunning ? 'Pause' : hasStarted ? 'Resume' : 'Start';
  }

  // ── Phase strip ────────────────────────────────────────────────────────────
  function buildPhaseStrip(schedule) {
    if (!showPhaseStrip || !els.phaseStrip) return;
    els.phaseStrip.innerHTML = schedule
      .map(p => `<span class="phase-dot ${p.type}"></span>`)
      .join('');
  }

  // ── Load schedule ──────────────────────────────────────────────────────────
  function reload() {
    const schedule   = buildSchedule();
    totalWorkoutMs   = schedule.reduce((s, p) => s + p.seconds * 1000, 0);
    buildPhaseStrip(schedule);
    engine.load(schedule);
    saveToStorage();
  }

  loadFromStorage();
  reload();

  // ── Controls ───────────────────────────────────────────────────────────────
  els.startPause.addEventListener('click', () => engine.toggle());
  els.reset.addEventListener('click', () => reload());

  // Preset button in drawer
  if (onPreset) {
    drawerPreset.addEventListener('click', () => {
      onPreset();
      reload();
    });
  }

  // Settings inputs in drawer
  drawerInputGrid.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', () => {
      if (onSettingsChange) onSettingsChange(input);
      reload();
    });
  });

  // Re-wire after drawer renders (drawer may have been repopulated)
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
