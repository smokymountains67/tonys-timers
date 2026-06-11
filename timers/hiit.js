import { clamp } from '../engine.js';
import { buildTimerUI, timeField, numberField } from './ui.js';

const KEY = 'tonys-hiit';

export async function init(ctx) {
  const s = getSettings();

  function renderSettings() {
    return numberField('hiitRounds', 'Rounds', s.rounds, 1, 99)
      + timeField('hiitPre',  'Pre Workout',  Math.floor(s.pre/60),  s.pre%60)
      + timeField('hiitWork', 'Work',         Math.floor(s.work/60), s.work%60)
      + timeField('hiitRest', 'Rest',         Math.floor(s.rest/60), s.rest%60)
      + timeField('hiitPost', 'Post Workout', Math.floor(s.post/60), s.post%60);
  }

  function readSettings() {
    return {
      rounds: clamp(document.getElementById('hiitRounds')?.value, 1, 99) || s.rounds,
      pre:    getSeconds('hiitPre')  ?? s.pre,
      work:   Math.max(1, getSeconds('hiitWork') ?? s.work),
      rest:   getSeconds('hiitRest') ?? s.rest,
      post:   getSeconds('hiitPost') ?? s.post
    };
  }

  function loadSettings(saved) {
    Object.assign(s, saved);
    applyToDOM(s);
  }

  function buildSchedule() {
    const cfg = readSettings();
    const phases = [];
    if (cfg.pre > 0)
      phases.push({ type:'prep', label:'Get Ready', seconds:cfg.pre, roundLabel:`${cfg.rounds} rounds ahead` });
    for (let r = 1; r <= cfg.rounds; r++) {
      phases.push({ type:'work', label:'Work!', seconds:cfg.work, roundLabel:`Round ${r} of ${cfg.rounds}` });
      if (cfg.rest > 0 && r < cfg.rounds)
        phases.push({ type:'rest', label:'Rest',  seconds:cfg.rest, roundLabel:`Round ${r} of ${cfg.rounds}` });
    }
    if (cfg.post > 0)
      phases.push({ type:'done', label:'Cool Down', seconds:cfg.post, roundLabel:`Round ${cfg.rounds} of ${cfg.rounds}` });
    return phases;
  }

  return buildTimerUI({
    accent: '#ff5a4f', accentDim: 'rgba(255,90,79,0.15)',
    timerName: 'HIIT',
    ...ctx,
    buildSchedule, renderSettings,
    readSettings, loadSettings,
    storageKey: KEY,
    presetLabel: 'Quick HIIT',
    onPreset() {
      Object.assign(s, { rounds:8, pre:10, work:40, rest:20, post:60 });
      applyToDOM(s);
    },
    phaseSounds: {
      prep: { freq:660, voice:'Get ready!' },
      work: { freq:880, voice:'Work!' },
      rest: { freq:520, voice:'Rest.' },
      done: { freq:440, voice:'Cool down.' }
    }
  });
}

function getSettings() {
  try {
    const raw = localStorage.getItem('tonys-hiit');
    if (raw) return { rounds:8, pre:10, work:40, rest:20, post:60, ...JSON.parse(raw) };
  } catch {}
  return { rounds:8, pre:10, work:40, rest:20, post:60 };
}

function getSeconds(prefix) {
  const m = document.getElementById(`${prefix}Min`);
  const s = document.getElementById(`${prefix}Sec`);
  if (!m || !s) return null;
  return clamp(m.value,0,59)*60 + clamp(s.value,0,59);
}

function applyToDOM(s) {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.value=v; };
  set('hiitRounds', s.rounds);
  set('hiitPreMin',  Math.floor(s.pre/60));  set('hiitPreSec',  s.pre%60);
  set('hiitWorkMin', Math.floor(s.work/60)); set('hiitWorkSec', s.work%60);
  set('hiitRestMin', Math.floor(s.rest/60)); set('hiitRestSec', s.rest%60);
  set('hiitPostMin', Math.floor(s.post/60)); set('hiitPostSec', s.post%60);
}
