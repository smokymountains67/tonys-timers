/**
 * Tony's Timers — Shared Timer UI Builder
 * Renders the standard ring/countdown panel and wires controls.
 * Each timer module calls buildTimerUI() then customizes as needed.
 */

import { TimerEngine, beep, speak, vibrate, formatTime, formatTimeLong,
         clamp, secondsFromInputs, setTimeInputs,
         shouldBeep, shouldSpeak, VIB } from '../engine.js';

export const RING_LENGTH = 339.292;

/**
 * config = {
 *   accent, accentDim,           // CSS color strings
 *   timerMain, settingsPanel,    // DOM containers
 *   soundMode,                   // () => current mode string
 *   setWakeLock,                 // (bool) => void
 *   buildSchedule,               // () => phase[]
 *   renderSettings,              // () => HTML string for settings panel
 *   onSettingsChange,            // () => void  (called when any input changes)
 *   phaseSounds,                 // { [type]: { freq, voice } }
 *   storageKey,                  // string
 *   defaultSettings,             // object
 *   loadSettings,                // (saved) => void
 *   readSettings,                // () => object
 *   presetLabel,                 // string
 *   onPreset,                    // () => void
 *   showPhaseStrip,              // bool (default true)
 *   showSettings,                // bool (default true)
 * }
 */
