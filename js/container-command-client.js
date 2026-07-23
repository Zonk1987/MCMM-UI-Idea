import { UnraidRequestContext } from './unraid-request-context.js?v=16';

export class ContainerCommandClient {
  constructor(
    eventEndpoint = '/plugins/dynamix.docker.manager/include/Events.php',
    configEndpoint = '/plugins/dynamix.docker.manager/include/UpdateConfig.php',
    updateCheckEndpoint = '/plugins/dynamix.docker.manager/include/DockerUpdate.php',
    updateEndpoint = '/plugins/dynamix.docker.manager/include/CreateDocker.php',
    sizesEndpoint = '/plugins/mcmm-ui/api/container-sizes.php',
    context = new UnraidRequestContext()
  ) {
    this.eventEndpoint = eventEndpoint;
    this.configEndpoint = configEndpoint;
    this.updateCheckEndpoint = updateCheckEndpoint;
    this.updateEndpoint = updateEndpoint;
    this.sizesEndpoint = sizesEndpoint;
    this.context = context;
  }

  async execute(action, container) {
    const nativeAction = action === 'remove' ? 'remove_container' : action;
    const payload = await this.post(this.eventEndpoint, {
      action: nativeAction,
      container: container.id,
      name: container.name,
    });

    if (payload.success !== true) {
      throw new Error(String(payload.success || payload.error || `Unable to ${action} container`));
    }

    return payload;
  }

  async executeMany(action, containers) {
    const results = [];
    for (const container of containers) {
      results.push(await this.execute(action, container));
    }
    return results;
  }

  async setAutostart(container, enabled) {
    await this.post(
      this.configEndpoint,
      {
        action: 'autostart',
        container: container.name,
        wait: '',
        auto: enabled ? 'true' : 'false',
      },
      false
    );
  }

  async checkUpdates() {
    await this.post(this.updateCheckEndpoint, {}, false);
  }

  async update(containers) {
    const query = new URLSearchParams({ updateContainer: 'true' });
    containers.forEach((container) => query.append('ct[]', container.name));
    const response = await fetch(`${this.updateEndpoint}?${query}`, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) throw new Error(`Update request failed with status ${response.status}`);
    return response.text();
  }

  async sizes(containers) {
    const query = new URLSearchParams({
      ids: containers.map((container) => container.id).join(','),
    });
    const response = await fetch(`${this.sizesEndpoint}?${query}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Size request failed with status ${response.status}`);
    const payload = await response.json();
    if (!payload.sizes || typeof payload.sizes !== 'object')
      throw new TypeError('Size response is invalid');
    return payload.sizes;
  }

  async post(endpoint, values, parseJson = true) {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: parseJson ? 'application/json' : 'text/plain',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: this.context.form(values),
    });

    if (!response.ok) throw new Error(`Docker request failed with status ${response.status}`);
    return parseJson ? response.json() : response.text();
  }
}
