import { maskEmail, maskPhone, maskRecipient } from './mask.js';

describe('masquage des coordonnées dans les journaux', () => {
    it('masque un email en gardant la première lettre et le domaine', () => {
        expect(maskEmail('julien.dupont@fluxia.fr')).toBe('j***@fluxia.fr');
        expect(maskEmail('pas-un-email')).toBe('***');
    });

    it('masque un numéro en gardant l’indicatif et les deux derniers chiffres', () => {
        expect(maskPhone('+33 6 12 34 56 78')).toBe('+33*******78');
        expect(maskPhone('06 12 34 56 78')).toBe('06******78');
        expect(maskPhone('123')).toBe('***');
    });

    it('choisit selon le type de destinataire', () => {
        expect(maskRecipient('a@b.fr')).toBe('a***@b.fr');
        expect(maskRecipient('0612345678')).toBe('06******78');
    });
});
