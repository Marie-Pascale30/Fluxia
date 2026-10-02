// Photos, signature, transcription et documents PDF.
import { schemas as S } from '@fluxia/shared';
import { call, expectContract, login, useToken } from './client.js';

const BASE = `http://localhost:${process.env.E2E_API_PORT ?? 4610}/api`;
// PNG 1×1 valide
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function upload(token: string, path: string, content: Buffer, fields: Record<string, string>, type = 'image/png') {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append('file', new Blob([new Uint8Array(content)], { type }), 'fichier.png');
    const res = await fetch(BASE + path, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    return { status: res.status, body: await res.json().catch(() => null) };
}

async function raw(token: string, path: string) {
    const res = await fetch(BASE + path, { headers: { authorization: `Bearer ${token}` } });
    return { status: res.status, type: res.headers.get('content-type'), body: Buffer.from(await res.arrayBuffer()) };
}

describe('Pièces jointes et PDF', () => {
    let manager: string;
    let thomas: string;
    let marc: string;
    let interventionId: string;

    beforeAll(async () => {
        manager = await login('julien@fluxia.fr');
        thomas = await login('thomas.martin@fluxia.fr');
        marc = await login('marc.lefevre@fluxia.fr');
        useToken(manager);

        // Intervention de Thomas : planifiée, envoyée puis démarrée
        const created = await call('POST', '/interventions', {
            clientId: (await call('GET', '/clients?search=parisien')).body[0].id,
            siteId: (await call('GET', `/clients/${(await call('GET', '/clients?search=parisien')).body[0].id}`)).body.sites[0].id,
            title: 'Contrôle photos',
            description: 'Test pièces jointes',
            estimatedMinutes: 30,
        });
        interventionId = created.body.id;
        const recos = (await call('GET', `/interventions/${interventionId}/recommendations`)).body;
        const thomasReco = recos.find((r: { technicianName: string }) => r.technicianName === 'Thomas Martin');
        expect((await call('POST', `/interventions/${interventionId}/assign`, { technicianId: thomasReco.technicianId, start: thomasReco.slot.start })).status).toBe(200);
        expect((await call('POST', `/interventions/${interventionId}/dispatch`)).status).toBe(200);
        expect((await call('POST', `/interventions/${interventionId}/start`, undefined, { token: thomas })).status).toBe(200);
    });

    it('accepte une vraie photo et refuse un fichier déguisé', async () => {
        const ok = await upload(thomas, `/interventions/${interventionId}/attachments`, PNG, { kind: 'PHOTO', caption: 'Groupe extérieur' });
        expect(ok.status).toBe(201);
        expectContract(S.Attachment, ok.body);

        const fake = await upload(thomas, `/interventions/${interventionId}/attachments`, Buffer.from('<script>alert(1)</script>'), { kind: 'PHOTO' });
        expect(fake.status).toBe(400);
        const wrongKind = await upload(thomas, `/interventions/${interventionId}/attachments`, PNG, { kind: 'AUDIO' });
        expect(wrongKind.status).toBe(400);
    });

    it('réserve les fichiers à l’équipe concernée', async () => {
        const list = await call('GET', `/interventions/${interventionId}/attachments`, undefined, { token: thomas });
        const photo = list.body[0];
        const file = await raw(thomas, `/attachments/${photo.id}/file`);
        expect(file.status).toBe(200);
        expect(file.type).toBe('image/png');
        expect(file.body.equals(PNG)).toBe(true);

        expect((await raw(marc, `/attachments/${photo.id}/file`)).status).toBe(403);
        expect((await upload(marc, `/interventions/${interventionId}/attachments`, PNG, { kind: 'PHOTO' })).status).toBe(403);
    });

    it('enregistre la signature du client', async () => {
        const res = await call('POST', `/interventions/${interventionId}/signature`, { signerName: 'Marc Petit', image: `data:image/png;base64,${PNG.toString('base64')}` }, { token: thomas });
        expect(res.status).toBe(201);
        const bad = await call('POST', `/interventions/${interventionId}/signature`, { signerName: 'X Y', image: 'data:image/png;base64,SGVsbG8=' }, { token: thomas });
        expect(bad.status).toBe(400);

        const detail = expectContract(S.InterventionDetail, (await call('GET', `/interventions/${interventionId}`)).body);
        expect(detail.signedBy).toBe('Marc Petit');
        expect(detail.attachments.map((a) => a.kind).sort()).toEqual(['PHOTO', 'SIGNATURE']);
    });

    it('signale que la transcription serveur n’est pas configurée', async () => {
        expect((await call('GET', '/capabilities', undefined, { token: thomas })).body).toEqual({ transcription: false });
    });

    it('génère le PDF du rapport (photos et signature) et l’envoie en pièce jointe', async () => {
        const report = await call('POST', `/interventions/${interventionId}/report`, { voiceNote: "J'ai contrôlé le groupe, tout fonctionne normalement." }, { token: thomas });
        expect(report.status).toBe(201);

        const pdf = await raw(thomas, `/reports/${report.body.id}/pdf`);
        expect(pdf.status).toBe(200);
        expect(pdf.type).toBe('application/pdf');
        expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
        expect(pdf.body.length).toBeGreaterThan(2000);

        await call('POST', `/reports/${report.body.id}/validate`);
        await call('POST', `/reports/${report.body.id}/send`);
        // Le PDF est produit au moment de l'envoi par la boîte d'envoi
        const { number } = (await call('GET', `/interventions/${interventionId}`)).body;
        let message: { status: string; lastError: string | null } | undefined;
        for (let i = 0; i < 50 && message?.status !== 'SENT'; i++) {
            await new Promise((r) => setTimeout(r, 200));
            const log = (await call('GET', '/messages')).body;
            message = log.messages.find((m: { subject: string }) => m.subject === `Rapport d'intervention #${number}`);
        }
        expect(message?.lastError ?? null).toBeNull();
        expect(message?.status).toBe('SENT');
    });

    it('génère le PDF d’un devis', async () => {
        const quotes = (await call('GET', '/quotes')).body;
        const requests = (await call('GET', '/requests')).body as { id: string; subject: string }[];
        const target = quotes[0]?.id ?? (await call('POST', `/requests/${requests.find((r) => r.subject.includes('VMC'))!.id}/quote`)).body.id;
        const pdf = await raw(manager, `/quotes/${target}/pdf`);
        expect(pdf.status).toBe(200);
        expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
        expect((await raw(thomas, `/quotes/${target}/pdf`)).status).toBe(403);
    });

    it('verrouille les pièces jointes une fois l’intervention clôturée', async () => {
        const detail = (await call('GET', `/interventions/${interventionId}`)).body;
        expect(detail.status).toBe('CLOSED');
        expect((await upload(manager, `/interventions/${interventionId}/attachments`, PNG, { kind: 'PHOTO' })).status).toBe(409);
    });
});

describe('Mise en page des PDF', () => {
    it('tient sur une page pour un document court (pas de page vide due au pied de page)', async () => {
        const token = await login('julien@fluxia.fr');
        const quotes = (await call('GET', '/quotes', undefined, { token })).body;
        const pdf = await raw(token, `/quotes/${quotes[0].id}/pdf`);
        const pages = (pdf.body.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
        expect(pages).toBe(1);
    });
});
