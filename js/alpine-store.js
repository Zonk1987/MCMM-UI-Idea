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

  Alpine.store('i18n', {
    locale: 'de',
    messages: {},
    fallbackMessages: {},
    t(key, variables = {}) {
      // Read to trigger Alpine reactivity tracking
      const msgs = this.messages;
      const fallback = this.fallbackMessages;

      if (!msgs || Object.keys(msgs).length === 0) return key;

      const resolvePath = (obj, path) =>
        path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);

      let val = resolvePath(msgs, key);
      if (val === undefined && this.locale !== 'en') {
        val = resolvePath(fallback, key);
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
    },
  });

  Alpine.store('modals', {
    config: { open: false, data: {} },
  });
});
