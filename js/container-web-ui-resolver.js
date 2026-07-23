export class ContainerWebUiResolver {
  constructor(webPorts = [80, 443, 3000, 5000, 8000, 8008, 8080, 8081, 8443, 8888, 9000, 9443]) {
    this.webPorts = webPorts.map(String);
  }

  hasWebUi(container) {
    return Boolean(this.source(container));
  }

  resolve(container) {
    const source = this.source(container);
    if (!source) return '';
    const target = source.match(/\[PORT:(\d+)\]/i)?.[1] || this.literalPort(source);
    const selected = this.selectPort(container?.ports, target);
    const address = this.address(container, selected);
    let resolved = source.replaceAll(/\[IP\]/gi, address);
    resolved = resolved.replaceAll(/\[PORT:\d+\]/gi, selected?.host || target || '');
    if (/\[(?:IP|PORT:)/i.test(resolved)) return '';
    return this.normalize(resolved, container, selected);
  }

  source(container) {
    return String(container?.webUiTemplate || container?.webUi || '').trim();
  }

  selectPort(ports, target) {
    const values = Array.isArray(ports) ? ports : [];
    const tcp = values.filter(
      (port) => String(port?.proto || '').toLowerCase() === 'tcp' && this.validPort(port?.host)
    );
    if (target) {
      const exact = tcp.find(
        (port) => String(port.container) === String(target) || String(port.host) === String(target)
      );
      if (exact) return exact;
    }
    for (const known of this.webPorts) {
      const match = tcp.find(
        (port) => String(port.container) === known || String(port.host) === known
      );
      if (match) return match;
    }
    return tcp.length === 1 ? tcp[0] : null;
  }

  address(container, selected) {
    const network = String(container?.network || '').toLowerCase();
    const value =
      selected?.host && container?.lanIp
        ? container.lanIp
        : network !== 'bridge' && network !== 'host' && container?.ip
        ? container.ip
        : container?.lanIp || container?.ip || globalThis.location?.hostname || '';
    const host = String(value).replace(/^\[|\]$/g, '');
    return host.includes(':') ? `[${host}]` : host;
  }

  normalize(value, container, selected) {
    try {
      const url = new URL(value);
      const mapped = this.mappingForUrl(container?.ports, url.port);
      if (mapped?.proto === 'udp' && selected) url.port = selected.host;
      if (this.dockerAddress(url.hostname)) {
        url.hostname = this.address(container, selected).replace(/^\[|\]$/g, '');
      }
      return url.href;
    } catch {
      return '';
    }
  }

  mappingForUrl(ports, value) {
    if (!value || !Array.isArray(ports)) return null;
    return (
      ports.find(
        (port) => String(port?.host) === String(value) || String(port?.container) === String(value)
      ) || null
    );
  }

  literalPort(value) {
    const match = String(value).match(/^[a-z][a-z\d+.-]*:\/\/(?:\[[^\]]+\]|[^/:]+):(\d+)/i);
    return match?.[1] || '';
  }

  validPort(value) {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port <= 65535;
  }

  dockerAddress(value) {
    return /^(?:172\.(?:1[6-9]|2\d|3[01])|169\.254)\./.test(String(value));
  }
}
