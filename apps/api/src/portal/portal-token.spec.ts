import { createPortalToken, readPortalToken } from './portal-token.js';

describe('jeton du portail client', () => {
    it('relit un jeton valide', () => {
        expect(readPortalToken(createPortalToken('client123', 2))).toEqual({ clientId: 'client123', version: 2 });
    });

    it('rejette un jeton falsifié ou tronqué', () => {
        const token = createPortalToken('client123', 1);
        const [payload] = token.split('.');
        const forged = `${Buffer.from('autreclient.1').toString('base64url')}.${token.split('.')[1]}`;
        expect(readPortalToken(forged)).toBeNull();
        expect(readPortalToken(`${payload}.mauvaise-signature-mauvaise-signa`)).toBeNull();
        expect(readPortalToken(payload)).toBeNull();
        expect(readPortalToken('')).toBeNull();
    });
});
