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

// Simulated game server instances derived from docker containers
export const GS_INSTANCES = [
  {
    containerId: 'minecraft01',
    game: 'minecraft',
    serverName: 'Minecraft-Survival',
    version: '1.21.4 Paper',
    status: 'online',
    players: { current: 3, max: 20 },
    ram: { used: 3200, max: 4096 },
    cpu: 24,
    uptime: '3d 14h 22m',
    port: 25565,
  },
  {
    containerId: 'minecraft02',
    game: 'minecraft',
    serverName: 'MC-Creative',
    version: '1.20.4 Fabric',
    status: 'online',
    players: { current: 1, max: 20 },
    ram: { used: 2100, max: 4096 },
    cpu: 8,
    uptime: '12h 5m',
    port: 25566,
  },
  {
    containerId: 'valheim01',
    game: 'valheim',
    serverName: 'Valheim-Server',
    version: '0.218.19',
    status: 'online',
    players: { current: 2, max: 10 },
    ram: { used: 1800, max: 4096 },
    cpu: 15,
    uptime: '1d 3h',
    port: 2456,
  },
  {
    containerId: 'palworld01',
    game: 'palworld',
    serverName: 'Palworld-Server',
    version: '0.3.9',
    status: 'offline',
    players: { current: 0, max: 32 },
    ram: { used: 0, max: 8192 },
    cpu: 0,
    uptime: '—',
    port: 8211,
  },
];

