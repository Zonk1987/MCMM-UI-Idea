/* ═══════════════════════════════════════════════════════════
   minecraft.js — Minecraft Module for Game Additions
═══════════════════════════════════════════════════════════ */

import { GameAdditions } from '../gameAdditions.js';
import { appSettings } from '../settings.js';

GameAdditions.registerGame('minecraft', {
  name: 'Minecraft',
  icon: '⛏',
  
  onSelect(state) {
    // Show Minecraft-specific sidebar and toggle buttons
    const mcSidebar = document.getElementById('mcSidebar');
    const mcLayout = document.querySelector('.mc-layout');
    const sourceToggle = document.getElementById('sourceToggle');
    const modrinthBtn = sourceToggle?.querySelector('[data-source="modrinth"]');
    const ftbBtn = sourceToggle?.querySelector('[data-source="ftb"]');
    const cfBtn = sourceToggle?.querySelector('[data-source="curseforge"]');
    
    if (mcSidebar) mcSidebar.style.display = 'block';
    if (mcLayout) mcLayout.classList.remove('no-sidebar');
    if (modrinthBtn) { modrinthBtn.style.display = 'inline-block'; modrinthBtn.classList.add('active'); }
    if (ftbBtn) ftbBtn.style.display = 'inline-block';
    if (cfBtn) cfBtn.classList.remove('active');
    
    state.source = 'modrinth';
  },

  async fetchContent(state) {
    if (state.source === 'modrinth') {
      await this.fetchModrinth(state);
    } else if (state.source === 'ftb') {
      if (state.category === 'modpacks') {
        await this.fetchFTB(state);
      } else {
        // Fallback for non-modpacks in FTB
        const origQuery = state.query;
        state.query = origQuery ? ('FTB ' + origQuery) : 'FTB';
        await this.fetchModrinth(state);
        state.query = origQuery;
        const meta = document.getElementById('mcSearchMeta');
        if (meta) meta.textContent = meta.textContent.replace('Modrinth', 'Modrinth / FTB');
      }
    } else if (state.source === 'curseforge') {
      await this.fetchMinecraftCurseForge(state);
    }
  },

  // -------------------------------------------------------------
  // Modrinth Logic
  // -------------------------------------------------------------
  async fetchModrinth(state) {
    const MODRINTH_API = 'https://api.modrinth.com/v2';
    const CAT_TYPE_MAP = {
      modpacks:     'modpack',
      mods:         'mod',
      plugins:      'plugin',
      resourcepacks:'resourcepack',
      datapacks:    'datapack',
      shaders:      'shader',
    };
    const LOADER_FACET = {
      fabric:   'fabric',
      forge:    'forge',
      neoforge: 'neoforge',
      quilt:    'quilt',
      paper:    'paper',
      spigot:   'spigot',
    };

    const projectType = CAT_TYPE_MAP[state.category] || 'modpack';
    const offset = state.page * state.perPage;
    const facets = [[`project_type:${projectType}`]];
    
    if (state.loader !== 'all' && LOADER_FACET[state.loader]) {
      facets.push([`categories:${LOADER_FACET[state.loader]}`]);
    }
    if (state.version) {
      facets.push([`versions:${state.version}`]);
    }

    const params = new URLSearchParams({
      query: state.query,
      index: state.sort,
      offset: offset.toString(),
      limit: state.perPage.toString(),
      facets: JSON.stringify(facets)
    });

    const res = await fetch(`${MODRINTH_API}/search?${params}`);
    if (!res.ok) throw new Error(`Modrinth API Fehler: ${res.status}`);
    const data = await res.json();
    
    state.total = data.total_hits;
    const meta = document.getElementById('mcSearchMeta');
    if (meta) meta.textContent = `${state.total.toLocaleString()} Ergebnisse (Modrinth)`;

    this.renderModrinthCards(data.hits || []);
    GameAdditions.renderPagination(state);
  },

  renderModrinthCards(hits) {
    const grid = document.getElementById('mcGrid');
    if (!grid) return;
    grid.innerHTML = hits.map(hit => {
      const icon = hit.icon_url || '';
      return `
      <div class="mc-card" data-id="${hit.project_id}" data-name="${hit.title}">
        <div class="mc-card-top">
          ${icon ? `<img src="${icon}" alt="${hit.title}" class="mc-card-icon" />` : `<div class="mc-card-icon-placeholder"><span class="material-icons-round">extension</span></div>`}
          <div class="mc-card-header-info">
            <div class="mc-card-name" title="${hit.title}">${hit.title}</div>
            <div class="mc-card-author">by ${hit.author}</div>
          </div>
        </div>
        
        <div class="mc-card-desc">${hit.description}</div>
        
        <div class="mc-card-meta">
          <div class="mc-meta-item" title="Downloads">
            <span class="material-icons-round">download</span> ${hit.downloads.toLocaleString()}
          </div>
          <div class="mc-meta-item" title="Zuletzt aktualisiert">
            <span class="material-icons-round">update</span> ${new Date(hit.date_modified).toLocaleDateString()}
          </div>
        </div>
      </div>
      `;
    }).join('');
  },

  // -------------------------------------------------------------
  // CurseForge (Minecraft specific logic)
  // -------------------------------------------------------------
  async fetchMinecraftCurseForge(state) {
    if (typeof appSettings !== 'undefined' && !appSettings.cfApiKey) {
      GameAdditions.renderCurseForgeApiKeyWarning();
      return;
    }

    const CF_CLASS_MAP = {
      modpacks: 4471,
      mods: 6,
      plugins: 5,
      resourcepacks: 12,
      datapacks: 4546,
      shaders: 6552,
    };

    const CF_LOADER_MAP = {
      fabric: 4,
      forge: 1,
      neoforge: 6,
      quilt: 5,
    };

    const CF_SORT_MAP = {
      downloads: 6, // TotalDownloads
      updated:   3, // LastUpdated
      newest:    2, // Popularity / Featured
    };

    const offset = state.page * state.perPage;
    const params = new URLSearchParams({
      gameId: '432',
      index: offset.toString(),
      pageSize: state.perPage.toString(),
    });

    const classId = CF_CLASS_MAP[state.category] || 4471;
    params.append('classId', classId.toString());
    
    if (state.version) {
      params.append('gameVersion', state.version);
    }
    if (state.loader !== 'all' && CF_LOADER_MAP[state.loader]) {
      params.append('modLoaderType', CF_LOADER_MAP[state.loader].toString());
    }

    const sortVal = CF_SORT_MAP[state.sort] || 6;
    params.append('sortField', sortVal.toString());
    params.append('sortOrder', 'desc');

    if (state.query) {
      params.append('searchFilter', state.query);
    }

    const headers = {
      'Accept': 'application/json',
      'x-api-key': appSettings.cfApiKey,
    };

    let res = await fetch(`https://api.curseforge.com/v1/mods/search?${params}`, { headers });
    let body = await res.json();
    if (!res.ok) throw new Error(`CurseForge API Error ${res.status}`);
    
    const data = body.data || [];
    if (data.length === 0) {
      GameAdditions.renderEmptyState(params.toString(), body);
      return;
    }

    state.total = body.pagination?.totalCount || data.length;
    const meta = document.getElementById('mcSearchMeta');
    if (meta) meta.textContent = `${state.total.toLocaleString()} Ergebnisse (CurseForge)`;

    GameAdditions.renderCurseForgeCards(data);
    GameAdditions.renderPagination(state);
  },

  // -------------------------------------------------------------
  // FTB Mock Logic
  // -------------------------------------------------------------
  async fetchFTB(state) {
    const FTB_MOCK = [
      { id:'ftb1', name:'FTB Revelations', author:'FTB Team', downloads:9000000, desc:'A well-rounded general modpack.', loaders:['forge'], icon:'🟧', version:'1.12.2' },
      { id:'ftb2', name:'FTB Academy', author:'FTB Team', downloads:5500000, desc:'The perfect beginner modpack.', loaders:['forge'], icon:'🟧', version:'1.20.1' },
    ];
    
    return new Promise(resolve => {
      setTimeout(() => {
        let results = FTB_MOCK;
        if (state.query) {
          results = results.filter(m => m.name.toLowerCase().includes(state.query.toLowerCase()));
        }
        
        state.total = results.length;
        const meta = document.getElementById('mcSearchMeta');
        if (meta) meta.textContent = `${state.total.toLocaleString()} Ergebnisse (FTB)`;

        const grid = document.getElementById('mcGrid');
        if (grid) {
          grid.innerHTML = results.map(mod => `
          <div class="mc-card" data-id="${mod.id}" data-name="${mod.name}">
            <div class="mc-card-top">
              <div class="mc-card-icon-placeholder" style="background:linear-gradient(135deg, #f97316, #ea580c);color:#fff;border:none;">
                <span class="material-icons-round">widgets</span>
              </div>
              <div class="mc-card-header-info">
                <div class="mc-card-name" title="${mod.name}">${mod.name}</div>
                <div class="mc-card-author">by ${mod.author}</div>
              </div>
            </div>
            
            <div class="mc-card-desc">${mod.desc}</div>
            
            <div class="mc-card-meta">
              <div class="mc-meta-item" title="Downloads">
                <span class="material-icons-round">download</span> ${mod.downloads.toLocaleString()}
              </div>
              <div class="mc-meta-item" title="Loader">
                <span class="material-icons-round">memory</span> ${mod.loaders.join(', ')}
              </div>
            </div>
          </div>
          `).join('');
        }
        resolve();
      }, 300); // Simulate network delay
    });
  }
});
