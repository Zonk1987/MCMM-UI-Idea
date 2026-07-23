export class ModrinthClient {
  constructor(endpoint = 'https://api.modrinth.com/v2') {
    this.endpoint = endpoint;
  }

  project(id) {
    return this.request(`/project/${encodeURIComponent(this.projectReference(id))}`);
  }

  async projects(ids) {
    const values = [...new Set(ids.filter(Boolean))];
    if (values.length === 0) return [];
    const responses = await Promise.all(
      this.groups(values).map((group) =>
        this.request(`/projects?ids=${encodeURIComponent(JSON.stringify(group))}`)
      )
    );
    return responses.flat();
  }

  versions(projectId, gameVersion = '', loader = '') {
    const query = new URLSearchParams();
    if (gameVersion && gameVersion !== 'LATEST') {
      query.set('game_versions', JSON.stringify([gameVersion]));
    }
    const normalizedLoader = this.loader(loader);
    if (normalizedLoader) query.set('loaders', JSON.stringify([normalizedLoader]));
    return this.request(
      `/project/${encodeURIComponent(projectId)}/version${query.size > 0 ? `?${query}` : ''}`
    );
  }

  async versionsByHashes(hashes) {
    const values = [...new Set(hashes.filter(Boolean))];
    if (values.length === 0) return {};
    const responses = await Promise.all(
      this.groups(values).map((group) =>
        this.request('/version_files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashes: group, algorithm: 'sha1' }),
        })
      )
    );
    return Object.assign({}, ...responses);
  }

  async request(path, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    const response = await fetch(`${this.endpoint}${path}`, {
      ...options,
      headers,
    });
    if (!response.ok) throw new Error(`Modrinth request failed with status ${response.status}`);
    return response.json();
  }

  projectReference(value) {
    const reference = String(value || '').trim();
    try {
      const url = new URL(reference);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[1] || parts[0] || reference;
    } catch {
      return reference;
    }
  }

  loader(value) {
    const loader = String(value || '').toLocaleLowerCase();
    if (['paper', 'purpur', 'spigot', 'bukkit'].includes(loader)) return 'paper';
    if (['fabric', 'forge', 'neoforge', 'quilt'].includes(loader)) return loader;
    return '';
  }

  groups(values, size = 100) {
    return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
      values.slice(index * size, (index + 1) * size)
    );
  }
}
