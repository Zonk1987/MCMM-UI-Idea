/**
 * @file i18n.js
 * @description Handles internationalization (i18n) by loading .json language files
 * and applying translations to the Alpine global store.
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
    
    if (window.Alpine) {
      const store = Alpine.store('i18n');
      if (store) {
        store.locale = langCode;
        store.messages = I18N.translations;
      }
    }
  } catch (error) {
    console.error(`Failed to load language: ${langCode}`, error);
    // If it fails, fallback to empty/keys so we at least don't crash
  }
}

/**
 * Returns the translated string for a given key.
 * @param {string} key - The translation key.
 * @returns {string|undefined} The translated string, or undefined if not found (allows JS fallbacks to work).
 */
export function t(key) {
  return I18N.translations[key];
}

// Expose to window for JS dynamic bindings (outside Alpine context)
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
