<?php

declare(strict_types=1);

$docroot = $_SERVER['DOCUMENT_ROOT'] ?: '/usr/local/emhttp';

ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

try {
    require_once "$docroot/plugins/dynamix.docker.manager/include/DockerClient.php";
    require_once __DIR__ . '/lib/MinecraftContentService.php';
    $service = new \Mcmm\Minecraft\MinecraftContentService(new \DockerClient());
    $action = (string)($_REQUEST['action'] ?? 'inventory');
    $containerId = (string)($_REQUEST['containerId'] ?? '');
    $result = match ($action) {
        'inventory' => $service->inventory($containerId),
        'install' => $_SERVER['REQUEST_METHOD'] === 'POST'
            ? $service->install(
                $containerId,
                (string)($_POST['type'] ?? ''),
                (string)($_POST['fileName'] ?? ''),
                (string)($_POST['url'] ?? ''),
                (string)($_POST['sha512'] ?? ''),
                filter_var($_POST['overwrite'] ?? false, FILTER_VALIDATE_BOOLEAN)
            )
            : throw new \InvalidArgumentException('POST is required'),
        default => throw new \InvalidArgumentException('Unsupported Minecraft content action'),
    };
    ob_end_clean();
    echo json_encode(
        ['success' => true, 'result' => $result],
        JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (\Mcmm\Minecraft\MinecraftContentConflictException $error) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(409);
    echo json_encode(['success' => false, 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES);
} catch (\InvalidArgumentException|\DomainException $error) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES);
} catch (\Throwable $error) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(500);
    error_log('MCMM Minecraft content error: ' . $error->getMessage());
    echo json_encode(['success' => false, 'error' => 'The Minecraft content service encountered an internal error.']);
}
