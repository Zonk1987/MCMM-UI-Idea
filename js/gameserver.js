/* ═══════════════════════════════════════════════════════════
   gameserver.js — Game Server Hub Tab
   Displays existing game server containers with live stats and management tools.
═══════════════════════════════════════════════════════════ */

import { ContainerCommandClient } from './container-command-client.js?v=23';
import { GameServerFileClient } from './game-server-file-client.js?v=23';
import { GameServerFileManager } from './game-server-file-manager.js?v=23';
import { MinecraftContentClient } from './minecraft-content-client.js?v=2';
import { MinecraftContentManager } from './minecraft-content-manager.js?v=2';
import { ModrinthClient } from './modrinth-client.js?v=2';

export const GAME_TEMPLATES = [
  {
    id: 'minecraft',
    name: 'Minecraft',
    icon: '⛏',
    color: '#4CAF50',
    defaultImage: 'itzg/minecraft-server:latest',
    defaultPort: 25565,
    defaultRam: 4096,
    category: 'survival',
    env: [
      'EULA=TRUE',
      'TYPE=PAPER',
      'VERSION=LATEST',
      'MEMORY=4G',
      'MAX_PLAYERS=20',
      'MOTD=Mein Unraid Minecraft Server',
    ],
  },
  {
    id: 'valheim',
    name: 'Valheim',
    icon: '🪓',
    color: '#795548',
    defaultImage: 'lloesche/valheim-server:latest',
    defaultPort: 2456,
    defaultRam: 2048,
    category: 'survival',
    env: ['SERVER_NAME=Valheim', 'WORLD_NAME=Midgard', 'SERVER_PASS=secret'],
  },
  {
    id: 'palworld',
    name: 'Palworld',
    icon: '🦎',
    color: '#8BC34A',
    defaultImage: 'thijsvanloef/palworld-server-docker:latest',
    defaultPort: 8211,
    defaultRam: 8192,
    category: 'survival',
    env: ['PLAYERS=32', 'MULTITHREADING=true'],
  },
  {
    id: 'cs2',
    name: 'CS2',
    icon: '🔫',
    color: '#FF9800',
    defaultImage: 'joedwards32/cs2:latest',
    defaultPort: 27015,
    defaultRam: 4096,
    category: 'shooter',
    env: ['CS2_MAXPLAYERS=12', 'CS2_GAMETYPE=0'],
  },
  {
    id: 'ark',
    name: 'ARK: SA',
    icon: '🦕',
    color: '#607D8B',
    defaultImage: 'mschnitzer/arksurvivalascended:latest',
    defaultPort: 7777,
    defaultRam: 12288,
    category: 'survival',
    env: ['SESSION_NAME=ARK', 'MAX_PLAYERS=10'],
  },
  {
    id: 'terraria',
    name: 'Terraria',
    icon: '⚔️',
    color: '#9C27B0',
    defaultImage: 'ryshe/terrariaserver:latest',
    defaultPort: 7777,
    defaultRam: 1024,
    category: 'sandbox',
    env: ['WORLD_NAME=Terraria', 'MAX_PLAYERS=8'],
  },
  {
    id: 'factorio',
    name: 'Factorio',
    icon: '🏭',
    color: '#E67E22',
    defaultImage: 'factoriotools/factorio:stable',
    defaultPort: 34197,
    defaultRam: 2048,
    category: 'strategy',
    env: ['SAVE_NAME=factorio-save'],
  },
  {
    id: '7dtd',
    name: '7 Days to Die',
    icon: '🧟',
    color: '#B71C1C',
    defaultImage: 'dkxce/7dtd-server:latest',
    defaultPort: 26900,
    defaultRam: 6144,
    category: 'survival',
    env: ['SERVERCONFIG=serverconfig.xml'],
  },
  {
    id: 'rust',
    name: 'Rust',
    icon: '🔩',
    color: '#FF5722',
    defaultImage: 'didstopia/rust-server:latest',
    defaultPort: 28015,
    defaultRam: 8192,
    category: 'survival',
    env: ['RUST_SERVER_STARTUP_ARGUMENTS=-batchmode -nographics'],
  },
];

