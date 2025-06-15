const GeneratorValueTypeHandler = (() => {
    const VALUE_TYPE_CONFIG = [
        { typeId: 'gen-mod-http-value-type', valueId: 'gen-mod-http-value', elementType: 'select' },
        { typeId: 'gen-oob-data-value-type', valueId: 'gen-oob-data-value', elementType: 'input' },
        { typeId: 'gen-ttl-value-type', valueId: 'gen-ttl-value', elementType: 'input' },
        { typeId: 'gen-fake-data-value-type', valueId: 'gen-fake-data-value', elementType: 'input' },
        { typeId: 'gen-fake-sni-value-type', valueId: 'gen-fake-sni-value', elementType: 'input' },
        { typeId: 'gen-fake-tls-mod-value-type', valueId: 'gen-fake-tls-mod-value', elementType: 'select' }
    ];

    const getElement = (id) => document.getElementById(id);

    const isFixedValue = (selectElement) => selectElement?.value === 'fixed-value';

    const updateElementVisibility = (valueElement, isVisible) => {
        if (!valueElement) return;
        valueElement.style.display = isVisible ? '' : 'none';
    };

    const configureElementPair = (config) => {
        try {
            const typeSelect = getElement(config.typeId);
            const valueElement = getElement(config.valueId);

            if (!typeSelect || !valueElement) {
                throw new Error('Элементы DOM не найдены');
            }

            const handleVisibility = () => {
                const visible = isFixedValue(typeSelect);
                updateElementVisibility(valueElement, visible);
            };

            typeSelect.addEventListener('change', handleVisibility);
            handleVisibility();

            return true;
        } catch (error) {
            LogModule.logMessage('ОШИБКА', `Ошибка настройки видимости: ${error.message}`);
            return false;
        }
    };

    return {
        init: () => {
            VALUE_TYPE_CONFIG.forEach(config => configureElementPair(config));
        }
    };
})();

document.addEventListener('DOMContentLoaded', GeneratorValueTypeHandler.init);