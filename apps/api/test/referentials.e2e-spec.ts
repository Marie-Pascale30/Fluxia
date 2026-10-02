// Création et modification des référentiels, réponse aux demandes.
import { schemas as S } from '@fluxia/shared';
import { call, expectContract, login, useToken } from './client.js';

beforeAll(async () => {
    useToken(await login('julien@fluxia.fr'));
});

describe('Demande d’un expéditeur inconnu', () => {
    let requestId: string;

    it('extrait les coordonnées citées dans le message', async () => {
        const res = await call('POST', '/requests', {
            fromName: 'Julie Bernard',
            fromEmail: 'julie.bernard@gmail.com',
            subject: 'Chaudière qui ne chauffe plus',
            body: 'Bonjour, ma chaudière ne chauffe plus depuis hier. J’habite au 12 rue des Lilas, 75015 Paris. Tél : 06 12 34 56 78.',
        });
        const request = expectContract(S.InboundRequestDetail, res.body);
        requestId = request.id;
        expect(request.client).toBeNull();
        expect(request.extractedPhone).toBe('06 12 34 56 78');
        expect(request.extractedAddress).toBe('12 rue des Lilas, 75015 Paris');
    });

    it('ne peut pas devenir une intervention sans client', async () => {
        expect((await call('POST', `/requests/${requestId}/convert`, {})).status).toBe(400);
    });

    it('crée la fiche client depuis la demande puis l’intervention', async () => {
        const res = await call('POST', `/requests/${requestId}/client`, {
            name: 'Julie Bernard',
            phone: '06 12 34 56 78',
            siteLabel: 'Domicile',
            address: '12 rue des Lilas',
            postalCode: '75015',
            city: 'Paris',
        });
        expect(res.status).toBe(201);
        const request = expectContract(S.InboundRequestDetail, res.body);
        expect(request.client?.name).toBe('Julie Bernard');
        expect(request.client?.email).toBe('julie.bernard@gmail.com');
        expect(request.siteId).not.toBeNull();

        expect((await call('POST', `/requests/${requestId}/client`, { name: 'Autre client', siteLabel: 'Site', address: '1 rue Test' })).status).toBe(409);
        expect((await call('POST', `/requests/${requestId}/convert`, {})).status).toBe(201);
    });

    it('rédige une réponse fondée sur les faits établis, puis l’envoie', async () => {
        const draft = expectContract(S.ReplyDraft, (await call('POST', `/requests/${requestId}/reply-draft`)).body);
        expect(draft.body).toContain('Bonjour Julie');
        expect(draft.facts.join(' ')).toContain('Intervention');

        const sent = expectContract(S.InboundRequestDetail, (await call('POST', `/requests/${requestId}/reply`, { subject: draft.subject, body: draft.body })).body);
        expect(sent.replies).toHaveLength(1);
        expect(sent.replies[0].recipient).toBe('julie.bernard@gmail.com');
        // Déjà convertie : le statut n'est pas écrasé
        expect(sent.status).toBe('CONVERTED');
    });
});