/**
 *
 */
export function gameserverApp() {
  const commandClient = new ContainerCommandClient();
  return {
    get instances() {
      return Alpine.store('core').getGameservers();
    },
    templates: GAME_TEMPLATES.filter((template) => template.id === 'minecraft'),
    wizardStep: 0,
    wizardGame: null,
    creating: false,
    pendingServerIds: new Set(),
    wForm: {
      name: '',
      image: '',
      port: '',
      ram: '',
      path: '',
      type: 'PAPER',
      version: 'LATEST',
      javaRuntime: 'auto',
      modpack: '',
      modpackVersion: '',
      loader: '',
      projects: '',
      maxPlayers: 20,
      motd: 'Minecraft Server on Unraid',
      eula: false,
    },

    init() {
      Alpine.store('core')?.refreshContainers(true);
    },

    get onlineCount() {
      return this.instances.filter((s) => s.status === 'online').length;
    },

    getTemplate(gameId) {
      return this.templates.find((template) => template.id === gameId) || this.templates[0];
    },

    async toggleServer(id) {
      const server = this.instances.find((entry) => entry.containerId === id);
      if (!server || this.pendingServerIds.has(id)) return;
      const action = server.status === 'online' ? 'stop' : 'start';
      this.pendingServerIds.add(id);
      try {
        await commandClient.execute(action, server.container);
        await Alpine.store('core').refreshContainers(true);
        showToast(`${server.serverName} ${action === 'start' ? 'started' : 'stopped'}`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), 'error');
      } finally {
        this.pendingServerIds.delete(id);
      }
    },

    // Wizard Logic
    openCreateWizard() {
      showToast('Minecraft server deployment is intentionally disabled.', 'info');
    },

    closeCreateWizard() {
      const modal = document.getElementById('createServerModal');
      modal.classList.remove('active');
      modal.hidden = true;
    },

    selectWizardGame(id) {
      this.wizardGame = this.templates.find((t) => t.id === id);
    },

    nextWizardStep() {
      if (this.wizardStep === 0 && this.wizardGame) {
        this.wForm.name = this.wizardGame.name + '-Server';
        this.wForm.image = this.wizardGame.defaultImage;
        this.wForm.port = this.wizardGame.defaultPort;
        this.wForm.ram = this.wizardGame.defaultRam;
        this.wForm.path = '/mnt/user/gameservers/' + this.wizardGame.name.toLowerCase();
        this.wForm.type = 'PAPER';
        this.wForm.version = 'LATEST';
        this.wForm.javaRuntime = 'auto';
        this.wForm.modpack = '';
        this.wForm.modpackVersion = '';
        this.wForm.loader = '';
        this.wForm.projects = '';
        this.wForm.maxPlayers = 20;
        this.wForm.motd = 'Minecraft Server on Unraid';
        this.wForm.eula = false;
        this.wizardStep = 1;
      } else if (this.wizardStep === 1) {
        this.wizardStep = 2;
      }
    },

    prevWizardStep() {
      if (this.wizardStep > 0) this.wizardStep--;
    },

    getWizardCmd() {
      return 'Minecraft server deployment is disabled.';
    },

    getJavaRuntimeRecommendation() {
      return { value: '', label: 'Disabled', reason: 'Provisioning will use a different flow.' };
    },

    async createWizardServer() {
      showToast('Minecraft server deployment is intentionally disabled.', 'info');
    },

    // Sparkline Helper
    getSparkline(id, val, color) {
      return generateSparkline(id, val, color);
    },

    getRamLabel(srv) {
      return (srv.ram.used / 1024).toFixed(2) + 'G';
    },

    getRamPct(srv) {
      return srv.ram.max > 0 ? Math.min(100, Math.round((srv.ram.used / srv.ram.max) * 100)) : 0;
    },

    formatBytesLabel(bytes) {
      if (typeof formatBytes === 'function') return formatBytes(bytes);
      return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    },
  };
}

