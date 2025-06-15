const GeneratorModule = (() => {
    const parameters = [
        { id: 'mod-http', weightId: 'gen-mod-http-weight', valueId: 'gen-mod-http-value', endOfString: true },
        { id: 'split', weightId: 'gen-split-weight', isDesync: true, modifiable: true },
        { id: 'disorder', weightId: 'gen-disorder-weight', isDesync: true, modifiable: true },
        { id: 'oob', weightId: 'gen-oob-weight', isDesync: true, modifiable: true, hasAddons: ['oob-data'] },
        { id: 'disoob', weightId: 'gen-disoob-weight', isDesync: true, modifiable: true, hasAddons: ['oob-data'] },
        { id: 'tlsrec', weightId: 'gen-tlsrec-weight', isDesync: true, modifiable: true },
        { id: 'fake', weightId: 'gen-fake-weight', isDesync: true, modifiable: true, hasAddons: ['fake-offset', 'ttl', 'fake-data', 'fake-sni', 'fake-tls-mod'] },
        { id: 'fake-offset', weightId: 'gen-fake-offset-weight', modifiable: true },
        { id: 'ttl', weightId: 'gen-ttl-weight', valueId: 'gen-ttl-value' },
        { id: 'fake-data', weightId: 'gen-fake-data-weight', valueId: 'gen-fake-data-value' },
        { id: 'fake-sni', weightId: 'gen-fake-sni-weight', valueId: 'gen-fake-sni-value' },
        { id: 'fake-tls-mod', weightId: 'gen-fake-tls-mod-weight', valueId: 'gen-fake-tls-mod-value' },
        { id: 'oob-data', weightId: 'gen-oob-data-weight', valueId: 'gen-oob-data-value' },
    ];

    const modifiers = [
        { id: 'empty', weightId: 'gen-weight', flag: '', offsetFromId: 'gen-offset-from-value', offsetToId: 'gen-offset-to-value', repeatFromId: 'gen-repeat-from-value', repeatToId: 'gen-repeat-to-value', skipFromId: 'gen-skip-from-value', skipToId: 'gen-skip-to-value' },
        { id: 'n', weightId: 'gen-n-weight', flag: '+n', offsetFromId: 'gen-n-offset-from-value', offsetToId: 'gen-n-offset-to-value', repeatFromId: 'gen-n-repeat-from-value', repeatToId: 'gen-n-repeat-to-value', skipFromId: 'gen-n-skip-from-value', skipToId: 'gen-n-skip-to-value' },
        { id: 'nm', weightId: 'gen-nm-weight', flag: '+nm', offsetFromId: 'gen-nm-offset-from-value', offsetToId: 'gen-nm-offset-to-value', repeatFromId: 'gen-nm-repeat-from-value', repeatToId: 'gen-nm-repeat-to-value', skipFromId: 'gen-nm-skip-from-value', skipToId: 'gen-nm-skip-to-value' },
        { id: 'ne', weightId: 'gen-ne-weight', flag: '+ne', offsetFromId: 'gen-ne-offset-from-value', offsetToId: 'gen-ne-offset-to-value', repeatFromId: 'gen-ne-repeat-from-value', repeatToId: 'gen-ne-repeat-to-value', skipFromId: 'gen-ne-skip-from-value', skipToId: 'gen-ne-skip-to-value' },
        { id: 's', weightId: 'gen-s-weight', flag: '+s', offsetFromId: 'gen-s-offset-from-value', offsetToId: 'gen-s-offset-to-value', repeatFromId: 'gen-s-repeat-from-value', repeatToId: 'gen-s-repeat-to-value', skipFromId: 'gen-s-skip-from-value', skipToId: 'gen-s-skip-to-value' },
        { id: 'sm', weightId: 'gen-sm-weight', flag: '+sm', offsetFromId: 'gen-sm-offset-from-value', offsetToId: 'gen-sm-offset-to-value', repeatFromId: 'gen-sm-repeat-from-value', repeatToId: 'gen-sm-repeat-to-value', skipFromId: 'gen-sm-skip-from-value', skipToId: 'gen-sm-skip-to-value' },
        { id: 'se', weightId: 'gen-se-weight', flag: '+se', offsetFromId: 'gen-se-offset-from-value', offsetToId: 'gen-se-offset-to-value', repeatFromId: 'gen-se-repeat-from-value', repeatToId: 'gen-se-repeat-to-value', skipFromId: 'gen-se-skip-from-value', skipToId: 'gen-se-skip-to-value' },
        { id: 'h', weightId: 'gen-h-weight', flag: '+h', offsetFromId: 'gen-h-offset-from-value', offsetToId: 'gen-h-offset-to-value', repeatFromId: 'gen-h-repeat-from-value', repeatToId: 'gen-h-repeat-to-value', skipFromId: 'gen-h-skip-from-value', skipToId: 'gen-h-skip-to-value' },
        { id: 'hm', weightId: 'gen-hm-weight', flag: '+hm', offsetFromId: 'gen-hm-offset-from-value', offsetToId: 'gen-hm-offset-to-value', repeatFromId: 'gen-hm-repeat-from-value', repeatToId: 'gen-hm-repeat-to-value', skipFromId: 'gen-hm-skip-from-value', skipToId: 'gen-hm-skip-to-value' },
        { id: 'he', weightId: 'gen-he-weight', flag: '+he', offsetFromId: 'gen-he-offset-from-value', offsetToId: 'gen-he-offset-to-value', repeatFromId: 'gen-he-repeat-from-value', repeatToId: 'gen-he-repeat-to-value', skipFromId: 'gen-he-skip-from-value', skipToId: 'gen-he-skip-to-value' },
    ];

    const getValue = (id) => document.getElementById(id)?.value || '';
    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const getRandomModHttpValue = () => {
        const options = ['h', 'd', 'r', 'h,d', 'h,r', 'd,r', 'h,d,r'];
        return options[Math.floor(Math.random() * options.length)];
    };

    const getRandomOobDataValue = () => {
        const byte = getRandomInt(0, 255);
        return '\\x' + byte.toString(16).padStart(2, '0').toUpperCase();
    };

    const getRandomTtlValue = () => String(getRandomInt(1, 12));

    const getRandomFakeDataValue = () => {
        const length = getRandomInt(1, 32);
        let result = '';
        for (let i = 0; i < length; i++) {
            const byte = getRandomInt(0, 255);
            result += '\\x' + byte.toString(16).padStart(2, '0').toUpperCase();
        }
        return result;
    };

    const getRandomFakeSniValue = () => {
        const domains = [
            'example.com', 'vk.com', 'lenta.ru',
            'yandex.ru', 'apple.com', 'microsoft.com',
            'amazon.com', 'ebay.com', 'aliexpress.com',
            'rutube.ru', 'wikipedia.org', 'mail.ru',
            'plvideo.ru', 'reg.ru', 'ozon.ru',
            'lg.com', 'samsung.com', 'rutube.sport',
            'rustore.ru', '3dnews.ru', 'vk.company',
            'sberbank.com', 'ixbt.com', 'dzen.ru',
            'wildberries.ru', 'mvideo.ru', '2gis.ru'
        ];
        return domains[Math.floor(Math.random() * domains.length)];
    };

    const getRandomFakeTlsModValue = () => {
        const options = ['r', 'o'];
        return options[Math.floor(Math.random() * options.length)];
    };

    const weightedRandomChoice = (items) => {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight === 0) return null;
        let random = Math.random() * totalWeight;
        for (const item of items) {
            random -= item.weight;
            if (random <= 0) return item;
        }
        return items[items.length - 1];
    };

    const validateDesyncParameters = () => {
        return parameters.some(param => param.isDesync && parseInt(getValue(param.weightId), 10) > 0);
    };

    const validateModifiers = () => {
        return modifiers.some(mod => parseInt(getValue(mod.weightId), 10) > 0);
    };

    const generateModifier = (modifier, modificatorChoice) => {
        const weight = parseInt(getValue(modifier.weightId), 10);
        if (weight === 0) return null;

        const offsetFrom = parseInt(getValue(modifier.offsetFromId), 10);
        const offsetTo = parseInt(getValue(modifier.offsetToId), 10);
        const repeatFrom = parseInt(getValue(modifier.repeatFromId), 10);
        const repeatTo = parseInt(getValue(modifier.repeatToId), 10);
        const skipFrom = parseInt(getValue(modifier.skipFromId), 10);
        const skipTo = parseInt(getValue(modifier.skipToId), 10);

        const offsetMin = Math.min(offsetFrom, offsetTo);
        const offsetMax = Math.max(offsetFrom, offsetTo);
        const repeatMin = Math.min(repeatFrom, repeatTo);
        const repeatMax = Math.max(repeatFrom, repeatTo);
        const skipMin = Math.min(skipFrom, skipTo);
        const skipMax = Math.max(skipFrom, skipTo);

        let offset = getRandomInt(offsetMin, offsetMax);

        if (modifier.id === 'empty') {
            if (modificatorChoice === 'offset-and-flag') {
                return `${offset}`;
            } else if (modificatorChoice === 'complex-and-flag') {
                const repeat = getRandomInt(repeatMin, repeatMax);
                const skip = getRandomInt(skipMin, skipMax);
                return `${offset}:${repeat}:${skip}`;
            }
        }

        if (modificatorChoice === 'offset-and-flag') {
            return `${offset}${modifier.flag}`;
        } else if (modificatorChoice === 'complex-and-flag') {
            const repeat = getRandomInt(repeatMin, repeatMax);
            const skip = getRandomInt(skipMin, skipMax);
            return `${offset}:${repeat}:${skip}${modifier.flag}`;
        }

        return null;
    };

    const generateParameterStrategy = (param, modificatorChoice, isDesyncInstance = false) => {
        const weight = parseInt(getValue(param.weightId), 10);
        if (weight === 0) return [];

        const tokens = [`--${param.id}`];

        if (param.valueId) {
            let value = '';
            const valueTypeElement = document.getElementById(`gen-${param.id}-value-type`);

            if (valueTypeElement && valueTypeElement.value === 'random-value') {
                switch (param.id) {
                    case 'mod-http': value = getRandomModHttpValue(); break;
                    case 'oob-data': value = getRandomOobDataValue(); break;
                    case 'ttl': value = getRandomTtlValue(); break;
                    case 'fake-data': value = getRandomFakeDataValue(); break;
                    case 'fake-sni': value = getRandomFakeSniValue(); break;
                    case 'fake-tls-mod': value = getRandomFakeTlsModValue(); break;
                    default: value = getValue(param.valueId);
                }
            } else {
                value = getValue(param.valueId);
            }

            if (param.id === 'fake-data') {
                tokens.push(`:${value}`);
            } else {
                tokens.push(value);
            }
        }

        if (param.modifiable) {
            const availableModifiers = modifiers.map(mod => ({ ...mod, weight: parseInt(getValue(mod.weightId), 10) }));
            const modifier = weightedRandomChoice(availableModifiers);
            if (modifier) {
                const modString = generateModifier(modifier, modificatorChoice);
                if (modString) tokens.push(modString);
            }
        }

        if (isDesyncInstance && param.hasAddons) {
            const addons = parameters.filter(p => param.hasAddons.includes(p.id)).map(addon => ({
                ...addon,
                weight: parseInt(getValue(addon.weightId), 10)
            }));

            const selectedAddons = addons.filter(addon => addon.weight > 0);
            for (const addon of selectedAddons) {
                if (Math.random() < addon.weight * 0.1) {
                    const addonTokens = generateParameterStrategy(addon, modificatorChoice, false);
                    tokens.push(...addonTokens);
                }
            }
        }

        return tokens;
    };

    const generateStrategies = () => {
        if (!validateDesyncParameters()) {
            LogModule.logMessage('ОШИБКА', 'Выберите хотя бы один десинхронизатор');
            return;
        }

        if (!validateModifiers()) {
            LogModule.logMessage('ОШИБКА', 'Выберите хотя бы один модификатор');
            return;
        }

        LogModule.logMessage('ИНФО', 'Генерация стратегий начата');

        const desyncCount = parseInt(getValue('gen-desync-count'), 10) || 1;
        const stringsCount = parseInt(getValue('gen-strings-count'), 10) || 1;
        const modificatorChoice = getValue('modificator-choise');

        const desyncParams = parameters
            .filter(p => p.isDesync)
            .map(p => ({ ...p, weight: parseInt(getValue(p.weightId), 10) }));

        const endParams = parameters
            .filter(p => p.endOfString)
            .map(p => ({ ...p, weight: parseInt(getValue(p.weightId), 10) }));

        const strategies = [];
        for (let i = 0; i < stringsCount; i++) {
            let strategyTokens = [];

            for (let j = 0; j < desyncCount; j++) {
                const param = weightedRandomChoice(desyncParams);
                if (!param) break;
                const tokens = generateParameterStrategy(param, modificatorChoice, true);
                strategyTokens.push(...tokens);
            }

            endParams.filter(p => p.weight > 0).forEach(param => {
                if (Math.random() < param.weight * 0.1) {
                    const tokens = generateParameterStrategy(param, modificatorChoice);
                    strategyTokens.push(...tokens);
                }
            });

            if (strategyTokens.length > 0) {
                strategies.push(strategyTokens.map(token => `"${token}"`).join(' '));
            }
        }

        const uniqueStrategies = [...new Set(strategies)];
        document.getElementById('generated-strategies').value = uniqueStrategies.join('\n').replace(/<br\s*\/?>/gi, '\n');

        LogModule.logMessage('ИНФО', `Сгенерировано ${strategies.length} стратегий`);
        LogModule.logMessage('ИНФО', `Уникальных стратегий: ${uniqueStrategies.length}`);
    };

    const init = () => {
        document.getElementById('generate').addEventListener('click', generateStrategies);
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', GeneratorModule.init);