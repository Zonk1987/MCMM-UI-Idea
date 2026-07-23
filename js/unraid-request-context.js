export class UnraidRequestContext {
  csrfToken() {
    const injected = globalThis.mcmmUnraidContext?.csrfToken;
    if (typeof injected === 'string' && injected !== '') return injected;
    for (const scope of this.scopes()) {
      try {
        const token = scope?.csrf_token;
        if (typeof token === 'string' && token !== '') return token;
      } catch {
        // Ignore inaccessible parent-window scopes and continue searching.
      }
    }
    return '';
  }

  form(values) {
    const token = this.csrfToken();
    if (token === '') throw new Error('Unraid CSRF token is unavailable');
    return new URLSearchParams({ ...values, csrf_token: token });
  }

  scopes() {
    return [globalThis, globalThis.parent, globalThis.top];
  }
}
