<?php

declare(strict_types=1);

namespace Mcmm\Docker;

final class FileConflictException extends \RuntimeException
{
}

final class GameServerFileService
{
    private const MAX_EDIT_BYTES = 5242880;
    private const MAX_UPLOAD_BYTES = 67108864;
    private const ROOT_PRIORITY = [
        '/data',
        '/home/amp',
        '/serverdata/serverfiles',
        '/config',
        '/home/container',
        '/app',
    ];

    public function __construct(private readonly \DockerClient $dockerClient)
    {
    }

    public function listing(string $containerId, string $path, string $requestedRoot = ''): array
    {
        $root = $this->root($containerId, $requestedRoot);
        $directory = $this->existingPath($root['host'], $path);
        if (!is_dir($directory)) {
            throw new \DomainException('The requested path is not a directory');
        }

        $entries = [];
        foreach (new \DirectoryIterator($directory) as $entry) {
            if ($entry->isDot()) {
                continue;
            }
            $realPath = $entry->getRealPath();
            if ($realPath === false || !$this->within($root['host'], $realPath)) {
                continue;
            }
            $isDirectory = $entry->isDir();
            $size = $isDirectory ? 0 : $entry->getSize();
            $entries[] = [
                'name' => $entry->getFilename(),
                'path' => $this->relative($root['host'], $realPath),
                'type' => $isDirectory ? 'directory' : 'file',
                'size' => $size,
                'modified' => gmdate(DATE_ATOM, $entry->getMTime()),
                'editable' => !$isDirectory && $size <= self::MAX_EDIT_BYTES && $entry->isReadable(),
                'writable' => $entry->isWritable(),
            ];
        }

        usort($entries, static function (array $left, array $right): int {
            if ($left['type'] !== $right['type']) {
                return $left['type'] === 'directory' ? -1 : 1;
            }
            return strnatcasecmp($left['name'], $right['name']);
        });

        $relative = $this->relative($root['host'], $directory);
        return [
            'containerId' => $containerId,
            'hostRoot' => $root['host'],
            'containerRoot' => $root['container'],
            'path' => $relative,
            'parent' => $relative === '' ? null : (dirname($relative) === '.' ? '' : dirname($relative)),
            'writable' => is_writable($directory),
            'entries' => $entries,
        ];
    }

    public function read(string $containerId, string $path, string $requestedRoot = ''): array
    {
        $root = $this->root($containerId, $requestedRoot);
        $file = $this->existingPath($root['host'], $path);
        if (!is_file($file) || !is_readable($file)) {
            throw new \DomainException('The requested file is not readable');
        }
        $size = filesize($file);
        if ($size === false || $size > self::MAX_EDIT_BYTES) {
            throw new \DomainException('The requested file is too large to edit');
        }
        $content = file_get_contents($file);
        if ($content === false || str_contains($content, "\0") || preg_match('//u', $content) !== 1) {
            throw new \DomainException('The requested file is not a UTF-8 text file');
        }
        return [
            'path' => $this->relative($root['host'], $file),
            'name' => basename($file),
            'content' => $content,
            'size' => $size,
            'writable' => is_writable($file),
            'modified' => gmdate(DATE_ATOM, filemtime($file) ?: time()),
        ];
    }

    public function write(
        string $containerId,
        string $path,
        string $content,
        string $expectedModified,
        string $requestedRoot = ''
    ): array {
        if (strlen($content) > self::MAX_EDIT_BYTES || str_contains($content, "\0")) {
            throw new \InvalidArgumentException('The file content is invalid or too large');
        }
        $root = $this->root($containerId, $requestedRoot);
        $file = $this->existingPath($root['host'], $path);
        if (!is_file($file) || !is_writable($file)) {
            throw new \DomainException('The requested file is not writable');
        }
        $modified = gmdate(DATE_ATOM, filemtime($file) ?: time());
        if ($expectedModified !== '' && $expectedModified !== $modified) {
            throw new FileConflictException('The file changed on disk. Reload it before saving.');
        }
        $bytes = file_put_contents($file, $content, LOCK_EX);
        if ($bytes === false) {
            throw new \RuntimeException('Unable to save the requested file');
        }
        clearstatcache(true, $file);
        return [
            'path' => $this->relative($root['host'], $file),
            'bytes' => $bytes,
            'size' => $bytes,
            'modified' => gmdate(DATE_ATOM, filemtime($file) ?: time()),
        ];
    }

