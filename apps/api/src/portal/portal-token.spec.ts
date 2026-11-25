import { createPortalToken, readPortalToken } from './portal-token.js';

describe('jeton du portail client', () => {
    it('relit un jeton valide', () => {
        expect(readPortalToken(createPortalToken('client123', 2))).toEqual({ clientId: 'client123', version: 2 });
    });

    it('rejette un jeton falsifié ou tronqué', () => {
        const token = createPortalToken('client123', 1);
        const [payload] = token.split('.');
        const forged = `${Buffer.from(`autreclient.1.${Math.floor(Date.now() / 1000)}`).toString('base64url')}.${token.split('.')[1]}`;
        expect(readPortalToken(forged)).toBeNull();
        expect(readPortalToken(`${payload}.mauvaise-signature-mauvaise-signa`)).toBeNull();
        expect(readPortalToken(payload)).toBeNull();
        expect(readPortalToken('')).toBeNull();
    });

    it('expire après 90 jours', () => {
        const issued = Date.UTC(2026, 0, 1);
        const token = createPortalToken('client123', 1, issued);
        expect(readPortalToken(token, issued + 89 * 86_400_000)).not.toBeNull();
        expect(readPortalToken(token, issued + 91 * 86_400_000)).toBeNull();
    });
});
