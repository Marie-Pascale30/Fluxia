// Multi-entreprise : inscription, paramètres et cloisonnement strict des données.
// « Démo » = l'entreprise des données de démonstration ; « Clim Express » s'inscrit pendant le test.
import { schemas as S } from '@fluxia/shared';
import { call, expectContract, login, useToken } from './client.js';

const list = (res: { body: unknown }) => res.body as { id: string }[];

let demo: string;
let other: string;
/** Données de l'entreprise de démo, que Clim Express ne doit jamais atteindre */
const foreign: Record<string, string> = {};

beforeAll(async () => {
    demo = await login('julien@fluxia.fr');
    useToken(demo);
    const client = (await call('GET', `/clients/${list(await call('GET', '/clients'))[0].id}`)).body;
    foreign.client = client.id;
    foreign.site = client.sites[0].id;
    foreign.intervention = list(await call('GET', '/interventions'))[0].id;
    foreign.request = list(await call('GET', '/requests'))[0].id;
    foreign.technician = list(await call('GET', '/technicians'))[0].id;
    foreign.catalogItem = list(await call('GET', '/catalog'))[0].id;
    foreign.report = list(await call('GET', '/reports'))[0].id;
    useToken(null);
});

describe('Inscription', () => {
    const email = `nina.roux.${Date.now()}@clim-express.fr`;

    it('crée l’entreprise et son responsable, et ouvre la session', async () => {
        const res = await call('POST', '/auth/signup', { organizationName: 'Clim Express', name: 'Nina Roux', email, password: 'un-mot-de-passe-solide', acceptTerms: true });
        expect(res.status).toBe(201);
        other = res.body.token;
        expect(res.body.user).toMatchObject({ name: 'Nina Roux', role: 'MANAGER', organizationName: 'Clim Express' });

        const me = expectContract(S.SessionUser, (await call('GET', '/auth/me', undefined, { token: other })).body);
        expect(me.organizationName).toBe('Clim Express');
        // La connexion classique fonctionne ensuite
        expect(await login(email, 'un-mot-de-passe-solide')).toBeTruthy();
    });

    it('refuse un email déjà utilisé, quelle que soit l’entreprise', async () => {
        const res = await call('POST', '/auth/signup', { organizationName: 'Autre', name: 'Julien Bis', email: 'julien@fluxia.fr', password: 'un-mot-de-passe-solide', acceptTerms: true });
        expect(res.status).toBe(409);
    });

    it('refuse un mot de passe trop court', async () => {
        const res = await call('POST', '/auth/signup', { organizationName: 'Autre', name: 'Paul', email: `paul.${Date.now()}@x.fr`, password: 'court', acceptTerms: true });
        expect(res.status).toBe(400);
    });

    it('démarre avec des données vides et un catalogue de base', async () => {
        useToken(other);
        for (const path of ['/clients', '/interventions', '/requests', '/technicians', '/quotes', '/reports', '/invoices']) {
            expect(list(await call('GET', path)), path).toEqual([]);
        }
        expect(list(await call('GET', '/catalog'))).toHaveLength(2);
        const dashboard = (await call('GET', '/dashboard')).body;
        expect(dashboard.counters.requestsTotal).toBe(0);
        expect(dashboard.counters.interventionsToday).toBe(0);
    });
});

