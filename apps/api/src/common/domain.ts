// Vocabulaire métier : listes et types issus du contrat partagé (packages/shared),
// complétés des constantes propres à l'API.
import type { Actor, InterventionStatus, Priority } from '@fluxia/shared';

export * from '@fluxia/shared';
export type ActivityActor = Actor;

// Statuts qui occupent le planning d'un technicien
export const PLANNED_STATUSES: InterventionStatus[] = ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];

export const PRIORITY_RANK: Record<Priority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };

// Horaires de travail utilisés par le moteur de planification
export const WORKDAY = { startHour: 8, endHour: 18, slotStepMinutes: 30 } as const;

export const LABOR_CATALOG_CODE = 'MO-H';
export const TRAVEL_CATALOG_CODE = 'DEPL';
