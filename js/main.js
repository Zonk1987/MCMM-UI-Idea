/* ═══════════════════════════════════════════════════════════
   main.js — App Entry Point
   Bootstraps all modules and wires top-level navigation.
═══════════════════════════════════════════════════════════ */

import { I18N, loadLanguage, t, initI18n } from './i18n.js';
import { toggleModal, showToast, formatNum, formatBytes, playerAvatarError, debounce, switchTab, pingClass, skeletonGrid } from './utils.js';
import { initSettings, loadSettings, saveSettings, resetSettings, applyVisualSettings, fillSettingsForm, readSettingsForm, toggleSettingsPanel, bindSettingsEvents, appSettings } from './settings.js';
import { DOCKER_CONTAINERS, dockerApp } from './docker.js';
import { GAME_TEMPLATES, GS_INSTANCES, gameserverApp, openConsole } from './gameserver.js';
import { playersApp } from './players.js';
import { GameAdditions } from './gameAdditions.js';

// Expose globals required by Alpine and inline event handlers
window.t = t;
window.toggleModal = toggleModal;
window.showToast = showToast;
window.formatNum = formatNum;
window.formatBytes = formatBytes;
window.playerAvatarError = playerAvatarError;
window.pingClass = pingClass;
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
window.GS_INSTANCES = GS_INSTANCES;
window.DOCKER_CONTAINERS = DOCKER_CONTAINERS;
window.gameserverApp = gameserverApp;
window.openConsole = openConsole;

window.playersApp = playersApp;
window.GameAdditions = GameAdditions;
window.loadLanguage = loadLanguage;
window.applyVisualSettings = applyVisualSettings;

window.finishOnboarding = function() {
  localStorage.setItem('gs_hub_onboarding_done', 'true');
  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => { modal.hidden = true; modal.style.opacity = '1'; }, 300);
  }
};



async function loadComponents() {
  const components = [
    { id: 'panel-docker', url: 'components/docker.html' },
    { id: 'panel-gameserver', url: 'components/gameservers.html' },
    { id: 'panel-game-additions', url: 'components/gameAdditions.html' },
    { id: 'panel-players', url: 'components/players.html' }
  ];
  
  for (const comp of components) {
    try {
      const response = await fetch(comp.url + '?v=' + new Date().getTime());
      if (response.ok) {
        const html = await response.text();
        // Insert innerHTML, preserving the outer section tag from the placeholder
        const el = document.getElementById(comp.id);
        if (el) {
          // Because the component files contain the <section> tag itself,
          // we replace the placeholder's outerHTML with the fetched content.
          el.outerHTML = html;
        }
      } else {
        console.error(`Failed to load ${comp.url}: ${response.status}`);
      }
    } catch (e) {
      console.error(`Error loading ${comp.url}:`, e);
    }
  }
}

async function initApp() {
  // Load settings first since other modules might depend on them
  initSettings();

  // ── Wait for language to load before rendering anything ──
  await initI18n();

  // ── Load Modular HTML Components ──
  await loadComponents();

  // Modals are handled by Alpine.js natively, do not move them manually.

  // ── Initialize all modules ────────────────────────────
  GameAdditions.init();

  // ── Tab navigation ────────────────────────────────────
  document.getElementById('tabNav')?.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  // ── Refresh button ────────────────────────────────────
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    const active = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (active === 'docker') { /* Alpine handles it */ }
    if (active === 'gameserver') { /* Alpine handles it */ }
    if (active === 'game-additions') { GameAdditions.refresh(); }
    if (active === 'players') { /* Alpine handles it */ }
    showToast(t('data_refreshed') || 'Daten aktualisiert', 'success');

    // Spin the refresh icon briefly
    const icon = document.querySelector('#refreshBtn .material-icons-round');
    if (icon) {
      icon.style.transition = 'transform 0.6s ease';
      icon.style.transform  = 'rotate(360deg)';
      setTimeout(() => { icon.style.transform = ''; icon.style.transition = ''; }, 700);
    }
  });

  console.log('%c🎮 GameServer Hub v1.0', 'color:#f57c00;font-size:16px;font-weight:bold');
  console.log(`%cUnraid Plugin — ${t('loaded_successfully') || 'Erfolgreich geladen'}`, 'color:#22c55e');

  // ── Show Onboarding Modal ─────────────────────────────
  if (!localStorage.getItem('gs_hub_onboarding_done')) {
    const welcome = document.getElementById('welcomeModal');
    if (welcome) {
      setTimeout(() => welcome.hidden = false, 500); // slight delay
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
import './modules/minecraft.js';
import './modules/palworld.js';
import './modules/valheim.js';
import './modules/cs2.js';
