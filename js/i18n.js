/**
 * @file i18n.js
 * @description Handles internationalization (i18n) by loading .json language files
 * and applying translations to the DOM and providing a global translation function.
 */

export const I18N = {
  currentLang: 'en',
  translations: {},
  supportedLangs: ['en', 'de', 'es', 'fr', 'it']
};

/**
 * Loads a language file and applies translations to the document.
 * @param {string} langCode - The language code to load (e.g., 'en', 'de', 'es').
 * @returns {Promise<void>}
 */
export async function loadLanguage(langCode) {
  if (!I18N.supportedLangs.includes(langCode)) {
    langCode = 'en'; // fallback
  }
  
  try {
    const response = await fetch(`lang/${langCode}.json?v=${new Date().getTime()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    I18N.translations = await response.json();
    I18N.currentLang = langCode;
    
    applyTranslations();
  } catch (error) {
    console.error(`Failed to load language: ${langCode}`, error);
    // If it fails, fallback to empty/keys so we at least don't crash
  }
}

/**
 * Applies the loaded translations to all DOM elements with the [data-i18n] attribute.
 */
export function applyTranslations() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const targetAttr = el.getAttribute('data-i18n-attr'); // e.g. "title", "placeholder"
    
    if (I18N.translations[key]) {
      if (targetAttr) {
        el.setAttribute(targetAttr, I18N.translations[key]);
      } else if ((el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')) || el.type === 'search') {
        el.placeholder = I18N.translations[key];
      } else {
        el.innerHTML = I18N.translations[key]; // use innerHTML in case we have span tags inside
      }
    }
  });
}

/**
 * Returns the translated string for a given key.
 * @param {string} key - The translation key.
 * @returns {string|undefined} The translated string, or undefined if not found (allows JS fallbacks to work).
 */
export function t(key) {
  return I18N.translations[key];
}

// Expose to window for Alpine.js dynamic bindings
window.t = t;

// Ensure i18n logic is initialized on load
export async function initI18n() {
  const savedSettings = localStorage.getItem('gs_hub_settings');
  let lang = 'en';
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.lang) lang = parsed.lang;
    } catch (e) {}
  }
  await loadLanguage(lang);
}
