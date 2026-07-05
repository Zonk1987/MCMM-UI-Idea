/* ═══════════════════════════════════════════════════════════
   alpine-components.js
   Stores Alpine.js component definitions that were previously 
   inline inside the HTML (e.g., modals).
═══════════════════════════════════════════════════════════ */

export function registerAlpineComponents(Alpine) {
  // Welcome/Onboarding Modal
  Alpine.data('welcomeModal', () => ({
    step: 1
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
    }
  }));

  // Config Modal Form Mode (Preset / Manual)
  Alpine.data('configMode', () => ({
    mode: 'preset'
  }));

  // Install/Edit Modal
  Alpine.data('installModal', () => ({
    open: false,
    activeTab: 'config',
    data: {
      name: '', serverName: '', author: 'Unknown', isEdit: false,
      port: 25565, ram: 4096, initRam: 1024, path: '/mnt/user/gameservers/',
      type: 'AUTO', restart: 'unless-stopped', maxPlayers: 20, difficulty: 'normal',
      motd: 'Mein Unraid Server', pvp: true, onlineMode: true, cmdBlocks: true,
      hardcore: false, flight: false, enableWhitelist: false, whitelist: '',
      aikar: true, meowice: false, graalvm: false, largePages: false, rollingLogs: true,
      source: 'curseforge'
    },
    openModal(payload) {
      this.data = { ...this.data, ...payload };
      this.open = true;
    },
    getPreviewCmd() {
      const d = this.data;
      if (!d || !d.name) return '';
      let envType = d.type === 'AUTO' ? (d.source === 'curseforge' ? 'CURSEFORGE' : 'MODRINTH') : d.type;
      let jvmEnvs = '';
      if (d.meowice) {
        jvmEnvs = '-e USE_MEOWICE_FLAGS=true \\\n  -e USE_MEOWICE_GRAALVM_FLAGS=true \\';
      } else if (d.aikar) {
        jvmEnvs = '-e USE_AIKAR_FLAGS=true \\';
      }
      let cmd = `docker run -d \\
  --name ${d.name} \\
  --restart ${d.restart} \\
  -p ${d.port}:25565 \\
  -v ${d.path}:/data \\
  -e EULA=TRUE \\
  -e TYPE=${envType} \\
  -e SERVER_NAME="${d.serverName}" \\
  ${d.icon ? `-e ICON="${d.icon}" \\\n  ` : ''}-e MEMORY=${d.ram}M \\
  -e INIT_MEMORY=${d.initRam}M \\
  -e MAX_PLAYERS=${d.maxPlayers} \\
  -e DIFFICULTY=${d.difficulty} \\
  -e MOTD="${d.motd}" \\
  -e PVP=${d.pvp} \\
  -e HARDCORE=${d.hardcore} \\
  -e ALLOW_FLIGHT=${d.flight} \\
  -e ONLINE_MODE=${d.onlineMode} \\
  -e ENABLE_COMMAND_BLOCK=${d.cmdBlocks} \\
  ${d.enableWhitelist ? `-e ENABLE_WHITELIST=true \\\n  ${d.whitelist ? `-e WHITELIST="${d.whitelist}" \\\n  ` : ''}` : ''}${jvmEnvs ? jvmEnvs + '\n  ' : ''}-e USE_LARGE_PAGES=${d.largePages} \\
  -e ENABLE_ROLLING_LOGS=${d.rollingLogs} \\
  -e ${d.source === 'curseforge' ? 'CF_SLUG' : 'MODRINTH_MODPACK'}="${d.id}" \\
  itzg/minecraft-server:latest`;
      return cmd.replace(/\\/g, '<span style="color:var(--text-muted)">\\</span>');
    },
    copyCmd() {
      const rawCmd = this.getPreviewCmd().replace(/<[^>]*>?/gm, '');
      navigator.clipboard.writeText(rawCmd);
      if (typeof showToast === 'function') showToast('Kopiert!', 'success');
    }
  }));
}
