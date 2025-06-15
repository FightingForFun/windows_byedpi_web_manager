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

function sendJsonResponse(array $response, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

final class WindowsProcessManager
{
    public function isPortInUse(int $port): array
    {
        if ($port < 1 || $port > 65535) {
            return ['ошибка' => 'Неверный номер порта'];
        }
        try {
            $wmi = new COM('WinMgmts:\\\\.\\root\\StandardCimv2');
            if (!is_object($wmi)) {
                return ['ошибка' => 'Не удалось создать WMI-объект для проверки порта'];
            }
            $query = "SELECT * FROM MSFT_NetTCPConnection WHERE LocalPort = $port AND State = 2";
            $connections = $wmi->ExecQuery($query);
            return ['используется' => $connections->Count > 0];
        } catch (Exception $e) {
            return ['ошибка' => 'Ошибка проверки порта: ' . $e->getMessage()];
        }
    }

    public function findProcess(int $port, string $realFilePath): array
    {
        if ($port < 1 || $port > 65535) {
            return ['ошибка' => 'Неверный номер порта'];
        }
        if (empty($realFilePath)) {
            return ['ошибка' => 'Путь не может быть пустым'];
        }
        if (!class_exists('COM')) {
            return ['ошибка' => 'COM-расширение недоступно'];
        }
        $absoluteFilePath = realpath($realFilePath);
        if ($absoluteFilePath === false) {
            return ['ошибка' => 'Не удалось получить абсолютный путь к файлу'];
        }
        $normalizedPath = strtolower(str_replace('/', '\\', $absoluteFilePath));
        try {
            $wmi = new COM('WinMgmts:\\\\.\\root\\cimv2');
            if (!is_object($wmi)) {
                return ['ошибка' => 'Не удалось создать WMI-объект'];
            }
            $query = "SELECT ProcessId, CommandLine, ExecutablePath FROM Win32_Process WHERE CommandLine LIKE '%\"--port\" \"$port\"%'";
            $processes = $wmi->ExecQuery($query);
            foreach ($processes as $process) {
                if (empty($process->ExecutablePath) || empty($process->CommandLine)) {
                    continue;
                }
                $exePath = strtolower(str_replace('/', '\\', $process->ExecutablePath));
                if ($exePath === $normalizedPath && strpos($process->CommandLine, "\"--port\" \"$port\"") !== false) {
                    return [
                        'существует' => true,
                        'pid' => (int)$process->ProcessId,
                        'командная_строка' => $process->CommandLine
                    ];
                }
            }
            return ['существует' => false];
        } catch (Exception $e) {
            return ['ошибка' => 'Ошибка доступа к WMI: ' . $e->getMessage()];
        }
    }

    public function startProcess(string $realFilePath, string $ipForRun, int $port, string $args): array
    {
        if ($port < 1 || $port > 65535) {
            return ['ошибка' => 'Неверный номер порта'];
        }
        if (empty($realFilePath)) {
            return ['ошибка' => 'Путь не может быть пустым'];
        }
        if (!empty($ipForRun) && !filter_var($ipForRun, FILTER_VALIDATE_IP)) {
            return ['ошибка' => 'Неверный формат IP-адреса'];
        }
        try {
            $wmi = new COM('WinMgmts:\\\\.\\root\\cimv2');
            if (!is_object($wmi)) {
                return ['ошибка' => 'Не удалось создать WMI-объект'];
            }
            $startup = $wmi->Get('Win32_ProcessStartup')->SpawnInstance_();
            $startup->ShowWindow = 0;
            $process = $wmi->Get('Win32_Process');
            $command = "\"$realFilePath\" \"--port\" \"$port\"";
            if (!empty($ipForRun)) {
                $command .= " \"--ip\" \"$ipForRun\"";
            }
            if (!empty($args)) {
                $command .= " $args";
            }
            $pid = 0;
            $result = $process->Create($command, null, $startup, $pid);
            if ($result !== 0) {
                $errorCodes = [
                    2 => 'Доступ запрещён',
                    3 => 'Недостаточно привилегий',
                    8 => 'Неизвестная ошибка',
                    9 => 'Неверный путь',
                    21 => 'Недопустимый параметр'
                ];
                $message = $errorCodes[$result] ?? "Неизвестная ошибка с кодом: $result";
                return ['ошибка' => "Не удалось запустить процесс: $message"];
            }
            return ['результат' => true, 'pid' => (int)$pid];
        } catch (Exception $e) {
            return ['ошибка' => 'Ошибка доступа к WMI: ' . $e->getMessage()];
        }
    }

    public function killProcess(int $pid): array
    {
        if ($pid <= 0) {
            return ['ошибка' => 'PID должен быть положительным числом'];
        }
        try {
            $wmi = new COM('WinMgmts:\\\\.\\root\\cimv2');
            if (!is_object($wmi)) {
                return ['ошибка' => 'Не удалось создать WMI-объект'];
            }
            $processes = $wmi->ExecQuery("SELECT * FROM Win32_Process WHERE ProcessId = $pid");
            if ($processes->Count == 0) {
                return ['результат' => false];
            }
            foreach ($processes as $process) {
                $result = $process->Terminate();
                if ($result != 0) {
                    $errorCodes = [
                        2 => 'Доступ запрещён (требуются права администратора)',
                        3 => 'Недостаточно привилегий',
                        8 => 'Неизвестная ошибка',
                        9 => 'Путь не найден',
                        21 => 'Недопустимый параметр'
                    ];
                    $error = $errorCodes[$result] ?? "Неизвестная ошибка с кодом: $result";
                    return ['ошибка' => "Не удалось завершить процесс: $error"];
                }
            }
            return ['результат' => true];
        } catch (Exception $e) {
            return ['ошибка' => 'Ошибка доступа к WMI: ' . $e->getMessage()];
        }
    }

    public function parseCommand(string $cmd, int $port): array
    {
        $portFlag = "\"--port\" \"$port\"";
        $pos = strpos($cmd, $portFlag);
        if ($pos === false) {
            return ['аргументы' => '', 'файл_хост_листа_использование' => false];
        }
        $start = $pos + strlen($portFlag);
        $argsStr = trim(substr($cmd, $start));
        $argsArray = preg_split('/\s+/', $argsStr, -1, PREG_SPLIT_NO_EMPTY);
        $arguments = [];
        $hostsFile = false;
        $i = 0;
        while ($i < count($argsArray)) {
            if ($argsArray[$i] === '"--hosts"') {
                $hostsFile = true;
                $i += 2;
            } else {
                $arguments[] = $argsArray[$i];
                $i++;
            }
        }
        return [
            'аргументы' => implode(' ', $arguments),
            'файл_хост_листа_использование' => $hostsFile
        ];
    }

    public function getCurrentState(int $port, string $realFilePath): array
    {
        $portStatus = $this->isPortInUse($port);
        if (isset($portStatus['ошибка'])) {
            return ['вердикт' => 'ошибка', 'ошибка' => $portStatus['ошибка']];
        }
        if (!$portStatus['используется']) {
            return ['вердикт' => 'свободен'];
        }
        $processInfo = $this->findProcess($port, $realFilePath);
        if (isset($processInfo['ошибка'])) {
            return ['вердикт' => 'ошибка', 'ошибка' => $processInfo['ошибка']];
        }
        if ($processInfo['существует']) {
            $parsed = $this->parseCommand($processInfo['командная_строка'], $port);
            return [
                'вердикт' => 'используется_нашим_процессом',
                'pid' => $processInfo['pid'],
                'командная_строка' => $processInfo['командная_строка'],
                'аргументы' => $parsed['аргументы'],
                'файл_хост_листа_использование' => $parsed['файл_хост_листа_использование']
            ];
        }
        return ['вердикт' => 'используется_другим_процессом'];
    }

    public function waitForState(int $port, string $realFilePath, string $expectedState, int $maxAttempts, int $interval): array
    {
        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $state = $this->getCurrentState($port, $realFilePath);
            if ($state['вердикт'] === $expectedState) {
                return $state;
            }
            if ($state['вердикт'] === 'ошибка') {
                return $state;
            }
            sleep($interval);
        }
        return ['вердикт' => 'ошибка', 'ошибка' => "Не удалось достичь состояния '$expectedState' после $maxAttempts попыток"];
    }

    public function buildResponse(string $action, array $state, string $realFilePath, int $port): array
    {
        $baseResponse = [
            'действие' => $action,
            'реальный_полный_путь' => $realFilePath,
            'порт' => $port,
            'файл_хост_листа_использование' => false,
            'аргументы' => '',
            'результат' => true
        ];
        switch ($state['вердикт']) {
            case 'ошибка':
                return ['ошибка' => true, 'сообщение' => $state['ошибка']];
            case 'свободен':
                return array_merge($baseResponse, ['состояние' => 'свободен', 'сообщение' => 'Порт свободен']);
            case 'используется_нашим_процессом':
                return array_merge($baseResponse, [
                    'состояние' => 'используется_нашим_процессом',
                    'pid' => $state['pid'],
                    'файл_хост_листа_использование' => $state['файл_хост_листа_использование'],
                    'аргументы' => $state['аргументы'],
                    'сообщение' => 'Порт занят нашей программой'
                ]);
            case 'используется_другим_процессом':
                return array_merge($baseResponse, [
                    'состояние' => 'используется_другим_процессом',
                    'сообщение' => 'Порт занят другой программой'
                ]);
            default:
                return ['ошибка' => true, 'сообщение' => 'Неизвестное состояние'];
        }
    }
}

