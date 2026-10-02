import { api } from '@/lib/api';
import { PRIORITY_ORDER } from '@/lib/priority';
import type { InboxFilter } from './InboxTabs';

/** Demandes d'un onglet, les plus urgentes en premier pour l'onglet "À traiter". */
export async function loadRequests(filter: InboxFilter) {
    if (filter !== 'open') return api.requests.list(filter);
    const all = await api.requests.list();
    return all
        .filter((r) => r.status === 'NEW' || r.status === 'ANALYZED')
        .sort(
            (a, b) =>
                PRIORITY_ORDER(b.priority) - PRIORITY_ORDER(a.priority) ||
                new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
        );
}
