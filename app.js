import { SOUND_MODES, SOUND_LABELS, SOUND_ICONS } from './engine.js';

// ── Elements ──────────────────────────────────────────────────────────────────
const homeScreen     = document.getElementById('homeScreen');
const timerScreen    = document.getElementById('timerScreen');
const timerMain      = document.getElementById('timerMain');
const backBtn        = document.getElementById('backBtn');
const soundBtn       = document.getElementById('soundBtn');
const gearBtn        = document.getElementById('gearBtn');
const wakeDot        = document.getElementById('wakeDot');
const drawerOverlay  = document.getElementById('drawerOverlay');
const settingsDrawer = document.getElementById('settingsDrawer');
const drawerClose    = document.getElementById('drawerClose');
const drawerTitle    = document.getElementById('drawerTitle');
const drawerPreset   = document.getElementById('drawerPresetBtn');
const drawerInputGrid= document.getElementById('drawerInputGrid');
const installBanner  = document.getElementById('installBanner');
const installBtn     = document.getElementById('installBtn');
const dismissBtn     = document.getElementById('dismissBtn');

// ── State ─────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'tonys-timers-sound';
let soundMode     = localStorage.getItem(STORAGE_KEY) || 'all-on';
let currentTimer  = null;
let deferredPrompt= null;

// ── Sound button ──────────────────────────────────────────────────────────────
function updateSoundBtn() {
  soundBtn.textContent = SOUND_ICONS[soundMode];
  soundBtn.setAttribute('aria-label', `Sound: ${SOUND_LABELS[soundMode]}`);
}

soundBtn.addEventListener('click', () => {
  const idx = SOUND_MODES.indexOf(soundMode);
  soundMode = SOUND_MODES[(idx + 1) % SOUND_MODES.length];
  localStorage.setItem(STORAGE_KEY, soundMode);
  updateSoundBtn();
  if (currentTimer?.onSoundModeChange) currentTimer.onSoundModeChange(soundMode);
});

updateSoundBtn();

// ── Gear / settings drawer ────────────────────────────────────────────────────
function openDrawer()  {
  drawerOverlay.classList.add('open');
  settingsDrawer.classList.add('open');
  gearBtn.classList.add('gear-active');
}

function closeDrawer() {
  drawerOverlay.classList.remove('open');
  settingsDrawer.classList.remove('open');
  gearBtn.classList.remove('gear-active');
}

gearBtn.addEventListener('click', () => {
  settingsDrawer.classList.contains('open') ? closeDrawer() : openDrawer();
});

drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// ── Wake dot ──────────────────────────────────────────────────────────────────
export function setWakeLock(active) {
  wakeDot.classList.toggle('active', active);
}

// ── Navigation ────────────────────────────────────────────────────────────────
const historyScreen = document.getElementById('historyScreen');
const historyBtn    = document.getElementById('historyBtn');
const historyBack   = document.getElementById('historyBack');
let historyMod      = null;

async function openHistoryScreen(push = true) {
  historyMod ||= await import('./history.js');
  if (currentTimer?.destroy) currentTimer.destroy();
  currentTimer = null;
  closeDrawer();
  timerScreen.classList.remove('active');
  homeScreen.style.display = 'none';
  historyScreen.classList.add('active');
  historyMod.openHistory();
  if (push) history.pushState({ view: 'history' }, '', '#history');
}

historyBtn.addEventListener('click', () => openHistoryScreen());
historyBack.addEventListener('click', () => { goHome(); });

async function openTimer(id, push = true) {
  let mod;
  try {
    mod = await import(`./timers/${id}.js`);
  } catch (e) {
    console.warn(`Timer "${id}" not found`, e);
    return;
  }

  if (currentTimer?.destroy) currentTimer.destroy();
  closeDrawer();

  historyScreen.classList.remove('active');
  homeScreen.style.display = 'none';
  timerScreen.classList.add('active');

  currentTimer = await mod.init({
    timerId: id,
    timerMain,
    drawerInputGrid,
    drawerTitle,
    drawerPreset,
    soundMode: () => soundMode,
    setWakeLock,
    openDrawer,
    closeDrawer
  });

  if (push) history.pushState({ timer: id }, '', `#${id}`);
}

function goHome() {
  if (currentTimer?.destroy) currentTimer.destroy();
  currentTimer = null;
  closeDrawer();
  timerScreen.classList.remove('active');
  historyScreen.classList.remove('active');
  homeScreen.style.display = '';
  drawerInputGrid.innerHTML = '';
  history.pushState({}, '', '#');
}

backBtn.addEventListener('click', goHome);

