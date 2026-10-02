// Entretien préventif automatique à partir des contrats.
import { schemas as S } from '@fluxia/shared';
import { call, expectContract, login, useToken } from './client.js';

describe('Entretien préventif', () => {
    beforeAll(async () => {
        useToken(await login('julien@fluxia.fr'));
    });

    it('liste les échéances à venir', async () => {
        const upcoming = expectContract(S.UpcomingMaintenance, (await call('GET', '/maintenance/upcoming?days=60')).body);
        const morel = upcoming.find((c) => c.client.name === 'Cabinet Morel');
        expect(morel).toMatchObject({ reference: 'ENT-2025-031', serviceIntervalMonths: 12 });
    });

    it('crée l’intervention d’entretien, avance l’échéance, sans doublon', async () => {
        const before = (await call('GET', '/maintenance/upcoming?days=60')).body.find((c: { client: { name: string } }) => c.client.name === 'Cabinet Morel');

        const first = expectContract(S.MaintenanceRun, (await call('POST', '/maintenance/run?horizon=30')).body);
        const created = first.created.filter((c) => c.client === 'Cabinet Morel');
        expect(created).toHaveLength(1);

        const intervention = expectContract(S.InterventionDetail, (await call('GET', `/interventions/${created[0].id}`)).body);
        expect(intervention).toMatchObject({ type: 'MAINTENANCE', status: 'TO_SCHEDULE' });
        expect(intervention.title).toContain('Entretien périodique');

        // Échéance avancée de 12 mois
        const client = expectContract(S.ClientDetail, (await call('GET', `/clients/${intervention.clientId}`)).body);
        const contract = client.contracts.find((c) => c.reference === 'ENT-2025-031')!;
        const next = new Date(contract.nextServiceDate ?? before.nextServiceDate);
        // Contrat se terminant le mois prochain : pas de nouvelle échéance au-delà de sa fin
        expect(contract.nextServiceDate === null || next > new Date(before.nextServiceDate)).toBe(true);

        // Second passage : rien de nouveau pour ce contrat
        const second = expectContract(S.MaintenanceRun, (await call('POST', '/maintenance/run?horizon=30')).body);
        expect(second.created.filter((c) => c.client === 'Cabinet Morel')).toHaveLength(0);
    });

    it('n’est accessible qu’à la direction', async () => {
        const tech = await login('thomas.martin@fluxia.fr');
        expect((await call('POST', '/maintenance/run', undefined, { token: tech })).status).toBe(403);
    });
});
