import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { InboundRequestDetail } from '@/lib/types';
import { InboxTabs, type InboxFilter } from './InboxTabs';
import { loadRequests } from './loadRequests';
import { RequestDetail } from './RequestDetail';
import { RequestList } from './RequestList';

/** Vue Inbox : liste à gauche, demande sélectionnée (ou la plus prioritaire) à droite. */
export async function InboxView({ filter, selected }: { filter: InboxFilter; selected?: InboundRequestDetail }) {
    const [requests, clients] = await Promise.all([loadRequests(filter), api.clients.list()]);
    const current = selected ?? (requests[0] ? await api.requests.get(requests[0].id) : undefined);

    return (
        <>
            <PageHeader
                title="Inbox IA"
                subtitle="Chaque demande entrante devient une action structurée."
                actions={
                    <Link href="/inbox/nouvelle" className="btn ai">
                        + Simuler une demande
                    </Link>
                }
            />
            <InboxTabs active={filter} base="/inbox" />
            <div className="split">
                <RequestList requests={requests} selectedId={current?.id} query={filter === 'open' ? '' : `?filter=${filter}`} />
                {current ? (
                    <RequestDetail request={current} clients={clients} />
                ) : (
                    <Card>
                        <EmptyState icon="✉" title="Aucune demande dans cette vue" />
                    </Card>
                )}
            </div>
        </>
    );
}
