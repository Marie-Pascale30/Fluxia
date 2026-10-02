import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
    it('vérifie le bon mot de passe et rejette les autres', async () => {
        const hash = await hashPassword('fluxia-demo');
        expect(hash.startsWith('scrypt$')).toBe(true);
        expect(await verifyPassword('fluxia-demo', hash)).toBe(true);
        expect(await verifyPassword('mauvais', hash)).toBe(false);
    });

    it('sale chaque empreinte différemment', async () => {
        expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
    });

    it('rejette un format inconnu', async () => {
        expect(await verifyPassword('x', 'md5$abc')).toBe(false);
    });
});
