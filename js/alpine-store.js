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
    install: {
      open: false,
      data: {
        name: '',
        serverName: '',
        author: 'Unknown',
        isEdit: false,
        port: 25565,
        ram: 4096,
        initRam: 1024,
        path: '/mnt/user/gameservers/',
        type: 'AUTO',
        restart: 'unless-stopped',
        maxPlayers: 20,
        difficulty: 'normal',
        motd: 'Mein Unraid Server',
        pvp: true,
        onlineMode: true,
        cmdBlocks: true,
        hardcore: false,
        flight: false,
        enableWhitelist: false,
        whitelist: '',
        aikar: true,
        meowice: false,
        graalvm: false,
        largePages: false,
        rollingLogs: true,
        source: 'curseforge',
      },
      getPreviewCmd() {
        const d = this.data;
        if (!d?.name) return '';
        let envType = d.type;
        if (d.type === 'AUTO') {
          envType = d.source === 'curseforge' ? 'CURSEFORGE' : 'MODRINTH';
        }

        const args = [
          'docker run -d',
          `--name ${d.name}`,
          `--restart ${d.restart}`,
          `-p ${d.port}:25565`,
          `-v ${d.path}:/data`,
          '-e EULA=TRUE',
          `-e TYPE=${envType}`,
          `-e SERVER_NAME="${d.serverName}"`,
        ];

        if (d.icon) args.push(`-e ICON="${d.icon}"`);
        args.push(`-e MEMORY=${d.ram}M`);
        args.push(`-e INIT_MEMORY=${d.initRam}M`);
        args.push(`-e MAX_PLAYERS=${d.maxPlayers}`);
        args.push(`-e DIFFICULTY=${d.difficulty}`);
        args.push(`-e MOTD="${d.motd}"`);
        args.push(`-e PVP=${d.pvp}`);
        args.push(`-e HARDCORE=${d.hardcore}`);
        args.push(`-e ALLOW_FLIGHT=${d.flight}`);
        args.push(`-e ONLINE_MODE=${d.onlineMode}`);
        args.push(`-e ENABLE_COMMAND_BLOCK=${d.cmdBlocks}`);

        if (d.enableWhitelist) {
          args.push('-e ENABLE_WHITELIST=true');
          if (d.whitelist) args.push(`-e WHITELIST="${d.whitelist}"`);
        }

        if (d.meowice) {
          args.push('-e USE_MEOWICE_FLAGS=true');
          args.push('-e USE_MEOWICE_GRAALVM_FLAGS=true');
        } else if (d.aikar) {
          args.push('-e USE_AIKAR_FLAGS=true');
        }

        args.push(`-e USE_LARGE_PAGES=${d.largePages}`);
        args.push(`-e ENABLE_ROLLING_LOGS=${d.rollingLogs}`);

        const providerEnv = d.source === 'curseforge' ? 'CF_SLUG' : 'MODRINTH_MODPACK';
        args.push(`-e ${providerEnv}="${d.id}"`);
        args.push('itzg/minecraft-server:latest');

        let cmd = args.join(' \\\n  ');
        return cmd.replaceAll('\\', '<span style="color:var(--text-muted)">\\</span>');
      },
      copyCmd() {
        const rawCmd = this.getPreviewCmd()
          .replaceAll(/<span[^>]*>/g, '')
          .replaceAll(/<\/span>/g, '');
        navigator.clipboard.writeText(rawCmd);
        if (typeof showToast === 'function') showToast('Kopiert!', 'success');
      },
    },
  });
});
