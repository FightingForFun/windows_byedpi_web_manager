<?php
// 9_save_latest_used_strategy.php
declare(strict_types=1);
set_time_limit(60);
ini_set('display_errors', '0');
error_reporting(0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    header('Content-Length: 0');
    exit;
}

final class RequestValidator
{
    public function validate(): array
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            throw new RuntimeException('Метод запроса должен быть POST', 405);
        }

        $json = file_get_contents('php://input');
        if ($json === false || $json === '') {
            throw new RuntimeException('Пустое тело запроса', 400);
        }

        $data = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('Неверный формат JSON: ' . json_last_error_msg(), 400);
        }

        if (!isset($data['ciadpi_для_использования']) || !is_array($data['ciadpi_для_использования']) || empty($data['ciadpi_для_использования'])) {
            throw new RuntimeException('Неверная или пустая секция "ciadpi_для_использования"', 400);
        }

        $processes = [];
        foreach ($data['ciadpi_для_использования'] as $name => $process) {
            if (!preg_match('/^процесс_(\d+)$/', $name, $matches) || (int)$matches[1] < 1 || (int)$matches[1] > 8) {
                throw new RuntimeException("Неверный процесс: $name", 400);
            }
            if (!isset($process['последняя_используемая_стратегия']) || trim($process['последняя_используемая_стратегия']) === '') {
                throw new RuntimeException("Отсутствует или пустая стратегия для $name", 400);
            }
            $processes[(int)$matches[1]] = trim($process['последняя_используемая_стратегия']);
        }

        return $processes;
    }
}

final class ConfigUpdater
{
    public function update(array $strategies): void
    {
        $configFile = __DIR__ . '/../config.json';

        if (!file_exists($configFile)) {
            throw new RuntimeException("Файл конфигурации не найден: $configFile", 500);
        }

        if (!is_readable($configFile)) {
            throw new RuntimeException("Нет прав на чтение файла: $configFile", 500);
        }

        $content = file_get_contents($configFile);
        if ($content === false) {
            throw new RuntimeException('Не удалось прочитать конфигурацию', 500);
        }

        if (!is_writable($configFile)) {
            throw new RuntimeException("Нет прав на запись в файл: $configFile", 500);
        }

        $config = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE || !isset($config['ciadpi_для_использования'])) {
            throw new RuntimeException('Неверный формат конфигурации', 500);
        }

        foreach ($strategies as $num => $strategy) {
            $key = "процесс_$num";
            $config['ciadpi_для_использования'][$key]['последняя_используемая_стратегия'] = $strategy;
        }

        $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new RuntimeException('Ошибка при кодировании конфигурации', 500);
        }

        if (file_put_contents($configFile, $json, LOCK_EX) === false) {
            throw new RuntimeException('Не удалось сохранить конфигурацию', 500);
        }
    }
}

try {
    $validator = new RequestValidator();
    $strategies = $validator->validate();

    $updater = new ConfigUpdater();
    $updater->update($strategies);

    http_response_code(200);
    echo json_encode(
        [
            'результат' => true,
            'сообщение' => "Стратегия успешно обновлена",
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $e) {
    http_response_code($e->getCode() ?: 500);
    echo json_encode(
        [
            'результат' => false,
            'сообщение' => $e->getMessage(),
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}