const LinksModule = (() => {
    let textarea;
    let addButton;

    const removeSpaces = str => str.replace(/[ \t]+/g, '');
    const toLowerCase = str => str.toLowerCase();

    const validateText = (text, fullValidation = false) => {
        if (!text) return '';

        let lines = text.split('\n')
            .map(line => removeSpaces(line));

        if (fullValidation) {
            lines = lines.filter(line => line !== '');
            lines = lines.map(line => toLowerCase(line));

            const uniqueLines = [];
            const seen = new Set();
            for (const line of lines) {
                if (!seen.has(line)) {
                    seen.add(line);
                    uniqueLines.push(line);
                }
            }
            lines = uniqueLines;
        }

        return lines.join('\n');
    };

    const handleInputChange = e => {
        const target = e.target;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const oldValue = target.value;

        const newValue = validateText(oldValue);

        const calculateNewPosition = (pos, oldText, newText) => {
            const prefix = oldText.substring(0, pos);
            const removedCount = prefix.length - removeSpaces(prefix).length;
            return Math.max(0, pos - removedCount);
        };

        const newStart = calculateNewPosition(start, oldValue, newValue);
        const newEnd = calculateNewPosition(end, oldValue, newValue);

        target.value = newValue;
        target.setSelectionRange(newStart, newEnd);
    };

    const handleBlur = e => {
        const target = e.target;
        target.value = validateText(target.value, true);
    };

    const getSelectedGroup = selectElement => {
        const selectedGroup = selectElement.value;
        if (!selectedGroup) throw new Error('Группа ссылок не выбрана');
        return selectedGroup;
    };

    const getGroupLinks = groupName => {
        if (!window.appConfig || typeof window.appConfig !== 'object') {
            throw new Error('Конфигурация не загружена');
        }

        const links = window.appConfig.ссылки_по_умолчанию_для_проверки?.[groupName];

        if (!Array.isArray(links)) {
            throw new Error(`Данные о ссылках для группы "${groupName}" отсутствуют`);
        }

        if (links.length === 0) {
            throw new Error(`Группа "${groupName}" не содержит ссылок`);
        }

        return links;
    };

    const addDefaultLinks = () => {
        try {
            const selectElement = document.getElementById('select-links');
            if (!selectElement) throw new Error('Элемент #select-links не найден');

            const selectedGroup = getSelectedGroup(selectElement);
            const links = getGroupLinks(selectedGroup);

            const currentValue = textarea.value.trim();
            const newLinks = validateText(links.join('\n'), true);
            const separator = currentValue ? '\n' : '';

            textarea.value = currentValue + separator + newLinks;
            handleBlur({ target: textarea });
            textarea.scrollTop = textarea.scrollHeight;
            LogModule.logMessage('ИНФО', `Добавлено ${links.length} ссылок из группы "${selectedGroup}"`);
        } catch (error) {
            LogModule.logMessage('ОШИБКА', `Ошибка добавления ссылок: ${error.message}`);
        }
    };

    const init = () => {
        textarea = document.getElementById('links');
        if (!textarea) {
            LogModule.logMessage('ОШИБКА', 'Элемент textarea #links не найден');
            return;
        }

        textarea.addEventListener('input', handleInputChange);
        textarea.addEventListener('change', handleInputChange);
        textarea.addEventListener('blur', handleBlur);

        if (textarea.value.trim()) {
            handleBlur({ target: textarea });
        }

        addButton = document.getElementById('add-links');
        if (addButton) {
            addButton.addEventListener('click', addDefaultLinks);
        } else {
            LogModule.logMessage('ОШИБКА', 'Кнопка #add-links не найдена');
        }
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', LinksModule.init);