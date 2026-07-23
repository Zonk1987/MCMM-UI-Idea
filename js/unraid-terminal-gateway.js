export class UnraidTerminalGateway {
  constructor(endpoint = '/webGui/include/OpenTerminal.php') {
    this.endpoint = endpoint;
  }

  async start(container, mode) {
    const name = container.name.replace(/[ #]/g, '_');
    const suffix = mode === 'logs' ? '.log' : '';
    const more = mode === 'logs' ? '.log' : container.shell || 'sh';
    const query = new URLSearchParams({ tag: 'docker', name, more });
    const response = await fetch(`${this.endpoint}?${query}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Unable to start ${mode} session (${response.status})`);
    const path = `/logterminal/${encodeURIComponent(name + suffix)}`;
    const token = await this.token(path);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return {
      token,
      url: `${protocol}//${window.location.host}${path}/ws`,
      writable: mode === 'console',
    };
  }

  async token(path) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await fetch(`${path}/token`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (response.ok) {
          const payload = await response.json();
          if (typeof payload.token === 'string') return payload.token;
        }
      } catch {
        // The session endpoint may not be ready yet.
      }
      await this.delay(100);
    }
    throw new Error('Unraid terminal session did not become available');
  }

  delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
