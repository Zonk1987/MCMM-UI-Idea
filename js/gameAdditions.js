/* ═══════════════════════════════════════════════════════════
   gameAdditions.js — Core Engine for Game Additions
   Manages UI state, search, sources, pagination, and module registration.
═══════════════════════════════════════════════════════════ */

export const GameAdditions = {
  games: {},
  state: {
    game:     'minecraft', // default
    source:   'modrinth',
    category: 'modpacks',
    loader:   'all',
    version:  '',
    sort:     'downloads',
    query:    '',
    page:     0,
    perPage:  24,
    total:    0,
    loading:  false,
  },

  /**
   * Register a new game module
   */
  registerGame(id, config) {
    this.games[id] = config;
  },

  /**
   * Initialize the Game Additions hub
   */
  init() {
    this.buildGameSelector();
    this.bindEvents();
    
    // Set default game if not found
    if (!this.games[this.state.game]) {
      this.state.game = Object.keys(this.games)[0];
    }
    
    // Trigger initial select logic for the default game
    const mod = this.games[this.state.game];
    if (mod && mod.onSelect) {
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
      grid.innerHTML = `<div class="loading-grid" style="grid-column:1/-1">${this.skeletonGrid(8)}</div>`;
    }
    
    const meta = document.getElementById('mcSearchMeta');
    if (meta) meta.textContent = typeof t === 'function' ? (t('loading') || 'Lädt...') : 'Lädt...';

    const gameModule = this.games[this.state.game];
    
    try {
      if (gameModule && gameModule.fetchContent) {
        await gameModule.fetchContent(this.state);
      } else {
        throw new Error('Kein fetchContent im Modul definiert.');
      }
    } catch (err) {
      console.error(err);
      if (grid) {
        grid.innerHTML = `<div class="error-state" style="grid-column:1/-1;text-align:center;padding:40px;">
          <span class="material-icons-round" style="font-size:48px;color:#ef4444">error_outline</span>
          <p style="margin-top:10px;color:#ef4444;">${err.message}</p>
        </div>`;
      }
      if (meta) meta.textContent = '0 Ergebnisse';
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
    } catch (e) {}
    
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
      sourceToggle.addEventListener('click', e => {
        const btn = e.target.closest('.source-btn');
        if (!btn) return;
        sourceToggle.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.source = btn.dataset.source;
        this.state.page = 0;
        this.refresh();
      });
    }

    // 2. Game Selector
    const gameSelector = document.getElementById('hubGameSelector');
    if (gameSelector) {
      gameSelector.addEventListener('click', e => {
        const card = e.target.closest('.wizard-game-card');
        if (!card) return;
        
        gameSelector.querySelectorAll('.wizard-game-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        const gameId = card.dataset.hubgame;
        this.state.game = gameId;
        this.state.page = 0;
        
        // Let module adapt UI
        const mod = this.games[gameId];
        if (mod && mod.onSelect) {
          mod.onSelect(this.state);
        }
        
        this.refresh();
      });
    }

    // 3. Category & Loader Filters
    ['categoryFilter', 'loaderFilter'].forEach(id => {
      const group = document.getElementById(id);
      if (group) {
        group.addEventListener('click', e => {
          const btn = e.target.closest('.filter-chip');
          if (!btn) return;
          group.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (id === 'categoryFilter') this.state.category = btn.dataset.cat;
          if (id === 'loaderFilter') this.state.loader = btn.dataset.loader;
          this.state.page = 0;
          this.refresh();
        });
      }
    });

    // 4. Select dropdowns
    ['versionFilter', 'sortFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', e => {
          if (id === 'versionFilter') this.state.version = e.target.value;
          if (id === 'sortFilter')    this.state.sort = e.target.value;
          this.state.page = 0;
          this.refresh();
        });
      }
    });

    // 5. Search Bar
    const searchInput = document.getElementById('mcSearch');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', e => {
        clearTimeout(debounce);
        this.state.query = e.target.value.trim();
        debounce = setTimeout(() => {
          this.state.page = 0;
          this.refresh();
        }, 500);
      });
    }

    // 6. Pagination & Card Clicks
    const grid = document.getElementById('mcGrid');
    if (grid) {
      grid.addEventListener('click', e => {
        if (e.target.closest('.mc-pagination .btn:not(:disabled)')) {
          const btn = e.target.closest('.mc-pagination .btn');
          const isNext = btn.classList.contains('next');
          this.state.page += isNext ? 1 : -1;
          this.refresh();
          return;
        }

        const card = e.target.closest('.mc-card[data-id]');
        if (card) {
          if (window.Alpine) {
            Alpine.store('modals').install.data = {
              ...Alpine.store('modals').install.data,
              id: card.dataset.id,
              name: card.dataset.name,
              author: card.dataset.author || 'Unknown',
              isEdit: false
            };
            Alpine.store('modals').install.open = true;
          }
        }
      });
    }

  },

  /**
   * Shared generic function to fetch from CurseForge (used by Palworld, CS2, Valheim)
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
      'Accept': 'application/json',
      'x-api-key': appSettings.cfApiKey,
    };

    let res;
    try {
      res = await fetch(`https://api.curseforge.com/v1/mods/search?${params}`, { headers });
    } catch (err) {
      throw new Error(`CurseForge Network Error: ${err.message}`);
    }

    let body;
    try {
      body = await res.json();
    } catch (err) {
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
    if (meta) meta.textContent = `${state.total.toLocaleString()} Ergebnisse (CurseForge)`;

    this.renderCurseForgeCards(data);
    this.renderPagination(state);
  },

  renderEmptyState(paramsStr, body) {
    const grid = document.getElementById('mcGrid');
    const meta = document.getElementById('mcSearchMeta');
    if (grid) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;text-align:left;">
        <span class="material-icons-round" style="font-size:36px;color:#f39c12">bug_report</span>
        <p style="margin-top:10px;font-weight:bold;">Keine Ergebnisse gefunden</p>
        <code style="display:block;margin-top:10px;color:#fff;font-size:11px;background:rgba(255,255,255,0.1);padding:10px;border-radius:4px;white-space:pre-wrap;word-break:break-all;">
Request URL: https://api.curseforge.com/v1/mods/search?${paramsStr}

Response Body:
${JSON.stringify(body, null, 2)}
        </code>
      </div>`;
    }
    if (meta) meta.textContent = `0 Ergebnisse`;
  },

  renderCurseForgeApiKeyWarning() {
    const grid = document.getElementById('mcGrid');
    const meta = document.getElementById('mcSearchMeta');
    if (grid) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;text-align:center;">
        <span class="material-icons-round" style="font-size:48px;color:#f59e0b">vpn_key</span>
        <p style="margin-top:10px;font-size:16px;">CurseForge API Key fehlt</p>
        <p style="color:var(--text-muted);font-size:14px;max-width:400px;margin:10px auto;">
          Um auf reale CurseForge-Daten zuzugreifen, musst du deinen persönlichen API-Key in den Plugin-Einstellungen hinterlegen.
        </p>
        <button class="settings-btn primary" onclick="document.querySelector('.tab-btn[data-tab=\\'settings\\']').click();" style="margin-top:20px;">
          <span class="material-icons-round">settings</span> Zu den Einstellungen
        </button>
      </div>`;
    }
    if (meta) meta.textContent = `API Key benötigt`;
  },

  renderCurseForgeCards(data) {
    const grid = document.getElementById('mcGrid');
    if (!grid) return;
    grid.innerHTML = data.map(mod => {
      const thumb = (mod.logo && mod.logo.thumbnailUrl) ? mod.logo.thumbnailUrl : '';
      return `
      <div class="mc-card" data-id="${mod.id}" data-name="${mod.name}">
        <div class="mc-card-top">
          ${thumb ? `<img src="${thumb}" alt="${mod.name}" class="mc-card-icon" />` : `<div class="mc-card-icon-placeholder"><span class="material-icons-round">extension</span></div>`}
          <div class="mc-card-header-info">
            <div class="mc-card-name" title="${mod.name}">${mod.name}</div>
            <div class="mc-card-author">by ${mod.authors && mod.authors.length > 0 ? mod.authors.map(a => a.name).join(', ') : 'Unknown'}</div>
          </div>
        </div>
        
        <div class="mc-card-desc">${mod.summary || ''}</div>
        
        <div class="mc-card-meta">
          <div class="mc-meta-item" title="Downloads">
            <span class="material-icons-round">download</span> ${mod.downloadCount ? mod.downloadCount.toLocaleString() : 0}
          </div>
          <div class="mc-meta-item" title="Zuletzt aktualisiert">
            <span class="material-icons-round">update</span> ${new Date(mod.dateModified).toLocaleDateString()}
          </div>
        </div>
      </div>
      `;
    }).join('');
  },

  renderPagination(state) {
    const grid = document.getElementById('mcGrid');
    if (!grid || state.total <= state.perPage) return;
    
    const maxPage = Math.ceil(state.total / state.perPage) - 1;
    const paginationHtml = `
      <div class="mc-pagination" style="grid-column: 1 / -1; width: 100%; display:flex; justify-content:center; align-items:center; gap:16px; margin-top:32px; padding-bottom:24px;">
        <button class="btn btn-ghost prev" style="display:flex; align-items:center; gap:4px;" ${state.page === 0 ? 'disabled' : ''}>
          <span class="material-icons-round" style="font-size:18px;">chevron_left</span> Zurück
        </button>
        <span class="page-info" style="font-size:14px; font-weight:500; color:var(--text-muted);">Seite ${state.page + 1} von ${maxPage + 1}</span>
        <button class="btn btn-ghost next" style="display:flex; align-items:center; gap:4px;" ${state.page >= maxPage ? 'disabled' : ''}>
          Weiter <span class="material-icons-round" style="font-size:18px;">chevron_right</span>
        </button>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', paginationHtml);
  },

  skeletonGrid(count) {
    return Array(count).fill('').map(() => `
      <div class="mc-card skeleton" style="border:1px solid rgba(255,255,255,0.05); background:var(--bg-card);">
        <div class="mc-card-header">
          <div class="skeleton-icon" style="width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,0.1)"></div>
          <div style="flex:1">
            <div style="width:70%;height:16px;background:rgba(255,255,255,0.1);margin-bottom:8px;border-radius:4px;"></div>
            <div style="width:40%;height:12px;background:rgba(255,255,255,0.05);border-radius:4px;"></div>
          </div>
        </div>
        <div style="width:100%;height:12px;background:rgba(255,255,255,0.05);margin-bottom:8px;border-radius:4px;margin-top:12px;"></div>
        <div style="width:80%;height:12px;background:rgba(255,255,255,0.05);border-radius:4px;"></div>
      </div>
    `).join('');
  }
};