// Dummy backward compatibility
/**
 *
 */
export function initGameServer() {} // NOSONAR

/**
 *
 */
export function renderGameServers() {} // NOSONAR

/**
 * Generates an inline SVG sparkline string based on a current value.
 * Simulates a historical graph for premium feel.
 * @param id
 * @param val
 * @param color
 */
export function generateSparkline(id, val, color) {
  // Clamp value
  const v = Math.min(Math.max(val, 0), 100);

  // Generate some fake historical points based on the current value
  const points = [];
  let currentY = 28 - (v / 100) * 28;
  points.push(`100,${currentY}`); // Current value on the right

  for (let i = 1; i <= 5; i++) {
    const x = 100 - i * 20;
    // Randomize past values slightly, but trend towards the current value
    const deviation = Math.random() * 30 - 15; // NOSONAR
    const pastV = Math.min(Math.max(v + deviation, 0), 100);
    const y = 28 - (pastV / 100) * 28;
    points.unshift(`${x},${y}`);
  }

  const pathD = `M0,28 L${points[0]} L${points[1]} L${points[2]} L${points[3]} L${points[4]} L${points[5]} L100,28 Z`;
  const strokeD = `M${points[0]} L${points[1]} L${points[2]} L${points[3]} L${points[4]} L${points[5]}`;

  return `
    <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 28" class="overflow-visible">
      <defs>
        <linearGradient id="grad_${id}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${pathD}" fill="url(#grad_${id})" />
      <path d="${strokeD}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke" />
      <circle cx="100" cy="${currentY}" r="2.5" fill="${color}" />
    </svg>
  `;
}

/* ─── Console ─── */
export const CONSOLE_LOGS = {
  minecraft01: [
    '[13:00:01] [Server thread/INFO]: Starting Minecraft server on *:25565',
    '[13:00:02] [Server thread/INFO]: Loading properties',
    '[13:00:03] [Server thread/INFO]: Default game type: SURVIVAL',
    '[13:00:05] [Server thread/INFO]: Preparing level "world"',
    '[13:00:08] [Server thread/INFO]: Done (3.241s)! For help, type "help"',
    '[13:12:34] [Server thread/INFO]: Steve_Gaming[/192.168.1.10:52341] logged in',
    '[13:13:01] [Server thread/INFO]: CreeperSlayer[/192.168.1.15:48821] logged in',
    '[13:14:22] [Server thread/CHAT]: <Steve_Gaming> Hat jemand Diamonds zum Tauschen?',
    '[13:14:35] [Server thread/CHAT]: <CreeperSlayer> Ich hab 32 Stück!',
    '[13:15:02] [Server thread/INFO]: DiamondMiner99[/10.0.0.42:61234] logged in',
  ],
  minecraft02: [
    '[12:00:01] [Server thread/INFO]: Starting Minecraft server on *:25566',
    '[12:00:06] [Server thread/INFO]: Done (2.891s)! For help, type "help"',
    '[12:55:10] [Server thread/INFO]: PixelArtist[/192.168.1.20:55210] logged in',
    '[12:55:12] [Server thread/CHAT]: <PixelArtist> Wer möchte beim Stadion mitbauen?',
  ],
  valheim01: [
    '[13:00:00] [Info   :   Valheim]: Valheim version: 0.218.19',
    '[13:00:02] [Info   :   Valheim]: Starting to load scene: main',
    '[13:00:08] [Info   :   Valheim]: Game server connected',
    '[13:05:22] [Info   :   Valheim]: Got connection SteamID 76561198012345678',
    '[13:05:23] [Info   :   Valheim]: Peer 76561198012345678 has wrong password',
    '[13:05:30] [Info   :   Valheim]: Got connection SteamID 76561198098765432',
  ],
  palworld01: ['[Server]: Palworld Server stopped.'],
};

