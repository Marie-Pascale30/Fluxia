import Link from 'next/link';
import { Badge, EmptyState } from '@/components/ui';
import { CATEGORY, formatRelative, PRIORITY, REQUEST_STATUS } from '@/lib/format';
import type { InboundRequest } from '@/lib/types';

export function RequestList({ requests, selectedId, query = '' }: { requests: InboundRequest[]; selectedId?: string; query?: string }) {
    if (!requests.length) return <EmptyState icon="✉" title="Aucune demande" />;

    return (
        <div>
            {requests.map((r) => (
                <Link key={r.id} href={`/inbox/${r.id}${query}`} className={`email ${r.id === selectedId ? 'selected' : ''}`}>
                    <div className="row-flex" style={{ gap: 6 }}>
                        {r.status === 'NEW' ? (
                            <Badge {...REQUEST_STATUS.NEW} />
                        ) : (
                            r.category && <Badge {...CATEGORY[r.category]} />
                        )}
                        {r.priority === 'URGENT' && <Badge {...PRIORITY.URGENT} />}
                        {r.status === 'CONVERTED' && <Badge {...REQUEST_STATUS.CONVERTED} />}
                        {r.attachments > 0 && <span className="muted small">📎 {r.attachments}</span>}
                    </div>
                    <h3>{r.subject}</h3>
                    <p>{r.summary ?? r.body}</p>
                    <div className="muted small">
                        {r.client?.name ?? r.fromName} · {formatRelative(r.receivedAt)} · {r.channel === 'EMAIL' ? 'Email' : r.channel}
                    </div>
                </Link>
            ))}
        </div>
    );
}
