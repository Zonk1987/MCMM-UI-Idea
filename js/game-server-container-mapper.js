export class GameServerContainerMapper {
  map(containers) {
    return containers
      .filter((container) => this.supports(container))
      .map((container) => this.server(container));
  }

  supports(container) {
    return (
      container.gameServer?.game === 'minecraft' || container.labels?.['mcmm.game'] === 'minecraft'
    );
  }

  server(container) {
    const metadata = container.gameServer || {};
    const usedRam = Number(container.ram) || 0;
    const maxRam = Number(metadata.memoryMaxMb) || Math.max(usedRam, 4096);
    const port =
      container.ports?.find((entry) => entry.container === '25565') || container.ports?.[0] || {};

    return {
      containerId: container.id,
      container,
      game: metadata.game || container.labels?.['mcmm.game'] || 'minecraft',
      edition: metadata.edition || 'java',
      detection: metadata.detection || 'label',
      managed: metadata.managed === true || container.labels?.['mcmm.managed'] === 'true',
      serverName: container.name,
      version: metadata.version || 'Latest',
      serverType: metadata.serverType || 'Minecraft',
      modpack: metadata.modpack || null,
      dataPath:
        metadata.dataPath ||
        container.paths?.find((entry) => entry.container === '/data')?.host ||
        '',
      status: container.status === 'running' ? 'online' : 'offline',
      players: { current: 0, max: Number(metadata.maxPlayers) || 0 },
      ram: { used: usedRam, max: maxRam },
      cpu: Number(container.cpu) || 0,
      uptime: container.uptime || 'Offline',
      port: port.host || port.container || 0,
    };
  }
}
