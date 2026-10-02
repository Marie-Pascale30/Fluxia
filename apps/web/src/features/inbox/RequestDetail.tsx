import Link from 'next/link';
import {
    analyzeRequest,
    archiveRequest,
    convertRequest,
    quoteFromRequest,
} from '@/app/actions';
import { ActionButton } from '@/components/ui/ActionButton';
import { Badge, Card, Field, KeyValue, Notice } from '@/components/ui';
import {
    CATEGORY,
    EQUIPMENT,
    formatDateTime,
    INTERVENTION_STATUS,
    PRIORITY,
    providerLabel,
    QUOTE_STATUS,
    SUGGESTED_ACTION,
} from '@/lib/format';
import type { ClientSummary, InboundRequestDetail } from '@/lib/types';
import { CorrectionForm } from './CorrectionForm';
import { CreateClientForm } from './CreateClientForm';
import { ReplyComposer } from './ReplyComposer';
import { MessageList } from '@/components/ui/MessageList';

function coverageLabel(r: InboundRequestDetail) {
    if (!r.client) return '—';
    if (!r.coverage?.active) return <Badge label="Aucun contrat actif" tone="orange" />;
    return (
        <>
            {r.coverage.reference} <span className="muted">(pièces {r.coverage.coversParts ? 'incluses' : 'non incluses'})</span>
        </>
    );
}

export function RequestDetail({ request: r, clients }: { request: InboundRequestDetail; clients: ClientSummary[] }) {
    const analyzed = r.status !== 'NEW';
    // "Traitée" : une intervention ou un devis existe ; on peut encore répondre au client
    const closed = r.status === 'CONVERTED' || r.status === 'ARCHIVED' || r.status === 'ANSWERED';
    const createLabel = r.category === 'MAINTENANCE' ? "Planifier l'entretien" : "Créer l'intervention";
    const canCreate = !!r.clientId && !!r.siteId;
    const confidence = r.confidence != null ? Math.round(r.confidence * 100) : null;

    return (
        <Card>
            <div className="row-flex">
                {analyzed ? <Badge label="Analyse IA terminée" tone="blue" /> : <Badge label="Non analysée" tone="dark" />}
                {r.category && <Badge {...CATEGORY[r.category]} />}
                {r.priority && <Badge {...PRIORITY[r.priority]} />}
                {confidence != null && <span className="muted small">confiance {confidence}% · {providerLabel(r.aiProvider)}</span>}
            </div>
            <h2>{r.subject}</h2>
            <div className="muted">
                {r.fromName} &lt;{r.fromEmail}&gt; · {formatDateTime(r.receivedAt)}
                {r.attachments > 0 && ` · 📎 ${r.attachments} pièce(s) jointe(s)`}
            </div>

            {analyzed ? (
                <>
                    <Notice title="Ce que Fluxia a compris">
                        {r.summary}
                        {r.symptoms.length > 0 && <div className="mt small">Symptômes : {r.symptoms.join(' · ')}</div>}
                    </Notice>
                    <KeyValue
                        items={[
                            ['Client', r.client ? <Link href={`/clients/${r.client.id}`}>{r.client.name}</Link> : <Badge label="Non identifié" tone="orange" />],
                            ['Site', r.site ? `${r.site.address}, ${r.site.postalCode} ${r.site.city}` : '—'],
                            ['Équipement', r.equipment ? `${r.equipment.label} (${EQUIPMENT[r.equipment.type]})` : '—'],
                            ['Contrat', coverageLabel(r)],
                        ]}
                    />
                    {r.suggestedAction && <Field label="Action proposée">{SUGGESTED_ACTION[r.suggestedAction]}</Field>}
                </>
            ) : (
                <Notice tone="warning">Cette demande n&apos;a pas encore été analysée.</Notice>
            )}

            {r.intervention && (
                <Notice tone="success" title="Intervention créée">
                    <Link href={`/interventions/${r.intervention.id}`}>Intervention #{r.intervention.number}</Link>
                    {r.intervention.status && <> — {INTERVENTION_STATUS[r.intervention.status].label}</>}
                </Notice>
            )}
            {r.quote && (
                <Notice tone="success" title="Devis préparé">
                    <Link href={`/devis/${r.quote.id}`}>Devis {r.quote.number}</Link>
                    {r.quote.status && <> — {QUOTE_STATUS[r.quote.status].label}</>}
                </Notice>
            )}

            {!closed && (
                <div className="actions">
                    {!analyzed && (
                        <ActionButton action={analyzeRequest.bind(null, r.id)} variant="ai" pendingLabel="Analyse en cours…">
                            ✨ Analyser la demande
                        </ActionButton>
                    )}
                    {analyzed && r.category !== 'QUOTE_REQUEST' && (
                        <ActionButton
                            action={convertRequest.bind(null, r.id)}
                            variant="ai"
                            pendingLabel="Création…"
                            disabled={!canCreate}
                            title={canCreate ? undefined : 'Rattachez un client et un site'}
                        >
                            {createLabel}
                        </ActionButton>
                    )}
                    {analyzed && (r.category === 'QUOTE_REQUEST' || r.suggestedAction === 'PREPARE_QUOTE') && (
                        <ActionButton action={quoteFromRequest.bind(null, r.id)} variant="ai" pendingLabel="Génération…" disabled={!r.clientId}>
                            ✨ Préparer le devis
                        </ActionButton>
                    )}
                    {analyzed && r.category === 'QUOTE_REQUEST' && (
                        <ActionButton action={convertRequest.bind(null, r.id)} variant="light" disabled={!canCreate}>
                            Planifier une visite
                        </ActionButton>
                    )}
                    {analyzed && (
                        <ActionButton action={analyzeRequest.bind(null, r.id)} variant="light" pendingLabel="Analyse…">
                            Relancer l&apos;analyse
                        </ActionButton>
                    )}
                    <ActionButton action={archiveRequest.bind(null, r.id)} variant="light" confirm="Archiver cette demande ?">
                        Archiver
                    </ActionButton>
                </div>
            )}

            {analyzed && !r.clientId && r.status !== 'ARCHIVED' && (
                <Notice tone="warning" title="Expéditeur inconnu">
                    Créez sa fiche pour pouvoir planifier une intervention ou préparer un devis.
                    <details className="mt" open>
                        <summary>Nouvelle fiche client</summary>
                        <div className="mt">
                            <CreateClientForm request={r} />
                        </div>
                    </details>
                </Notice>
            )}

            {r.status !== 'ARCHIVED' && (
                <div className="mt">
                    <div className="label">Répondre au client</div>
                    {r.replies.length > 0 && <MessageList messages={r.replies} />}
                    <div className="actions" style={{ marginTop: 10 }}>
                        <ReplyComposer requestId={r.id} recipient={r.fromEmail} />
                    </div>
                </div>
            )}

            {analyzed && !closed && (
                <details className="mt">
                    <summary>Corriger l&apos;analyse</summary>
                    <div className="mt">
                        <CorrectionForm request={r} clients={clients} />
                    </div>
                </details>
            )}

            <details className="mt" open={!analyzed}>
                <summary>Message d&apos;origine</summary>
                <div className="email-body mt">{r.body}</div>
            </details>
        </Card>
    );
}
