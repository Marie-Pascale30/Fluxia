// Parcours complet : demande entrante → intervention → mission → rapport → devis.
// Chaque réponse est validée contre le contrat partagé (@fluxia/shared).
import { schemas as S } from '@fluxia/shared';
import { z } from 'zod';
import { call, expectContract, login, useToken } from './client.js';

beforeAll(async () => {
    useToken(await login('julien@fluxia.fr'));
});

const NOTE =
    "J'ai trouvé le condensateur défectueux. Je l'ai remplacé, vérifié la pression et redémarré le groupe. Tout fonctionne normalement. Je recommande un nettoyage complet au prochain passage.";

describe('Parcours métier', () => {
    const ctx: { requestId?: string; interventionId?: string; reportId?: string; quoteId?: string } = {};

    it('expose un tableau de bord conforme', async () => {
        const { status, body } = await call('GET', '/dashboard');
        expect(status).toBe(200);
        expectContract(S.Dashboard, body);
    });

    it('liste les demandes et analyse une demande nouvelle', async () => {
        const list = expectContract(z.array(S.InboundRequest), (await call('GET', '/requests')).body);
        const fresh = list.find((r) => r.status === 'NEW')!;
        const analyzed = expectContract(S.InboundRequestDetail, (await call('POST', `/requests/${fresh.id}/analyze`)).body);
        expect(analyzed).toMatchObject({ status: 'ANALYZED', category: 'BREAKDOWN', priority: 'URGENT' });
        expect(analyzed.client?.name).toBe('Résidence Opéra');

        ctx.requestId = list.find((r) => r.subject.includes('climatisation en panne'))!.id;
    });

    it('convertit la demande en intervention, une seule fois', async () => {
        const first = await call('POST', `/requests/${ctx.requestId}/convert`, {});
        expect(first.status).toBe(201);
        expect(first.body).toMatchObject({ status: 'TO_SCHEDULE', priority: 'URGENT', title: 'Climatisation en panne' });
        ctx.interventionId = first.body.id;

        const again = await call('POST', `/requests/${ctx.requestId}/convert`, {});
        expect(again.status).toBe(409);
    });

    it('refuse d’envoyer une mission non planifiée', async () => {
        const res = await call('POST', `/interventions/${ctx.interventionId}/dispatch`);
        expect(res.status).toBe(409);
    });

    it('recommande Thomas (compétence + historique) et affecte le créneau proposé', async () => {
        const recos = expectContract(z.array(S.Recommendation), (await call('GET', `/interventions/${ctx.interventionId}/recommendations`)).body);
        const best = recos[0];
        expect(best.technicianName).toBe('Thomas Martin');
        expect(best.reasons.map((r) => r.label)).toContain('Historique');
        expect(best.slot).not.toBeNull();

        const past = await call('POST', `/interventions/${ctx.interventionId}/assign`, { technicianId: best.technicianId, start: '2020-01-01T09:00:00Z' });
        expect(past.status).toBe(400);

        const ok = await call('POST', `/interventions/${ctx.interventionId}/assign`, { technicianId: best.technicianId, start: best.slot!.start });
        expect(ok.status).toBe(200);
        expect(ok.body.status).toBe('SCHEDULED');
    });

    it('détecte un conflit de planning', async () => {
        const detail = expectContract(S.InterventionDetail, (await call('GET', `/interventions/${ctx.interventionId}`)).body);
        // Une autre intervention de Thomas aujourd'hui : on tente de le planifier au même moment
        const planning = expectContract(S.PlanningDay, (await call('GET', '/planning')).body);
        const other = planning.technicians.flatMap((t) => t.interventions).find((i) => i.technicianId === detail.technicianId && i.id !== detail.id);
        if (!other) return; // journée sans autre intervention (week-end) : rien à tester
        const created = await call('POST', '/interventions', {
            clientId: detail.clientId,
            siteId: detail.siteId,
            title: 'Contrôle',
            description: 'Test de conflit',
            estimatedMinutes: 60,
        });
        const res = await call('POST', `/interventions/${created.body.id}/assign`, { technicianId: detail.technicianId, start: other.scheduledStart });
        expect([400, 409]).toContain(res.status);
    });

    it('envoie la mission et informe le client', async () => {
        expect((await call('POST', `/interventions/${ctx.interventionId}/dispatch`)).status).toBe(200);
        const detail = expectContract(S.InterventionDetail, (await call('GET', `/interventions/${ctx.interventionId}`)).body);
        expect(detail.status).toBe('DISPATCHED');
        expect(detail.messages.map((m) => m.channel).sort()).toEqual(['EMAIL', 'PUSH', 'SMS']);
    });

    it('génère le rapport depuis le compte rendu et détecte la facturation', async () => {
        const res = await call('POST', `/interventions/${ctx.interventionId}/report`, { voiceNote: NOTE });
        expect(res.status).toBe(201);
        ctx.reportId = res.body.id;

        const report = expectContract(S.ReportDetail, (await call('GET', `/reports/${ctx.reportId}`)).body);
        expect(report.billable).toBe(true);
        expect(report.parts).toEqual([{ label: 'Condensateur de démarrage climatisation', catalogCode: 'COND-CLIM', quantity: 1 }]);
        expect(report.billing.lines.map((l) => l.kind)).toEqual(['PART']);
    });

    it('n’envoie ni rapport ni devis sans validation', async () => {
        expect((await call('POST', `/reports/${ctx.reportId}/send`)).status).toBe(409);

        const quote = expectContract(S.QuoteDetail, (await call('POST', `/reports/${ctx.reportId}/quote`)).body);
        ctx.quoteId = quote.id;
        expect(quote).toMatchObject({ status: 'DRAFT', totalHtCents: 8600, vatCents: 1720, totalTtcCents: 10320 });
        expect(quote.number).toMatch(/^D-\d{4}-\d{3}$/);

        expect((await call('POST', `/quotes/${ctx.quoteId}/send`)).status).toBe(409);
        expect((await call('POST', `/reports/${ctx.reportId}/quote`)).status).toBe(409);
    });

    it('refuse de valider un devis avec une ligne à 0 €', async () => {
        const res = await call('PATCH', `/quotes/${ctx.quoteId}`, {
            lines: [{ kind: 'OTHER', label: 'À chiffrer', quantity: 1, unitPriceCents: 0 }],
        });
        expect(res.status).toBe(200);
        expect((await call('POST', `/quotes/${ctx.quoteId}/validate`)).status).toBe(400);

        await call('PATCH', `/quotes/${ctx.quoteId}`, {
            lines: [{ kind: 'PART', label: 'Condensateur', quantity: 1, unitPriceCents: 8600, catalogCode: 'COND-CLIM' }],
        });
    });

    it('valide puis envoie le devis et le rapport, et clôture l’intervention', async () => {
        expect((await call('POST', `/quotes/${ctx.quoteId}/validate`)).body.status).toBe('VALIDATED');
        const sent = expectContract(S.QuoteDetail, (await call('POST', `/quotes/${ctx.quoteId}/send`)).body);
        expect(sent.status).toBe('SENT');
        expect(sent.messages).toHaveLength(1);

        expect((await call('POST', `/reports/${ctx.reportId}/validate`)).status).toBe(200);
        expect((await call('POST', `/reports/${ctx.reportId}/send`)).status).toBe(200);

        const detail = expectContract(S.InterventionDetail, (await call('GET', `/interventions/${ctx.interventionId}`)).body);
        expect(detail.status).toBe('CLOSED');
        expect(detail.timeline.length).toBeGreaterThanOrEqual(8);
    });

    it('valide les entrées invalides', async () => {
        const res = await call('POST', '/requests', { fromName: 'T', fromEmail: 'bad', subject: 'x', body: 'y' });
        expect(res.status).toBe(400);
        expectContract(S.ApiErrorBody, res.body);
    });
});

describe('Contrat des listes et fiches', () => {
    it.each([
        ['/clients', z.array(S.ClientSummary)],
        ['/technicians', z.array(S.TechnicianWithLoad)],
        ['/interventions', z.array(S.Intervention)],
        ['/reports', z.array(S.ReportSummary)],
        ['/quotes', z.array(S.Quote)],
        ['/catalog', z.array(S.CatalogItem)],
        ['/planning', S.PlanningDay],
    ] as const)('%s', async (path, schema) => {
        const { status, body } = await call('GET', path);
        expect(status).toBe(200);
        expectContract(schema, body);
    });

    it('fiches client et technicien', async () => {
        const clients = (await call('GET', '/clients')).body;
        expectContract(S.ClientDetail, (await call('GET', `/clients/${clients[0].id}`)).body);
        const techs = (await call('GET', '/technicians')).body;
        expectContract(S.TechnicianDetail, (await call('GET', `/technicians/${techs[0].id}`)).body);
    });

    it('renvoie 404 sur une ressource inconnue', async () => {
        expect((await call('GET', '/interventions/inconnue')).status).toBe(404);
    });
});
