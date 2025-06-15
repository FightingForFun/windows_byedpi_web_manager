document.addEventListener('click', (e) => {
    if (e.target.matches('button')) {
        e.target.blur();
    }
});

document.addEventListener('change', (e) => {
    if (e.target.matches('select')) {
        e.target.blur();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.target.matches('input') && e.key === 'Enter') {
        e.target.blur();
    }
});