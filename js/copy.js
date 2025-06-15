const CopyManager = (() => {
    const WHATCOPY = {
        TEXT: 'text',
        TEXT_FROM_DIV: 'textFromDiv',
        DOMAINS: 'domains',
        STRATEGIES: 'strategies'
    };

    const registerHandlers = (handlers) => {
        handlers.forEach(({ buttonId, targetId, strategy }) => {
            const button = document.getElementById(buttonId);
            if (!button) return;

            button.addEventListener('click', () => {
                const target = document.getElementById(targetId);
                if (!target) {
                    logError(`Элемент с ID ${targetId} не найден`);
                    return;
                }
                executeCopy(target, strategy);
            });
        });
    };

    const executeCopy = async (element, strategy) => {
        try {
            const text = extractContent(element, strategy);
            if (!text) {
                logInfo('Копировать нечего');
                return;
            }
            await copyToClipboard(text);
            logInfo('Текст успешно скопирован');
        } catch (error) {
            logError(`Ошибка при копировании: ${error.message}`);
        }
    };

    const extractContent = (element, strategy) => {
        const extractors = {
            [WHATCOPY.TEXT]: () => (element.value || element.textContent || '').trim(),
            [WHATCOPY.TEXT_FROM_DIV]: () => {
                return (element.innerText || '')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line)
                    .join('\n');
            },
            [WHATCOPY.DOMAINS]: () => {
                const text = element.value || '';
                const domains = [...new Set(
                    text.split('\n')
                        .map(line => line.trim())
                        .filter(line => line)
                        .map(line => extractDomain(line))
                        .filter(domain => domain)
                )];
                
                domains.sort((a, b) => {
                    const aParts = a.split('.').length;
                    const bParts = b.split('.').length;
                    return bParts - aParts;
                });
                
                return domains.join('\n');
            },
            [WHATCOPY.STRATEGIES]: () => {
                return (element.innerText || '')
                    .split('\n')
                    .filter(line => line.includes('Стратегия:'))
                    .map(line => line.split('Стратегия:')[1]?.trim() || '')
                    .filter(strategy => strategy)
                    .join('\n');
            }
        };

        return extractors[strategy]();
    };

    const extractDomain = (line) => {
        try {
            const urlStr = line.includes('://') ? line : `https://${line}`;
            const url = new URL(urlStr);
            return url.hostname.replace(/:\d+$/, '');
        } catch {
            return null;
        }
    };

    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return;
            }
            fallbackCopy(text);
        } catch (error) {
            fallbackCopy(text);
        }
    };

    const fallbackCopy = (text) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            const success = document.execCommand('copy');
            if (!success) throw new Error('Не удалось выполнить копирование');
        } finally {
            document.body.removeChild(textarea);
        }
    };

    const logInfo = (message) => LogModule.logMessage('ИНФО', message);
    const logError = (message) => LogModule.logMessage('ОШИБКА', message);

    return {
        init: () => {
            registerHandlers([
                { buttonId: 'copy-pac-link', targetId: 'pac-link', strategy: WHATCOPY.TEXT },
                { buttonId: 'copy-result', targetId: 'result', strategy: WHATCOPY.TEXT_FROM_DIV },
                { buttonId: 'copy-links', targetId: 'links', strategy: WHATCOPY.TEXT },
                { buttonId: 'copy-links-domains', targetId: 'links', strategy: WHATCOPY.DOMAINS },
                { buttonId: 'copy-generated-strategies', targetId: 'generated-strategies', strategy: WHATCOPY.TEXT },
                { buttonId: 'copy-result-strategies', targetId: 'result', strategy: WHATCOPY.STRATEGIES }
            ]);

            for (let i = 1; i <= 8; i++) {
                registerHandlers([
                    { buttonId: `copy-main-server-${i}`, targetId: `my-server-${i}-links`, strategy: WHATCOPY.DOMAINS },
                    { buttonId: `copy-my-server-${i}-strategy`, targetId: `my-server-${i}-strategy`, strategy: WHATCOPY.TEXT }
                ]);
            }
        }
    };
})();

document.addEventListener('DOMContentLoaded', CopyManager.init);