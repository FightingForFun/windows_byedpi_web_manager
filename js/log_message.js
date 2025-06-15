const LogModule = (() => {
    const LOG_LEVELS = {
        'log-level-error': { allowedTags: ['ОШИБКА'] },
        'log-level-info-plus-error': { allowedTags: ['ИНФО', 'ОШИБКА'] },
        'log-level-info-plus-error-plus-debug': { allowedTags: ['ИНФО', 'ОШИБКА', 'ОТЛАДКА'] },
        'log-level-hide-all': { allowedTags: [] }
    };

    let allLogMessages = [];
    let toastContainer = null;

    const getDomElement = id => document.getElementById(id) || null;

    const isScrolledToBottom = element => element.scrollHeight - element.clientHeight <= element.scrollTop + 10;

    const formatMessage = (tag, message) => {
        const tagStyles = {
            'ОШИБКА': { class: 'error', template: tag => `<span class="log-tag error">[${tag}]</span>` },
            'ОТЛАДКА': { class: 'debug', template: tag => `<span class="log-tag debug">[${tag}]</span>` },
            'ИНФО': { class: 'info', template: tag => `<span class="log-tag info">[${tag}]</span>` }
        };
        const style = tagStyles[tag] || { template: tag => `[${tag}]` };
        return `${style.template(tag)}: ${message}<br>`;
    };

    const ToastManager = {
        createContainer() {
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.className = 'toast-container';
                document.body.appendChild(toastContainer);
            }
            return toastContainer;
        },
        show(tag, message) {
            const container = this.createContainer();
            if (!container) {
                return;
            }
            const toast = document.createElement('div');
            toast.className = `toast ${tag === 'ИНФО' ? 'info' : 'error'}`;
            toast.textContent = `[${tag}] ${message}`;
            container.prepend(toast);
            const timer = setTimeout(() => {
                toast.style.animation = 'fadeOut 0.3s forwards';
                toast.addEventListener('animationend', () => {
                    toast.remove();
                    this.cleanupContainer(container);
                });
            }, 3000);
            this.limitToasts(container);
            toast.dataset.timer = timer;
        },
        limitToasts(container) {
            const toasts = container.querySelectorAll('.toast');
            if (toasts.length <= 20) {
                return;
            }
            toasts.forEach((toast, index) => {
                if (index >= 20) {
                    clearTimeout(toast.dataset.timer);
                    toast.remove();
                }
            });
        },
        cleanupContainer(container) {
            if (container.children.length === 0) {
                container.remove();
                toastContainer = null;
            }
        }
    };

    const LogView = {
        update(messages) {
            const logArea = getDomElement('log');
            if (!logArea) {
                return;
            }
            const previousScroll = logArea.scrollTop;
            const wasAtBottom = isScrolledToBottom(logArea);
            logArea.innerHTML = messages.join('');
            if (wasAtBottom) {
                logArea.scrollTop = logArea.scrollHeight;
            } else {
                logArea.scrollTop = previousScroll;
            }
        }
    };

    const getLogLevel = () => {
        const select = getDomElement('log-level');
        return select?.value || 'log-level-info-plus-error';
    };

    const shouldShowInLog = (tag, level) => LOG_LEVELS[level]?.allowedTags?.includes(tag) ?? false;

    const shouldShowToast = tag => tag === 'ИНФО' || tag === 'ОШИБКА';

    const processLogMessage = (tag, message) => {
        try {
            let cleanMsg = message.trim().replace(/\.+$/, '');
            if (cleanMsg.length > 0) {
                cleanMsg += '.';
            }
            const level = getLogLevel();
            allLogMessages.push({ tag, message: cleanMsg });
            if (shouldShowInLog(tag, level)) {
                const logArea = getDomElement('log');
                if (logArea) {
                    const wasAtBottom = isScrolledToBottom(logArea);
                    logArea.innerHTML += formatMessage(tag, cleanMsg);
                    if (wasAtBottom) {
                        logArea.scrollTop = logArea.scrollHeight;
                    }
                }
            }
            if (shouldShowToast(tag)) {
                ToastManager.show(tag, cleanMsg);
            }
        } catch (error) {
            console.error('Ошибка в процессе логирования:', error);
        }
    };

    const updateLogView = () => {
        const level = getLogLevel();
        const filtered = allLogMessages
            .filter(({ tag }) => shouldShowInLog(tag, level))
            .map(({ tag, message }) => formatMessage(tag, message));
        LogView.update(filtered);
    };

    const init = () => {
        document.addEventListener('DOMContentLoaded', () => {
            const select = getDomElement('log-level');
            if (select) {
                select.addEventListener('change', updateLogView);
            }
        });
    };

    init();

    return {
        logMessage: processLogMessage,
        updateLogVisibility: updateLogView
    };
})();

window.LogModule = LogModule;