describe('Fiche client', () => {
    let clientId: string;
    let siteId: string;

    it('crée un client avec son premier site géolocalisé', async () => {
        const res = await call('POST', '/clients', {
            name: 'Hôtel du Marais',
            email: 'Direction@Hotel-Marais.fr',
            site: { label: 'Hôtel', address: '5 rue du Temple', postalCode: '75004', city: 'Paris' },
        });
        expect(res.status).toBe(201);
        clientId = res.body.id;
        siteId = res.body.sites[0].id;
        expect(res.body.email).toBe('direction@hotel-marais.fr');
        expect(typeof res.body.sites[0].lat).toBe('number');
    });

    it('ajoute équipement et contrat ; refuse une référence en double', async () => {
        const eq = await call('POST', `/sites/${siteId}/equipments`, { type: 'CLIMATISATION', label: 'Clim chambres' });
        expect(eq.status).toBe(201);

        const contract = {
            reference: 'TEST-CTR-001',
            label: 'Maintenance annuelle',
            startDate: '2026-01-01T00:00:00Z',
            endDate: '2026-12-31T00:00:00Z',
            coversLabor: true,
            coversParts: false,
            coversTravel: true,
        };
        expect((await call('POST', `/clients/${clientId}/contracts`, contract)).status).toBe(201);
        expect((await call('POST', `/clients/${clientId}/contracts`, contract)).status).toBe(409);
        expect((await call('POST', `/clients/${clientId}/contracts`, { ...contract, reference: 'TEST-CTR-002', endDate: '2025-01-01T00:00:00Z' })).status).toBe(400);

        const detail = expectContract(S.ClientDetail, (await call('GET', `/clients/${clientId}`)).body);
        expect(detail.sites[0].equipments).toHaveLength(1);
        expect(detail.contracts).toHaveLength(1);

        // Équipement sans historique : supprimable
        expect((await call('DELETE', `/equipments/${eq.body.id}`)).status).toBe(200);
    });

    it('refuse de supprimer un équipement qui a un historique', async () => {
        const clients = (await call('GET', '/clients?search=parisien')).body;
        const parisien = expectContract(S.ClientDetail, (await call('GET', `/clients/${clients[0].id}`)).body);
        const clim = parisien.sites[0].equipments.find((e) => e.type === 'CLIMATISATION')!;
        expect((await call('DELETE', `/equipments/${clim.id}`)).status).toBe(409);
    });
});

describe('Techniciens et catalogue', () => {
    it('crée un technicien avec un compte et un mot de passe provisoire utilisable', async () => {
        const res = await call('POST', '/technicians', {
            firstName: 'Nadia',
            lastName: 'Benali',
            email: 'nadia.benali@fluxia.fr',
            skills: ['PLOMBERIE', 'CHAUFFAGE'],
            baseAddress: '10 rue de la Roquette 75011 Paris',
        });
        expect(res.status).toBe(201);
        const { temporaryPassword } = expectContract(S.TemporaryPassword, res.body);
        expect((await call('POST', '/technicians', { firstName: 'N', lastName: 'B', email: 'nadia.benali@fluxia.fr', skills: ['VMC'] })).status).toBe(400);

        const token = await login('nadia.benali@fluxia.fr', temporaryPassword);
        const me = await call('GET', '/auth/me', undefined, { token });
        expect(me.body).toMatchObject({ role: 'TECHNICIAN', technicianId: res.body.technician.id });

        // Désactivation : le compte perd l'accès immédiatement
        expect((await call('PATCH', `/technicians/${res.body.technician.id}`, { active: false })).status).toBe(200);
        expect((await call('GET', '/auth/me', undefined, { token })).status).toBe(401);
    });

    it('refuse de désactiver un technicien qui a des interventions planifiées', async () => {
        const techs = (await call('GET', '/technicians')).body as { id: string; firstName: string }[];
        const marc = techs.find((t) => t.firstName === 'Marc')!;
        expect((await call('PATCH', `/technicians/${marc.id}`, { active: false })).status).toBe(409);
    });

    it('gère le catalogue', async () => {
        const created = await call('POST', '/catalog', { code: 'TEST-VANNE', kind: 'PART', label: 'Vanne 4 voies', unitPriceCents: 18900, keywords: [' Vanne 4 voies '] });
        expect(created.status).toBe(201);
        expect(created.body.keywords).toEqual(['vanne 4 voies']);
        expect((await call('POST', '/catalog', { code: 'TEST-VANNE', kind: 'PART', label: 'Doublon', unitPriceCents: 1 })).status).toBe(409);
        expect((await call('POST', '/catalog', { code: 'mauvais code', kind: 'PART', label: 'X', unitPriceCents: 1 })).status).toBe(400);
        const updated = await call('PATCH', `/catalog/${created.body.id}`, { unitPriceCents: 19900 });
        expect(updated.body.unitPriceCents).toBe(19900);
    });
});
