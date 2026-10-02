// Notification éphémère (hors du store : purement visuelle).

export function createToast(element, duration = 2200) {
    let timer;

    return function toast(message) {
        element.textContent = message;
        element.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(() => element.classList.remove('show'), duration);
    };
}
