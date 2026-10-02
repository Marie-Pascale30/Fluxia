// Message de confirmation d'une Server Action, transmis par cookie et affiché
// par <FlashToast /> au rendu suivant — même si le composant à l'origine de
// l'action a disparu entre-temps (formulaire masqué, redirection…).

export const FLASH_COOKIE = 'fluxia-flash';

/** Valeur stockée : "<identifiant unique>|<message>" (l'identifiant évite les doublons). */
export const encodeFlash = (message: string) => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}|${message}`;

export function decodeFlash(value: string | undefined): { id: string; message: string } | null {
    if (!value) return null;
    const separator = value.indexOf('|');
    if (separator < 0) return null;
    return { id: value.slice(0, separator), message: value.slice(separator + 1) };
}
