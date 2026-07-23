import { UnraidRequestContext } from './unraid-request-context.js?v=16';

export class FileRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FileRequestError';
    this.status = status;
  }
}

export class GameServerFileClient {
  constructor(endpoint = '/plugins/mcmm-ui/api/files.php', context = new UnraidRequestContext()) {
    this.endpoint = endpoint;
    this.context = context;
  }

  list(containerId, path = '', root = '', signal) {
    return this.get('list', containerId, path, root, signal);
  }

  read(containerId, path, root = '', signal) {
    return this.get('read', containerId, path, root, signal);
  }

  save(containerId, path, content, expectedModified, root = '', signal) {
    return this.post(
      { action: 'write', containerId, path, content, expectedModified, root },
      signal
    );
  }

  createFile(containerId, path, name, root = '', signal) {
    return this.post({ action: 'create-file', containerId, path, name, root }, signal);
  }

  createDirectory(containerId, path, name, root = '', signal) {
    return this.post({ action: 'create-directory', containerId, path, name, root }, signal);
  }

  rename(containerId, path, name, root = '', signal) {
    return this.post({ action: 'rename', containerId, path, name, root }, signal);
  }

  delete(containerId, path, recursive, root = '', signal) {
    return this.post({ action: 'delete', containerId, path, recursive, root }, signal);
  }

  upload(containerId, path, file, overwrite, root, onProgress, signal) {
    const token = this.context.csrfToken();
    if (token === '') return Promise.reject(new Error('Unraid CSRF token is unavailable'));
    const body = new FormData();
    body.set('action', 'upload');
    body.set('containerId', containerId);
    body.set('path', path);
    body.set('root', root);
    body.set('overwrite', overwrite ? '1' : '0');
    body.set('csrf_token', token);
    body.set('file', file, file.name);
    return this.uploadRequest(body, onProgress, signal);
  }

  async download(containerId, path, root = '', signal) {
    const response = await fetch(this.url('download', containerId, path, root), {
      credentials: 'same-origin',
      headers: { Accept: 'application/octet-stream' },
      signal,
    });
    if (!response.ok) throw new FileRequestError(await this.error(response), response.status);
    return response.blob();
  }

  get(action, containerId, path, root, signal) {
    return this.request(this.url(action, containerId, path, root), { signal });
  }

  post(values, signal) {
    return this.request(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: this.context.form(values),
      signal,
    });
  }

  url(action, containerId, path, root = '') {
    const query = new URLSearchParams({
      action,
      containerId,
      path,
      root,
      _: Date.now().toString(),
    });
    return `${this.endpoint}?${query}`;
  }

  async request(url, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new FileRequestError(
        `File request returned an invalid response with status ${response.status}`,
        response.status
      );
    }
    if (!response.ok || payload.success !== true) {
      throw new FileRequestError(
        payload.error || `File request failed with status ${response.status}`,
        response.status
      );
    }
    return payload.result;
  }

  uploadRequest(body, onProgress, signal) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', this.endpoint);
      request.responseType = 'text';
      request.setRequestHeader('Accept', 'application/json');
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded, event.total);
      });
      request.addEventListener('load', () => {
        let payload;
        try {
          payload = JSON.parse(request.responseText);
        } catch {
          reject(
            new FileRequestError(
              `File request returned an invalid response with status ${request.status}`,
              request.status
            )
          );
          return;
        }
        if (request.status < 200 || request.status >= 300 || payload.success !== true) {
          reject(
            new FileRequestError(
              payload.error || `Upload failed with status ${request.status}`,
              request.status
            )
          );
          return;
        }
        resolve(payload.result);
      });
      request.addEventListener('error', () => reject(new Error('The upload connection failed')));
      request.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      signal?.addEventListener('abort', () => request.abort(), { once: true });
      request.send(body);
    });
  }

  async error(response) {
    const text = await response.text();
    try {
      return JSON.parse(text).error || `Download failed with status ${response.status}`;
    } catch {
      return `Download failed with status ${response.status}`;
    }
  }
}
