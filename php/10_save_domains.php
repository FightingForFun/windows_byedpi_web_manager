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
const DOMAIN_PATTERN = '/^([a-z0-9\-]+\.)+[a-z0-9\-]{2,}$/';
const MIN_PROCESS = 1;
const MAX_PROCESS = 8;
const PAC_FILE = __DIR__ . '/../local.pac';
const PAC_PATTERN = '/var servers = (\[[\s\S]*?\]);/';
const HOSTS_DIR = __DIR__ . '/../byedpi';
const FILE_PERMISSIONS = 0755;

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
        throw new InvalidArgumentException('Тело запроса пустое', 400);
    }

    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new InvalidArgumentException('Неверный формат JSON: ' . json_last_error_msg(), 400);
    }

    if (!is_array($data)) {
        throw new InvalidArgumentException('Некорректная структура данных', 400);
    }

    if (!isset($data['ciadpi_для_использования']) || !is_array($data['ciadpi_для_использования'])) {
        throw new InvalidArgumentException('Отсутствует ключ ciadpi_для_использования', 400);
    }

    if (count($data['ciadpi_для_использования']) !== 1) {
        throw new InvalidArgumentException('Должен быть указан один процесс', 400);
    }

    $processName = key($data['ciadpi_для_использования']);
    $processData = current($data['ciadpi_для_использования']);

    if (!preg_match(PROCESS_PATTERN, $processName)) {
        throw new InvalidArgumentException('Неверный формат имени процесса', 400);
    }

    preg_match(PROCESS_PATTERN, $processName, $matches);
    $processNum = (int)($matches[1] ?? 0);
    if ($processNum < MIN_PROCESS || $processNum > MAX_PROCESS) {
        throw new RangeException("Номер процесса вне диапазона (" . MIN_PROCESS . "-" . MAX_PROCESS . ")", 400);
    }

    if (!isset($processData['домены']) || !is_array($processData['домены'])) {
        throw new InvalidArgumentException('Отсутствует массив доменов', 400);
    }

    $cleanedDomains = [];
    foreach ($processData['домены'] as $domain) {
        if (!is_string($domain)) {
            throw new InvalidArgumentException('Домен должен быть строкой', 400);
        }

        $clean = strtolower(trim($domain));
        if ($clean === '') continue;

        if (!preg_match(DOMAIN_PATTERN, $clean)) {
            throw new InvalidArgumentException("Некорректный формат домена: $clean", 400);
        }

        $cleanedDomains[] = $clean;
    }
    $domains = array_unique($cleanedDomains);

    if (!file_exists(PAC_FILE)) {
        throw new RuntimeException('Файл local.pac не найден', 404);
    }

    if (!is_readable(PAC_FILE) || !is_writable(PAC_FILE)) {
        throw new RuntimeException('Нет прав доступа к файлу local.pac', 403);
    }

    $pacContent = file_get_contents(PAC_FILE);
    if ($pacContent === false) {
        throw new RuntimeException('Не удалось прочитать файл local.pac', 500);
    }

    if (!preg_match(PAC_PATTERN, $pacContent, $matches)) {
        throw new RuntimeException('Не найден массив серверов в PAC-файле', 500);
    }

    $servers = json_decode($matches[1], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException('Неверный формат PAC-файла: ' . json_last_error_msg(), 500);
    }

    $index = $processNum - 1;
    if (!isset($servers[$index])) {
        throw new OutOfBoundsException("Неверный индекс сервера: $index", 500);
    }

    $servers[$index]['domains'] = $domains;

    $jsonServers = json_encode(
        $servers,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    if ($jsonServers === false) {
        throw new RuntimeException('Ошибка при кодировании JSON', 500);
    }

    $newPacContent = preg_replace(PAC_PATTERN, 'var servers = ' . $jsonServers . ';', $pacContent);
    if ($newPacContent === null) {
        throw new RuntimeException('Ошибка при замене содержимого PAC-файла', 500);
    }

    if (file_put_contents(PAC_FILE, $newPacContent, LOCK_EX) === false) {
        throw new RuntimeException('Не удалось записать данные в PAC-файл', 500);
    }

    $hostsFile = HOSTS_DIR . "/main_server_{$processNum}_hosts.txt";
    $hostsDir = dirname($hostsFile);

    if (!is_dir($hostsDir)) {
        if (!mkdir($hostsDir, FILE_PERMISSIONS, true) && !is_dir($hostsDir)) {
            throw new RuntimeException("Не удалось создать директорию: $hostsDir", 500);
        }
    }

    $hostsContent = implode("\n", $domains);
    if (file_put_contents($hostsFile, $hostsContent, LOCK_EX) === false) {
        throw new RuntimeException("Не удалось записать файл: $hostsFile", 500);
    }

    http_response_code(200);
    echo json_encode(
        [
            'результат' => true,
            'сообщение' => 'Домены успешно сохранены'
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $e) {
    $code = $e->getCode() ?: 500;
    if ($code < 400 || $code > 599) $code = 500;

    http_response_code($code);
    echo json_encode(
        [
            'результат' => false,
            'сообщение' => 'Ошибка сервера: ' . $e->getMessage()
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}