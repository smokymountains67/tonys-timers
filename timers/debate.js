/**
 * Tony's Timers — Debate Timer
 * Format picker (Classroom / Lincoln-Douglas / Public Forum) with every
 * segment's duration editable. Set any segment to 0 to skip it.
 * Affirmative = green, Negative = red, Crossfire = purple.
 */
import { clamp } from '../engine.js';
import { buildTimerUI, timeField, selectField } from './ui.js';

const KEY = 'tonys-debate';

// side: aff | neg | cx | prep  (drives ring/dot colors)
const FORMATS = {
  classroom: {
    name: 'Classroom',
    segments: [
      { key: 'prep',   label: 'Get Ready',     eyebrow: 'PREP',         side: 'prep', def: 30  },
      { key: 'aopen',  label: 'Aff Opening',   eyebrow: 'AFFIRMATIVE',  side: 'aff',  def: 240 },
      { key: 'nopen',  label: 'Neg Opening',   eyebrow: 'NEGATIVE',     side: 'neg',  def: 240 },
      { key: 'areb',   label: 'Aff Rebuttal',  eyebrow: 'AFFIRMATIVE',  side: 'aff',  def: 180 },
      { key: 'nreb',   label: 'Neg Rebuttal',  eyebrow: 'NEGATIVE',     side: 'neg',  def: 180 },
      { key: 'acx',    label: 'Aff Cross-Ex',  eyebrow: 'CROSS-EX',     side: 'cx',   def: 180 },
      { key: 'ncx',    label: 'Neg Cross-Ex',  eyebrow: 'CROSS-EX',     side: 'cx',   def: 180 },
      { key: 'aclose', label: 'Aff Closing',   eyebrow: 'AFFIRMATIVE',  side: 'aff',  def: 180 },
      { key: 'nclose', label: 'Neg Closing',   eyebrow: 'NEGATIVE',     side: 'neg',  def: 180 },
      { key: 'aqa',    label: 'Q&A — Aff',     eyebrow: 'AUDIENCE Q&A', side: 'aff',  def: 300 },
      { key: 'nqa',    label: 'Q&A — Neg',     eyebrow: 'AUDIENCE Q&A', side: 'neg',  def: 300 },
    ]
  },
  ld: {
    name: 'Lincoln-Douglas',
    segments: [
      { key: 'prep',  label: 'Get Ready',        eyebrow: 'PREP',        side: 'prep', def: 30  },
      { key: 'ac',    label: 'Aff Constructive', eyebrow: 'AFFIRMATIVE', side: 'aff',  def: 360 },
      { key: 'ncx',   label: 'Neg Cross-Ex',     eyebrow: 'CROSS-EX',    side: 'cx',   def: 180 },
      { key: 'nc',    label: 'Neg Constructive', eyebrow: 'NEGATIVE',    side: 'neg',  def: 420 },
      { key: 'acx',   label: 'Aff Cross-Ex',     eyebrow: 'CROSS-EX',    side: 'cx',   def: 180 },
      { key: 'ar1',   label: '1st Aff Rebuttal', eyebrow: 'AFFIRMATIVE', side: 'aff',  def: 240 },
      { key: 'nr',    label: 'Neg Rebuttal',     eyebrow: 'NEGATIVE',    side: 'neg',  def: 360 },
      { key: 'ar2',   label: '2nd Aff Rebuttal', eyebrow: 'AFFIRMATIVE', side: 'aff',  def: 180 },
    ]
  },
  pf: {
    name: 'Public Forum',
    segments: [
      { key: 'prep',  label: 'Get Ready',         eyebrow: 'PREP',      side: 'prep', def: 30  },
      { key: 'ac',    label: 'Team A Speech',     eyebrow: 'TEAM A',    side: 'aff',  def: 240 },
      { key: 'bc',    label: 'Team B Speech',     eyebrow: 'TEAM B',    side: 'neg',  def: 240 },
      { key: 'cf1',   label: 'Crossfire',         eyebrow: 'CROSSFIRE', side: 'cx',   def: 180 },
      { key: 'areb',  label: 'Team A Rebuttal',   eyebrow: 'TEAM A',    side: 'aff',  def: 240 },
      { key: 'breb',  label: 'Team B Rebuttal',   eyebrow: 'TEAM B',    side: 'neg',  def: 240 },
      { key: 'cf2',   label: 'Crossfire',         eyebrow: 'CROSSFIRE', side: 'cx',   def: 180 },
      { key: 'asum',  label: 'Team A Summary',    eyebrow: 'TEAM A',    side: 'aff',  def: 180 },
      { key: 'bsum',  label: 'Team B Summary',    eyebrow: 'TEAM B',    side: 'neg',  def: 180 },
      { key: 'gcf',   label: 'Grand Crossfire',   eyebrow: 'CROSSFIRE', side: 'cx',   def: 180 },
      { key: 'aff_f', label: 'A Final Focus',     eyebrow: 'TEAM A',    side: 'aff',  def: 120 },
      { key: 'bff',   label: 'B Final Focus',     eyebrow: 'TEAM B',    side: 'neg',  def: 120 },
    ]
  }
};

