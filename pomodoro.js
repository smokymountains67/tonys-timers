import { clamp } from '../engine.js';
import { buildTimerUI, numberField } from './ui.js';

export async function init(ctx) {
  function readSettings() {
    return {
      work:      clamp(document.getElementById('pomWork')?.value,      1, 120) || 25,
      shortRest: clamp(document.getElementById('pomShort')?.value,     1, 30)  || 5,
      longRest:  clamp(document.getElementById('pomLong')?.value,      1, 60)  || 15,
      sets:      clamp(document.getElementById('pomSets')?.value,      1, 20)  || 4
    };
  }

  function buildSchedule() {
    const cfg = readSettings();
    const phases = [];
    for (let i = 1; i <= cfg.sets; i++) {
      phases.push({ type:'work', label:'Focus', seconds: cfg.work*60, roundLabel:`Session ${i} of ${cfg.sets}` });
      if (i < cfg.sets) {
        phases.push({ type:'rest', label:'Short Break', seconds: cfg.shortRest*60, roundLabel:`Session ${i} of ${cfg.sets}` });
      } else {
        phases.push({ type:'done', label:'Long Break', seconds: cfg.longRest*60, roundLabel:'All sessions complete!' });
      }
    }
    return phases;
  }

  return buildTimerUI({
    accent: '#e05c3a', accentDim: 'rgba(224,92,58,0.15)',
    ...ctx,
    buildSchedule,
    renderSettings: () =>
      numberField('pomWork',  'Work (minutes)',       25, 1, 120)
    + numberField('pomShort', 'Short break (minutes)', 5, 1, 30)
    + numberField('pomLong',  'Long break (minutes)',  15, 1, 60)
    + numberField('pomSets',  'Sessions',               4, 1, 20),
    readSettings,
    loadSettings(saved) {
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
      set('pomWork',saved.work); set('pomShort',saved.shortRest);
      set('pomLong',saved.longRest); set('pomSets',saved.sets);
    },
    storageKey: 'tonys-pomodoro',
    presetLabel: 'Classic',
    onPreset() {
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
      set('pomWork',25); set('pomShort',5); set('pomLong',15); set('pomSets',4);
    },
    phaseSounds: {
      work: { freq:660, voice:'Focus time.' },
      rest: { freq:440, voice:'Short break.' },
      done: { freq:330, voice:'Long break. Well done!' }
    }
  });
}
