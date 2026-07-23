export class ContainerLayoutRepository {
  constructor(storage = window.localStorage, key = 'mcmm.container-layout.v1') {
    this.storage = storage;
    this.key = key;
  }

  load() {
    try {
      return this.normalize(JSON.parse(this.storage.getItem(this.key) || '{}'));
    } catch {
      return this.normalize({});
    }
  }

  save(layout) {
    const normalized = this.normalize(layout);
    this.storage.setItem(this.key, JSON.stringify(normalized));
    return normalized;
  }

  apply(containers, layout = this.load()) {
    return containers.map((container) => {
      const labels = { ...(container.labels || {}) };
      const folder = layout.assignments[container.id];
      delete labels['folder.view3'];
      if (folder) labels['folder.view3'] = folder;
      return { ...container, labels };
    });
  }

  capture(containers, folders, icons) {
    const assignments = {};
    containers.forEach((container) => {
      const folder = container.labels?.['folder.view3'];
      if (folder) assignments[container.id] = folder;
    });
    return this.save({ folders, icons, assignments });
  }

  normalize(layout) {
    return {
      folders: Array.isArray(layout.folders) ? [...new Set(layout.folders.filter(Boolean))] : [],
      icons: layout.icons && typeof layout.icons === 'object' ? { ...layout.icons } : {},
      assignments:
        layout.assignments && typeof layout.assignments === 'object'
          ? { ...layout.assignments }
          : {},
    };
  }
}
