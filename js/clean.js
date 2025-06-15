const ClearManager = (() => {
    const setupHandler = (buttonId, targetId) => {
        const button = document.getElementById(buttonId);
        if (!button) return;

        button.addEventListener('click', () => {
            const target = document.getElementById(targetId);
            if (!target) {
                LogModule.logMessage('ОШИБКА', `Элемент ${targetId} не найден`);
                return;
            }

            const currentValue = 'value' in target ? target.value : target.textContent;
            if (!currentValue.trim()) {
                LogModule.logMessage('ИНФО', 'Пусто');
                return;
            }

            if ('value' in target) {
                target.value = '';
            } else {
                target.textContent = '';
            }

            LogModule.logMessage('ИНФО', 'Очищено');
        });
    };

    return {
        init: () => {
            setupHandler('clear-strategies', 'generated-strategies');
            setupHandler('clear-links', 'links');

            for (let i = 1; i <= 8; i++) {
                setupHandler(`clean-main-server-${i}`, `my-server-${i}-links`);
                setupHandler(`clean-my-server-${i}-strategy`, `my-server-${i}-strategy`);
            }
        }
    };
})();

document.addEventListener('DOMContentLoaded', ClearManager.init);