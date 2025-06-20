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

final class RequestValidator
{
    private const REQUIRED_KEYS = [
        'socks5_server_ip', 'socks5_server_port', 'curl_connection_timeout',
        'curl_max_timeout', 'curl_http_method', 'curl_http_version',
        'curl_tls_version', 'curl_user_agent', 'link', 'curl-check-connection',
		'curl_followlocation', 'curl_ssl_verifypeer', 'curl_ssl_verifyhost'
    ];

    public function validate(string $rawInput): array
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            throw new RuntimeException('Метод запроса должен быть POST', 405);
        }
        if (trim($rawInput) === '') {
            throw new RuntimeException('Пустое тело запроса', 400);
        }
        $data = json_decode($rawInput, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('Неверный формат JSON: ' . json_last_error_msg(), 400);
        }
        if (!is_array($data)) {
            throw new RuntimeException('Данные должны быть объектом JSON', 400);
        }
        foreach (self::REQUIRED_KEYS as $key) {
            if (!array_key_exists($key, $data)) {
                throw new RuntimeException("Отсутствует ключ: $key", 400);
            }
        }
        $this->validateSocksIp($data['socks5_server_ip']);
        $this->validateNumeric($data['socks5_server_port'], 1, 65535, 'порт SOCKS5');
        $this->validateNumeric($data['curl_connection_timeout'], 1, 5, 'таймаут соединения');
        $this->validateNumeric($data['curl_max_timeout'], 1, 10, 'максимальный таймаут');
        $this->validateHttpMethod($data['curl_http_method']);
        $this->validateHttpVersion($data['curl_http_version']);
        $this->validateTlsVersion($data['curl_tls_version']);
        $this->validateNumeric($data['curl_user_agent'], 1, 5, 'идентификатор User-Agent');
        $this->validateLink($data['link']);
        $this->validateNumeric($data['curl-check-connection'], 1, 5, 'количество соединений');
		$this->validateBoolean($data['curl_followlocation'], 'curl_followlocation');
		$this->validateBoolean($data['curl_ssl_verifypeer'], 'curl_ssl_verifypeer');
		$this->validateVerifyHost($data['curl_ssl_verifyhost']);
        return $data;
    }

    private function validateSocksIp(mixed &$value): void
    {
        if (!is_string($value)) {
            throw new RuntimeException('socks5_server_ip должен быть строкой', 400);
        }
        if ($value === '0.0.0.0') {
            $value = '127.0.0.1';
        }
        if (!filter_var($value, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            throw new RuntimeException('Недопустимый IP-адрес для SOCKS5', 400);
        }
    }

    private function validateNumeric(mixed $value, int $min, int $max, string $name): void
    {
        if (!is_numeric($value) || ($value = (int)$value) < $min || $value > $max) {
            throw new RuntimeException("Неверное значение $name ($min-$max)", 400);
        }
    }

    private function validateHttpMethod(mixed $value): void
    {
        if (!is_string($value) || !in_array(strtoupper($value), ['GET', 'HEAD', 'POST'], true)) {
            throw new RuntimeException('Недопустимый HTTP метод', 400);
        }
    }

    private function validateHttpVersion(mixed $value): void
    {
        $validVersions = ['default', 'http1-0', 'http1-1', 'http2'];
        if (!is_string($value) || !in_array($value, $validVersions, true)) {
            throw new RuntimeException('Недопустимая версия HTTP', 400);
        }
    }

    private function validateTlsVersion(mixed $value): void
    {
        $validVersions = ['default', 'tls1-2', 'tls1-3'];
        if (!is_string($value) || !in_array($value, $validVersions, true)) {
            throw new RuntimeException('Недопустимая версия TLS', 400);
        }
    }
	
    private function validateBoolean(mixed &$value, string $name): void
    {
        if (!is_string($value) || !in_array($value, ['true', 'false'], true)) {
            throw new RuntimeException("Недопустимое значение $name", 400);
        }
        $value = $value === 'true';
    }

    private function validateVerifyHost(mixed &$value): void
    {
        if (!is_string($value) || !in_array($value, ['0', '2'], true)) {
            throw new RuntimeException('Недопустимое значение curl_ssl_verifyhost', 400);
        }
        $value = (int)$value;
    }	

    private function validateLink(mixed &$value): void
    {
        if (!is_string($value)) {
            throw new RuntimeException('URL должен быть строкой', 400);
        }
        if (strlen($value) > 2000) {
            throw new RuntimeException('URL слишком длинный', 400);
        }
        if (!preg_match('#^https?://#i', $value)) {
            $value = 'https://' . $value;
        }
        if (!filter_var($value, FILTER_VALIDATE_URL)) {
            throw new RuntimeException('Недопустимый URL', 400);
        }
    }
}