describe('Cloisonnement', () => {
    beforeAll(() => useToken(other));

    it('aucune donnée d’une autre entreprise n’est lisible', async () => {
        const paths = [
            `/clients/${foreign.client}`,
            `/interventions/${foreign.intervention}`,
            `/interventions/${foreign.intervention}/recommendations`,
            `/interventions/${foreign.intervention}/attachments`,
            `/requests/${foreign.request}`,
            `/technicians/${foreign.technician}`,
            `/reports/${foreign.report}`,
            `/reports/${foreign.report}/pdf`,
            `/clients/${foreign.client}/portal-link`,
        ];
        for (const path of paths) expect((await call('GET', path)).status, path).toBe(404);
    });

    it('aucune donnée d’une autre entreprise n’est modifiable', async () => {
        expect((await call('PATCH', `/clients/${foreign.client}`, { name: 'Piraté' })).status).toBe(404);
        expect((await call('PATCH', `/sites/${foreign.site}`, { label: 'Piraté' })).status).toBe(404);
        expect((await call('PATCH', `/catalog/${foreign.catalogItem}`, { unitPriceCents: 1 })).status).toBe(404);
        expect((await call('POST', `/interventions/${foreign.intervention}/cancel`, { reason: 'Piraté' })).status).toBe(404);
        expect((await call('POST', `/technicians/${foreign.technician}/reset-password`)).status).toBe(404);
        expect((await call('POST', `/requests/${foreign.request}/archive`)).status).toBe(404);
        expect((await call('POST', `/clients/${foreign.client}/portal-link/rotate`)).status).toBe(404);

        // Vérification côté entreprise de démo : rien n'a bougé
        const client = (await call('GET', `/clients/${foreign.client}`, undefined, { token: demo })).body;
        expect(client.name).not.toBe('Piraté');
        const intervention = (await call('GET', `/interventions/${foreign.intervention}`, undefined, { token: demo })).body;
        expect(intervention.status).not.toBe('CANCELLED');
    });

    it('aucune donnée d’une autre entreprise ne peut être référencée', async () => {
        // Intervention sur le client et le site d'une autre entreprise
        expect((await call('POST', '/interventions', { clientId: foreign.client, siteId: foreign.site, title: 'Panne', description: 'Panne de clim' })).status).toBe(400);

        // Ses propres données : client, site, demande, intervention
        const own = await call('POST', '/clients', { name: 'Brasserie du Port', site: { label: 'Salle', address: '2 quai du Port', postalCode: '13002', city: 'Marseille', lat: 43.2965, lng: 5.3698 } });
        expect(own.status).toBe(201);
        const request = await call('POST', '/requests', { fromName: 'Brasserie', fromEmail: 'contact@brasserie-port.fr', subject: 'Clim en panne', body: 'La climatisation de la salle ne fonctionne plus depuis ce matin.' });
        expect(request.status).toBe(201);

        // Demande rattachée au client d'une autre entreprise : refusé (sinon sa fiche serait lisible via la demande)
        expect((await call('PATCH', `/requests/${request.body.id}`, { clientId: foreign.client })).status).toBe(400);
        expect((await call('PATCH', `/requests/${request.body.id}`, { clientId: own.body.id, siteId: foreign.site })).status).toBe(400);

        const intervention = await call('POST', '/interventions', { clientId: own.body.id, siteId: own.body.sites[0].id, title: 'Clim en panne', description: 'Climatisation de la salle à l’arrêt' });
        expect(intervention.status).toBe(201);
        // Numérotation propre à l'entreprise : sa première intervention
        expect(intervention.body.number).toBe(4581);

        // Affecter le technicien d'une autre entreprise : refusé
        const tomorrow = new Date(Date.now() + 86_400_000);
        tomorrow.setUTCHours(9, 0, 0, 0);
        const assign = await call('POST', `/interventions/${intervention.body.id}/assign`, { technicianId: foreign.technician, start: tomorrow.toISOString() });
        expect(assign.status).toBe(400);
    });

    it('le personnel d’une entreprise ne voit pas les nouvelles données des autres', async () => {
        const clients = list(await call('GET', '/clients', undefined, { token: demo })) as unknown as { name: string }[];
        expect(clients.map((c) => c.name)).not.toContain('Brasserie du Port');
    });
});

