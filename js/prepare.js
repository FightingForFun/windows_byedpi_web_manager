const PrepareModule = (() => {
    let appConfig = null;
    let detectedOS = null;

    async function handleResponse(response) {
        if (!response.ok) {
            let errorMsg = `Ошибка HTTP! Статус: ${response.status}`;
            try {
                const errorBody = await response.json();
                errorMsg = errorBody.сообщение || errorMsg;
            } catch (_) {}
            throw new Error(errorMsg);
        }
        return response.json();
    }

    async function fetchData(url) {
        try {
            const response = await fetch(url, { method: 'GET' });
            return handleResponse(response);
        } catch (error) {
            const msg = error.name === 'TypeError'
                ? 'Сетевая ошибка: не удалось выполнить запрос'
                : error.message;
            throw new Error(msg);
        }
    }

    async function postData(url, data) {
        try {
            if (typeof data !== 'object' || data === null) {
                throw new Error('Некорректные данные для отправки');
            }
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return handleResponse(response);
        } catch (error) {
            const msg = error.name === 'TypeError'
                ? 'Сетевая ошибка: не удалось выполнить запрос'
                : error.message;
            throw new Error(msg);
        }
    }

    function updateErrorStatus(step, error, status) {
        status[step] = 'Ошибка';
        status[`${step}Msg`] = error.message;
    }

    async function detectOS(status) {
        LogModule.logMessage('ИНФО', 'Определение операционной системы...');
        try {
            const data = await fetchData('php/1_os_detect.php');
            if (!data.результат) {
                throw new Error(data.сообщение || 'Неизвестная ошибка при определении ОС');
            }
            detectedOS = data.операционная_система;
            if (detectedOS !== 'windows') {
                throw new Error('Операционная система не поддерживается');
            }
            status.os = 'ОК';
            LogModule.logMessage('ИНФО', `Определена ОС: ${detectedOS}`);
            return true;
        } catch (error) {
            updateErrorStatus('os', error, status);
            LogModule.logMessage('ОШИБКА', `Не удалось определить ОС: ${error.message}`);
            return false;
        }
    }

    async function checkPHP(status) {
        LogModule.logMessage('ИНФО', 'Проверка параметров PHP...');
        try {
            const data = await fetchData('php/2_windows_php_check.php');
            if (!data.результат) {
                throw new Error(data.сообщение || 'Неизвестная ошибка при проверке PHP');
            }
            const phpChecks = data.php;
            const failedChecks = Object.entries(phpChecks)
                .filter(([_, value]) => !value)
                .map(([key]) => key);
            if (failedChecks.length > 0) {
                throw new Error(`Ошибки в параметрах PHP: ${failedChecks.join(', ')}`);
            }
            status.php = 'ОК';
            LogModule.logMessage('ИНФО', 'Все параметры PHP в порядке');
            return true;
        } catch (error) {
            updateErrorStatus('php', error, status);
            LogModule.logMessage('ОШИБКА', `Не удалось проверить PHP: ${error.message}`);
            return false;
        }
    }

    async function checkFiles(status) {
        LogModule.logMessage('ИНФО', 'Проверка файлов...');
        try {
            const data = await fetchData('php/4_windows_files_check.php');
            if (!data.результат) {
                throw new Error(data.сообщение || 'Неизвестная ошибка при проверке файлов');
            }
            const files = data.файлы;
            let allFilesOk = true;
            const domainsByProcess = {};
            const hostsPathsByProcess = {};
            let ciadpiPath = null;

            for (const [key, file] of Object.entries(files)) {
                if (!file.существует || !file.является_файлом || !file.чтение) {
                    LogModule.logMessage('ОШИБКА', `Файл ${file.полный_путь} недоступен`);
                    allFilesOk = false;
                } else if (file.домены && Array.isArray(file.домены)) {
                    const processIndex = key.match(/файл_хост_листа_ciadpi_для_использования_(\d+)/);
                    if (processIndex) {
                        const index = parseInt(processIndex[1], 10);
                        domainsByProcess[index] = file.домены;
                        hostsPathsByProcess[index] = file.полный_путь;
                    }
                }
                if (key === 'файл_ciadpi') {
                    ciadpiPath = file.полный_путь;
                }
            }

            if (!allFilesOk) {
                throw new Error('Некоторые файлы недоступны');
            }
            status.files = 'ОК';
            LogModule.logMessage('ИНФО', 'Все файлы проверены успешно');
            return { domainsByProcess, ciadpiPath, hostsPathsByProcess };
        } catch (error) {
            updateErrorStatus('files', error, status);
            LogModule.logMessage('ОШИБКА', `Не удалось проверить файлы: ${error.message}`);
            return false;
        }
    }

    async function readConfig(status) {
        LogModule.logMessage('ИНФО', 'Чтение конфигурации...');
        try {
            const data = await fetchData('php/5_read_config.php');
            if (!data.результат) {
                throw new Error(data.сообщение || 'Неизвестная ошибка при чтении конфигурации');
            }
            appConfig = data.конфигурация;
            window.appConfig = appConfig;
            status.config = 'ОК';
            LogModule.logMessage('ИНФО', 'Конфигурация успешно загружена');
            return true;
        } catch (error) {
            updateErrorStatus('config', error, status);
            LogModule.logMessage('ОШИБКА', `Не удалось загрузить конфигурацию: ${error.message}`);
            return false;
        }
    }

async function detectServersGGC(status) {
    LogModule.logMessage('ИНФО', 'Поиск серверов Google Global Cache...');
    let firstServer = null;
    let prefix = null;
    
    const firstServerAttempts = [
        { type: 1, url: 'php/6_detect_ggc_domains.php?first_ggc_link=1' },
        { type: 2, url: 'php/6_detect_ggc_domains.php?first_ggc_link=2' },
        { type: 1, url: 'php/6_detect_ggc_domains.php?first_ggc_link=1' },
        { type: 2, url: 'php/6_detect_ggc_domains.php?first_ggc_link=2' }
    ];

    for (const attempt of firstServerAttempts) {
        try {
            LogModule.logMessage('ОТЛАДКА', `Попытка получения первого сервера (источник ${attempt.type})...`);
            const data = await fetchData(attempt.url);
            
            if (data.результат && data.первый_сервер_ggc) {
                firstServer = data.первый_сервер_ggc;
                const match = firstServer.match(/https?:\/\/rr\d+---sn-([a-z0-9\-]+)\.googlevideo\.com/);
                
                if (match && match[1]) {
                    prefix = match[1];
                    LogModule.logMessage('ОТЛАДКА', `Первый сервер Google Global Cache: ${firstServer}, префикс: ${prefix}`);
                    break;
                } else {
                    LogModule.logMessage('ОТЛАДКА', `Не удалось извлечь префикс из URL: ${firstServer}`);
                }
            } else {
                LogModule.logMessage('ОТЛАДКА', `Не удалось получить первый сервер (источник ${attempt.type}): ${data.сообщение || 'Нет данных'}`);
            }
        } catch (error) {
            LogModule.logMessage('ОТЛАДКА', `Ошибка при получении первого сервера (источник ${attempt.type}): ${error.message}`);
        }
    }

    if (!firstServer || !prefix) {
        updateErrorStatus('ggc', new Error('Не удалось определить первый сервер Google Global Cache после 4 попыток'), status);
        LogModule.logMessage('ОШИБКА', 'Не удалось определить первый сервер Google Global Cache');
        return false;
    }

    const accessibleServers = [firstServer];
    const maxServerNumber = 20;
    let shouldContinue = true;

    for (let serverNum = 2; serverNum <= maxServerNumber && shouldContinue; serverNum++) {
        let serverFound = false;
        
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const url = `php/6_detect_ggc_domains.php?next_ggc_server=${serverNum}&prefix=${encodeURIComponent(prefix)}`;
                LogModule.logMessage('ОТЛАДКА', `Проверка сервера #${serverNum}, попытка ${attempt}/2...`);
                
                await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));
                
                const data = await fetchData(url);
                if (data.результат && data.сервер_ggc) {
                    accessibleServers.push(data.сервер_ggc);
                    LogModule.logMessage('ОТЛАДКА', `Найден сервер Google Global Cache: ${data.сервер_ggc}`);
                    serverFound = true;
                    break;
                } else {
                    const errorMsg = data.сообщение || `Неизвестная ошибка для сервера #${serverNum}`;
                    LogModule.logMessage('ОТЛАДКА', `Сервер #${serverNum} недоступен: ${errorMsg}`);
                }
            } catch (error) {
                LogModule.logMessage('ОТЛАДКА', `Ошибка при проверке сервера #${serverNum} (попытка ${attempt}): ${error.message}`);
            }
        }
        
        if (!serverFound) {
            LogModule.logMessage('ОТЛАДКА', `Сервер #${serverNum} не найден после 2 попыток, прекращаем поиск.`);
            shouldContinue = false;
        }
    }

    if (!appConfig.ссылки_по_умолчанию_для_проверки['Google Global Cache']) {
        appConfig.ссылки_по_умолчанию_для_проверки['Google Global Cache'] = [];
    }
    
    const existingSet = new Set(appConfig.ссылки_по_умолчанию_для_проверки['Google Global Cache']);
    const newServers = accessibleServers.filter(server => !existingSet.has(server));
    
    if (newServers.length > 0) {
        appConfig.ссылки_по_умолчанию_для_проверки['Google Global Cache'].push(...accessibleServers);
    }

    status.ggc = 'ОК';
    LogModule.logMessage('ИНФО', `Всего обнаружено серверов Google Global Cache: ${accessibleServers.length}`);
    return true;
}

    async function updatePAC(status) {
        LogModule.logMessage('ИНФО', 'Обновление PAC-файла...');
        try {
            if (!appConfig) {
                throw new Error('Конфигурация не загружена');
            }
            if (!appConfig.ciadpi_для_использования || typeof appConfig.ciadpi_для_использования !== 'object') {
                throw new Error('Неверный формат данных для PAC');
            }
            const dataToSend = { ciadpi_для_использования: appConfig.ciadpi_для_использования };
            const response = await postData('php/8_update_pac.php', dataToSend);
            if (!response.результат) {
                throw new Error(response.сообщение || 'Неизвестная ошибка при обновлении PAC');
            }
            status.pac = 'ОК';
            LogModule.logMessage('ИНФО', 'PAC-файл успешно обновлен');
            return true;
        } catch (error) {
            updateErrorStatus('pac', error, status);
            LogModule.logMessage('ОШИБКА', `Не удалось обновить PAC: ${error.message}`);
            return false;
        }
    }

    async function checkUsagePorts(status) {
        LogModule.logMessage('ИНФО', 'Проверка портов использования...');
        try {
            const baseUrl = 'php/12_windows.php';
            for (let i = 1; i <= 8; i++) {
                const processKey = `процесс_${i}`;
                if (!appConfig.ciadpi_для_использования[processKey]) {
                    LogModule.logMessage('ОШИБКА', `Процесс ${i} отсутствует в конфигурации`);
                    continue;
                }
                const processData = appConfig.ciadpi_для_использования[processKey];
                const port = processData.tcp_порт;
                const requestData = {
                    действие: 'проверка',
                    реальный_полный_путь: processData.полный_путь,
                    порт: port,
                    ip_для_запуска: processData.ip_для_запуска
                };
                const response = await postData(baseUrl, requestData);
                const elements = {
                    saveStrategy: document.getElementById(`save-strategy-main-server-${i}`),
                    cleanStrategy: document.getElementById(`clean-my-server-${i}-strategy`),
                    startBtn: document.getElementById(`start-main-server-${i}`),
                    stopBtn: document.getElementById(`stop-main-server-${i}`),
                    strategyInput: document.getElementById(`my-server-${i}-strategy`),
                    cleanStrategyBtn: document.getElementById(`clean-my-server-${i}-strategy`),
                    linksTextarea: document.getElementById(`my-server-${i}-links`),
                    saveDomainsBtn: document.getElementById(`save-domains-main-server-${i}`),
                    hostSelect: document.getElementById(`select-use-domains-list-or-not-${i}`),
                    cleanMainServerBtn: document.getElementById(`clean-main-server-${i}`)
                };
                if (response.состояние === 'используется_нашим_процессом') {
                    LogModule.logMessage('ОТЛАДКА', `Порт ${port} используется нашим процессом`);
                    if (elements.saveStrategy) elements.saveStrategy.disabled = true;
                    if (elements.cleanStrategy) elements.cleanStrategy.disabled = true;
                    if (elements.stopBtn) elements.stopBtn.hidden = false;
                    if (elements.startBtn) elements.startBtn.hidden = true;
                    if (elements.strategyInput) elements.strategyInput.disabled = true;
                    if (elements.cleanStrategyBtn) elements.cleanStrategyBtn.disabled = true;
                    if (elements.linksTextarea) elements.linksTextarea.disabled = true;
                    if (elements.saveDomainsBtn) elements.saveDomainsBtn.disabled = true;
                    if (elements.hostSelect) elements.hostSelect.disabled = true;
                    if (elements.cleanMainServerBtn) elements.cleanMainServerBtn.disabled = true;
					
					if (elements.hostSelect && response.файл_хост_листа_использование !== undefined) {
                    elements.hostSelect.value = response.файл_хост_листа_использование ? 'true' : 'false';
                    }
					
                } else if (response.состояние === 'свободен') {
                    LogModule.logMessage('ОТЛАДКА', `Порт ${port} свободен`);
                    if (elements.saveStrategy) elements.saveStrategy.disabled = false;
                    if (elements.cleanStrategy) elements.cleanStrategy.disabled = false;
                    if (elements.startBtn) elements.startBtn.hidden = false;
                    if (elements.stopBtn) elements.stopBtn.hidden = true;
                    if (elements.strategyInput) elements.strategyInput.disabled = false;
                    if (elements.cleanStrategyBtn) elements.cleanStrategyBtn.disabled = false;
                    if (elements.linksTextarea) elements.linksTextarea.disabled = false;
                    if (elements.saveDomainsBtn) elements.saveDomainsBtn.disabled = false;
                    if (elements.hostSelect) elements.hostSelect.disabled = false;
                    if (elements.cleanMainServerBtn) elements.cleanMainServerBtn.disabled = false;
					
					if (elements.hostSelect) {
                    elements.hostSelect.value = 'false';
                    }
					
                } else if (response.состояние === 'используется_другим_процессом') {
                    throw new Error(`Порт ${port} занят другим процессом`);
                } else if (response.ошибка) {
                    throw new Error(`Ошибка проверки порта ${port}: ${response.сообщение}`);
                }
            }
            status.usagePorts = 'ОК';
            LogModule.logMessage('ИНФО', 'Проверка портов использования завершена');
            return true;
        } catch (error) {
            updateErrorStatus('usagePorts', error, status);
            LogModule.logMessage('ОШИБКА', `Не удалось проверить порты использования: ${error.message}`);
            return false;
        }
    }

    async function checkTestingPorts(status) {
        LogModule.logMessage('ИНФО', 'Проверка портов тестирования...');
        try {
            const baseUrl = 'php/12_windows.php';
            const fullPath = appConfig.ciadpi_для_проверки_стратегий.полный_путь;
            for (let i = 1; i <= 24; i++) {
                const processKey = `процесс_${i}`;
                if (!appConfig.ciadpi_для_проверки_стратегий[processKey]) {
                    LogModule.logMessage('ОШИБКА', `Процесс ${i} отсутствует в конфигурации`);
                    continue;
                }
                const port = appConfig.ciadpi_для_проверки_стратегий[processKey].tcp_порт;
                const checkRequest = {
                    действие: 'проверка',
                    реальный_полный_путь: fullPath,
                    порт: port
                };
                const checkResponse = await postData(baseUrl, checkRequest);
                if (checkResponse.состояние === 'используется_нашим_процессом') {
                    const stopRequest = {
                        действие: 'проверить_и_завершить',
                        реальный_полный_путь: fullPath,
                        порт: port
                    };
                    const stopResponse = await postData(baseUrl, stopRequest);
                    if (!stopResponse.результат) {
                        throw new Error(`Не удалось остановить процесс на порту ${port}: ${stopResponse.сообщение}`);
                    }
                    LogModule.logMessage('ОТЛАДКА', `Процесс на порту ${port} остановлен`);
                } else if (checkResponse.состояние === 'используется_другим_процессом') {
                    throw new Error(`Порт ${port} занят другим процессом`);
                } else if (checkResponse.состояние === 'свободен') {
                    LogModule.logMessage('ОТЛАДКА', `Порт ${port} свободен`);
                } else if (checkResponse.ошибка) {
                    throw new Error(`Ошибка проверки порта ${port}: ${checkResponse.сообщение}`);
                }
            }
            status.testingPorts = 'ОК';
            LogModule.logMessage('ИНФО', 'Проверка портов тестирования завершена');
            return true;
        } catch (error) {
            updateErrorStatus('testingPorts', error, status);
            LogModule.logMessage('ОШИБКА', `Не удалось проверить порты тестирования: ${error.message}`);
            return false;
        }
    }

    function setupInterface() {
        if (!appConfig) {
            LogModule.logMessage('ОШИБКА', 'Конфигурация не загружена');
            return;
        }
        const selectLinks = document.getElementById('select-links');
        if (!selectLinks) {
            LogModule.logMessage('ОШИБКА', 'Элемент #select-links не найден');
            return;
        }
        const groups = Object.keys(appConfig.ссылки_по_умолчанию_для_проверки);
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            selectLinks.appendChild(option);
        });
        LogModule.logMessage('ИНФО', 'Список групп ссылок заполнен');

        for (let i = 1; i <= 8; i++) {
            const processKey = `процесс_${i}`;
            const processData = appConfig.ciadpi_для_использования[processKey];
            if (!processData) {
            LogModule.logMessage('ОШИБКА', `Данные процесса ${i} отсутствуют`);
                continue;
            }
            const ipPortElement = document.getElementById(`my-server-${i}-ip-and-port`);
            if (ipPortElement) {
                ipPortElement.textContent = `${processData.ip_для_сайта_и_pac_файла}:${processData.tcp_порт}`;
            }
            const strategyInput = document.getElementById(`my-server-${i}-strategy`);
            if (strategyInput) {
                strategyInput.value = processData.последняя_используемая_стратегия || '';
            }
            const domainsTextarea = document.getElementById(`my-server-${i}-links`);
            if (domainsTextarea) {
                domainsTextarea.value = processData.домены ? processData.домены.join('\n') : '';
            }
        }

        const pacLinkInput = document.getElementById('pac-link');
        if (pacLinkInput) {
            pacLinkInput.value = new URL('local.pac', window.location.href).href;
            LogModule.logMessage('ИНФО', 'Ссылка на PAC-файл создана');
        } else {
            LogModule.logMessage('ОШИБКА', 'Элемент #pac-link не найден');
        }

        for (let i = 1; i <= 10; i++) {
            const block = document.getElementById(`block-${i}`);
            if (block) block.removeAttribute('hidden');
        }
        LogModule.logMessage('ИНФО', 'Интерфейс настроен');
    }

    async function runPreparation() {
        const status = {};
        LogModule.logMessage('ИНФО', '=====================================');		
        LogModule.logMessage('ИНФО', '> https://github.com/FightingForFun <');
        LogModule.logMessage('ИНФО', '=====================================');			
        LogModule.logMessage('ИНФО', 'Старт подготовки...');

        if (!await detectOS(status)) return;
        if (!await checkPHP(status)) return;
        const fileCheckResult = await checkFiles(status);
        if (!fileCheckResult) return;
        if (!await readConfig(status)) return;

        const { domainsByProcess, ciadpiPath, hostsPathsByProcess } = fileCheckResult;
        for (let i = 1; i <= 8; i++) {
            const processKey = `процесс_${i}`;
            if (!appConfig.ciadpi_для_использования[processKey]) {
                LogModule.logMessage('ОШИБКА', `Процесс ${i} не найден`);
                continue;
            }
            appConfig.ciadpi_для_использования[processKey].домены = domainsByProcess[i] || [];
            appConfig.ciadpi_для_использования[processKey].полный_путь = ciadpiPath;
            appConfig.ciadpi_для_использования[processKey].полный_путь_к_хост_листу = hostsPathsByProcess[i];
        }
        appConfig.ciadpi_для_проверки_стратегий.полный_путь = ciadpiPath;

        await detectServersGGC(status);

        if (!await updatePAC(status)) return;
        if (!await checkUsagePorts(status)) return;
        if (!await checkTestingPorts(status)) return;

        setupInterface();
        LogModule.logMessage('ИНФО', 'Подготовка завершена');
    }

    document.addEventListener('DOMContentLoaded', runPreparation);

    return { runPreparation };
})();

window.PrepareModule = PrepareModule;