final class RequestValidator
{
    public function validate(array $data): array
    {
        $requiredFields = ['действие', 'реальный_полный_путь', 'порт'];
        foreach ($requiredFields as $field) {
            if (!array_key_exists($field, $data)) {
                return ['ошибка' => "Отсутствует обязательное поле: $field"];
            }
        }
        $action = $data['действие'];
        $realFilePath = $data['реальный_полный_путь'];
        $port = $data['порт'];
        $allowedActions = ['проверка', 'проверить_и_запустить', 'проверить_и_завершить'];
        if (!in_array($action, $allowedActions)) {
            return ['ошибка' => 'Недопустимое действие'];
        }
        if (!is_string($realFilePath) || empty(trim($realFilePath)) || !file_exists($realFilePath) || !is_file($realFilePath)) {
            return ['ошибка' => 'Путь к файлу некорректен или файл не существует'];
        }
        if (!is_numeric($port) || (int)$port != $port || $port < 1 || $port > 65535) {
            return ['ошибка' => 'Порт должен быть целым числом от 1 до 65535'];
        }
        $arguments = $data['аргументы'] ?? '';
        if (!is_string($arguments)) {
            return ['ошибка' => 'Аргументы должны быть строкой'];
        }
        $hostsFileName = $data['название_файла_хост_листа'] ?? null;
        if ($hostsFileName !== null && !is_string($hostsFileName)) {
            return ['ошибка' => 'Имя файла hosts должно быть строкой'];
        }
        $ipForRun = $data['ip_для_запуска'] ?? '';
        if (!is_string($ipForRun)) {
            return ['ошибка' => 'IP для запуска должен быть строкой'];
        }
        return [
            'действие' => $action,
            'реальный_полный_путь' => $realFilePath,
            'порт' => (int)$port,
            'аргументы' => $arguments,
            'название_файла_хост_листа' => $hostsFileName,
            'ip_для_запуска' => $ipForRun
        ];
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        header('Content-Length: 0');
        exit;
    }
    $inputData = file_get_contents('php://input');
    $requestData = json_decode($inputData, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendJsonResponse(['ошибка' => true, 'сообщение' => 'Некорректный формат JSON'], 400);
    }
    $validator = new RequestValidator();
    $validation = $validator->validate($requestData);
    if (isset($validation['ошибка'])) {
        sendJsonResponse(['ошибка' => true, 'сообщение' => $validation['ошибка']], 400);
    }
    $manager = new WindowsProcessManager();
    $action = $validation['действие'];
    $realFilePath = $validation['реальный_полный_путь'];
    $port = $validation['порт'];
    $arguments = $validation['аргументы'];
    $hostsFileName = $validation['название_файла_хост_листа'];
    $args = $arguments;
    if ($hostsFileName !== null) {
        $args = "\"--hosts\" \"" . addslashes($hostsFileName) . "\" " . $arguments;
    }
	
