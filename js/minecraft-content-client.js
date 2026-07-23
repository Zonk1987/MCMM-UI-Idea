import { UnraidRequestContext } from './unraid-request-context.js?v=16';

export class MinecraftContentClient {
  constructor(
    endpoint = '/plugins/mcmm-ui/api/minecraft-content.php',
    context = new UnraidRequestContext()
  ) {
    this.endpoint = endpoint;
    this.context = context;
  }

  inventory(containerId, signal) {
    const query = new URLSearchParams({
      action: 'inventory',
      containerId,
      _: Date.now().toString(),
    });
    return this.request(`${this.endpoint}?${query}`, { signal });
  }

  install(containerId, file, type, overwrite = false) {
    return this.request(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: this.context.form({
        action: 'install',
        containerId,
        type,
        fileName: file.filename,
        url: file.url,
        sha512: file.hashes.sha512,
        overwrite,
      }),
    });
  }

  async request(url, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      const error = new Error(
        payload?.error || `Minecraft content request failed with status ${response.status}`
      );
      error.status = response.status;
      throw error;
    }
    return payload.result;
  }
}
