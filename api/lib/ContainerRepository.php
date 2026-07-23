<?php

declare(strict_types=1);

namespace Mcmm\Docker;

final class ContainerRepository
{
    public function __construct(
        private readonly \DockerClient $dockerClient,
        private readonly DockerStatsRepository $statsRepository,
        private readonly GameServerDetector $gameServerDetector
    ) {
    }

    public function all(): array
    {
        $metadata = $this->metadata();
        $autostart = $this->autostart();
        $stats = $this->stats();
        $host = $this->host();
        $normalized = [];

        foreach ($this->containers() as $container) {
            $name = $this->value($container['Name'] ?? $container['Names'] ?? '');
            try {
                $normalized[] = $this->normalize(
                    $container,
                    is_array($metadata[$name] ?? null) ? $metadata[$name] : [],
                    is_array($stats[$name] ?? null) ? $stats[$name] : [],
                    $autostart,
                    $host
                );
            } catch (\Throwable $error) {
                error_log(sprintf('MCMM container %s: %s', $name ?: 'unknown', $error->getMessage()));
                $normalized[] = $this->fallback($container, $autostart, $host);
            }
        }

        return $normalized;
    }

    private function normalize(
        array $container,
        array $metadata,
        array $stats,
        array $autostart,
        string $host
    ): array {
        $name = $this->value($container['Name'] ?? $container['Names'] ?? '');
        $id = $this->value($container['Id'] ?? $container['ID'] ?? '');
        $details = $this->details($id);
        $network = $this->value(
            $container['NetworkMode']
                ?? $details['HostConfig']['NetworkMode']
                ?? $container['Networks']
                ?? ''
        );
        $networks = is_array($container['Networks'] ?? null)
            ? $container['Networks']
            : (is_array($details['NetworkSettings']['Networks'] ?? null)
                ? $details['NetworkSettings']['Networks']
                : []);
        $ip = $this->ip($networks, $network);
        $labels = $this->labels($details, $name);
        $gameServer = $this->gameServer($container, $details, $name);
        $webUiTemplate = $this->webUiTemplate($container, $details, $metadata);
        if (!empty($container['ComposeProject']) && !isset($labels['com.docker.compose.project'])) {
            $labels['com.docker.compose.project'] = $this->value($container['ComposeProject']);
        }

        return [
            'id' => $id,
            'name' => $name,
            'image' => $this->value($container['Image'] ?? ''),
            'icon' => $this->nullableValue($metadata['icon'] ?? $container['Icon'] ?? null),
            'iconFallback' => '🐳',
            'status' => !empty($container['Paused'])
                ? 'paused'
                : (!empty($container['Running']) ? 'running' : 'stopped'),
            'statusText' => $this->value($container['Status'] ?? ''),
            'upToDate' => ($metadata['updated'] ?? null) !== 'false',
            'autostart' => in_array($name, $autostart, true),
            'ports' => $this->ports($container['Ports'] ?? []),
            'paths' => $this->paths($container['Volumes'] ?? $details['Mounts'] ?? []),
            'network' => $network,
            'ip' => $ip,
            'mac' => '',
            'lanIp' => $network === 'host' || $network === 'bridge' ? $host : ($ip ?: $host),
            'labels' => $labels,
            'cpu' => (float)($stats['cpu'] ?? 0),
            'ram' => (float)($stats['ram'] ?? 0),
            'uptime' => $this->value($container['Status'] ?? 'Offline'),
            'created' => $this->value($container['Created'] ?? ''),
            'webUi' => html_entity_decode($this->value($metadata['url'] ?? '')),
            'webUiTemplate' => $webUiTemplate,
            'manager' => $this->value($container['Manager'] ?? ''),
            'shell' => $this->value($metadata['shell'] ?? $container['Shell'] ?? 'sh'),
            'template' => $this->value($metadata['template'] ?? ''),
            'projectUrl' => html_entity_decode($this->value($metadata['Project'] ?? '')),
            'supportUrl' => html_entity_decode($this->value($metadata['Support'] ?? '')),
            'registryUrl' => html_entity_decode($this->value($metadata['registry'] ?? '')),
            'readMeUrl' => html_entity_decode($this->value($metadata['ReadMe'] ?? '')),
            'gameServer' => $gameServer,
        ];
    }

