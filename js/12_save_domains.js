// 12_save_domains.js
const DomainManager = (() => {

function extractDomain(line) {
    let trimmed = line.trim().toLowerCase();
    if (!trimmed) return null;
    
    const protocolIndex = trimmed.indexOf('://');
    if (protocolIndex !== -1) {
        trimmed = trimmed.substring(protocolIndex + 3);
    }
    
    return trimmed.split('/')[0].split(':')[0].split('?')[0];
}

    function isValidDomain(domain) {
        return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain);
    }

    function normalizeDomains(text) {
        const lines = text.split(/\r?\n/);
        const domains = new Set();
        
        for (const line of lines) {
            const domain = extractDomain(line);
            if (domain && isValidDomain(domain)) {
                domains.add(domain);
            }
        }
        
        return [...domains];
    }

function findDuplicate(server, domains) {
    for (let otherServer = 1; otherServer <= 8; otherServer++) {
        if (otherServer === server) continue;
        
        const element = document.getElementById(`my-server-${otherServer}-links`);
        if (!element?.value) continue;
        
        const otherDomains = normalizeDomains(element.value);
        for (const domain of domains) {
            if (otherDomains.includes(domain)) {
                return { domain, server: otherServer };
            }
        }
    }
    return null;
}

async function sendToServer(server, domainsArray) {
    const data = {
        ciadpi_для_использования: {
            [`процесс_${server}`]: {
                домены: domainsArray
            }
        }
    };
    
    try {
        const response = await fetch('php/10_save_domains.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const responseText = await response.text();
        
        try {
            const result = JSON.parse(responseText);
            if (!response.ok) {
                throw new Error(result.сообщение || `Ошибка HTTP: ${response.status}`);
            }
            return result;
        } catch (e) {
            throw new Error(responseText.trim().split('\n').pop() || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        throw new Error(`Ошибка при сохранении доменов: ${error.message}`);
    }
}

    async function processDomains(server) {
        const element = document.getElementById(`my-server-${server}-links`);
        if (!element) {
            throw new Error(`Элемент для сервера ${server} не найден`);
        }

        const originalText = element.value;
        const domains = normalizeDomains(originalText);
        element.value = domains.join('\n');

        if (domains.length > 0) {
            const duplicate = findDuplicate(server, domains);
            if (duplicate) {
                throw new Error(
                    `Домен "${duplicate.domain}" найден в текущем блоке и блоке сервера ${duplicate.server}.`
                );
            }
        }

        return sendToServer(server, domains);
    }

    return { processDomains };
})();

document.addEventListener('DOMContentLoaded', () => {
    for (let server = 1; server <= 8; server++) {
        const button = document.getElementById(`save-domains-main-server-${server}`);
        button?.addEventListener('click', async (event) => {
            event.preventDefault();
            
            try {
                const result = await DomainManager.processDomains(server);
                const status = result.результат;
                const message = result.сообщение;
                
                LogModule.logMessage(status ? 'ИНФО' : 'ОШИБКА', message);
            } catch (error) {
                LogModule.logMessage('ОШИБКА', `Ошибка при сохранении доменов для (ciadpi для использования ${server}): ${error.message}`);
            }
        });
    }
});