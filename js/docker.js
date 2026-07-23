/* ═══════════════════════════════════════════════════════════
   docker.js — Docker Overview Tab
   In production: communicates with Unraid Docker socket API.
   Currently uses realistic mock data.
═══════════════════════════════════════════════════════════ */

import { ExpandedItemScroller } from './expanded-item-scroller.js';
import { ContainerCommandClient } from './container-command-client.js?v=23';
import { ComposeStackClient } from './compose-stack-client.js?v=23';
import { ContainerTerminalController } from './container-terminal-controller.js?v=17';
import { ContainerWebUiResolver } from './container-web-ui-resolver.js?v=24';
import { ModalScrollLock } from './modal-scroll-lock.js?v=19';

/**
 *
 */
export function dockerApp() {
  const expandedItemScroller = new ExpandedItemScroller();
  const commandClient = new ContainerCommandClient();
  const composeStackClient = new ComposeStackClient();
  const terminalController = new ContainerTerminalController();
  const webUiResolver = new ContainerWebUiResolver();
  const terminalScrollLock = new ModalScrollLock();

  return {
    get containers() {
      return Alpine.store('core').containers;
    },
    folderViewEnabled: typeof appSettings !== 'undefined' ? appSettings.folderViewEnabled : true,
    get isLoading() {
      return Alpine.store('core').loading;
    },
    searchQuery: '',
    sortCol: 'name',
    sortAsc: true,
    draggedContainerId: null,
    draggedFolder: null,
    dragOverFolder: null,
    dragOverRoot: false,
    dragOverTargetId: null,
    dragOverTargetType: null,
    dragOverPosition: null, // 'before' or 'after'
    updateTick: 0,
    advancedView: false,
    menuOpen: { docker: false, compose: false },
    selected: [],
    selectAll: false,
    actionBusy: false,
    composeAutostartOnly: false,
    isCreatingFolder: false,
    newFolderName: '',
    editingFolderName: null,
    editFolderNameInput: '',

    // Delete Folder Modal State
    showDeleteFolderModal: false,
    folderToDelete: null,

    // Icon Modal State
    showIconModal: false,
    iconTargetFolder: null,
    iconInputValue: '',

    // Compose Modal State
    showComposeModal: false,
    composeStackName: '',
    composeContent: '',

    // Circular Menu State
    circularMenuMainOpen: false,
    circularMenuStackOpen: false,

    contextMenu: {
      open: false,
      x: 0,
      y: 0,
      container: null,
    },

    terminalViewer: {
      open: false,
      loading: false,
      container: null,
      mode: 'logs',
      error: '',
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
          if (rect.right > window.innerWidth)
            this.contextMenu.x = window.innerWidth - rect.width - 10;
          if (rect.bottom > window.innerHeight)
            this.contextMenu.y = window.innerHeight - rect.height - 10;
        }
      });
    },

    closeContextMenu() {
      this.contextMenu.open = false;
      // Intentionally not setting container to null here to allow transition animations to finish cleanly
    },

    get filteredContainers() {
      let list = [...this.containers].filter((c) =>
        c.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      );

      if (this.sortCol !== 'custom') {
        list.sort((a, b) => {
          let av = a[this.sortCol] ?? '';
          let bv = b[this.sortCol] ?? '';
          if (typeof av === 'string') av = av.toLowerCase();
          if (typeof bv === 'string') bv = bv.toLowerCase();
          if (av < bv) return this.sortAsc ? -1 : 1;
          if (av > bv) return this.sortAsc ? 1 : -1;
          return 0;
        });
      }

      return list;
    },

    get useFolders() {
      if (this.folderViewEnabled === false) return false;
      const hasCustomFolders = Alpine.store('core')?.customFolders?.length > 0;
      return hasCustomFolders || this.filteredContainers.some((c) => c.labels?.['folder.view3']);
    },

    get viewItems() {
      // Access updateTick to create a dependency
      (() => this.updateTick)();

      if (!this.useFolders) {
        return this.filteredContainers.map((c) => ({ type: 'container', ...c }));
      }

      const items = [];
      const folderMap = {};
      const unassigned = [];

      // Pre-seed explicitly created folders
      const explicitFolders = Alpine.store('core')?.customFolders || [];
      explicitFolders.forEach((fName) => {
        folderMap[fName] = [];
      });

      this.filteredContainers.forEach((c) => {
        const fName = c.labels?.['folder.view3'];
        if (fName) {
          if (!folderMap[fName]) folderMap[fName] = [];
          folderMap[fName].push({ type: 'container', ...c, folder: fName });
        } else if (!c.labels?.['com.docker.compose.project']) {
          // If it's part of a compose stack, don't show it here
          unassigned.push({ type: 'container', ...c });
        }
      });

      const customFolders = Alpine.store('core')?.customFolders || [];
      const sortedFolderNames = [];
      customFolders.forEach((f) => {
        sortedFolderNames.push(f);
        if (!folderMap[f]) folderMap[f] = [];
      });
      Object.keys(folderMap).forEach((f) => {
        if (!sortedFolderNames.includes(f)) sortedFolderNames.push(f);
      });
      sortedFolderNames.forEach((fName) => {
        items.push({
          type: 'folder',
          id: 'folder_' + fName,
          name: fName,
          count: folderMap[fName].length,
          containers: folderMap[fName],
          isStack: false,
          icon: Alpine.store('core')?.folderIcons?.[fName] || null,
        });
        if (this.isFolderExpanded(fName)) {
          items.push(
            { type: 'folder_header', id: 'folder_header_' + fName, name: fName },
            ...folderMap[fName]
          );
        }
      });

      return [...items, ...unassigned];
    },

    get stackItems() {
      // Access updateTick to create a dependency
      (() => this.updateTick)();

      const items = [];
      const stackMap = {};

      const customStacks = Alpine.store('core')?.customStacks || [];
      customStacks.forEach((s) => {
        stackMap[s.name] = [];
      });

      this.filteredContainers.forEach((c) => {
        const sName = c.labels?.['com.docker.compose.project'];
        if (sName && (!this.composeAutostartOnly || c.autostart)) {
          if (!stackMap[sName]) stackMap[sName] = [];
          stackMap[sName].push({ type: 'container', ...c, folder: sName });
        }
      });

      const sortedStackNames = Object.keys(stackMap);
      sortedStackNames.forEach((sName) => {
        items.push({
          type: 'folder',
          id: 'stack_' + sName,
          name: sName,
          count: stackMap[sName].length,
          containers: stackMap[sName],
          isStack: true,
          icon: null,
        });
        if (this.isFolderExpanded(sName)) {
          items.push(
            { type: 'folder_header', id: 'folder_header_' + sName, name: sName },
            ...stackMap[sName]
          );
        }
      });

      return items;
    },

    expandedFolders: {},

    toggleFolder(fName, trigger) {
      const expanded = !this.isFolderExpanded(fName);
      this.expandedFolders = {
        ...this.expandedFolders,
        [fName]: expanded,
      };
      if (expanded) this.$nextTick(() => expandedItemScroller.reveal(trigger, fName));
    },

    isFolderExpanded(fName) {
      return this.expandedFolders[fName] === true;
    },

    createFolderPrompt() {
      this.isCreatingFolder = true;
      this.newFolderName = '';
      setTimeout(() => {
        const input = document.getElementById('new-folder-input');
        if (input) input.focus();
      }, 50);
    },

    saveNewFolder() {
      const name = this.newFolderName.trim();
      if (name) {
        Alpine.store('core').addFolder(name);
        this.updateTick++;
      }
      this.isCreatingFolder = false;
      this.newFolderName = '';
    },

    cancelNewFolder() {
      this.isCreatingFolder = false;
      this.newFolderName = '';
    },

    editFolder(fName) {
      this.editingFolderName = fName;
      this.editFolderNameInput = fName;
      setTimeout(() => {
        const input = document.getElementById('edit-folder-input-' + fName);
        if (input) input.focus();
      }, 50);
    },

    saveEditFolder() {
      const name = this.editFolderNameInput.trim();
      if (name && name !== this.editingFolderName) {
        Alpine.store('core').renameFolder(this.editingFolderName, name);
        this.updateTick++;
      }
      this.editingFolderName = null;
      this.editFolderNameInput = '';
    },

    cancelEditFolder() {
      this.editingFolderName = null;
      this.editFolderNameInput = '';
    },

    deleteFolder(fName) {
      this.folderToDelete = fName;
      this.showDeleteFolderModal = true;
      this.closeContextMenu();
    },

    confirmDeleteFolder() {
      if (this.folderToDelete) {
        if (Alpine.store('core')) {
          Alpine.store('core').removeFolder(this.folderToDelete);
          this.updateTick++; // Force reactivity
          if (typeof showToast === 'function') {
            showToast(t('general.folder_deleted', { name: this.folderToDelete }), 'success');
          }
        }
      }
      this.closeDeleteFolderModal();
    },

    closeDeleteFolderModal() {
      this.showDeleteFolderModal = false;
      this.folderToDelete = null;
    },

    // Icon Handlers
    openIconModal(folderName) {
      this.iconTargetFolder = folderName;
      this.iconInputValue = Alpine.store('core').folderIcons[folderName] || '';
      this.showIconModal = true;
    },

    closeIconModal() {
      this.showIconModal = false;
      this.iconTargetFolder = null;
      this.iconInputValue = '';
    },

    saveIcon() {
      if (this.iconTargetFolder) {
        Alpine.store('core').setFolderIcon(this.iconTargetFolder, this.iconInputValue.trim());
        this.updateTick++; // force reactivity
      }
      this.closeIconModal();
    },

    handleIconUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.iconInputValue = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    // Drag & Drop Handlers
    startDrag(e, id, type = 'container') {
      if (type === 'folder') {
        this.draggedFolder = id;
      } else {
        this.draggedContainerId = id;
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },

    endDrag() {
      this.draggedContainerId = null;
      this.draggedFolder = null;
      this.dragOverFolder = null;
      this.dragOverRoot = false;
      this.dragOverTargetId = null;
      this.dragOverPosition = null;
    },

    handleSortDragOver(e, targetId, isHorizontal = false, type = 'container') {
      if (!this.draggedContainerId && !this.draggedFolder) return;
      if (type === 'container' && this.draggedContainerId === targetId) return;
      if (type === 'folder' && this.draggedFolder === targetId) return;
      if (this.draggedFolder && type === 'container') return; // Don't allow dropping folder on container

      const targetElement = e.currentTarget;
      const rect = targetElement.getBoundingClientRect();

      if (isHorizontal) {
        const midX = rect.left + rect.width / 2;
        this.dragOverPosition = e.clientX < midX ? 'before' : 'after';
      } else {
        const midY = rect.top + rect.height / 2;
        this.dragOverPosition = e.clientY < midY ? 'before' : 'after';
      }
      this.dragOverTargetId = targetId;
      this.dragOverTargetType = type;

      // Clear folder drop states
      this.dragOverFolder = null;
      this.dragOverRoot = false;
    },

    handleSortDragLeave() {
      this.dragOverTargetId = null;
      this.dragOverTargetType = null;
      this.dragOverPosition = null;
    },

    // prettier-ignore
    handleSortDrop() { // NOSONAR
      if ((!this.draggedContainerId && !this.draggedFolder) || !this.dragOverTargetId) return;

      let allContainers = [...Alpine.store('core').containers];

      if (this.draggedFolder && this.dragOverTargetType === 'folder') {
        const itemsToMove = [];
        for (let i = allContainers.length - 1; i >= 0; i--) {
          if (
            allContainers[i].labels &&
            allContainers[i].labels['folder.view3'] === this.draggedFolder
          ) {
            itemsToMove.unshift(allContainers[i]);
            allContainers.splice(i, 1);
          }
        }

        let insertIndex = allContainers.length;
        if (this.dragOverPosition === 'before') {
          const firstIdx = allContainers.findIndex(
            (c) => c.labels && c.labels['folder.view3'] === this.dragOverTargetId
          );
          if (firstIdx !== -1) insertIndex = firstIdx;
        } else {
          let lastIdx = -1;
          allContainers.forEach((c, idx) => {
            if (c.labels && c.labels['folder.view3'] === this.dragOverTargetId) lastIdx = idx;
          });
          if (lastIdx !== -1) insertIndex = lastIdx + 1;
        }

        allContainers.splice(insertIndex, 0, ...itemsToMove);
        Alpine.store('core').containers = allContainers;

        let cFolders = [...(Alpine.store('core').customFolders || [])];
        if (!cFolders.includes(this.draggedFolder)) cFolders.push(this.draggedFolder);
        cFolders = cFolders.filter((f) => f !== this.draggedFolder);

        let folderInsertIdx = cFolders.length;
        let tIdx = cFolders.indexOf(this.dragOverTargetId);
        if (tIdx !== -1) folderInsertIdx = this.dragOverPosition === 'before' ? tIdx : tIdx + 1;
        cFolders.splice(folderInsertIdx, 0, this.draggedFolder);
        Alpine.store('core').customFolders = cFolders;
        Alpine.store('core').persistLayout();
      } else if (this.draggedContainerId && this.dragOverTargetType === 'container') {
        let idsToMove = [this.draggedContainerId];
        if (this.selected.includes(this.draggedContainerId)) {
          idsToMove = this.selected;
        }

        const targetIndex = allContainers.findIndex((c) => c.id === this.dragOverTargetId);
        if (targetIndex === -1) return;

        const targetContainer = allContainers[targetIndex];
        const targetFolder = targetContainer?.labels?.['folder.view3'];

        const itemsToMove = [];
        idsToMove.forEach((id) => {
          const idx = allContainers.findIndex((c) => c.id === id);
          if (idx !== -1) {
            const c = allContainers[idx];
            if (!c.labels) c.labels = {};
            if (targetFolder) {
              c.labels['folder.view3'] = targetFolder;
            } else {
              delete c.labels['folder.view3'];
            }
            itemsToMove.push(c);
            allContainers.splice(idx, 1);
          }
        });

        let newTargetIndex = allContainers.findIndex((c) => c.id === this.dragOverTargetId);
        if (newTargetIndex === -1) newTargetIndex = allContainers.length;

        const insertIndex =
          this.dragOverPosition === 'before' ? newTargetIndex : newTargetIndex + 1;
        allContainers.splice(insertIndex, 0, ...itemsToMove);

        Alpine.store('core').containers = allContainers;
        Alpine.store('core').persistLayout();
      }

      this.sortCol = 'custom';
      this.updateTick++;

      this.draggedContainerId = null;
      this.draggedFolder = null;
      this.dragOverTargetId = null;
      this.dragOverPosition = null;
    },

    // prettier-ignore
    handleDragOver(_e, folderName) { // NOSONAR
      if (!this.draggedContainerId) return;

      let idsToMove = [this.draggedContainerId];
      if (this.selected.includes(this.draggedContainerId)) {
        idsToMove = this.selected;
      }

      let canDrop = false;
      for (const id of idsToMove) {
        const c = this.containers.find((x) => x.id === id);
        if (c) {
          if (folderName) {
            if (!c.labels || c.labels['folder.view3'] !== folderName) canDrop = true;
          } else if (c.labels?.['folder.view3']) {
            canDrop = true;
          }
        }
      }

      if (!canDrop) return;

      if (folderName) {
        this.dragOverFolder = folderName;
        this.dragOverRoot = false;
      } else {
        this.dragOverRoot = true;
        this.dragOverFolder = null;
      }
    },

    handleDragLeave(folderName) {
      if (folderName && this.dragOverFolder === folderName) {
        this.dragOverFolder = null;
      } else if (!folderName && this.dragOverRoot) {
        this.dragOverRoot = false;
      }
    },

    handleDrop(folderName) {
      if (!this.draggedContainerId) return;

      let idsToMove = [this.draggedContainerId];
      if (this.selected.includes(this.draggedContainerId)) {
        idsToMove = this.selected;
      }

      let moveCount = 0;
      const store = Alpine.store('core');
      idsToMove.forEach((id) => {
        const c = store.containers.find((x) => x.id === id);
        if (c) {
          if (folderName) {
            if (c.labels?.['folder.view3'] !== folderName) {
              store.setLabel(id, 'folder.view3', folderName);
              moveCount++;
            }
          } else if (c.labels?.['folder.view3']) {
            store.setLabel(id, 'folder.view3', '');
            moveCount++;
          }
        }
      });

      if (moveCount > 0) {
        if (folderName) {
          if (typeof showToast === 'function')
            showToast(`${moveCount} Container verschoben nach "${folderName}"`, 'success');
        } else if (typeof showToast === 'function') {
          showToast(t('general.containers_removed', { count: moveCount }), 'success');
        }
      }

      this.updateTick++;

      this.draggedContainerId = null;
      this.draggedFolder = null;
      this.dragOverFolder = null;
      this.dragOverRoot = false;
      this.dragOverTargetId = null;
      this.dragOverPosition = null;
    },

    init() {
      window.addEventListener('settings-saved', () => {
        this.folderViewEnabled =
          typeof appSettings !== 'undefined' ? appSettings.folderViewEnabled : true;
      });

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
        healthy: this.containers.filter((c) => c.status === 'running').length,
        total: this.containers.length,
      };
    },

    get hasRootContainers() {
      // Returns true if there is at least one container row that is not in a folder
      return this.viewItems.some((c) => c.type === 'container' && !c.folder);
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
      const folderContainers = this.filteredContainers.filter(
        (c) => c.labels && c.labels['folder.view3'] === fName
      );
      if (folderContainers.length === 0) return;
      const allSelected = folderContainers.every((c) => this.selected.includes(c.id));

      if (allSelected) {
        this.selected = this.selected.filter((id) => !folderContainers.some((c) => c.id === id));
      } else {
        const idsToAdd = folderContainers
          .map((c) => c.id)
          .filter((id) => !this.selected.includes(id));
        this.selected = [...this.selected, ...idsToAdd];
      }
    },

    isAllSelectedInFolder(fName) {
      const folderContainers = this.filteredContainers.filter(
        (c) => c.labels && c.labels['folder.view3'] === fName
      );
      if (folderContainers.length === 0) return false;
      return folderContainers.every((c) => this.selected.includes(c.id));
    },

    findContainers(ids) {
      return ids
        .map((id) => this.containers.find((container) => container.id === id))
        .filter(Boolean);
    },

    async performAction(action, containers, message) {
      if (this.actionBusy || containers.length === 0) return;
      this.actionBusy = true;
      try {
        await commandClient.executeMany(action, containers);
        await Alpine.store('core').refreshContainers();
        if (typeof showToast === 'function') showToast(message, 'success');
      } catch (error) {
        if (typeof showToast === 'function') showToast(error.message || String(error), 'error');
      } finally {
        this.actionBusy = false;
      }
    },

    async bulkAction(action) {
      if (this.selected.length === 0) return;
      const count = this.selected.length;
      const containers = this.findContainers(this.selected);
      const nativeAction = action === 'delete' ? 'remove' : action;
      if (
        nativeAction === 'remove' &&
        !confirm(`Remove ${count} container${count === 1 ? '' : 's'}?`)
      )
        return;
      await this.performAction(
        nativeAction,
        containers,
        `${count} container${count === 1 ? '' : 's'} updated`
      );
      this.selected = [];
    },

    async toggleContainer(id) {
      const container = this.containers.find((item) => item.id === id);
      if (!container) return;
      const action =
        container.status === 'running'
          ? 'stop'
          : container.status === 'paused'
            ? 'resume'
            : 'start';
      await this.performAction(action, [container], `${container.name} ${action} complete`);
    },

    async actionContainer(action, id) {
      const container = this.containers.find((item) => item.id === id);
      if (!container) return;
      if (action === 'remove' && !confirm(`Remove ${container.name}?`)) return;
      await this.performAction(action, [container], `${container.name} ${action} complete`);
    },

    async actionAll(action, target) {
      const containers = this.containers.filter((container) => {
        const isStack = Boolean(container.labels?.['com.docker.compose.project']);
        if (!((target === 'main' && !isStack) || (target === 'stack' && isStack))) return false;
        if (action === 'start') return container.status === 'stopped';
        if (action === 'stop')
          return container.status === 'running' || container.status === 'paused';
        if (action === 'pause') return container.status === 'running';
        if (action === 'resume') return container.status === 'paused';
        return true;
      });
      await this.performAction(
        action,
        containers,
        `${containers.length} containers ${action} complete`
      );
    },

    async checkUpdates() {
      if (this.actionBusy) return;
      this.actionBusy = true;
      try {
        if (typeof showToast === 'function') showToast('Checking container updates...', 'info');
        await commandClient.checkUpdates();
        await Alpine.store('core').refreshContainers();
        if (typeof showToast === 'function') showToast('Update check complete', 'success');
      } catch (error) {
        if (typeof showToast === 'function') showToast(error.message || String(error), 'error');
      } finally {
        this.actionBusy = false;
      }
    },

    async updateContainers(containers) {
      if (this.actionBusy || containers.length === 0) return;
      if (!confirm(`Update ${containers.length} container${containers.length === 1 ? '' : 's'}?`))
        return;
      this.actionBusy = true;
      try {
        if (typeof showToast === 'function') showToast('Container update started...', 'info');
        await commandClient.update(containers);
        await Alpine.store('core').refreshContainers();
        if (typeof showToast === 'function') showToast('Container update complete', 'success');
      } catch (error) {
        if (typeof showToast === 'function') showToast(error.message || String(error), 'error');
      } finally {
        this.actionBusy = false;
      }
    },

    async updateContainer(id) {
      const container = this.containers.find((item) => item.id === id);
      if (container) await this.updateContainers([container]);
    },

    async updateAllContainers(target = 'main') {
      const containers = this.containers.filter((container) => {
        const isStack = Boolean(container.labels?.['com.docker.compose.project']);
        return container.upToDate === false && (target === 'stack' ? isStack : !isStack);
      });
      await this.updateContainers(containers);
    },

    async setContainerAutostart(container, enabled) {
      try {
        await commandClient.setAutostart(container, enabled);
        container.autostart = enabled;
        if (typeof showToast === 'function')
          showToast(`${container.name} autostart ${enabled ? 'enabled' : 'disabled'}`, 'success');
      } catch (error) {
        container.autostart = !enabled;
        if (typeof showToast === 'function') showToast(error.message || String(error), 'error');
      }
    },

    async openTerminal(container, mode) {
      if (!container) return;
      terminalScrollLock.lock();
      this.terminalViewer = { open: true, loading: true, container, mode, error: '' };
      try {
        await this.$nextTick();
        const output = document.getElementById('dockerCustomTerminal');
        if (!output) throw new Error('Custom terminal surface is unavailable');
        await terminalController.open(output, container, mode);
      } catch (error) {
        this.terminalViewer.error = error.message || String(error);
      } finally {
        this.terminalViewer.loading = false;
      }
    },

    async openConsole(container) {
      await this.openTerminal(container, 'console');
    },

    async openLogs(container) {
      await this.openTerminal(container, 'logs');
    },

    closeTerminal() {
      this.terminalViewer.open = false;
      terminalController.dispose();
      terminalScrollLock.unlock();
    },

    destroy() {
      terminalController.dispose();
      terminalScrollLock.unlock();
    },

    async refreshTerminal() {
      this.terminalViewer.loading = true;
      this.terminalViewer.error = '';
      try {
        await terminalController.refresh();
      } catch (error) {
        this.terminalViewer.error = error.message || String(error);
      } finally {
        this.terminalViewer.loading = false;
      }
    },

    clearTerminal() {
      terminalController.clear();
    },

    openExternal(url) {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    },

    hasWebUi(container) {
      return webUiResolver.hasWebUi(container);
    },

    openWebUi(container) {
      const url = webUiResolver.resolve(container);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (typeof showToast === 'function') {
        showToast(t('general.webui_unavailable'), 'error');
      }
    },

    openAddContainer() {
      window.parent.location.assign('/Docker/AddContainer');
    },

    openSettings() {
      document.getElementById('settingsBtn')?.click();
    },

    editContainer(container) {
      if (!container?.template) {
        if (typeof showToast === 'function')
          showToast('No Unraid template is available for this container', 'error');
        return;
      }
      window.parent.location.assign(
        `/Docker/UpdateContainer?xmlTemplate=edit:${encodeURIComponent(container.template)}`
      );
    },

    async showContainerSizes(target = 'main') {
      if (this.actionBusy) return;
      const containers = this.containers.filter((container) => {
        const isStack = Boolean(container.labels?.['com.docker.compose.project']);
        return target === 'stack' ? isStack : !isStack;
      });
      this.actionBusy = true;
      try {
        const sizes = await commandClient.sizes(containers);
        const totals = Object.values(sizes).reduce(
          (result, size) => ({
            writable: result.writable + Number(size.writable || 0),
            root: result.root + Number(size.root || 0),
          }),
          { writable: 0, root: 0 }
        );
        if (typeof showToast === 'function') {
          showToast(
            `Container size: ${globalThis.formatBytes(totals.root)} total, ${globalThis.formatBytes(totals.writable)} writable`,
            'info'
          );
        }
      } catch (error) {
        if (typeof showToast === 'function') showToast(error.message || String(error), 'error');
      } finally {
        this.actionBusy = false;
      }
    },

    openComposeModal() {
      this.composeStackName = '';
      this.composeContent = '';
      this.showComposeModal = true;
    },

    closeComposeModal() {
      this.showComposeModal = false;
    },

    async deployStack() {
      if (!this.composeStackName.trim() || !this.composeContent.trim()) {
        if (typeof showToast === 'function')
          showToast('Stack name and Compose content are required', 'error');
        return;
      }
      if (this.actionBusy) return;
      const name = this.composeStackName.trim();
      this.actionBusy = true;
      try {
        if (typeof showToast === 'function') showToast(`Deploying ${name}...`, 'info');
        await composeStackClient.deploy(name, this.composeContent);
        this.closeComposeModal();
        await Alpine.store('core').refreshContainers();
        if (typeof showToast === 'function') showToast(`${name} deployed`, 'success');
      } catch (error) {
        if (typeof showToast === 'function') showToast(error.message || String(error), 'error');
      } finally {
        this.actionBusy = false;
      }
    },
  };
}

// Dummy for backwards compatibility with main.js until fully refactored
/**
 *
 */
export function initDocker() {} // NOSONAR
