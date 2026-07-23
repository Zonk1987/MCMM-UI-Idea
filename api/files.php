<?php

declare(strict_types=1);

$docroot = $_SERVER['DOCUMENT_ROOT'] ?: '/usr/local/emhttp';

ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

$completed = false;

register_shutdown_function(static function () use (&$completed): void {
    if ($completed) {
        return;
    }
    $error = error_get_last();
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if ($error === null || !in_array($error['type'], $fatalTypes, true)) {
        return;
    }
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    error_log('MCMM file service fatal error: ' . $error['message']);
    echo json_encode(['success' => false, 'error' => 'The file service encountered an internal error.']);
});

try {
    require_once "$docroot/plugins/dynamix.docker.manager/include/DockerClient.php";
    require_once __DIR__ . '/lib/GameServerFileService.php';
    $service = new \Mcmm\Docker\GameServerFileService(new \DockerClient());
    $action = (string)($_REQUEST['action'] ?? 'list');
    $containerId = (string)($_REQUEST['containerId'] ?? '');
    $path = (string)($_REQUEST['path'] ?? '');
    $root = (string)($_REQUEST['root'] ?? '');

    if ($action === 'download') {
        $file = $service->download($containerId, $path, $root);
        $downloadName = str_replace(["\r", "\n"], '', $file['name']);
        ob_end_clean();
        header('Content-Type: application/octet-stream');
        header('Content-Length: ' . $file['size']);
        header('Content-Disposition: attachment; filename="' . addcslashes($downloadName, '"\\') . '"');
        $completed = true;
        readfile($file['path']);
        exit;
    }

    $isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
    $result = match ($action) {
        'list' => $service->listing($containerId, $path, $root),
        'read' => $service->read($containerId, $path, $root),
        'write' => $isPost
            ? $service->write(
                $containerId,
                $path,
                (string)($_POST['content'] ?? ''),
                (string)($_POST['expectedModified'] ?? ''),
                $root
            )
            : throw new \InvalidArgumentException('POST is required'),
        'upload' => $isPost
            ? $service->upload(
                $containerId,
                $path,
                $_FILES['file'] ?? [],
                filter_var($_POST['overwrite'] ?? false, FILTER_VALIDATE_BOOLEAN),
                $root
            )
            : throw new \InvalidArgumentException('POST is required'),
        'create-file' => $isPost
            ? $service->createFile($containerId, $path, (string)($_POST['name'] ?? ''), $root)
            : throw new \InvalidArgumentException('POST is required'),
        'create-directory' => $isPost
            ? $service->createDirectory($containerId, $path, (string)($_POST['name'] ?? ''), $root)
            : throw new \InvalidArgumentException('POST is required'),
        'rename' => $isPost
            ? $service->rename($containerId, $path, (string)($_POST['name'] ?? ''), $root)
            : throw new \InvalidArgumentException('POST is required'),
        'delete' => $isPost
            ? $service->delete(
                $containerId,
                $path,
                filter_var($_POST['recursive'] ?? false, FILTER_VALIDATE_BOOLEAN),
                $root
            )
            : throw new \InvalidArgumentException('POST is required'),
        default => throw new \InvalidArgumentException('Unsupported file action'),
    };

    ob_end_clean();
    $completed = true;
    echo json_encode(
        ['success' => true, 'result' => $result],
        JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (\Mcmm\Docker\FileConflictException $error) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(409);
    $completed = true;
    echo json_encode(['success' => false, 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES);
} catch (\InvalidArgumentException|\DomainException $error) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(400);
    $completed = true;
    echo json_encode(['success' => false, 'error' => $error->getMessage()], JSON_UNESCAPED_SLASHES);
} catch (\Throwable $error) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(500);
    error_log('MCMM file service error: ' . $error->getMessage());
    $completed = true;
    echo json_encode(['success' => false, 'error' => 'The file service encountered an internal error.']);
}
