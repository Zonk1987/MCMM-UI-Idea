class I18nStoreFactory {
  constructor(state = {}) {
    this.locale = state.currentLang || 'en';
    this.messages = state.translations || {};
    this.fallbackMessages = state.fallbackTranslations || {};
  }

  create() {
    return {
      locale: this.locale,
      messages: this.messages,
      fallbackMessages: this.fallbackMessages,
      t(key, variables = {}) {
        const resolvePath = (obj, path) =>
          path.split('.').reduce((value, segment) => (value ? value[segment] : undefined), obj);

        let value = resolvePath(this.messages, key);
        if (value === undefined && this.locale !== 'en') {
          value = resolvePath(this.fallbackMessages, key);
        }

        if (typeof value === 'string' && Object.keys(variables).length > 0) {
          return value.replace(/\{(\w+)\}/g, (match, name) => variables[name] ?? match);
        }

        return value ?? key;
      },
    };
  }
}

document.addEventListener('alpine:init', () => {
  Alpine.store('global', {
    dockerCount: 0,
    onlineGameservers: 0,
    onlinePlayers: 0,
  });

  Alpine.store('toasts', {
    items: [],
    add(msg, type = 'info') {
      const id = Date.now() + Math.random().toString(36).slice(2, 9); // NOSONAR
      const icons = { success: 'check_circle', error: 'error', info: 'info' };
      const icon = icons[type] || icons.info;

      this.items = [...this.items, { id, msg, type, icon }];

      const duration = typeof appSettings !== 'undefined' ? appSettings.toastDuration : 3500;
      setTimeout(() => {
        this.remove(id);
      }, duration);
    },
    remove(id) {
      this.items = this.items.filter((t) => t.id !== id);
    },
  });

  Alpine.store('i18n', new I18nStoreFactory(window.mcmmI18nState).create());

  Alpine.store('modals', {
    config: { open: false, data: {} },
  });
});
