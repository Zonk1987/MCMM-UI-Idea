/* ═══════════════════════════════════════════════════════════
   settings.js — Settings Panel Controller
   Manages saving/loading config to localStorage, toggling the
   sidebar panel, and dynamically applying settings (like accent color
   and compact mode).
═══════════════════════════════════════════════════════════ */

/** @type {Object} Default application settings */
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  accentColor: '#f57c00',
  lang: 'en',
  compactMode: false,
  refreshInterval: 5,
  animations: true,
  debugMode: false,
  dockerSocket: '/var/run/docker.sock',
  unraidApi: 'http://localhost/api',
  restartPolicy: 'unless-stopped',
  updateCheck: true,
  stopConfirm: true,
  gsDataPath: '/mnt/user/gameservers',
  gsRam: 4096,
  rconEnabled: true,
  rconPort: 25575,
  rconPassword: '',
  cfApiKey: '$2a$10$Tihj.oq7x7tEa5F0.f9/1Of3u2P5hpwfymKDi6fDGSaS.qh/R4B2m',
  mcType: 'PAPER',
  mcVersion: 'LATEST',
  mcMaxPlayers: 20,
  mcEula: true,
  toastsEnabled: true,
  toastDuration: 3500,
  notifContainer: true,
  notifPlayer: true,
  notifUpdate: true,
  notifCrash: true,
  disabledModules: [],
  folderViewEnabled: true,
};

/** @type {Object} Current application settings */
export let appSettings = { ...DEFAULT_SETTINGS };

/**
 * Initialize settings module
 */
export function initSettings() {
  loadSettings();
  bindSettingsEvents();
}

/**
 * Load settings from localStorage or fallback to defaults
 */
export function loadSettings() {
  const stored = localStorage.getItem('gs_hub_settings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Keep the default API key if user hasn't explicitly set one
      if (!parsed.cfApiKey && DEFAULT_SETTINGS.cfApiKey) {
        parsed.cfApiKey = DEFAULT_SETTINGS.cfApiKey;
      }
      appSettings = { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      console.warn('Failed to load settings', e);
      appSettings = { ...DEFAULT_SETTINGS };
    }
  } else {
    appSettings = { ...DEFAULT_SETTINGS };
  }
  window.appSettings = appSettings;
  applyVisualSettings();
  fillSettingsForm();
}

/**
 * Save current settings to localStorage and apply visual changes
 */
export function saveSettings() {
  const oldLang = localStorage.getItem('gs_hub_settings')
    ? JSON.parse(localStorage.getItem('gs_hub_settings')).lang || 'en'
    : 'en';

  readSettingsForm();
  localStorage.setItem('gs_hub_settings', JSON.stringify(appSettings));

  if (oldLang !== appSettings.lang) {
    window.location.reload();
    return;
  }

  if (window.GameAdditions) {
    window.GameAdditions.buildGameSelector();
  }

  applyVisualSettings();
  window.dispatchEvent(new CustomEvent('settings-saved'));
  showToast(t('settings.saved') || 'Einstellungen gespeichert', 'success');
  toggleSettingsPanel(false);
}

/**
 * Reset settings to default values after user confirmation
 */
export function resetSettings() {
  if (
    confirm(t('settings.reset_confirm') || 'Einstellungen wirklich auf Standardwerte zurücksetzen?')
  ) {
    appSettings = { ...DEFAULT_SETTINGS };
    window.appSettings = appSettings;
    localStorage.removeItem('gs_hub_settings');
    applyVisualSettings();
    fillSettingsForm();
    showToast(t('settings.reset_success') || 'Standardeinstellungen geladen', 'info');
  }
}

/**
 * Apply visual settings (Accent Color, Compact Mode, Language) to the DOM
 */
export function applyVisualSettings() {
  // 1. Accent color
  document.documentElement.style.setProperty('--accent', appSettings.accentColor);

  // Calculate a light accent dim & glow based on hex accent
  const hex = appSettings.accentColor;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.15)`);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.4)`);

  // 2. Compact mode
  document.body.classList.toggle('compact-mode', appSettings.compactMode);

  // 3. Theme
  document.documentElement.setAttribute('data-theme', appSettings.theme || 'dark');

  // 4. Language
  if (typeof window.loadLanguage === 'function') {
    window.loadLanguage(appSettings.lang);
  }

  // Update swatches active state
  document.querySelectorAll('#accentSwatches .swatch').forEach((sw) => {
    if (sw.classList.contains('swatch-custom')) {
      sw.value = appSettings.accentColor;
    } else {
      sw.classList.toggle('active', sw.dataset.color === appSettings.accentColor);
    }
  });
}