export let consoleServerId = null; // NOSONAR
export let consoleLogTimer = null; // NOSONAR
export let consoleStreamer = null; // NOSONAR

window.consoleAutoScrollEnabled = true;
window.toggleAutoScroll = (val) => {
  window.consoleAutoScrollEnabled = val;
  if (val && consoleTerminal) {
    consoleTerminal.scrollToBottom();
  }
};
window.clearConsole = () => {
  if (consoleTerminal) {
    consoleTerminal.clear();
  }
};

import { toggleModal, formatBytes, showToast, debounce } from './utils.js?v=22';

let consoleTerminal = null;
let consoleFitAddon = null;

class MockLogStreamer {
  constructor(serverId, onMessage) {
    this.serverId = serverId;
    this.onMessage = onMessage;
    this.interval = null;
    this.msgCount = 0;

    setTimeout(() => {
      this.onMessage(`[System] ${t('general.log_connecting', { server: serverId })}`);
      setTimeout(() => {
        this.onMessage(`[System] ${t('general.log_connected')}`);
        this.startStreaming();
      }, 600);
    }, 200);
  }

  startStreaming() {
    const templates = [
      () => `[${timestamp()}] [Server thread/INFO]: Chunk load complete.`,
      () =>
        `[${timestamp()}] [Server thread/INFO]: Player${Math.floor(Math.random() * 100)} joined the game`, // NOSONAR
      () =>
        `[${timestamp()}] [Server thread/WARN]: Can't keep up! Is the server overloaded? Running ${Math.floor(Math.random() * 5000)}ms or ${Math.floor(Math.random() * 100)} ticks behind`, // NOSONAR
      () => `[${timestamp()}] [Server thread/INFO]: Saving chunks for level 'ServerLevel'...`,
      () =>
        `[${timestamp()}] [Server thread/CHAT]: <Player${Math.floor(Math.random() * 100)}> Hello world!`, // NOSONAR
      () => `[${timestamp()}] [Server thread/ERROR]: Exception in server tick loop`,
    ];

    const tick = () => {
      const template = templates[Math.floor(Math.random() * templates.length)]; // NOSONAR
      this.onMessage(template());
      this.msgCount++;
      // Stop after 200 messages to prevent memory issues in mock
      if (this.msgCount < 200) {
        this.interval = setTimeout(tick, Math.random() * 2000 + 400); // NOSONAR
      }
    };

    this.interval = setTimeout(tick, 1000);
  }

  stop() {
    clearTimeout(this.interval);
    this.onMessage(`[System] ${t('general.log_disconnected')}`);
  }
}

/**
 *
 */
function initTerminal() {
  if (consoleTerminal) return;

  consoleTerminal = new window.Terminal({
    theme: {
      background: 'transparent',
      foreground: '#a9b1d6',
      cursor: '#f7768e',
    },
    fontFamily: '"Fira Code", monospace',
    fontSize: 13,
    convertEol: true,
    disableStdin: true,
  });

  consoleFitAddon = new window.FitAddon.FitAddon();
  consoleTerminal.loadAddon(consoleFitAddon);

  window.addEventListener(
    'resize',
    debounce(() => {
      if (consoleFitAddon) consoleFitAddon.fit();
    }, 100)
  );
}

/**
 * Open the console modal for a specific game server
 * @param {object} srv - The server object
 */
