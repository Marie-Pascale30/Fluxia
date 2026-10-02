'use server';

// Toutes les mutations passent par ces Server Actions : elles appellent l'API,
// revalident les pages et renvoient un résultat affiché en toast côté client.
// Pour ajouter l'authentification : vérifier la session au début de `run()`.
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { encodeFlash, FLASH_COOKIE } from '@/lib/flash';
import { fromLocalInput } from '@/lib/format';

export interface ActionResult<D = unknown> {
    ok: boolean;
    message: string;
    redirectTo?: string;
    /** Données renvoyées au composant (ex. mot de passe provisoire, brouillon) */
    data?: D;
}

async function run<D = unknown>(
    task: () => Promise<{ message: string; redirectTo?: string; data?: D } | string>,
): Promise<ActionResult<D>> {
    let result: { message: string; redirectTo?: string; data?: D };
    try {
        const value = await task();
        result = typeof value === 'string' ? { message: value } : value;
    } catch (error) {
        unstable_rethrow(error); // laisse passer les redirections (ex. session expirée)
        const message = error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue';
        return { ok: false, message };
    }

    // Le message de succès passe par un cookie "flash" affiché au rendu suivant :
    // fiable même si le composant appelant disparaît ou si l'on redirige.
    (await cookies()).set(FLASH_COOKIE, encodeFlash(result.message), { maxAge: 30, path: '/' });
    revalidatePath('/', 'layout');
    if (result.redirectTo) redirect(result.redirectTo);
    return { ok: true, message: result.message, data: result.data };
}

const str = (form: FormData, key: string) => {
    const value = form.get(key);
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};


// ─── Demandes entrantes ─────────────────────────────────────────

export async function ingestRequest(_: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        const request = await api.requests.ingest({
            fromName: str(form, 'fromName') ?? '',
            fromEmail: str(form, 'fromEmail') ?? '',
            subject: str(form, 'subject') ?? '',
            body: str(form, 'body') ?? '',
        });
        return { message: 'Demande reçue et analysée par l’IA', redirectTo: `/inbox/${request.id}` };
    });
}

export async function analyzeRequest(id: string) {
    return run(async () => {
        const r = await api.requests.analyze(id);
        return `Analyse terminée : ${r.client ? r.client.name : 'client non identifié'}`;
    });
}

export async function updateRequest(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.requests.update(id, {
            category: str(form, 'category'),
            priority: str(form, 'priority'),
            clientId: str(form, 'clientId'),
            siteId: str(form, 'siteId'),
            equipmentId: str(form, 'equipmentId'),
        });
        return 'Analyse corrigée';
    });
}

export async function convertRequest(id: string) {
    return run(async () => {
        const intervention = await api.requests.convert(id);
        return { message: `Intervention #${intervention.number} créée`, redirectTo: `/interventions/${intervention.id}` };
    });
}

export async function quoteFromRequest(id: string) {
    return run(async () => {
        const quote = await api.requests.quote(id);
        return { message: `Brouillon de devis ${quote.number} généré`, redirectTo: `/devis/${quote.id}` };
    });
}

export async function archiveRequest(id: string) {
    return run(async () => {
        await api.requests.archive(id);
        return { message: 'Demande archivée', redirectTo: '/inbox' };
    });
}

// ─── Interventions ──────────────────────────────────────────────

export async function assignTechnician(id: string, technicianId: string, start: string) {
    return run(async () => {
        await api.interventions.assign(id, { technicianId, start });
        return 'Affectation enregistrée';
    });
}

export async function assignManually(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        const technicianId = str(form, 'technicianId');
        const start = str(form, 'start');
        if (!technicianId || !start) throw new ApiError('Choisissez un technicien et un créneau', 400);
        const duration = str(form, 'duration');
        await api.interventions.assign(id, {
            technicianId,
            start: fromLocalInput(start),
            durationMinutes: duration ? Number(duration) : undefined,
        });
        return 'Affectation enregistrée';
    });
}

export async function unassignIntervention(id: string) {
    return run(async () => {
        await api.interventions.unassign(id);
        return 'Affectation annulée, intervention à replanifier';
    });
}

export async function dispatchMission(id: string) {
    return run(async () => {
        await api.interventions.dispatch(id);
        return 'Mission envoyée au technicien, client informé';
    });
}

export async function startIntervention(id: string) {
    return run(async () => {
        await api.interventions.start(id);
        return 'Intervention démarrée';
    });
}

export async function submitVoiceReport(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        const report = await api.interventions.submitReport(id, str(form, 'voiceNote') ?? '');
        return { message: 'Rapport généré à partir du compte rendu', redirectTo: `/rapports/${report.id}` };
    });
}

