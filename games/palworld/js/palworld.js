/* ═══════════════════════════════════════════════════════════
   palworld.js — Palworld Module for Game Additions
═══════════════════════════════════════════════════════════ */

import { GameAdditions } from '../../../js/gameAdditions.js';
import { appSettings } from '../../../js/settings.js';

GameAdditions.registerGame('palworld', {
  name: 'Palworld',
  icon: '🦎',
  
  onSelect(state) {
    // Hide Minecraft-specific UI and enforce CurseForge
    const mcSidebar = document.getElementById('mcSidebar');
    const mcLayout = document.querySelector('.mc-layout');
    const sourceToggle = document.getElementById('sourceToggle');
    const modrinthBtn = sourceToggle?.querySelector('[data-source="modrinth"]');
    const ftbBtn = sourceToggle?.querySelector('[data-source="ftb"]');
    const cfBtn = sourceToggle?.querySelector('[data-source="curseforge"]');
    
    if (mcSidebar) mcSidebar.style.display = 'none';
    if (mcLayout) mcLayout.classList.add('no-sidebar');
    if (modrinthBtn) modrinthBtn.style.display = 'none';
    if (ftbBtn) ftbBtn.style.display = 'none';
    if (cfBtn) cfBtn.classList.add('active');

    state.source = 'curseforge';
  },

  async fetchContent(state) {
    if (state.source === 'curseforge') {
      // 85196 is the verified internal CurseForge GameID for Palworld
      await GameAdditions.fetchCurseForgeGeneric('85196', state);
    }
  }
});
