<?php

declare(strict_types=1);

namespace Mcmm\Docker;

final class ComposeStackService
{
    public function __construct(
        private readonly string $projectsRoot,
        private readonly string $composeScript
    ) {
    }

    public function deploy(string $name, string $content): array
    {
        $displayName = trim($name);
        if (!preg_match('/^[a-z0-9][a-z0-9 ._-]{0,79}$/i', $displayName)) {
            throw new \InvalidArgumentException('Stack name contains unsupported characters');
        }
        if (trim($content) === '') {
            throw new \InvalidArgumentException('Compose content is required');
        }

        $folderName = preg_replace('/\s+/', '_', $displayName);
        $folder = $this->projectsRoot . '/' . $folderName;
        if (is_dir($folder)) {
            throw new \DomainException('A stack with this name already exists');
        }
        if (!is_dir($this->projectsRoot) && !mkdir($this->projectsRoot, 0777, true)) {
            throw new \RuntimeException('Unable to create the Compose projects directory');
        }
        if (!mkdir($folder, 0777, true)) {
            throw new \RuntimeException('Unable to create the stack directory');
        }

        $composeFile = $folder . '/docker-compose.yml';
        file_put_contents($composeFile, rtrim($content) . PHP_EOL);
        file_put_contents($folder . '/name', $displayName);

        $projectName = preg_replace('/[^a-z0-9_-]+/i', '_', strtolower($displayName));
        $command = implode(' ', [
            escapeshellarg($this->composeScript),
            '-c',
            escapeshellarg('up'),
            '-p',
            escapeshellarg($projectName),
            '-f',
            escapeshellarg($composeFile),
        ]);
        $output = [];
        $exitCode = 0;
        exec($command . ' 2>&1', $output, $exitCode);
        if ($exitCode !== 0) {
            @unlink($composeFile);
            @unlink($folder . '/name');
            @rmdir($folder);
            throw new \RuntimeException(trim(implode("\n", $output)) ?: 'Compose deployment failed');
        }

        return ['name' => $displayName, 'folder' => $folderName, 'output' => implode("\n", $output)];
    }
}