export async function cancelIntervention(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.interventions.cancel(id, str(form, 'reason') ?? '');
        return 'Intervention annulée';
    });
}

// ─── Rapports ───────────────────────────────────────────────────

export async function updateReport(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        const parts = JSON.parse(str(form, 'parts') ?? '[]');
        await api.reports.update(id, {
            reason: str(form, 'reason'),
            diagnosis: str(form, 'diagnosis'),
            workDone: str(form, 'workDone'),
            result: str(form, 'result'),
            recommendation: str(form, 'recommendation') ?? '',
            laborHours: Number(str(form, 'laborHours') ?? 0),
            parts,
        });
        return 'Rapport mis à jour, facturation recalculée';
    });
}

export async function validateReport(id: string) {
    return run(async () => {
        await api.reports.validate(id);
        return 'Rapport validé';
    });
}

export async function reopenReport(id: string) {
    return run(async () => {
        await api.reports.reopen(id);
        return 'Rapport repassé en brouillon';
    });
}

export async function sendReport(id: string) {
    return run(async () => {
        await api.reports.send(id);
        return 'Rapport envoyé au client, intervention clôturée';
    });
}

export async function quoteFromReport(id: string) {
    return run(async () => {
        const quote = await api.reports.quote(id);
        return { message: `Brouillon de devis ${quote.number} généré`, redirectTo: `/devis/${quote.id}` };
    });
}

// ─── Devis ──────────────────────────────────────────────────────

export async function saveQuote(
    id: string,
    data: { title: string; notes: string; lines: { kind: string; label: string; quantity: number; unitPriceCents: number; catalogCode?: string }[] },
) {
    return run(async () => {
        await api.quotes.update(id, data);
        return 'Devis enregistré';
    });
}

const QUOTE_MESSAGES = {
    validate: 'Devis validé — prêt à être envoyé',
    reopen: 'Devis repassé en brouillon',
    send: 'Devis envoyé au client',
    accept: 'Devis marqué comme accepté',
    refuse: 'Devis marqué comme refusé',
} as const;

export async function quoteTransition(id: string, transition: keyof typeof QUOTE_MESSAGES) {
    return run(async () => {
        await api.quotes.transition(id, transition);
        return QUOTE_MESSAGES[transition];
    });
}

// ─── Réponses et fiches créées depuis l'Inbox ───────────────────

export async function createClientFromRequest(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.requests.createClient(id, {
            name: str(form, 'name'),
            email: str(form, 'email'),
            phone: str(form, 'phone'),
            contactName: str(form, 'contactName'),
            siteLabel: str(form, 'siteLabel') ?? 'Site principal',
            address: str(form, 'address'),
            postalCode: str(form, 'postalCode'),
            city: str(form, 'city'),
        });
        return 'Fiche client créée et rattachée à la demande';
    });
}

export async function draftReply(id: string) {
    return run(async () => {
        const draft = await api.requests.replyDraft(id);
        return { message: 'Brouillon de réponse prêt : relisez-le avant envoi', data: draft };
    });
}

export async function sendReply(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.requests.reply(id, { subject: str(form, 'subject') ?? '', body: str(form, 'body') ?? '' });
        return 'Réponse envoyée au client';
    });
}

// ─── Clients ────────────────────────────────────────────────────

const siteFrom = (form: FormData, prefix = '') => ({
    label: str(form, `${prefix}label`) ?? 'Site principal',
    address: str(form, `${prefix}address`) ?? '',
    postalCode: str(form, `${prefix}postalCode`),
    city: str(form, `${prefix}city`),
});

export async function createClient(_: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        const withSite = !!str(form, 'site.address');
        const client = await api.clients.create({
            name: str(form, 'name'),
            email: str(form, 'email'),
            phone: str(form, 'phone'),
            contactName: str(form, 'contactName'),
            site: withSite ? siteFrom(form, 'site.') : undefined,
        });
        return { message: `Client « ${client.name} » créé`, redirectTo: `/clients/${client.id}` };
    });
}

export async function updateClient(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.clients.update(id, {
            name: str(form, 'name'),
            email: str(form, 'email'),
            phone: str(form, 'phone'),
            contactName: str(form, 'contactName'),
        });
        return 'Fiche client mise à jour';
    });
}

export async function addSite(clientId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.clients.addSite(clientId, siteFrom(form));
        return 'Site ajouté et géolocalisé';
    });
}

export async function addEquipment(siteId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.clients.addEquipment(siteId, {
            type: str(form, 'type'),
            label: str(form, 'label'),
            brand: str(form, 'brand'),
            model: str(form, 'model'),
        });
        return 'Équipement ajouté';
    });
}

