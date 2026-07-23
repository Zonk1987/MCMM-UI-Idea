<?php

declare(strict_types=1);

namespace Mcmm\Docker;

final class DockerStatsRepository
{
    public function all(): array
    {
        $lines = [];
        $exitCode = 0;
        exec("docker stats --no-stream --no-trunc --format '{{json .}}' 2>/dev/null", $lines, $exitCode);
        if ($exitCode !== 0) {
            return [];
        }

        $stats = [];
        foreach ($lines as $line) {
            $entry = json_decode($line, true);
            $name = is_array($entry) ? (string)($entry['Name'] ?? '') : '';
            if ($name === '') {
                continue;
            }
            $memory = trim(explode('/', (string)($entry['MemUsage'] ?? '0B'))[0]);
            $stats[$name] = [
                'cpu' => (float)rtrim((string)($entry['CPUPerc'] ?? '0'), '%'),
                'ram' => round($this->bytes($memory) / 1048576, 2),
            ];
        }

        return $stats;
    }

    private function bytes(string $value): float
    {
        if (!preg_match('/^([0-9.]+)\s*([kmgt]?i?b)$/i', trim($value), $matches)) {
            return 0;
        }

        $units = [
            'b' => 1,
            'kb' => 1000,
            'kib' => 1024,
            'mb' => 1000000,
            'mib' => 1048576,
            'gb' => 1000000000,
            'gib' => 1073741824,
            'tb' => 1000000000000,
            'tib' => 1099511627776,
        ];

        return (float)$matches[1] * ($units[strtolower($matches[2])] ?? 1);
    }
}
