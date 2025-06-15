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

final class CertificateManager
{
    public function getPath(): string
    {
        $certFile = __DIR__ . '/../curl_cert/cacert.pem';
        if (!file_exists($certFile)) {
            throw new RuntimeException('Файл сертификатов не найден');
        }
        return $certFile;
    }
}

final class GgcDecoder
{
    private const CHAR_DECODER = [
        'u' => '0', 'z' => '1', 'p' => '2', 'k' => '3', 'f' => '4', 'a' => '5',
        '5' => '6', '0' => '7', 'v' => '8', 'q' => '9', 'l' => 'a', 'g' => 'b',
        'b' => 'c', '6' => 'd', '1' => 'e', 'w' => 'f', 'r' => 'g', 'm' => 'h',
        'h' => 'i', 'c' => 'j', '7' => 'k', '2' => 'l', 'x' => 'm', 's' => 'n',
        'n' => 'o', 'i' => 'p', 'd' => 'q', '8' => 'r', '3' => 's', 'y' => 't',
        't' => 'u', 'o' => 'v', 'j' => 'w', 'e' => 'x', '9' => 'y', '4' => 'z',
        '-' => '-',
    ];

    public function decodePrefix(string $prefix): ?string
    {
        $decoded = '';
        for ($i = 0; $i < strlen($prefix); $i++) {
            $char = $prefix[$i];
            if (!isset(self::CHAR_DECODER[$char])) {
                return null;
            }
            $decoded .= self::CHAR_DECODER[$char];
        }
        return $decoded;
    }
}

final class FirstServerHttpClient
{
    private const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    private const TIMEOUT = 5;
    private const CONNECT_TIMEOUT = 3;

    public function __construct(
        private CertificateManager $certManager
    ) {}

    public function request(string $url): string
    {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Не удалось инициализировать CURL');
        }

        $isHttps = strpos($url, 'https://') === 0;
        $options = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
            CURLOPT_USERAGENT => self::USER_AGENT,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_SSL_VERIFYPEER => $isHttps,
            CURLOPT_SSL_VERIFYHOST => $isHttps ? 2 : 0,
            CURLOPT_FAILONERROR => true,
            CURLOPT_FOLLOWLOCATION => true,
        ];

        if ($isHttps) {
            $options[CURLOPT_CAINFO] = $this->certManager->getPath();
        }

        curl_setopt_array($ch, $options);
        
        $response = curl_exec($ch);
        $error = curl_error($ch);
        $errno = curl_errno($ch);
        curl_close($ch);

        if ($response === false) {
            throw new RuntimeException("Ошибка сети: $error", $errno);
        }

        return $response;
    }
}

final class OtherServersHttpClient
{
    private const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0';
    private const TIMEOUT = 5;
    private const CONNECT_TIMEOUT = 3;

    public function __construct(
        private CertificateManager $certManager
    ) {}

    public function request(string $url, array $postData): string
    {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('Не удалось инициализировать CURL');
        }

        $jsonData = json_encode($postData);
        if ($jsonData === false) {
            throw new RuntimeException('Ошибка кодирования JSON: ' . json_last_error_msg());
        }