export async function deleteEquipment(id: string) {
    return run(async () => {
        await api.clients.deleteEquipment(id);
        return 'Équipement supprimé';
    });
}

const dateField = (form: FormData, key: string) => {
    const value = str(form, key);
    return value ? new Date(`${value}T12:00:00Z`).toISOString() : undefined;
};

export async function addContract(clientId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.clients.addContract(clientId, {
            reference: str(form, 'reference'),
            label: str(form, 'label'),
            startDate: dateField(form, 'startDate'),
            endDate: dateField(form, 'endDate'),
            nextServiceDate: dateField(form, 'nextServiceDate'),
            coversLabor: form.get('coversLabor') === 'on',
            coversParts: form.get('coversParts') === 'on',
            coversTravel: form.get('coversTravel') === 'on',
        });
        return 'Contrat ajouté';
    });
}

// ─── Techniciens ────────────────────────────────────────────────

const skillsFrom = (form: FormData) => form.getAll('skills').filter((s): s is string => typeof s === 'string');

export async function createTechnician(_: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        const { technician, temporaryPassword } = await api.technicians.create({
            firstName: str(form, 'firstName'),
            lastName: str(form, 'lastName'),
            email: str(form, 'email'),
            phone: str(form, 'phone'),
            skills: skillsFrom(form),
            baseAddress: str(form, 'baseAddress'),
        });
        return {
            message: `${technician.firstName} ${technician.lastName} ajouté`,
            data: { email: technician.email, temporaryPassword },
        };
    });
}

export async function updateTechnician(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.technicians.update(id, {
            firstName: str(form, 'firstName'),
            lastName: str(form, 'lastName'),
            phone: str(form, 'phone'),
            skills: skillsFrom(form),
            baseAddress: str(form, 'baseAddress'),
        });
        return 'Technicien mis à jour';
    });
}

export async function setTechnicianActive(id: string, active: boolean) {
    return run(async () => {
        await api.technicians.update(id, { active });
        return active ? 'Technicien réactivé' : 'Technicien désactivé, son accès est coupé';
    });
}

export async function resetTechnicianPassword(id: string) {
    return run(async () => {
        const { temporaryPassword } = await api.technicians.resetPassword(id);
        return { message: 'Mot de passe réinitialisé', data: { temporaryPassword } };
    });
}

// ─── Catalogue ──────────────────────────────────────────────────

const euros = (form: FormData, key: string) => Math.round(Number((str(form, key) ?? '0').replace(',', '.')) * 100);
const keywordsFrom = (form: FormData) => (str(form, 'keywords') ?? '').split(',').map((k) => k.trim()).filter(Boolean);

export async function createCatalogItem(_: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        const item = await api.catalogItems.create({
            code: (str(form, 'code') ?? '').toUpperCase(),
            kind: str(form, 'kind'),
            label: str(form, 'label'),
            unitPriceCents: euros(form, 'price'),
            keywords: keywordsFrom(form),
        });
        return `Article ${item.code} ajouté`;
    });
}

export async function updateCatalogItem(id: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
    return run(async () => {
        await api.catalogItems.update(id, {
            label: str(form, 'label'),
            kind: str(form, 'kind'),
            unitPriceCents: euros(form, 'price'),
            keywords: keywordsFrom(form),
        });
        return 'Article mis à jour';
    });
}

// ─── Envois ─────────────────────────────────────────────────────

export async function retryMessage(id: string) {
    return run(async () => {
        await api.messages.retry(id);
        return 'Nouvel envoi programmé';
    });
}

// ─── Photos, signature, audio ───────────────────────────────────

export async function uploadPhotos(interventionId: string, form: FormData) {
    return run(async () => {
        const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
        if (!files.length) throw new ApiError('Aucune photo sélectionnée', 400);
        for (const file of files) {
            const body = new FormData();
            body.append('kind', 'PHOTO');
            const caption = str(form, 'caption');
            if (caption) body.append('caption', caption);
            body.append('file', file);
            await api.interventions.upload(interventionId, body);
        }
        return files.length > 1 ? `${files.length} photos ajoutées` : 'Photo ajoutée';
    });
}

export async function deleteAttachment(id: string) {
    return run(async () => {
        await api.attachments.remove(id);
        return 'Photo supprimée';
    });
}

export async function saveSignature(interventionId: string, signerName: string, image: string) {
    return run(async () => {
        await api.interventions.sign(interventionId, signerName, image);
        return `Signature de ${signerName} enregistrée`;
    });
}

export async function transcribeAudio(interventionId: string, form: FormData) {
    return run(async () => {
        const { text } = await api.interventions.transcribe(interventionId, form);
        return { message: 'Enregistrement transcrit', data: { text } };
    });
}