    private function fallback(array $container, array $autostart, string $host): array
    {
        $name = $this->value($container['Name'] ?? $container['Names'] ?? 'Unknown');
        return [
            'id' => $this->value($container['Id'] ?? $container['ID'] ?? ''),
            'name' => $name,
            'image' => $this->value($container['Image'] ?? ''),
            'icon' => null,
            'iconFallback' => '🐳',
            'status' => !empty($container['Paused'])
                ? 'paused'
                : (!empty($container['Running']) ? 'running' : 'stopped'),
            'statusText' => $this->value($container['Status'] ?? ''),
            'upToDate' => true,
            'autostart' => in_array($name, $autostart, true),
            'ports' => $this->ports($container['Ports'] ?? []),
            'paths' => $this->paths($container['Volumes'] ?? []),
            'network' => $this->value($container['NetworkMode'] ?? $container['Networks'] ?? ''),
            'ip' => '',
            'mac' => '',
            'lanIp' => $host,
            'labels' => [],
            'cpu' => 0.0,
            'ram' => 0.0,
            'uptime' => $this->value($container['Status'] ?? 'Offline'),
            'created' => $this->value($container['Created'] ?? ''),
            'webUi' => '',
            'webUiTemplate' => '',
            'manager' => $this->value($container['Manager'] ?? ''),
            'shell' => 'sh',
            'template' => '',
            'projectUrl' => '',
            'supportUrl' => '',
            'registryUrl' => '',
            'readMeUrl' => '',
            'gameServer' => null,
        ];
    }

    private function containers(): array
    {
        try {
            $containers = $this->dockerClient->getDockerContainers();
            if (is_array($containers)) {
                return array_values(array_filter($containers, 'is_array'));
            }
        } catch (\Throwable $error) {
            error_log('MCMM Unraid Docker list: ' . $error->getMessage());
        }
        return $this->dockerContainers();
    }

    private function dockerContainers(): array
    {
        $lines = [];
        $exitCode = 0;
        exec("docker ps --all --no-trunc --format '{{json .}}' 2>/dev/null", $lines, $exitCode);
        if ($exitCode !== 0) {
            return [];
        }
        $containers = [];
        foreach ($lines as $line) {
            $entry = json_decode($line, true);
            if (!is_array($entry)) {
                continue;
            }
            $state = strtolower($this->value($entry['State'] ?? ''));
            $containers[] = [
                'Id' => $this->value($entry['ID'] ?? ''),
                'Name' => $this->value($entry['Names'] ?? ''),
                'Image' => $this->value($entry['Image'] ?? ''),
                'Running' => $state === 'running',
                'Paused' => $state === 'paused',
                'Status' => $this->value($entry['Status'] ?? ''),
                'Ports' => $this->value($entry['Ports'] ?? ''),
                'Networks' => $this->value($entry['Networks'] ?? ''),
                'Created' => $this->value($entry['CreatedAt'] ?? ''),
            ];
        }
        return $containers;
    }

    private function metadata(): array
    {
        global $dockerManPaths;
        try {
            $path = is_array($dockerManPaths) ? ($dockerManPaths['webui-info'] ?? '') : '';
            $metadata = $path !== '' ? \DockerUtil::loadJSON($path) : [];
            return is_array($metadata) ? $metadata : [];
        } catch (\Throwable $error) {
            error_log('MCMM Docker metadata: ' . $error->getMessage());
            return [];
        }
    }

    private function autostart(): array
    {
        global $dockerManPaths;
        $path = is_array($dockerManPaths) ? ($dockerManPaths['autostart-file'] ?? '') : '';
        $rows = $path !== '' ? (@file($path, FILE_IGNORE_NEW_LINES) ?: []) : [];
        $names = [];
        foreach ($rows as $row) {
            try {
                $value = function_exists('var_split')
                    ? \var_split((string)$row)
                    : explode(' ', (string)$row)[0];
            } catch (\Throwable $error) {
                error_log('MCMM Docker autostart: ' . $error->getMessage());
                continue;
            }
            if (is_scalar($value) && (string)$value !== '') {
                $names[] = (string)$value;
            }
        }
        return $names;
    }

    private function stats(): array
    {
        try {
            $stats = $this->statsRepository->all();
            return is_array($stats) ? $stats : [];
        } catch (\Throwable $error) {
            error_log('MCMM Docker stats: ' . $error->getMessage());
            return [];
        }
    }

    private function host(): string
    {
        try {
            return $this->value(\DockerUtil::host()) ?: $this->value($_SERVER['SERVER_ADDR'] ?? '');
        } catch (\Throwable $error) {
            error_log('MCMM Docker host: ' . $error->getMessage());
            return $this->value($_SERVER['SERVER_ADDR'] ?? '');
        }
    }

