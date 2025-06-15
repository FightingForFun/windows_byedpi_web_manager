const StrategyManagerX = (() => {
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

    const sendData = async (server, strategy) => {
        const response = await fetch('php/9_save_strategy.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ciadpi_для_использования: {
                    [`процесс_${server}`]: { последняя_используемая_стратегия: strategy }
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
        const element = document.getElementById(`my-server-${server}-strategy`);
        if (!element) {
            throw new Error(`Элемент для (Byedpi для использования ${server}) не найден`);
        }

        const strategy = element.value.trim();
		element.value = strategy;
        return sendData(server, strategy);
    };

    const initEventListeners = () => {
        for (let server = 1; server <= SERVER_COUNT; server++) {
            const button = document.getElementById(`save-strategy-main-server-${server}`);
            if (!button) continue;

            button.addEventListener('click', async (event) => {
                event.preventDefault();
                lockUI(server);

                try {
                    const result = await processServer(server);
                    const tag = result.результат ? 'ИНФО' : 'ОШИБКА';
                    LogModule.logMessage(tag, result.сообщение);
                } catch (error) {
                    LogModule.logMessage('ОШИБКА', `Ошибка сохранения стратегии для (Byedpi для использования ${server}): ${error.message}`);
                } finally {
                    unlockUI(server);
                }
            });
        }
    };

    return { init: initEventListeners };
})();

document.addEventListener('DOMContentLoaded', StrategyManagerX.init);