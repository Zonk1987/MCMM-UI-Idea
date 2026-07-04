/* ═══════════════════════════════════════════════════════════
   docker.js — Docker Overview Tab
   In production: communicates with Unraid Docker socket API.
   Currently uses realistic mock data.
═══════════════════════════════════════════════════════════ */

export const DOCKER_CONTAINERS = [
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
      { host: '/mnt/user/Media',        container: '/data/media' },
    ],
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
    paths: [
      { host: '/mnt/user/gameservers/mc-survival', container: '/data' },
    ],
    isGameServer: true,
    game: 'minecraft',
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
    paths: [
      { host: '/mnt/user/gameservers/mc-creative', container: '/data' },
    ],
    isGameServer: true,
    game: 'minecraft',
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
    isGameServer: true,
    game: 'valheim',
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
    isGameServer: true,
    game: 'palworld',
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
      { host: '53',   container: '53',   proto: 'tcp/udp' },
      { host: '8053', container: '80',   proto: 'tcp' },
    ],
    paths: [
      { host: '/mnt/user/appdata/pihole',      container: '/etc/pihole' },
      { host: '/mnt/user/appdata/pihole/dnsmasq', container: '/etc/dnsmasq.d' },
    ],
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
      { host: '80',   container: '80',   proto: 'tcp' },
      { host: '443',  container: '443',  proto: 'tcp' },
      { host: '81',   container: '81',   proto: 'tcp' },
    ],
    paths: [{ host: '/mnt/user/appdata/npm', container: '/data' }],
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
  },
];

export function dockerApp() {
  return {
    containers: [...DOCKER_CONTAINERS], // Initialized immediately
    isLoading: false,
    searchQuery: '',
    sortCol: 'name',
    sortAsc: true,
    advancedView: false,
    selected: [],
    selectAll: false,

    get filteredContainers() {
      let list = this.containers.filter(c => 
        c.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      );

      list.sort((a, b) => {
        let av = a[this.sortCol] ?? '';
        let bv = b[this.sortCol] ?? '';
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return this.sortAsc ? -1 : 1;
        if (av > bv) return this.sortAsc ?  1 : -1;
        return 0;
      });

      return list;
    },

    init() {
      // Sync to global store
      if (typeof Alpine !== 'undefined') {
        Alpine.effect(() => {
          if (Alpine.store('global')) {
            Alpine.store('global').dockerCount = this.containers.length;
          }
        });
      }
      


      // Watch for selection changes to update selectAll
      this.$watch('selected', (value) => {
        this.selectAll = value.length === this.filteredContainers.length && value.length > 0;
      });
      
      // Clear selection on search
      this.$watch('searchQuery', () => {
        this.selected = [];
      });
    },

    get stats() {
      return {
        running: this.containers.filter(c => c.status === 'running').length,
        stopped: this.containers.filter(c => c.status === 'stopped').length,
        updates: this.containers.filter(c => !c.upToDate).length,
        total: this.containers.length
      };
    },
    
    toggleSort(col) {
      if (this.sortCol === col) {
        this.sortAsc = !this.sortAsc;
      } else {
        this.sortCol = col;
        this.sortAsc = true;
      }
    },

    toggleSelectAll() {
      if (this.selectAll) {
        this.selected = this.filteredContainers.map(c => c.id);
      } else {
        this.selected = [];
      }
    },

    bulkAction(action) {
      if (this.selected.length === 0) return;
      
      const count = this.selected.length;
      
      if (action === 'delete') {
        if (!confirm(`${count} Container wirklich löschen?`)) return;
        this.containers = this.containers.filter(c => !this.selected.includes(c.id));
        this.selected = [];
        showToast(`${count} Container gelöscht`, 'success');
        return;
      }
      
      this.selected.forEach(id => {
        const c = this.containers.find(x => x.id === id);
        if (c) {
          if (action === 'start') c.status = 'running';
          if (action === 'stop') c.status = 'stopped';
        }
      });
      
      const statusWord = action === 'start' ? (t('started') || 'gestartet') : (t('stopped') || 'gestoppt');
      showToast(`${count} Container ${statusWord}`, 'success');
      this.selected = [];
    },

    toggleContainer(id) {
      const c = this.containers.find(x => x.id === id);
      if (!c) return;
      c.status = c.status === 'running' ? 'stopped' : 'running';
      const statusWord = c.status === 'running' ? (t('started') || 'gestartet') : (t('stopped') || 'gestoppt');
      showToast(`${c.name} ${statusWord}`, c.status === 'running' ? 'success' : 'info');
      
      // We do not need manual DOM refresh here since Alpine handles it via reactivity!
    },

    updateContainer(id) {
      const c = this.containers.find(x => x.id === id);
      if (!c) return;
      c.upToDate = true;
      if (typeof showToast === 'function') {
        showToast(`${c.name} wird aktualisiert...`, 'info');
        setTimeout(() => {
          showToast(`${c.name} erfolgreich aktualisiert`, 'success');
        }, 2000);
      }
    }
  };
}

// Dummy for backwards compatibility with main.js until fully refactored
export function initDocker() {}