export async function openConsole(srv) {
  try {
    const { loadXterm } = await import('./xterm-loader.js');
    await loadXterm();
  } catch (e) {
    console.error('Failed to load Xterm', e);
    return;
  }
  consoleServerId = srv.containerId;
  const tFn = document.querySelector('[x-data]')?.__x?.$data?.$store?.i18n?.t || window.t;
  let consoleText = tFn('general.console');
  if (consoleText === 'general.console') {
    consoleText = tFn('console');
    if (consoleText === 'console') consoleText = 'Konsole';
  }
  document.getElementById('consoleTitle').textContent = `${consoleText} - ${srv.serverName}`;

  const isOn = srv.status === 'online';
  const statusEl = document.getElementById('consoleStatus');
  statusEl.className = `status-badge ${isOn ? 'running' : 'stopped'}`;
  statusEl.innerHTML = `<span class="dot"></span> ${isOn ? 'Live' : tFn('general.offline') || 'Offline'}`;

  const output = document.getElementById('consoleOutput');

  if (!consoleTerminal) {
    initTerminal();
    output.innerHTML = '';
    consoleTerminal.open(output);

    // Fix IDE warning for xterm-helper-textarea missing an id/name
    const helperTextarea = output.querySelector('.xterm-helper-textarea');
    if (helperTextarea) {
      helperTextarea.id = 'xterm-helper-textarea-id';
      helperTextarea.name = 'xterm-helper-textarea-name';
    }
  }

  if (consoleStreamer) {
    consoleStreamer.stop();
    consoleStreamer = null;
  }

  consoleTerminal.clear();

  const logs = CONSOLE_LOGS[srv.containerId] ? [...CONSOLE_LOGS[srv.containerId]] : [];
  logs.forEach((line) => consoleTerminal.writeln(formatAnsiLine(line)));

  toggleModal('consoleModal', true);

  // Fit terminal after modal animation
  setTimeout(() => {
    if (consoleFitAddon) consoleFitAddon.fit();
    document.getElementById('consoleInput').focus();
  }, 150);

  if (isOn) {
    consoleStreamer = new MockLogStreamer(srv.containerId, (msg) => {
      appendConsoleLine(msg);
    });
  } else {
    consoleTerminal.writeln(
      `\x1b[31m[Server]: ${t('general.no_logs')} ${srv.serverName} ${t('general.available')} (${t('general.offline')}).\x1b[0m`
    );
  }
}

/**
 * Format a raw log string with ANSI colors for Xterm.js
 * @param {string} line - The raw log line
 * @returns {string} The ANSI formatted string
 */
export function formatAnsiLine(line) {
  let formatted = line;
  const lowerLine = line.toLowerCase();

  let baseColor = '\x1b[0m'; // Reset

  if (lowerLine.includes('system]')) {
    baseColor = '\x1b[3m\x1b[90m'; // Italic Gray
  } else if (lowerLine.includes('/warn') || lowerLine.includes('warn:')) {
    baseColor = '\x1b[33m'; // Yellow
  } else if (
    lowerLine.includes('/error') ||
    lowerLine.includes('error:') ||
    lowerLine.includes('exception')
  ) {
    baseColor = '\x1b[31m'; // Red
  } else if (lowerLine.includes('chat') || lowerLine.includes('<')) {
    baseColor = '\x1b[36m'; // Cyan
  } else if (lowerLine.includes('joined') || lowerLine.includes('logged in')) {
    baseColor = '\x1b[32m'; // Green
  } else if (lowerLine.includes('left') || lowerLine.includes('logged out')) {
    baseColor = '\x1b[35m'; // Magenta
  }

  // Colorize timestamps like [12:34:56]
  formatted = formatted.replace(/^(\[\d{2}:\d{2}:\d{2}\])/g, '\x1b[90m$1\x1b[0m' + baseColor);

  // Colorize thread info like [Server thread/INFO]:
  formatted = formatted.replace(
    /(\[[a-zA-Z0-9 -]+\/(INFO|WARN|ERROR|CHAT)\]:)/g,
    '\x1b[34m$1\x1b[0m' + baseColor
  );

  return baseColor + formatted + '\x1b[0m';
}

/**
 * Append a single line to the open console
 * @param {string} line - The raw log line
 */