    public function upload(
        string $containerId,
        string $path,
        array $upload,
        bool $overwrite,
        string $requestedRoot = ''
    ): array {
        if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new \InvalidArgumentException('The upload did not complete');
        }
        $size = (int)($upload['size'] ?? 0);
        if ($size < 0 || $size > self::MAX_UPLOAD_BYTES) {
            throw new \InvalidArgumentException('The uploaded file is too large');
        }
        $name = $this->fileName((string)($upload['name'] ?? ''));
        $root = $this->root($containerId, $requestedRoot);
        $directory = $this->existingPath($root['host'], $path);
        if (!is_dir($directory) || !is_writable($directory)) {
            throw new \DomainException('The target directory is not writable');
        }
        $target = $directory . DIRECTORY_SEPARATOR . $name;
        if (file_exists($target)) {
            $existing = realpath($target);
            if ($existing === false || !$this->within($root['host'], $existing) || !is_file($existing)) {
                throw new \DomainException('The upload target is invalid');
            }
            if (!$overwrite) {
                throw new FileConflictException('A file with this name already exists.');
            }
            $target = $existing;
        }
        if (!move_uploaded_file((string)($upload['tmp_name'] ?? ''), $target)) {
            throw new \RuntimeException('Unable to store the uploaded file');
        }
        return ['name' => $name, 'path' => $this->relative($root['host'], $target), 'bytes' => $size];
    }

    public function createFile(string $containerId, string $path, string $name, string $requestedRoot = ''): array
    {
        $root = $this->root($containerId, $requestedRoot);
        $directory = $this->writableDirectory($root['host'], $path);
        $target = $this->newTarget($root['host'], $directory, $name);
        if (file_put_contents($target, '', LOCK_EX) === false) {
            throw new \RuntimeException('Unable to create the file');
        }
        return ['name' => basename($target), 'path' => $this->relative($root['host'], $target), 'type' => 'file'];
    }

    public function createDirectory(string $containerId, string $path, string $name, string $requestedRoot = ''): array
    {
        $root = $this->root($containerId, $requestedRoot);
        $directory = $this->writableDirectory($root['host'], $path);
        $target = $this->newTarget($root['host'], $directory, $name);
        if (!mkdir($target, 0775)) {
            throw new \RuntimeException('Unable to create the directory');
        }
        return ['name' => basename($target), 'path' => $this->relative($root['host'], $target), 'type' => 'directory'];
    }

    public function rename(string $containerId, string $path, string $name, string $requestedRoot = ''): array
    {
        $root = $this->root($containerId, $requestedRoot);
        $source = $this->existingPath($root['host'], $path);
        if ($source === $root['host']) {
            throw new \DomainException('The root directory cannot be renamed');
        }
        $target = $this->newTarget($root['host'], dirname($source), $name);
        if (!rename($source, $target)) {
            throw new \RuntimeException('Unable to rename the item');
        }
        return [
            'name' => basename($target),
            'path' => $this->relative($root['host'], $target),
            'type' => is_dir($target) ? 'directory' : 'file',
        ];
    }

    public function delete(string $containerId, string $path, bool $recursive, string $requestedRoot = ''): array
    {
        $root = $this->root($containerId, $requestedRoot);
        $target = $this->existingPath($root['host'], $path);
        if ($target === $root['host']) {
            throw new \DomainException('The root directory cannot be deleted');
        }
        if (is_dir($target)) {
            if (!$recursive && iterator_count(new \FilesystemIterator($target)) > 0) {
                throw new FileConflictException('The directory is not empty.');
            }
            $this->removeDirectory($root['host'], $target);
        } elseif (!unlink($target)) {
            throw new \RuntimeException('Unable to delete the file');
        }
        return ['path' => $path];
    }

    public function download(string $containerId, string $path, string $requestedRoot = ''): array
    {
        $root = $this->root($containerId, $requestedRoot);
        $file = $this->existingPath($root['host'], $path);
        if (!is_file($file) || !is_readable($file)) {
            throw new \DomainException('The requested file is not readable');
        }
        return ['path' => $file, 'name' => basename($file), 'size' => filesize($file) ?: 0];
    }

    private function root(string $containerId, string $requestedRoot): array
    {
        if (preg_match('/^[a-f0-9]{12,64}$/i', $containerId) !== 1) {
            throw new \InvalidArgumentException('Invalid container identifier');
        }
        $details = $this->dockerClient->getContainerDetails($containerId);
        $details = is_array($details) ? $details : [];
        $mounts = $this->mounts($details);
        if ($requestedRoot !== '') {
            foreach ($mounts as $mount) {
                if ($mount['container'] === rtrim($requestedRoot, '/')) {
                    return ['host' => $this->existingRoot($mount['host']), 'container' => $mount['container']];
                }
            }
            throw new \DomainException('The selected container file root is unavailable');
        }
        foreach (self::ROOT_PRIORITY as $candidate) {
            foreach ($mounts as $mount) {
                if ($mount['container'] === $candidate) {
                    return ['host' => $this->existingRoot($mount['host']), 'container' => $mount['container']];
                }
            }
        }
        if (count($mounts) === 1) {
            return ['host' => $this->existingRoot($mounts[0]['host']), 'container' => $mounts[0]['container']];
        }
        throw new \DomainException('No supported game server file mount was found');
    }

    private function mounts(array $details): array
    {
        $mounts = [];
        foreach (($details['Mounts'] ?? []) as $mount) {
            $host = (string)($mount['Source'] ?? '');
            $container = rtrim((string)($mount['Destination'] ?? ''), '/');
            if ($host !== '' && $container !== '') {
                $mounts[$container] = ['host' => $host, 'container' => $container];
            }
        }
        foreach (($details['HostConfig']['Binds'] ?? []) as $bind) {
            [$host, $container] = array_pad(explode(':', (string)$bind, 3), 2, '');
            $container = rtrim($container, '/');
            if ($host !== '' && $container !== '' && !isset($mounts[$container])) {
                $mounts[$container] = ['host' => $host, 'container' => $container];
            }
        }
        return array_values($mounts);
    }

    private function existingRoot(string $path): string
    {
        $root = realpath($path);
        if ($root === false || !is_dir($root)) {
            throw new \DomainException('The container data directory is unavailable');
        }
        return rtrim($root, DIRECTORY_SEPARATOR);
    }

    private function writableDirectory(string $root, string $path): string
    {
        $directory = $this->existingPath($root, $path);
        if (!is_dir($directory) || !is_writable($directory)) {
            throw new \DomainException('The target directory is not writable');
        }
        return $directory;
    }

    private function newTarget(string $root, string $directory, string $name): string
    {
        if (!$this->within($root, realpath($directory) ?: '')) {
            throw new \DomainException('The target directory is unavailable');
        }
        $target = $directory . DIRECTORY_SEPARATOR . $this->fileName($name);
        if (file_exists($target) || is_link($target)) {
            throw new FileConflictException('An item with this name already exists.');
        }
        return $target;
    }

    private function existingPath(string $root, string $path): string
    {
        $relative = $this->normalize($path);
        $candidate = $relative === '' ? $root : $root . DIRECTORY_SEPARATOR . $relative;
        $resolved = realpath($candidate);
        if ($resolved === false || !$this->within($root, $resolved)) {
            throw new \DomainException('The requested path is unavailable');
        }
        return $resolved;
    }

    private function normalize(string $path): string
    {
        $segments = [];
        foreach (explode('/', trim(str_replace('\\', '/', $path), '/')) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..' || str_contains($segment, "\0")) {
                throw new \InvalidArgumentException('Invalid file path');
            }
            $segments[] = $segment;
        }
        return implode(DIRECTORY_SEPARATOR, $segments);
    }

    private function within(string $root, string $path): bool
    {
        return $path === $root || str_starts_with($path, $root . DIRECTORY_SEPARATOR);
    }

    private function relative(string $root, string $path): string
    {
        if ($path === $root) {
            return '';
        }
        return str_replace(DIRECTORY_SEPARATOR, '/', substr($path, strlen($root) + 1));
    }

    private function fileName(string $name): string
    {
        $value = basename(str_replace('\\', '/', trim($name)));
        if ($value === '' || $value === '.' || $value === '..' || str_contains($value, "\0")) {
            throw new \InvalidArgumentException('Invalid filename');
        }
        return $value;
    }

    private function removeDirectory(string $root, string $directory): void
    {
        foreach (new \FilesystemIterator($directory) as $entry) {
            $path = $entry->getPathname();
            $resolved = realpath($path);
            if ($resolved === false || !$this->within($root, $resolved)) {
                throw new \DomainException('The directory contains an unsafe path');
            }
            if ($entry->isLink() || $entry->isFile()) {
                if (!unlink($path)) {
                    throw new \RuntimeException('Unable to delete a file');
                }
            } elseif ($entry->isDir()) {
                $this->removeDirectory($root, $resolved);
            }
        }
        if (!rmdir($directory)) {
            throw new \RuntimeException('Unable to delete the directory');
        }
    }
}
