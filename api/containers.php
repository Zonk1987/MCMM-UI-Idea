<?php

declare(strict_types=1);

$docroot = $_SERVER['DOCUMENT_ROOT'] ?? '/usr/local/emhttp';
$docroot = $docroot !== '' ? $docroot : '/usr/local/emhttp';

ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

try {
    require_once "$docroot/plugins/dynamix.docker.manager/include/DockerClient.php";
    require_once __DIR__ . '/lib/DockerStatsRepository.php';
    require_once __DIR__ . '/lib/GameServerDetector.php';
    require_once __DIR__ . '/lib/ContainerRepository.php';
    $repository = new \Mcmm\Docker\ContainerRepository(
        new \DockerClient(),
        new \Mcmm\Docker\DockerStatsRepository(),
        new \Mcmm\Docker\GameServerDetector()
    );
    $containers = $repository->all();
    ob_end_clean();
    echo json_encode(
        [
            'containers' => $containers,
            'generatedAt' => gmdate(DATE_ATOM),
        ],
        JSON_THROW_ON_ERROR
            | JSON_INVALID_UTF8_SUBSTITUTE
            | JSON_UNESCAPED_SLASHES
            | JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $error) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(500);
    $errorId = bin2hex(random_bytes(4));
    error_log(sprintf('MCMM containers %s: %s: %s', $errorId, $error::class, $error->getMessage()));
    echo json_encode(
        [
            'error' => 'Unable to load Docker containers',
            'detail' => $error->getMessage(),
            'errorId' => $errorId,
        ],
        JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_SLASHES
    );
}
