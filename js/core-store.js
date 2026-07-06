/* ═══════════════════════════════════════════════════════════
   core-store.js — Central Data Store
   Single Source of Truth for all containers and services.
═══════════════════════════════════════════════════════════ */

export function initCoreStore(Alpine) {
  // Raw Mock Data
  const MOCK_CONTAINERS = [
    {
      id: 'plex01',
      name: 'Plex',
      image: 'plexinc/pms-docker:latest',
      icon: 'https://cdn2.steamgriddb.com/icon/c0c7c76d30bd3dcaefc96f40275bdc0a.ico',
      iconFallback: '🎬',
      status: 'running',
      upToDate: true,
      ports: [{ host: '32400', container: '32400', proto: 'tcp' }],
      paths: [
        { host: '/mnt/user/appdata/plex', container: '/config' },
        { host: '/mnt/user/Media', container: '/data/media' },
      ],
      labels: {
        'folder.view3': 'Media',
      }
    },
    {
      id: 'minecraft01',
      name: 'Minecraft-Survival',
      image: 'itzg/minecraft-server:latest',
      icon: null,
      iconFallback: '⛏',
      status: 'running',
      upToDate: true,
      ports: [{ host: '25565', container: '25565', proto: 'tcp' }],
      paths: [{ host: '/mnt/user/gameservers/mc-survival', container: '/data' }],
      labels: {
        'folder.view3': 'Game Servers',
        'mcmm.managed': 'true',
        'mcmm.type': 'minecraft',
        'mcmm.game': 'minecraft'
      },
      // Gameserver specific runtime mock data
      gsData: {
        version: '1.21.4 Paper',
        players: { current: 3, max: 20 },
        ram: { used: 3200, max: 4096 },
        cpu: 24,
        uptime: '3d 14h 22m'
      }
    },
    {
      id: 'minecraft02',
      name: 'MC-Creative',
      image: 'itzg/minecraft-server:latest',
      icon: null,
      iconFallback: '⛏',
      status: 'running',
      upToDate: false,
      ports: [{ host: '25566', container: '25565', proto: 'tcp' }],
      paths: [{ host: '/mnt/user/gameservers/mc-creative', container: '/data' }],
      labels: {
        'folder.view3': 'Game Servers',
        'mcmm.managed': 'true',
        'mcmm.type': 'minecraft',
        'mcmm.game': 'minecraft'
      },
      gsData: {
        version: '1.20.4 Fabric',
        players: { current: 1, max: 20 },
        ram: { used: 2100, max: 4096 },
        cpu: 8,
        uptime: '12h 5m'
      }
    },
    {
      id: 'valheim01',
      name: 'Valheim-Server',
      image: 'lloesche/valheim-server:latest',
      icon: null,
      iconFallback: '🪓',
      status: 'running',
      upToDate: true,
      ports: [
        { host: '2456', container: '2456', proto: 'udp' },
        { host: '2457', container: '2457', proto: 'udp' },
      ],
      paths: [{ host: '/mnt/user/gameservers/valheim', container: '/config' }],
      labels: {
        'folder.view3': 'Game Servers',
        'mcmm.managed': 'true',
        'mcmm.type': 'valheim',
        'mcmm.game': 'valheim'
      },
      gsData: {
        version: '0.218.19',
        players: { current: 2, max: 10 },
        ram: { used: 1800, max: 4096 },
        cpu: 15,
        uptime: '5d 2h'
      }
    },
    {
      id: 'palworld01',
      name: 'Palworld-Server',
      image: 'thijsvanloef/palworld-server-docker:latest',
      icon: null,
      iconFallback: '🦎',
      status: 'stopped',
      upToDate: true,
      ports: [{ host: '8211', container: '8211', proto: 'udp' }],
      paths: [{ host: '/mnt/user/gameservers/palworld', container: '/palworld' }],
      labels: {
        'folder.view3': 'Game Servers',
        'mcmm.managed': 'true',
        'mcmm.type': 'palworld',
        'mcmm.game': 'palworld'
      },
      gsData: {
        version: 'v0.1.5.0',
        players: { current: 0, max: 32 },
        ram: { used: 0, max: 16384 },
        cpu: 0,
        uptime: 'Offline'
      }
    },
    {
      id: 'pihole01',
      name: 'Pi-hole',
      image: 'pihole/pihole:latest',
      icon: null,
      iconFallback: '🕳',
      status: 'running',
      upToDate: false,
      ports: [
        { host: '53', container: '53', proto: 'tcp/udp' },
        { host: '8053', container: '80', proto: 'tcp' },
      ],
      paths: [
        { host: '/mnt/user/appdata/pihole', container: '/etc/pihole' },
        { host: '/mnt/user/appdata/pihole/dnsmasq', container: '/etc/dnsmasq.d' },
      ],
      labels: {
        'folder.view3': 'Network',
      }
    },
    {
      id: 'grafana01',
      name: 'Grafana',
      image: 'grafana/grafana:latest',
      icon: null,
      iconFallback: '📈',
      status: 'running',
      upToDate: true,
      ports: [{ host: '3000', container: '3000', proto: 'tcp' }],
      paths: [{ host: '/mnt/user/appdata/grafana', container: '/var/lib/grafana' }],
      labels: {
        'folder.view3': 'Monitoring',
      }
    },
    {
      id: 'nginx01',
      name: 'NGINX Proxy Manager',
      image: 'jc21/nginx-proxy-manager:latest',
      icon: null,
      iconFallback: '🔀',
      status: 'running',
      upToDate: true,
      ports: [
        { host: '80', container: '80', proto: 'tcp' },
        { host: '443', container: '443', proto: 'tcp' },
        { host: '81', container: '81', proto: 'tcp' },
      ],
      paths: [{ host: '/mnt/user/appdata/npm', container: '/data' }],
      labels: {
        'folder.view3': 'Network',
      }
    },
    {
      id: 'portainer01',
      name: 'Portainer',
      image: 'portainer/portainer-ce:latest',
      icon: null,
      iconFallback: '🐳',
      status: 'stopped',
      upToDate: false,
      ports: [{ host: '9443', container: '9443', proto: 'tcp' }],
      paths: [{ host: '/var/run/docker.sock', container: '/var/run/docker.sock' }],
      labels: {
        'folder.view3': 'System',
      }
    },
    {
      id: 'immich01',
      name: 'Immich',
      image: 'ghcr.io/immich-app/immich-server:latest',
      icon: null,
      iconFallback: '🖼',
      status: 'running',
      upToDate: true,
      ports: [{ host: '2283', container: '2283', proto: 'tcp' }],
      paths: [
        { host: '/mnt/user/Photos', container: '/usr/src/app/upload' },
        { host: '/mnt/user/appdata/immich', container: '/config' },
      ],
      labels: {
        'folder.view3': 'Media',
      }
    },
  ];

  Alpine.store('core', {
    containers: MOCK_CONTAINERS,
    customFolders: ['Media', 'Game Servers', 'System'],

    addFolder(name) {
      if (name && !this.customFolders.includes(name)) {
        this.customFolders.push(name);
      }
    },

    removeFolder(name) {
      this.customFolders = this.customFolders.filter(f => f !== name);
      this.containers.forEach(c => {
        if (c.labels && c.labels['folder.view3'] === name) {
          delete c.labels['folder.view3'];
        }
      });
      this.containers = [...this.containers];
    },

    renameFolder(oldName, newName) {
      if (this.customFolders.includes(oldName)) {
        this.customFolders = this.customFolders.map(f => f === oldName ? newName : f);
      } else {
        this.customFolders.push(newName);
      }
      this.containers.forEach(c => {
        if (c.labels && c.labels['folder.view3'] === oldName) {
          c.labels['folder.view3'] = newName;
        }
      });
      this.containers = [...this.containers];
    },

    // Getters for specific views
    getGameservers() {
      return this.containers
        .filter(c => c.labels && c.labels['mcmm.managed'] === 'true')
        .map(c => ({
          containerId: c.id,
          game: c.labels['mcmm.game'],
          serverName: c.name,
          version: c.gsData?.version,
          status: c.status === 'running' ? 'online' : 'offline',
          players: c.gsData?.players || { current: 0, max: 0 },
          ram: c.gsData?.ram || { used: 0, max: 0 },
          cpu: c.gsData?.cpu || 0,
          uptime: c.gsData?.uptime || 'Offline',
          port: c.ports[0]?.host || 0
        }));
    },

    // Actions
    toggleContainer(id) {
      const container = this.containers.find((c) => c.id === id);
      if (container) {
        if (container.status === 'running') {
          container.status = 'stopped';
          if (container.gsData) {
             container.gsData.uptime = 'Offline';
             container.gsData.players.current = 0;
             container.gsData.ram.used = 0;
             container.gsData.cpu = 0;
          }
        } else {
          container.status = 'running';
          if (container.gsData) {
             container.gsData.uptime = '0m';
             container.gsData.ram.used = Math.floor(container.gsData.ram.max * 0.4);
          }
        }
      }
    },

    updateContainer(id) {
      const container = this.containers.find((c) => c.id === id);
      if (container) {
        container.upToDate = true;
      }
    },

    setLabel(id, key, value) {
      const container = this.containers.find((c) => c.id === id);
      if (container) {
        if (!container.labels) container.labels = {};
        if (value === '') {
          delete container.labels[key];
        } else {
          container.labels[key] = value;
        }
        // Force reactivity for nested object
        this.containers = [...this.containers];
      }
    }
  });
}
