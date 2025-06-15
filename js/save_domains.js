const DomainManager = (() => {
    const DOMAIN_REGEX = /^([a-z0-9-]+\.)+[a-z0-9-]{2,}$/;
    const SERVER_COUNT = 8;

    const lockUI = (server) => {
        const elements = [
            `my-server-${server}-strategy`,
            `save-strategy-main-server-${server}`,
            `copy-my-server-${server}-strategy`,
            `clean-my-server-${server}-strategy`,
            `my-server-${server}-links`,
            `save-domains-main-server-${server}`,
            `select-use-domains-list-or-not-${server}`,
            `copy-main-server-${server}`,
            `clean-main-server-${server}`,
            `start-main-server-${server}`
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.disabled = true;
        });
    };

    const unlockUI = (server) => {
        const elements = [
            `my-server-${server}-strategy`,
            `save-strategy-main-server-${server}`,
            `copy-my-server-${server}-strategy`,
            `clean-my-server-${server}-strategy`,
            `my-server-${server}-links`,
            `save-domains-main-server-${server}`,
            `select-use-domains-list-or-not-${server}`,
            `copy-main-server-${server}`,
            `clean-main-server-${server}`,
            `start-main-server-${server}`
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.disabled = false;
        });
    };

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

    const sendData = async (server, domains) => {
        const response = await fetch('php/10_save_domains.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ciadpi_для_использования: {
                    [`процесс_${server}`]: { домены: domains }
                }
            })
        });

        if (!response.ok) {
            let errorText = 'Ошибка сети';
            try {
                const errorData = await response.json();
                errorText = errorData.сообщение || errorText;
            } catch {
                errorText = await response.text();
            }
            throw new Error(errorText);
        }

        return response.json();
    };

    const processServer = async (server) => {
        const element = document.getElementById(`my-server-${server}-links`);
        if (!element) {
            throw new Error(`Элемент для (Byedpi для использования ${server}) не найден`);
        }

        const domains = normalizeDomains(element.value);
        element.value = domains.join('\n');

        const duplicate = findDuplicate(server, domains);
        if (duplicate) {
            throw new Error(`Домен "${duplicate.domain}" уже используется на (Byedpi для использования ${duplicate.server})`);
        }

        return sendData(server, domains);
    };

    const initEventListeners = () => {
        for (let server = 1; server <= SERVER_COUNT; server++) {
            const button = document.getElementById(`save-domains-main-server-${server}`);
            if (!button) continue;

            button.addEventListener('click', async (event) => {
                event.preventDefault();
                lockUI(server);

                try {
                    const result = await processServer(server);
                    const tag = result.результат ? 'ИНФО' : 'ОШИБКА';
                    LogModule.logMessage(tag, result.сообщение);
                } catch (error) {
                    LogModule.logMessage('ОШИБКА', `Ошибка сохранения доменов для (Byedpi для использования ${server}): ${error.message}`);
                } finally {
                    unlockUI(server);
                }
            });
        }
    };

    return {
        init: initEventListeners
    };
})();

document.addEventListener('DOMContentLoaded', DomainManager.init);