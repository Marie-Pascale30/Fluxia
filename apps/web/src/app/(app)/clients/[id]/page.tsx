import Link from 'next/link';
import { Badge, Card, EmptyState, KeyValue, PageHeader, Row } from '@/components/ui';
import { AddContractForm, AddEquipmentForm, AddSiteForm, DeleteEquipmentButton, EditClientForm } from '@/features/clients/ClientEditors';
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
                    <details className="card">
                        <summary>Modifier la fiche</summary>
                        <div className="mt">
                            <EditClientForm client={client} />
                        </div>
                    </details>

                    <Card title="Sites & équipements">
                        {client.sites.length === 0 && <div className="muted">Aucun site : ajoutez-en un pour planifier des interventions.</div>}
                        {client.sites.map((s) => (
                            <div key={s.id} className="row" style={{ alignItems: 'flex-start' }}>
                                <div className="row-main">
                                    <div className="row-title">{s.label}</div>
                                    <div className="muted">
                                        {s.address}, {s.postalCode} {s.city}
                                    </div>
                                    <ul className="small equipment-list">
                                        {s.equipments.map((e) => (
                                            <li key={e.id}>
                                                <span className="grow">
                                                    {e.label}{' '}
                                                    <span className="muted">
                                                        · {EQUIPMENT[e.type]}
                                                        {e.brand ? ` · ${e.brand}` : ''}
                                                        {e.model ? ` ${e.model}` : ''}
                                                    </span>
                                                </span>
                                                <DeleteEquipmentButton equipment={e} />
                                            </li>
                                        ))}
                                    </ul>
                                    <details className="mt">
                                        <summary className="small">+ Équipement</summary>
                                        <div className="mt">
                                            <AddEquipmentForm siteId={s.id} />
                                        </div>
                                    </details>
                                </div>
                            </div>
                        ))}
                        <details className="mt">
                            <summary>+ Ajouter un site</summary>
                            <div className="mt">
                                <AddSiteForm clientId={client.id} />
                            </div>
                        </details>
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
                        <details className="mt">
                            <summary>+ Ajouter un contrat</summary>
                            <div className="mt">
                                <AddContractForm clientId={client.id} />
                            </div>
                        </details>
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
