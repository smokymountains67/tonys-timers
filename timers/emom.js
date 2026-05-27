import { clamp } from '../engine.js';
import { buildTimerUI, numberField } from './ui.js';

export async function init(ctx) {
  function readSettings() {
    return {
      rounds:  clamp(document.getElementById('emomRounds')?.value, 1, 99) || 10,
      minutes: clamp(document.getElementById('emomMin')?.value,    1, 60) || 1
    };
  }

  function buildSchedule() {
    const cfg = readSettings();
    const phases = [];
    // Countdown to start
    phases.push({ type:'prep', label:'Get Ready', seconds:5, roundLabel:`${cfg.rounds} rounds` });
    for (let r = 1; r <= cfg.rounds; r++) {
      phases.push({
        type: 'work',
        label: `Minute ${r}`,
        seconds: cfg.minutes * 60,
        roundLabel: `Round ${r} of ${cfg.rounds}`
      });
    }
    return phases;
  }

  return buildTimerUI({
    accent: '#f4c84a', timerName: 'EMOM', accentDim: 'rgba(244,200,74,0.15)',
    ...ctx,
    buildSchedule,
    renderSettings: () =>
      numberField('emomRounds', 'Rounds',         10, 1, 99)
    + numberField('emomMin',    'Minutes per round', 1, 1, 60),
    readSettings,
    loadSettings(saved) {
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
      set('emomRounds', saved.rounds); set('emomMin', saved.minutes);
    },
    storageKey: 'tonys-emom',
    presetLabel: '10×1 min',
    onPreset() {
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
      set('emomRounds',10); set('emomMin',1);
    },
    phaseSounds: {
      prep: { freq:660, voice:'Get ready!' },
      work: { freq:880, voice:'Go!' }
    }
  });
}
