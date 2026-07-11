/* ═══════════════════════════════════════════════════════════
   alpine-components.js
   Stores Alpine.js component definitions that were previously 
   inline inside the HTML (e.g., modals).
═══════════════════════════════════════════════════════════ */

/**
 *
 * @param Alpine
 */
export function registerAlpineComponents(Alpine) {
  // Welcome/Onboarding Modal
  Alpine.data('welcomeModal', () => ({
    step: 1,
  }));

  // Config Modal
  Alpine.data('configModal', () => ({
    open: false,
    activeTab: 'config',
    data: {},
    openModal(payload) {
      this.data = payload || {};
      this.activeTab = 'config';
      this.open = true;
    },
  }));

  // Config Modal Form Mode (Preset / Manual)
  Alpine.data('configMode', () => ({
    mode: 'preset',
  }));

  // Install/Edit Modal
  Alpine.data('installModal', () => ({
    open: false,
    activeTab: 'config',
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
    openModal(payload) {
      this.data = { ...this.data, ...payload };
      this.open = true;
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
  }));

  // Folder Modal (FolderView3 Clone)
  Alpine.data('folderModal', () => ({
    open: false,
    activeTab: 'basic',
    folderName: '',
    // Map of containerId -> boolean (included in folder)
    includedContainers: {},
    originalFolderName: null,

    openModal(e) {
      if (e?.detail?.folderName) {
        this.folderName = e.detail.folderName;
        this.originalFolderName = e.detail.folderName;
        this.includedContainers = {};
        if (Alpine.store('core')) {
          Alpine.store('core').containers.forEach((c) => {
            if (c.labels?.['folder.view3'] === this.folderName) {
              this.includedContainers[c.id] = true;
            }
          });
        }
      } else {
        this.folderName = '';
        this.originalFolderName = null;
        this.includedContainers = {};
      }
      this.activeTab = 'basic';
      this.open = true;
    },

    saveFolder() {
      if (!this.folderName || this.folderName.trim() === '') {
        if (typeof showToast === 'function') showToast('Ordnername darf nicht leer sein', 'error');
        return;
      }
      const fName = this.folderName.trim();

      // Save folder to store
      if (Alpine.store('core')) {
        if (this.originalFolderName && this.originalFolderName !== fName) {
          Alpine.store('core').renameFolder(this.originalFolderName, fName);
        } else {
          Alpine.store('core').addFolder(fName);
        }

        // Apply labels to checked containers, remove from unchecked
        Alpine.store('core').containers.forEach((c) => {
          if (this.includedContainers[c.id]) {
            Alpine.store('core').setLabel(c.id, 'folder.view3', fName);
          } else if (c.labels?.['folder.view3'] === fName) {
            Alpine.store('core').setLabel(c.id, 'folder.view3', '');
          }
        });

        if (typeof showToast === 'function')
          showToast('Ordner "' + fName + '" gespeichert', 'success');
      }

      this.open = false;
    },
  }));
}
