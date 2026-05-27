import { clamp } from '../engine.js';
import { buildTimerUI, numberField } from './ui.js';

export async function init(ctx) {
  function readSettings() {
    return {
      rounds: clamp(document.getElementById('tabRounds')?.value, 1, 99) || 8,
      work:   clamp(document.getElementById('tabWork')?.value,   1, 300) || 20,
      rest:   clamp(document.getElementById('tabRest')?.value,   0, 300) || 10,
      pre:    clamp(document.getElementById('tabPre')?.value,    0, 60)  || 10
    };
  }

  function buildSchedule() {
    const cfg = readSettings();
    const phases = [];
    if (cfg.pre > 0) phases.push({ type:'prep', label:'Get Ready', seconds: cfg.pre, roundLabel:`${cfg.rounds} rounds` });
    for (let r = 1; r <= cfg.rounds; r++) {
      phases.push({ type:'work', label:'Work!',  seconds: cfg.work, roundLabel:`Round ${r} of ${cfg.rounds}` });
      phases.push({ type:'rest', label:'Rest',   seconds: cfg.rest, roundLabel:`Round ${r} of ${cfg.rounds}` });
    }
    return phases;
  }

  return buildTimerUI({
    accent: '#ff8c42', timerName: 'Tabata', accentDim: 'rgba(255,140,66,0.15)',
    ...ctx,
    buildSchedule,
    renderSettings: () =>
      numberField('tabRounds', 'Rounds',        8,  1, 99)
    + numberField('tabWork',   'Work (seconds)', 20, 1, 300)
    + numberField('tabRest',   'Rest (seconds)', 10, 0, 300)
    + numberField('tabPre',    'Countdown (s)',  10, 0, 60),
    readSettings,
    loadSettings(saved) {
      const set = (id,v) => { const el=document.getElementById(id); if(el) el.value=v; };
      set('tabRounds', saved.rounds); set('tabWork', saved.work);
      set('tabRest',   saved.rest);   set('tabPre',  saved.pre);
    },
    storageKey: 'tonys-tabata',
    presetLabel: 'Classic',
    onPreset() {
      ['tabRounds','tabWork','tabRest','tabPre'].forEach((id,i) => {
        const el = document.getElementById(id);
        if (el) el.value = [8,20,10,10][i];
      });
    },
    phaseSounds: {
      prep: { freq:660, voice:'Get ready!' },
      work: { freq:880, voice:'Work!' },
      rest: { freq:440, voice:'Rest.' }
    }
  });
}