function getSeconds(prefix) {
  const m = document.getElementById(`${prefix}Min`);
  const s = document.getElementById(`${prefix}Sec`);
  if (!m || !s) return null;
  return clamp(m.value, 0, 59) * 60 + clamp(s.value, 0, 59);
}

function segFieldsHTML(fmt, vals = {}) {
  return FORMATS[fmt].segments.map(seg => {
    const secs = vals[seg.key] ?? seg.def;
    return timeField('debSeg_' + seg.key, seg.label, Math.floor(secs / 60), secs % 60);
  }).join('');
}

export async function init(ctx) {
  let currentFormat = 'classroom';

  // Restore last format before first render
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.format && FORMATS[saved.format]) currentFormat = saved.format;
  } catch {}

  function renderSettings() {
    return selectField('debFormat', 'Debate Format',
        Object.entries(FORMATS).map(([k, f]) => [k, f.name]), currentFormat)
      + `<div style="color:var(--muted);font-size:0.75rem;line-height:1.5;text-transform:none;letter-spacing:0">
           Set any segment to 0m 0s to skip it.</div>`
      + `<div id="debSegWrap" style="display:grid;gap:12px">${segFieldsHTML(currentFormat)}</div>`;
  }

  function readSettings() {
    const sel = document.getElementById('debFormat');
    const fmt = sel && FORMATS[sel.value] ? sel.value : currentFormat;
    const durations = {};
    for (const seg of FORMATS[fmt].segments) {
      durations[seg.key] = getSeconds('debSeg_' + seg.key) ?? seg.def;
    }
    return { format: fmt, durations };
  }

  function loadSettings(saved) {
    if (!saved?.format || !FORMATS[saved.format]) return;
    currentFormat = saved.format;
    const sel  = document.getElementById('debFormat');
    const wrap = document.getElementById('debSegWrap');
    if (sel)  sel.value = currentFormat;
    if (wrap) wrap.innerHTML = segFieldsHTML(currentFormat, saved.durations || {});
  }

  function onSettingsChange(input) {
    if (input.id === 'debFormat' && FORMATS[input.value]) {
      currentFormat = input.value;
      const wrap = document.getElementById('debSegWrap');
      if (wrap) wrap.innerHTML = segFieldsHTML(currentFormat);
    }
  }

  function buildSchedule() {
    const cfg    = readSettings();
    currentFormat = cfg.format;
    const active = FORMATS[cfg.format].segments.filter(s => (cfg.durations[s.key] || 0) > 0);
    const total  = active.length;
    return active.map((seg, i) => ({
      type:       seg.side,
      label:      seg.label,
      eyebrow:    seg.eyebrow,
      seconds:    cfg.durations[seg.key],
      roundLabel: `Segment ${i + 1} of ${total}`
    }));
  }

  return buildTimerUI({
    accent: '#ec4899', accentDim: 'rgba(236,72,153,0.15)',
    timerName: 'Debate',
    ...ctx,
    buildSchedule, renderSettings, onSettingsChange,
    readSettings, loadSettings,
    storageKey: KEY,
    presetLabel: 'Format Defaults',
    onPreset() {
      const wrap = document.getElementById('debSegWrap');
      if (wrap) wrap.innerHTML = segFieldsHTML(currentFormat);
    },
    showNextButton: true,
    roundKeyLabel: 'Segment',
    countRounds: (schedule) => schedule.length,
    phaseColors: {
      aff: '#28c98b',
      neg: '#ff5a4f',
      cx:  '#a855f7'
    },
    phaseSounds: {
      prep: { freq: 520 },
      aff:  { freq: 660 },
      neg:  { freq: 550 },
      cx:   { freq: 880 }
    }
  });
}
