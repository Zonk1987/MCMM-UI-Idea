<?php

declare(strict_types=1);

$docroot = $_SERVER['DOCUMENT_ROOT'] ?: '/usr/local/emhttp';

ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

require_once "$docroot/plugins/compose.manager/php/defines.php";
require_once __DIR__ . '/lib/ComposeStackService.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new InvalidArgumentException('POST is required');
    }
    $service = new \Mcmm\Docker\ComposeStackService(
        $compose_root,
        $plugin_root . 'scripts/compose.sh'
    );
    $result = $service->deploy((string)($_POST['name'] ?? ''), (string)($_POST['content'] ?? ''));
    ob_end_clean();
    echo json_encode(['success' => true, 'stack' => $result], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
} catch (InvalidArgumentException|DomainException $error) {
    if (ob_get_level() > 0) ob_end_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    if (ob_get_level() > 0) ob_end_clean();
    http_response_code(500);
    error_log($error->getMessage());
    echo json_encode(['success' => false, 'error' => 'Unable to deploy Compose stack'], JSON_UNESCAPED_SLASHES);
}
