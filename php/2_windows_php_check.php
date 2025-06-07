<?php
//2_windows_php_check.php
declare(strict_types=1);
set_time_limit(60);
ini_set('display_errors', '0');
error_reporting(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");
header("Cache-Control: no-store, no-cache, must-revalidate");
header("Pragma: no-cache");
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

final class WindowsPhpFeatureChecker
{
    private ?array $disabledFunctions = null;

    public function checkPhpVersion(): bool
    {
        try {
            return version_compare(PHP_VERSION, '8.0.0', '>=');
        } catch (Throwable $e) {
            return false;
        }
    }

    public function checkCurlExtension(): bool
    {
        return $this->isExtensionLoaded('curl');
    }

    public function checkComDotnetExtension(): bool
    {
        return $this->isExtensionLoaded('com_dotnet');
    }

    public function checkComClassExists(): bool
    {
        try {
            return class_exists('COM');
        } catch (Throwable $e) {
            return false;
        }
    }

    public function checkWmiConnection(): bool
    {
        try {
            if (!$this->checkComDotnetExtension() || !$this->checkComClassExists()) {
                return false;
            }

            return $this->tryWmiConnection('root\\StandardCimv2')
                || $this->tryWmiConnection('root\\cimv2');
        } catch (Throwable $e) {
            return false;
        }
    }

    private function isFunctionEnabled(string $function): bool
    {
        try {
            return function_exists($function) && !in_array($function, $this->getDisabledFunctions(), true);
        } catch (Throwable $e) {
            return false;
        }
    }

    private function isExtensionLoaded(string $extension): bool
    {
        try {
            return extension_loaded($extension);
        } catch (Throwable $e) {
            return false;
        }
    }

    private function getDisabledFunctions(): array
    {
        if ($this->disabledFunctions === null) {
            try {
                $disabled = ini_get('disable_functions') ?: '';
                $this->disabledFunctions = array_map('trim', explode(',', $disabled));
            } catch (Throwable $e) {
                $this->disabledFunctions = [];
            }
        }
        return $this->disabledFunctions;
    }

    private function tryWmiConnection(string $namespace): bool
    {
        try {
            $wmi = new COM("WinMgmts:\\\\.\\{$namespace}");
            return is_object($wmi);
        } catch (Throwable $e) {
            return false;
        }
    }

    public function checkFunctions(): array
    {
        $functions = [
            'file_get_contents',
            'file_put_contents',
            'file',
        ];

        $results = [];
        foreach ($functions as $function) {
            $results[$function] = $this->isFunctionEnabled($function);
        }

        return $results;
    }

    public function getCheckResults(): array
    {
        $mainResults = [
            'php_версия_>=8.0' => $this->checkPhpVersion(),
            'curl_расширение' => $this->checkCurlExtension(),
            'com_dotnet_расширение' => $this->checkComDotnetExtension(),
            'com_класс_существует' => $this->checkComClassExists(),
            'wmi_подключение' => $this->checkWmiConnection(),
        ];

        $functions = $this->checkFunctions();

        return array_merge($mainResults, $functions);
    }
}

try {
    $checker = new WindowsPhpFeatureChecker();
    http_response_code(200);
    echo json_encode(
        [
            'результат' => true,
            'php' => $checker->getCheckResults()
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(
        [
            'результат' => false,
            'сообщение' => $e->getMessage(),
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}