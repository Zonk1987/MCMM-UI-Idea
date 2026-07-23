export class MinecraftAdditionInstaller {
  constructor(modrinthClient, contentClient, dependencies) {
    this.modrinthClient = modrinthClient;
    this.contentClient = contentClient;
    this.toggleModal = dependencies.toggleModal;
    this.toast = dependencies.toast;
    this.translate = dependencies.translate;
    this.switchTab = dependencies.switchTab;
    this.confirm = dependencies.confirm || ((message) => window.confirm(message));
    this.detail = null;
    this.project = null;
    this.versions = [];
    this.bound = false;
  }

  bind() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('open-minecraft-content-installer', (event) => this.open(event.detail));
    document.getElementById('closeModModal')?.addEventListener('click', () => this.close());
    document.getElementById('closeModModalBtn')?.addEventListener('click', () => this.close());
    document.getElementById('installModBtn')?.addEventListener('click', () => this.install());
  }

  async open(detail) {
    this.detail = detail;
    this.project = null;
    this.versions = [];
    const view = this.view();
    view.name.textContent = detail.name || this.text('general.mc_content_details');
    view.author.textContent = detail.author || '';
    view.icon.hidden = true;
    view.body.replaceChildren(this.state('progress_activity', this.text('general.loading')));
    view.install.disabled = true;
    this.toggleModal('modDetailModal', true);
    if (detail.source !== 'modrinth') {
      view.body.replaceChildren(this.state('info', this.text('general.mc_modrinth_install_only')));
      return;
    }
    try {
      const project = await this.modrinthClient.project(detail.id);
      const versions = await this.modrinthClient.versions(
        project.id,
        detail.category === 'modpacks' ? detail.minecraftVersion : detail.targetVersion,
        detail.category === 'modpacks' ? detail.loader : detail.targetLoader
      );
      this.project = project;
      this.versions = versions;
      this.render(project, versions);
      view.install.disabled =
        versions.length === 0 || !this.installable(project) || !detail.targetServerId;
    } catch (error) {
      view.body.replaceChildren(
        this.state('error_outline', error instanceof Error ? error.message : String(error))
      );
    }
  }

  close() {
    this.toggleModal('modDetailModal', false);
    this.detail = null;
    this.project = null;
    this.versions = [];
  }

  render(project, versions) {
    const view = this.view();
    view.name.textContent = project.title;
    view.author.textContent = project.project_type;
    if (project.icon_url) {
      view.icon.src = project.icon_url;
      view.icon.alt = project.title;
      view.icon.hidden = false;
    }
    const content = document.createElement('div');
    content.className = 'mc-install-detail';
    const description = document.createElement('p');
    description.textContent = project.description || '';
    const facts = document.createElement('div');
    facts.className = 'mc-install-facts';
    facts.append(
      this.fact('category', project.project_type),
      this.fact('download', Number(project.downloads || 0).toLocaleString()),
      this.fact('memory', (project.loaders || []).join(', ') || 'Minecraft')
    );
    const label = document.createElement('label');
    label.htmlFor = 'mcInstallVersion';
    label.textContent = this.text('general.mc_choose_version');
    const select = document.createElement('select');
    select.id = 'mcInstallVersion';
    select.className = 'form-input';
    versions.forEach((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = `${version.name} · ${version.game_versions.join(', ')} · ${version.loaders.join(', ')}`;
      select.appendChild(option);
    });
    if (!this.installable(project)) {
      const unsupported = document.createElement('p');
      unsupported.className = 'text-red text-xs';
      unsupported.textContent = this.text(
        project.server_side === 'unsupported'
          ? 'general.mc_install_client_only'
          : 'general.mc_install_unsupported_type'
      );
      content.append(description, facts, unsupported);
    } else if (versions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-red text-xs';
      empty.textContent = this.text('general.mc_no_compatible_version');
      content.append(description, facts, empty);
    } else {
      const target = document.createElement('p');
      target.className = 'text-muted text-xs';
      target.textContent = this.text('general.mc_installs_to', {
        server: this.detail.targetServerName || this.text('general.mc_no_target_server'),
      });
      content.append(description, facts, label, select, target);
    }
    view.body.replaceChildren(content);
  }

  async install() {
    if (!this.project || this.versions.length === 0 || !this.detail) return;
    const selectedId = document.getElementById('mcInstallVersion')?.value;
    const version = this.versions.find((entry) => entry.id === selectedId) || this.versions[0];
    await this.installProject(version);
  }

  async installProject(version) {
    const file = version.files.find((entry) => entry.primary) || version.files[0];
    if (!file?.hashes?.sha512) {
      this.toast(this.text('general.mc_install_file_unavailable'), 'error');
      return;
    }
    const type = this.project.project_type === 'plugin' ? 'plugin' : 'mod';
    const view = this.view();
    view.install.disabled = true;
    try {
      await this.installFile(file, type, false);
    } catch (error) {
      if (
        error.status === 409 &&
        this.confirm(this.text('general.fm_overwrite_confirm', { name: file.filename }))
      ) {
        try {
          await this.installFile(file, type, true);
        } catch (retryError) {
          this.reportInstallError(retryError);
        }
      } else {
        this.reportInstallError(error);
      }
    } finally {
      view.install.disabled = false;
    }
  }

  async installFile(file, type, overwrite) {
    await this.contentClient.install(this.detail.targetServerId, file, type, overwrite);
    this.close();
    this.toast(this.text('general.mc_install_complete_restart'), 'success');
  }

  reportInstallError(error) {
    const detail = error instanceof Error ? error.message : String(error);
    this.toast(`${this.text('general.mc_install_failed')}: ${detail}`, 'error');
  }

  installable(project) {
    return (
      ['mod', 'plugin'].includes(project.project_type) && project.server_side !== 'unsupported'
    );
  }

  fact(iconName, value) {
    const fact = document.createElement('span');
    const icon = document.createElement('span');
    icon.className = 'material-icons-round';
    icon.textContent = iconName;
    const text = document.createElement('span');
    text.textContent = value;
    fact.append(icon, text);
    return fact;
  }

  state(iconName, message) {
    const state = document.createElement('div');
    state.className = 'mc-content-state';
    const icon = document.createElement('span');
    icon.className = 'material-icons-round';
    icon.textContent = iconName;
    const text = document.createElement('span');
    text.textContent = message;
    state.append(icon, text);
    return state;
  }

  text(key, variables = {}) {
    const value = this.translate(key, variables);
    return value === key ? key.split('.').at(-1).replaceAll('_', ' ') : value;
  }

  view() {
    return {
      name: document.getElementById('modModalName'),
      author: document.getElementById('modModalAuthor'),
      icon: document.getElementById('modModalIcon'),
      body: document.getElementById('modModalBody'),
      install: document.getElementById('installModBtn'),
    };
  }
}
