import { ModalScrollLock } from './modal-scroll-lock.js?v=19';
import { GameServerFileEditor } from './game-server-file-editor.js?v=1';

export class GameServerFileManager {
  constructor(client, dependencies) {
    this.client = client;
    this.toggleModal = dependencies.toggleModal;
    this.toast = dependencies.toast;
    this.translate = dependencies.translate;
    this.confirm = dependencies.confirm || ((message) => window.confirm(message));
    this.prompt = dependencies.prompt || ((message, value) => window.prompt(message, value));
    this.scrollLock = dependencies.scrollLock || new ModalScrollLock();
    this.server = null;
    this.directory = '';
    this.hostRoot = '';
    this.containerRoot = '';
    this.file = null;
    this.selected = null;
    this.entries = [];
    this.sort = 'name';
    this.dragDepth = 0;
    this.request = null;
    this.generation = 0;
    this.editor = null;
    this.boundBeforeUnload = (event) => this.beforeUnload(event);
  }

  async open(server) {
    this.server = server;
    this.directory = '';
    this.hostRoot = server.dataPath || '';
    this.containerRoot = '';
    this.file = null;
    this.selected = null;
    this.entries = [];
    this.ensureEditor();
    this.resetEditor();
    this.updateHeader();
    this.toggleModal('fileManagerModal', true);
    this.scrollLock.lock();
    window.addEventListener('beforeunload', this.boundBeforeUnload);
    this.view().search.value = '';
    window.queueMicrotask(() => this.view().search.focus());
    await this.loadDirectory('', true);
  }

  close() {
    if (!this.canDiscard()) return false;
    this.abort();
    this.toggleModal('fileManagerModal', false);
    this.scrollLock.unlock();
    window.removeEventListener('beforeunload', this.boundBeforeUnload);
    this.server = null;
    this.file = null;
    this.selected = null;
    return true;
  }

  async loadDirectory(path, force = false) {
    if (!this.server || (!force && !this.canDiscard())) return;
    const operation = this.begin();
    this.setBusy(true, this.text('general.loading'));
    try {
      const listing = await this.client.list(
        this.server.containerId,
        path,
        this.containerRoot,
        operation.signal
      );
      if (!this.current(operation)) return;
      this.directory = listing.path;
      this.hostRoot = listing.hostRoot;
      this.containerRoot = listing.containerRoot;
      this.entries = listing.entries;
      this.file = null;
      this.selected = null;
      this.resetEditor();
      this.render();
      this.renderBreadcrumbs();
      this.updateHeader();
    } catch (error) {
      if (this.aborted(error)) return;
      this.renderError(error);
      this.notify('general.fm_load_failed', error, 'error');
    } finally {
      if (this.current(operation)) this.setBusy(false);
    }
  }

  async select(entry) {
    if (entry.type === 'directory') {
      if (this.selected?.path === entry.path) {
        await this.loadDirectory(entry.path);
        return;
      }
      if (!this.canDiscard()) return;
      this.selected = entry;
      this.file = null;
      this.resetEditor();
      this.selected = entry;
      this.activate(entry.path);
      this.view().currentFile.textContent = entry.path;
      this.view().rename.disabled = false;
      this.view().delete.disabled = false;
      this.renderMetadata(entry);
      return;
    }
    if (!this.canDiscard()) return;
    this.selected = entry;
    this.activate(entry.path);
    this.renderMetadata(entry);
    this.view().download.disabled = false;
    this.view().rename.disabled = false;
    this.view().delete.disabled = false;
    if (!entry.editable) {
      this.file = { ...entry, writable: false };
      this.view().currentFile.textContent = entry.path;
      this.editor.reset(this.text('general.fm_not_editable'));
      this.view().download.disabled = false;
      this.view().rename.disabled = false;
      this.view().delete.disabled = false;
      return;
    }
    const operation = this.begin();
    this.setBusy(true, this.text('general.fm_loading_file'));
    try {
      const file = await this.client.read(
        this.server.containerId,
        entry.path,
        this.containerRoot,
        operation.signal
      );
      if (!this.current(operation)) return;
      this.file = file;
      this.view().currentFile.textContent = file.path;
      this.editor.load(file);
      this.view().save.disabled = !file.writable;
      this.view().download.disabled = false;
      this.view().rename.disabled = false;
      this.view().delete.disabled = false;
      this.renderMetadata({ ...entry, ...file });
    } catch (error) {
      if (!this.aborted(error)) this.notify('general.fm_load_failed', error, 'error');
    } finally {
      if (this.current(operation)) this.setBusy(false);
    }
  }

