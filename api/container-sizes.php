<?php

declare(strict_types=1);

$docroot = $_SERVER['DOCUMENT_ROOT'] ?: '/usr/local/emhttp';

ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

require_once "$docroot/plugins/dynamix.docker.manager/include/DockerClient.php";
require_once __DIR__ . '/lib/ContainerSizeRepository.php';

try {
    $containerIds = array_values(array_filter(explode(',', (string)($_GET['ids'] ?? ''))));
    if ($containerIds === [] || count($containerIds) > 250) {
        throw new InvalidArgumentException('Invalid container identifiers');
    }
    foreach ($containerIds as $containerId) {
        if (!preg_match('/^[a-f0-9]{12,64}$/i', $containerId)) {
            throw new InvalidArgumentException('Invalid container identifier');
        }
    }

    $repository = new \Mcmm\Docker\ContainerSizeRepository(new \DockerClient());
    $sizes = $repository->find($containerIds);
    ob_end_clean();
    echo json_encode(['sizes' => $sizes], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
} catch (InvalidArgumentException $error) {
    if (ob_get_level() > 0) ob_end_clean();
    http_response_code(400);
    echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    if (ob_get_level() > 0) ob_end_clean();
    http_response_code(500);
    error_log($error->getMessage());
    echo json_encode(['error' => 'Unable to load container sizes'], JSON_UNESCAPED_SLASHES);
}
