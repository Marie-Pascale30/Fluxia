import { ConflictException } from '@nestjs/common';
import type { InterventionStatus, QuoteStatus, ReportStatus } from './domain.js';

type Transitions<S extends string> = Record<S, readonly S[]>;

// Cycle de vie d'une intervention : toute transition non listée est refusée.
export const INTERVENTION_TRANSITIONS: Transitions<InterventionStatus> = {
    TO_SCHEDULE: ['SCHEDULED', 'CANCELLED'],
    SCHEDULED: ['TO_SCHEDULE', 'SCHEDULED', 'DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['TO_SCHEDULE', 'SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED'],
    COMPLETED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
};

export const REPORT_TRANSITIONS: Transitions<ReportStatus> = {
    DRAFT: ['VALIDATED'],
    VALIDATED: ['DRAFT', 'SENT'],
    SENT: [],
};

// Un devis n'est JAMAIS envoyé sans validation humaine préalable.
export const QUOTE_TRANSITIONS: Transitions<QuoteStatus> = {
    DRAFT: ['VALIDATED'],
    VALIDATED: ['DRAFT', 'SENT'],
    SENT: ['ACCEPTED', 'REFUSED'],
    ACCEPTED: [],
    REFUSED: [],
};

export function canTransition<S extends string>(table: Transitions<S>, from: S, to: S): boolean {
    return table[from]?.includes(to) ?? false;
}

export function assertTransition<S extends string>(
    table: Transitions<S>,
    from: S,
    to: S,
    entity: string,
): void {
    if (!canTransition(table, from, to)) {
        throw new ConflictException(`${entity} : transition ${from} → ${to} non autorisée`);
    }
}