// Fill UI form inputs with appSettings values
export function fillSettingsForm() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  setVal('settingLang', appSettings.lang);
  setVal('settingTheme', appSettings.theme || 'dark');
  setChk('settingCompact', appSettings.compactMode);
  setVal('settingRefreshInterval', appSettings.refreshInterval);
  setChk('settingAnimations', appSettings.animations);
  setChk('settingDebug', appSettings.debugMode);

  setVal('settingDockerSocket', appSettings.dockerSocket);
  setVal('settingUnraidApi', appSettings.unraidApi);
  setVal('settingRestartPolicy', appSettings.restartPolicy);
  setChk('settingUpdateCheck', appSettings.updateCheck);
  setChk('settingStopConfirm', appSettings.stopConfirm);

  setVal('settingGsDataPath', appSettings.gsDataPath);
  setVal('settingGsRam', appSettings.gsRam);
  setChk('settingRconEnabled', appSettings.rconEnabled);
  setVal('settingRconPort', appSettings.rconPort);
  setVal('settingRconPassword', appSettings.rconPassword);

  setVal('settingCfApiKey', appSettings.cfApiKey);
  setVal('settingMcType', appSettings.mcType);
  setVal('settingMcVersion', appSettings.mcVersion);
  setVal('settingMcMaxPlayers', appSettings.mcMaxPlayers);
  setChk('settingMcEula', appSettings.mcEula);

  setChk('settingToastsEnabled', appSettings.toastsEnabled);
  setVal('settingToastDuration', appSettings.toastDuration);

  setChk('notifContainer', appSettings.notifContainer);
  setChk('notifPlayer', appSettings.notifPlayer);
  setChk('notifUpdate', appSettings.notifUpdate);
  setChk('notifCrash', appSettings.notifCrash);
  setChk('settingFolderViewEnabled', appSettings.folderViewEnabled);

  // Populate modules
  const modContainer = document.getElementById('settingsModuleList');
  if (modContainer && window.GameAdditions) {
    modContainer.innerHTML = '';
    const allGames = Object.keys(window.GameAdditions.games);
    allGames.forEach((gameId) => {
      if (gameId === 'minecraft') return; // skip default
      const cfg = window.GameAdditions.games[gameId];
      const isChecked = !(appSettings.disabledModules || []).includes(gameId);

      modContainer.insertAdjacentHTML(
        'beforeend',
        `
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">${cfg.name || gameId}</div>
            <div class="setting-desc">Modul im Game Hub anzeigen</div>
          </div>
          <label class="setting-toggle">
            <input type="checkbox" data-module="${gameId}" ${isChecked ? 'checked' : ''} />
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
          </label>
        </div>
      `
      );
    });
  }
}

