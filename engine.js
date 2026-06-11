/**
 * Tony's Timers — Shared Timer Engine v3
 *
 * v3: Absolute-timeline architecture.
 *  - Anchored to wall-clock time (Date.now()) instead of frame deltas.
 *  - Survives backgrounding, screen-off, app switches: on return it lands
 *    on exactly the right phase with exactly the right time remaining.
 *  - Hybrid ticking: setInterval heartbeat (correctness, runs while
 *    throttled) + requestAnimationFrame (smooth ring while visible).
 *  - AudioContext explicitly resumed (Android suspends it aggressively).
 *
 * Public API is unchanged from v2 — no other file needs to change.
 */

export class TimerEngine {
  constructor(callbacks = {}) {
    this.schedule   = [];
    this.boundaries = [];   // cumulative start offset (ms) of each phase
    this.totalMs    = 0;

    this.elapsedMs  = 0;    // accumulated elapsed when paused
    this.anchorTime = 0;    // Date.now() anchor while running
    this.isRunning  = false;

    this.lastIndex  = 0;    // last phase index we announced
    this.rafId      = 0;
    this.intervalId = 0;
    this.wakeLock   = null;

    this.onTick     = callbacks.onTick     || (() => {});
    this.onPhase    = callbacks.onPhase    || (() => {});
    this.onComplete = callbacks.onComplete || (() => {});
    this.onWakeLock = callbacks.onWakeLock || (() => {});

    // Re-sync instantly when the app returns to the foreground
    this._onVisibility = () => {
      if (document.visibilityState === 'visible' && this.isRunning) {
        this._sync();
        if (!this.wakeLock) this._requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  // ── Load a schedule ──────────────────────────────────────────────────────
  // schedule: array of { type, label, seconds, roundLabel? }
  load(schedule) {
    this.stop();
    this.schedule   = schedule;
    this.boundaries = [];
    let acc = 0;
    for (const p of schedule) {
      this.boundaries.push(acc);
      acc += p.seconds * 1000;
    }
    this.totalMs   = acc;
    this.elapsedMs = 0;
    this.lastIndex = 0;
    this.onTick(this._state());
  }

  // ── Playback ─────────────────────────────────────────────────────────────
  start() {
    if (!this.schedule.length) return;
    if (this.elapsedMs >= this.totalMs) {
      // Restart from the top
      this.elapsedMs = 0;
      this.lastIndex = 0;
    }
    this.isRunning  = true;
    this.anchorTime = Date.now() - this.elapsedMs;
    this._startLoops();
    this._requestWakeLock();
    this._sync();
  }

  pause() {
    if (this.isRunning) {
      this.elapsedMs = Math.min(this.totalMs, Date.now() - this.anchorTime);
    }
    this.isRunning = false;
    this._stopLoops();
    this._releaseWakeLock();
    this.onTick(this._state());
  }

  stop() {
    this.isRunning = false;
    this._stopLoops();
    this._releaseWakeLock();
    this.elapsedMs = 0;
    this.lastIndex = 0;
    if (this.schedule.length) this.onTick(this._state());
  }

  toggle() {
    if (this.isRunning) this.pause();
    else this.start();
  }

  // Jump to the start of a given phase index (index === schedule.length → complete)
  seekToIndex(i) {
    if (!this.schedule.length) return;
    i = Math.max(0, Math.min(i, this.schedule.length));
    const target = i >= this.schedule.length ? this.totalMs : this.boundaries[i];
    this.lastIndex = Math.min(i, this.schedule.length - 1);
    if (this.isRunning) {
      this.anchorTime = Date.now() - target;
      this._sync();
    } else {
      this.elapsedMs = target;
      this.onTick(this._state());
    }
  }

  // Full teardown — call when leaving a timer screen
  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  // ── Internal: tick loops ─────────────────────────────────────────────────
  _startLoops() {
    this._stopLoops();
    // Heartbeat: keeps phase logic honest even when rAF is throttled
    this.intervalId = setInterval(() => this._sync(), 200);
    // Smooth animation while visible
    const raf = () => {
      if (!this.isRunning) return;
      this._sync();
      this.rafId = requestAnimationFrame(raf);
    };
    this.rafId = requestAnimationFrame(raf);
  }

  _stopLoops() {
    cancelAnimationFrame(this.rafId);
    clearInterval(this.intervalId);
    this.rafId = 0;
    this.intervalId = 0;
  }

  // ── Internal: sync state to the absolute timeline ────────────────────────
  _sync() {
    if (!this.isRunning) return;
    const elapsed = Date.now() - this.anchorTime;

    // Complete?
    if (elapsed >= this.totalMs) {
      this.elapsedMs = this.totalMs;
      this.isRunning = false;
      this._stopLoops();
      this._releaseWakeLock();
      this.lastIndex = this.schedule.length - 1;
      this.onComplete(this.schedule[this.schedule.length - 1]);
      this.onTick(this._state());
      return;
    }

    // Which phase are we in?
    const index = this._indexAt(elapsed);

    // Announce transition once per landing phase (no beep-spam after
    // a long background gap — we announce where you ARE, not every
    // phase you missed)
    if (index !== this.lastIndex) {
      const leaving = this.schedule[this.lastIndex];
      this.lastIndex = index;
      this.onPhase(this.schedule[index], leaving);
    }

    this.onTick(this._state(elapsed));
  }

  _indexAt(elapsed) {
    // boundaries is sorted ascending; find the last boundary <= elapsed
    let lo = 0, hi = this.boundaries.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.boundaries[mid] <= elapsed) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }

  // ── State snapshot ───────────────────────────────────────────────────────
  _state(elapsedArg) {
    const hasSchedule = this.schedule.length > 0;
    const elapsed = this.isRunning
      ? (elapsedArg ?? (Date.now() - this.anchorTime))
      : this.elapsedMs;

    const clamped    = Math.min(elapsed, this.totalMs);
    const index      = hasSchedule ? this._indexAt(Math.min(clamped, this.totalMs - 1)) : 0;
    const phase      = this.schedule[index] ?? null;
    const phaseStart = this.boundaries[index] ?? 0;
    const durationMs = phase ? phase.seconds * 1000 : 0;
    const intoPhase  = clamped - phaseStart;
    const remainingMs = Math.max(0, durationMs - intoPhase);
    const totalRemainingMs = Math.max(0, this.totalMs - clamped);
    const isComplete = hasSchedule && clamped >= this.totalMs;
    const progress   = durationMs > 0 ? remainingMs / durationMs : 0;
    const hasStarted = clamped > 0 && !isComplete;

    return {
      phase,
      currentIndex:     isComplete ? this.schedule.length - 1 : index,
      scheduleLength:   this.schedule.length,
      remainingMs:      isComplete ? 0 : remainingMs,
      totalRemainingMs,
      durationMs,
      progress:         isComplete ? 0 : progress,
      isRunning:        this.isRunning,
      hasStarted,
      isComplete
    };
  }

  // ── Wake Lock ────────────────────────────────────────────────────────────
  async _requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.onWakeLock(true);
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
        this.onWakeLock(false);
        // Note: re-acquire happens on visibilitychange when we're visible
        // again; requesting while hidden throws on most browsers.
      });
    } catch { /* denied or unavailable */ }
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
  // Android suspends aggressively; resume is async but fire-and-forget is fine
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  return _audioCtx;
}

