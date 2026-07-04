/* ═══════════════════════════════════════════════════════════
   cs2.js — CS2 Module for Game Additions
═══════════════════════════════════════════════════════════ */

import { GameAdditions } from '../gameAdditions.js';

GameAdditions.registerGame('cs2', {
  name: 'CS2',
  icon: '🔫',
  
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
      // 4268 is used here as a placeholder for CS:GO/CS2 context
      await GameAdditions.fetchCurseForgeGeneric('4268', state);
    }
  }
});
