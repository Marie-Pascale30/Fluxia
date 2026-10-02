'use client';

import { useState } from 'react';
import { updateReport } from '@/app/actions';
import { useActionToast } from '@/components/ui/useActionToast';
import type { CatalogItem, ReportDetail, ReportPart } from '@/lib/types';

/** Correction du brouillon de rapport ; la facturation est recalculée à l'enregistrement. */
export function ReportEditor({ report, catalog }: { report: ReportDetail; catalog: CatalogItem[] }) {
    const { formAction, pending } = useActionToast(updateReport.bind(null, report.id));
    const [parts, setParts] = useState<ReportPart[]>(report.parts);
    const partsCatalog = catalog.filter((c) => c.kind === 'PART' || c.kind === 'OTHER');

    const update = (index: number, patch: Partial<ReportPart>) =>
        setParts((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));

    return (
        <form action={formAction} className="form">
            <label>
                Motif
                <input name="reason" className="input" defaultValue={report.reason} required minLength={3} />
            </label>
            <label>
                Diagnostic
                <textarea name="diagnosis" className="textarea" rows={2} defaultValue={report.diagnosis} required minLength={3} />
            </label>
            <label>
                Travaux réalisés
                <textarea name="workDone" className="textarea" rows={3} defaultValue={report.workDone} required minLength={3} />
            </label>
            <div className="form-row">
                <label>
                    Résultat
                    <input name="result" className="input" defaultValue={report.result} required minLength={3} />
                </label>
                <label>
                    Main d&apos;œuvre (h)
                    <input name="laborHours" type="number" step={0.25} min={0} max={24} className="input" defaultValue={report.laborHours} />
                </label>
            </div>
            <label>
                Recommandation
                <input name="recommendation" className="input" defaultValue={report.recommendation ?? ''} />
            </label>

            <div>
                <div className="label">Pièces fournies</div>
                {parts.map((p, i) => (
                    <div key={i} className="row-flex" style={{ marginTop: 8 }}>
                        <select
                            className="select grow"
                            value={p.catalogCode ?? ''}
                            onChange={(e) => {
                                const item = catalog.find((c) => c.code === e.target.value);
                                update(i, { catalogCode: item?.code ?? null, label: item?.label ?? p.label });
                            }}
                        >
                            <option value="">Hors catalogue — {p.label}</option>
                            {partsCatalog.map((c) => (
                                <option key={c.code} value={c.code}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            className="input"
                            style={{ width: 80 }}
                            min={0.01}
                            step={1}
                            value={p.quantity}
                            onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                        />
                        <button type="button" className="btn light sm" onClick={() => setParts((l) => l.filter((_, j) => j !== i))}>
                            ✕
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className="btn light sm"
                    style={{ marginTop: 8 }}
                    onClick={() => setParts((l) => [...l, { label: partsCatalog[0]?.label ?? 'Pièce', catalogCode: partsCatalog[0]?.code ?? null, quantity: 1 }])}
                >
                    + Ajouter une pièce
                </button>
            </div>
            <input type="hidden" name="parts" value={JSON.stringify(parts)} />

            <div>
                <button className="btn" disabled={pending}>
                    {pending ? 'Enregistrement…' : 'Enregistrer les corrections'}
                </button>
            </div>
        </form>
    );
}