  async save() {
    if (!this.server || !this.file || !this.file.writable || !this.editor.isDirty()) return;
    const operation = this.begin();
    this.setBusy(true, this.text('general.fm_saving'));
    try {
      const result = await this.client.save(
        this.server.containerId,
        this.file.path,
        this.editor.content(),
        this.file.modified,
        this.containerRoot,
        operation.signal
      );
      if (!this.current(operation)) return;
      this.file = { ...this.file, ...result };
      this.editor.markSaved(this.editor.content());
      this.toast(this.text('general.file_saved'), 'success');
      await this.refreshAfterMutation(this.file.path);
    } catch (error) {
      if (!this.aborted(error)) this.notify('general.fm_save_failed', error, 'error');
    } finally {
      if (this.current(operation)) this.setBusy(false);
    }
  }

  async refresh() {
    if (!this.canDiscard()) return;
    await this.loadDirectory(this.directory, true);
  }

  async download() {
    if (!this.server || !this.selected) return;
    const operation = this.begin();
    this.setBusy(true, this.text('general.fm_downloading'));
    try {
      const blob = await this.client.download(
        this.server.containerId,
        this.selected.path,
        this.containerRoot,
        operation.signal
      );
      if (!this.current(operation)) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.selected.name;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      if (!this.aborted(error)) this.notify('general.fm_download_failed', error, 'error');
    } finally {
      if (this.current(operation)) this.setBusy(false);
    }
  }

  async createFile() {
    await this.create('file');
  }

  async createDirectory() {
    await this.create('directory');
  }

  async create(type) {
    if (!this.server || !this.canDiscard()) return;
    const key = type === 'file' ? 'general.fm_new_file_prompt' : 'general.fm_new_folder_prompt';
    const name = this.prompt(this.text(key), '');
    if (!name) return;
    try {
      const result =
        type === 'file'
          ? await this.client.createFile(
              this.server.containerId,
              this.directory,
              name,
              this.containerRoot
            )
          : await this.client.createDirectory(
              this.server.containerId,
              this.directory,
              name,
              this.containerRoot
            );
      this.toast(this.text('general.fm_created'), 'success');
      await this.loadDirectory(this.directory, true);
      const entry = this.entries.find((item) => item.path === result.path);
      if (entry && type === 'file') await this.select(entry);
    } catch (error) {
      this.notify('general.fm_operation_failed', error, 'error');
    }
  }

  async rename() {
    if (!this.server || !this.selected || !this.canDiscard()) return;
    const name = this.prompt(this.text('general.fm_rename_prompt'), this.selected.name);
    if (!name || name === this.selected.name) return;
    try {
      await this.client.rename(
        this.server.containerId,
        this.selected.path,
        name,
        this.containerRoot
      );
      this.toast(this.text('general.fm_renamed'), 'success');
      await this.loadDirectory(this.directory, true);
    } catch (error) {
      this.notify('general.fm_operation_failed', error, 'error');
    }
  }

  async deleteSelected() {
    if (!this.server || !this.selected || !this.canDiscard()) return;
    const message = this.text('general.fm_delete_confirm', { name: this.selected.name });
    if (!this.confirm(message)) return;
    try {
      await this.client.delete(
        this.server.containerId,
        this.selected.path,
        this.selected.type === 'directory',
        this.containerRoot
      );
      this.toast(this.text('general.fm_deleted'), 'success');
      await this.loadDirectory(this.directory, true);
    } catch (error) {
      this.notify('general.fm_operation_failed', error, 'error');
    }
  }

  chooseUpload() {
    this.view().uploadInput.click();
  }

