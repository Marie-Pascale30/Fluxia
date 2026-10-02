import { retryMessage } from '@/app/actions';
import { formatDateTime } from '@/lib/format';
import type { OutboundMessage } from '@/lib/types';
import { ActionButton } from './ActionButton';
import { Badge } from '.';

const CHANNEL_ICON = { EMAIL: '✉', SMS: '💬', PUSH: '📱' } as const;

/** Statut d'envoi lisible : envoyé (et par quel moyen), simulé, en attente ou en échec. */
export function DeliveryBadge({ message }: { message: Pick<OutboundMessage, 'status' | 'transport' | 'attempts' | 'lastError'> }) {
    if (message.status === 'FAILED') return <Badge label="Échec" tone="red" />;
    if (message.status === 'PENDING') return <Badge label={message.attempts ? `Nouvel essai (${message.attempts})` : 'En attente'} tone="orange" />;
    if (message.transport === 'log') return <Badge label="Simulé" />;
    if (message.transport === 'in-app') return <Badge label="Dans l'appli" tone="blue" />;
    return <Badge label={`Envoyé · ${message.transport?.toUpperCase()}`} tone="green" />;
}

export function MessageList({ messages, empty = 'Aucun message pour l’instant.' }: { messages: OutboundMessage[]; empty?: string }) {
    if (!messages.length) return <div className="muted">{empty}</div>;
    return (
        <>
            {messages.map((m) => (
                <details key={m.id} className="row" style={{ display: 'block' }}>
                    <summary className="row-flex">
                        <span aria-hidden>{CHANNEL_ICON[m.channel]}</span>
                        <span className="grow">
                            {m.subject}
                            <span className="muted small"> — {m.recipient} · {formatDateTime(m.createdAt)}</span>
                        </span>
                        <DeliveryBadge message={m} />
                    </summary>
                    {m.lastError && (
                        <div className="form-error mt">
                            {m.lastError}
                            {m.status === 'FAILED' && (
                                <span style={{ marginLeft: 8 }}>
                                    <ActionButton action={retryMessage.bind(null, m.id)} variant="light" size="sm">
                                        Réessayer
                                    </ActionButton>
                                </span>
                            )}
                        </div>
                    )}
                    <div className="email-body mt">{m.body}</div>
                </details>
            ))}
        </>
    );
}