// Read values from UI form inputs into appSettings
export function readSettingsForm() {
  appSettings.lang = document.getElementById('settingLang').value;
  appSettings.theme = document.getElementById('settingTheme').value;
  appSettings.compactMode = document.getElementById('settingCompact').checked;
  appSettings.refreshInterval =
    parseInt(document.getElementById('settingRefreshInterval').value) || 5;
  appSettings.animations = document.getElementById('settingAnimations').checked;
  appSettings.debugMode = document.getElementById('settingDebug').checked;

  appSettings.dockerSocket = document.getElementById('settingDockerSocket').value;
  appSettings.unraidApi = document.getElementById('settingUnraidApi').value;
  appSettings.restartPolicy = document.getElementById('settingRestartPolicy').value;
  appSettings.updateCheck = document.getElementById('settingUpdateCheck').checked;
  appSettings.stopConfirm = document.getElementById('settingStopConfirm').checked;

  appSettings.gsDataPath = document.getElementById('settingGsDataPath').value;
  appSettings.gsRam = parseInt(document.getElementById('settingGsRam').value) || 4096;
  appSettings.rconEnabled = document.getElementById('settingRconEnabled').checked;
  appSettings.rconPort = parseInt(document.getElementById('settingRconPort').value) || 25575;
  appSettings.rconPassword = document.getElementById('settingRconPassword').value;

  appSettings.cfApiKey = document.getElementById('settingCfApiKey').value;
  appSettings.mcType = document.getElementById('settingMcType').value;
  appSettings.mcVersion = document.getElementById('settingMcVersion').value;
  appSettings.mcMaxPlayers = parseInt(document.getElementById('settingMcMaxPlayers').value) || 20;
  appSettings.mcEula = document.getElementById('settingMcEula').checked;

  appSettings.toastsEnabled = document.getElementById('settingToastsEnabled').checked;
  appSettings.toastDuration =
    parseInt(document.getElementById('settingToastDuration').value) || 3500;

  appSettings.notifContainer = document.getElementById('notifContainer').checked;
  appSettings.notifPlayer = document.getElementById('notifPlayer').checked;
  appSettings.notifUpdate = document.getElementById('notifUpdate').checked;
  appSettings.notifCrash = document.getElementById('notifCrash').checked;
  appSettings.folderViewEnabled = document.getElementById('settingFolderViewEnabled').checked;

  const disabledModules = [];
  document.querySelectorAll('#settingsModuleList input[type="checkbox"]').forEach((cb) => {
    if (!cb.checked) disabledModules.push(cb.dataset.module);
  });
  appSettings.disabledModules = disabledModules;
}

// Toggle settings panel state
export function toggleSettingsPanel(show) {
  const panel = document.getElementById('settingsPanel');
  const backdrop = document.getElementById('settingsBackdrop');

  if (show) {
    panel.hidden = false;
    backdrop.hidden = false;
    // Add open class in next tick for transition
    setTimeout(() => {
      panel.classList.add('open');
      backdrop.classList.add('open');
    }, 10);
  } else {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(() => {
      panel.hidden = true;
      backdrop.hidden = true;
    }, 300); // match transition duration
  }
}

// Bind settings UI event handlers
export function bindSettingsEvents() {
  // Open Settings Panel (via Main UI settingsBtn)
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    fillSettingsForm();
    toggleSettingsPanel(true);
  });

  // Close Settings Panel
  document
    .getElementById('closeSettingsBtn')
    ?.addEventListener('click', () => toggleSettingsPanel(false));
  document
    .getElementById('settingsBackdrop')
    ?.addEventListener('click', () => toggleSettingsPanel(false));

  // Settings Save & Reset
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);

  // Live language preview
  document.getElementById('settingLang')?.addEventListener('change', (e) => {
    if (typeof window.loadLanguage === 'function') {
      window.loadLanguage(e.target.value);
    }
  });

  // Settings section navigation (sidebar inside settings panel)
  document.getElementById('settingsNav').addEventListener('click', (e) => {
    const btn = e.target.closest('.settings-nav-btn');
    if (!btn) return;

    // Toggle active nav class
    document.querySelectorAll('.settings-nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Toggle active section visibility
    const targetTab = btn.dataset.stab;
    document.querySelectorAll('.settings-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `stab-${targetTab}`);
    });
  });

  // Swatch click logic
  document.getElementById('accentSwatches').addEventListener('click', (e) => {
    const swatch = e.target.closest('.swatch');
    if (!swatch || swatch.classList.contains('swatch-custom')) return;

    appSettings.accentColor = swatch.dataset.color;
    applyVisualSettings();
  });

  // Custom color picker swatch
  document.getElementById('customAccentColor').addEventListener('input', (e) => {
    appSettings.accentColor = e.target.value;
    applyVisualSettings();
  });
}

// main.js will call initSettings() instead of standalone listener

/**
 * Debug App for editing container labels
 */
export function debugApp() {
  return {
    get containers() {
      return typeof Alpine !== 'undefined' && Alpine.store('core') 
        ? Alpine.store('core').containers 
        : [];
    },
    updateLabel(id, key, value) {
      if (typeof Alpine !== 'undefined' && Alpine.store('core')) {
        Alpine.store('core').setLabel(id, key, value);
      }
    }
  };
}