final class CurlExecutor
{
    private const USER_AGENTS = [
        1 => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
        2 => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
        3 => 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.135 Mobile Safari/537.36',
        4 => 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
        5 => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
    ];

public function performRequestWithRetries(array $data, int $maxAttempts): array
{
    $responses = [];
    
    $response = $this->execute($data);
    $responses[] = $response;
    
    for ($i = 1; $i < $maxAttempts; $i++) {
        if ($response['код_ответа_http'] === '000') {
            break;
        }
        
        sleep(1);
        
        $response = $this->execute($data);
        $responses[] = $response;
    }
    
    return $response;
}

    public function execute(array $data): array
    {
        $certPath = $this->getCertificatePath();
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Ошибка инициализации CURL', 500);
        }
        try {
            $httpVersion = match ($data['curl_http_version']) {
                'http1-0' => CURL_HTTP_VERSION_1_0,
                'http1-1' => CURL_HTTP_VERSION_1_1,
                'http2' => CURL_HTTP_VERSION_2,
                default => null
            };
            $tlsVersion = match ($data['curl_tls_version']) {
                'tls1-2' => defined('CURL_SSLVERSION_TLSv1_2') && defined('CURL_SSLVERSION_MAX_TLSv1_2')
                    ? CURL_SSLVERSION_TLSv1_2 | CURL_SSLVERSION_MAX_TLSv1_2
                    : throw new RuntimeException('CURL не поддерживает TLS 1.2', 500),
                'tls1-3' => defined('CURL_SSLVERSION_TLSv1_3') && defined('CURL_SSLVERSION_MAX_TLSv1_3')
                    ? CURL_SSLVERSION_TLSv1_3 | CURL_SSLVERSION_MAX_TLSv1_3
                    : throw new RuntimeException('CURL не поддерживает TLS 1.3', 500),
                default => null
            };
            $userAgent = $this->getUserAgent((int)$data['curl_user_agent']);
            $curlOptions = [
                CURLOPT_URL => $data['link'],
                CURLOPT_PROXY => "{$data['socks5_server_ip']}:{$data['socks5_server_port']}",
                CURLOPT_PROXYTYPE => CURLPROXY_SOCKS5_HOSTNAME,
                CURLOPT_CONNECTTIMEOUT => (int)$data['curl_connection_timeout'],
                CURLOPT_TIMEOUT => (int)$data['curl_max_timeout'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HEADER => true,
                CURLOPT_SSL_VERIFYPEER => $data['curl_ssl_verifypeer'],
                CURLOPT_SSL_VERIFYHOST => $data['curl_ssl_verifyhost'],
                CURLOPT_CAINFO => $certPath,
                CURLOPT_USERAGENT => $userAgent,
                CURLOPT_FOLLOWLOCATION => $data['curl_followlocation'],
                CURLOPT_MAXREDIRS => 5,
                CURLOPT_NOBODY => strtoupper($data['curl_http_method']) === 'HEAD',
                CURLOPT_POST => strtoupper($data['curl_http_method']) === 'POST',
            ];

            if (strtoupper($data['curl_http_method']) === 'POST') {
                $curlOptions[CURLOPT_POSTFIELDS] = 'HELLO';
            }
            if ($httpVersion !== null) {
                $curlOptions[CURLOPT_HTTP_VERSION] = $httpVersion;
            }
            if ($tlsVersion !== null) {
                $curlOptions[CURLOPT_SSLVERSION] = $tlsVersion;
            }
            curl_setopt_array($ch, $curlOptions);
            $response = curl_exec($ch);
            if ($response === false) {
                return [
                    'результат' => false,
                    'сообщение' => curl_error($ch),
                    'код_ошибки' => curl_errno($ch),
                    'код_ответа_http' => '000',
                    'ссылка' => $data['link']
                ];
            }
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            return [
                'результат' => true,
                'сообщение' => 'Успешный запрос',
                'код_ответа_http' => (string)$httpCode,
                'ссылка' => $data['link']
            ];
        } finally {
            curl_close($ch);
        }
    }

    private function getUserAgent(int $id): string
    {
        if (!isset(self::USER_AGENTS[$id])) {
            throw new RuntimeException("Неверный идентификатор User-Agent: $id", 400);
        }
        return self::USER_AGENTS[$id];
    }

    private function getCertificatePath(): string
    {
        $certFile = __DIR__ . '/../curl_cert/cacert.pem';
        if (!file_exists($certFile)) {
            throw new RuntimeException('Файл сертификатов не найден', 500);
        }
        return $certFile;
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    $rawInput = file_get_contents('php://input') ?: '';
    $validator = new RequestValidator();
    $data = $validator->validate($rawInput);
    $executor = new CurlExecutor();
    $response = $executor->performRequestWithRetries($data, (int)$data['curl-check-connection']);
    http_response_code(200);
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    $link = 'unknown';
    if (!empty($rawInput)) {
        $decoded = json_decode($rawInput, true);
        if (is_array($decoded) && isset($decoded['link']) && is_string($decoded['link'])) {
            $link = $decoded['link'];
        }
    }
    $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
    http_response_code($code);
    echo json_encode(
        [
            'результат' => false,
            'сообщение' => $e->getMessage(),
            'код_ответа_http' => '000',
            'ссылка' => $link
        ],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}