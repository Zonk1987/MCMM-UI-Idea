export class ContainerApiClient {
  constructor(endpoint = '/plugins/mcmm-ui/api/containers.php') {
    this.endpoint = endpoint;
  }

  async list() {
    const response = await fetch(`${this.endpoint}?_=${Date.now()}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload?.detail || payload?.error;
      const reference = payload?.errorId ? ` (${payload.errorId})` : '';
      throw new Error(
        detail ? `${detail}${reference}` : `Container request failed with status ${response.status}`
      );
    }

    if (!Array.isArray(payload.containers)) {
      throw new TypeError('Container response is invalid');
    }

    return payload;
  }
}
