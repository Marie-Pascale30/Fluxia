// Client HTTP vers l'API NestJS — utilisé uniquement côté serveur
// (Server Components et Server Actions), l'URL de l'API n'est jamais exposée au navigateur.
import { connection } from 'next/server';
import type {
    CatalogItem,
    ClientDetail,
    ClientSummary,
    Dashboard,
    InboundRequest,
    InboundRequestDetail,
    Intervention,
    InterventionDetail,
    InterventionStatus,
    PlanningDay,
    Quote,
    QuoteDetail,
    QuoteStatus,
    Recommendation,
    Report,
    ReportDetail,
    ReportSummary,
    RequestStatus,
    TechnicianDetail,
    TechnicianWithLoad,
} from './types';

const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    // Données métier toujours fraîches : jamais de pré-rendu au build
    await connection();
    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            ...init,
            cache: 'no-store',
            headers: { 'content-type': 'application/json', ...init?.headers },
        });
    } catch {
        throw new ApiError(`API injoignable (${API_URL}). Lancez « npm run dev:api ».`, 503);
    }

    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const raw = body?.message ?? response.statusText;
        throw new ApiError(Array.isArray(raw) ? raw.join(' · ') : String(raw), response.status);
    }
    return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined });
const patch = <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });

const qs = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    const s = search.toString();
    return s ? `?${s}` : '';
};

export const api = {
    dashboard: () => get<Dashboard>('/dashboard'),

    requests: {
        list: (status?: RequestStatus) => get<InboundRequest[]>(`/requests${qs({ status })}`),
        get: (id: string) => get<InboundRequestDetail>(`/requests/${id}`),
        ingest: (data: { fromName: string; fromEmail: string; subject: string; body: string; channel?: string }) =>
            post<InboundRequestDetail>('/requests', data),
        update: (id: string, data: Record<string, string | undefined>) => patch<InboundRequestDetail>(`/requests/${id}`, data),
        analyze: (id: string) => post<InboundRequestDetail>(`/requests/${id}/analyze`),
        convert: (id: string, data: object = {}) => post<Intervention>(`/requests/${id}/convert`, data),
        quote: (id: string) => post<Quote>(`/requests/${id}/quote`),
        archive: (id: string) => post<InboundRequestDetail>(`/requests/${id}/archive`),
    },

    interventions: {
        list: (params: { status?: InterventionStatus; technicianId?: string } = {}) =>
            get<Intervention[]>(`/interventions${qs(params)}`),
        get: (id: string) => get<InterventionDetail>(`/interventions/${id}`),
        recommendations: (id: string, date?: string) =>
            get<Recommendation[]>(`/interventions/${id}/recommendations${qs({ date })}`),
        assign: (id: string, data: { technicianId: string; start: string; durationMinutes?: number }) =>
            post<Intervention>(`/interventions/${id}/assign`, data),
        unassign: (id: string) => post<Intervention>(`/interventions/${id}/unassign`),
        dispatch: (id: string) => post<Intervention>(`/interventions/${id}/dispatch`),
        start: (id: string) => post<Intervention>(`/interventions/${id}/start`),
        submitReport: (id: string, voiceNote: string) => post<Report>(`/interventions/${id}/report`, { voiceNote }),
        cancel: (id: string, reason: string) => post<Intervention>(`/interventions/${id}/cancel`, { reason }),
    },

    planning: (date?: string) => get<PlanningDay>(`/planning${qs({ date })}`),

    technicians: {
        list: () => get<TechnicianWithLoad[]>('/technicians'),
        get: (id: string, date?: string) => get<TechnicianDetail>(`/technicians/${id}${qs({ date })}`),
    },

    reports: {
        list: () => get<ReportSummary[]>('/reports'),
        get: (id: string) => get<ReportDetail>(`/reports/${id}`),
        update: (id: string, data: object) => patch<ReportDetail>(`/reports/${id}`, data),
        validate: (id: string) => post<ReportDetail>(`/reports/${id}/validate`),
        reopen: (id: string) => post<ReportDetail>(`/reports/${id}/reopen`),
        send: (id: string) => post<ReportDetail>(`/reports/${id}/send`),
        quote: (id: string) => post<Quote>(`/reports/${id}/quote`),
    },

    quotes: {
        list: (status?: QuoteStatus) => get<Quote[]>(`/quotes${qs({ status })}`),
        get: (id: string) => get<QuoteDetail>(`/quotes/${id}`),
        update: (id: string, data: object) => patch<QuoteDetail>(`/quotes/${id}`, data),
        transition: (id: string, transition: 'validate' | 'reopen' | 'send' | 'accept' | 'refuse') =>
            post<QuoteDetail>(`/quotes/${id}/${transition}`),
    },

    clients: {
        list: (search?: string) => get<ClientSummary[]>(`/clients${qs({ search })}`),
        get: (id: string) => get<ClientDetail>(`/clients/${id}`),
    },

    catalog: () => get<CatalogItem[]>('/catalog'),
};
