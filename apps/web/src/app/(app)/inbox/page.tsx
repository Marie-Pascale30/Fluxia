import { parseInboxFilter } from '@/features/inbox/InboxTabs';
import { InboxView } from '@/features/inbox/InboxView';

export const metadata = { title: 'Inbox IA' };

export default async function InboxPage({ searchParams }: PageProps<'/inbox'>) {
    const filter = parseInboxFilter((await searchParams).filter);
    return <InboxView filter={filter} />;
}
