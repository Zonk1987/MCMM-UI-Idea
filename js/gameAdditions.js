/* ═══════════════════════════════════════════════════════════
   gameAdditions.js — Core Engine for Game Additions
   Manages UI state, search, sources, pagination, and module registration.
═══════════════════════════════════════════════════════════ */

import { MinecraftAdditionInstaller } from './minecraft-addition-installer.js?v=3';
import { MinecraftContentClient } from './minecraft-content-client.js?v=2';
import { ModrinthClient } from './modrinth-client.js?v=2';

export const GameAdditions = {
  games: {},
  state: {
    game: 'minecraft', // default
    source: 'modrinth',
    category: 'modpacks',
    loader: 'all',
    version: '',
    sort: 'downloads',
    query: '',
    page: 0,
    perPage: 24,
    total: 0,
    loading: false,
    targetServerId: '',
  },

  /**
   * Register a new game module
   * @param id
   * @param config
   */
  registerGame(id, config) {
    this.games[id] = config;
  },

  minecraftServers() {
    const store = globalThis.Alpine?.store('core');
    return store
      ? store
          .getGameservers()
          .filter((server) => server.game === 'minecraft' && server.edition === 'java')
      : [];
  },

  selectedServer() {
    const servers = this.minecraftServers();
    return (
      servers.find((server) => server.containerId === this.state.targetServerId) ||
      servers[0] ||
      null
    );
  },

  /**
   * Initialize the Game Additions hub
   */
  init() {
    this.buildGameSelector();
    this.bindEvents();
    this.installer = new MinecraftAdditionInstaller(
      new ModrinthClient(),
      new MinecraftContentClient(),
      {
        toggleModal: (id, open) => window.toggleModal(id, open),
        toast: (message, type) => window.showToast(message, type),
        translate: (key, variables) => window.t(key, variables),
        switchTab: (tab) => window.switchTab(tab),
      }
    );
    this.installer.bind();

    // Set default game if not found
    if (!this.games[this.state.game]) {
      this.state.game = Object.keys(this.games)[0];
    }

    // Trigger initial select logic for the default game
    const mod = this.games[this.state.game];
    if (mod?.onSelect) {
      mod.onSelect(this.state);
    }

    this.refresh();
  },

  /**
   * Trigger a content fetch via the active game module
   */
  async refresh() {
    if (this.state.loading) return;
    this.state.loading = true;

    const grid = document.getElementById('mcGrid');
    if (grid) {
      grid.innerHTML = `<div class="loading-grid col-span-full">${this.skeletonGrid(8)}</div>`;
    }

    const meta = document.getElementById('mcSearchMeta');
    if (meta) meta.textContent = t('general.loading');

    const gameModule = this.games[this.state.game];

    try {
      if (gameModule?.fetchContent) {
        await gameModule.fetchContent(this.state);
      } else {
        throw new Error(t('general.module_unavailable'));
      }
    } catch (err) {
      console.error(err);
      if (grid) {
        grid.innerHTML = `<div class="error-state col-span-full text-center p-10">
          <span class="material-icons-round text-5xl text-red-500">error_outline</span>
          <p class="mt-2.5 text-red-500">${err.message}</p>
        </div>`;
      }
      if (meta) meta.textContent = t('general.results_count', { count: 0 });
    } finally {
      this.state.loading = false;
    }
  },

  /**
   * Builds the game selector UI dynamically from registered games
   */
  buildGameSelector() {
    const container = document.getElementById('hubGameSelector');
    if (!container) return;
    container.innerHTML = '';

    let disabled = [];
    try {
      const stored = localStorage.getItem('gs_hub_settings');
      if (stored) disabled = JSON.parse(stored).disabledModules || [];
    } catch {
      // ignore
    }

    for (const [id, game] of Object.entries(this.games)) {
      if (id !== 'minecraft' && disabled.includes(id)) continue;

      const el = document.createElement('div');
      el.className = `wizard-game-card ${this.state.game === id ? 'selected' : ''}`;
      el.dataset.hubgame = id;
      el.style.minWidth = '120px';
      el.innerHTML = `
        <span class="wizard-game-icon">${game.icon}</span>
        <div class="wizard-game-name">${game.name}</div>
      `;
      container.appendChild(el);
    }

    if (disabled.includes(this.state.game) && this.state.game !== 'minecraft') {
      this.state.game = 'minecraft';
      this.refresh();
    }
  },

  /**
   * Bind all DOM events for the UI
   */
  bindEvents() {
    // 1. Source toggle
    const sourceToggle = document.getElementById('sourceToggle');
    if (sourceToggle) {
      sourceToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.source-btn');
        if (!btn) return;
        sourceToggle.querySelectorAll('.source-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.source = btn.dataset.source;
        this.state.page = 0;
        this.refresh();
      });
    }

    // 2. Game Selector
    const gameSelector = document.getElementById('hubGameSelector');
    if (gameSelector) {
      gameSelector.addEventListener('click', (e) => {
        const card = e.target.closest('.wizard-game-card');
        if (!card) return;

        gameSelector
          .querySelectorAll('.wizard-game-card')
          .forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');

        const gameId = card.dataset.hubgame;
        this.state.game = gameId;
        this.state.page = 0;

        // Let module adapt UI
        const mod = this.games[gameId];
        if (mod?.onSelect) {
          mod.onSelect(this.state);
        }

        this.refresh();
      });
    }

    // 3. Category & Loader Filters
    ['categoryFilter', 'loaderFilter'].forEach((id) => {
      const group = document.getElementById(id);
      if (group) {
        group.addEventListener('click', (e) => {
          const btn = e.target.closest('.filter-chip');
          if (!btn) return;
          group.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          if (id === 'categoryFilter') this.state.category = btn.dataset.cat;
          if (id === 'loaderFilter') this.state.loader = btn.dataset.loader;
          this.state.page = 0;
          this.refresh();
        });
      }
    });

    // 4. Select dropdowns
    ['versionFilter', 'sortFilter'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          if (id === 'versionFilter') this.state.version = e.target.value;
          if (id === 'sortFilter') this.state.sort = e.target.value;
          this.state.page = 0;
          this.refresh();
        });
      }
    });

    // 5. Search Bar
    const searchInput = document.getElementById('mcSearch');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounce);
        this.state.query = e.target.value.trim();
        debounce = setTimeout(() => {
          this.state.page = 0;
          this.refresh();
        }, 500);
      });
    }

    document.getElementById('panel-game-additions')?.addEventListener('change', (event) => {
      if (event.target.id === 'gameAdditionServer') this.state.targetServerId = event.target.value;
    });

    // 6. Pagination & Card Clicks
    const grid = document.getElementById('mcGrid');
    if (grid) {
      const handleAction = (e) => {
        if (e.target.closest('.mc-pagination .btn:not(:disabled)')) {
          const btn = e.target.closest('.mc-pagination .btn');
          const isNext = btn.classList.contains('next');
          this.state.page += isNext ? 1 : -1;
          this.refresh();
          return;
        }

        const card = e.target.closest('.mc-card[data-id]');
        if (card) {
          const target = this.selectedServer();
          window.dispatchEvent(
            new CustomEvent('open-minecraft-content-installer', {
              detail: {
                id: card.dataset.id,
                name: card.dataset.name,
                author: card.dataset.author || 'Unknown',
                isEdit: false,
                isAddition: true,
                source: this.state.source,
                category: this.state.category,
                targetServerId: target?.containerId || '',
                targetServerName: target?.serverName || '',
                targetPath: target?.dataPath || '',
                targetVersion: target?.version || '',
                targetLoader: target?.serverType || '',
                minecraftVersion: this.state.version || '',
                loader: this.state.loader === 'all' ? '' : this.state.loader,
              },
            })
          );
        }
      };

      grid.addEventListener('click', handleAction);
      grid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAction(e);
        }
      });
    }
  },

  /**
   * Shared generic function to fetch from CurseForge (used by Palworld, CS2, Valheim)
   * @param gameId
   * @param state
   */
  async fetchCurseForgeGeneric(gameId, state) {
    if (typeof appSettings !== 'undefined' && !appSettings.cfApiKey) {
      this.renderCurseForgeApiKeyWarning();
      return;
    }

    const offset = state.page * state.perPage;
    const params = new URLSearchParams({
      gameId: gameId,
      index: offset.toString(),
      pageSize: state.perPage.toString(),
    });

    if (state.query) {
      params.append('searchFilter', state.query);
    }

    const headers = {
      Accept: 'application/json',
      'x-api-key': appSettings.cfApiKey,
    };

    let res;
    try {
      res = await fetch(`https://api.curseforge.com/v1/mods/search?${params}`, {
        headers,
      });
    } catch (err) {
      throw new Error('CurseForge Network Error', {
        cause: err,
      });
    }

    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`CurseForge Parse Error: ${res.status} ${res.statusText}`);
    }

    if (!res.ok) {
      throw new Error(`CurseForge API Error ${res.status}: ${JSON.stringify(body)}`);
    }

    const data = body.data || [];
    if (data.length === 0) {
      this.renderEmptyState(params.toString(), body);
      return;
    }

    state.total = body.pagination?.totalCount || data.length;
    const meta = document.getElementById('mcSearchMeta');
    if (meta)
      meta.textContent = `${t('general.results_count', { count: state.total.toLocaleString() })} (CurseForge)`;

    this.renderCurseForgeCards(data);
    this.renderPagination(state);
  },

  renderEmptyState(paramsStr, body) {
    const grid = document.getElementById('mcGrid');
    const meta = document.getElementById('mcSearchMeta');
    if (grid) {
      grid.innerHTML = `<div class="empty-state col-span-full text-left">
        <span class="material-icons-round text-4xl text-yellow-500">bug_report</span>
        <p class="mt-2.5 font-bold">${t('general.no_results')}</p>
        <code class="block mt-2.5 text-white text-xs bg-white/10 p-2.5 rounded whitespace-pre-wrap break-all">
Request URL: https://api.curseforge.com/v1/mods/search?${paramsStr}

Response Body:
${JSON.stringify(body, null, 2)}
        </code>
      </div>`;
    }
    if (meta) meta.textContent = t('general.results_count', { count: 0 });
  },

  renderCurseForgeApiKeyWarning() {
    const grid = document.getElementById('mcGrid');
    const meta = document.getElementById('mcSearchMeta');
    if (grid) {
      grid.innerHTML = `<div class="empty-state col-span-full text-center">
        <span class="material-icons-round text-5xl text-yellow-500">vpn_key</span>
        <p class="mt-2.5 text-base">${t('general.cf_api_key_required')}</p>
        <p class="text-muted text-sm max-w-[400px] mx-auto my-2.5">
          ${t('general.cf_api_key_help')}
        </p>
        <button class="settings-btn primary" onclick="document.querySelector('.tab-btn[data-tab=&quot;settings&quot;]').click();" class="mt-5">
          <span class="material-icons-round">settings</span> ${t('general.open_settings')}
        </button>
      </div>`;
    }
    if (meta) meta.textContent = t('general.api_key_required');
  },

  renderCurseForgeCards(data) {
    const grid = document.getElementById('mcGrid');
    if (!grid) return;
    grid.innerHTML = data
      .map((mod) => {
        const thumb = mod.logo?.thumbnailUrl || '';
        return `
      <div class="mc-card" data-id="${mod.id}" data-name="${mod.name}" role="button" tabindex="0">
        <div class="mc-card-top">
          ${thumb ? `<img src="${thumb}" alt="${mod.name}" class="mc-card-icon" />` : `<div class="mc-card-icon-placeholder"><span class="material-icons-round">extension</span></div>`}
          <div class="mc-card-header-info">
            <div class="mc-card-name text-primary" title="${mod.name}">${mod.name}</div>
            <div class="mc-card-author">${t('general.by')} ${mod.authors && mod.authors.length > 0 ? mod.authors.map((a) => a.name).join(', ') : t('general.unknown')}</div>
          </div>
        </div>
        
        <div class="mc-card-desc">${mod.summary || ''}</div>
        
        <div class="mc-card-meta">
          <div class="mc-meta-item" title="${t('general.downloads')}">
            <span class="material-icons-round">download</span> ${mod.downloadCount ? mod.downloadCount.toLocaleString() : 0}
          </div>
          <div class="mc-meta-item" title="${t('general.last_update')}">
            <span class="material-icons-round">update</span> ${new Date(mod.dateModified).toLocaleDateString()}
          </div>
        </div>
      </div>
      `;
      })
      .join('');
  },

  renderPagination(state) {
    const grid = document.getElementById('mcGrid');
    if (!grid || state.total <= state.perPage) return;

    const maxPage = Math.ceil(state.total / state.perPage) - 1;
    const paginationHtml = `
      <div class="mc-pagination col-span-full w-full flex justify-center items-center gap-4 mt-8 pb-6">
        <button class="btn btn-ghost prev flex items-center gap-1" ${state.page === 0 ? 'disabled' : ''}>
          <span class="material-icons-round text-lg">chevron_left</span> ${t('btn.back')}
        </button>
        <span class="page-info text-sm font-medium text-muted">${t('general.page_of', { current: state.page + 1, total: maxPage + 1 })}</span>
        <button class="btn btn-ghost next flex items-center gap-1" ${state.page >= maxPage ? 'disabled' : ''}>
          ${t('btn.next')} <span class="material-icons-round text-lg">chevron_right</span>
        </button>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', paginationHtml);
  },

  skeletonGrid(count) {
    return new Array(count)
      .fill('')
      .map(
        () => `
      <div class="mc-card skeleton border border-white/5 bg-card">
        <div class="mc-card-header">
          <div class="skeleton-icon w-12 h-12 rounded-lg bg-white/10"></div>
          <div class="flex-1">
            <div class="w-[70%] h-4 bg-white/10 mb-2 rounded"></div>
            <div class="w-[40%] h-3 bg-white/5 rounded"></div>
          </div>
        </div>
        <div class="w-full h-3 bg-white/5 mb-2 rounded mt-3"></div>
        <div class="w-[80%] h-3 bg-white/5 rounded"></div>
      </div>
    `
      )
      .join('');
  },
};