    private function details(string $id): array
    {
        if ($id === '') {
            return [];
        }
        try {
            $details = $this->dockerClient->getContainerDetails($id);
            return is_array($details) ? $details : [];
        } catch (\Throwable $error) {
            error_log(sprintf('MCMM Docker details %s: %s', $id, $error->getMessage()));
            return [];
        }
    }

    private function labels(array $details, string $name): array
    {
        try {
            return $this->gameServerDetector->labels($details);
        } catch (\Throwable $error) {
            error_log(sprintf('MCMM Docker labels %s: %s', $name, $error->getMessage()));
            return [];
        }
    }

    private function gameServer(array $container, array $details, string $name): ?array
    {
        try {
            return $this->gameServerDetector->detect($container, $details);
        } catch (\Throwable $error) {
            error_log(sprintf('MCMM game server %s: %s', $name, $error->getMessage()));
            return null;
        }
    }

    private function ports(mixed $ports): array
    {
        if (!is_array($ports)) {
            $ports = [$ports];
        }
        $normalized = [];
        foreach ($ports as $key => $port) {
            if (is_array($port) && array_key_exists('PrivatePort', $port)) {
                $normalized[] = [
                    'host' => $this->value($port['PublicPort'] ?? ''),
                    'container' => $this->value($port['PrivatePort']),
                    'proto' => $this->value($port['Type'] ?? ''),
                ];
                continue;
            }
            if (is_string($key) && preg_match('/^(\d+)\/(tcp|udp)$/i', $key, $matches)) {
                $binding = is_array($port) && isset($port['HostPort'])
                    ? $port
                    : (is_array($port) && is_array(reset($port)) ? reset($port) : []);
                $normalized[] = [
                    'host' => $this->value($binding['HostPort'] ?? ''),
                    'container' => $matches[1],
                    'proto' => strtolower($matches[2]),
                ];
                continue;
            }
            if (is_string($port) && preg_match('/(?:(\d+)->)?(\d+)\/(tcp|udp)/i', $port, $matches)) {
                $normalized[] = [
                    'host' => $matches[1] ?? '',
                    'container' => $matches[2],
                    'proto' => strtolower($matches[3]),
                ];
            }
        }
        return $normalized;
    }

    private function paths(mixed $volumes): array
    {
        if (!is_array($volumes)) {
            return [];
        }
        $paths = [];
        foreach ($volumes as $key => $volume) {
            if (is_array($volume)) {
                $host = $this->value($volume['Source'] ?? '');
                $container = $this->value($volume['Destination'] ?? '');
                $mode = $this->value($volume['Mode'] ?? '');
            } elseif (is_string($volume)) {
                [$host, $container, $mode] = array_pad(explode(':', $volume, 3), 3, '');
                if ($container === '' && is_string($key)) {
                    $container = $volume;
                    $host = $key;
                }
            } else {
                continue;
            }
            if ($host !== '' || $container !== '') {
                $paths[] = ['host' => $host, 'container' => $container, 'mode' => $mode];
            }
        }
        return $paths;
    }

    private function webUiTemplate(array $container, array $details, array $metadata): string
    {
        $labels = is_array($details['Config']['Labels'] ?? null) ? $details['Config']['Labels'] : [];
        $template = html_entity_decode($this->value($labels['net.unraid.docker.webui'] ?? ''));
        if ($template !== '') {
            return $template;
        }
        $path = $this->value($metadata['template'] ?? '');
        if (!is_file($path)) {
            try {
                $path = $this->value($this->dockerClient->getUserTemplate($this->value($container['Name'] ?? '')));
            } catch (\Throwable) {
                $path = '';
            }
        }
        if (!is_file($path)) {
            return '';
        }
        $content = @file_get_contents($path);
        if (!is_string($content) || preg_match('/<WebUI>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/WebUI>/is', $content, $matches) !== 1) {
            return '';
        }
        return html_entity_decode(trim($matches[1]));
    }

    private function ip(mixed $networks, string $preferred): string
    {
        if (!is_array($networks)) {
            return '';
        }
        $preferredNetwork = $networks[$preferred] ?? null;
        $ip = is_array($preferredNetwork) ? $this->value($preferredNetwork['IPAddress'] ?? '') : '';
        if ($ip !== '') {
            return $ip;
        }
        foreach ($networks as $network) {
            $ip = is_array($network) ? $this->value($network['IPAddress'] ?? '') : '';
            if ($ip !== '') {
                return $ip;
            }
        }
        return '';
    }

    private function value(mixed $value): string
    {
        return is_scalar($value) ? (string)$value : '';
    }

    private function nullableValue(mixed $value): ?string
    {
        $normalized = $this->value($value);
        return $normalized !== '' ? $normalized : null;
    }
}
