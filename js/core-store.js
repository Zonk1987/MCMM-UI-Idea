import { ContainerApiClient } from './container-api-client.js?v=24';
import { ContainerLayoutRepository } from './container-layout-repository.js';
import { GameServerContainerMapper } from './game-server-container-mapper.js?v=20';

/**
 * Registers the shared container and game-server data store.
 * @param {object} Alpine Alpine.js runtime
 */
export function initCoreStore(Alpine) {
  const apiClient = new ContainerApiClient();
  const layoutRepository = new ContainerLayoutRepository();
  const gameServerMapper = new GameServerContainerMapper();
  const initialLayout = layoutRepository.load();

  Alpine.store('core', {
    containers: [],
    customFolders: initialLayout.folders,
    customStacks: [],
    folderIcons: initialLayout.icons,
    loading: true,
    refreshing: false,
    error: null,
    lastUpdated: null,
    refreshTimer: null,

    async refreshContainers(silent = false) {
      if (this.refreshing) return;
      this.refreshing = true;
      if (!silent) this.loading = true;
      try {
        const payload = await apiClient.list();
        const layout = layoutRepository.load();
        this.customFolders = layout.folders;
        this.folderIcons = layout.icons;
        this.containers = layoutRepository.apply(payload.containers, layout);
        this.lastUpdated = payload.generatedAt || new Date().toISOString();
        this.error = null;
        this.syncCounts();
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        if (typeof showToast === 'function' && !silent) showToast(this.error, 'error');
      } finally {
        this.loading = false;
        this.refreshing = false;
      }
    },

    persistLayout() {
      const layout = layoutRepository.capture(
        this.containers,
        this.customFolders,
        this.folderIcons
      );
      this.customFolders = layout.folders;
      this.folderIcons = layout.icons;
    },

    addFolder(name) {
      const value = name.trim();
      if (value && !this.customFolders.includes(value)) {
        this.customFolders = [...this.customFolders, value];
        this.persistLayout();
      }
    },

    addStack(name, composeContent) {
      const value = name.trim();
      if (value && !this.customStacks.some((stack) => stack.name === value)) {
        this.customStacks = [...this.customStacks, { name: value, composeContent }];
      }
    },

    removeStack(name) {
      this.customStacks = this.customStacks.filter((stack) => stack.name !== name);
    },

    removeFolder(name) {
      this.customFolders = this.customFolders.filter((folder) => folder !== name);
      const icons = { ...this.folderIcons };
      delete icons[name];
      this.folderIcons = icons;
      this.containers = this.containers.map((container) => {
        if (container.labels?.['folder.view3'] !== name) return container;
        const labels = { ...container.labels };
        delete labels['folder.view3'];
        return { ...container, labels };
      });
      this.persistLayout();
    },

    renameFolder(oldName, newName) {
      const value = newName.trim();
      if (!value || value === oldName) return;
      this.customFolders = this.customFolders.map((folder) =>
        folder === oldName ? value : folder
      );
      if (!this.customFolders.includes(value)) this.customFolders = [...this.customFolders, value];
      const icons = { ...this.folderIcons };
      if (icons[oldName]) {
        icons[value] = icons[oldName];
        delete icons[oldName];
      }
      this.folderIcons = icons;
      this.containers = this.containers.map((container) => {
        if (container.labels?.['folder.view3'] !== oldName) return container;
        return {
          ...container,
          labels: { ...container.labels, 'folder.view3': value },
        };
      });
      this.persistLayout();
    },

    setFolderIcon(folderName, iconUrl) {
      this.folderIcons = { ...this.folderIcons, [folderName]: iconUrl };
      this.persistLayout();
    },

    setLabel(id, key, value) {
      this.containers = this.containers.map((container) => {
        if (container.id !== id) return container;
        const labels = { ...(container.labels || {}) };
        if (value) labels[key] = value;
        else delete labels[key];
        return { ...container, labels };
      });
      if (key === 'folder.view3') this.persistLayout();
    },

    getGameservers() {
      return gameServerMapper.map(this.containers);
    },

    syncCounts() {
      const globalStore = Alpine.store('global');
      if (!globalStore) return;
      const gameservers = this.getGameservers();
      globalStore.dockerCount = this.containers.length;
      globalStore.onlineGameservers = gameservers.filter(
        (server) => server.status === 'online'
      ).length;
      globalStore.onlinePlayers = gameservers.reduce(
        (total, server) => total + (server.status === 'online' ? server.players.current || 0 : 0),
        0
      );
    },

    init() {
      this.refreshContainers();
      const seconds = Math.max(5, Number(globalThis.appSettings?.refreshInterval) || 10);
      this.refreshTimer = window.setInterval(() => this.refreshContainers(true), seconds * 1000);
    },
  });
}
