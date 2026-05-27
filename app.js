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
async function openTimer(id) {
  let mod;
  try {
    mod = await import(`./timers/${id}.js`);
  } catch (e) {
    console.warn(`Timer "${id}" not found`, e);
    return;
  }

  if (currentTimer?.destroy) currentTimer.destroy();
  closeDrawer();

  homeScreen.style.display = 'none';
  timerScreen.classList.add('active');

  currentTimer = await mod.init({
    timerMain,
    drawerInputGrid,
    drawerTitle,
    drawerPreset,
    soundMode: () => soundMode,
    setWakeLock,
    openDrawer,
    closeDrawer
  });

  history.pushState({ timer: id }, '', `#${id}`);
}

function goHome() {
  if (currentTimer?.destroy) currentTimer.destroy();
  currentTimer = null;
  closeDrawer();
  timerScreen.classList.remove('active');
  homeScreen.style.display = '';
  drawerInputGrid.innerHTML = '';
  history.pushState({}, '', '#');
}

backBtn.addEventListener('click', goHome);

window.addEventListener('popstate', (e) => {
  if (e.state?.timer) openTimer(e.state.timer);
  else goHome();
});

if (location.hash && location.hash.length > 1) {
  openTimer(location.hash.slice(1));
}

// ── Timer grid clicks ─────────────────────────────────────────────────────────
document.getElementById('timerGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.timer-card');
  if (card) openTimer(card.dataset.timer);
});

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
