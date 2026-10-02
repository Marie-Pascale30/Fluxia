// Authentification et droits d'accès par rôle.
import { call, login, useToken } from './client.js';

describe('Authentification', () => {
    afterAll(() => useToken(null));

    it('refuse tout accès sans jeton (sauf santé)', async () => {
        expect((await call('GET', '/health', undefined, { token: null })).status).toBe(200);
        expect((await call('GET', '/dashboard', undefined, { token: null })).status).toBe(401);
        expect((await call('GET', '/dashboard', undefined, { token: 'faux.jeton.signe' })).status).toBe(401);
    });

    it('refuse un mauvais mot de passe sans révéler si le compte existe', async () => {
        const wrong = await call('POST', '/auth/login', { email: 'julien@fluxia.fr', password: 'nope' }, { token: null });
        const unknown = await call('POST', '/auth/login', { email: 'inconnu@fluxia.fr', password: 'nope' }, { token: null });
        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('identifie l’utilisateur connecté', async () => {
        const token = await login('julien@fluxia.fr');
        const me = await call('GET', '/auth/me', undefined, { token });
        expect(me.body).toMatchObject({ name: 'Julien Durand', role: 'MANAGER' });
    });
});

describe('Droits d’un technicien', () => {
    let tech: string;
    let thomasId: string;
    let otherInterventionId: string;

    beforeAll(async () => {
        const manager = await login('julien@fluxia.fr');
        const techs = (await call('GET', '/technicians', undefined, { token: manager })).body as { id: string; firstName: string }[];
        thomasId = techs.find((t) => t.firstName === 'Thomas')!.id;
        const marcId = techs.find((t) => t.firstName === 'Marc')!.id;
        const marcDay = (await call('GET', `/technicians/${marcId}`, undefined, { token: manager })).body;
        otherInterventionId = marcDay.missions[0]?.id;
        tech = await login('thomas.martin@fluxia.fr');
    });

    it('accède à sa vue terrain, pas à celle des autres', async () => {
        expect((await call('GET', `/technicians/${thomasId}`, undefined, { token: tech })).status).toBe(200);
        const techs = (await call('GET', '/technicians', undefined, { token: tech })).status;
        expect(techs).toBe(403);
    });

    it('n’accède pas aux écrans de gestion', async () => {
        for (const path of ['/dashboard', '/quotes', '/clients', '/requests', '/planning']) {
            expect((await call('GET', path, undefined, { token: tech })).status, path).toBe(403);
        }
    });

    it('ne peut pas agir sur l’intervention d’un collègue', async () => {
        if (!otherInterventionId) return;
        const res = await call('POST', `/interventions/${otherInterventionId}/start`, undefined, { token: tech });
        expect(res.status).toBe(403);
    });
});
