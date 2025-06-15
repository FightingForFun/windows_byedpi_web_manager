const InputValidator = (() => {
    const parsing = str => {
        const result = [];
        const escMap = {
            'r': '\r', 'n': '\n', 't': '\t',
            '\\': '\\', 'f': '\f', 'b': '\b',
            'v': '\v', 'a': '\x07'
        };

        for (let i = 0; i < str.length; i++) {
            if (str[i] !== '\\') {
                result.push(str.charCodeAt(i));
                continue;
            }

            if (++i >= str.length) return null;
            const c = str[i];

            if (escMap[c]) {
                result.push(escMap[c].charCodeAt(0));
                continue;
            }

            if (c === 'x') {
                if (i + 2 >= str.length) return null;
                const hex = str.substring(i + 1, i + 3);
                if (!/^[0-9A-Fa-f]{2}$/.test(hex)) return null;
                result.push(parseInt(hex, 16));
                i += 2;
                continue;
            }

            if (/^[0-7]$/.test(c)) {
                let octal = c;
                for (let j = 0; j < 2 && i + 1 < str.length && /^[0-7]$/.test(str[i + 1]); j++) {
                    octal += str[++i];
                }
                const byte = parseInt(octal, 8);
                if (byte > 0xFF) return null;
                result.push(byte);
                continue;
            }

            result.push(c.charCodeAt(0));
        }
        return new Uint8Array(result);
    };

    const validateOobData = value => {
        const bytes = parsing(value);
        return bytes !== null && bytes.length === 1;
    };

    const validateFakeData = value => parsing(value) !== null;

    const validateSniData = value => {
        const cleanValue = value.replace(/\s+/g, '').toLowerCase();
        if (cleanValue.length > 255 || cleanValue.length === 0) return false;
        const labels = cleanValue.split('.');
        if (labels.length < 2) return false;
        const labelRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            if (label.length === 0 || label.length > 63 || !labelRegex.test(label)) return false;
            if (i === labels.length - 1 && /^\d+$/.test(label)) return false;
        }
        return true;
    };

    const validateTtlData = value => {
        const cleanValue = value.replace(/\s+/g, '');
        if (cleanValue === '') return false;
        if (!/^-?\d+$/.test(cleanValue)) return false;
        const num = parseInt(cleanValue, 10);
        return num >= 1 && num <= 255;
    };

    return {
        validateOobData,
        validateFakeData,
        validateSniData,
        validateTtlData
    };
})();

const InputHandler = (() => {
    const settings = {
        oob: {
            default: 'a',
            type: 'Oob',
            error: {
                invalid: 'OOB-данные должны быть одним байтом после обработки escape-последовательностей',
                paste: 'Невозможно вставить некорректные OOB-данные'
            }
        },
        fake: {
            default: '\\x48\\x45\\x4c\\x4c\\x4f',
            type: 'Fake',
            error: {
                invalid: 'Некорректная escape-последовательность в fake-данных',
                paste: 'Невозможно вставить некорректные fake-данные'
            }
        },
        sni: {
            default: 'apple.com',
            type: 'Sni',
            error: {
                invalid: 'Некорректный формат FQDN (пример: example.com)',
                paste: 'Невозможно вставить некорректный FQDN'
            }
        },
        ttl: {
            default: '8',
            type: 'Ttl',
            error: {
                invalid: 'TTL должен быть числом от 1 до 255',
                paste: 'Невозможно вставить некорректный TTL'
            }
        }
    };

    const init = () => {
        const oobInput = document.getElementById('gen-oob-data-value');
        const fakeInput = document.getElementById('gen-fake-data-value');
        const sniInput = document.getElementById('gen-fake-sni-value');
        const ttlInput = document.getElementById('gen-ttl-value');

        oobInput.value = settings.oob.default;
        fakeInput.value = settings.fake.default;
        sniInput.value = settings.sni.default;
        ttlInput.value = settings.ttl.default;

        oobInput.addEventListener('change', () => validateInput(oobInput, 'oob'));
        fakeInput.addEventListener('change', () => validateInput(fakeInput, 'fake'));
        sniInput.addEventListener('change', () => validateInput(sniInput, 'sni'));
        ttlInput.addEventListener('change', () => validateInput(ttlInput, 'ttl'));

        oobInput.addEventListener('paste', (e) => handlePaste(e, oobInput, 'oob'));
        fakeInput.addEventListener('paste', (e) => handlePaste(e, fakeInput, 'fake'));
        sniInput.addEventListener('paste', (e) => handlePaste(e, sniInput, 'sni'));
        ttlInput.addEventListener('paste', (e) => handlePaste(e, ttlInput, 'ttl'));
    };

    const validateInput = (input, type) => {
        const setting = settings[type];
        const isValid = InputValidator[`validate${setting.type}Data`](input.value);

        if (!isValid) {
            LogModule.logMessage('ОШИБКА', `${setting.error.invalid}. Установлено значение по умолчанию`);
            input.value = setting.default;
        } else {
            if (type === 'sni') {
                input.value = input.value.replace(/\s+/g, '').toLowerCase();
            } else if (type === 'ttl') {
                input.value = input.value.replace(/\s+/g, '');
            }
        }
    };

    const handlePaste = (e, input, type) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('text');

        const setting = settings[type];
        const isValid = InputValidator[`validate${setting.type}Data`](pastedData);

        if (!isValid) {
            e.preventDefault();
            LogModule.logMessage('ОШИБКА', `${setting.error.paste}. Установлено значение по умолчанию`);
            input.value = setting.default;
        } else {
            e.preventDefault();
            if (type === 'sni') {
                input.value = pastedData.replace(/\s+/g, '').toLowerCase();
            } else if (type === 'ttl') {
                input.value = pastedData.replace(/\s+/g, '');
            } else {
                input.value = pastedData;
            }
        }
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', InputHandler.init);