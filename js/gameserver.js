/* ═══════════════════════════════════════════════════════════
   gameserver.js — Game Server Hub Tab
   Displays running game server containers with live stats,
   and a wizard to create new ones via Docker.
═══════════════════════════════════════════════════════════ */

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
  return {
    get instances() {
      return Alpine.store('core').getGameservers();
    },
    templates: GAME_TEMPLATES,
    wizardStep: 0,
    wizardGame: null,
    wForm: {
      name: '',
      image: '',
      port: '',
      ram: '',
      path: '',
    },

    init() {
      this.syncStatus();

      // Live simulation for CPU/RAM and sparkline animations
      setInterval(() => {
        this.instances.forEach((srv) => {
          if (srv.status !== 'online') return;
          srv.cpu = Math.max(5, Math.min(95, srv.cpu + (Math.random() - 0.5) * 8)); // NOSONAR
          // Create new object to trigger Alpine's deep reactivity
          srv.ram = {
            ...srv.ram,
            used: Math.max(512, Math.min(srv.ram.max, srv.ram.used + (Math.random() - 0.5) * 200)), // NOSONAR
          };
        });
      }, 5000);
    },

    syncStatus() {
      this.instances.forEach((srv) => {
        // Find matching docker container
        const c =
          window.DOCKER_CONTAINERS !== undefined
            ? window.DOCKER_CONTAINERS.find((d) => d.id === srv.containerId)
            : null;
        if (c) srv.status = c.status === 'running' ? 'online' : 'offline';
      });
    },

    get onlineCount() {
      return this.instances.filter((s) => s.status === 'online').length;
    },

    getTemplate(gameId) {
      return this.templates.find((t) => t.id === gameId);
    },

    toggleServer(id) {
      Alpine.store('core').toggleContainer(id);
      if (typeof showToast === 'function') {
        const s = this.instances.find((i) => i.containerId === id);
        if (s) {
          showToast(`${s.serverName} ${s.status === 'online' ? 'gestartet' : 'gestoppt'}`, 'info');
        }
      }
    },

    // Wizard Logic
    openCreateWizard() {
      this.wizardStep = 0;
      this.wizardGame = null;
      document.getElementById('createServerModal').classList.add('active');
    },

    closeCreateWizard() {
      document.getElementById('createServerModal').classList.remove('active');
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
        this.wizardStep = 1;
      } else if (this.wizardStep === 1) {
        this.wizardStep = 2;
      }
    },

    prevWizardStep() {
      if (this.wizardStep > 0) this.wizardStep--;
    },

    getWizardCmd() {
      if (!this.wizardGame) return '';
      const envs = (this.wizardGame.env || []).map((e) => `-e "${e}"`);
      const args = [
        'docker run -d',
        `--name ${this.wForm.name.replaceAll(/\\s+/g, '_')}`,
        '--restart unless-stopped',
        `-p ${this.wForm.port}:${this.wizardGame.defaultPort}`,
        `-v "${this.wForm.path}:/data"`,
        `-m ${this.wForm.ram}m`,
        ...envs,
        this.wForm.image,
      ];
      return args.join(' \\\n  ');
    },

    createWizardServer() {
      this.closeCreateWizard();
      if (typeof showToast === 'function') {
        showToast(`${this.wForm.name} wird gestartet...`, 'info');
        setTimeout(() => showToast(`${this.wForm.name} erfolgreich erstellt! 🚀`, 'success'), 2000);
      }
    },

    // Sparkline Helper
    getSparkline(id, val, color) {
      return generateSparkline(id, val, color);
    },

    getRamLabel(srv) {
      return (srv.ram.used / 1024).toFixed(2) + 'G';
    },

    getRamPct(srv) {
      return Math.round((srv.ram.used / srv.ram.max) * 100);
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
    <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 28" style="overflow:visible">
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

import { toggleModal, formatBytes, showToast, debounce } from './utils.js';

let consoleTerminal = null;
let consoleFitAddon = null;

class MockLogStreamer {
  constructor(serverId, onMessage) {
    this.serverId = serverId;
    this.onMessage = onMessage;
    this.interval = null;
    this.msgCount = 0;

    setTimeout(() => {
      this.onMessage(`[System] Verbinde mit Log-Stream für ${serverId}...`);
      setTimeout(() => {
        this.onMessage(`[System] Verbunden. Live-Logs werden empfangen...`);
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
    this.onMessage(`[System] Verbindung zum Log-Stream getrennt.`);
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
  document.getElementById('consoleTitle').textContent =
    `${t('general.console') || 'Konsole'} — ${srv.serverName}`;

  const isOn = srv.status === 'online';
  const statusEl = document.getElementById('consoleStatus');
  statusEl.className = `status-badge ${isOn ? 'running' : 'stopped'}`;
  statusEl.innerHTML = `<span class="dot"></span> ${isOn ? 'Live' : t('general.offline') || 'Offline'}`;

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
      `\x1b[31m[Server]: ${t('general.no_logs') || 'Keine Logs für'} ${srv.serverName} ${t('general.available') || 'verfügbar'} (Server ist offline).\x1b[0m`
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

window.closeFm = function () {
  toggleModal('fileManagerModal', false);
};

window.fmSelectFile = function (btn) {
  document
    .querySelectorAll('#fmFileTree .settings-nav-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const type = btn.dataset.type;
  const fileName = btn.textContent
    .trim()
    .replace(/^(?:folder|description)\s*/, '')
    .trim();
  const editor = document.getElementById('fmEditorTextarea');
  const headerTitle = document.getElementById('fmCurrentFile');
  if (headerTitle) headerTitle.textContent = fileName;
  if (type === 'file') {
    if (fileName === 'server.properties') {
      editor.value =
        '#Minecraft server properties\n#Mon Oct 02 12:00:00 2023\nenable-jmx-monitoring=false\nrcon.port=25575\nlevel-seed=\ngamemode=survival\nenable-command-block=false\nenable-query=false\ngenerator-settings={}\nenforce-secure-profile=true\nlevel-name=world\nmotd=Mein Unraid Minecraft Server\nquery.port=25565\npvp=true\ngenerate-structures=true\nmax-chained-neighbor-updates=1000000\ndifficulty=easy\nnetwork-compression-threshold=256\nmax-tick-time=60000\nrequire-resource-pack=false\nuse-native-transport=true\nmax-players=20\nonline-mode=true\nenable-status=true\nallow-flight=false\ninitial-disabled-packs=';
    } else if (fileName === 'eula.txt') {
      editor.value =
        '#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\n#Mon Oct 02 12:00:00 2023\neula=true';
    } else if (fileName === 'ops.json') {
      editor.value =
        '[\n  {\n    "uuid": "d44...",\n    "name": "AdminPlayer",\n    "level": 4,\n    "bypassesPlayerLimit": false\n  }\n]';
    } else {
      editor.value = '// Inhalt von ' + fileName + ' wird geladen...';
    }
    editor.disabled = false;
  } else {
    editor.value = '// Ordner ausgewählt. Bitte wähle eine Datei zum Bearbeiten aus.';
    editor.disabled = true;
  }
};

window.closeBackup = function () {
  toggleModal('backupModal', false);
};

window.fmSave = function () {
  if (typeof showToast === 'function') showToast('Datei erfolgreich gespeichert.', 'success');
};

let dragCounter = 0;

window.fmDragOver = function (e) {
  e.preventDefault();
  dragCounter++;
  const overlay = document.getElementById('fmDragOverlay');
  if (overlay && !overlay.classList.contains('drag-active')) {
    overlay.classList.add('drag-active');
  }
};

window.fmDragLeave = function (e) {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    const overlay = document.getElementById('fmDragOverlay');
    if (overlay) overlay.classList.remove('drag-active');
  }
};

/**
 *
 * @param isFolder
 * @param fileName
 */
function createFmTreeButton(isFolder, fileName) {
  const newBtn = document.createElement('button');
  newBtn.className = 'settings-nav-btn';
  newBtn.dataset.type = isFolder ? 'folder' : 'file';
  newBtn.style.paddingLeft = '24px';
  newBtn.onclick = function () {
    window.fmSelectFile(this);
  };

  const iconSpan = document.createElement('span');
  iconSpan.className = 'material-icons-round';
  iconSpan.style.color = isFolder ? 'var(--yellow)' : 'var(--text-muted)';
  iconSpan.textContent = isFolder ? 'folder' : 'description';

  newBtn.appendChild(iconSpan);
  newBtn.appendChild(document.createTextNode(' ' + fileName));
  return newBtn;
}

/**
 *
 * @param file
 * @param fileName
 * @param newBtn
 */
function loadFileToFmEditor(file, fileName, newBtn) {
  file.text().then((text) => {
    const editor = document.getElementById('fmEditorTextarea');
    const headerTitle = document.getElementById('fmCurrentFile');
    if (editor) {
      editor.value = text;
      editor.disabled = false;
    }
    if (headerTitle) headerTitle.textContent = fileName;

    document
      .querySelectorAll('#fmFileTree .settings-nav-btn')
      .forEach((b) => b.classList.remove('active'));
    newBtn.classList.add('active');
  });
}

/**
 *
 */
function showFmUploadSuccessToast() {
  if (typeof showToast !== 'function') return;
  const t = document.querySelector('[x-data]')
    ? document.querySelector('[x-data]').__x.$data.$store.i18n.t
    : (k) => k;
  showToast(t('general.fm_upload_success') || 'Erfolgreich hochgeladen', 'success');
}

window.fmDrop = function (e) {
  e.preventDefault();
  dragCounter = 0;
  const overlay = document.getElementById('fmDragOverlay');
  if (overlay) overlay.classList.remove('drag-active');

  if (!e.dataTransfer?.items) return;

  const fileTree = document.getElementById('fmFileTree');
  let firstFileLoaded = false;

  for (const item of e.dataTransfer.items) {
    if (item.kind !== 'file') continue;

    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (!entry) continue;

    const isFolder = entry.isDirectory;
    const newBtn = createFmTreeButton(isFolder, entry.name);
    if (fileTree) fileTree.appendChild(newBtn);

    if (!isFolder && !firstFileLoaded) {
      loadFileToFmEditor(item.getAsFile(), entry.name, newBtn);
      firstFileLoaded = true;
    }
  }

  showFmUploadSuccessToast();
};

window.fmDownload = function () {
  const editor = document.getElementById('fmEditorTextarea');
  const headerTitle = document.getElementById('fmCurrentFile');
  if (!editor || !headerTitle) return;

  const content = editor.value;
  const fileName = headerTitle.textContent.trim() || 'config.txt';

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 100);
};
