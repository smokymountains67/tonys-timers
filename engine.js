/**
 * Tony's Timers — Shared Timer Engine
 * All timers use this core. Each timer feeds it a schedule config.
 */

export class TimerEngine {
  constructor(callbacks = {}) {
    this.schedule        = [];
    this.currentIndex    = 0;
    this.phaseStartedAt  = 0;
    this.remainingMs     = 0;
    this.durationMs      = 0;
    this.totalRemainingMs = 0;
    this.rafId           = 0;
    this.isRunning       = false;
    this.wakeLock        = null;

    // Callbacks the timer UI hooks into
    this.onTick      = callbacks.onTick      || (() => {});
    this.onPhase     = callbacks.onPhase     || (() => {});
    this.onComplete  = callbacks.onComplete  || (() => {});
    this.onWakeLock  = callbacks.onWakeLock  || (() => {});
  }

  // ── Load a schedule ────────────────────────────────────────────────────────
  // schedule: array of { type, label, seconds, round? }
  load(schedule) {
    this.stop();
    this.schedule         = schedule;
    this.currentIndex     = 0;
    this.durationMs       = (schedule[0]?.seconds ?? 0) * 1000;
    this.remainingMs      = this.durationMs;
    this.totalRemainingMs = schedule.reduce((s, p) => s + p.seconds * 1000, 0);
    this.onTick(this._state());
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  start() {
    if (!this.schedule.length) return;
    if (this.remainingMs <= 0) {
      this.currentIndex     = 0;
      this.durationMs       = (this.schedule[0]?.seconds ?? 0) * 1000;
      this.remainingMs      = this.durationMs;
      this.totalRemainingMs = this.schedule.reduce((s, p) => s + p.seconds * 1000, 0);
    }
    this.isRunning     = true;
    this.phaseStartedAt = performance.now() - (this.durationMs - this.remainingMs);
    this.rafId = requestAnimationFrame((t) => this._tick(t));
    this._requestWakeLock();
    this.onTick(this._state());
  }

  pause() {
    this.isRunning = false;
    cancelAnimationFrame(this.rafId);
    this._releaseWakeLock();
    this.onTick(this._state());
  }

  stop() {
    this.pause();
    if (this.schedule.length) {
      this.currentIndex     = 0;
      this.durationMs       = (this.schedule[0]?.seconds ?? 0) * 1000;
      this.remainingMs      = this.durationMs;
      this.totalRemainingMs = this.schedule.reduce((s, p) => s + p.seconds * 1000, 0);
    }
    this.onTick(this._state());
  }

  toggle() {
    if (this.isRunning) this.pause();
    else this.start();
  }

  // ── Internal tick ──────────────────────────────────────────────────────────
  _tick(now) {
    const prev           = this.remainingMs;
    this.remainingMs     = Math.max(0, this.durationMs - (now - this.phaseStartedAt));
    this.totalRemainingMs = Math.max(0, this.totalRemainingMs - (prev - this.remainingMs));
    this.onTick(this._state());

    if (this.remainingMs <= 0) {
      this._advance();
      return;
    }
    this.rafId = requestAnimationFrame((t) => this._tick(t));
  }

  _advance() {
    const leaving = this.schedule[this.currentIndex];
    this.currentIndex += 1;

    if (this.currentIndex >= this.schedule.length) {
      this.isRunning        = false;
      this.remainingMs      = 0;
      this.totalRemainingMs = 0;
      this._releaseWakeLock();
      this.onComplete(leaving);
      this.onTick(this._state());
      return;
    }

    const phase         = this.schedule[this.currentIndex];
    this.durationMs     = phase.seconds * 1000;
    this.remainingMs    = this.durationMs;
    this.phaseStartedAt = performance.now();
    this.onPhase(phase, leaving);
    this.onTick(this._state());
    this.rafId = requestAnimationFrame((t) => this._tick(t));
  }

  // ── State snapshot for UI ──────────────────────────────────────────────────
  _state() {
    const phase      = this.schedule[this.currentIndex] ?? null;
    const progress   = this.durationMs > 0 ? this.remainingMs / this.durationMs : 0;
    const hasStarted = this.remainingMs > 0 && this.remainingMs < this.durationMs;
    const isComplete = !this.isRunning && this.remainingMs === 0 && this.currentIndex >= this.schedule.length - 1 && this.schedule.length > 0;

    return {
      phase,
      currentIndex:     this.currentIndex,
      scheduleLength:   this.schedule.length,
      remainingMs:      this.remainingMs,
      totalRemainingMs: this.totalRemainingMs,
      durationMs:       this.durationMs,
      progress,
      isRunning:        this.isRunning,
      hasStarted,
      isComplete
    };
  }

  // ── Wake Lock ──────────────────────────────────────────────────────────────
  async _requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.onWakeLock(true);
      this.wakeLock.addEventListener("release", () => {
        this.wakeLock = null;
        this.onWakeLock(false);
        // Re-acquire if still running (e.g. screen briefly off)
        if (this.isRunning) this._requestWakeLock();
      });
    } catch { /* denied */ }
  }

  async _releaseWakeLock() {
    if (this.wakeLock) {
      try { await this.wakeLock.release(); } catch { /* ignore */ }
      this.wakeLock = null;
    }
    this.onWakeLock(false);
  }
}

// ── Shared audio ───────────────────────────────────────────────────────────────
let _audioCtx;
function getAudioCtx() {
  _audioCtx ||= new AudioContext();
  return _audioCtx;
}

export function beep(frequency = 660, length = 0.12, volume = 0.22) {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + length + 0.02);
  } catch { /* audio unavailable */ }
}

export function speak(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utt  = new SpeechSynthesisUtterance(text);
    utt.rate   = 1.1;
    utt.pitch  = 1.0;
    utt.volume = 1.0;
    window.speechSynthesis.speak(utt);
  } catch { /* unavailable */ }
}

export function vibrate(pattern) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch { /* unavailable */ }
}

// ── Shared utilities ───────────────────────────────────────────────────────────
export function formatTime(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatTimeLong(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

export function clamp(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export function secondsFromInputs(minEl, secEl) {
  return clamp(minEl.value, 0, 59) * 60 + clamp(secEl.value, 0, 59);
}

export function setTimeInputs(minEl, secEl, totalSeconds) {
  minEl.value = Math.floor(totalSeconds / 60);
  secEl.value = totalSeconds % 60;
}

// ── Sound mode ─────────────────────────────────────────────────────────────────
export const SOUND_MODES  = ["all-on", "beep-only", "voice-only", "silent"];
export const SOUND_LABELS = { "all-on": "All", "beep-only": "Beep", "voice-only": "Voice", "silent": "Off" };
export const SOUND_ICONS  = { "all-on": "♪", "beep-only": "🔔", "voice-only": "💬", "silent": "🔇" };

export function shouldBeep(mode)  { return mode === "all-on" || mode === "beep-only"; }
export function shouldSpeak(mode) { return mode === "all-on" || mode === "voice-only"; }

// ── Vibration patterns ─────────────────────────────────────────────────────────
export const VIB = {
  start:  [50],
  work:   [80, 40, 80, 40, 200],
  rest:   [60, 30, 60],
  done:   [100, 50, 100, 50, 100, 50, 400],
  pause:  [40],
  bell:   [30, 20, 30],
  tick:   [10]
};
