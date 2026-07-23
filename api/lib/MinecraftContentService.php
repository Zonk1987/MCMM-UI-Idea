<?php

declare(strict_types=1);

namespace Mcmm\Minecraft;

final class MinecraftContentConflictException extends \RuntimeException
{
}

final class MinecraftContentService
{
    private const MAX_ITEMS = 1000;
    private const MAX_DOWNLOAD_BYTES = 536870912;

    public function __construct(private readonly \DockerClient $dockerClient)
    {
    }

    public function inventory(string $containerId): array
    {
        $details = $this->details($containerId);
        $root = $this->root($details);
        $environment = $this->environment($details['Config']['Env'] ?? []);
        $items = [];
        foreach (['mods' => 'mod', 'plugins' => 'plugin'] as $directory => $type) {
            $path = $root . DIRECTORY_SEPARATOR . $directory;
            if (!is_dir($path)) {
                continue;
            }
            foreach (new \DirectoryIterator($path) as $entry) {
                if (count($items) >= self::MAX_ITEMS) {
                    break 2;
                }
                if ($entry->isDot() || !$entry->isFile() || $entry->isLink()) {
                    continue;
                }
                $name = $entry->getFilename();
                if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) !== 'jar') {
                    continue;
                }
                $realPath = $entry->getRealPath();
                if ($realPath === false || !$this->within($root, $realPath)) {
                    continue;
                }
                $hash = sha1_file($realPath);
                if ($hash === false) {
                    continue;
                }
                $items[] = [
                    'name' => $name,
                    'path' => $directory . '/' . $name,
                    'type' => $type,
                    'size' => $entry->getSize(),
                    'modified' => gmdate(DATE_ATOM, $entry->getMTime()),
                    'sha1' => $hash,
                ];
            }
        }

        return [
            'containerId' => $containerId,
            'server' => [
                'version' => (string)($environment['VERSION'] ?? 'LATEST'),
                'loader' => strtolower((string)($environment['TYPE'] ?? 'vanilla')),
            ],
            'modpack' => $this->modpack($environment),
            'items' => $items,
            'truncated' => count($items) >= self::MAX_ITEMS,
            'scannedAt' => gmdate(DATE_ATOM),
        ];
    }

    public function install(
        string $containerId,
        string $type,
        string $fileName,
        string $url,
        string $sha512,
        bool $overwrite
    ): array {
        $details = $this->details($containerId);
        $root = $this->root($details);
        $directoryName = match ($type) {
            'mod' => 'mods',
            'plugin' => 'plugins',
            default => throw new \InvalidArgumentException('Unsupported Minecraft content type'),
        };
        $name = $this->jarName($fileName);
        $downloadUrl = $this->downloadUrl($url);
        if (preg_match('/^[a-f0-9]{128}$/i', $sha512) !== 1) {
            throw new \InvalidArgumentException('A valid SHA-512 checksum is required');
        }
        $directory = $this->contentDirectory($root, $directoryName);
        $target = $directory . DIRECTORY_SEPARATOR . $name;
        if (file_exists($target) && !$overwrite) {
            throw new MinecraftContentConflictException('A file with this name already exists');
        }
        $temporary = tempnam($directory, '.mcmm-');
        if ($temporary === false) {
            throw new \RuntimeException('Unable to prepare the download');
        }
        try {
            $this->download($downloadUrl, $temporary);
            $actualHash = hash_file('sha512', $temporary);
            if (!is_string($actualHash) || !hash_equals(strtolower($sha512), strtolower($actualHash))) {
                throw new \RuntimeException('The downloaded file failed checksum verification');
            }
            if (!rename($temporary, $target)) {
                throw new \RuntimeException('Unable to install the downloaded file');
            }
        } finally {
            if (file_exists($temporary)) {
                @unlink($temporary);
            }
        }
        return [
            'name' => $name,
            'path' => $directoryName . '/' . $name,
            'bytes' => filesize($target) ?: 0,
            'restartRequired' => true,
        ];
    }

    private function details(string $containerId): array
    {
        if (preg_match('/^[a-f0-9]{12,64}$/i', $containerId) !== 1) {
            throw new \InvalidArgumentException('Invalid container identifier');
        }
        $details = $this->dockerClient->getContainerDetails($containerId);
        if (!is_array($details)) {
            throw new \DomainException('The Minecraft container is unavailable');
        }
        return $details;
    }

    private function root(array $details): string
    {
        foreach (($details['Mounts'] ?? []) as $mount) {
            if (rtrim((string)($mount['Destination'] ?? ''), '/') !== '/data') {
                continue;
            }
            return $this->existingRoot((string)($mount['Source'] ?? ''));
        }
        foreach (($details['HostConfig']['Binds'] ?? []) as $bind) {
            [$source, $destination] = array_pad(explode(':', (string)$bind, 3), 2, '');
            if (rtrim($destination, '/') === '/data') {
                return $this->existingRoot($source);
            }
        }
        throw new \DomainException('This Minecraft container does not expose a /data mount');
    }

    private function existingRoot(string $path): string
    {
        $root = realpath($path);
        if ($root === false || !is_dir($root)) {
            throw new \DomainException('The Minecraft data directory is unavailable');
        }
        return rtrim($root, DIRECTORY_SEPARATOR);
    }

    private function environment(mixed $values): array
    {
        $environment = [];
        foreach (is_array($values) ? $values : [] as $value) {
            [$key, $entry] = array_pad(explode('=', (string)$value, 2), 2, '');
            if ($key !== '') {
                $environment[$key] = $entry;
            }
        }
        return $environment;
    }

    private function modpack(array $environment): ?array
    {
        if (($environment['MODRINTH_MODPACK'] ?? '') !== '') {
            return [
                'source' => 'modrinth',
                'project' => (string)$environment['MODRINTH_MODPACK'],
                'version' => (string)($environment['MODRINTH_VERSION'] ?? ''),
            ];
        }
        if (($environment['CF_PAGE_URL'] ?? '') !== '') {
            return [
                'source' => 'curseforge',
                'project' => (string)$environment['CF_PAGE_URL'],
                'version' => (string)($environment['CF_FILE_ID'] ?? ''),
            ];
        }
        if (($environment['FTB_MODPACK_ID'] ?? '') !== '') {
            return [
                'source' => 'ftb',
                'project' => (string)$environment['FTB_MODPACK_ID'],
                'version' => (string)($environment['FTB_MODPACK_VERSION_ID'] ?? ''),
            ];
        }
        return null;
    }

    private function jarName(string $value): string
    {
        $name = basename(str_replace('\\', '/', trim($value)));
        if (
            $name === ''
            || strtolower(pathinfo($name, PATHINFO_EXTENSION)) !== 'jar'
            || preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._+() -]{0,199}\.jar$/', $name) !== 1
        ) {
            throw new \InvalidArgumentException('Invalid JAR filename');
        }
        return $name;
    }

    private function downloadUrl(string $value): string
    {
        $url = filter_var(trim($value), FILTER_VALIDATE_URL);
        $parts = is_string($url) ? parse_url($url) : false;
        if (
            !is_array($parts)
            || strtolower((string)($parts['scheme'] ?? '')) !== 'https'
            || strtolower((string)($parts['host'] ?? '')) !== 'cdn.modrinth.com'
        ) {
            throw new \InvalidArgumentException('Only Modrinth CDN downloads are supported');
        }
        return $url;
    }

    private function download(string $url, string $target): void
    {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('The server download service is unavailable');
        }
        $handle = fopen($target, 'wb');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open the temporary download');
        }
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_FILE => $handle,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_FAILONERROR => true,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 300,
            CURLOPT_MAXFILESIZE => self::MAX_DOWNLOAD_BYTES,
            CURLOPT_NOPROGRESS => false,
            CURLOPT_XFERINFOFUNCTION => static fn(
                mixed $handle,
                float $downloadSize,
                float $downloaded,
                float $uploadSize,
                float $uploaded
            ): int => $downloaded > self::MAX_DOWNLOAD_BYTES ? 1 : 0,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_USERAGENT => 'MCMM-UI/1.0 (Unraid Minecraft manager)',
        ]);
        $success = curl_exec($curl);
        $error = curl_error($curl);
        curl_close($curl);
        fclose($handle);
        if ($success !== true) {
            throw new \RuntimeException($error !== '' ? $error : 'Unable to download the content file');
        }
        $size = filesize($target);
        if ($size === false || $size <= 0 || $size > self::MAX_DOWNLOAD_BYTES) {
            throw new \RuntimeException('The downloaded content file has an invalid size');
        }
    }

    private function within(string $root, string $path): bool
    {
        return $path === $root || str_starts_with($path, $root . DIRECTORY_SEPARATOR);
    }

    private function contentDirectory(string $root, string $name): string
    {
        $directory = $root . DIRECTORY_SEPARATOR . $name;
        if (!is_dir($directory) && !mkdir($directory, 0775, true)) {
            throw new \RuntimeException('Unable to create the content directory');
        }
        if (is_link($directory)) {
            throw new \DomainException('The content directory cannot be a symbolic link');
        }
        $resolved = realpath($directory);
        if ($resolved === false || !$this->within($root, $resolved)) {
            throw new \DomainException('The content directory is outside the server data directory');
        }
        if (!is_writable($resolved)) {
            throw new \DomainException('The content directory is not writable');
        }
        return $resolved;
    }
}
