import Link from 'next/link';
import { ActivityTimeline, Badge, Card, EmptyState, Kpi, PageHeader, Row } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { formatRelative, PRIORITY, providerLabel, QUOTE_STATUS, REPORT_STATUS } from '@/lib/format';
import { PRIORITY_ORDER } from '@/lib/priority';

export default async function HomePage() {
    const [user, dashboard, requests, toSchedule, reports, quotes] = await Promise.all([
        getCurrentUser(),
        api.dashboard(),
        api.requests.list(),
        api.interventions.list({ status: 'TO_SCHEDULE' }),
        api.reports.list(),
        api.quotes.list(),
    ]);
    const c = dashboard.counters;

    const pendingRequests = requests
        .filter((r) => r.status === 'NEW' || r.status === 'ANALYZED')
        .sort((a, b) => PRIORITY_ORDER(b.priority) - PRIORITY_ORDER(a.priority))
        .slice(0, 4);
    const pendingReports = reports.filter((r) => r.status !== 'SENT').slice(0, 3);
    const pendingQuotes = quotes.filter((q) => q.status === 'DRAFT' || q.status === 'VALIDATED').slice(0, 3);
    const nothingToDo = !pendingRequests.length && !toSchedule.length && !pendingReports.length && !pendingQuotes.length;

    return (
        <>
            <PageHeader
                title={`Bonjour ${user.name.split(' ')[0]} 👋`}
                subtitle="Un bureau administratif IA pour les entreprises de maintenance."
                actions={
                    <Link href="/inbox/nouvelle" className="btn ai">
                        + Simuler une demande entrante
                    </Link>
                }
            />

            <div className="grid g4">
                <Kpi label="Demandes à traiter" value={c.requestsPending} hint={c.urgentPending ? `dont ${c.urgentPending} urgente(s)` : `${c.requestsTotal} reçue(s) aujourd'hui`} href="/inbox" />
                <Kpi label="Interventions" value={c.interventionsToday} hint={`aujourd'hui · ${c.toSchedule} à planifier`} href="/planning" />
                <Kpi label="Rapports" value={c.reportsPending} hint="à valider / envoyer" href="/rapports" />
                <Kpi label="Devis" value={c.quotesDraft} hint={`à valider · ${c.quotesSent} en attente client`} href="/devis" />
            </div>

            <div className="main-aside mt">
                <Card title="À traiter">
                    {nothingToDo && <EmptyState title="Tout est à jour" />}
                    {pendingRequests.map((r) => (
                        <Row
                            key={r.id}
                            href={`/inbox/${r.id}`}
                            title={r.subject}
                            subtitle={`${r.client?.name ?? r.fromName} · ${formatRelative(r.receivedAt)} · Inbox IA`}
                            aside={r.priority ? <Badge {...PRIORITY[r.priority]} /> : <Badge label="À analyser" tone="dark" />}
                        />
                    ))}
                    {toSchedule.map((i) => (
                        <Row
                            key={i.id}
                            href={`/interventions/${i.id}`}
                            title={`#${i.number} · ${i.title}`}
                            subtitle={`${i.client.name} · à planifier`}
                            aside={<Badge {...PRIORITY[i.priority]} />}
                        />
                    ))}
                    {pendingReports.map((r) => (
                        <Row
                            key={r.id}
                            href={`/rapports/${r.id}`}
                            title={`Rapport #${r.intervention.number} · ${r.intervention.client.name}`}
                            subtitle={r.billable ? 'Prestation facturable détectée' : 'À valider puis envoyer au client'}
                            aside={<Badge {...REPORT_STATUS[r.status]} />}
                        />
                    ))}
                    {pendingQuotes.map((q) => (
                        <Row
                            key={q.id}
                            href={`/devis/${q.id}`}
                            title={`Devis ${q.number} · ${q.client.name}`}
                            subtitle={q.title}
                            aside={<Badge {...QUOTE_STATUS[q.status]} />}
                        />
                    ))}
                </Card>

                <div className="stack">
                    <div className="hero">
                        <h2>L&apos;IA propose, vous décidez.</h2>
                        <p>
                            Chaque étape produit un résultat visible et traçable : demande qualifiée, technicien recommandé, client
                            informé, rapport rédigé, devis préparé. Rien n&apos;est envoyé sans votre validation.
                        </p>
                        <div className="muted" style={{ color: '#b9c5d7' }}>
                            Moteur IA : {providerLabel(dashboard.aiProvider)}
                        </div>
                    </div>
                    <Card title="Activité récente">
                        <ActivityTimeline items={dashboard.activity} />
                    </Card>
                </div>
            </div>

        </>
    );
}