  async uploadSelected(event) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    await this.upload(files);
  }

  dragEnter(event) {
    event.preventDefault();
    this.dragDepth += 1;
    this.view().overlay.classList.add('drag-active');
  }

  dragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  dragLeave(event) {
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.view().overlay.classList.remove('drag-active');
  }

  async drop(event) {
    event.preventDefault();
    this.dragDepth = 0;
    this.view().overlay.classList.remove('drag-active');
    await this.upload([...(event.dataTransfer?.files || [])]);
  }

  async upload(files) {
    if (!this.server || files.length === 0 || !this.canDiscard()) return;
    const operation = this.begin();
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        let overwrite = false;
        const existing = this.entries.some(
          (entry) =>
            entry.type === 'file' &&
            entry.name.toLocaleLowerCase() === file.name.toLocaleLowerCase()
        );
        if (existing) {
          overwrite = this.confirm(this.text('general.fm_overwrite_confirm', { name: file.name }));
          if (!overwrite) continue;
        }
        await this.client.upload(
          this.server.containerId,
          this.directory,
          file,
          overwrite,
          this.containerRoot,
          (loaded, total) => this.uploadProgress(file.name, index, files.length, loaded, total),
          operation.signal
        );
      }
      if (!this.current(operation)) return;
      this.toast(this.text('general.fm_upload_success'), 'success');
      await this.loadDirectory(this.directory, true);
    } catch (error) {
      if (!this.aborted(error)) this.notify('general.fm_upload_failed', error, 'error');
    } finally {
      if (this.current(operation)) this.setBusy(false);
    }
  }

  filter() {
    this.render();
  }

  changeSort() {
    this.sort = this.view().sort.value;
    this.render();
  }

  findNext() {
    if (!this.editor.findNext(this.view().find.value)) {
      this.toast(this.text('general.fm_no_match'), 'info');
    }
  }

  replace() {
    this.editor.replace(this.view().find.value, this.view().replace.value);
  }

  keyboard(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 's') {
      event.preventDefault();
      this.save();
    }
    if (event.key === 'Tab') this.trapFocus(event);
    if (event.key === 'Escape') this.close();
  }

  trapFocus(event) {
    const focusable = [
      ...this.view().modal.querySelectorAll('button, input, select, textarea'),
    ].filter((element) => !element.disabled && !element.hidden && element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  render() {
    const query = this.view().search.value.trim().toLocaleLowerCase();
    const entries = this.entries
      .filter((entry) => entry.name.toLocaleLowerCase().includes(query))
      .toSorted((left, right) => this.compare(left, right));
    const tree = this.view().tree;
    tree.replaceChildren();
    entries.forEach((entry) => tree.appendChild(this.button(entry)));
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fm-empty';
      empty.textContent = query
        ? this.text('general.fm_no_results')
        : this.text('general.fm_empty_directory');
      tree.appendChild(empty);
    }
  }

  compare(left, right) {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
    if (this.sort === 'modified') return Date.parse(right.modified) - Date.parse(left.modified);
    if (this.sort === 'size') return right.size - left.size;
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
  }

  button(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fm-entry';
    button.dataset.path = entry.path;
    button.dataset.type = entry.type;
    const icon = document.createElement('span');
    icon.className = 'material-icons-round fm-entry-icon';
    icon.textContent = entry.type === 'directory' ? 'folder' : 'description';
    const body = document.createElement('span');
    body.className = 'fm-entry-body';
    const name = document.createElement('span');
    name.className = 'fm-entry-name';
    name.textContent = entry.name;
    const meta = document.createElement('span');
    meta.className = 'fm-entry-meta';
    meta.textContent = `${entry.type === 'directory' ? this.text('general.fm_folder') : this.bytes(entry.size)} · ${this.date(entry.modified)}`;
    body.append(name, meta);
    const lock = document.createElement('span');
    lock.className = 'material-icons-round fm-entry-lock';
    lock.textContent = entry.writable ? '' : 'lock';
    button.append(icon, body, lock);
    button.addEventListener('click', () => this.select(entry));
    return button;
  }

  renderBreadcrumbs() {
    const view = this.view();
    view.breadcrumbs.replaceChildren();
    const parts = this.directory ? this.directory.split('/') : [];
    const root = this.breadcrumb(this.containerRoot || '/', '');
    view.breadcrumbs.appendChild(root);
    parts.forEach((part, index) => {
      const separator = document.createElement('span');
      separator.className = 'material-icons-round fm-breadcrumb-separator';
      separator.textContent = 'chevron_right';
      view.breadcrumbs.append(
        separator,
        this.breadcrumb(part, parts.slice(0, index + 1).join('/'))
      );
    });
  }

  breadcrumb(label, path) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fm-breadcrumb';
    button.textContent = label;
    button.addEventListener('click', () => this.loadDirectory(path));
    return button;
  }

  activate(path) {
    this.view()
      .tree.querySelectorAll('.fm-entry')
      .forEach((button) => {
        button.classList.toggle('active', button.dataset.path === path);
      });
  }

  resetEditor() {
    const view = this.view();
    view.currentFile.textContent = this.text('general.fm_select_file');
    this.editor.reset(this.text('general.fm_select_file'));
    view.save.disabled = true;
    view.download.disabled = true;
    view.rename.disabled = true;
    view.delete.disabled = true;
    view.metadata.textContent = '';
  }

  renderMetadata(entry) {
    const size =
      entry.type === 'directory' ? this.text('general.fm_folder') : this.bytes(entry.size);
    const access = entry.writable
      ? this.text('general.fm_writable')
      : this.text('general.fm_read_only');
    this.view().metadata.textContent = `${size} · ${this.date(entry.modified)} · ${access}`;
  }

  updateHeader() {
    const view = this.view();
    const name = this.server?.serverName || '';
    view.title.textContent = `${this.text('general.fm_title')} — ${name}`;
    view.path.textContent = this.containerRoot || '/';
    view.path.title = this.hostRoot || this.server?.dataPath || '';
  }

  setBusy(busy, message = '') {
    const view = this.view();
    view.modal.setAttribute('aria-busy', busy ? 'true' : 'false');
    view.progress.hidden = !busy;
    view.status.textContent = busy ? message : '';
  }

  uploadProgress(name, index, count, loaded, total) {
    const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
    const view = this.view();
    view.progress.hidden = false;
    view.progressBar.style.width = `${percent}%`;
    view.status.textContent = `${index + 1}/${count} ${name} · ${percent}%`;
  }

  renderError(error) {
    const node = document.createElement('div');
    node.className = 'fm-error';
    const message = document.createElement('span');
    message.textContent = error instanceof Error ? error.message : String(error);
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-ghost text-xs';
    retry.textContent = this.text('general.fm_retry');
    retry.addEventListener('click', () => this.loadDirectory(this.directory, true));
    node.append(message, retry);
    this.view().tree.replaceChildren(node);
  }

  canDiscard() {
    return !this.editor?.isDirty() || this.confirm(this.text('general.fm_unsaved_confirm'));
  }

  beforeUnload(event) {
    if (!this.editor?.isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  begin() {
    this.abort();
    this.request = new AbortController();
    this.generation += 1;
    return { signal: this.request.signal, generation: this.generation };
  }

  abort() {
    this.request?.abort();
    this.request = null;
  }

  current(operation) {
    return operation.generation === this.generation && !operation.signal.aborted;
  }

  aborted(error) {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  async refreshAfterMutation(path) {
    const savedFile = { ...this.file };
    await this.loadDirectory(this.directory, true);
    const entry = this.entries.find((item) => item.path === path);
    if (!entry) return;
    this.file = savedFile;
    this.selected = entry;
    this.activate(path);
    this.view().currentFile.textContent = path;
    this.editor.load(savedFile);
    this.view().save.disabled = !savedFile.writable;
    this.view().download.disabled = false;
    this.view().rename.disabled = false;
    this.view().delete.disabled = false;
    this.renderMetadata({ ...entry, ...savedFile });
  }

  ensureEditor() {
    if (!this.editor) {
      this.editor = new GameServerFileEditor(this.view(), (dirty) => {
        const view = this.view();
        view.currentFile.classList.toggle('dirty', dirty);
        view.save.disabled = !dirty || !this.file?.writable;
      });
    }
  }

  notify(key, error, type) {
    const detail = error instanceof Error ? error.message : String(error);
    this.toast(`${this.text(key)}: ${detail}`, type);
  }

  text(key, variables = {}) {
    const value = this.translate(key, variables);
    return value === key ? key.split('.').at(-1).replaceAll('_', ' ') : value;
  }

  bytes(value) {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  date(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  view() {
    return {
      modal: document.getElementById('fileManagerModal'),
      title: document.getElementById('fmTitle'),
      path: document.getElementById('fmCurrentPath'),
      breadcrumbs: document.getElementById('fmBreadcrumbs'),
      tree: document.getElementById('fmFileTree'),
      search: document.getElementById('fmSearchInput'),
      sort: document.getElementById('fmSortSelect'),
      currentFile: document.getElementById('fmCurrentFile'),
      metadata: document.getElementById('fmMetadata'),
      editor: document.getElementById('fmEditorTextarea'),
      lines: document.getElementById('fmLineNumbers'),
      validation: document.getElementById('fmValidation'),
      find: document.getElementById('fmFindInput'),
      replace: document.getElementById('fmReplaceInput'),
      save: document.getElementById('fmSaveBtn'),
      download: document.getElementById('fmDownloadBtn'),
      rename: document.getElementById('fmRenameBtn'),
      delete: document.getElementById('fmDeleteBtn'),
      uploadInput: document.getElementById('fmUploadInput'),
      overlay: document.getElementById('fmDragOverlay'),
      progress: document.getElementById('fmProgress'),
      progressBar: document.getElementById('fmProgressBar'),
      status: document.getElementById('fmStatus'),
    };
  }
}
