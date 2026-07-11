/* ═══════════════════════════════════════════════════════════
   folders.js — Folder Management
   Integrates with folder.view3 Unraid plugin labels.
═══════════════════════════════════════════════════════════ */

/**
 *
 */
export function foldersApp() {
  return {
    get folders() {
      const containers = Alpine.store('core').containers;
      const folderMap = {};
      
      // Group containers by folder.view3 label
      containers.forEach(c => {
        const folderName = c.labels && c.labels['folder.view3'] ? c.labels['folder.view3'] : 'Unassigned';
        if (!folderMap[folderName]) {
          folderMap[folderName] = {
            name: folderName,
            containers: [],
            isExpanded: true
          };
        }
        folderMap[folderName].containers.push(c);
      });
      
      return Object.values(folderMap);
    },
    
    toggleFolder() {
       // Logic to persist expanded state could go here
    }
  };
}