        $isHttps = strpos($url, 'https://') === 0;
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json, text/plain, */*',
                'Accept-Language: ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
                'Content-Type: application/json',
                'Origin: https://portchecker.io',
                'Content-Length: ' . strlen($jsonData),
            ],
            CURLOPT_POSTFIELDS => $jsonData,
            CURLOPT_TIMEOUT => self::TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
            CURLOPT_SSL_VERIFYPEER => $isHttps,
            CURLOPT_SSL_VERIFYHOST => $isHttps ? 2 : 0,
            CURLOPT_USERAGENT => self::USER_AGENT,
            CURLOPT_ENCODING => 'gzip, deflate',
            CURLOPT_REFERER => 'https://portchecker.io/',
        ];

        if ($isHttps) {
            $options[CURLOPT_CAINFO] = $this->certManager->getPath();
        }

        curl_setopt_array($ch, $options);
        
        $response = curl_exec($ch);
        $error = curl_error($ch);
        $errno = curl_errno($ch);
        curl_close($ch);

        if ($response === false) {
            throw new RuntimeException("Ошибка сети: $error", $errno);
        }

        return $response;
    }
}

final class FirstGgcDetector
{
    private const RESPONSE_PATTERN = '/=>\s*([a-z0-9\-]+)\b/';
    private const GGC_DOMAIN_TEMPLATE = 'https://rr1---sn-%s.googlevideo.com';

    public function __construct(
        private FirstServerHttpClient $httpClient,
        private GgcDecoder $decoder = new GgcDecoder()
    ) {}

    public function detectWithUrl(string $url): string
    {
        $response = $this->httpClient->request($url);
        
        if (empty($response)) {
            throw new RuntimeException('Получен пустой ответ от сервера Google');
        }

        if (preg_match(self::RESPONSE_PATTERN, $response, $matches)) {
            $prefix = trim($matches[1], '.: ');
            $converted = $this->decoder->decodePrefix($prefix);

            if ($converted === null || $converted === '') {
                throw new RuntimeException('Ошибка декодирования префикса: ' . $prefix);
            }
            return sprintf(self::GGC_DOMAIN_TEMPLATE, $converted);
        }

        throw new RuntimeException('Не удалось найти префикс в ответе');
    }
}

final class PortCheckerService
{
    private const API_URL = 'https://portchecker.io/api/query';
    
    public function __construct(
        private OtherServersHttpClient $httpClient
    ) {}

    public function checkPorts(string $host, array $ports): array
    {
        $postData = ['host' => $host, 'ports' => $ports];
        $response = $this->httpClient->request(self::API_URL, $postData);

        $data = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException("Ошибка формата ответа: " . json_last_error_msg());
        }

        $serverGGC = $data['host'] ?? '';
        $isAccessible = false;
        if (isset($data['check']) && is_array($data['check'])) {
            foreach ($data['check'] as $portCheck) {
                if (isset($portCheck['status']) && $portCheck['status'] === true) {
                    $isAccessible = true;
                    break;
                }
            }
        }

        $fullUrl = $isAccessible ? 'https://' . $serverGGC : '';

        return [
            'результат' => $isAccessible,
            'сервер_ggc' => $fullUrl
        ];
    }
}

final class RequestHandler
{
    private const SOURCE_URLS = [
        1 => 'https://redirector.gvt1.com/report_mapping?di=no',
        2 => 'http://redirector.c.googlevideo.com/report_mapping?di=no',
    ];

    public function __construct(
        private CertificateManager $certManager = new CertificateManager()
    ) {}

    public function handle(): array
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            throw new RuntimeException('Метод запроса должен быть GET', 405);
        }

        if (isset($_GET['first_ggc_link'])) {
            return $this->handleFirstGgcRequest();
        }

        if (isset($_GET['next_ggc_server']) && isset($_GET['prefix'])) {
            return $this->handleNextGgcRequest();
        }

        throw new RuntimeException('Неверные параметры запроса', 400);
    }

    private function handleFirstGgcRequest(): array
    {
        $linkType = (int)$_GET['first_ggc_link'];
        if (!isset(self::SOURCE_URLS[$linkType])) {
            throw new RuntimeException('Недопустимое значение параметра first_ggc_link', 400);
        }

        $httpClient = new FirstServerHttpClient($this->certManager);
        $detector = new FirstGgcDetector($httpClient);
        $domain = $detector->detectWithUrl(self::SOURCE_URLS[$linkType]);

        return [
            'результат' => true,
            'первый_сервер_ggc' => $domain,
        ];
    }

    private function handleNextGgcRequest(): array
    {
        $serverNumber = (int)$_GET['next_ggc_server'];
        $prefix = $_GET['prefix'];

        if ($serverNumber < 1) {
            throw new RuntimeException('Параметр next_ggc_server должен быть положительным числом', 400);
        }

        if (empty($prefix)) {
            throw new RuntimeException('Параметр prefix обязателен', 400);
        }

        $host = sprintf('rr%d---sn-%s.googlevideo.com', $serverNumber, $prefix);

        $httpClient = new OtherServersHttpClient($this->certManager);
        $service = new PortCheckerService($httpClient);
        
        return $service->checkPorts($host, [443]);
    }
}

try {
    $handler = new RequestHandler();
    $result = $handler->handle();
    
    http_response_code(200);
    echo json_encode(
        $result,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $e) {
    $statusCode = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
    http_response_code($statusCode);
    
    $response = ['результат' => false];
    if ($e->getCode() >= 400 && $e->getCode() < 500) {
        $response['сообщение'] = $e->getMessage();
    } else {
        $response['сообщение'] = 'Ошибка сервера: ' . $e->getMessage();
    }
    
    if (isset($_GET['next_ggc_server'])) {
        $response['сервер_ggc'] = '';
    }

    echo json_encode(
        $response,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}