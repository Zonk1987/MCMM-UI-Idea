/* ═══════════════════════════════════════════════════════════
   utils.js — Shared helpers for all modules
═══════════════════════════════════════════════════════════ */

/**
 * Fallback for broken Minecraft avatar images.
 * Called via onerror attribute — avoids HTML injection in template literals.
 * @param {HTMLImageElement} img - The image element that failed to load
 */
export function playerAvatarError(img) {
  const placeholder = document.createElement('div');
  placeholder.className = 'player-avatar-placeholder';
  placeholder.textContent = '👤';
  img.replaceWith(placeholder);
}

/**
 *
 * @param msg
 * @param type
 */
export function showToast(msg, type = 'info') {
  window.dispatchEvent(new CustomEvent('toast', { detail: { msg, type } }));
}

/**
 *
 */
function getLocale() {
  const locale = window.Alpine?.store('i18n')?.locale;
  if (locale) {
    return locale;
  }
  return typeof appSettings !== 'undefined' ? appSettings.lang : 'en';
}

/**
 *
 * @param n
 * @param compact
 */
export function formatNum(n, compact = true) {
  const locale = getLocale();
  if (compact && n >= 1000) {
    return new Intl.NumberFormat(locale, { notation: 'compact', compactDisplay: 'short' }).format(
      n
    );
  }
  return new Intl.NumberFormat(locale).format(n);
}

/**
 *
 * @param dateInput
 * @param options
 */
const defaultDateOptions = { dateStyle: 'medium' };
/**
 *
 * @param dateInput
 * @param options
 */
export function formatDate(dateInput, options = defaultDateOptions) {
  const locale = getLocale();
  return new Intl.DateTimeFormat(locale, options).format(new Date(dateInput));
}

/**
 *
 * @param bytes
 */
export function formatBytes(bytes) {
  const locale = getLocale();
  if (bytes >= 1073741824)
    return (
      new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1073741824) + ' GB'
    );
  if (bytes >= 1048576)
    return (
      new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(bytes / 1048576) + ' MB'
    );
  return new Intl.NumberFormat(locale).format(bytes) + ' B';
}

/**
 *
 * @param fn
 * @param delay
 */
export function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 *
 * @param fn
 * @param limit
 */
export function throttle(fn, limit = 350) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export const Logger = {
  get isDebug() {
    return typeof appSettings !== 'undefined' ? appSettings.debugMode : false;
  },
  log(...args) {
    if (this.isDebug) console.log('[MCMM]', ...args);
  },
  warn(...args) {
    if (this.isDebug) console.warn('[MCMM]', ...args);
  },
  error(...args) {
    if (this.isDebug) console.error('[MCMM]', ...args);
  },
};

/**
 *
 * @param modalId
 * @param open
 */
export function toggleModal(modalId, open) {
  const el = document.getElementById(modalId);
  if (!el) return;
  if (open) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
}

/**
 *
 * @param id
 * @param url
 */
export async function fetchComponent(id, url) {
  try {
    const el = document.getElementById(id);
    // If it's already loaded (no '<!-- Component loaded dynamically -->' comment inside)
    if (el && el.innerHTML.trim() !== '<!-- Component loaded dynamically -->') return;

    const cacheBuster = `?v=${Date.now()}`;
    const response = await fetch(url + cacheBuster);
    if (response.ok) {
      const html = await response.text();
      if (el) {
        // Prevent execution of arbitrary client-side code by parsing safely
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newEl = doc.body.firstElementChild;
        if (newEl) {
          el.replaceWith(newEl);
        }
      }
    }
  } catch (e) {
    console.error(`Error loading ${url}:`, e);
  }
}

const loadedModules = new Set();

/**
 *
 * @param tabId
 */
export async function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabId);
    b.setAttribute('aria-selected', b.dataset.tab === tabId);
  });

  if (!loadedModules.has(tabId)) {
    try {
      switch (tabId) {
        case 'docker': {
          await fetchComponent('panel-docker', 'components/docker.html');
          break;
        }
        case 'gameserver': {
          const gs = await import('./gameserver.js?v=31');
          window.gameserverApp = gs.gameserverApp;
          window.openConsole = gs.openConsole;
          await fetchComponent('panel-gameserver', 'components/gameservers.html?v=28');
          break;
        }
        case 'players': {
          const pl = await import('./players.js?v=21');
          window.playersApp = pl.playersApp;
          await fetchComponent('panel-players', 'components/players.html');
          break;
        }
        case 'game-additions': {
          const ga = await import('./gameAdditions.js?v=26');
          window.GameAdditions = ga.GameAdditions;
          await fetchComponent('panel-game-additions', 'components/gameAdditions.html?v=23');
          ga.GameAdditions?.init?.();
          break;
        }
      }
      loadedModules.add(tabId);
    } catch (error) {
      console.error(`Failed to load the ${tabId} module:`, error);
    }
  }

  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('active', p.id === `panel-${tabId}`);
  });
  window.dispatchEvent(new CustomEvent('tab-changed', { detail: tabId }));
}

/**
 *
 * @param ms
 */
export function pingClass(ms) {
  if (ms < 60) return 'ping-good';
  if (ms < 150) return 'ping-ok';
  return 'ping-bad';
}

/**
 *
 * @param count
 */
export function skeletonGrid(count = 6) {
  return Array.from({ length: count }, () => `<div class="skeleton skeleton-card"></div>`).join('');
}

// Expose to window for Alpine and inline HTML handlers
window.showToast = showToast;
window.toggleModal = toggleModal;
window.switchTab = switchTab;
window.playerAvatarError = playerAvatarError;
window.formatNum = formatNum;
window.formatBytes = formatBytes;
window.pingClass = pingClass;
