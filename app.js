import { SOUND_MODES, SOUND_LABELS, SOUND_ICONS } from './engine.js';

// ── Elements ──────────────────────────────────────────────────────────────────
const homeScreen   = document.getElementById('homeScreen');
const timerScreen  = document.getElementById('timerScreen');
const timerMain    = document.getElementById('timerMain');
const settingsPanel = document.getElementById('settingsPanel');
const backBtn      = document.getElementById('backBtn');
const soundBtn     = document.getElementById('soundBtn');
const wakeDot      = document.getElementById('wakeDot');
const installBanner = document.getElementById('installBanner');
const installBtn   = document.getElementById('installBtn');
const dismissBtn   = document.getElementById('dismissBtn');

// ── State ─────────────────────────────────────────────────────────────────────
const STORAGE_KEY  = 'tonys-timers-sound';
let soundMode      = localStorage.getItem(STORAGE_KEY) || 'all-on';
let currentTimer   = null;
let deferredPrompt = null;

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

// ── Wake dot ──────────────────────────────────────────────────────────────────
export function setWakeLock(active) {
  wakeDot.classList.toggle('active', active);
}

// ── Navigation ────────────────────────────────────────────────────────────────
async function openTimer(id) {
  // Dynamically import the timer module
  let mod;
  try {
    mod = await import(`./timers/${id}.js`);
  } catch (e) {
    console.warn(`Timer "${id}" not found`, e);
    return;
  }

  // Tear down previous timer
  if (currentTimer?.destroy) currentTimer.destroy();

  // Show timer screen
  homeScreen.style.display = 'none';
  timerScreen.classList.add('active');

  // Let the module render itself into the shell
  currentTimer = await mod.init({
    timerMain,
    settingsPanel,
    soundMode: () => soundMode,
    setWakeLock
  });

  // Update URL hash for back-button support
  history.pushState({ timer: id }, '', `#${id}`);
}

function goHome() {
  if (currentTimer?.destroy) currentTimer.destroy();
  currentTimer = null;
  timerScreen.classList.remove('active');
  homeScreen.style.display = '';
  settingsPanel.style.display = 'none';
  history.pushState({}, '', '#');
}

backBtn.addEventListener('click', goHome);

window.addEventListener('popstate', (e) => {
  if (e.state?.timer) openTimer(e.state.timer);
  else goHome();
});

// Handle direct URL with hash (e.g. bookmark)
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
