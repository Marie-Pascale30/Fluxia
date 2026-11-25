// Masquage des coordonnées dans les journaux techniques : assez pour diagnostiquer, pas assez pour identifier.

/** julien.dupont@fluxia.fr → j***@fluxia.fr */
export function maskEmail(email: string): string {
    const at = email.lastIndexOf('@');
    if (at < 1) return '***';
    return `${email[0]}***${email.slice(at)}`;
}

/** +33 6 12 34 56 78 → +33******78 (indicatif et deux derniers chiffres) */
export function maskPhone(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.length < 6) return '***';
    const prefix = digits.startsWith('+') ? digits.slice(0, 3) : digits.slice(0, 2);
    return `${prefix}${'*'.repeat(Math.max(3, digits.length - prefix.length - 2))}${digits.slice(-2)}`;
}

/** Destinataire d'un message (email ou téléphone), masqué. */
export const maskRecipient = (recipient: string) => (recipient.includes('@') ? maskEmail(recipient) : maskPhone(recipient));