export function gameserverApp() {
  return {
    instances: [...GS_INSTANCES],
    templates: GAME_TEMPLATES,
    wizardStep: 0,
    wizardGame: null,
    wForm: {
      name: '',
      image: '',
      port: '',
      ram: '',
      path: ''
    },

    init() {
      this.syncStatus();
      
      if (typeof Alpine !== 'undefined') {
        Alpine.effect(() => {
          if (Alpine.store('global')) {
            Alpine.store('global').onlineGameservers = this.instances.filter(s => s.status === 'online').length;
            
            let totalPlayers = 0;
            this.instances.forEach(s => {
              if (s.status === 'online' && s.players && s.players.current) {
                totalPlayers += s.players.current;
              }
            });
            Alpine.store('global').onlinePlayers = totalPlayers;
          }
        });
      }
      
      // Live simulation for CPU/RAM and sparkline animations
      setInterval(() => {
        this.instances.forEach(srv => {
          if (srv.status !== 'online') return;
          srv.cpu = Math.max(5, Math.min(95, srv.cpu + (Math.random() - 0.5) * 8));
          // Create new object to trigger Alpine's deep reactivity
          srv.ram = { 
            ...srv.ram, 
            used: Math.max(512, Math.min(srv.ram.max, srv.ram.used + (Math.random() - 0.5) * 200)) 
          };
        });
      }, 5000);
    },

    syncStatus() {
      this.instances.forEach(srv => {
        // Find matching docker container
        const c = typeof window.DOCKER_CONTAINERS !== 'undefined' 
          ? window.DOCKER_CONTAINERS.find(d => d.id === srv.containerId)
          : null;
        if (c) srv.status = c.status === 'running' ? 'online' : 'offline';
      });
    },

    get onlineCount() {
      return this.instances.filter(s => s.status === 'online').length;
    },

    getTemplate(gameId) {
      return this.templates.find(t => t.id === gameId);
    },

    toggleServer(id) {
      const srv = this.instances.find(x => x.containerId === id);
      if (!srv) return;
      // Note: In real life this would talk to Docker API. We just simulate here.
      srv.status = srv.status === 'online' ? 'offline' : 'online';
      
      const statusWord = srv.status === 'online' ? (t('started') || 'gestartet') : (t('stopped') || 'gestoppt');
      if (typeof showToast === 'function') {
        showToast(`${srv.serverName} ${statusWord}`, srv.status === 'online' ? 'success' : 'info');
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
      this.wizardGame = this.templates.find(t => t.id === id);
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
      const envStr = (this.wizardGame.env || []).map(e => `  -e "${e}"`).join(' \\\n');
      return `docker run -d \\
  --name ${this.wForm.name.replace(/\\s+/g, '_')} \\
  --restart unless-stopped \\
  -p ${this.wForm.port}:${this.wizardGame.defaultPort} \\
  -v "${this.wForm.path}:/data" \\
  -m ${this.wForm.ram}m \\
${envStr} \\
  ${this.wForm.image}`;
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
    }
  };
}

// Dummy backward compatibility
export function initGameServer() {
  if (typeof bindGameServerEvents === 'function') {
    bindGameServerEvents();
  }
};
export function renderGameServers() {}

/**
 * Generates an inline SVG sparkline string based on a current value.
 * Simulates a historical graph for premium feel.
 */
export function generateSparkline(id, val, color) {
  // Clamp value
  const v = Math.min(Math.max(val, 0), 100);
  
  // Generate some fake historical points based on the current value
  const points = [];
  let currentY = 28 - (v / 100 * 28);
  points.push(`100,${currentY}`); // Current value on the right
  
  for (let i = 1; i <= 5; i++) {
    const x = 100 - (i * 20);
    // Randomize past values slightly, but trend towards the current value
    const deviation = (Math.random() * 30 - 15);
    const pastV = Math.min(Math.max(v + deviation, 0), 100);
    const y = 28 - (pastV / 100 * 28);
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
};

/* ─── Console ─── */
export const CONSOLE_LOGS = {
  'minecraft01': [
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
  'minecraft02': [
    '[12:00:01] [Server thread/INFO]: Starting Minecraft server on *:25566',
    '[12:00:06] [Server thread/INFO]: Done (2.891s)! For help, type "help"',
    '[12:55:10] [Server thread/INFO]: PixelArtist[/192.168.1.20:55210] logged in',
    '[12:55:12] [Server thread/CHAT]: <PixelArtist> Wer möchte beim Stadion mitbauen?',
  ],
  'valheim01': [
    '[13:00:00] [Info   :   Valheim]: Valheim version: 0.218.19',
    '[13:00:02] [Info   :   Valheim]: Starting to load scene: main',
    '[13:00:08] [Info   :   Valheim]: Game server connected',
    '[13:05:22] [Info   :   Valheim]: Got connection SteamID 76561198012345678',
    '[13:05:23] [Info   :   Valheim]: Peer 76561198012345678 has wrong password',
    '[13:05:30] [Info   :   Valheim]: Got connection SteamID 76561198098765432',
  ],
  'palworld01': [
    '[Server]: Palworld Server stopped.',
  ],
};

export let consoleServerId  = null;
export let consoleLogTimer  = null;

import { toggleModal, formatBytes, formatNum, showToast, pingClass, debounce, throttle, Logger } from './utils.js';

let consoleVirtualScroller = null;

class VirtualScroller {
  constructor(container, itemHeight = 22) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.items = [];
    this.renderFn = null;
    
    this.inner = document.createElement('div');
    this.inner.style.position = 'relative';
    this.container.innerHTML = '';
    this.container.appendChild(this.inner);
    
    this.container.addEventListener('scroll', throttle(() => this.render(), 16));
    window.addEventListener('resize', debounce(() => this.render(), 100));
  }

  setItems(items, renderFn) {
    this.items = items;
    this.renderFn = renderFn;
    this.inner.style.height = `${this.items.length * this.itemHeight}px`;
    this.render();
    this.scrollToBottom();
  }

  appendItem(item) {
    this.items.push(item);
    this.inner.style.height = `${this.items.length * this.itemHeight}px`;
    const isAtBottom = this.container.scrollHeight - this.container.scrollTop <= this.container.clientHeight + 50;
    this.render();
    if (isAtBottom) this.scrollToBottom();
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - 10);
    const endIndex = Math.min(this.items.length - 1, Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + 10);
    
    let html = '';
    for (let i = startIndex; i <= endIndex; i++) {
      html += `<div style="position:absolute; top:${i * this.itemHeight}px; left:0; right:0; height:${this.itemHeight}px; overflow:hidden;">${this.renderFn(this.items[i])}</div>`;
    }
    this.inner.innerHTML = html;
  }

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }
}

/**
 * Open the console modal for a specific game server
 * @param {Object} srv - The server object
 */
export function openConsole(srv) {
  consoleServerId = srv.containerId;
  document.getElementById('consoleTitle').textContent = `${t('console') || 'Konsole'} — ${srv.serverName}`;

  const isOn = srv.status === 'online';
  const statusEl = document.getElementById('consoleStatus');
  statusEl.className = `status-badge ${isOn ? 'running' : 'stopped'}`;
  statusEl.innerHTML = `<span class="dot"></span> ${isOn ? 'Live' : (t('offline') || 'Offline')}`;

  const output = document.getElementById('consoleOutput');
  
  if (!consoleVirtualScroller) {
    consoleVirtualScroller = new VirtualScroller(output, 22);
  } else {
    // Reset inner height if reusing
    consoleVirtualScroller.container = output;
  }
  
  const logs = CONSOLE_LOGS[srv.containerId] || [`[Server]: ${t('no_logs') || 'Keine Logs für'} ${srv.serverName} ${t('available') || 'verfügbar'}.`];
  consoleVirtualScroller.setItems(logs, consoleLineHTML);

  toggleModal('consoleModal', true);
  document.getElementById('consoleInput').focus();

  clearInterval(consoleLogTimer);
  if (isOn) {
    const liveMsgs = [
      `[${timestamp()}] [Server thread/INFO]: Saving world data...`,
      `[${timestamp()}] [Server thread/INFO]: World saved.`,
      `[${timestamp()}] [Server thread/INFO]: Autosave complete.`,
    ];
    let i = 0;
    consoleLogTimer = setInterval(() => {
      if (i >= liveMsgs.length) { clearInterval(consoleLogTimer); return; }
      appendConsoleLine(liveMsgs[i++]);
    }, 3000);
  }
}

