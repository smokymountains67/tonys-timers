import { clamp } from '../engine.js';
import { buildTimerUI, timeField } from './ui.js';

export async function init(ctx) {
  function readSettings() {
    const m = clamp(document.getElementById('amrapMin')?.value, 0, 99) || 0;
    const s = clamp(document.getElementById('amrapSec')?.value, 0, 59) || 0;
    return { seconds: Math.max(60, m*60+s) };
  }

  function buildSchedule() {
    const cfg = readSettings();
    return [
      { type:'prep', label:'Get Ready', seconds:10, roundLabel:'Starting soon' },
      { type:'work', label:'AMRAP',     seconds:cfg.seconds, roundLabel:'As many rounds as possible!' }
    ];
  }

  return buildTimerUI({
    accent: '#a855f7', timerName: 'AMRAP', accentDim: 'rgba(168,85,247,0.15)',
    ...ctx,
    buildSchedule,
    renderSettings: () => timeField('amrap', 'Duration', 20, 0),
    readSettings,
    loadSettings(saved) {
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
      set('amrapMin', Math.floor(saved.seconds/60));
      set('amrapSec', saved.seconds%60);
    },
    storageKey: 'tonys-amrap',
    presetLabel: '20 min',
    onPreset() {
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
      set('amrapMin',20); set('amrapSec',0);
    },
    showPhaseStrip: false,
    phaseSounds: {
      prep: { freq:660, voice:'Get ready!' },
      work: { freq:880, voice:'Go! As many rounds as possible!' }
    }
  });
}
