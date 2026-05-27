import { clamp } from '../engine.js';
import { buildTimerUI, numberField } from './ui.js';

export async function init(ctx) {
  function readSettings() {
    return { seconds: clamp(document.getElementById('restSecs')?.value, 5, 600) || 60 };
  }

  function buildSchedule() {
    const { seconds } = readSettings();
    return [{ type:'rest', label:'Rest', seconds, roundLabel:'Recover & breathe' }];
  }

  return buildTimerUI({
    accent: '#28c98b', timerName: 'Rest', accentDim: 'rgba(40,201,139,0.15)',
    ...ctx,
    buildSchedule,
    renderSettings: () => numberField('restSecs', 'Rest (seconds)', 60, 5, 600),
    readSettings,
    loadSettings(saved) {
      const el = document.getElementById('restSecs');
      if (el) el.value = saved.seconds;
    },
    storageKey: 'tonys-rest',
    presetLabel: '60s',
    onPreset() { const el=document.getElementById('restSecs'); if(el) el.value=60; },
    showPhaseStrip: false,
    phaseSounds: {
      rest: { freq:440, voice:'Rest.' }
    }
  });
}
