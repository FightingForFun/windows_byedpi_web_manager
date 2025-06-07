<?php
//12_windows.php
declare(strict_types=1);
set_time_limit(60);
ini_set('display_errors', '0');
error_reporting(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Cache-Control: no-store, no-cache, must-revalidate");
header("Pragma: no-cache");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    header('Content-Length: 0');
    exit();
}

function send_json_response(array $response, int $status_code = 200): void {
    http_response_code($status_code);
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function is_port_in_use(int $port): array {
    if ($port < 1 || $port > 65535) {
        return ['ошибка' => 'Неверный номер порта.'];
    }
    try {
        $wmi = new COM('WinMgmts:\\\\.\\root\\StandardCimv2');
        if (!$wmi || !is_object($wmi)) {
            return ['ошибка' => 'Не удалось создать WMI-объект для проверки порта.'];
        }
        $query = "SELECT * FROM MSFT_NetTCPConnection WHERE LocalPort = $port AND State = 2";
        $connections = $wmi->ExecQuery($query);
        return ['используется' => $connections->Count > 0];
    } catch (Exception $e) {
        return ['ошибка' => 'Ошибка проверки порта: ' . $e->getMessage()];
    }
}

function find_process(int $port, string $real_file_path): array {
    if ($port < 1 || $port > 65535) {
        return ['ошибка' => 'Неверный номер порта.'];
    }
    if (empty($real_file_path)) {
        return ['ошибка' => 'Путь не может быть пустым.'];
    }
    if (!class_exists('COM')) {
        return ['ошибка' => 'COM-расширение недоступно'];
    }
    $absolute_file_path = realpath($real_file_path);
    if ($absolute_file_path === false) {
        return ['ошибка' => 'Не удалось получить абсолютный путь к файлу.'];
    }
    $normalized_path = strtolower(str_replace('/', '\\', $absolute_file_path));
    try {
        $wmi = new COM('WinMgmts:\\\\.\\root\\cimv2');
        if (!$wmi || !is_object($wmi)) {
            return ['ошибка' => 'WMI недоступен: Не удалось создать объект'];
        }
        $query = "SELECT ProcessId, CommandLine, ExecutablePath FROM Win32_Process WHERE CommandLine LIKE '%--port $port%'";
        $processes = $wmi->ExecQuery($query);
        foreach ($processes as $process) {
            if (empty($process->ExecutablePath) || empty($process->CommandLine)) {
                continue;
            }
            $exe_path = strtolower(str_replace('/', '\\', $process->ExecutablePath));
            if ($exe_path === $normalized_path && strpos($process->CommandLine, "--port $port") !== false) {
                return [
                    'существует' => true,
                    'pid' => (int)$process->ProcessId,
                    'командная_строка' => $process->CommandLine
                ];
            }
        }
        return ['существует' => false];
    } catch (Exception $e) {
        return ['ошибка' => 'WMI недоступен: ' . $e->getMessage()];
    }
}

function start_process(string $real_file_path, string $ip_for_run, int $port, string $args): array {
    if ($port < 1 || $port > 65535) {
        return ['ошибка' => 'Неверный номер порта.'];
    }
    if (empty($real_file_path)) {
        return ['ошибка' => 'Путь не может быть пустым.'];
    }
    if (!empty($ip_for_run) && !filter_var($ip_for_run, FILTER_VALIDATE_IP)) {
        return ['ошибка' => 'Неверный формат IP-адреса.'];
    }
    
    try {
        $wmi = new COM('WinMgmts:\\\\.\\root\\cimv2');
        if (!$wmi || !is_object($wmi)) {
            return ['ошибка' => 'WMI недоступен: Не удалось создать объект'];
        }
        
        $startup = $wmi->Get('Win32_ProcessStartup')->SpawnInstance_();
        $startup->ShowWindow = 0;
        $process = $wmi->Get('Win32_Process');
        
        $command = "\"$real_file_path\" --port $port";
        
        if (!empty($ip_for_run)) {
            $command .= " --ip $ip_for_run";
        }
        
        if (!empty($args)) {
            $command .= " $args";
        }
        
        $pid = 0;
        $result = $process->Create($command, null, $startup, $pid);
        
        if ($result !== 0) {
            $error_codes = [
                2 => 'Доступ запрещён.',
                3 => 'Недостаточно привилегий.',
                8 => 'Неизвестная ошибка.',
                9 => 'Неверный путь.',
                21 => 'Недопустимый параметр.'
            ];
            $message = $error_codes[$result] ?? "Неизвестная ошибка с кодом: $result";
            return ['ошибка' => "Не удалось запустить процесс: $message"];
        }
        
        return ['результат' => true, 'pid' => (int)$pid];
    } catch (Exception $e) {
        return ['ошибка' => 'WMI недоступен: ' . $e->getMessage()];
    }
}

function kill_process(int $pid): array {
    if ($pid <= 0) {
        return ['ошибка' => 'PID должен быть положительным числом.'];
    }
    try {
        $wmi = new COM('WinMgmts:\\\\.\\root\\cimv2');
        if (!$wmi || !is_object($wmi)) {
            return ['ошибка' => 'WMI недоступен: Не удалось создать объект'];
        }
        $processes = $wmi->ExecQuery("SELECT * FROM Win32_Process WHERE ProcessId = $pid");
        if ($processes->Count == 0) {
            return ['результат' => false];
        }
        foreach ($processes as $process) {
            $result = $process->Terminate();
            if ($result != 0) {
                $error_codes = [
                    2 => 'Доступ запрещён (требуются права администратора).',
                    3 => 'Недостаточно привилегий.',
                    8 => 'Неизвестная ошибка.',
                    9 => 'Путь не найден.',
                    21 => 'Недопустимый параметр.'
                ];
                $error = $error_codes[$result] ?? "Неизвестная ошибка с кодом: $result";
                return ['ошибка' => "Не удалось завершить процесс: $error"];
            }
        }
        return ['результат' => true];
    } catch (Exception $e) {
        return ['ошибка' => 'WMI недоступен: ' . $e->getMessage()];
    }
}

function validate_request_data(array $data): array {
    $required_fields = ['действие', 'реальный_полный_путь', 'порт'];
    foreach ($required_fields as $field) {
        if (!array_key_exists($field, $data)) {
            return ['ошибка' => "Отсутствует обязательное поле: $field"];
        }
    }
    $action = $data['действие'];
    $real_file_path = $data['реальный_полный_путь'];
    $port = $data['порт'];
    $allowed_actions = ['проверка', 'проверить_и_запустить', 'проверить_и_завершить'];
    if (!in_array($action, $allowed_actions)) {
        return ['ошибка' => 'Недопустимое действие.'];
    }
    if (!is_string($real_file_path) || empty(trim($real_file_path)) || !file_exists($real_file_path) || !is_file($real_file_path)) {
        return ['ошибка' => 'Путь к файлу некорректен или файл не существует.'];
    }
    if (!is_numeric($port) || (int)$port != $port || $port < 1 || $port > 65535) {
        return ['ошибка' => 'Порт должен быть целым числом от 1 до 65535.'];
    }
    $arguments = $data['аргументы'] ?? '';
    if (!is_string($arguments)) {
        return ['ошибка' => 'Аргументы должны быть строкой.'];
    }
    $hosts_file_name = $data['название_файла_хост_листа'] ?? null;
    if ($hosts_file_name !== null && !is_string($hosts_file_name)) {
        return ['ошибка' => 'Имя файла hosts должно быть строкой.'];
    }
    
    $ip_for_run = $data['ip_для_запуска'] ?? '';
    if (!is_string($ip_for_run)) {
        return ['ошибка' => 'IP для запуска должен быть строкой.'];
    }
    
    return [
        'действие' => $action,
        'реальный_полный_путь' => $real_file_path,
        'порт' => (int)$port,
        'аргументы' => $arguments,
        'название_файла_хост_листа' => $hosts_file_name,
        'ip_для_запуска' => $ip_for_run
    ];
}

function parse_cmd(string $cmd, int $port): array {
    $port_flag = "--port $port";
    $pos = strpos($cmd, $port_flag);
    if ($pos === false) {
        return ['аргументы' => '', 'файл_хост_листа_использование' => false];
    }
    $start = $pos + strlen($port_flag);
    $args_str = trim(substr($cmd, $start));
    $args_array = preg_split('/\s+/', $args_str, -1, PREG_SPLIT_NO_EMPTY);
    $arguments = [];
    $hosts_file = false;
    $i = 0;
    while ($i < count($args_array)) {
        if ($args_array[$i] === '--hosts') {
            $hosts_file = true;
            $i += 2;
        } else {
            $arguments[] = $args_array[$i];
            $i++;
        }
    }
    return [
        'аргументы' => implode(' ', $arguments),
        'файл_хост_листа_использование' => $hosts_file
    ];
}

function get_current_state(int $port, string $real_file_path): array {
    $port_status = is_port_in_use($port);
    if (isset($port_status['ошибка'])) {
        return ['вердикт' => 'ошибка', 'ошибка' => $port_status['ошибка']];
    }
    if (!$port_status['используется']) {
        return ['вердикт' => 'свободен'];
    }
    $process_info = find_process($port, $real_file_path);
    if (isset($process_info['ошибка'])) {
        return ['вердикт' => 'ошибка', 'ошибка' => $process_info['ошибка']];
    }
    if ($process_info['существует']) {
        $parsed = parse_cmd($process_info['командная_строка'], $port);
        return [
            'вердикт' => 'используется_нашим_процессом',
            'pid' => $process_info['pid'],
            'командная_строка' => $process_info['командная_строка'],
            'аргументы' => $parsed['аргументы'],
            'файл_хост_листа_использование' => $parsed['файл_хост_листа_использование']
        ];
    }
    return ['вердикт' => 'используется_другим_процессом'];
}

function wait_for_state(int $port, string $real_file_path, string $expected_state, int $max_attempts, int $interval): array {
    for ($attempt = 0; $attempt < $max_attempts; $attempt++) {
        $state = get_current_state($port, $real_file_path);
        if ($state['вердикт'] === $expected_state) {
            return $state;
        }
        if ($state['вердикт'] === 'ошибка') {
            return $state;
        }
        sleep($interval);
    }
    return ['вердикт' => 'ошибка', 'ошибка' => "Не удалось достичь состояния '$expected_state' после $max_attempts попыток."];
}

function build_response(string $action, array $state, string $real_file_path, int $port): array {
    $base_response = [
        'действие' => $action,
        'реальный_полный_путь' => $real_file_path,
        'порт' => $port,
        'файл_хост_листа_использование' => false,
        'аргументы' => '',
        'результат' => true
    ];
    switch ($state['вердикт']) {
        case 'ошибка':
            return ['ошибка' => true, 'сообщение' => $state['ошибка']];
        case 'свободен':
            return array_merge($base_response, ['состояние' => 'свободен', 'сообщение' => 'Порт свободен']);
        case 'используется_нашим_процессом':
            return array_merge($base_response, [
                'состояние' => 'используется_нашим_процессом',
                'pid' => $state['pid'],
                'файл_хост_листа_использование' => $state['файл_хост_листа_использование'],
                'аргументы' => $state['аргументы'],
                'сообщение' => 'Порт занят нашей программой'
            ]);
        case 'используется_другим_процессом':
            return array_merge($base_response, [
                'состояние' => 'используется_другим_процессом',
                'сообщение' => 'Порт занят другой программой'
            ]);
        default:
            return ['ошибка' => true, 'сообщение' => 'Неизвестное состояние.'];
    }
}

$input_data = file_get_contents('php://input');
$request_data = json_decode($input_data, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    send_json_response(['ошибка' => true, 'сообщение' => 'Некорректный формат JSON'], 400);
}
$validation = validate_request_data($request_data);
if (isset($validation['ошибка'])) {
    send_json_response(['ошибка' => true, 'сообщение' => $validation['ошибка']], 400);
}
$action = $validation['действие'];
$real_file_path = $validation['реальный_полный_путь'];
$port = $validation['порт'];
$arguments = $validation['аргументы'];
$hosts_file_name = $validation['название_файла_хост_листа'];
$args = $arguments;
if ($hosts_file_name !== null) {
    $args = '--hosts "' . addslashes($hosts_file_name) . '" ' . $arguments;
}
$max_attempts = 10;
$interval = 1;

switch ($action) {
    case 'проверка':
        $state = get_current_state($port, $real_file_path);
        $response = build_response($action, $state, $real_file_path, $port);
        send_json_response($response, isset($response['ошибка']) ? 500 : 200);
        break;
    case 'проверить_и_запустить':
        $state = get_current_state($port, $real_file_path);
        if ($state['вердикт'] === 'ошибка') {
            send_json_response(['ошибка' => true, 'сообщение' => $state['ошибка']], 500);
        }
        if ($state['вердикт'] === 'используется_нашим_процессом') {
            $response = build_response($action, $state, $real_file_path, $port);
            $response['сообщение'] = 'Процесс уже запущен';
            send_json_response($response, 200);
        }
        if ($state['вердикт'] === 'используется_другим_процессом') {
            send_json_response([
                'действие' => $action,
                'реальный_полный_путь' => $real_file_path,
                'порт' => $port,
                'сообщение' => 'Порт занят другой программой',
                'результат' => false
            ], 200);
        }
        
        $start_result = start_process(
            $real_file_path,
            $validation['ip_для_запуска'],
            $port,
            $args
        );
        
        if (isset($start_result['ошибка'])) {
            send_json_response(['ошибка' => true, 'сообщение' => $start_result['ошибка']], 500);
        }
        $state = wait_for_state($port, $real_file_path, 'используется_нашим_процессом', $max_attempts, $interval);
        $response = build_response($action, $state, $real_file_path, $port);
        $response['сообщение'] = $state['вердикт'] === 'используется_нашим_процессом' ? 'Процесс успешно запущен' : 'Не удалось запустить процесс';
        $response['результат'] = $state['вердикт'] === 'используется_нашим_процессом';
        send_json_response($response, isset($response['ошибка']) ? 500 : 200);
        break;
    case 'проверить_и_завершить':
        $state = get_current_state($port, $real_file_path);
        if ($state['вердикт'] === 'ошибка') {
            send_json_response(['ошибка' => true, 'сообщение' => $state['ошибка']], 500);
        }
        if ($state['вердикт'] === 'свободен') {
            $response = build_response($action, $state, $real_file_path, $port);
            $response['сообщение'] = 'Порт свободен';
            send_json_response($response, 200);
        }
        if ($state['вердикт'] === 'используется_другим_процессом') {
            send_json_response([
                'действие' => $action,
                'реальный_полный_путь' => $real_file_path,
                'порт' => $port,
                'сообщение' => 'Порт занят другой программой, невозможно остановить',
                'результат' => false
            ], 200);
        }
        $kill_result = kill_process($state['pid']);
        if (isset($kill_result['ошибка'])) {
            send_json_response(['ошибка' => true, 'сообщение' => $kill_result['ошибка']], 500);
        }
        $state = wait_for_state($port, $real_file_path, 'свободен', $max_attempts, $interval);
        $response = build_response($action, $state, $real_file_path, $port);
        $response['сообщение'] = $state['вердикт'] === 'свободен' ? 'Процесс успешно остановлен' : 'Не удалось остановить процесс';
        $response['результат'] = $state['вердикт'] === 'свободен';
        send_json_response($response, isset($response['ошибка']) ? 500 : 200);
        break;
    default:
        send_json_response(['ошибка' => true, 'сообщение' => 'Неизвестное действие'], 400);
}

?>