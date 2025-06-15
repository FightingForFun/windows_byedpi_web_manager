<?php
declare(strict_types=1);
set_time_limit(60);
ini_set('display_errors', '0');
error_reporting(0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

final class OsDetector
{
    private const SUPPORTED_OS = ['windows'];

    public function detect(): string
    {
        $os = strtolower(PHP_OS_FAMILY);
        return in_array($os, self::SUPPORTED_OS, true) ? $os : 'не поддерживается';
    }

    public function getResult(): array
    {
        $os = $this->detect();
        return [
            'результат' => $os === 'windows',
            'операционная_система' => $os
        ];
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new RuntimeException('Недопустимый метод запроса');
    }

    $detector = new OsDetector();
    http_response_code(200);
    echo json_encode(
        $detector->getResult(),
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(
        [
            'результат' => false,
            'сообщение' => 'Ошибка сервера: ' . $e->getMessage()
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}