export function buildTimerUI(config) {
  const {
    accent, accentDim,
    timerMain, settingsPanel,
    soundMode, setWakeLock,
    buildSchedule,
    renderSettings,
    onSettingsChange,
    phaseSounds = {},
    storageKey,
    defaultSettings,
    loadSettings: userLoadSettings,
    readSettings: userReadSettings,
    presetLabel = 'Default',
    onPreset,
    showPhaseStrip = true,
    showSettings = true
  } = config;

  // Apply accent CSS vars
  timerMain.closest('.timer-shell')?.style.setProperty('--accent', accent);
  timerMain.closest('.timer-shell')?.style.setProperty('--accent-dim', accentDim);
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);

  // ── Render timer panel ──────────────────────────────────────────────────
  timerMain.innerHTML = `
    <div class="timer-panel">
      <div class="phase-header">
        <div class="phase-eyebrow" id="phaseEyebrow">Ready</div>
        <div class="phase-label" id="phaseLabel">—</div>
      </div>

      <div class="ring-wrap">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="54"/>
          <circle class="ring-fill" id="ringFill" cx="60" cy="60" r="54"/>
        </svg>
        <div class="ring-center">
          <div class="time-display" id="timeDisplay">--:--</div>
          <div class="round-label" id="roundLabel"></div>
          <div class="total-label" id="totalLabel"></div>
        </div>
      </div>

      ${showPhaseStrip ? `<div class="phase-strip" id="phaseStrip"></div>` : '<div></div>'}

      <div class="controls">
        <button class="btn-primary" id="startPauseBtn" type="button">Start</button>
        <button class="btn-secondary" id="resetBtn" type="button">Reset</button>
      </div>
    </div>
  `;

  // ── Render settings ─────────────────────────────────────────────────────
  if (showSettings && renderSettings) {
    settingsPanel.style.display = '';
    settingsPanel.innerHTML = `
      <div class="settings-header">
        <div class="settings-title">Settings</div>
        ${onPreset ? `<button class="btn-preset" id="presetBtn" type="button">${presetLabel}</button>` : ''}
      </div>
      <div class="input-grid" id="inputGrid">
        ${renderSettings()}
      </div>
    `;
  }

  // ── Element refs ─────────────────────────────────────────────────────────
  const els = {
    phaseEyebrow: document.getElementById('phaseEyebrow'),
    phaseLabel:   document.getElementById('phaseLabel'),
    ringFill:     document.getElementById('ringFill'),
    timeDisplay:  document.getElementById('timeDisplay'),
    roundLabel:   document.getElementById('roundLabel'),
    totalLabel:   document.getElementById('totalLabel'),
    phaseStrip:   document.getElementById('phaseStrip'),
    startPause:   document.getElementById('startPauseBtn'),
    reset:        document.getElementById('resetBtn'),
    preset:       document.getElementById('presetBtn')
  };

  // ── Storage ──────────────────────────────────────────────────────────────
  function saveToStorage() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(userReadSettings()));
    } catch { /* ignore */ }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) userLoadSettings(JSON.parse(raw));
    } catch {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  }

  // ── Engine setup ─────────────────────────────────────────────────────────
  const engine = new TimerEngine({
    onTick(state) { renderState(state); },
    onPhase(phase) {
      const sounds = phaseSounds[phase.type] || {};
      if (shouldBeep(soundMode())) beep(sounds.freq || 660);
      if (shouldSpeak(soundMode())) speak(sounds.voice || phase.label);
      vibrate(phase.type === 'work' ? VIB.work : VIB.rest);
    },
    onComplete() {
      if (shouldBeep(soundMode())) beep(440, 0.25);
      if (shouldSpeak(soundMode())) speak('Complete. Great work!');
      vibrate(VIB.done);
    },
    onWakeLock(active) { setWakeLock(active); }
  });

  // ── Render state ─────────────────────────────────────────────────────────
  function renderState(state) {
    const { phase, progress, remainingMs, totalRemainingMs,
            isRunning, hasStarted, isComplete,
            currentIndex, scheduleLength } = state;

    // Ring
    els.ringFill.style.strokeDashoffset = RING_LENGTH * (1 - progress);

    // Time
    els.timeDisplay.textContent = formatTime(remainingMs);

    // Phase labels
    if (isComplete) {
      els.phaseEyebrow.textContent = 'Done';
      els.phaseLabel.textContent   = 'Complete!';
      els.roundLabel.textContent   = 'Workout complete 🔥';
      els.totalLabel.textContent   = '';
    } else if (phase) {
      els.phaseEyebrow.textContent = phase.type.toUpperCase();
      els.phaseLabel.textContent   = phase.label;
      els.roundLabel.textContent   = phase.roundLabel || '';
      els.totalLabel.textContent   = totalRemainingMs > 0
        ? `${formatTime(totalRemainingMs)} total remaining`
        : '';
    }

    // Phase strip
    if (showPhaseStrip && els.phaseStrip) {
      const dots = els.phaseStrip.querySelectorAll('.phase-dot');
      dots.forEach((dot, i) => dot.classList.toggle('active', i <= currentIndex));
    }

    // Button
    els.startPause.textContent = isRunning ? 'Pause' : hasStarted ? 'Resume' : 'Start';
    els.startPause.style.opacity = '1';
  }

  // ── Phase strip ──────────────────────────────────────────────────────────
  function buildPhaseStrip(schedule) {
    if (!showPhaseStrip || !els.phaseStrip) return;
    els.phaseStrip.innerHTML = schedule
      .map(p => `<span class="phase-dot ${p.type}"></span>`)
      .join('');
  }

  // ── Load and start ────────────────────────────────────────────────────────
  function reload() {
    const schedule = buildSchedule();
    buildPhaseStrip(schedule);
    engine.load(schedule);
    saveToStorage();
  }

  loadFromStorage();
  reload();

  // ── Event listeners ───────────────────────────────────────────────────────
  els.startPause.addEventListener('click', () => engine.toggle());
  els.reset.addEventListener('click', () => reload());
  if (els.preset && onPreset) {
    els.preset.addEventListener('click', () => { onPreset(); reload(); });
  }

  // Settings inputs
  if (showSettings) {
    settingsPanel.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', () => {
        if (onSettingsChange) onSettingsChange(input);
        reload();
      });
    });
  }

  return {
    destroy() {
      engine.stop();
      timerMain.innerHTML = '';
      settingsPanel.innerHTML = '';
      settingsPanel.style.display = 'none';
    },
    onSoundModeChange() { /* soundMode() is reactive */ },
    reload
  };
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
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
