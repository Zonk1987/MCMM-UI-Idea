/**
 * @file i18n.js
 * @description Handles internationalization (i18n) by loading .json language files
 * and applying translations to the Alpine global store.
 */

export const I18N = {
  currentLang: 'en',
  translations: {},
  fallbackTranslations: {},
  supportedLangs: ['en', 'de', 'es', 'fr', 'it'],
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
    // Load English fallback if not loaded
    if (Object.keys(I18N.fallbackTranslations).length === 0) {
      try {
        const fbRes = await fetch(`lang/en.json?v=${Date.now()}`);
        if (fbRes.ok) I18N.fallbackTranslations = await fbRes.json();
      } catch (e) {
        console.error('Failed to load English fallback', e);
      }
    }

    const response = await fetch(`lang/${langCode}.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    I18N.translations = await response.json();
    I18N.currentLang = langCode;

    // Trigger reactivity in Alpine if available
    if (window.Alpine) {
      const store = Alpine.store('i18n');
      if (store) {
        store.locale = langCode;
        store.fallbackMessages = I18N.fallbackTranslations;
        store.messages = I18N.translations; // Alpine reactivity trigger
      }
    }
  } catch (error) {
    console.error(`Failed to load language: ${langCode}`, error);
  }
}

/**
 *
 * @param obj
 * @param path
 */
function resolvePath(obj, path) {
  return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
}

/**
 * Returns the translated string for a given key, with fallback to English.
 * @param {string} key - The translation key (dot-notation supported).
 * @param {object} variables - Optional variables for interpolation.
 * @returns {string} The translated string or the key itself if not found.
 */
export function t(key, variables = {}) {
  let val = resolvePath(I18N.translations, key);

  // Fallback to English if key is missing in the current language
  if (val === undefined && I18N.currentLang !== 'en') {
    val = resolvePath(I18N.fallbackTranslations, key);
  }

  if (val !== undefined) {
    if (typeof val === 'string' && Object.keys(variables).length > 0) {
      return val.replace(/\{(\w+)\}/g, (match, p1) => {
        return variables[p1] !== undefined ? variables[p1] : match;
      });
    }
    return val;
  }

  return key;
}

// Expose to window for JS dynamic bindings and Alpine Store
window.t = t;

// Ensure i18n logic is initialized on load
/**
 *
 */
export async function initI18n() {
  const savedSettings = localStorage.getItem('gs_hub_settings');
  let lang = 'en';
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.lang) lang = parsed.lang;
    } catch (e) {
      console.warn('Failed to parse settings for i18n', e);
    }
  }
  await loadLanguage(lang);
}
