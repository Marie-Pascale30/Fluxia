import { parseInboxFilter } from '@/features/inbox/InboxTabs';
import { InboxView } from '@/features/inbox/InboxView';
import { api } from '@/lib/api';
import { orNotFound } from '@/lib/data';

export const metadata = { title: 'Inbox IA' };

export default async function InboxRequestPage({ params, searchParams }: PageProps<'/inbox/[id]'>) {
    const { id } = await params;
    const raw = (await searchParams).filter;
    const request = await orNotFound(api.requests.get(id));

    // Sans filtre explicite, on affiche l'onglet correspondant au statut de la demande
    const filter = raw
        ? parseInboxFilter(raw)
        : request.status === 'CONVERTED' || request.status === 'ARCHIVED'
          ? request.status
          : 'open';

    return <InboxView filter={filter} selected={request} />;
}
