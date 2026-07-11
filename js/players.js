/* ═══════════════════════════════════════════════════════════
   players.js — Player Manager Tab (Alpine.js Component)
   In production: communicates via RCON / Minecraft server API.
   Uses realistic mock data to demonstrate all functionality.
═══════════════════════════════════════════════════════════ */

/**
 *
 */
export function playersApp() {
  return {
    selectorOpen: false,

    playersData: {
      minecraft01: {
        online: [
          {
            name: 'Steve_Gaming',
            uuid: 'a8d3f1b2-e4c5-4a0d-9b6e-1234567890ab',
            ping: 24,
            playtime: '14h 22m',
            gamemode: 'survival',
            isOp: true,
          },
          {
            name: 'CreeperSlayer',
            uuid: 'b9e4c2a3-f5d6-4b1e-ac7f-2345678901bc',
            ping: 67,
            playtime: '3h 8m',
            gamemode: 'survival',
            isOp: false,
          },
          {
            name: 'DiamondMiner99',
            uuid: 'c0f5d3b4-a6e7-4c2f-bd80-3456789012cd',
            ping: 142,
            playtime: '1h 55m',
            gamemode: 'creative',
            isOp: false,
          },
        ],
        whitelist: [
          { name: 'Steve_Gaming', uuid: 'a8d3f1b2-e4c5-4a0d-9b6e-1234567890ab' },
          { name: 'CreeperSlayer', uuid: 'b9e4c2a3-f5d6-4b1e-ac7f-2345678901bc' },
          { name: 'DiamondMiner99', uuid: 'c0f5d3b4-a6e7-4c2f-bd80-3456789012cd' },
          { name: 'BuilderPro', uuid: 'd1a6e4c5-b7f8-4d3a-ce91-4567890123de' },
          { name: 'RedstoneWiz', uuid: 'e2b7f5d6-c8a9-4e4b-df02-5678901234ef' },
        ],
        bans: [
          {
            name: 'Griefer_666',
            uuid: 'f3c8a6e7-d9b0-4f5c-e013-6789012345f0',
            reason: 'Griefing und Belästigung',
            date: '2026-06-15',
            duration: 'Permanent',
          },
          {
            name: 'XrayHacker123',
            uuid: 'a4d9b7f8-e0c1-4a6d-f124-7890123456a1',
            reason: 'X-Ray Client',
            date: '2026-06-28',
            duration: '30 Tage',
          },
        ],
        chatlog: [
          { time: '13:14:22', player: 'Steve_Gaming', msg: 'Hat jemand Diamonds zum Tauschen?' },
          { time: '13:14:35', player: 'CreeperSlayer', msg: 'Ich hab 32 Stück!' },
          {
            time: '13:15:02',
            player: 'DiamondMiner99',
            msg: 'Tp zu mir, ich bau gerade einen neuen Palast',
          },
          { time: '13:15:44', player: 'Steve_Gaming', msg: 'Komm, schauen wir uns das an!' },
          { time: '13:16:10', player: 'CreeperSlayer', msg: 'Auf dem Weg!' },
          { time: '13:17:33', player: 'DiamondMiner99', msg: 'Braucht jemand Ender Pearls?' },
        ],
      },
      minecraft02: {
        online: [
          {
            name: 'PixelArtist',
            uuid: 'e5f0c8a9-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
            ping: 15,
            playtime: '2h 5m',
            gamemode: 'creative',
            isOp: true,
          },
        ],
        whitelist: [
          { name: 'PixelArtist', uuid: 'e5f0c8a9-1b2c-3d4e-5f6a-7b8c9d0e1f2a' },
          { name: 'CreativePro', uuid: 'f6a1d9b0-2c3d-4e5f-6a7b-8c9d0e1f2a3b' },
        ],
        bans: [],
        chatlog: [
          { time: '12:55:10', player: 'PixelArtist', msg: 'Wer möchte beim Stadion mitbauen?' },
        ],
      },
      valheim01: {
        online: [
          {
            name: 'OdinSon',
            uuid: 'v-123456',
            ping: 32,
            playtime: '4h 10m',
            gamemode: 'survival',
            isOp: true,
          },
          {
            name: 'VikingWarrior',
            uuid: 'v-654321',
            ping: 45,
            playtime: '1h 20m',
            gamemode: 'survival',
            isOp: false,
          },
        ],
        whitelist: [
          { name: 'OdinSon', uuid: 'v-123456' },
          { name: 'VikingWarrior', uuid: 'v-654321' },
        ],
        bans: [],
        chatlog: [
          { time: '13:10:00', player: 'OdinSon', msg: 'Lass uns den Sumpf erkunden.' },
          { time: '13:12:30', player: 'VikingWarrior', msg: 'Bin gleich da, brauche noch Pfeile.' },
        ],
      },
    },

    state: {
      server: '',
      subtab: 'online',
      banTarget: null,
      banReason: '',
      banDuration: 'permanent',
      chatInput: '',
    },

    get servers() {
      return window.Alpine && Alpine.store('core') ? Alpine.store('core').getGameservers() : [];
    },

    get activeData() {
      return this.playersData[this.state.server] || null;
    },

    get onlineCount() {
      return this.activeData?.online?.length || 0;
    },

    get serverLabel() {
      if (!this.state.server) return 'Server auswählen...';
      return (
        this.servers.find((s) => s.containerId === this.state.server)?.serverName ||
        this.state.server
      );
    },

    init() {
      // Available servers are now fetched dynamically via the servers getter

      const autoSelect = () => {
        if (!this.state.server && this.servers.length > 0) {
          const firstOnline = this.servers.find((s) => s.status === 'online');
          if (firstOnline) this.state.server = firstOnline.containerId;
        }
      };

      autoSelect();

      // Allow global triggering
      window.selectPlayerServer = (serverId) => {
        this.state.server = serverId;
      };

      // Listen for tab changes
      window.addEventListener('tab-changed', (e) => {
        if (e.detail === 'players') {
          autoSelect();
        }
      });
    },

    // ─── Actions ───
    kickPlayer(player) {
      if (!this.activeData) return;
      this.activeData.online = this.activeData.online.filter((p) => p.name !== player);
      if (typeof showToast === 'function')
        showToast(
          `${player} ${typeof t === 'function' ? t('was_kicked') || 'wurde gekickt' : 'wurde gekickt'}`,
          'info'
        );
    },

    openBanModal(player) {
      this.state.banTarget = player;
      this.state.banReason = '';
      this.state.banDuration = 'permanent';
      if (typeof window.toggleModal === 'function') window.toggleModal('banModal', true);
    },

    confirmBan() {
      const player = this.state.banTarget;
      if (!player || !this.activeData) return;

      this.activeData.online = this.activeData.online.filter((p) => p.name !== player);
      this.activeData.bans.push({
        name: player,
        uuid: '—',
        reason:
          this.state.banReason ||
          (typeof t === 'function'
            ? t('no_reason') || 'Kein Grund angegeben'
            : 'Kein Grund angegeben'),
        date: new Date().toLocaleDateString('de-DE'),
        duration:
          this.state.banDuration === 'permanent'
            ? typeof t === 'function'
              ? t('general.duration_permanent') || 'Permanent'
              : 'Permanent'
            : this.state.banDuration,
      });

      if (typeof window.toggleModal === 'function') window.toggleModal('banModal', false);
      if (typeof showToast === 'function')
        showToast(
          `${player} ${typeof t === 'function' ? t('was_banned') || 'wurde gebannt' : 'wurde gebannt'}`,
          'error'
        );
    },

    unbanPlayer(player) {
      if (!this.activeData) return;
      this.activeData.bans = this.activeData.bans.filter((b) => b.name !== player);
      if (typeof showToast === 'function')
        showToast(
          `${player} ${typeof t === 'function' ? t('was_unbanned') || 'wurde entbannt' : 'wurde entbannt'}`,
          'success'
        );
    },

    opPlayer(player) {
      if (!this.activeData) return;
      const p = this.activeData.online.find((x) => x.name === player);
      if (p) {
        p.isOp = true;
        if (typeof showToast === 'function')
          showToast(
            `${player} ${typeof t === 'function' ? t('now_has_op') || 'hat jetzt OP-Rechte' : 'hat jetzt OP-Rechte'}`,
            'success'
          );
      }
    },

    tpPlayer(player) {
      if (typeof showToast === 'function')
        showToast(
          `${typeof t === 'function' ? t('tp_to') || 'Teleportiere zu' : 'Teleportiere zu'} ${player}...`,
          'info'
        );
    },

    msgPlayer(player) {
      const msg = prompt(
        `${typeof t === 'function' ? t('msg_to') || 'Nachricht an' : 'Nachricht an'} ${player}:`
      );
      if (msg?.trim() && typeof showToast === 'function') {
        showToast(
          `${typeof t === 'function' ? t('msg_sent') || 'Nachricht an' : 'Nachricht an'} ${player} ${typeof t === 'function' ? t('sent') || 'gesendet' : 'gesendet'}`,
          'success'
        );
      }
    },

    isPlayerOp(playerName) {
      if (!this.activeData) return false;
      const p = this.activeData.online.find((x) => x.name === playerName);
      return p ? p.isOp : false;
    },

    toggleGamemode(player) {
      if (!this.activeData) return;
      const p = this.activeData.online.find((x) => x.name === player);
      if (!p) return;
      const GM_CYCLE = ['survival', 'creative', 'adventure', 'spectator'];
      const cur = GM_CYCLE.indexOf(p.gamemode || 'survival');
      p.gamemode = GM_CYCLE[(cur + 1) % GM_CYCLE.length];

      if (typeof showToast === 'function')
        showToast(`${player}: Gamemode → ${this.getGmLabel(p.gamemode)}`, 'info');
    },

    getGmLabel(gm) {
      const GM_LABEL = {
        survival: 'Survival',
        creative: 'Creative',
        adventure: 'Adventure',
        spectator: 'Spectator',
      };
      return GM_LABEL[gm] || gm || 'survival';
    },

    pingClass(ms) {
      if (ms < 60) return 'ping-good';
      if (ms < 150) return 'ping-ok';
      return 'ping-bad';
    },

    removeWhitelist(player) {
      if (!this.activeData) return;
      this.activeData.whitelist = this.activeData.whitelist.filter((p) => p.name !== player);
      if (typeof showToast === 'function')
        showToast(
          `${player} ${typeof t === 'function' ? t('removed_from_whitelist') || 'von Whitelist entfernt' : 'von Whitelist entfernt'}`,
          'info'
        );
    },

    addWhitelist() {
      const name = prompt(
        `${typeof t === 'function' ? t('enter_player_name') || 'Spielername eingeben:' : 'Spielername eingeben:'}`
      );
      if (name?.trim() && this.activeData) {
        this.activeData.whitelist.push({ name: name.trim(), uuid: 'neu-' + Date.now() });
        if (typeof showToast === 'function')
          showToast(
            `${name.trim()} ${typeof t === 'function' ? t('added_to_whitelist') || 'zur Whitelist hinzugefügt' : 'zur Whitelist hinzugefügt'}`,
            'success'
          );
      }
    },

    sendChat() {
      if (!this.state.chatInput.trim() || !this.activeData) return;
      this.activeData.chatlog.push({
        time: new Date().toLocaleTimeString('de-DE'),
        player: '[Konsole]',
        msg: this.state.chatInput.trim(),
      });
      if (typeof showToast === 'function')
        showToast(
          `${typeof t === 'function' ? t('cmd_sent') || 'Befehl gesendet:' : 'Befehl gesendet:'} ${this.state.chatInput.trim()}`,
          'success'
        );
      this.state.chatInput = '';
    },
  };
}

/**
 *
 */
export function initPlayers() {} // Dummy for compatibility
/**
 *
 * @param img
 */
export function playerAvatarError(img) {
  img.onerror = null;
  img.src =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234b5563"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
}
