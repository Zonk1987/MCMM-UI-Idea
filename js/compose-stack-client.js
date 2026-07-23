import { UnraidRequestContext } from './unraid-request-context.js?v=16';

export class ComposeStackClient {
  constructor(
    endpoint = '/plugins/mcmm-ui/api/compose-stack.php',
    context = new UnraidRequestContext()
  ) {
    this.endpoint = endpoint;
    this.context = context;
  }

  async deploy(name, content) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: this.context.form({ name, content }),
    });
    const payload = await response.json();
    if (!response.ok || payload.success !== true) {
      throw new Error(payload.error || `Compose deployment failed with status ${response.status}`);
    }
    return payload;
  }
}
