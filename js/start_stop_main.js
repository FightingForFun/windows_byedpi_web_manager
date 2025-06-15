const ServerController = (() => {
    const MANAGEMENT_FILE_PATH = 'php/12_windows.php';
    const DOMAIN_REGEX = /^([a-z0-9-]+\.)+[a-z0-9-]{2,}$/;
    const SERVER_COUNT = 8;

    const extractDomain = (line) => {
        const trimmed = line.trim().toLowerCase();
        if (!trimmed) return null;
        return trimmed
            .replace(/(https?:\/\/)?/, '')
            .split('/')[0]
            .split(':')[0];
    };

    const normalizeDomains = (text) => {
        const domains = new Set();
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            const domain = extractDomain(line);
            if (domain && DOMAIN_REGEX.test(domain)) {
                domains.add(domain);
            }
        }
        return Array.from(domains);
    };

    const findDuplicate = (currentServer, domains) => {
        if (domains.length === 0) return null;
        for (let server = 1; server <= SERVER_COUNT; server++) {
            if (server === currentServer) continue;
            const element = document.getElementById(`my-server-${server}-links`);
            if (!element || !element.value.trim()) continue;
            const otherDomains = normalizeDomains(element.value);
            for (const domain of domains) {
                if (otherDomains.includes(domain)) {
                    return { domain, server };
                }
            }
        }
        return null;
    };

    const getServerElements = (serverNumber) => ({
        startBtn: document.getElementById(`start-main-server-${serverNumber}`),
        stopBtn: document.getElementById(`stop-main-server-${serverNumber}`),
        strategyInput: document.getElementById(`my-server-${serverNumber}-strategy`),
        saveStrategyBtn: document.getElementById(`save-strategy-main-server-${serverNumber}`),
        cleanStrategyBtn: document.getElementById(`clean-my-server-${serverNumber}-strategy`),
        linksTextarea: document.getElementById(`my-server-${serverNumber}-links`),
        saveDomainsBtn: document.getElementById(`save-domains-main-server-${serverNumber}`),
        hostSelect: document.getElementById(`select-use-domains-list-or-not-${serverNumber}`),
        cleanMainServerBtn: document.getElementById(`clean-main-server-${serverNumber}`)
    });

    const lockUINonButtonElements = (elements) => {
        if (elements.strategyInput) elements.strategyInput.disabled = true;
        if (elements.saveStrategyBtn) elements.saveStrategyBtn.disabled = true;
        if (elements.cleanStrategyBtn) elements.cleanStrategyBtn.disabled = true;
        if (elements.linksTextarea) elements.linksTextarea.disabled = true;
        if (elements.saveDomainsBtn) elements.saveDomainsBtn.disabled = true;
        if (elements.hostSelect) elements.hostSelect.disabled = true;
        if (elements.cleanMainServerBtn) elements.cleanMainServerBtn.disabled = true;
    };

    const unlockUINonButtonElements = (elements) => {
        if (elements.strategyInput) elements.strategyInput.disabled = false;
        if (elements.saveStrategyBtn) elements.saveStrategyBtn.disabled = false;
        if (elements.cleanStrategyBtn) elements.cleanStrategyBtn.disabled = false;
        if (elements.linksTextarea) elements.linksTextarea.disabled = false;
        if (elements.saveDomainsBtn) elements.saveDomainsBtn.disabled = false;
        if (elements.hostSelect) elements.hostSelect.disabled = false;
        if (elements.cleanMainServerBtn) elements.cleanMainServerBtn.disabled = false;
    };

    const toggleServerState = (elements, isRunning) => {
        if (elements.startBtn) {
            elements.startBtn.hidden = isRunning;
            elements.startBtn.disabled = false;
        }
        if (elements.stopBtn) {
            elements.stopBtn.hidden = !isRunning;
            elements.stopBtn.disabled = false;
        }
    };

    const validateServerConfig = (serverConfig) => {
        const errors = [];
        if (!serverConfig.ciadpiPath) errors.push('путь к ciadpi');
        if (!serverConfig.ipForRun) errors.push('IP для запуска');
        if (!serverConfig.port) errors.push('порт');
        
        if (errors.length > 0) {
            throw new Error(`Для (Byedpi для использования ${serverConfig.serverNumber}) отсутствует: ${errors.join(', ')}`);
        }
    };

    const sendRequest = async (postData) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            const response = await fetch(MANAGEMENT_FILE_PATH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                body: JSON.stringify(postData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            const errorMessage = error.name === 'AbortError' 
                ? 'Сработал таймаут' 
                : error.message;
            throw new Error(`Ошибка запроса: ${errorMessage}`);
        }
    };

    const saveStrategy = async (serverNumber, strategy) => {
        const response = await fetch('php/9_save_strategy.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ciadpi_для_использования: {
                    [`процесс_${serverNumber}`]: { 
                        последняя_используемая_стратегия: strategy 
                    }
                }
            })
        });
        
        if (!response.ok) {
            let errorText = 'Ошибка сети при сохранении стратегии';
            try {
                const errorData = await response.json();
                errorText = errorData.сообщение || errorText;
            } catch {
                errorText = await response.text();
            }
            throw new Error(errorText);
        }
        
        const data = await response.json();
        if (!data.результат) {
            throw new Error(data.сообщение || 'Неизвестная ошибка при сохранении стратегии');
        }
    };

    const saveDomains = async (serverNumber, domainsText) => {
        const domains = normalizeDomains(domainsText);
        
        const duplicate = findDuplicate(serverNumber, domains);
        if (duplicate) {
            throw new Error(`Домен "${duplicate.domain}" уже используется на (Byedpi для использования ${duplicate.server})`);
        }
        
        const response = await fetch('php/10_save_domains.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ciadpi_для_использования: {
                    [`процесс_${serverNumber}`]: { домены: domains }
                }
            })
        });
        
        if (!response.ok) {
            let errorText = 'Ошибка сети при сохранении доменов';
            try {
                const errorData = await response.json();
                errorText = errorData.сообщение || errorText;
            } catch {
                errorText = await response.text();
            }
            throw new Error(errorText);
        }
        
        const data = await response.json();
        if (!data.результат) {
            throw new Error(data.сообщение || 'Неизвестная ошибка при сохранении доменов');
        }
    };

    const handleStart = async (serverNumber) => {
        const elements = getServerElements(serverNumber);
        const serverConfig = {
            serverNumber,
            ciadpiPath: window.appConfig?.ciadpi_для_использования?.[`процесс_${serverNumber}`]?.полный_путь,
            ipForRun: window.appConfig?.ciadpi_для_использования?.[`процесс_${serverNumber}`]?.ip_для_запуска,
            port: window.appConfig?.ciadpi_для_использования?.[`процесс_${serverNumber}`]?.tcp_порт,
            hostsFilePath: window.appConfig?.ciadpi_для_использования?.[`процесс_${serverNumber}`]?.полный_путь_к_хост_листу
        };

        try {
            elements.startBtn.disabled = true;
            lockUINonButtonElements(elements);

            validateServerConfig(serverConfig);
            
            let strategy = (elements.strategyInput?.value || '').trim();
            if (!strategy) {
                throw new Error('Стратегия не указана');
            }
            if (elements.strategyInput) {
                elements.strategyInput.value = strategy;
            }
            
            await saveStrategy(serverNumber, strategy);
            
            const domains = normalizeDomains(elements.linksTextarea?.value || '');
            const duplicate = findDuplicate(serverNumber, domains);
            if (duplicate) {
                throw new Error(`Домен "${duplicate.domain}" уже используется на (Byedpi для использования ${duplicate.server})`);
            }
            
            await saveDomains(serverNumber, elements.linksTextarea?.value || '');

            if (elements.linksTextarea) {
                const normalizedText = domains.join('\n');
                elements.linksTextarea.value = normalizedText;
            }

            const useHosts = elements.hostSelect?.value === 'true';

            if (domains.length === 0 && useHosts) {
                throw new Error('Введите домены или отключите использование хост файла');
            }
            
            let args = strategy;
            
            if (useHosts) {
                if (!serverConfig.hostsFilePath) {
                    throw new Error('Путь к хост файлу не настроен');
                }
                args = `"--hosts" "${serverConfig.hostsFilePath}" ${args}`;
            }

            const postData = {
                действие: "проверить_и_запустить",
                реальный_полный_путь: serverConfig.ciadpiPath,
                ip_для_запуска: serverConfig.ipForRun,
                порт: serverConfig.port,
                аргументы: args
            };
            
            const response = await sendRequest(postData);
            const data = await response.json();
            
            if (!response.ok || !data.результат) {
                const errorMessage = data.сообщение || `HTTP ошибка: ${response.status}`;
                throw new Error(errorMessage);
            }

            LogModule.logMessage('ИНФО', `(Byedpi для использования  ${serverNumber}) успешно запущен`);
            
            toggleServerState(elements, true);
        } catch (error) {
            LogModule.logMessage('ОШИБКА', `Ошибка запуска (Byedpi для использования ${serverNumber}): ${error.message}`);
            
            toggleServerState(elements, false);
            unlockUINonButtonElements(elements);
        } finally {
            elements.startBtn.disabled = false;
        }
    };

    const handleStop = async (serverNumber) => {
        const elements = getServerElements(serverNumber);
        const serverConfig = {
            serverNumber,
            ciadpiPath: window.appConfig?.ciadpi_для_использования?.[`процесс_${serverNumber}`]?.полный_путь,
            port: window.appConfig?.ciadpi_для_использования?.[`процесс_${serverNumber}`]?.tcp_порт
        };

        try {
            elements.stopBtn.disabled = true;
            
            if (!serverConfig.ciadpiPath) throw new Error('Путь к ciadpi не указан');
            if (!serverConfig.port) throw new Error('Порт не указан');

            const postData = {
                действие: "проверить_и_завершить",
                реальный_полный_путь: serverConfig.ciadpiPath,
                порт: serverConfig.port
            };

            const response = await sendRequest(postData);
            const data = await response.json();

            if (!response.ok || !data.результат) {
                const errorMessage = data.сообщение || `HTTP ошибка: ${response.status}`;
                throw new Error(errorMessage);
            }

            LogModule.logMessage('ИНФО', `(Byedpi для использования ${serverNumber}) успешно остановлен`);
            
            toggleServerState(elements, false);
            unlockUINonButtonElements(elements);
        } catch (error) {
            LogModule.logMessage('ОШИБКА', `Ошибка остановки (Byedpi для использования ${serverNumber}): ${error.message}`);
            elements.stopBtn.disabled = false;
        }
    };

    const initialize = () => {
        for (let i = 1; i <= 8; i++) {
            const elements = getServerElements(i);
            if (elements.startBtn) {
                elements.startBtn.addEventListener('click', () => handleStart(i));
            }
            if (elements.stopBtn) {
                elements.stopBtn.addEventListener('click', () => handleStop(i));
            }
        }
    };

    return {
        initialize
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('start-main-server-1')) {
        ServerController.initialize();
    }
});