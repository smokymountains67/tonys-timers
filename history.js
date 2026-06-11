/**
 * Tony's Timers — History calendar
 * Month grid with per-timer colored dots; tap a day for details.
 */
import { getHistory, formatTimeLong } from './engine.js';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

let viewYear, viewMonth, selectedDay;

function timerColor(id) {
  const card = document.querySelector(`.timer-card[data-timer="${id}"]`);
  return card?.style.getPropertyValue('--card-color')?.trim() || '#8896aa';
}

// day → { timerId: { ms, count, name } }
function monthData(year, month) {
  const map = {};
  for (const e of getHistory()) {
    const dt = new Date(e.d);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      const day  = dt.getDate();
      const slot = ((map[day] ||= {})[e.t] ||= { ms: 0, count: 0, name: e.n });
      slot.ms    += e.ms;
      slot.count += 1;
    }
  }
  return map;
}

function render() {
  const calTitle  = document.getElementById('calTitle');
  const calGrid   = document.getElementById('calGrid');
  const calDetail = document.getElementById('calDetail');
  const calNext   = document.getElementById('calNext');

  const now      = new Date();
  const isNow    = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  calNext.disabled      = isNow;
  calNext.style.opacity = isNow ? '0.3' : '1';

  calTitle.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

  const data     = monthData(viewYear, viewMonth);
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysIn   = new Date(viewYear, viewMonth + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-cell empty"></div>`;

  for (let day = 1; day <= daysIn; day++) {
    const d       = data[day];
    const isToday = isNow && day === now.getDate();
    const classes = ['cal-cell'];
    if (d)                      classes.push('has-data');
    if (isToday)                classes.push('today');
    if (day === selectedDay)    classes.push('selected');

    let inner = `<span class="cal-day-num">${day}</span>`;
    if (d) {
      const ids   = Object.keys(d).slice(0, 4);
      const dots  = ids.map(id => `<span style="background:${timerColor(id)}"></span>`).join('');
      const total = Object.values(d).reduce((s, v) => s + v.ms, 0);
      inner += `<span class="cal-dots">${dots}</span>`;
      inner += `<span class="cal-mins">${Math.max(1, Math.round(total / 60000))}m</span>`;
    }
    html += `<div class="${classes.join(' ')}" data-day="${day}">${inner}</div>`;
  }
  calGrid.innerHTML = html;

  // Detail panel
  if (selectedDay && data[selectedDay]) {
    const d = data[selectedDay];
    calDetail.innerHTML =
      `<div class="cal-detail-title">${MONTHS[viewMonth]} ${selectedDay}</div>` +
      Object.entries(d).map(([id, v]) => `
        <div class="cal-detail-row">
          <span class="detail-dot" style="background:${timerColor(id)}"></span>
          <span class="detail-name">${v.name}</span>
          <span class="detail-count">${v.count > 1 ? v.count + '×' : ''}</span>
          <span class="detail-time">${formatTimeLong(v.ms)}</span>
        </div>`).join('');
  } else if (selectedDay) {
    calDetail.innerHTML = `<div class="cal-detail-empty">No sessions on ${MONTHS[viewMonth]} ${selectedDay}</div>`;
  } else {
    const hasAny = Object.keys(data).length > 0;
    calDetail.innerHTML = hasAny
      ? `<div class="cal-detail-empty">Tap a day to see details</div>`
      : `<div class="cal-detail-empty">No sessions this month — go crush a workout! 💪</div>`;
  }
}

let wired = false;

export function openHistory() {
  const now    = new Date();
  viewYear     = now.getFullYear();
  viewMonth    = now.getMonth();
  selectedDay  = null;

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
  }

  render();
}
