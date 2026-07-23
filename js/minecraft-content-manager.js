import { ModalScrollLock } from './modal-scroll-lock.js?v=19';

export class MinecraftContentManager {
  constructor(contentClient, modrinthClient, dependencies) {
    this.contentClient = contentClient;
    this.modrinthClient = modrinthClient;
    this.toggleModal = dependencies.toggleModal;
    this.toast = dependencies.toast;
    this.translate = dependencies.translate;
    this.scrollLock = dependencies.scrollLock || new ModalScrollLock();
    this.server = null;
    this.inventory = null;
    this.items = [];
    this.controller = null;
  }

  async open(server) {
    this.server = server;
    this.inventory = null;
    this.items = [];
    this.view().title.textContent = `${this.text('general.mc_content_title')} — ${server.serverName}`;
    this.view().search.value = '';
    this.view().list.replaceChildren(this.state('progress_activity', this.text('general.loading')));
    this.view().summary.replaceChildren();
    this.toggleModal('minecraftContentModal', true);
    this.scrollLock.lock();
    await this.load();
  }

  close() {
    this.controller?.abort();
    this.controller = null;
    this.toggleModal('minecraftContentModal', false);
    this.scrollLock.unlock();
    this.server = null;
  }

  async load() {
    if (!this.server) return;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.setBusy(true);
    try {
      const inventory = await this.contentClient.inventory(
        this.server.containerId,
        controller.signal
      );
      if (!this.server || controller.signal.aborted || controller !== this.controller) return;
      this.inventory = inventory;
      this.items = await this.resolveItems(inventory.items);
      if (!this.server || controller.signal.aborted || controller !== this.controller) return;
      await this.renderSummary(inventory);
      if (!this.server || controller.signal.aborted || controller !== this.controller) return;
      this.render();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const detail = error instanceof Error ? error.message : String(error);
      this.view().list.replaceChildren(this.state('error_outline', detail, true));
      this.toast(`${this.text('general.mc_content_load_failed')}: ${detail}`, 'error');
    } finally {
      if (controller === this.controller) this.setBusy(false);
    }
  }

  async resolveItems(items) {
    try {
      const versions = await this.modrinthClient.versionsByHashes(items.map((item) => item.sha1));
      const projectIds = Object.values(versions).map((version) => version.project_id);
      const projects = await this.modrinthClient.projects(projectIds);
      const projectMap = new Map(projects.map((project) => [project.id, project]));
      return items.map((item) => {
        const version = versions[item.sha1] || null;
        const project = version ? projectMap.get(version.project_id) || null : null;
        return { ...item, version, project };
      });
    } catch {
      return items.map((item) => ({ ...item, version: null, project: null }));
    }
  }

  async renderSummary(inventory) {
    const view = this.view();
    view.summary.replaceChildren();
    const pack = inventory.modpack;
    let project = null;
    if (pack?.source === 'modrinth') {
      try {
        project = await this.modrinthClient.project(pack.project);
      } catch {
        project = null;
      }
    }
    const identity = document.createElement('div');
    identity.className = 'mc-content-pack';
    const icon = document.createElement('span');
    icon.className = 'material-icons-round';
    icon.textContent = pack ? 'inventory_2' : 'deployed_code';
    const body = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = project?.title || pack?.project || this.text('general.mc_custom_server');
    const details = document.createElement('span');
    details.textContent = [
      pack?.source || inventory.server.loader,
      pack?.version || inventory.server.version,
      `${inventory.items.length} ${this.text('general.mc_content_items')}`,
    ]
      .filter(Boolean)
      .join(' · ');
    body.append(name, details);
    identity.append(icon, body);
    view.summary.appendChild(identity);
    view.count.textContent = this.text('general.mc_content_count', {
      count: inventory.items.length,
    });
  }

  filter() {
    this.render();
  }

  render() {
    const query = this.view().search.value.trim().toLocaleLowerCase();
    const items = this.items.filter((item) =>
      [item.name, item.project?.title, item.project?.slug, item.version?.version_number]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query))
    );
    const list = this.view().list;
    list.replaceChildren();
    if (items.length === 0) {
      list.appendChild(
        this.state(
          query ? 'search_off' : 'extension_off',
          query ? this.text('general.mc_content_no_results') : this.text('general.mc_content_empty')
        )
      );
      return;
    }
    items.forEach((item) => list.appendChild(this.row(item)));
  }

  row(item) {
    const row = document.createElement('div');
    row.className = 'mc-content-row';
    const visual = item.project?.icon_url
      ? this.image(item.project.icon_url, item.project.title)
      : this.icon(item.type === 'plugin' ? 'power' : 'extension');
    const body = document.createElement('div');
    body.className = 'mc-content-row-body';
    const title = document.createElement('strong');
    title.textContent = item.project?.title || this.cleanName(item.name);
    const details = document.createElement('span');
    details.textContent = [
      item.version?.version_number || this.text('general.mc_content_unresolved'),
      item.name,
      this.bytes(item.size),
    ].join(' · ');
    body.append(title, details);
    const badges = document.createElement('div');
    badges.className = 'mc-content-badges';
    badges.append(this.badge(item.type));
    if (item.project) badges.append(this.badge('Modrinth'));
    row.append(visual, body, badges);
    return row;
  }

  image(source, alt) {
    const image = document.createElement('img');
    image.className = 'mc-content-icon';
    image.src = source;
    image.alt = alt || '';
    image.loading = 'lazy';
    return image;
  }

  icon(name) {
    const icon = document.createElement('span');
    icon.className = 'material-icons-round mc-content-icon mc-content-icon-placeholder';
    icon.textContent = name;
    return icon;
  }

  badge(value) {
    const badge = document.createElement('span');
    badge.className = 'status-badge bg-input text-muted border border-[var(--border)]';
    badge.textContent = value;
    return badge;
  }

  state(iconName, message, retry = false) {
    const state = document.createElement('div');
    state.className = 'mc-content-state';
    const icon = document.createElement('span');
    icon.className = 'material-icons-round';
    icon.textContent = iconName;
    const text = document.createElement('span');
    text.textContent = message;
    state.append(icon, text);
    if (retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost';
      button.textContent = this.text('general.fm_retry');
      button.addEventListener('click', () => this.load());
      state.appendChild(button);
    }
    return state;
  }

  setBusy(busy) {
    this.view().modal.setAttribute('aria-busy', busy ? 'true' : 'false');
    this.view().refresh.disabled = busy;
  }

  cleanName(value) {
    return value.replace(/\.jar$/i, '').replaceAll(/[-_]+/g, ' ');
  }

  bytes(value) {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  text(key, variables = {}) {
    const value = this.translate(key, variables);
    return value === key ? key.split('.').at(-1).replaceAll('_', ' ') : value;
  }

  view() {
    return {
      modal: document.getElementById('minecraftContentModal'),
      title: document.getElementById('mcContentTitle'),
      summary: document.getElementById('mcContentSummary'),
      search: document.getElementById('mcContentSearch'),
      count: document.getElementById('mcContentCount'),
      list: document.getElementById('mcContentList'),
      refresh: document.getElementById('mcContentRefresh'),
    };
  }
}