window.addEventListener('popstate', (e) => {
  if (e.state?.timer) openTimer(e.state.timer, false);
  else if (e.state?.view === 'history') openHistoryScreen(false);
  else {
    timerScreen.classList.remove('active');
    historyScreen.classList.remove('active');
    if (currentTimer?.destroy) currentTimer.destroy();
    currentTimer = null;
    closeDrawer();
    homeScreen.style.display = '';
  }
});

if (location.hash === '#history') {
  openHistoryScreen(false);
} else if (location.hash && location.hash.length > 1) {
  openTimer(location.hash.slice(1), false);
}

// ── Timer grid: open, reorder, persist ────────────────────────────────────────
const timerGrid = document.getElementById('timerGrid');
const editBtn   = document.getElementById('editBtn');
const ORDER_KEY = 'tonys-timers-order';
let editMode    = false;
let justDragged = false;

function applyOrder() {
  try {
    const order = JSON.parse(localStorage.getItem(ORDER_KEY));
    if (!Array.isArray(order)) return;
    const cards = [...timerGrid.children];
    const byId  = new Map(cards.map(c => [c.dataset.timer, c]));
    const seen  = new Set();
    const frag  = document.createDocumentFragment();
    order.forEach(id => {
      const c = byId.get(id);
      if (c) { frag.appendChild(c); seen.add(id); }
    });
    cards.forEach(c => { if (!seen.has(c.dataset.timer)) frag.appendChild(c); });
    timerGrid.appendChild(frag);
  } catch { /* corrupt order — ignore */ }
}

function saveOrder() {
  try {
    const order = [...timerGrid.children].map(c => c.dataset.timer);
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch { /* storage unavailable */ }
}

applyOrder();

editBtn.addEventListener('click', () => {
  editMode = !editMode;
  timerGrid.classList.toggle('edit-mode', editMode);
  editBtn.textContent = editMode ? 'Done' : 'Edit Layout';
  editBtn.classList.toggle('editing', editMode);
});

timerGrid.addEventListener('click', (e) => {
  if (editMode || justDragged) { justDragged = false; return; }
  const card = e.target.closest('.timer-card');
  if (card) openTimer(card.dataset.timer);
});

// ── Drag to reorder (pointer events — works for touch and mouse) ─────────────
let dragCard = null, dragStartX = 0, dragStartY = 0, dragging = false;

timerGrid.addEventListener('pointerdown', (e) => {
  if (!editMode) return;
  const card = e.target.closest('.timer-card');
  if (!card) return;
  dragCard   = card;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragging   = false;
  card.setPointerCapture(e.pointerId);
});

timerGrid.addEventListener('pointermove', (e) => {
  if (!dragCard) return;
  let dx = e.clientX - dragStartX;
  let dy = e.clientY - dragStartY;

  if (!dragging && Math.hypot(dx, dy) > 8) {
    dragging = true;
    dragCard.classList.add('dragging');
    dragCard.style.pointerEvents = 'none'; // lets elementFromPoint see beneath
  }
  if (!dragging) return;

  dragCard.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

  const under  = document.elementFromPoint(e.clientX, e.clientY);
  const target = under?.closest('.timer-card');
  if (target && target !== dragCard && target.parentElement === timerGrid) {
    const before = dragCard.getBoundingClientRect();
    const cards  = [...timerGrid.children];
    const from   = cards.indexOf(dragCard);
    const to     = cards.indexOf(target);
    if (from < to) target.after(dragCard);
    else           target.before(dragCard);
    const after  = dragCard.getBoundingClientRect();

    // The layout slot moved — shift the anchor by the same delta so the
    // card stays glued to the finger
    dragStartX += after.left - before.left;
    dragStartY += after.top  - before.top;
    dx = e.clientX - dragStartX;
    dy = e.clientY - dragStartY;
    dragCard.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
  }
});

function endDrag() {
  if (!dragCard) return;
  if (dragging) {
    saveOrder();
    justDragged = true;
  }
  dragCard.classList.remove('dragging');
  dragCard.style.transform = '';
  dragCard.style.pointerEvents = '';
  dragCard = null;
  dragging = false;
}

timerGrid.addEventListener('pointerup', endDrag);
timerGrid.addEventListener('pointercancel', endDrag);

// ── Install prompt ────────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!sessionStorage.getItem('install-dismissed')) {
    installBanner.classList.add('visible');
  }
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  installBanner.classList.remove('visible');
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

dismissBtn.addEventListener('click', () => {
  installBanner.classList.remove('visible');
  sessionStorage.setItem('install-dismissed', '1');
});

window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('visible');
  deferredPrompt = null;
});

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
