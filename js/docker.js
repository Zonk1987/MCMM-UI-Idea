/* ═══════════════════════════════════════════════════════════
   docker.js — Docker Overview Tab
   In production: communicates with Unraid Docker socket API.
   Currently uses realistic mock data.
═══════════════════════════════════════════════════════════ */

export function dockerApp() {
  return {
    get containers() {
      return Alpine.store('core').containers;
    },
    folderViewEnabled: typeof appSettings !== 'undefined' ? appSettings.folderViewEnabled : true,
    isLoading: false,
    searchQuery: '',
    sortCol: 'name',
    sortAsc: true,
    advancedView: false,
    selected: [],
    selectAll: false,

    contextMenu: {
      open: false,
      x: 0,
      y: 0,
      container: null
    },

    openContextMenu(e, container) {
      e.stopPropagation();
      this.contextMenu.open = true;
      this.contextMenu.x = e.clientX;
      this.contextMenu.y = e.clientY;
      this.contextMenu.container = container;
      
      // Keep menu within viewport bounds
      this.$nextTick(() => {
        const menu = document.getElementById('docker-ctx-menu');
        if (menu) {
          const rect = menu.getBoundingClientRect();
          if (rect.right > window.innerWidth) this.contextMenu.x = window.innerWidth - rect.width - 10;
          if (rect.bottom > window.innerHeight) this.contextMenu.y = window.innerHeight - rect.height - 10;
        }
      });
    },

    closeContextMenu() {
      this.contextMenu.open = false;
      // Intentionally not setting container to null here to allow transition animations to finish cleanly
    },

    get filteredContainers() {
      let list = this.containers.filter((c) =>
        c.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      );

      list.sort((a, b) => {
        let av = a[this.sortCol] ?? '';
        let bv = b[this.sortCol] ?? '';
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return this.sortAsc ? -1 : 1;
        if (av > bv) return this.sortAsc ? 1 : -1;
        return 0;
      });

      return list;
    },

    get useFolders() {
      if (this.folderViewEnabled === false) return false;
      return this.filteredContainers.some(c => c.labels && c.labels['folder.view3']);
    },

    get viewItems() {
      if (!this.useFolders) {
        return this.filteredContainers.map(c => ({ type: 'container', ...c }));
      }

      const items = [];
      const folderMap = {};
      const unassigned = [];

      // Pre-seed explicitly created folders
      const explicitFolders = (Alpine.store('core') && Alpine.store('core').customFolders) || [];
      explicitFolders.forEach(fName => {
        folderMap[fName] = [];
      });

      this.filteredContainers.forEach(c => {
        const fName = c.labels && c.labels['folder.view3'];
        if (fName) {
          if (!folderMap[fName]) folderMap[fName] = [];
          folderMap[fName].push({ type: 'container', ...c, folder: fName });
        } else {
          unassigned.push({ type: 'container', ...c });
        }
      });

      const sortedFolderNames = Object.keys(folderMap).sort();
      sortedFolderNames.forEach(fName => {
        items.push({ type: 'folder', id: 'folder_' + fName, name: fName, count: folderMap[fName].length, containers: folderMap[fName] });
        if (this.isFolderExpanded(fName)) {
            items.push({ type: 'folder_header', id: 'folder_header_' + fName, name: fName });
        }
        items.push(...folderMap[fName]);
      });
      
      items.push(...unassigned);
      return items;
    },

    expandedFolders: {},

    toggleFolder(fName) {
      this.expandedFolders = {
        ...this.expandedFolders,
        [fName]: !this.isFolderExpanded(fName)
      };
    },

    isFolderExpanded(fName) {
      return this.expandedFolders[fName] === true;
    },

    createFolderPrompt() {
      // Dispatch event to open the Alpine modal for FolderView3
      window.dispatchEvent(new CustomEvent('open-folder-modal'));
    },

    editFolder(fName) {
      window.dispatchEvent(new CustomEvent('open-folder-modal', { detail: { folderName: fName } }));
    },

    deleteFolder(fName) {
      if (confirm(`Möchten Sie den Ordner "${fName}" wirklich löschen?\nDie Container darin bleiben erhalten und werden wieder in der normalen Liste angezeigt.`)) {
        if (Alpine.store('core')) {
          Alpine.store('core').removeFolder(fName);
          if (typeof showToast === 'function') {
            showToast(`Ordner "${fName}" gelöscht`, 'success');
          }
        }
      }
    },

    init() {
      window.addEventListener('settings-saved', () => {
        this.folderViewEnabled = typeof appSettings !== 'undefined' ? appSettings.folderViewEnabled : true;
      });

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
        running: this.containers.filter((c) => c.status === 'running').length,
        stopped: this.containers.filter((c) => c.status === 'stopped').length,
        updates: this.containers.filter((c) => !c.upToDate).length,
        total: this.containers.length,
      };
    },

    get hasRootContainers() {
      // Returns true if there is at least one container row that is not in a folder
      return this.viewItems.some(c => c.type === 'container' && !c.folder);
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
        this.selected = this.filteredContainers.map((c) => c.id);
      } else {
        this.selected = [];
      }
    },

    toggleSelectAllInFolder(fName) {
      const folderContainers = this.filteredContainers.filter(c => c.labels && c.labels['folder.view3'] === fName);
      if (folderContainers.length === 0) return;
      const allSelected = folderContainers.every(c => this.selected.includes(c.id));
      
      if (allSelected) {
        this.selected = this.selected.filter(id => !folderContainers.some(c => c.id === id));
      } else {
        const idsToAdd = folderContainers.map(c => c.id).filter(id => !this.selected.includes(id));
        this.selected = [...this.selected, ...idsToAdd];
      }
    },

    isAllSelectedInFolder(fName) {
      const folderContainers = this.filteredContainers.filter(c => c.labels && c.labels['folder.view3'] === fName);
      if (folderContainers.length === 0) return false;
      return folderContainers.every(c => this.selected.includes(c.id));
    },

    bulkAction(action) {
      if (this.selected.length === 0) return;

      const count = this.selected.length;

      if (action === 'delete') {
        if (!confirm(`${count} Container wirklich löschen?`)) return;
        this.containers = this.containers.filter((c) => !this.selected.includes(c.id));
        this.selected = [];
        showToast(`${count} Container gelöscht`, 'success');
        return;
      }

      this.selected.forEach((id) => {
        const c = this.containers.find((x) => x.id === id);
        if (c) {
          if (action === 'start') c.status = 'running';
          if (action === 'stop') c.status = 'stopped';
        }
      });

      const statusWord =
        action === 'start' ? t('started') || 'gestartet' : t('stopped') || 'gestoppt';
      showToast(`${count} Container ${statusWord}`, 'success');
      this.selected = [];
    },

    toggleContainer(id) {
      Alpine.store('core').toggleContainer(id);
    },

    updateContainer(id) {
      Alpine.store('core').updateContainer(id);
      if (typeof showToast === 'function')
        showToast(t('docker.update_started') || 'Update gestartet...', 'info');
    },
  };
}

// Dummy for backwards compatibility with main.js until fully refactored
export function initDocker() {}
