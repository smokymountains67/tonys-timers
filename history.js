/**
 * Tony's Timers — History calendar
 * Month grid with per-timer colored dots; tap a day to see each individual
 * session with time, completion status, duration, and a delete option.
 */
import { getHistory, deleteSession } from './engine.js';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

let viewYear, viewMonth, selectedDay;

function timerColor(id) {
  const card = document.querySelector(`.timer-card[data-timer="${id}"]`);
  return card?.style.getPropertyValue('--card-color')?.trim() || '#8896aa';
}

function formatDur(ms) {
  const s   = Math.round(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)  return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0)  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

function timeOfDay(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// day → [entries]
function monthEntries(year, month) {
  const days = {};
  for (const e of getHistory()) {
    const dt = new Date(e.d);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      (days[dt.getDate()] ||= []).push(e);
    }
  }
  return days;
}

function render() {
  const calTitle  = document.getElementById('calTitle');
  const calGrid   = document.getElementById('calGrid');
  const calDetail = document.getElementById('calDetail');
  const calNext   = document.getElementById('calNext');

  const now   = new Date();
  const isNow = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  calNext.disabled      = isNow;
  calNext.style.opacity = isNow ? '0.3' : '1';

  calTitle.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

  const days     = monthEntries(viewYear, viewMonth);
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysIn   = new Date(viewYear, viewMonth + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-cell empty"></div>`;

  for (let day = 1; day <= daysIn; day++) {
    const entries = days[day];
    const isToday = isNow && day === now.getDate();
    const classes = ['cal-cell'];
    if (entries)             classes.push('has-data');
    if (isToday)             classes.push('today');
    if (day === selectedDay) classes.push('selected');

    let inner = `<span class="cal-day-num">${day}</span>`;
    if (entries) {
      const ids   = [...new Set(entries.map(e => e.t))].slice(0, 4);
      const dots  = ids.map(id => `<span style="background:${timerColor(id)}"></span>`).join('');
      const total = entries.reduce((s, e) => s + e.ms, 0);
      inner += `<span class="cal-dots">${dots}</span>`;
      inner += `<span class="cal-mins">${Math.max(1, Math.round(total / 60000))}m</span>`;
    }
    html += `<div class="${classes.join(' ')}" data-day="${day}">${inner}</div>`;
  }
  calGrid.innerHTML = html;

  // ── Detail: each session is its own row ─────────────────────────────────
  if (selectedDay && days[selectedDay]) {
    const entries = [...days[selectedDay]].sort((a, b) => a.d - b.d);
    calDetail.innerHTML =
      `<div class="cal-detail-title">${MONTHS[viewMonth]} ${selectedDay}</div>` +
      entries.map(e => `
        <div class="cal-detail-row">
          <span class="detail-dot" style="background:${timerColor(e.t)}"></span>
          <div class="detail-main">
            <span class="detail-name">${e.n}</span>
            <span class="detail-when">${timeOfDay(e.d)} ·
              <span style="color:${e.c === 0 ? '#f4c84a' : '#28c98b'}">${e.c === 0 ? 'Partial' : 'Completed'}</span>
            </span>
          </div>
          <span class="detail-time">${formatDur(e.ms)}</span>
          <button class="detail-del" data-d="${e.d}" type="button" aria-label="Delete session">✕</button>
        </div>`).join('');
  } else if (selectedDay) {
    calDetail.innerHTML = `<div class="cal-detail-empty">No sessions on ${MONTHS[viewMonth]} ${selectedDay}</div>`;
  } else {
    const hasAny = Object.keys(days).length > 0;
    calDetail.innerHTML = hasAny
      ? `<div class="cal-detail-empty">Tap a day to see details</div>`
      : `<div class="cal-detail-empty">No sessions this month — go crush a workout! 💪</div>`;
  }
}

let wired = false;

export function openHistory() {
  const now   = new Date();
  viewYear    = now.getFullYear();
  viewMonth   = now.getMonth();
  selectedDay = null;

  if (!wired) {
    wired = true;

    document.getElementById('calPrev').addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      selectedDay = null;
      render();
    });

    document.getElementById('calNext').addEventListener('click', () => {
      const now = new Date();
      if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) return;
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      selectedDay = null;
      render();
    });

    document.getElementById('calGrid').addEventListener('click', (e) => {
      const cell = e.target.closest('.cal-cell[data-day]');
      if (!cell) return;
      selectedDay = Number(cell.dataset.day);
      render();
    });

    document.getElementById('calDetail').addEventListener('click', (e) => {
      const del = e.target.closest('.detail-del');
      if (!del) return;
      if (!confirm('Delete this session from your history?')) return;
      deleteSession(Number(del.dataset.d));
      render();
    });
  }

  render();
}
