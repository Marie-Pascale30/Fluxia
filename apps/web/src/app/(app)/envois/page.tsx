import { Badge, Card, Notice, PageHeader, Tabs } from '@/components/ui';
import { MessageList } from '@/components/ui/MessageList';
import { api } from '@/lib/api';
import type { MessageStatus } from '@/lib/types';

export const metadata = { title: 'Envois' };

const VIEWS: { key: string; label: string; status?: MessageStatus }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'PENDING', label: 'En attente', status: 'PENDING' },
    { key: 'FAILED', label: 'En échec', status: 'FAILED' },
    { key: 'SENT', label: 'Envoyés', status: 'SENT' },
];

export default async function MessagesPage({ searchParams }: PageProps<'/envois'>) {
    const raw = (await searchParams).view;
    const view = VIEWS.find((v) => v.key === raw) ?? VIEWS[0];
    const log = await api.messages.list(view.status);
    const simulated = log.transports.email === 'log' || log.transports.sms === 'log';

    return (
        <>
            <PageHeader
                title="Envois"
                subtitle="Emails et SMS envoyés aux clients et aux techniciens, avec nouvelles tentatives automatiques en cas d'échec."
                actions={
                    <>
                        <Badge label={`Email : ${log.transports.email === 'log' ? 'simulation' : log.transports.email.toUpperCase()}`} tone={log.transports.email === 'log' ? undefined : 'green'} />
                        <Badge label={`SMS : ${log.transports.sms === 'log' ? 'simulation' : log.transports.sms}`} tone={log.transports.sms === 'log' ? undefined : 'green'} />
                    </>
                }
            />
            {simulated && (
                <Notice tone="warning" title="Mode simulation">
                    Les messages sont tracés mais pas réellement envoyés. Configurez <code>SMTP_URL</code> (emails) et{' '}
                    <code>TWILIO_*</code> (SMS) dans <code>apps/api/.env</code> pour les envoyer.
                </Notice>
            )}
            <Tabs
                active={view.key}
                items={VIEWS.map((v) => ({
                    key: v.key,
                    label: v.status ? `${v.label} · ${log.counts[v.status] ?? 0}` : v.label,
                    href: `/envois?view=${v.key}`,
                }))}
            />
            <Card>
                <MessageList messages={log.messages} empty="Aucun message dans cette vue." />
            </Card>
        </>
    );
}
