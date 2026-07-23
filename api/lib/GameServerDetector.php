<?php

declare(strict_types=1);

namespace Mcmm\Docker;

final class GameServerDetector
{
    public function detect(array $container, array $details): ?array
    {
        $labels = is_array($details['Config']['Labels'] ?? null) ? $details['Config']['Labels'] : [];
        $environment = $this->environment($details['Config']['Env'] ?? []);
        $image = strtolower((string)($details['Config']['Image'] ?? $container['Image'] ?? ''));
        $name = strtolower((string)($container['Name'] ?? ''));
        $game = strtolower((string)($labels['mcmm.game'] ?? ''));
        $minecraftPort = $this->hasContainerPort($container['Ports'] ?? [], 25565);
        $minecraftIdentity = str_contains($image, 'minecraft')
            || str_contains($image, 'papermc')
            || str_contains($image, 'spigot')
            || str_contains($name, 'minecraft')
            || str_contains($name, 'papermc');

        if ($game !== 'minecraft' && !$minecraftIdentity && !($minecraftPort && isset($environment['EULA']))) {
            return null;
        }

        $memory = (int)($details['HostConfig']['Memory'] ?? 0);
        $memoryMaxMb = $memory > 0
            ? (int)ceil($memory / 1048576)
            : $this->memoryMb((string)($environment['MEMORY'] ?? $environment['MAX_MEMORY'] ?? ''));
        $edition = str_contains($image, 'bedrock') ? 'bedrock' : 'java';

        return [
            'game' => 'minecraft',
            'edition' => $edition,
            'managed' => strtolower((string)($labels['mcmm.managed'] ?? '')) === 'true',
            'detection' => $game === 'minecraft' ? 'label' : 'docker-metadata',
            'version' => (string)($environment['VERSION'] ?? 'Latest'),
            'serverType' => (string)($environment['TYPE'] ?? ($edition === 'bedrock' ? 'Bedrock' : 'Minecraft')),
            'maxPlayers' => max(0, (int)($environment['MAX_PLAYERS'] ?? 0)),
            'memoryMaxMb' => $memoryMaxMb,
            'dataPath' => $this->dataPath($details),
            'modpack' => $this->modpack($environment, $labels),
        ];
    }

    public function labels(array $details): array
    {
        $source = is_array($details['Config']['Labels'] ?? null) ? $details['Config']['Labels'] : [];
        $labels = [];
        foreach (
            [
                'com.docker.compose.project',
                'mcmm.managed',
                'mcmm.game',
                'mcmm.minecraft.type',
                'mcmm.modpack.source',
                'mcmm.modpack.project',
                'mcmm.modpack.version',
            ] as $key
        ) {
            if (isset($source[$key]) && $source[$key] !== '') {
                $labels[$key] = (string)$source[$key];
            }
        }
        return $labels;
    }

    private function environment(mixed $values): array
    {
        if (!is_array($values)) {
            return [];
        }
        $environment = [];
        foreach ($values as $value) {
            [$key, $entry] = array_pad(explode('=', (string)$value, 2), 2, '');
            if ($key !== '') {
                $environment[$key] = $entry;
            }
        }
        return $environment;
    }

    private function hasContainerPort(mixed $ports, int $expected): bool
    {
        if (!is_array($ports)) {
            return false;
        }
        foreach ($ports as $key => $port) {
            if ((int)$key === $expected) {
                return true;
            }
            if (is_array($port) && (int)($port['PrivatePort'] ?? 0) === $expected) {
                return true;
            }
            if (is_string($port) && preg_match('/(?:^|:)' . $expected . '\/(?:tcp|udp)/i', $port)) {
                return true;
            }
        }
        return false;
    }

    private function memoryMb(string $value): int
    {
        if (!preg_match('/^\s*([0-9.]+)\s*([kmgt]?)i?b?\s*$/i', $value, $matches)) {
            return 0;
        }
        $multipliers = ['' => 1, 'k' => 1 / 1024, 'm' => 1, 'g' => 1024, 't' => 1048576];
        return (int)round((float)$matches[1] * ($multipliers[strtolower($matches[2])] ?? 1));
    }

    private function dataPath(array $details): string
    {
        $mounts = is_array($details['Mounts'] ?? null) ? $details['Mounts'] : [];
        foreach ($mounts as $mount) {
            if (!is_array($mount)) {
                continue;
            }
            if (($mount['Destination'] ?? '') === '/data') {
                return (string)($mount['Source'] ?? '');
            }
        }
        $binds = is_array($details['HostConfig']['Binds'] ?? null)
            ? $details['HostConfig']['Binds']
            : [];
        foreach ($binds as $bind) {
            [$source, $destination] = array_pad(explode(':', (string)$bind, 3), 3, '');
            if ($destination === '/data') {
                return $source;
            }
        }
        return '';
    }

    private function modpack(array $environment, array $labels): ?array
    {
        $project = (string)($environment['MODRINTH_MODPACK'] ?? $labels['mcmm.modpack.project'] ?? '');
        if ($project !== '') {
            return [
                'source' => 'modrinth',
                'project' => $project,
                'version' => (string)($environment['MODRINTH_VERSION'] ?? $labels['mcmm.modpack.version'] ?? ''),
            ];
        }
        $project = (string)($environment['CF_PAGE_URL'] ?? '');
        if ($project !== '') {
            return [
                'source' => 'curseforge',
                'project' => $project,
                'version' => (string)($environment['CF_FILE_ID'] ?? ''),
            ];
        }
        return null;
    }
}
