import { Tabs } from '@/components/ui';

export const INBOX_FILTERS = [
    { key: 'open', label: 'À traiter' },
    { key: 'CONVERTED', label: 'Traitées' },
    { key: 'ARCHIVED', label: 'Archivées' },
] as const;

export type InboxFilter = (typeof INBOX_FILTERS)[number]['key'];

export const parseInboxFilter = (value: unknown): InboxFilter =>
    INBOX_FILTERS.some((f) => f.key === value) ? (value as InboxFilter) : 'open';

export function InboxTabs({ active, base }: { active: InboxFilter; base: string }) {
    return (
        <Tabs
            active={active}
            items={INBOX_FILTERS.map((f) => ({ key: f.key, label: f.label, href: f.key === 'open' ? base : `${base}?filter=${f.key}` }))}
        />
    );
}
