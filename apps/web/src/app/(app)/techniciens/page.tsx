import Link from 'next/link';
import { SkillsField } from '@/components/forms/fields';
import { Avatar, Badge, Card, PageHeader } from '@/components/ui';
import { CreateTechnicianForm, EditTechnicianForm, TechnicianAccountActions } from '@/features/technicians/TechnicianForms';
import { api } from '@/lib/api';
import { EQUIPMENT, formatDuration, formatTime, initials, INTERVENTION_STATUS } from '@/lib/format';
import type { Technician } from '@/lib/types';

export const metadata = { title: 'Techniciens' };

const WORKDAY_MINUTES = 10 * 60;

function TechnicianFields({ technician }: { technician?: Technician }) {
    return (
        <>
            <div className="form-row">
                <label>
                    Prénom
                    <input name="firstName" className="input" required minLength={2} defaultValue={technician?.firstName} />
                </label>
                <label>
                    Nom
                    <input name="lastName" className="input" required minLength={2} defaultValue={technician?.lastName} />
                </label>
            </div>
            <div className="form-row">
                {!technician && (
                    <label>
                        Email (identifiant)
                        <input name="email" type="email" className="input" required />
                    </label>
                )}
                <label>
                    Téléphone
                    <input name="phone" type="tel" className="input" defaultValue={technician?.phone ?? ''} />
                </label>
                <label>
                    Adresse de départ
                    <input name="baseAddress" className="input" placeholder={technician ? 'Inchangée' : '10 rue de la Roquette 75011 Paris'} />
                </label>
            </div>
            <SkillsField defaults={technician?.skills} />
        </>
    );
}

export default async function TechniciansPage() {
    const technicians = await api.technicians.list({ includeInactive: true });
    const active = technicians.filter((t) => t.active);
    const inactive = technicians.filter((t) => !t.active);

    return (
        <>
            <PageHeader title="Techniciens" subtitle="Charge du jour, compétences et accès à la vue terrain de chaque technicien." />

            <details className="card mb">
                <summary>+ Ajouter un technicien</summary>
                <div className="mt">
                    <CreateTechnicianForm fields={<TechnicianFields />} />
                </div>
            </details>

            <div className="grid g3">
                {[...active, ...inactive].map((t) => {
                    const load = Math.min(100, Math.round((t.plannedMinutes / WORKDAY_MINUTES) * 100));
                    return (
                        <Card key={t.id} className={t.active ? undefined : 'inactive-card'}>
                            <div className="row-flex">
                                <Avatar label={initials(t.firstName, t.lastName)} />
                                <div className="grow">
                                    <b>
                                        {t.firstName} {t.lastName}
                                    </b>
                                    <div className="muted small">{t.skills.map((s) => EQUIPMENT[s]).join(' · ')}</div>
                                </div>
                                {t.active ? (
                                    <Badge label={load >= 80 ? 'Complet' : `${100 - load}% libre`} tone={load >= 80 ? 'red' : load >= 50 ? 'orange' : 'green'} />
                                ) : (
                                    <Badge label="Désactivé" />
                                )}
                            </div>
                            {t.active && (
                                <>
                                    <div className="bar mt">
                                        <span style={{ width: `${load}%` }} />
                                    </div>
                                    <div className="muted small" style={{ marginTop: 4 }}>
                                        {t.today.length} intervention(s) · {formatDuration(t.plannedMinutes)} planifiées
                                    </div>
                                    <div className="mt">
                                        {t.today.map((i) => (
                                            <Link key={i.id} href={`/interventions/${i.id}`} className="row">
                                                <div className="row-main">
                                                    <div className="row-title">
                                                        {formatTime(i.scheduledStart!)} · {i.title}
                                                    </div>
                                                </div>
                                                <Badge {...INTERVENTION_STATUS[i.status]} />
                                            </Link>
                                        ))}
                                    </div>
                                </>
                            )}
                            <div className="actions">
                                {t.active && (
                                    <Link href={`/techniciens/${t.id}`} className="btn ai sm">
                                        Vue terrain →
                                    </Link>
                                )}
                                <span className="muted small">{t.email}</span>
                            </div>
                            <details className="mt">
                                <summary className="small">Gérer</summary>
                                <div className="mt stack">
                                    <EditTechnicianForm technician={t} fields={<TechnicianFields technician={t} />} />
                                    <TechnicianAccountActions technician={t} />
                                </div>
                            </details>
                        </Card>
                    );
                })}
            </div>
        </>
    );
}
