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

export function showToast(msg, type = 'info') {
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="material-icons-round toast-icon">${icons[type]}</span>
    <span class="toast-msg">${msg}</span>
  `;
  document.getElementById('toastContainer').appendChild(toast);
  
  // Use duration from settings if available, default to 3500ms
  const duration = (typeof appSettings !== 'undefined') ? appSettings.toastDuration : 3500;
  
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function formatBytes(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576)    return (bytes / 1048576).toFixed(0) + ' MB';
  return bytes + ' B';
}

export function debounce(fn, delay = 350) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

export function throttle(fn, limit = 350) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
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
  }
};

export function toggleModal(modalId, open) {
  const el = document.getElementById(modalId);
  if (!el) return;
  if (open) el.removeAttribute('hidden');
  else      el.setAttribute('hidden', '');
}

export function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
    b.setAttribute('aria-selected', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${tabId}`);
  });
}

export function pingClass(ms) {
  if (ms < 60)  return 'ping-good';
  if (ms < 150) return 'ping-ok';
  return 'ping-bad';
}

export function skeletonGrid(count = 6) {
  return Array.from({ length: count }, () =>
    `<div class="skeleton skeleton-card"></div>`
  ).join('');
}

// Expose to window for Alpine and inline HTML handlers
window.showToast = showToast;
window.toggleModal = toggleModal;
window.switchTab = switchTab;
window.playerAvatarError = playerAvatarError;
window.formatNum = formatNum;
window.formatBytes = formatBytes;
window.pingClass = pingClass;