/**
 * Format a raw log string into HTML
 * @param {string} line - The raw log line
 * @returns {string} The HTML formatted string
 */
export function consoleLineHTML(line) {
  let cls = 'log-info';
  if (line.includes('/WARN')  || line.includes('warn'))  cls = 'log-warn';
  if (line.includes('/ERROR') || line.includes('error')) cls = 'log-error';
  if (line.includes('CHAT')   || line.includes('<'))     cls = 'log-chat';
  if (line.includes('logged in'))                        cls = 'log-join';
  if (line.includes('logged out') || line.includes('left the game')) cls = 'log-leave';
  return `<div class="log-line ${cls}" style="margin:0;">${escapeHtml(line)}</div>`;
}

/**
 * Append a single line to the open console
 * @param {string} line - The raw log line
 */
export function appendConsoleLine(line) {
  if (consoleServerId && CONSOLE_LOGS[consoleServerId]) {
    // Don't push to CONSOLE_LOGS if the scroller already pushed it (which it doesn't, scroller pushes to its own items array reference)
    // Actually scroller items is a reference to CONSOLE_LOGS array?
    // Wait, setItems passes `logs` which IS `CONSOLE_LOGS[srv.containerId]`.
    // So appendItem will push to `this.items` which will mutate `CONSOLE_LOGS[srv.containerId]`.
  }
  
  if (consoleVirtualScroller) {
    consoleVirtualScroller.appendItem(line);
  } else {
    // Fallback if closed
    if (consoleServerId && CONSOLE_LOGS[consoleServerId]) {
      CONSOLE_LOGS[consoleServerId].push(line);
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
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Bind DOM events for GameServer tab (wizard, console, card actions)
 */
export function bindGameServerEvents() {
  // document.getElementById('createServerBtn')?.addEventListener('click', openCreateWizard);
  document.getElementById('closeCreateModal')?.addEventListener('click', () => toggleModal('createServerModal', false));
  document.getElementById('closeConsoleModal')?.addEventListener('click', () => {
    clearInterval(consoleLogTimer);
    toggleModal('consoleModal', false);
  });
  document.getElementById('closeFmModal')?.addEventListener('click', () => toggleModal('fileManagerModal', false));
  document.getElementById('closeBackupModal')?.addEventListener('click', () => toggleModal('backupModal', false));
  document.getElementById('consoleModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('consoleModal')) {
      clearInterval(consoleLogTimer);
      toggleModal('consoleModal', false);
    }
  });

  // Console send
  const consoleSend = () => {
    const input = document.getElementById('consoleInput');
    const cmd   = input.value.trim();
    if (!cmd) return;
    appendConsoleLine(`[${timestamp()}] [Rcon]: Executing remote command: ${cmd}`);
    input.value = '';
    // Fake responses
    setTimeout(() => {
      if (cmd.startsWith('list')) {
        appendConsoleLine(`[${timestamp()}] [Server thread/INFO]: There are 3/20 players online: Steve_Gaming, CreeperSlayer, DiamondMiner99`);
      } else if (cmd.startsWith('say ')) {
        appendConsoleLine(`[${timestamp()}] [Server thread/CHAT]: [Server] ${cmd.slice(4)}`);
      } else if (cmd === 'stop') {
        appendConsoleLine(`[${timestamp()}] [Server thread/INFO]: Stopping the server`);
        appendConsoleLine(`[${timestamp()}] [Server thread/INFO]: Saving players`);
        appendConsoleLine(`[${timestamp()}] [Server thread/INFO]: Saving worlds`);
      } else {
        appendConsoleLine(`[${timestamp()}] [Server thread/INFO]: Unknown command. Type "help" for help.`);
      }
    }, 300);
  };
  document.getElementById('consoleSendBtn')?.addEventListener('click', consoleSend);
  document.getElementById('consoleInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') consoleSend(); });

  // File Manager mockup logic
  document.getElementById('fmFileTree')?.addEventListener('click', e => {
    const btn = e.target.closest('.settings-nav-btn');
    if (!btn) return;
    
    document.querySelectorAll('#fmFileTree .settings-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const type = btn.dataset.type;
    const fileName = btn.textContent.trim().replace(/^folder|description\s*/, '').trim();
    const editor = document.getElementById('fmEditorTextarea');
    const headerTitle = document.getElementById('fmCurrentFile');
    
    if (headerTitle) headerTitle.textContent = fileName;
    
    if (type === 'file') {
      if (fileName === 'server.properties') {
        editor.value = "#Minecraft server properties\n#Mon Oct 02 12:00:00 2023\nenable-jmx-monitoring=false\nrcon.port=25575\nlevel-seed=\ngamemode=survival\nenable-command-block=false\nenable-query=false\ngenerator-settings={}\nenforce-secure-profile=true\nlevel-name=world\nmotd=Mein Unraid Minecraft Server\nquery.port=25565\npvp=true\ngenerate-structures=true\nmax-chained-neighbor-updates=1000000\ndifficulty=easy\nnetwork-compression-threshold=256\nmax-tick-time=60000\nrequire-resource-pack=false\nuse-native-transport=true\nmax-players=20\nonline-mode=true\nenable-status=true\nallow-flight=false\ninitial-disabled-packs=";
      } else if (fileName === 'eula.txt') {
        editor.value = "#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\n#Mon Oct 02 12:00:00 2023\neula=true";
      } else if (fileName === 'ops.json') {
        editor.value = "[\n  {\n    \"uuid\": \"d44...\",\n    \"name\": \"AdminPlayer\",\n    \"level\": 4,\n    \"bypassesPlayerLimit\": false\n  }\n]";
      } else {
        editor.value = "// Inhalt von " + fileName + " wird geladen...";
      }
      editor.disabled = false;
    } else {
      editor.value = "// Ordner ausgewählt. Bitte wähle eine Datei zum Bearbeiten aus.";
      editor.disabled = true;
    }
  });

  document.getElementById('fmSaveBtn')?.addEventListener('click', () => {
    if (typeof showToast === 'function') showToast('Datei erfolgreich gespeichert.', 'success');
  });


  document.getElementById('gsGrid')?.addEventListener('click', e => {
    const startBtn   = e.target.closest('.gs-start-btn');
    const stopBtn    = e.target.closest('.gs-stop-btn');
    const playersBtn = e.target.closest('.gs-players-btn');
    const consoleBtn = e.target.closest('.gs-console-btn');
    const editBtn    = e.target.closest('.gs-edit-btn');

    if (startBtn || stopBtn) {
      const id   = (startBtn || stopBtn).dataset.id;
      const srv  = GS_INSTANCES.find(s => s.containerId === id);
      const cont = DOCKER_CONTAINERS.find(c => c.id === id);
      if (!srv || !cont) return;
      const starting = !!startBtn;
      srv.status  = starting ? 'online'  : 'offline';
      cont.status = starting ? 'running' : 'stopped';
      showToast(`${srv.serverName} ${t(starting ? 'is_starting' : 'is_stopping') || (starting ? 'wird gestartet...' : 'wird gestoppt...')}`, 'info');
      setTimeout(() => {
        showToast(`${srv.serverName} ${t(starting ? 'is_running' : 'is_stopped') || (starting ? 'läuft' : 'gestoppt')}`, starting ? 'success' : 'info');
        renderGameServers();
        if (typeof renderDockerTable === 'function') {
          renderDockerTable();
          renderDockerStats();
        }
      }, 1500);
    } else if (consoleBtn) {
      const srv = GS_INSTANCES.find(s => s.containerId === consoleBtn.dataset.id);
      if (srv) openConsole(srv);
    } else if (playersBtn) {
      const srv = GS_INSTANCES.find(s => s.containerId === playersBtn.dataset.id);
      if (srv && srv.status === 'online') {
        switchTab('players');
        const sel = document.getElementById('playerServerSelect');
        if (sel) {
          sel.value = srv.containerId;
          sel.dispatchEvent(new Event('change'));
        }
      }
    } else if (e.target.closest('.gs-files-btn')) {
      toggleModal('fileManagerModal', true);
    } else if (e.target.closest('.gs-backup-btn')) {
      toggleModal('backupModal', true);
    } else if (editBtn) {
      const srv = GS_INSTANCES.find(s => s.containerId === editBtn.dataset.id);
      if (srv) {
        if (window.Alpine) {
          Alpine.store('modals').install.data = {
            ...Alpine.store('modals').install.data,
            id: srv.game,
            name: srv.serverName,
            author: 'Lokales System',
            isEdit: true
          };
          Alpine.store('modals').install.open = true;
        }
      }
    }
  });
}