export function appendConsoleLine(line) {
  if (consoleServerId && CONSOLE_LOGS[consoleServerId]) {
    CONSOLE_LOGS[consoleServerId].push(line);
  }

  if (consoleTerminal) {
    consoleTerminal.writeln(formatAnsiLine(line));
    if (window.consoleAutoScrollEnabled) {
      consoleTerminal.scrollToBottom();
    }
  }
}

/**
 * Get the current timestamp (HH:MM:SS)
 * @returns {string}
 */
export function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Escape HTML to prevent injection in logs
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// --- UI Bindings for Alpine ---
window.closeConsole = function () {
  clearInterval(consoleLogTimer);
  toggleModal('consoleModal', false);
};

window.consoleSend = function () {
  const input = document.getElementById('consoleInput');
  if (!input) return;
  const cmd = input.value.trim();
  if (!cmd) return;
  appendConsoleLine(`[${timestamp()}] [Rcon]: Executing remote command: ${cmd}`);
  input.value = '';
  setTimeout(() => {
    if (cmd.startsWith('list')) {
      appendConsoleLine(
        `[${timestamp()}] [Server thread/INFO]: There are 3/20 players online: Steve_Gaming, CreeperSlayer, DiamondMiner99`
      );
    } else if (cmd.startsWith('say ')) {
      appendConsoleLine(`[${timestamp()}] [Server thread/CHAT]: [Server] ${cmd.slice(4)}`);
    } else if (cmd === 'stop') {
      appendConsoleLine(`[${timestamp()}] [Server thread/INFO]: Stopping the server`);
      appendConsoleLine(`[${timestamp()}] [Server thread/INFO]: Saving players`);
      appendConsoleLine(`[${timestamp()}] [Server thread/INFO]: Saving worlds`);
    } else {
      appendConsoleLine(
        `[${timestamp()}] [Server thread/INFO]: Unknown command. Type "help" for help.`
      );
    }
  }, 300);
};

window.closeBackup = function () {
  toggleModal('backupModal', false);
};

const fileManager = new GameServerFileManager(new GameServerFileClient(), {
  toggleModal: (id, open) => window.toggleModal(id, open),
  toast: (message, type) => window.showToast(message, type),
  translate: (key, variables) => window.t(key, variables),
});

window.openFileManager = (server) => fileManager.open(server);
window.closeFm = () => fileManager.close();
window.fmSave = () => fileManager.save();
window.fmDownload = () => fileManager.download();
window.fmRefresh = () => fileManager.refresh();
window.fmCreateFile = () => fileManager.createFile();
window.fmCreateFolder = () => fileManager.createDirectory();
window.fmRename = () => fileManager.rename();
window.fmDelete = () => fileManager.deleteSelected();
window.fmChooseUpload = () => fileManager.chooseUpload();
window.fmUploadSelected = (event) => fileManager.uploadSelected(event);
window.fmDragEnter = (event) => fileManager.dragEnter(event);
window.fmDragOver = (event) => fileManager.dragOver(event);
window.fmDragLeave = (event) => fileManager.dragLeave(event);
window.fmDrop = (event) => fileManager.drop(event);
window.fmFilter = () => fileManager.filter();
window.fmSort = () => fileManager.changeSort();
window.fmFindNext = () => fileManager.findNext();
window.fmReplace = () => fileManager.replace();
window.fmKeyboard = (event) => fileManager.keyboard(event);

const minecraftContentManager = new MinecraftContentManager(
  new MinecraftContentClient(),
  new ModrinthClient(),
  {
    toggleModal: (id, open) => window.toggleModal(id, open),
    toast: (message, type) => window.showToast(message, type),
    translate: (key, variables) => window.t(key, variables),
  }
);

window.openMinecraftContent = (server) => minecraftContentManager.open(server);
window.closeMinecraftContent = () => minecraftContentManager.close();
window.refreshMinecraftContent = () => minecraftContentManager.load();
window.filterMinecraftContent = () => minecraftContentManager.filter();