// Warm up the AudioContext on the first user gesture so phase-change beeps
// (which fire from timers, not gestures) are never blocked.
const _warmup = () => {
  try { getAudioCtx(); } catch { /* no audio */ }
  document.removeEventListener('pointerdown', _warmup);
  document.removeEventListener('keydown', _warmup);
};
document.addEventListener('pointerdown', _warmup, { once: true });
document.addEventListener('keydown', _warmup, { once: true });

export function beep(frequency = 660, length = 0.12, volume = 0.22) {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
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
  if (!('speechSynthesis' in window)) return;
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
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch { /* unavailable */ }
}

// ── Shared utilities ───────────────────────────────────────────────────────────
export function formatTime(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function formatTimeLong(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
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
export const SOUND_MODES  = ['all-on', 'beep-only', 'voice-only', 'silent'];
export const SOUND_LABELS = { 'all-on': 'All', 'beep-only': 'Beep', 'voice-only': 'Voice', 'silent': 'Off' };
export const SOUND_ICONS  = { 'all-on': '♪', 'beep-only': '🔔', 'voice-only': '💬', 'silent': '🔇' };

export function shouldBeep(mode)  { return mode === 'all-on' || mode === 'beep-only'; }
export function shouldSpeak(mode) { return mode === 'all-on' || mode === 'voice-only'; }

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