describe('Paramètres de l’entreprise', () => {
    it('sont modifiables par le responsable et propres à l’entreprise', async () => {
        useToken(other);
        const updated = await call('PATCH', '/organization', { phone: '04 91 00 00 00', legal: 'SARL Clim Express', paymentTermsDays: 45 });
        expect(updated.status).toBe(200);
        expectContract(S.Organization, updated.body);
        expect(updated.body).toMatchObject({ name: 'Clim Express', phone: '04 91 00 00 00', paymentTermsDays: 45 });

        const demoSettings = (await call('GET', '/organization', undefined, { token: demo })).body;
        expect(demoSettings.name).toBe('Fluxia Maintenance');
        expect(demoSettings.paymentTermsDays).toBe(30);
    });

    it('sont réservés au responsable', async () => {
        const tech = await login('thomas.martin@fluxia.fr');
        expect((await call('GET', '/organization', undefined, { token: tech })).status).toBe(403);
        expect((await call('PATCH', '/organization', { name: 'Piraté' }, { token: tech })).status).toBe(403);
    });

    it('chaque jeton d’emails entrants alimente sa propre entreprise ; un jeton renouvelé remplace l’ancien', async () => {
        useToken(other);
        const { inboundToken } = (await call('GET', '/organization')).body;
        const email = { FromFull: { Email: 'accueil@hotel-vieuxport.fr', Name: 'Hôtel Vieux-Port' }, Subject: 'VMC bruyante', TextBody: 'La VMC des chambres fait beaucoup de bruit depuis hier soir.' };
        expect((await call('POST', `/inbound/email?token=${encodeURIComponent(inboundToken)}`, email, { token: null })).status).toBe(200);

        const mine = list(await call('GET', '/requests')) as unknown as { fromEmail: string }[];
        expect(mine.map((r) => r.fromEmail)).toContain('accueil@hotel-vieuxport.fr');
        const theirs = list(await call('GET', '/requests', undefined, { token: demo })) as unknown as { fromEmail: string }[];
        expect(theirs.map((r) => r.fromEmail)).not.toContain('accueil@hotel-vieuxport.fr');

        const rotated = (await call('POST', '/organization/inbound-token')).body.inboundToken;
        expect(rotated).not.toBe(inboundToken);
        expect((await call('POST', `/inbound/email?token=${encodeURIComponent(inboundToken)}`, email, { token: null })).status).toBe(403);
    });
});

describe('Données personnelles (RGPD)', () => {
    it('l’inscription exige l’acceptation des conditions', async () => {
        const res = await call('POST', '/auth/signup', { organizationName: 'Sans accord', name: 'Paul', email: `paul.${Date.now()}@x.fr`, password: 'un-mot-de-passe-solide' }, { token: null });
        expect(res.status).toBe(400);
    });

    it('exporte toutes les données de l’entreprise, sans secret', async () => {
        const res = await call('GET', '/organization/export', undefined, { token: other });
        expect(res.status).toBe(200);
        expect(res.body.organization.name).toBe('Clim Express');
        expect(res.body.organization.termsAcceptedAt).toBeTruthy();
        expect(res.body.clients.map((c: { name: string }) => c.name)).toContain('Brasserie du Port');
        const raw = JSON.stringify(res.body);
        expect(raw).not.toContain('passwordHash');
        expect(raw).not.toContain('inboundToken');
        expect(raw).not.toContain('Restaurant Le Parisien');
        expect(raw).not.toContain('stripeCustomerId');
        // L'export est tracé : il conditionne la suppression d'une entreprise qui a émis des factures
        expect((await call('GET', '/organization', undefined, { token: other })).body.dataExportedAt).toBeTruthy();
    });

    it('refuse de supprimer une entreprise qui a émis des factures sans export préalable', async () => {
        const invoices = (await call('GET', '/invoices', undefined, { token: demo })).body as { number: string | null }[];
        if (!invoices.some((i) => i.number)) return;
        const res = await call('DELETE', '/organization', { confirmName: 'Fluxia Maintenance', password: 'fluxia-demo' }, { token: demo });
        expect(res.status).toBe(409);
        expect(res.body.message).toContain('export');
    });

    it('supprime définitivement l’entreprise après double confirmation, sans toucher aux autres', async () => {
        const email = (await call('GET', '/auth/me', undefined, { token: other })).body.email;
        expect((await call('DELETE', '/organization', { confirmName: 'Autre nom', password: 'un-mot-de-passe-solide' }, { token: other })).status).toBe(400);
        expect((await call('DELETE', '/organization', { confirmName: 'Clim Express', password: 'faux-mot-de-passe' }, { token: other })).status).toBe(400);
        expect((await call('DELETE', '/organization', { confirmName: 'Clim Express', password: 'un-mot-de-passe-solide' }, { token: other })).status).toBe(204);

        expect((await call('GET', '/auth/me', undefined, { token: other })).status).toBe(401);
        expect((await call('POST', '/auth/login', { email, password: 'un-mot-de-passe-solide' }, { token: null })).status).toBe(401);
        expect((await call('GET', `/clients/${foreign.client}`, undefined, { token: demo })).status).toBe(200);
    });
});
