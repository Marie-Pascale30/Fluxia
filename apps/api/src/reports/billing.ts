// Détermine ce qui est facturable au client après une intervention.
// L'IA extrait les pièces et le temps passé ; la décision de facturation
// repose uniquement sur la couverture contractuelle (règle déterministe).
import { LABOR_CATALOG_CODE, TRAVEL_CATALOG_CODE, type QuoteLineKind } from '../common/domain.js';
import type { ReportPart } from '../ai/ai.types.js';
import type { ContractCoverage } from '../clients/clients.service.js';

export interface PricedItem {
    label: string;
    kind: string;
    unitPriceCents: number;
}

export interface BillableLine {
    kind: QuoteLineKind;
    label: string;
    quantity: number;
    unitPriceCents: number;
    catalogCode: string | null;
}

export interface BillingResult {
    billable: boolean;
    lines: BillableLine[];
    notes: string;
    warnings: string[];
}

export function computeBilling(
    parts: ReportPart[],
    laborHours: number,
    coverage: ContractCoverage,
    catalog: Map<string, PricedItem>,
): BillingResult {
    const lines: BillableLine[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [];

    if (!coverage.coversParts && parts.length) {
        for (const part of parts) {
            const item = part.catalogCode ? catalog.get(part.catalogCode) : undefined;
            if (!item) warnings.push(`Prix à renseigner : « ${part.label} » absent du catalogue.`);
            lines.push({
                kind: 'PART',
                label: item?.label ?? part.label,
                quantity: part.quantity,
                unitPriceCents: item?.unitPriceCents ?? 0,
                catalogCode: item ? part.catalogCode : null,
            });
        }
        reasons.push('pièces');
    }

    if (!coverage.coversLabor && laborHours > 0) {
        const labor = catalog.get(LABOR_CATALOG_CODE);
        lines.push({
            kind: 'LABOR',
            label: labor?.label ?? "Main d'œuvre",
            quantity: laborHours,
            unitPriceCents: labor?.unitPriceCents ?? 0,
            catalogCode: LABOR_CATALOG_CODE,
        });
        reasons.push("main d'œuvre");
    }

    if (!coverage.coversTravel && lines.length) {
        const travel = catalog.get(TRAVEL_CATALOG_CODE);
        lines.push({
            kind: 'TRAVEL',
            label: travel?.label ?? 'Déplacement',
            quantity: 1,
            unitPriceCents: travel?.unitPriceCents ?? 0,
            catalogCode: TRAVEL_CATALOG_CODE,
        });
        reasons.push('déplacement');
    }

    const billable = lines.length > 0;
    let notes: string;
    if (!billable) {
        notes = coverage.active
            ? `Intervention entièrement couverte par le contrat ${coverage.reference}.`
            : 'Aucun élément facturable détecté.';
    } else if (coverage.active) {
        notes = `Contrat ${coverage.reference} actif, mais ${reasons.join(', ')} hors forfait.`;
    } else {
        notes = `Aucun contrat actif : ${reasons.join(', ')} à facturer.`;
    }

    if (billable) warnings.push('Vérifier les prix unitaires et la couverture contractuelle avant validation.');

    return { billable, lines, notes, warnings };
}

export function quoteTotals(lines: { quantity: number; unitPriceCents: number }[], vatRate: number) {
    const totalHtCents = Math.round(lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0));
    const vatCents = Math.round(totalHtCents * vatRate);
    return { totalHtCents, vatCents, totalTtcCents: totalHtCents + vatCents };
}
