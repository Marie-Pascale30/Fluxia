'use server';

// Toutes les mutations passent par ces Server Actions : elles appellent l'API,
// revalident les pages et renvoient un résultat affiché en toast côté client.
// Pour ajouter l'authentification : vérifier la session au début de `run()`.
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { FLASH_COOKIE } from '@/lib/flash';
import { fromLocalInput } from '@/lib/format';

export interface ActionResult {
    ok: boolean;
    message: string;
    redirectTo?: string;
}

async function run(
    task: () => Promise<{ message: string; redirectTo?: string } | string>,
): Promise<ActionResult> {
    let result: { message: string; redirectTo?: string };
    try {
        const value = await task();
        result = typeof value === 'string' ? { message: value } : value;
    } catch (error) {
        unstable_rethrow(error); // laisse passer les redirections (ex. session expirée)
        const message = error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue';
        return { ok: false, message };
    }

    revalidatePath('/', 'layout');
    if (result.redirectTo) {
        // Redirection côté serveur : fiable même si le composant appelant disparaît
        // après revalidation. Le message est transmis via un cookie "flash".
        (await cookies()).set(FLASH_COOKIE, result.message, { maxAge: 30, path: "/" });
        redirect(result.redirectTo);
    }
    return { ok: true, message: result.message };
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
