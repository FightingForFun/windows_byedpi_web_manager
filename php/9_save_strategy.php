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

const PROCESS_PATTERN = '/^процесс_(\d+)$/';
const MIN_PROCESS = 1;
const MAX_PROCESS = 8;
const CONFIG_FILE = __DIR__ . '/../config.json';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        header('Content-Length: 0');
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new InvalidArgumentException('Метод запроса должен быть POST', 405);
    }
    $json = file_get_contents('php://input');
    if ($json === false || trim($json) === '') {
        throw new InvalidArgumentException('Тело запроса пустое или не удалось прочитать', 400);
    }
    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new InvalidArgumentException('Неверный формат JSON: ' . json_last_error_msg(), 400);
    }
    if (!is_array($data)) {
        throw new InvalidArgumentException('Данные должны быть массивом', 400);
    }
    if (!isset($data['ciadpi_для_использования']) || !is_array($data['ciadpi_для_использования'])) {
        throw new InvalidArgumentException('Отсутствует или неверный ключ ciadpi_для_использования', 400);
    }
    if (count($data['ciadpi_для_использования']) !== 1) {
        throw new InvalidArgumentException('Должен быть указан ровно один процесс', 400);
    }
    $processName = key($data['ciadpi_для_использования']);
    $processData = current($data['ciadpi_для_использования']);
    if (!preg_match(PROCESS_PATTERN, $processName, $matches)) {
        throw new InvalidArgumentException("Неверный формат имени процесса: $processName", 400);
    }
    $processNum = (int)$matches[1];
    if ($processNum < MIN_PROCESS || $processNum > MAX_PROCESS) {
        throw new RangeException("Номер процесса $processNum вне диапазона (" . MIN_PROCESS . "-" . MAX_PROCESS . ")", 400);
    }
    if (!isset($processData['последняя_используемая_стратегия']) || !is_string($processData['последняя_используемая_стратегия'])) {
        throw new InvalidArgumentException("Отсутствует или неверный тип стратегии для процесса $processName", 400);
    }
    
    $strategy = trim($processData['последняя_используемая_стратегия']);
    
    if (!file_exists(CONFIG_FILE)) {
        throw new RuntimeException('Файл конфигурации config.json не найден', 404);
    }
    if (!is_readable(CONFIG_FILE) || !is_writable(CONFIG_FILE)) {
        throw new RuntimeException('Нет прав доступа к файлу config.json', 403);
    }
    $configContent = file_get_contents(CONFIG_FILE);
    if ($configContent === false) {
        throw new RuntimeException('Не удалось прочитать файл config.json', 500);
    }
    $config = json_decode($configContent, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException('Неверный формат файла config.json: ' . json_last_error_msg(), 500);
    }
    $config['ciadpi_для_использования'][$processName]['последняя_используемая_стратегия'] = $strategy;
    $newConfigContent = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($newConfigContent === false) {
        throw new RuntimeException('Ошибка кодирования данных в JSON', 500);
    }
    if (file_put_contents(CONFIG_FILE, $newConfigContent, LOCK_EX) === false) {
        throw new RuntimeException('Не удалось записать данные в config.json', 500);
    }
    http_response_code(200);
    echo json_encode(
        [
            'результат' => true,
            'сообщение' => 'Стратегия успешно сохранена'
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $e) {
    $code = $e->getCode() >= 400 && $e->getCode() <= 599 ? $e->getCode() : 500;
    http_response_code($code);
    echo json_encode(
        [
            'результат' => false,
            'сообщение' => $e->getMessage()
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}