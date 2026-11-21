// Mot de passe oublié, réinitialisation par email et changement de mot de passe.
import { call, login, useToken } from './client.js';

let manager: string;
let email: string;
let temporaryPassword: string;

/** Lien de réinitialisation le plus récent envoyé à `to` (boîte d'envoi de l'entreprise). */
async function resetToken(to: string) {
    const { messages } = (await call('GET', '/messages', undefined, { token: manager })).body as { messages: { recipient: string; body: string }[] };
    const message = messages.find((m) => m.recipient === to && m.body.includes('/mot-de-passe/'));
    return message?.body.match(/\/mot-de-passe\/([\w-]+)/)?.[1];
}

beforeAll(async () => {
    manager = await login('julien@fluxia.fr');
    email = `ines.morel.${Date.now()}@fluxia.fr`;
    const res = await call('POST', '/technicians', { firstName: 'Inès', lastName: 'Morel', email, skills: ['VMC'] }, { token: manager });
    expect(res.status).toBe(201);
    temporaryPassword = res.body.temporaryPassword;
    useToken(null);
});

describe('Mot de passe oublié', () => {
    it('répond pareil que le compte existe ou non, et n’envoie un lien qu’au compte existant', async () => {
        const known = await call('POST', '/auth/forgot-password', { email });
        const unknown = await call('POST', '/auth/forgot-password', { email: 'personne@nulle-part.fr' });
        expect(known.status).toBe(200);
        expect(unknown.status).toBe(200);
        expect(known.body.message).toBe(unknown.body.message);
        expect(await resetToken(email)).toBeTruthy();
    });

    it('le lien fixe un nouveau mot de passe, ouvre la session et ne sert qu’une fois', async () => {
        const session = await login(email, temporaryPassword);
        await call('POST', '/auth/forgot-password', { email });
        const token = (await resetToken(email))!;

        expect((await call('POST', '/auth/reset-password', { token, password: 'court' })).status).toBe(400);
        const res = await call('POST', '/auth/reset-password', { token, password: 'nouveau-mot-de-passe' });
        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(email);
        expect((await call('GET', '/auth/me', undefined, { token: res.body.token })).status).toBe(200);

        // Lien à usage unique, ancien mot de passe refusé, anciennes sessions fermées
        expect((await call('POST', '/auth/reset-password', { token, password: 'encore-un-autre' })).status).toBe(400);
        expect((await call('POST', '/auth/login', { email, password: temporaryPassword })).status).toBe(401);
        expect((await call('GET', '/auth/me', undefined, { token: session })).status).toBe(401);
        expect(await login(email, 'nouveau-mot-de-passe')).toBeTruthy();
    });

    it('refuse un lien inventé', async () => {
        expect((await call('POST', '/auth/reset-password', { token: 'x'.repeat(43), password: 'nouveau-mot-de-passe' })).status).toBe(400);
    });
});

describe('Changement de mot de passe', () => {
    it('exige le mot de passe actuel puis remplace la session', async () => {
        const session = await login(email, 'nouveau-mot-de-passe');
        expect((await call('POST', '/auth/password', { currentPassword: 'faux', newPassword: 'mot-de-passe-3' }, { token: session })).status).toBe(400);

        const res = await call('POST', '/auth/password', { currentPassword: 'nouveau-mot-de-passe', newPassword: 'mot-de-passe-3' }, { token: session });
        expect(res.status).toBe(200);
        expect((await call('GET', '/auth/me', undefined, { token: session })).status).toBe(401);
        expect((await call('GET', '/auth/me', undefined, { token: res.body.token })).status).toBe(200);
    });
});
