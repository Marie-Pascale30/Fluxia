import Link from 'next/link';
import { Badge, Card, EmptyState, KeyValue, PageHeader, Row } from '@/components/ui';
import { api } from '@/lib/api';
import { orNotFound } from '@/lib/data';
import { EQUIPMENT, formatDate, formatMoney, INTERVENTION_STATUS, QUOTE_STATUS } from '@/lib/format';
import type { Contract } from '@/lib/types';

const isActive = (c: Contract, at = new Date()) => new Date(c.startDate) <= at && new Date(c.endDate) >= at;

export default async function ClientPage({ params }: PageProps<'/clients/[id]'>) {
    const { id } = await params;
    const client = await orNotFound(api.clients.get(id));
    const activeContract = client.contracts.find((c) => isActive(c));

    return (
        <>
            <PageHeader
                title={client.name}
                subtitle={[client.contactName, client.email, client.phone].filter(Boolean).join(' · ') || 'Aucun contact renseigné'}
                actions={activeContract ? <Badge label="Contrat actif" tone="green" /> : <Badge label="Sans contrat" tone="orange" />}
            />

            <div className="two">
                <div className="stack">
                    <Card title="Sites & équipements">
                        {client.sites.map((s) => (
                            <div key={s.id} className="row" style={{ alignItems: 'flex-start' }}>
                                <div className="row-main">
                                    <div className="row-title">{s.label}</div>
                                    <div className="muted">
                                        {s.address}, {s.postalCode} {s.city}
                                    </div>
                                    <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                                        {s.equipments.map((e) => (
                                            <li key={e.id}>
                                                {e.label} <span className="muted">· {EQUIPMENT[e.type]}{e.brand ? ` · ${e.brand}` : ''}{e.model ? ` ${e.model}` : ''}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </Card>

                    <Card title="Contrats">
                        {client.contracts.length === 0 && <div className="muted">Aucun contrat : toutes les prestations sont facturables.</div>}
                        {client.contracts.map((c) => (
                            <div key={c.id} className="mb">
                                <div className="row-flex">
                                    <b>{c.reference}</b>
                                    {c === activeContract ? <Badge label="En cours" tone="green" /> : <Badge label="Expiré" />}
                                </div>
                                <div className="muted mb">{c.label}</div>
                                <KeyValue
                                    items={[
                                        ['Période', `${formatDate(c.startDate)} → ${formatDate(c.endDate)}`],
                                        ["Main d'œuvre", c.coversLabor ? 'Incluse' : 'Facturable'],
                                        ['Pièces', c.coversParts ? 'Incluses' : 'Facturables'],
                                        ['Déplacement', c.coversTravel ? 'Inclus' : 'Facturable'],
                                        ['Prochain entretien', c.nextServiceDate ? formatDate(c.nextServiceDate) : '—'],
                                    ]}
                                />
                            </div>
                        ))}
                    </Card>
                </div>

                <div className="stack">
                    <Card title={`Interventions (${client.interventions.length})`}>
                        {client.interventions.length === 0 && <EmptyState title="Aucune intervention" />}
                        {client.interventions.map((i) => (
                            <Row
                                key={i.id}
                                href={`/interventions/${i.id}`}
                                title={`#${i.number} · ${i.title}`}
                                subtitle={`${formatDate(i.scheduledStart ?? i.createdAt)}${i.technician ? ` · ${i.technician.firstName}` : ''}${i.equipment ? ` · ${i.equipment.label}` : ''}`}
                                aside={<Badge {...INTERVENTION_STATUS[i.status]} />}
                            />
                        ))}
                    </Card>

                    <Card title={`Devis (${client.quotes.length})`}>
                        {client.quotes.length === 0 && <div className="muted">Aucun devis.</div>}
                        {client.quotes.map((q) => (
                            <Row
                                key={q.id}
                                href={`/devis/${q.id}`}
                                title={`${q.number} · ${q.title}`}
                                subtitle={`${formatDate(q.createdAt)} · ${formatMoney(q.lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPriceCents), 0))} HT`}
                                aside={<Badge {...QUOTE_STATUS[q.status]} />}
                            />
                        ))}
                    </Card>
                    <Link href="/clients" className="muted small">
                        ← Tous les clients
                    </Link>
                </div>
            </div>
        </>
    );
}
