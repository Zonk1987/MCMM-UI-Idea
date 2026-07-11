/* ═══════════════════════════════════════════════════════════
   main.js — App Entry Point
   Bootstraps all modules and wires top-level navigation.
═══════════════════════════════════════════════════════════ */

import { loadLanguage, t, initI18n } from './i18n.js';
import {
  toggleModal,
  showToast,
  formatNum,
  formatDate,
  formatBytes,
  playerAvatarError,
  debounce,
  switchTab,
  pingClass,
  skeletonGrid,
} from './utils.js';
import { initSettings, applyVisualSettings, appSettings, debugApp } from './settings.js';
import { initCoreStore } from './core-store.js';
import { dockerApp } from './docker.js';
import { foldersApp } from './folders.js';
import { networksApp } from './networks.js';
import { composeApp } from './compose.js';
import { registerAlpineComponents } from './alpine-components.js';
import autoAnimate from './vendor/auto-animate.js';

document.addEventListener('alpine:init', () => {
  if (window.Alpine) {
    initCoreStore(window.Alpine);
    registerAlpineComponents(window.Alpine);
  }
});

// Modal Keyboard Support (Esc = close, Enter = confirm)
document.addEventListener('keydown', (e) => {
  const openModals = Array.from(document.querySelectorAll('.modal-backdrop')).filter(el => {
    return !el.hasAttribute('hidden') && window.getComputedStyle(el).display !== 'none';
  });
  
  if (openModals.length === 0) return;
  const topModal = openModals[openModals.length - 1];

  if (e.key === 'Escape') {
    const closeBtn = topModal.querySelector('.modal-header .icon-btn, [aria-label="Schließen"], #closeModModal');
    if (closeBtn) closeBtn.click();
  } else if (e.key === 'Enter') {
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'button') return;
    if (e.target.hasAttribute('@keydown.enter')) return;
    
    // Specific modals to ignore for global Enter
    if (topModal.id === 'fileManagerModal' || topModal.id === 'consoleModal') return;
    
    const confirmBtn = topModal.querySelector('.modal-footer .btn-primary, .modal-footer .btn-danger, .modal-footer .btn-success');
    if (confirmBtn && !confirmBtn.disabled) {
      e.preventDefault();
      confirmBtn.click();
    }
  }
});

// Expose globals required by Alpine and inline event handlers
window.t = t;
window.toggleModal = toggleModal;
window.showToast = showToast;
window.formatNum = formatNum;
window.formatDate = formatDate;
window.formatBytes = formatBytes;
window.playerAvatarError = playerAvatarError;
window.pingClass = pingClass;
window.autoAnimate = autoAnimate;
window.skeletonGrid = skeletonGrid;
window.appSettings = appSettings;
window.switchTab = switchTab;

window.dockerApp = dockerApp;
window.openConfigModal = (id, name, port, ram) => {
  if (window.Alpine) {
    Alpine.store('modals').config.data = { id, name, port, ram };
    Alpine.store('modals').config.open = true;
  }
};

window.foldersApp = foldersApp;
window.networksApp = networksApp;
window.composeApp = composeApp;
window.loadLanguage = loadLanguage;
window.applyVisualSettings = applyVisualSettings;
window.debugApp = debugApp;

window.finishOnboarding = function () {
  localStorage.setItem('gs_hub_onboarding_done', 'true');
  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.hidden = true;
      modal.style.opacity = '1';
    }, 300);
  }
};

/**
 *
 */
async function initApp() {
  // Load settings first since other modules might depend on them
  initSettings();

  // ── Wait for language to load before rendering anything ──
  await initI18n();

  // ── Load Modular HTML Components ──
  // Now loaded dynamically when switching tabs
  const activeTabBtn = document.querySelector('.tab-btn.active');
  if (activeTabBtn) {
    switchTab(activeTabBtn.dataset.tab || 'docker');
  }

  // Modals are handled by Alpine.js natively, do not move them manually.

  // ── Initialize all modules ────────────────────────────
  // Store initialization moved to top-level alpine:init listener


  // ── Tab navigation ────────────────────────────────────
  document.getElementById('tabNav')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  // ── Refresh button ────────────────────────────────────
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    const active = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (active === 'docker') {
      /* Alpine handles it */
    }
    if (active === 'gameserver') {
      /* Alpine handles it */
    }
    if (active === 'game-additions') {
      window.GameAdditions?.refresh();
    }
    if (active === 'players') {
      /* Alpine handles it */
    }
    showToast(t('general.data_refreshed') || 'Daten aktualisiert', 'success');

    // Spin the refresh icon briefly
    const icon = document.querySelector('#refreshBtn .material-icons-round');
    if (icon) {
      icon.style.transition = 'transform 0.6s ease';
      icon.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        icon.style.transform = '';
        icon.style.transition = '';
      }, 700);
    }
  });

  console.log('%c🎮 GameServer Hub v1.0', 'color:#f57c00;font-size:16px;font-weight:bold');
  console.log(
    `%cUnraid Plugin — ${t('general.loaded_successfully') || 'Erfolgreich geladen'}`,
    'color:#22c55e'
  );

  // ── Show Onboarding Modal ─────────────────────────────
  if (!localStorage.getItem('gs_hub_onboarding_done')) {
    const welcome = document.getElementById('welcomeModal');
    if (welcome) {
      setTimeout(() => (welcome.hidden = false), 500); // slight delay
    }
  }
  // Dynamically load Alpine.js AFTER all modules are initialized
  const script = document.createElement('script');
  script.src = 'js/vendor/alpine.min.js';
  script.defer = true;
  document.head.appendChild(script);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Import game addition modules AFTER GameAdditions has been attached to window
// (Wait, static imports are hoisted. To ensure they run AFTER GameAdditions is global,
// we should just let them import GameAdditions directly, which we already did!)
import '../games/minecraft/js/minecraft.js';
import '../games/palworld/js/palworld.js';
import '../games/valheim/js/valheim.js';
import '../games/cs2/js/cs2.js';
