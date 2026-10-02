'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { quoteTransition, saveQuote } from '@/app/actions';
import { useToast } from '@/components/ui/Toast';
import { formatMoney, LINE_KIND } from '@/lib/format';
import type { CatalogItem, QuoteDetail, QuoteLineKind } from '@/lib/types';

interface EditableLine {
    key: number;
    kind: QuoteLineKind;
    label: string;
    quantity: number;
    unitPrice: string; // en euros, saisi librement
    catalogCode?: string;
}

const toCents = (euros: string) => Math.round(Number(euros.replace(',', '.')) * 100) || 0;
let nextKey = 1;

/** Éditeur de devis brouillon : lignes, prix et totaux calculés en direct. */
export function QuoteEditor({ quote, catalog }: { quote: QuoteDetail; catalog: CatalogItem[] }) {
    const toast = useToast();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    // Modifications non enregistrées : la validation les enregistre d'abord
    const [dirty, setDirty] = useState(false);
    const [title, setTitleState] = useState(quote.title);
    const [notes, setNotesState] = useState(quote.notes ?? '');
    const [lines, setLinesState] = useState<EditableLine[]>(() =>
        quote.lines.map((l) => ({
            key: nextKey++,
            kind: l.kind,
            label: l.label,
            quantity: l.quantity,
            unitPrice: (l.unitPriceCents / 100).toFixed(2),
            catalogCode: l.catalogCode ?? undefined,
        })),
    );

    const touch = () => setDirty(true);
    const setTitle = (v: string) => (touch(), setTitleState(v));
    const setNotes = (v: string) => (touch(), setNotesState(v));
    const setLines: typeof setLinesState = (v) => (touch(), setLinesState(v));

    const missingPrice = lines.some((l) => toCents(l.unitPrice) === 0);

    const totals = useMemo(() => {
        const ht = lines.reduce((sum, l) => sum + Math.round(l.quantity * toCents(l.unitPrice)), 0);
        const vat = Math.round(ht * quote.vatRate);
        return { ht, vat, ttc: ht + vat };
    }, [lines, quote.vatRate]);

    const update = (key: number, patch: Partial<EditableLine>) =>
        setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));

    const addFromCatalog = (code: string) => {
        const item = catalog.find((c) => c.code === code);
        if (!item) return;
        setLines((list) => [
            ...list,
            { key: nextKey++, kind: item.kind, label: item.label, quantity: 1, unitPrice: (item.unitPriceCents / 100).toFixed(2), catalogCode: item.code },
        ]);
    };

    const persist = () =>
        saveQuote(quote.id, {
                title,
                notes,
                lines: lines.map((l) => ({
                    kind: l.kind,
                    label: l.label,
                    quantity: l.quantity,
                    unitPriceCents: toCents(l.unitPrice),
                catalogCode: l.catalogCode,
            })),
        });

    const save = () =>
        startTransition(async () => {
            const result = await persist();
            if (!result.ok) toast(result.message, 'error');
            if (result.ok) {
                setDirty(false);
                router.refresh();
            }
        });

    /** Enregistre d'abord les modifications en cours, puis valide la version enregistrée. */
    const saveAndValidate = () =>
        startTransition(async () => {
            if (dirty) {
                const saved = await persist();
                if (!saved.ok) return toast(saved.message, 'error');
                setDirty(false);
            }
            const result = await quoteTransition(quote.id, 'validate');
            if (!result.ok) toast(result.message, 'error');
            router.refresh();
        });

    return (
        <div className="form">
            <label>
                Objet
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <table className="table">
                <thead>
                    <tr>
                        <th>Désignation</th>
                        <th style={{ width: 90 }}>Qté</th>
                        <th style={{ width: 120 }}>PU HT (€)</th>
                        <th className="right" style={{ width: 110 }}>
                            Total HT
                        </th>
                        <th style={{ width: 40 }} />
                    </tr>
                </thead>
                <tbody>
                    {lines.map((l) => (
                        <tr key={l.key}>
                            <td>
                                <input className="input" value={l.label} onChange={(e) => update(l.key, { label: e.target.value })} />
                                <div className="muted small">{LINE_KIND[l.kind]}</div>
                            </td>
                            <td>
                                <input
                                    className="input"
                                    type="number"
                                    min={0.01}
                                    step={0.25}
                                    value={l.quantity}
                                    onChange={(e) => update(l.key, { quantity: Number(e.target.value) })}
                                />
                            </td>
                            <td>
                                <input
                                    className="input"
                                    inputMode="decimal"
                                    value={l.unitPrice}
                                    onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                                    style={toCents(l.unitPrice) === 0 ? { borderColor: 'var(--red)' } : undefined}
                                />
                            </td>
                            <td className="right nowrap">{formatMoney(Math.round(l.quantity * toCents(l.unitPrice)))}</td>
                            <td>
                                <button type="button" className="btn light sm" onClick={() => setLines((list) => list.filter((x) => x.key !== l.key))}>
                                    ✕
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={3} className="right">
                            Total HT
                        </td>
                        <td className="right nowrap">{formatMoney(totals.ht)}</td>
                        <td />
                    </tr>
                    <tr>
                        <td colSpan={3} className="right muted">
                            TVA {Math.round(quote.vatRate * 100)} %
                        </td>
                        <td className="right nowrap muted">{formatMoney(totals.vat)}</td>
                        <td />
                    </tr>
                    <tr>
                        <td colSpan={3} className="right">
                            Total TTC
                        </td>
                        <td className="right nowrap">{formatMoney(totals.ttc)}</td>
                        <td />
                    </tr>
                </tfoot>
            </table>

            <div className="row-flex">
                <select className="select" style={{ maxWidth: 360 }} value="" onChange={(e) => addFromCatalog(e.target.value)}>
                    <option value="">+ Ajouter depuis le catalogue…</option>
                    {catalog.map((c) => (
                        <option key={c.code} value={c.code}>
                            {c.label} — {formatMoney(c.unitPriceCents)}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="btn light sm"
                    onClick={() => setLines((l) => [...l, { key: nextKey++, kind: 'OTHER', label: 'Prestation', quantity: 1, unitPrice: '0.00' }])}
                >
                    + Ligne libre
                </button>
            </div>

            <label>
                Notes
                <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <div className="row-flex">
                <button type="button" className="btn light" onClick={save} disabled={pending || !dirty || lines.length === 0}>
                    Enregistrer le brouillon
                </button>
                <button
                    type="button"
                    className="btn green"
                    onClick={saveAndValidate}
                    disabled={pending || lines.length === 0 || missingPrice}
                    title={missingPrice ? 'Complétez les prix manquants' : undefined}
                >
                    {pending ? 'Patientez…' : dirty ? 'Enregistrer et valider' : 'Valider le devis'}
                </button>
                {dirty && <span className="dirty-hint">● Modifications non enregistrées</span>}
            </div>
        </div>
    );
}