    $maxAttemptsStart = 5;
    $maxAttemptsStop = 5;	
    $interval = 1;

    switch ($action) {
        case 'проверка':
            $state = $manager->getCurrentState($port, $realFilePath);
            $response = $manager->buildResponse($action, $state, $realFilePath, $port);
            sendJsonResponse($response, isset($response['ошибка']) ? 500 : 200);
            break;
        case 'проверить_и_запустить':
            $state = $manager->getCurrentState($port, $realFilePath);
            if ($state['вердикт'] === 'ошибка') {
                sendJsonResponse(['ошибка' => true, 'сообщение' => $state['ошибка']], 500);
            }
            if ($state['вердикт'] === 'используется_нашим_процессом') {
                $response = $manager->buildResponse($action, $state, $realFilePath, $port);
                $response['сообщение'] = 'Процесс уже запущен';
                sendJsonResponse($response, 200);
            }
            if ($state['вердикт'] === 'используется_другим_процессом') {
                sendJsonResponse([
                    'действие' => $action,
                    'реальный_полный_путь' => $realFilePath,
                    'порт' => $port,
                    'сообщение' => 'Порт занят другой программой',
                    'результат' => false
                ], 200);
            }
            $startResult = $manager->startProcess($realFilePath, $validation['ip_для_запуска'], $port, $args);
            if (isset($startResult['ошибка'])) {
                sendJsonResponse(['ошибка' => true, 'сообщение' => $startResult['ошибка']], 500);
            }
            $state = $manager->waitForState($port, $realFilePath, 'используется_нашим_процессом', $maxAttemptsStart, $interval);
            $response = $manager->buildResponse($action, $state, $realFilePath, $port);
            $response['сообщение'] = $state['вердикт'] === 'используется_нашим_процессом' ? 'Процесс успешно запущен' : 'Не удалось запустить процесс';
            $response['результат'] = $state['вердикт'] === 'используется_нашим_процессом';
            sendJsonResponse($response, isset($response['ошибка']) ? 500 : 200);
            break;
        case 'проверить_и_завершить':
            $state = $manager->getCurrentState($port, $realFilePath);
            if ($state['вердикт'] === 'ошибка') {
                sendJsonResponse(['ошибка' => true, 'сообщение' => $state['ошибка']], 500);
            }
            if ($state['вердикт'] === 'свободен') {
                $response = $manager->buildResponse($action, $state, $realFilePath, $port);
                $response['сообщение'] = 'Порт свободен';
                sendJsonResponse($response, 200);
            }
            if ($state['вердикт'] === 'используется_другим_процессом') {
                sendJsonResponse([
                    'действие' => $action,
                    'реальный_полный_путь' => $realFilePath,
                    'порт' => $port,
                    'сообщение' => 'Порт занят другой программой, невозможно остановить',
                    'результат' => false
                ], 200);
            }
            $killResult = $manager->killProcess($state['pid']);
            if (isset($killResult['ошибка'])) {
                sendJsonResponse(['ошибка' => true, 'сообщение' => $killResult['ошибка']], 500);
            }
            $state = $manager->waitForState($port, $realFilePath, 'свободен', $maxAttemptsStop, $interval);
            $response = $manager->buildResponse($action, $state, $realFilePath, $port);
            $response['сообщение'] = $state['вердикт'] === 'свободен' ? 'Процесс успешно остановлен' : 'Не удалось остановить процесс';
            $response['результат'] = $state['вердикт'] === 'свободен';
            sendJsonResponse($response, isset($response['ошибка']) ? 500 : 200);
            break;
        default:
            sendJsonResponse(['ошибка' => true, 'сообщение' => 'Неизвестное действие'], 400);
    }
} catch (Throwable $e) {
    $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
    sendJsonResponse(['ошибка' => true, 'сообщение' => $e->getMessage()], $code);
}