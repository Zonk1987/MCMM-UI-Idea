<?php

declare(strict_types=1);

namespace Mcmm\Docker;

final class ContainerSizeRepository
{
    public function __construct(private readonly \DockerClient $dockerClient)
    {
    }

    public function find(array $containerIds): array
    {
        $sizes = [];
        foreach ($containerIds as $containerId) {
            $details = $this->dockerClient->getDockerJSON("/containers/$containerId/json?size=1");
            $sizes[$containerId] = [
                'writable' => max(0, (int)($details['SizeRw'] ?? 0)),
                'root' => max(0, (int)($details['SizeRootFs'] ?? 0)),
            ];
        }
        return $sizes;
    }
}
